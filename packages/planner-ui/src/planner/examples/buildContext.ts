import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleFixedNow } from './exampleClock'

/**
 * Fixed clock and deterministic entity ids so example golden tests stay stable.
 * The clock lives in the leaf module ./exampleClock (the projection seam reads
 * EXAMPLE_FIXED_YEAR from there); it is re-exported here for existing callers.
 */
export { EXAMPLE_FIXED_NOW_ISO, EXAMPLE_FIXED_YEAR, exampleFixedNow } from './exampleClock'

/** Stable ids within an example plan (not the IndexedDB plan id). */
export function exampleEntityId(exampleId: string, suffix: string): string {
  return `${exampleId}--${suffix}`
}

/** Deterministic `newId` for createEmptyPlan — resets on each build() call. */
export function exampleIdFactory(exampleId: string): () => string {
  let index = 0
  return () => exampleEntityId(exampleId, `seq-${index++}`)
}

// These are the established example values, intentionally pinned apart from
// createEmptyPlan's defaults so existing golden projections stay stable.
const EXAMPLE_BASELINE_ASSUMPTIONS = {
  inflationPct: 2.5,
  healthcareExtraInflationPct: 2,
  defaultReturnPct: 6,
  ssCola: { mode: 'matchInflation' },
  ssHaircut: null,
  stateEffectiveTaxPct: 0,
  localIncomeTaxPct: 0,
  recentAnnualMagi: 0,
  heirTaxRatePct: 25,
  safeWithdrawalRatePct: 4,
} satisfies Plan['assumptions']

const EXAMPLE_BASELINE_STRATEGIES = {
  withdrawalOrder: { mode: 'sequential' },
  rothConversion: { mode: 'none' },
  qcdAnnual: 0,
  retirementActions: [],
} satisfies Plan['strategies']

type ExamplePlanOptions = {
  exampleId: string
  name: string
  assumptions?: Partial<Plan['assumptions']>
  strategies?: Partial<Plan['strategies']>
}

/**
 * Builds the deterministic shared baseline for every curated example. Builders
 * only supply the assumptions and strategy facts that make their scenario
 * distinct; parseExamplePlan remains the validation boundary.
 */
export function createExamplePlan({
  exampleId,
  name,
  assumptions = {},
  strategies = {},
}: ExamplePlanOptions): Plan {
  const plan = createEmptyPlan({
    name,
    now: exampleFixedNow,
    newId: exampleIdFactory(exampleId),
  })

  plan.assumptions = { ...structuredClone(EXAMPLE_BASELINE_ASSUMPTIONS), ...assumptions }
  plan.strategies = { ...structuredClone(EXAMPLE_BASELINE_STRATEGIES), ...strategies }
  return plan
}

/**
 * Curated examples that advertise ACA credits carry one premium-credit
 * contract for each year from EXAMPLE_FIXED_YEAR in which someone alive by
 * planning age has Marketplace months before Medicare, even though the
 * standard editor does not yet expose those facts. Each is a 'premiumField'
 * contract (decision D-EXAMPLE-SOURCE-SWITCH, 2026-09-28): it states only the
 * year and the facts the example asserts (no tax-exempt interest, no foreign
 * exclusion, every filing assertion ruled out), and the engine fills the rest
 * on every run: the region from the state, the tax family from who is alive,
 * and each covered month's enrollment premium and SLCSP benchmark from the
 * example's pre-65 premium grown by that run's healthcare inflation. The SLCSP
 * equals the enrollment premium, an explicit example assumption rather than a
 * Marketplace estimate, and editing the premium re-prices the credit.
 */
export function parseExamplePlan(plan: Plan): ReturnType<typeof parsePlan> {
  const healthcare = plan.expenses.healthcare
  if (
    healthcare.applyAcaCredit &&
    healthcare.pre65MonthlyPremiumPerPerson > 0 &&
    healthcare.acaYears === undefined
  ) {
    const endYear = Math.max(
      ...plan.household.people.map(
        (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
      ),
    )
    healthcare.acaYears = []
    for (let year = EXAMPLE_FIXED_YEAR; year <= endYear; year++) {
      const covered = plan.household.people.some((person) => {
        const age = year - Number(person.dob.slice(0, 4))
        const coveredMonths = age < 65 ? 12 : age === 65 ? Number(person.dob.slice(5, 7)) - 1 : 0
        return age <= person.longevity.planningAge && coveredMonths > 0
      })
      if (!covered) continue
      healthcare.acaYears.push({
        year,
        premiumBasis: 'premiumField',
        taxExemptInterest: { state: 'notApplicable', amount: null },
        foreignExclusionAddback: { state: 'notApplicable', amount: null },
        assertions: {
          coverageEligibility: 'supported',
          form8814: 'notApplicable',
          specialAllocation: 'notApplicable',
          marriedFilingSeparatelyException: 'notApplicable',
          selfEmployedHealthInsuranceDeduction: 'notApplicable',
          otherMaterialFacts: 'none',
        },
      })
    }
  }

  return parsePlan(plan)
}
