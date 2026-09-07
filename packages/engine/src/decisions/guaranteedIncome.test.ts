/**
 * Decision-engine coverage for the guaranteed-income and estate-depth plan:
 * the annuity-purchase candidate generator (bounded SPIA/QLAC candidates that
 * evaluate on the exact ledger) and the survivor reserve target as a hard
 * constraint on the protect-survivor-liquidity policy.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { simOptions, survivorPlan } from '../testing/decisionFixtures.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { annuityPurchaseGenerator } from './generators.js'
import { makeProtectSurvivorLiquidity, objectivePolicyForPlan, protectSurvivorLiquidity } from './objectives.js'
import { runDecisionTournament } from './tournament.js'

type AnnuityAccount = Extract<Account, { type: 'annuity' }>
type TraditionalAccount = Extract<Account, { type: 'traditional' }>

function qlacAnnuityFromPatch(planPatch: Record<string, unknown> | undefined): AnnuityAccount | undefined {
  const accounts = planPatch?.accounts as Account[] | undefined
  if (!Array.isArray(accounts)) return undefined
  return accounts.find(
    (account): account is AnnuityAccount =>
      account.type === 'annuity' && account.purchase?.qlac === true,
  )
}

function qlacCandidatesForPlan(plan: ReturnType<typeof survivorPlan>) {
  const ctx = createDecisionContext(plan, simOptions())
  return annuityPurchaseGenerator.generate(ctx).filter((c) => c.id === 'annuity-qlac')
}

function survivorPlanWithIraOwner(primaryDob: string, ownerDob: string, ownerPersonId = 'p2') {
  const plan = survivorPlan()
  plan.household.people[0].dob = primaryDob
  plan.household.people[0].longevity = { planningAge: 95, source: 'manual' }
  plan.household.people[1].dob = ownerDob
  plan.household.people[1].longevity = { planningAge: 95, source: 'manual' }
  const traditional = plan.accounts.find((a): a is TraditionalAccount => a.type === 'traditional')
  if (!traditional) throw new Error('expected traditional account')
  traditional.ownerPersonId = ownerPersonId
  return { plan, traditional }
}

describe('annuity purchase candidate generator', () => {
  it('emits a QLAC candidate from the selected traditional account owner age, not the primary', () => {
    const { plan: positivePlan, traditional } = survivorPlanWithIraOwner('1942-06-15', '1944-06-15')
    // Domain §17 product policy; Treas. Reg. 1.408-8(a)(3) IRA-owner substitution for legal deadline only.
    // Worksheet: owner age 2026 − 1944 = 82; 82 < 83; min(85, max(82 + 1, 80)) = 83.
    // Pre-fix primary-age gate omits the candidate at primary 84. A partial fix that uses the owner
    // gate for suppression but still chooses preferred start age from the primary would emit start 85.
    const positiveCtx = createDecisionContext(positivePlan, simOptions())
    const qlacCandidates = annuityPurchaseGenerator.generate(positiveCtx).filter((c) => c.id === 'annuity-qlac')
    expect(qlacCandidates).toHaveLength(1)
    const qlac = qlacCandidates[0]!
    const annuity = qlacAnnuityFromPatch(qlac.planPatch)
    expect(annuity?.ownerPersonId).toBe('p2')
    expect(annuity?.startAge).toBe(83)
    expect(annuity?.purchase?.year).toBe(2026)
    expect(annuity?.purchase?.taxQualification).toBe('qualified')
    expect(annuity?.purchase?.qlac).toBe(true)
    expect(annuity?.purchase?.fundingAccountId).toBe(traditional.id)
    const evaluation = evaluateCandidate(positiveCtx, qlac)
    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(Number.isFinite(evaluation.candidateSummary.endingAfterTaxEstate)).toBe(true)

    // Inverse households: owner age 83+ suppresses even when primary is younger.
    expect(qlacCandidatesForPlan(survivorPlanWithIraOwner('1944-06-15', '1943-06-15').plan)).toHaveLength(0)
    expect(qlacCandidatesForPlan(survivorPlanWithIraOwner('1944-06-15', '1942-06-15').plan)).toHaveLength(0)

    // Raw generator boundary: parsePlan rejects null/dangling traditional owners; the generator
    // fail-closes on unresolved ids when called on in-memory plans. Baseline from a valid plan.
    const { plan: baselineSource } = survivorPlanWithIraOwner('1944-06-15', '1944-06-15')
    const baseline = simulatePlan(baselineSource, simOptions())
    for (const unresolvedOwner of [null, 'missing-person'] as const) {
      const rawPlan = structuredClone(baselineSource)
      const rawTraditional = rawPlan.accounts.find((a): a is TraditionalAccount => a.type === 'traditional')
      if (!rawTraditional) throw new Error('expected traditional account')
      rawTraditional.ownerPersonId = unresolvedOwner
      const rawCtx = createDecisionContext(rawPlan, simOptions(), { result: baseline })
      expect(annuityPurchaseGenerator.generate(rawCtx).filter((c) => c.id === 'annuity-qlac')).toHaveLength(0)
    }
  })

  it('emits bounded SPIA and QLAC candidates that evaluate on the exact ledger', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const candidates = annuityPurchaseGenerator.generate(ctx)
    // No existing purchase → no "buy none" candidate; SPIA (cash) + its
    // laddered alternative + QLAC (IRA).
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    expect(candidates.length).toBeLessThanOrEqual(4)
    const ids = candidates.map((c) => c.id)
    expect(ids).toContain('annuity-spia')
    expect(ids).toContain('annuity-spia-ladder')
    expect(ids).toContain('annuity-qlac')
    for (const candidate of candidates) {
      const evaluation = evaluateCandidate(ctx, candidate)
      // A valid, executable patch is never diagnostic — the ledger priced it.
      expect(evaluation.recommendationState).not.toBe('diagnostic')
      expect(Number.isFinite(evaluation.candidateSummary.endingAfterTaxEstate)).toBe(true)
    }
  })

  it('ranks annuity candidates through the shared tournament', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const result = runDecisionTournament(ctx, [annuityPurchaseGenerator], { policy: protectSurvivorLiquidity })
    expect(result.ranked.length).toBeGreaterThanOrEqual(2)
    for (const row of result.ranked) expect(Number.isFinite(row.primaryValue)).toBe(true)
  })
})

describe('survivor reserve target constraint', () => {
  it('disqualifies a candidate whose survivor-year investable falls below the target', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const policy = makeProtectSurvivorLiquidity(2_000_000)
    const evaluation = evaluateCandidate(ctx, {
      id: 'noop',
      source: 'heuristic',
      category: 'spending',
      label: 'noop',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 40_000 } },
    })
    expect(policy.constraintViolations(evaluation, ctx).some((v) => v.includes('reserve target'))).toBe(true)
  })

  it('does not fire the reserve constraint for a comfortably-met target', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const policy = makeProtectSurvivorLiquidity(1)
    const evaluation = evaluateCandidate(ctx, {
      id: 'noop',
      source: 'heuristic',
      category: 'spending',
      label: 'noop',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 40_000 } },
    })
    expect(policy.constraintViolations(evaluation, ctx).some((v) => v.includes('reserve target'))).toBe(false)
  })

  it('objectivePolicyForPlan wires the plan strategy target into the policy', () => {
    const plan = survivorPlan()
    plan.strategies.survivorReserveTarget = 500_000
    const resolved = objectivePolicyForPlan('protect-survivor-liquidity', plan)
    expect(resolved.description).toContain('500,000')
  })
})
