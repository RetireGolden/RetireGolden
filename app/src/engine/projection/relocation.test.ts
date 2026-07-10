/**
 * Relocation compare acceptance tests (DOCS/enhancements/state-relocation-compare.md):
 *  - per-state sweep rows byte-identical to manually editing the plan's state;
 *  - drivers reconcile to the ledger's state-tax lines, and the CA→FL vs CA→PA
 *    public-pension fixture surfaces the pension-exclusion driver;
 *  - scenario patches round-trip;
 *  - deterministic metrics are stable across Monte Carlo seeds.
 */

import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan'
import { applyScenarioPatch } from '../scenarios/scenarios'
import { buildLognormalModelConfigForPlan } from '../montecarlo/marketModels'
import { combineTaxCalculators, createFederalTaxCalculator } from '../tax/federalTax'
import { createStateTaxCalculator } from '../tax/stateTax'
import {
  singlePersonPlan,
  socialSecurityIncome,
  traditionalAccount,
  validatePlan,
} from '../../testSupport/planFixtures'
import { summarizeProjection } from './compare'
import {
  compareRelocationCandidates,
  MAX_RELOCATION_CANDIDATES,
  relocationScenarioPatch,
  type RelocationCandidateRow,
} from './relocation'
import { simulatePlan } from './simulate'

const START_YEAR = 2026

function publicPension(id: string, monthlyAmount: number): Account {
  return {
    type: 'pension',
    id,
    name: 'State public pension',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    source: 'public',
    startAge: 65,
    monthlyAmount,
    colaPct: 0,
    survivorPct: 0,
  }
}

/** CA retiree with a public pension, SS, and a traditional IRA — the plan's acceptance fixture. */
function caPublicPensionRetiree(): Plan {
  const plan = singlePersonPlan({ state: 'CA', dob: '1961-06-01', planningAge: 88, retirementAge: null })
  plan.accounts = [traditionalAccount('trad', 700_000), publicPension('pension', 3_500)]
  plan.incomes = [socialSecurityIncome('ss', 2_400, 67)]
  plan.expenses.baseAnnual = 70_000
  return validatePlan(plan)
}

function productionStack(plan: Plan) {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

function row(rows: RelocationCandidateRow[], id: string): RelocationCandidateRow {
  const found = rows.find((r) => r.id === id)
  if (!found) throw new Error(`missing row ${id}`)
  return found
}

describe('compareRelocationCandidates', () => {
  it('candidate rows are byte-identical to manually editing the plan state', () => {
    const plan = caPublicPensionRetiree()
    const comparison = compareRelocationCandidates(plan, [{ state: 'FL' }], { startYear: START_YEAR })
    const fl = row(comparison.rows, 'candidate-0')

    const manual: Plan = validatePlan({
      ...plan,
      household: { ...plan.household, state: 'FL', stateMoves: [] },
    })
    const manualResult = simulatePlan(manual, { startYear: START_YEAR, taxCalculator: productionStack(manual) })
    const manualSummary = summarizeProjection(manual, manualResult)

    expect(fl.error).toBeNull()
    expect(fl.lifetimeTaxesAndPenalties).toBe(manualSummary.lifetimeTaxesAndPenalties)
    expect(fl.endingAfterTaxEstate).toBe(manualSummary.endingAfterTaxEstate)
    expect(fl.endingNetWorth).toBe(manualSummary.endingNetWorth)
    expect(fl.depletionYear).toBe(manualResult.depletionYear)
    expect(fl.lifetimeStateLocalTax).toBe(0)
  })

  it('a move-year candidate matches a manual split-year state move', () => {
    const plan = caPublicPensionRetiree()
    const moveYear = START_YEAR + 4
    const comparison = compareRelocationCandidates(plan, [{ state: 'FL', moveYear }], { startYear: START_YEAR })
    const fl = row(comparison.rows, 'candidate-0')

    const manual: Plan = validatePlan({
      ...plan,
      household: { ...plan.household, stateMoves: [{ fromYear: moveYear, fromMonth: 7, state: 'FL' }] },
    })
    const manualResult = simulatePlan(manual, { startYear: START_YEAR, taxCalculator: productionStack(manual) })
    const manualSummary = summarizeProjection(manual, manualResult)

    expect(fl.lifetimeTaxesAndPenalties).toBe(manualSummary.lifetimeTaxesAndPenalties)
    expect(fl.endingAfterTaxEstate).toBe(manualSummary.endingAfterTaxEstate)
    // Pre-move CA years still owe CA tax; post-move years owe nothing.
    expect(fl.lifetimeStateLocalTax).toBeGreaterThan(0)
    expect(fl.lifetimeStateLocalTax).toBeLessThan(row(compareRelocationCandidates(plan, [], { startYear: START_YEAR }).rows, 'baseline').lifetimeStateLocalTax)
  })

  it('CA→FL vs CA→PA: drivers reconcile to the ledger and PA surfaces the pension exclusion', () => {
    const plan = caPublicPensionRetiree()
    const comparison = compareRelocationCandidates(plan, [{ state: 'FL' }, { state: 'PA' }], {
      startYear: START_YEAR,
    })
    const baseline = row(comparison.rows, 'baseline')
    const fl = row(comparison.rows, 'candidate-0')
    const pa = row(comparison.rows, 'candidate-1')

    // Every row's driver total reconciles with its per-year state-tax lines.
    for (const r of [baseline, fl, pa]) {
      expect(r.drivers).not.toBeNull()
      const lineSum = r.stateTaxByYear.reduce((sum, l) => sum + l.tax, 0)
      expect(r.drivers!.totalStateLocalTax).toBeCloseTo(lineSum, 6)
      expect(r.lifetimeStateLocalTax).toBeCloseTo(lineSum, 6)
      expect(r.warnings.some((w) => w.includes('could not reconcile'))).toBe(false)
      expect(r.modeled).toBe(true)
    }

    // FL: no broad income tax at all.
    expect(fl.drivers!.facts!.hasIncomeTax).toBe(false)
    expect(fl.lifetimeStateLocalTax).toBe(0)

    // PA: one shared full retirement-income exclusion (age 60+) shelters the
    // public pension and IRA withdrawals — the pension-exclusion driver.
    expect(pa.drivers!.facts!.hasIncomeTax).toBe(true)
    expect(pa.drivers!.facts!.retirementRuleShared).toBe(true)
    expect(pa.drivers!.retirementExclusionSavings).toBeGreaterThan(0)
    expect(pa.drivers!.publicPensionExclusionSavings).toBe(0)

    // CA baseline: SS is left out of the state base, and the plan receives SS.
    expect(baseline.drivers!.facts!.taxesSocialSecurity).toBe(false)
    expect(baseline.drivers!.ssTreatmentSavings).toBeGreaterThan(0)
    // CA has no retirement exclusion, so that driver is zero.
    expect(baseline.drivers!.retirementExclusionSavings).toBe(0)

    // Both candidates beat staying in CA on lifetime taxes for this fixture.
    expect(fl.lifetimeTaxesAndPenalties).toBeLessThan(baseline.lifetimeTaxesAndPenalties)
    expect(pa.lifetimeTaxesAndPenalties).toBeLessThan(baseline.lifetimeTaxesAndPenalties)
  })

  it('a separate public-pension law surfaces as its own driver (NY)', () => {
    const plan = caPublicPensionRetiree()
    const comparison = compareRelocationCandidates(plan, [{ state: 'NY' }], { startYear: START_YEAR })
    const ny = row(comparison.rows, 'candidate-0')
    expect(ny.drivers!.facts!.retirementRuleShared).toBe(false)
    expect(ny.drivers!.publicPensionExclusionSavings).toBeGreaterThan(0)
    expect(ny.drivers!.retirementExclusionSavings).toBeGreaterThanOrEqual(ny.drivers!.publicPensionExclusionSavings)
  })

  it('scenario patches round-trip through applyScenarioPatch to the row the sweep ran', () => {
    const plan = caPublicPensionRetiree()
    const candidate = { state: 'PA', moveYear: START_YEAR + 2, spendingDeltaPct: -10 }
    const comparison = compareRelocationCandidates(plan, [candidate], { startYear: START_YEAR })
    const pa = row(comparison.rows, 'candidate-0')

    const applied = applyScenarioPatch(plan, relocationScenarioPatch(plan, candidate, START_YEAR))
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.household.stateMoves).toEqual([{ fromYear: START_YEAR + 2, fromMonth: 7, state: 'PA' }])
    expect(applied.plan.expenses.baseAnnual).toBe(63_000)
    const result = simulatePlan(applied.plan, { startYear: START_YEAR, taxCalculator: productionStack(applied.plan) })
    const summary = summarizeProjection(applied.plan, result)
    expect(pa.lifetimeTaxesAndPenalties).toBe(summary.lifetimeTaxesAndPenalties)
    expect(pa.endingAfterTaxEstate).toBe(summary.endingAfterTaxEstate)
  })

  it('deterministic metrics and ranking are stable across Monte Carlo seeds', () => {
    const plan = caPublicPensionRetiree()
    const candidates = [{ state: 'FL' }, { state: 'PA' }]
    const model = buildLognormalModelConfigForPlan(plan)
    const runA = compareRelocationCandidates(plan, candidates, {
      startYear: START_YEAR,
      monteCarlo: { model, pathCount: 50, seed: 1 },
    })
    const runB = compareRelocationCandidates(plan, candidates, {
      startYear: START_YEAR,
      monteCarlo: { model, pathCount: 50, seed: 999 },
    })
    for (const r of runA.rows) {
      const other = row(runB.rows, r.id)
      expect(other.lifetimeStateLocalTax).toBe(r.lifetimeStateLocalTax)
      expect(other.lifetimeTaxesAndPenalties).toBe(r.lifetimeTaxesAndPenalties)
      expect(other.endingAfterTaxEstate).toBe(r.endingAfterTaxEstate)
      expect(r.successRate).not.toBeNull()
      expect(other.successRate).not.toBeNull()
    }
  })

  it('clears a flat state-rate override for candidates and says so via modeled flags', () => {
    const plan = caPublicPensionRetiree()
    plan.assumptions.stateEffectiveTaxPct = 5
    const comparison = compareRelocationCandidates(plan, [{ state: 'FL' }], { startYear: START_YEAR })
    const baseline = row(comparison.rows, 'baseline')
    const fl = row(comparison.rows, 'candidate-0')
    // Baseline keeps the override: flat tax charged, no driver attribution.
    expect(baseline.modeled).toBe(false)
    expect(baseline.drivers!.facts).toBeNull()
    expect(baseline.lifetimeStateLocalTax).toBeGreaterThan(0)
    // The candidate drops it so the destination's modeled rules apply.
    expect(fl.modeled).toBe(true)
    expect(fl.lifetimeStateLocalTax).toBe(0)
    const patch = relocationScenarioPatch(plan, { state: 'FL' }, START_YEAR)
    expect((patch.assumptions as Record<string, unknown>).stateEffectiveTaxPct).toBe(0)
  })

  it('caps the sweep at MAX_RELOCATION_CANDIDATES', () => {
    const plan = caPublicPensionRetiree()
    const many = ['FL', 'TX', 'WA', 'NV', 'TN', 'PA', 'NY'].map((state) => ({ state }))
    const comparison = compareRelocationCandidates(plan, many, { startYear: START_YEAR })
    expect(comparison.rows).toHaveLength(1 + MAX_RELOCATION_CANDIDATES)
  })

  it('rejects an invalid candidate with an error row instead of sinking the sweep', () => {
    const plan = caPublicPensionRetiree()
    const comparison = compareRelocationCandidates(plan, [{ state: 'XXX' }, { state: 'FL' }], {
      startYear: START_YEAR,
    })
    expect(row(comparison.rows, 'candidate-0').error).not.toBeNull()
    expect(row(comparison.rows, 'candidate-1').error).toBeNull()
  })

  it('a move year beyond the horizon prices the unmoved plan and says so', () => {
    const plan = caPublicPensionRetiree()
    const baseline = row(compareRelocationCandidates(plan, [], { startYear: START_YEAR }).rows, 'baseline')
    const comparison = compareRelocationCandidates(plan, [{ state: 'FL', moveYear: START_YEAR + 60 }], {
      startYear: START_YEAR,
    })
    const late = row(comparison.rows, 'candidate-0')
    expect(late.error).toBeNull()
    // The ledger never leaves CA, so the drill-down attributes CA — not FL —
    // and the row warns instead of masquerading as a priced relocation.
    expect(late.destinationState).toBe('CA')
    expect(late.warnings.some((w) => w.includes('falls after the plan horizon'))).toBe(true)
    expect(late.lifetimeTaxesAndPenalties).toBe(baseline.lifetimeTaxesAndPenalties)
    expect(late.lifetimeStateLocalTax).toBe(baseline.lifetimeStateLocalTax)
  })

  it('flags an unmodeled two-letter state as modeled:false instead of erroring', () => {
    const plan = caPublicPensionRetiree()
    const comparison = compareRelocationCandidates(plan, [{ state: 'XX' }], { startYear: START_YEAR })
    const xx = row(comparison.rows, 'candidate-0')
    expect(xx.error).toBeNull()
    expect(xx.modeled).toBe(false)
    expect(xx.lifetimeStateLocalTax).toBe(0)
  })
})
