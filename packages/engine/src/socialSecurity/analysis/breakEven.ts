/**
 * The claiming break-even chart: for a few whole-year claim ages, the
 * cumulative own retirement benefit a person has received by each age, in the
 * plan's own dollars, and the age at which each later claim's total catches up
 * with each earlier one's. A teaching lens on one person's own benefit; the
 * whole-plan claim-age sweep is the complete answer.
 *
 * Each year's benefit is the ledger's, priced by the ledger's year function
 * (socialSecurity/householdYear.ts#socialSecurityYear) for the person's own
 * benefit alone: the PIA the projection pays from (the resolved start-year
 * PIA) times the claim factor, for a whole year in the claim-age year (as the
 * ledger pays a claim at a whole age), times the ledger's cost-of-living factor
 * and trust-fund haircut for that calendar year (socialSecurity/colaFactor.ts),
 * so the chart's dollars are the plan's (owner decision R6). With the person's
 * wages the earnings test withholds part of the benefit before full retirement
 * age and the months withheld raise it from that age, as the ledger does for
 * the person's own benefit; nothing else paid on the record is charged here.
 *
 * @see DOCS/calculations/social-security/social-security-claim-break-even.md
 */
import type { Assumptions } from '../../model/plan.js'
import { inflationFactor, planDollarBasis } from '../../projection/dollarBasis.js'
import { claimFactor } from '../claimFactor.js'
import { socialSecurityColaFactor, socialSecurityHaircutFactor } from '../colaFactor.js'
import { effectiveBirthYear, fraForBirthYear, type DobParts } from '../nra.js'
import { householdPathYear, NO_CREDITS, type PathCredits, type PathHousehold } from './householdPaths.js'

/** The first age on the chart: the earliest age an own retirement benefit can start. */
export const BREAK_EVEN_FIRST_AGE = 62

/**
 * The plan's inflation factor from `startYear` to a later year, by the
 * ledger's own deterministic recurrence (projection/dollarBasis.ts#planDollarBasis),
 * so a factor read here is the one a deterministic projection at that rate
 * multiplies by. Built out to `endYear`; a year outside the range is refused.
 */
export function planInflationFactorFrom(
  inflationPct: number,
  startYear: number,
  endYear: number,
): (fromYear: number, toYear: number) => number {
  const basis = planDollarBasis(inflationPct, startYear, Math.max(startYear, endYear))
  return (fromYear: number, toYear: number): number => {
    if (fromYear !== startYear) {
      throw new RangeError(`The plan's inflation factor is read from its start year ${startYear}; got ${fromYear}`)
    }
    return inflationFactor(basis, toYear)
  }
}

/**
 * The claim ages the chart compares: 62, the full-retirement-age year and 70,
 * each at or after the age the person reaches in `startYear` (a claim in a year
 * already past is not a choice the chart can offer).
 */
export function breakEvenClaimAges(dob: DobParts, startYear: number): number[] {
  const fra = fraForBirthYear(effectiveBirthYear(dob.year, dob.month, dob.day))
  const currentAge = startYear - dob.year
  return [...new Set([BREAK_EVEN_FIRST_AGE, fra.years, 70])].sort((a, b) => a - b).filter((age) => age >= currentAge)
}

export interface ClaimBreakEvenInput {
  readonly dob: DobParts
  /** The monthly PIA the projection pays from in `startYear`. */
  readonly piaMonthly: number
  /** Whole-year claim ages from 62 to 70, none before the age reached in `startYear`. */
  readonly claimAges: readonly number[]
  readonly startYear: number
  readonly assumptions: Pick<Assumptions, 'inflationPct' | 'ssCola' | 'ssHaircut'>
  /** Yearly return on benefits already received, percent; 0 is a plain running total. */
  readonly growthPct: number
  /** The last age charted, usually the person's planning age. */
  readonly throughAge: number
  /**
   * The person's wages in a year, in that year's dollars (the plan's wage rows,
   * analysis/expectedValue.ts#personWagesInYear), for the earnings test; none
   * when omitted.
   */
  readonly wagesInYear?: (year: number) => number
}

export interface ClaimBreakEvenPoint {
  readonly age: number
  readonly year: number
  /** Cumulative value by this age, in the plan's nominal dollars, unrounded, keyed by claim age. */
  readonly cumulative: Readonly<Record<number, number>>
}

export interface ClaimBreakEvenCrossing {
  readonly early: number
  readonly late: number
  /** The age the later claim's total first reaches the earlier one's (linear within a year), unrounded; null if not by throughAge. */
  readonly age: number | null
}

export interface ClaimBreakEvenResult {
  readonly series: readonly ClaimBreakEvenPoint[]
  readonly crossings: readonly ClaimBreakEvenCrossing[]
  /** The claim factor, as a fraction of the PIA, by claim age. */
  readonly factors: Readonly<Record<number, number>>
  /** The claim ages at which the earnings test withholds part of the benefit, in order; empty with no wages. */
  readonly withheldClaimAges: readonly number[]
}

/**
 * Cumulative own benefits by age for each claim age, and each pair's crossing.
 *
 * For each age a from 62 through `throughAge`, in calendar year y = birth year
 * + a, and each claim age c: benefit_c(a) is the own benefit the ledger's year
 * function pays the person in y with the claim at c years and 0 months and no
 * other benefit on the record: 0 before c, otherwise PIA × claimFactor × 12 ×
 * the ledger's COLA factor for y × its haircut for y, less what the earnings
 * test withholds from it on the person's wages, and from the full-retirement-
 * age month at the claim age raised by the months withheld; the running total
 * is B_c(a) = B_c(a − 1) × (1 + g) + benefit_c(a). For each pair e < l,
 * walking the ages at which B_e is positive, the crossing is the first age a
 * with D(a) = B_l(a) − B_e(a) ≥ 0, at a − 1 + (−D(a − 1)) / (D(a) − D(a − 1))
 * when the previous difference was negative, else at a. Nothing is rounded
 * here; the page rounds for display.
 */
export function claimBreakEven(input: ClaimBreakEvenInput): ClaimBreakEvenResult {
  const { dob, piaMonthly, claimAges, startYear, assumptions, growthPct, throughAge } = input
  const currentAge = startYear - dob.year
  const factors: Record<number, number> = {}
  for (const claimAge of claimAges) {
    if (!Number.isInteger(claimAge)) throw new RangeError(`A break-even claim age is a whole number of years; got ${claimAge}`)
    if (claimAge < currentAge) {
      throw new RangeError(`Claim age ${claimAge} falls before ${startYear}, the plan's first year, when the person is ${currentAge}`)
    }
    factors[claimAge] = claimFactor(dob.year, dob.month, dob.day, { years: claimAge, months: 0 })
  }
  const g = growthPct / 100
  const inflationFrom = planInflationFactorFrom(assumptions.inflationPct, startYear, dob.year + throughAge)
  const isoDob = `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`
  const wagesInYear = input.wagesInYear
  // The person alone with the own benefit at each claim age: one path each,
  // carrying the months the earnings test credits from year to year.
  const households = new Map<number, PathHousehold>()
  const credits = new Map<number, PathCredits>()
  for (const claimAge of claimAges) {
    households.set(claimAge, {
      people: [{
        person: { id: 'person', name: 'person', dob: isoDob },
        stream: { type: 'socialSecurity', id: 'own', personId: 'person', piaMonthly, earnings: null, claimAge: { years: claimAge, months: 0 } },
        piaMonthly,
      }],
      startYear,
      assumptions,
      wages: (_personId, year) => (wagesInYear === undefined ? 0 : wagesInYear(year)),
    })
    credits.set(claimAge, NO_CREDITS)
  }
  const withheldAt = new Set<number>()

  const series: ClaimBreakEvenPoint[] = []
  const balance: Record<number, number> = {}
  for (const claimAge of claimAges) balance[claimAge] = 0
  for (let age = BREAK_EVEN_FIRST_AGE; age <= throughAge; age++) {
    const year = dob.year + age
    const cumulative: Record<number, number> = {}
    for (const claimAge of claimAges) {
      let benefit = 0
      if (age >= claimAge && year >= startYear) {
        const pathCredits = credits.get(claimAge)!
        const result = householdPathYear(households.get(claimAge)!, {
          year,
          deaths: new Map(),
          credits: pathCredits,
          withWages: wagesInYear !== undefined,
          cola: socialSecurityColaFactor(assumptions.ssCola, inflationFrom, startYear, year),
          haircut: socialSecurityHaircutFactor(assumptions.ssHaircut, year),
        })
        benefit = result.paidByPerson.get('person') ?? 0
        if ((result.withheldByPerson.get('person') ?? 0) > 0) withheldAt.add(claimAge)
        if (result.withheldMonthWrites.length > 0) {
          const own = new Map(pathCredits.own)
          for (const write of result.withheldMonthWrites) own.set(write.personId, write.value)
          credits.set(claimAge, { ...pathCredits, own })
        }
      }
      balance[claimAge] = balance[claimAge]! * (1 + g) + benefit
      cumulative[claimAge] = balance[claimAge]
    }
    series.push({ age, year, cumulative })
  }

  const sorted = [...claimAges].sort((a, b) => a - b)
  const crossings: ClaimBreakEvenCrossing[] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const early = sorted[i]!
      const late = sorted[j]!
      let crossAge: number | null = null
      let previous: number | null = null
      for (const point of series) {
        // Before the earlier claim begins both totals are $0: nothing to compare yet.
        if (point.cumulative[early]! <= 0) continue
        const difference = point.cumulative[late]! - point.cumulative[early]!
        if (difference >= 0) {
          crossAge =
            previous !== null && previous < 0 ? point.age - 1 + -previous / (difference - previous) : point.age
          break
        }
        previous = difference
      }
      crossings.push({ early, late, age: crossAge })
    }
  }
  return { series, crossings, factors, withheldClaimAges: [...withheldAt].sort((a, b) => a - b) }
}
