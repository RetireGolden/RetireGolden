/**
 * Decision-engine coverage for the guaranteed-income and estate-depth plan:
 * the annuity-purchase candidate generator (bounded SPIA/QLAC candidates that
 * evaluate on the exact ledger) and the survivor reserve target as a hard
 * constraint on the protect-survivor-liquidity policy.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import { simOptions, survivorPlan } from '../testing/decisionFixtures.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { annuityPurchaseGenerator } from './generators.js'
import { makeProtectSurvivorLiquidity, objectivePolicyForPlan, protectSurvivorLiquidity } from './objectives.js'
import { runDecisionTournament } from './tournament.js'

type AnnuityAccount = Extract<Account, { type: 'annuity' }>

function qlacAnnuityFromPatch(planPatch: Record<string, unknown> | undefined): AnnuityAccount | undefined {
  const accounts = planPatch?.accounts as Account[] | undefined
  if (!Array.isArray(accounts)) return undefined
  return accounts.find(
    (account): account is AnnuityAccount =>
      account.type === 'annuity' && account.purchase?.qlac === true,
  )
}

describe('annuity purchase candidate generator', () => {
  it('emits a QLAC candidate from the selected traditional account owner age, not the primary', () => {
    const plan = survivorPlan()
    plan.household.people[0].dob = '1942-06-15'
    plan.household.people[0].longevity = { planningAge: 95, source: 'manual' }
    plan.household.people[1].dob = '1944-06-15'
    plan.household.people[1].longevity = { planningAge: 95, source: 'manual' }
    const traditional = plan.accounts.find((a): a is Extract<Account, { type: 'traditional' }> => a.type === 'traditional')
    if (!traditional) throw new Error('expected traditional account')
    traditional.ownerPersonId = 'p2'
    // Domain §17 product policy + Treas. Reg. 1.408-8(a)(3) IRA-owner substitution.
    // Worksheet: owner age 2026 − 1944 = 82; 82 < 83; min(85, max(82 + 1, 80)) = 83.
    // Primary age 84 suppresses the candidate today; owner gate with primary start would emit 85.
    const ctx = createDecisionContext(plan, simOptions())
    const qlacCandidates = annuityPurchaseGenerator.generate(ctx).filter((c) => c.id === 'annuity-qlac')
    expect(qlacCandidates).toHaveLength(1)
    const qlac = qlacCandidates[0]!
    const annuity = qlacAnnuityFromPatch(qlac.planPatch)
    expect(annuity?.ownerPersonId).toBe('p2')
    expect(annuity?.startAge).toBe(83)
    expect(annuity?.purchase?.year).toBe(2026)
    expect(annuity?.purchase?.taxQualification).toBe('qualified')
    expect(annuity?.purchase?.qlac).toBe(true)
    expect(annuity?.purchase?.fundingAccountId).toBe(traditional.id)
    const evaluation = evaluateCandidate(ctx, qlac)
    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(Number.isFinite(evaluation.candidateSummary.endingAfterTaxEstate)).toBe(true)
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
