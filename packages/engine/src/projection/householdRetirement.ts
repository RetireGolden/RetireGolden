/**
 * The household's later retirement: the one rule the FI figures, Coast-FIRE,
 * the pre-retirement savings rate and the funded ratio share (decision
 * D-PEOPLE-ORDER, rule R4; the independent review's M4 and N3).
 *
 * Each person's retirement year is the first year without their work. A wage
 * stream pays while the person is alive and younger than its stop age, its
 * `endAge` if it has one, else the person's retirement age, and with neither
 * it pays through their last year alive at the planning age
 * (projection/internal/wageIncomeStreams.ts, `stopAge = endAge ?? retirementAge`);
 * a stream with no gross pay is no wages. So:
 * - with a retirement age, the later of the ISO birth year plus that age
 *   (`retirementAge`) and the year after the last year a wage stream of theirs
 *   pays, when a stream's `endAge` keeps paying past the retirement age
 *   (`wagesPastRetirementAge`);
 * - with no retirement age, the year after the last year a wage stream of
 *   theirs pays (`wagesEnd`), when that last year is the start year or later;
 * - with no retirement age and no wages in the plan from the start year on,
 *   the plan's start year (`startYear`).
 *
 * A person retires in the plan only when they are alive in the year their
 * retirement would be priced, `max(year, startYear)`: someone who earns wages
 * through their last year alive works through the plan, a retirement age past
 * the planning age is never reached, and a planning age that ended before the
 * plan starts retires no one. Such a person is left out of the household's
 * later retirement, which is the latest among the people who do retire in the
 * plan; on a tie the older person (the earlier date of birth), then the
 * smaller id by ordinal comparison, so list order never decides it. When
 * nobody retires in the plan there is no household retirement, and no figure
 * is priced on one: never a year after the person's death.
 *
 * Every surface that shows the year names the person and says which rule
 * gave it, and who works through the plan (`householdRetirementClause`,
 * `notRetiringClause`).
 */
import type { Plan } from '../model/plan.js'
import { canonicalPeopleOrder } from '../model/peopleOrder.js'

export type RetirementYearRule = 'retirementAge' | 'wagesPastRetirementAge' | 'wagesEnd' | 'startYear'

export interface PersonRetirement {
  readonly personId: string
  /** The first year without this person's work, under `rule`. */
  readonly year: number
  readonly rule: RetirementYearRule
  /** The person's last year alive at the plan's planning age (birth year plus planning age). */
  readonly lastYearAlive: number
  /**
   * True when the person is alive in `max(year, startYear)`, the year a
   * household figure would be priced on this retirement; false when they
   * work through the plan, reach their retirement age only after their
   * planning age, or died before the plan starts.
   */
  readonly retiresInPlan: boolean
}

export interface HouseholdRetirement {
  /** The later of the retirements that fall in the plan; null when nobody retires in it. */
  readonly retirement: PersonRetirement | null
  /** The people who never retire in the plan, in the canonical people order (model/peopleOrder.ts). */
  readonly notRetiring: readonly PersonRetirement[]
}

type RetirementPlan = Pick<Plan, 'household' | 'incomes'>
type Person = Plan['household']['people'][number]

const birthYearOf = (person: Pick<Person, 'dob'>): number => Number(person.dob.slice(0, 4))

/** One person's retirement year, the rule that gave it, and whether it falls in the plan. */
export function personRetirement(plan: RetirementPlan, person: Person, startYear: number): PersonRetirement {
  const birthYear = birthYearOf(person)
  const lastYearAlive = birthYear + person.longevity.planningAge
  const result = (year: number, rule: RetirementYearRule): PersonRetirement => ({
    personId: person.id,
    year,
    rule,
    lastYearAlive,
    retiresInPlan: Math.max(year, startYear) <= lastYearAlive,
  })
  let lastWageYear: number | null = null
  for (const stream of plan.incomes) {
    if (stream.type !== 'wages' || stream.personId !== person.id || stream.annualGross <= 0) continue
    // Wages pay while the attained age is below the stream's stop age (its
    // endAge, else the retirement age, as wageIncomeStreams stops them), and
    // while alive.
    const stopAge = stream.endAge ?? person.retirementAge
    const last = Math.min(stopAge !== null ? birthYear + stopAge - 1 : lastYearAlive, lastYearAlive)
    if (lastWageYear === null || last > lastWageYear) lastWageYear = last
  }
  // A year still paid wages (and the income tax on them) is a working year,
  // never the retirement priced (the independent review's N3), so a person
  // retires in the first year without wages, and never before their
  // retirement age. A stream's endAge past the retirement age keeps paying
  // (round-one review of #765, issues 1 and 3).
  if (person.retirementAge !== null) {
    const retirementYear = birthYear + person.retirementAge
    if (lastWageYear !== null && lastWageYear + 1 > retirementYear) return result(lastWageYear + 1, 'wagesPastRetirementAge')
    return result(retirementYear, 'retirementAge')
  }
  if (lastWageYear !== null && lastWageYear >= startYear) return result(lastWageYear + 1, 'wagesEnd')
  return result(startYear, 'startYear')
}

/** The household's later retirement and who never retires in the plan (see the module comment). */
export function householdRetirement(plan: RetirementPlan, startYear: number): HouseholdRetirement {
  let chosen: { retirement: PersonRetirement; dob: string } | null = null
  const notRetiring: PersonRetirement[] = []
  for (const person of canonicalPeopleOrder(plan.household.people)) {
    const retirement = personRetirement(plan, person, startYear)
    if (!retirement.retiresInPlan) {
      notRetiring.push(retirement)
      continue
    }
    if (
      chosen === null ||
      retirement.year > chosen.retirement.year ||
      (retirement.year === chosen.retirement.year &&
        (person.dob < chosen.dob || (person.dob === chosen.dob && person.id < chosen.retirement.personId)))
    ) {
      chosen = { retirement, dob: person.dob }
    }
  }
  return { retirement: chosen?.retirement ?? null, notRetiring }
}

/**
 * Plain words for why a household figure prices or starts in `year`, naming
 * whose retirement decided it and by which rule: for a couple `name` is that
 * person and, when the other person also retires in the plan, the clause says
 * it is the later of the two retirements; for one person (`name` null) it
 * speaks to "you". A parenthetical, without the parentheses: "the year Sam
 * retires, the later of your two retirements". When the other person never
 * retires in the plan (`otherRetires` false), the caller adds
 * `notRetiringClause` for them.
 */
export function householdRetirementClause(
  retirement: Pick<PersonRetirement, 'year' | 'rule'>,
  name: string | null,
  year: number,
  otherRetires = true,
): string {
  const couple = name !== null
  const both = couple && otherRetires
  const who = name ?? 'you'
  const whose = name === null ? 'your' : `${name}'s`
  const has = name === null ? 'have' : 'has'
  const later = both ? ', the later of your two retirements' : ''
  if (retirement.rule === 'startYear') {
    return `the plan's first year: ${who} ${has} no retirement age and no wages in the plan${both ? ', and neither of you retires later' : ''}`
  }
  if (retirement.year > year) {
    return retirement.rule === 'retirementAge'
      ? `the plan's first year: the plan ends before ${who} ${couple ? 'retires' : 'retire'} in ${retirement.year}`
      : `the plan's first year: the plan ends before ${whose} wages do, in ${retirement.year - 1}`
  }
  if (retirement.year < year) {
    return retirement.rule === 'retirementAge'
      ? `the plan's first year: ${both ? `${name}, the later of you to retire, reaches` : couple ? `${name} reaches` : 'you reach'} retirement age in ${retirement.year}`
      : `the plan's first year: ${whose} wages end in ${retirement.year - 1}${later}`
  }
  if (retirement.rule === 'wagesEnd') {
    return `the first year without ${whose} wages, since ${who} ${has} no retirement age${later}`
  }
  if (retirement.rule === 'wagesPastRetirementAge') {
    return `the first year without ${whose} wages, which continue past ${whose} retirement age${later}`
  }
  return `the year ${who} ${couple ? 'retires' : 'retire'}${later}`
}

/** A person who never retires in the plan, with the name a sentence uses (null speaks to "you"). */
export type NamedNotRetiring = Pick<PersonRetirement, 'rule' | 'year' | 'lastYearAlive'> & { readonly name: string | null }

/**
 * Everyone who never retires in the plan, joined for a sentence: "Alex works
 * through the plan and Sam works through the plan"; for one person, "you
 * work through the plan". With `nobody` true it goes on to say that nobody
 * retires: "..., so neither of you retires in the plan" or "..., so you do not
 * retire in the plan". One wording for the FI sentence and the funded-ratio
 * card (the independent review's N3).
 */
export function notRetiringPhrase(people: readonly NamedNotRetiring[], couple: boolean, nobody = false): string {
  const joined = people.map((person) => notRetiringClause(person, couple ? person.name : null)).join(' and ')
  return nobody ? `${joined}, so ${couple ? 'neither of you retires' : 'you do not retire'} in the plan` : joined
}

/**
 * Plain words for why a person never retires in the plan, for a sentence
 * that goes on to say what is priced instead: "Sam works through the plan",
 * "you work through the plan", "Sam's retirement age comes after Sam's
 * planning age", "Sam's planning age ends before the plan starts".
 */
export function notRetiringClause(person: Pick<PersonRetirement, 'rule' | 'year' | 'lastYearAlive'>, name: string | null): string {
  const who = name ?? 'you'
  const whose = name === null ? 'your' : `${name}'s`
  // A retirement year after the last year alive is wages that run through
  // it (`wagesEnd`, `wagesPastRetirementAge`) or a retirement age never
  // reached; otherwise the person is left out only by dying before the start.
  if (person.year > person.lastYearAlive) {
    if (person.rule === 'wagesEnd' || person.rule === 'wagesPastRetirementAge') return `${who} ${name === null ? 'work' : 'works'} through the plan`
    if (person.rule === 'retirementAge') return `${whose} retirement age comes after ${whose} planning age`
  }
  return `${whose} planning age ends before the plan starts`
}
