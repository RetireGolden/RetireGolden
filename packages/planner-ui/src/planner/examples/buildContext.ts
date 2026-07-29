import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

/** Fixed clock and deterministic entity ids so example golden tests stay stable. */

export const EXAMPLE_FIXED_NOW_ISO = '2026-06-29T12:00:00.000Z'

export function exampleFixedNow(): Date {
  return new Date(EXAMPLE_FIXED_NOW_ISO)
}

export const EXAMPLE_FIXED_YEAR = 2026

/** Stable ids within an example plan (not the IndexedDB plan id). */
export function exampleEntityId(exampleId: string, suffix: string): string {
  return `${exampleId}--${suffix}`
}

/** Deterministic `newId` for createEmptyPlan — resets on each build() call. */
export function exampleIdFactory(exampleId: string): () => string {
  let index = 0
  return () => exampleEntityId(exampleId, `seq-${index++}`)
}

/**
 * Curated examples that advertise ACA credits carry complete planning-year
 * contracts even though the standard editor does not yet expose those facts.
 * The SLCSP equals the example's stated enrollment premium; both are explicit
 * example assumptions rather than Marketplace estimates.
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
    const healthInflation =
      (plan.assumptions.inflationPct + plan.assumptions.healthcareExtraInflationPct) / 100
    const fplRegion =
      plan.household.state === 'AK'
        ? 'alaska' as const
        : plan.household.state === 'HI'
          ? 'hawaii' as const
          : 'contiguous' as const

    healthcare.acaYears = []
    for (let year = EXAMPLE_FIXED_YEAR; year <= endYear; year++) {
      const livingPeople = plan.household.people.filter(
        (person) =>
          year - Number(person.dob.slice(0, 4)) <= person.longevity.planningAge,
      )
      const coveredPeople = livingPeople
        .map((person) => {
          const age = year - Number(person.dob.slice(0, 4))
          const birthMonth = Number(person.dob.slice(5, 7))
          const coveredMonths = age < 65 ? 12 : age === 65 ? birthMonth - 1 : 0
          return { person, coveredMonths }
        })
        .filter(({ coveredMonths }) => coveredMonths > 0)
      if (coveredPeople.length === 0) continue

      const monthlyPremium =
        healthcare.pre65MonthlyPremiumPerPerson *
        Math.pow(1 + healthInflation, year - EXAMPLE_FIXED_YEAR)
      healthcare.acaYears.push({
        year,
        fplRegion,
        taxFamilyMembers: livingPeople.map((person, index) => ({
          personId: person.id,
          relationship: index === 0 ? 'primary' as const : 'spouse' as const,
          requiredToFile: 'required' as const,
          magi: 0,
        })),
        coveredMembers: coveredPeople.map(({ person, coveredMonths }) => ({
          personId: person.id,
          enrollmentPremiumByMonth: Array.from({ length: 12 }, (_, month) =>
            month < coveredMonths ? monthlyPremium : 0,
          ),
          slcspBenchmarkPremiumByMonth: Array.from({ length: 12 }, (_, month) =>
            month < coveredMonths ? monthlyPremium : 0,
          ),
        })),
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
