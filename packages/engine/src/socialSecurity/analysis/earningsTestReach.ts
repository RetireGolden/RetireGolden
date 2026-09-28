/**
 * Where the plan's wages meet the retirement earnings test, which the
 * benefits-only models on the Social Security analysis page (the break-even
 * chart, the expected-value ranking and survivor switching) leave out: those
 * models count every benefit as paid, while the projection withholds part of a
 * working claimant's benefit before full retirement age. For each claimant and
 * each whole-year claim age the page shows, this says whether the plan's wages
 * would have the ledger withhold some of that person's benefit, so the page
 * can name the person.
 *
 * Each year from the start year through the full-retirement-age year is
 * tested the ledger's way: the person's wages are the ledger's own wage rows
 * (projection/internal/wageIncomeStreams.ts, at the plan's inflation), the
 * exempt amounts are the parameters' for the year, carried past the latest
 * published year at the plan's flat inflation (params/indexingScale.ts), and
 * the withholding is socialSecurity/earningsTest.ts#earningsTestWithheldAnnual,
 * the function the ledger calls.
 */
import type { Person, Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { flatInflationPath, indexingScaleFor } from '../../params/indexingScale.js'
import { annualSocialSecurityPayableMonths } from '../../projection/internal/annualSocialSecurity.js'
import { wageIncomeStreams } from '../../projection/internal/wageIncomeStreams.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import { claimFactor } from '../claimFactor.js'
import { earningsTestWithheldAnnual } from '../earningsTest.js'
import { effectiveBirthYear, fraForBirthYear } from '../nra.js'
import { planInflationFactorFrom } from './breakEven.js'
import { disabilityReplacesClaimAge, socialSecurityClaimants } from './expectedValue.js'

export interface EarningsTestReach {
  readonly personId: string
  /** The claim ages asked about at which the plan's wages would withhold part of the benefit, in order. */
  readonly claimAges: readonly number[]
}

/**
 * For each claimant of the plan with claim ages in `claimAgesByPersonId`
 * (whole years), the ages at which the earnings test would withhold part of
 * the person's own benefit in some year from `startYear` through the year the
 * person reaches full retirement age, with the plan's wages; a claimant with
 * no such age, or whose benefit is a disability benefit from its onset (which
 * the test does not reach), is left out.
 */
export function earningsTestReach(
  plan: Plan,
  claimAgesByPersonId: Readonly<Record<string, readonly number[]>>,
  startYear: number,
): EarningsTestReach[] {
  const inflationPct = plan.assumptions.inflationPct
  const personById = new Map<string, Person>(plan.household.people.map((person) => [person.id, person]))
  const birthYear = (personId: string): number => socialSecurityDobParts(personById.get(personId)!).y
  const lastYear = startYear + 80
  const inflationFrom = planInflationFactorFrom(inflationPct, startYear, lastYear)
  const limitPath = flatInflationPath(inflationPct / 100)
  const wagesCache = new Map<number, Map<string, number>>()
  const wagesIn = (year: number, personId: string): number => {
    let byPerson = wagesCache.get(year)
    if (byPerson === undefined) {
      byPerson = new Map<string, number>()
      const rows = wageIncomeStreams({
        incomes: plan.incomes,
        personById,
        stateOf: (id) => ({ personId: id, ageAttained: year - birthYear(id), alive: true }),
        year,
        startYear,
        inflFactor: inflationFrom(startYear, Math.min(year, lastYear)),
      })
      for (const row of rows) byPerson.set(row.personId, (byPerson.get(row.personId) ?? 0) + row.amount)
      wagesCache.set(year, byPerson)
    }
    return byPerson.get(personId) ?? 0
  }

  const out: EarningsTestReach[] = []
  for (const { person, stream, piaMonthly } of socialSecurityClaimants(plan, startYear)) {
    const ages = claimAgesByPersonId[person.id]
    if (!ages || ages.length === 0 || disabilityReplacesClaimAge(stream, person)) continue
    const { y, m, d } = socialSecurityDobParts(person)
    const fraYears = fraForBirthYear(effectiveBirthYear(y, m, d)).years
    const withheldAt: number[] = []
    for (const claimYears of [...ages].sort((a, b) => a - b)) {
      const claimAge = { years: claimYears, months: 0 }
      const monthly = piaMonthly * claimFactor(y, m, d, claimAge)
      for (let year = Math.max(startYear, y + claimYears); year - y <= fraYears; year++) {
        const ageAttained = year - y
        const months = annualSocialSecurityPayableMonths(ageAttained, claimAge)
        const wages = wagesIn(year, person.id)
        if (months <= 0 || wages <= 0) continue
        const { pack, isStandIn } = packForYear(year)
        const limitGrowth = isStandIn ? indexingScaleFor(pack.year, year, limitPath) : 1
        const withheld = earningsTestWithheldAnnual({
          ageAttained,
          fraYears,
          wages,
          benefit: monthly * months,
          belowFraExemptAnnual: pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth,
          fraYearExemptAnnual: pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth,
        })
        if (withheld > 0) {
          withheldAt.push(claimYears)
          break
        }
      }
    }
    if (withheldAt.length > 0) out.push({ personId: person.id, claimAges: withheldAt })
  }
  return out
}
