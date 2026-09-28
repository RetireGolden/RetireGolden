/**
 * The Social Security claimants the analysis models and pages price: each
 * person's first Social Security stream, the PIA the projection pays from
 * (the one resolver), whether a disability benefit replaces the claim age, and
 * the whole-year claim ages a ranking offers. Split from expectedValue.ts so a
 * page that needs only the claimants (the planner's Social Security step)
 * does not load the models; expectedValue.ts re-exports all of it.
 */
import type { IncomeStream, Person, Plan } from '../../model/plan.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import { ssdiSchedule } from '../disability.js'
import { resolveStreamPiaMonthly, socialSecurityColaAssumptionPct } from '../piaFromEarnings.js'

export type SocialSecurityStream = Extract<IncomeStream, { type: 'socialSecurity' }>

/** The first Social Security stream a person has in the plan. */
export function socialSecurityStreamFor(plan: Pick<Plan, 'incomes'>, personId: string): SocialSecurityStream | undefined {
  return plan.incomes.find((stream): stream is SocialSecurityStream => stream.type === 'socialSecurity' && stream.personId === personId)
}

/**
 * Whether the ledger pays this stream as a disability benefit from its onset
 * (socialSecurity/disability.ts#ssdiSchedule: a disability month is payable
 * before the full-retirement-age month), so the claim age does not start the
 * benefit and a claim-age analysis cannot price it. When no disability month
 * is payable the ledger prices the stream as a retirement claim, and so does
 * this.
 */
export function disabilityReplacesClaimAge(stream: SocialSecurityStream, person: Pick<Person, 'dob'>): boolean {
  if (stream.disability === undefined) return false
  const { y, m, d } = socialSecurityDobParts(person)
  return ssdiSchedule({ year: y, month: m, day: d }, stream.disability) !== null
}

export interface SocialSecurityClaimant {
  readonly person: Person
  readonly stream: SocialSecurityStream
  /** The monthly PIA the projection pays from in the start year. */
  readonly piaMonthly: number
}

/**
 * The people whose first Social Security stream has a positive PIA the
 * projection starting in `startYear` pays from (#resolveStreamPiaMonthly), in
 * household order.
 */
export function socialSecurityClaimants(plan: Plan, startYear: number): SocialSecurityClaimant[] {
  const asOf = { startYear, colaAssumptionPct: socialSecurityColaAssumptionPct(plan.assumptions) }
  const out: SocialSecurityClaimant[] = []
  for (const person of plan.household.people) {
    const stream = socialSecurityStreamFor(plan, person.id)
    if (!stream) continue
    const resolved = resolveStreamPiaMonthly(stream, person, asOf)
    if ((resolved.status === 'entered' || resolved.status === 'fromEarnings') && resolved.piaMonthly > 0) {
      out.push({ person, stream, piaMonthly: resolved.piaMonthly })
    }
  }
  return out
}

/** Whole-year claim ages 62 to 70, none before the age reached in `startYear`; 70 alone for someone past it. */
export function benefitsOnlyClaimAges(person: Pick<Person, 'dob'>, startYear: number): number[] {
  const currentAge = startYear - socialSecurityDobParts(person).y
  const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70].filter((age) => age >= currentAge)
  return ages.length > 0 ? ages : [70]
}
