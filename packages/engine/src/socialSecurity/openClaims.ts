/**
 * Which Social Security claims in a plan are still choices, and which were
 * already made before the plan starts.
 *
 * One predicate for every claim-age search: the Social Security page's
 * whole-plan sweep and its month refinement (decisions/claimAgeSweep.ts), the
 * Optimize page's claim-age co-optimization (projection/optimizePlan.ts, through
 * decisions/generators.ts#socialSecurityClaimGenerator), the benefits-only
 * ranking (socialSecurity/analysis/expectedValue.ts#benefitsOnlyRanking) and the
 * bridge panel's earliest-claim comparison on the analysis page.
 *
 * A claim counts as already made when its claim year, the birth year plus the
 * claim age's whole years, is before the plan's start year (#isClaimAlreadyMade,
 * the one place that boundary is written). That is the
 * ledger's own annual convention (projection/internal/annualSocialSecurity.ts
 * pays 12 months in every year whose attained age exceeds the claim years, so a
 * past claim year is already being paid in the first year of the plan).
 * Entitlement follows the application (42 U.S.C. 402(a)), and a reduced
 * retirement benefit cannot be paid for a month before the application is
 * filed (20 CFR 404.621(a)(3)), so such a claim cannot be re-made at another
 * age. Undoing it takes a withdrawal of the application within 12 months of
 * the first month of entitlement with every benefit repaid (20 CFR
 * 404.640(b)(3), (b)(4)) or a voluntary suspension from full retirement age
 * (42 U.S.C. 402(z)); the ledger models neither, so both are stated limits.
 *
 * @see DOCS/calculations/social-security/social-security-claim-age-sweep.md
 */
import type { IncomeStream, Person, Plan } from '../model/plan.js'
import { socialSecurityDobParts } from './annualTiming.js'

type SocialSecurityStream = Extract<IncomeStream, { type: 'socialSecurity' }>

export interface ClaimAgeValue {
  readonly years: number
  readonly months: number
}

/** A claim the plan still makes in or after its start year: a choice a search may move. */
export interface OpenClaim {
  readonly personId: string
  readonly streamId: string
  readonly claimAge: ClaimAgeValue
  /** Birth year plus the claim age's whole years: in or after the start year. */
  readonly claimYear: number
}

/** A claim the plan made before it starts: history, held fixed by every search. */
export interface AlreadyClaimed {
  readonly personId: string
  readonly streamId: string
  readonly claimAge: ClaimAgeValue
  /** Birth year plus the claim age's whole years: before the start year. */
  readonly claimYear: number
}

export interface OpenClaims {
  /** Claims still to be made, in household order. */
  readonly open: readonly OpenClaim[]
  /** Claims already made, in household order. */
  readonly alreadyClaimed: readonly AlreadyClaimed[]
}

/** The calendar year a claim at `claimAge` falls in, on the ledger's annual convention: birth year plus whole years. */
export function claimYearOf(person: Pick<Person, 'dob'>, claimAge: ClaimAgeValue): number {
  return socialSecurityDobParts(person).y + claimAge.years
}

/** The one test every claim-age search applies: the claim year is before the plan's start year. */
export function isClaimAlreadyMade(person: Pick<Person, 'dob'>, claimAge: ClaimAgeValue, startYear: number): boolean {
  return claimYearOf(person, claimAge) < startYear
}

/**
 * The Social Security streams the claim-age sweep treats as claims: a positive
 * entered PIA or an earnings history (a default record carries a PIA of 0,
 * which resolves to no benefit), the first two, each with its person, in the
 * plan's income order.
 */
export function claimAgeStreams(plan: Plan): Array<{ readonly stream: SocialSecurityStream; readonly person: Person }> {
  return plan.incomes
    .filter((income): income is SocialSecurityStream => income.type === 'socialSecurity')
    .filter((income) => (income.piaMonthly !== null && income.piaMonthly > 0) || (income.earnings?.length ?? 0) > 0)
    .slice(0, 2)
    .map((stream) => ({ stream, person: plan.household.people.find((p) => p.id === stream.personId) }))
    .filter((entry): entry is { stream: SocialSecurityStream; person: Person } => entry.person !== undefined)
}

/**
 * The sweep's claim streams (#claimAgeStreams) split by #isClaimAlreadyMade,
 * each list in household order.
 */
export function openClaims(plan: Plan, startYear: number): OpenClaims {
  const order = (personId: string) => plan.household.people.findIndex((p) => p.id === personId)
  const entries = [...claimAgeStreams(plan)].sort((a, b) => order(a.person.id) - order(b.person.id))
  const open: OpenClaim[] = []
  const alreadyClaimed: AlreadyClaimed[] = []
  for (const { stream, person } of entries) {
    const claimAge = { years: stream.claimAge.years, months: stream.claimAge.months }
    const entry = { personId: person.id, streamId: stream.id, claimAge, claimYear: claimYearOf(person, claimAge) }
    if (isClaimAlreadyMade(person, claimAge, startYear)) alreadyClaimed.push(entry)
    else open.push(entry)
  }
  return { open, alreadyClaimed }
}

/** The whole-year claim ages the sweep offers: 62 to 70, none below the age reached in `startYear`; empty for someone past 70. */
export function gridClaimAges(person: Pick<Person, 'dob'>, startYear: number): number[] {
  const currentAge = startYear - socialSecurityDobParts(person).y
  return [62, 63, 64, 65, 66, 67, 68, 69, 70].filter((age) => age >= currentAge)
}

/**
 * The earliest whole-year claim age still open to a person in `startYear`:
 * 62, or the age reached that year when later (a claim at an age already
 * passed would be backdated, which 20 CFR 404.621(a)(3) forbids for a reduced
 * benefit); null past 70.
 */
export function earliestOpenClaimAge(person: Pick<Person, 'dob'>, startYear: number): number | null {
  return gridClaimAges(person, startYear)[0] ?? null
}
