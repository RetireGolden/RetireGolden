/**
 * Income-coverage fixture suite (planning-depth roadmap section 3).
 *
 * These tests are intentionally named after the roadmap acceptance criterion:
 * recommendation sources must not build a narrower income model. Candidate and
 * detector actions are allowed to propose patches, but the exact ledger must
 * still see every ledger-known income and cash-flow source.
 */

import { describe, expect, it } from 'vitest'

import { applyScenarioPatch, compareScenarios } from '@retiregolden/engine/scenarios/scenarios'
import { registry as insightDetectors } from '@retiregolden/engine/insights/registry'
import type { DetectorContext } from '@retiregolden/engine/insights/types'
import { packForYear } from '@retiregolden/engine/params'
import { projectPlan, taxCalculatorFor } from '../planner/useProjection'
import {
  accumulatorPlan,
  oneTimeIncomePlan,
  simOptions,
  ssTaxabilityPlan,
  taxableBridgePlan,
} from '@retiregolden/engine/decisions/decisionFixtures'
import { createDecisionContext, evaluateCandidate } from '@retiregolden/engine/decisions/evaluateCandidate'
import {
  simpleRothConversionGenerator,
  socialSecurityClaimGenerator,
  withdrawalOrderGenerator,
} from '@retiregolden/engine/decisions/generators'
import type { DecisionCandidate } from '@retiregolden/engine/decisions/types'

const candidateGenerators = [simpleRothConversionGenerator, withdrawalOrderGenerator, socialSecurityClaimGenerator]

function generatedEvaluations(plan: ReturnType<typeof accumulatorPlan>) {
  const ctx = createDecisionContext(plan, simOptions())
  const candidates = candidateGenerators.flatMap((generator) => generator.generate(ctx))
  return { ctx, evaluations: candidates.map((candidate) => evaluateCandidate(ctx, candidate)) }
}

function detectorContext(plan: ReturnType<typeof accumulatorPlan>): DetectorContext {
  const proj = projectPlan(plan, 2026)
  return {
    plan,
    projection: {
      result: proj.result,
      summary: proj.summary,
      startYear: proj.startYear,
      deflate: proj.deflate,
    },
    params: packForYear(2026).pack,
  }
}

function coverageCandidate(overrides: Partial<DecisionCandidate>): DecisionCandidate {
  return {
    id: 'coverage-candidate',
    source: 'heuristic',
    category: 'roth',
    label: 'Coverage candidate',
    explanation: 'Exercises exact-ledger income coverage.',
    ...overrides,
  }
}

describe('income-coverage fixture suite', () => {
  it('candidate evaluation preserves lumpy one-time income in every generated candidate run', () => {
    const { evaluations } = generatedEvaluations(oneTimeIncomePlan())
    expect(evaluations.length).toBeGreaterThan(0)
    for (const evaluation of evaluations) {
      const y2028 = evaluation.candidateResult.years.find((year) => year.year === 2028)!
      expect(y2028.incomes.oneTime, evaluation.candidate.id).toBe(80_000)
    }
  })

  it('candidate evaluation preserves scheduled contributions and employer match', () => {
    const { ctx, evaluations } = generatedEvaluations(accumulatorPlan())
    expect(evaluations.length).toBeGreaterThan(0)
    const total = (years: typeof ctx.baselineResult.years, field: 'contributions' | 'employerMatch') =>
      years.reduce((sum, year) => sum + year[field], 0)

    for (const evaluation of evaluations) {
      expect(total(evaluation.candidateResult.years, 'contributions'), evaluation.candidate.id).toBeCloseTo(
        total(ctx.baselineResult.years, 'contributions'),
        2,
      )
      expect(total(evaluation.candidateResult.years, 'employerMatch'), evaluation.candidate.id).toBeCloseTo(
        total(ctx.baselineResult.years, 'employerMatch'),
        2,
      )
    }
  })

  it('candidate evaluation still prices taxable-gain realization and Social Security taxability fixtures', () => {
    const highBasis = generatedEvaluations(taxableBridgePlan('high')).evaluations
    const lowBasis = generatedEvaluations(taxableBridgePlan('low')).evaluations
    const realized = (evaluations: typeof highBasis) =>
      evaluations.reduce(
        (sum, evaluation) => sum + evaluation.candidateResult.years.reduce((s, y) => s + y.realizedGains, 0),
        0,
      )
    expect(realized(lowBasis)).toBeGreaterThan(realized(highBasis) + 10_000)

    const ssCtx = createDecisionContext(ssTaxabilityPlan(), simOptions())
    const beforeBenefits = evaluateCandidate(ssCtx, coverageCandidate({ conversions: [{ year: 2027, amount: 30_000 }] }))
    const duringBenefits = evaluateCandidate(ssCtx, coverageCandidate({ conversions: [{ year: 2036, amount: 30_000 }] }))
    const ssYear = duringBenefits.candidateResult.years.find((year) => year.year === 2036)!
    expect(ssYear.incomes.socialSecurity).toBeGreaterThan(0)
    expect(duringBenefits.deltas.lifetimeTax).toBeGreaterThan(beforeBenefits.deltas.lifetimeTax + 500)
  })

  it('detector preview patches preserve ledger-known income arrays and scheduled account cash flows', () => {
    const plan = accumulatorPlan()
    plan.incomes.push({
      type: 'oneTime',
      id: 'coverage-lump',
      label: 'Deferred comp',
      year: 2028,
      amount: 40_000,
      taxTreatment: 'ordinary',
    })
    const cards = insightDetectors.map((detector) => detector.screen(detectorContext(plan))).filter(Boolean)
    expect(cards.length).toBeGreaterThan(0)

    for (const card of cards) {
      if (card!.action.kind !== 'preview-scenario') continue
      const comparison = compareScenarios(plan, { startYear: 2026, taxCalculator: taxCalculatorFor(plan) }, [
        { id: `${card!.id}-coverage`, name: card!.title, patch: card!.action.patch },
      ])
      const row = comparison.rows[1]!
      expect(row.error, card!.id).toBeNull()
      const applied = applyScenarioPatch(plan, card!.action.patch)
      expect(applied.ok, card!.id).toBe(true)
      if (!applied.ok) continue
      const patched = applied.plan
      expect(patched.incomes.some((income) => income.id === 'coverage-lump'), card!.id).toBe(true)
      expect(
        patched.accounts.some(
          (account) => account.type === 'traditional' && account.annualContribution > 0 && account.employerMatch,
        ),
        card!.id,
      ).toBe(true)
    }
  })
})
