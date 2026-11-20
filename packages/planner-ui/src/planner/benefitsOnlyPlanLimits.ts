/**
 * The benefits-only tab's plan limits: sentences the Social Security analysis
 * page shows under the ranking when a limit of that view binds for the plan.
 */
import type { Person, Plan } from '@retiregolden/engine/model/plan'
import { socialSecurityStreamFor } from '@retiregolden/engine/socialSecurity/analysis/claimants'
import { socialSecurityDobParts } from '@retiregolden/engine/socialSecurity/annualTiming'
import { attainedAgeZeroMonthIndex, effectiveBirthYear, fraForBirthYear, fraTotalMonths } from '@retiregolden/engine/socialSecurity/nra'

/**
 * The last calendar year the earnings test can reach a person: the year of the
 * last month before the full-retirement-age month, from the date of birth as
 * the engine reads it (66 and 10 months for a 1959 birth, so born 15 January
 * 1959 the FRA month is November 2025 and 2025 is the last year).
 */
function lastEarningsTestYear(person: Person): number {
  const { y, m, d } = socialSecurityDobParts(person)
  const dob = { year: y, month: m, day: d }
  const fraMonthIndex = attainedAgeZeroMonthIndex(dob) + fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
  return Math.floor((fraMonthIndex - 1) / 12)
}

/**
 * The limits of the benefits-only view that bind for this plan, each named
 * only when it applies: work income entered as other income in a year the
 * earnings test can still reach a claimant, and a remarriage age for a
 * survivor benefit of a person in a couple. Exported for the page and its test.
 */
export function benefitsOnlyPlanLimits(plan: Plan, personName: (id: string) => string, startYear: number): string[] {
  const out: string[] = []
  const claimants = plan.household.people.filter((person) => socialSecurityStreamFor(plan, person.id) !== undefined)
  const lastTestedYear = claimants.length > 0 ? Math.max(...claimants.map(lastEarningsTestYear)) : startYear - 1
  const otherIncomeWhileWorkingAge = plan.incomes.some(
    (income) =>
      income.type === 'recurring' &&
      (income.startYear === null || income.startYear <= lastTestedYear) &&
      (income.endYear === null || income.endYear >= startYear) &&
      lastTestedYear >= startYear,
  )
  if (claimants.length > 0 && otherIncomeWhileWorkingAge) {
    out.push(
      "Income entered as other income, such as part-time work, doesn't count as earnings for the earnings test here or in the projection: only wages do.",
    )
  }
  const livesAlone = plan.household.people.length === 1
  for (const person of claimants) {
    const stream = socialSecurityStreamFor(plan, person.id)!
    const name = personName(person.id)
    for (const record of stream.formerSpouses ?? []) {
      if (record.relationship === 'divorced') continue
      if (livesAlone) {
        if (record.remarriedAtAge !== null && record.remarriedAtAge < 60) {
          out.push(
            `${name} remarried before 60. The plan can't say when that later marriage ended, so it's taken to have ended before ${name}'s claim, and the survivor benefit on the former spouse's record is reduced for ${name}'s age at the claim. If it ended later, the benefit would start later and be reduced for the age then.`,
          )
        }
        continue
      }
      // The modeled non-disabled rule (20 CFR 404.335(e)(1), 404.336(e)(1)): the
      // engine starts the benefit with the later of the claim and the January
      // after the current spouse's death (maritalBenefits.ts#formerSpouseSurvivorEntitlementAgeMonths).
      const counted = `While ${name} is married, a survivor benefit is counted here only when that marriage began at 60 or later; the exceptions for a disabled widow(er) who remarried at 50 or later are not evaluated. So the survivor benefit on the former spouse's record is counted from the later of ${name}'s claim and the January after the current spouse's death, and is reduced only if that month is before ${name}'s survivor full retirement age.`
      if (record.remarriedAtAge === null) {
        out.push(`${name}'s remarriage age is blank on a former spouse's record. ${counted} If the current marriage began at 60 or later, enter that age.`)
      } else if (record.remarriedAtAge < 60) {
        out.push(`${name} remarried before 60, which is read as the current marriage. ${counted}`)
      }
    }
  }
  return out
}
