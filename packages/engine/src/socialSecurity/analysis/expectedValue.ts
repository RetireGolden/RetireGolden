/**
 * The benefits-only expected present value of Social Security: each future
 * year's benefits, weighted by the chance of being alive to receive them and
 * discounted to today at a real rate, for one claimant or a couple, and the
 * ranking of every whole-year claim-age combination by it.
 *
 * Each year's benefits are the ledger's own (owner decision R7), priced by the
 * ledger's year function on each path the value weights
 * (analysis/householdPaths.ts, socialSecurity/householdYear.ts#socialSecurityYear):
 * the claim factor with its months and the ledger's payable months in the claim
 * year; the former-spouse benefits the ledger would pay, for a couple member as
 * for a person living alone; for a couple while both are alive, the lower
 * earner's own benefit plus the separately reduced spouse excess from the month
 * the spouse benefit starts, capped by the worker's family maximum; after a
 * death, the larger of the survivor's own benefit and the widow(er) benefit;
 * and the retirement earnings test on the plan's wages, which withholds
 * benefits before full retirement age and credits the months back from it
 * (socialSecurity/earningsTest.ts). Survival is the engine's one curve
 * (montecarlo/survival.ts#survivalCurve), with independent lives. The year's
 * benefits are scaled by the ledger's cost-of-living factor over its inflation
 * factor and by the trust-fund haircut, so a COLA below inflation or a haircut
 * lowers the real value (1 when the COLA matches inflation and there is no
 * haircut).
 *
 * @see DOCS/calculations/social-security/social-security-expected-value.md
 */
import type { Assumptions, FormerSpouse, Plan } from '../../model/plan.js'
import { survivalCurve, type SurvivalCurve } from '../../montecarlo/survival.js'
import type { Sex } from '../../montecarlo/mortality.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import type { ClaimAge } from '../claimFactor.js'
import { socialSecurityColaFactor, socialSecurityHaircutFactor } from '../colaFactor.js'
import type { DobParts } from '../nra.js'
import { claimYearOf, isClaimAlreadyMade, type AlreadyClaimed } from '../openClaims.js'
import { planInflationFactorFrom } from './breakEven.js'
import { benefitsOnlyClaimAges, disabilityReplacesClaimAge, socialSecurityClaimants, type SocialSecurityClaimant, type SocialSecurityStream } from './claimants.js'
import {
  householdPathYear,
  NO_CREDITS,
  pathValue,
  planWages,
  priceHouseholdPaths,
  streamAtClaimAge,
  type HouseholdPaths,
  type PathHousehold,
  type PathPerson,
  type PricedPath,
} from './householdPaths.js'

/** The last age the survival table carries: everyone dies by 120. */
const LAST_TABLE_AGE = 119

export {
  benefitsOnlyClaimAges,
  disabilityReplacesClaimAge,
  socialSecurityClaimants,
  socialSecurityStreamFor,
  type SocialSecurityClaimant,
  type SocialSecurityStream,
} from './claimants.js'

export interface ExpectedValueClaimant {
  readonly dob: DobParts
  readonly sex: Sex
  /** The monthly PIA the projection pays from in the start year. */
  readonly piaMonthly: number
  readonly claimAge: ClaimAge
  /** Former-spouse records; for a couple member, a living ex's is priced once the claimant is widowed. */
  readonly formerSpouses?: readonly FormerSpouse[]
  /** The person's id; a placeholder when omitted. */
  readonly id?: string
  /** The person's wages in a year, in that year's dollars, for the earnings test; none when omitted. */
  readonly wages?: (year: number) => number
}

/** The spouse of a claimant priced alone, who has no benefit here but whose death leaves the claimant unmarried. */
export interface ExpectedValueSpouse {
  readonly dob: DobParts
  readonly sex: Sex
  readonly id?: string
}

/**
 * The claimant's household: `single` for a person living alone. A person in a
 * couple is married while the spouse lives; with no `spouse` given, the spouse
 * is taken to outlive the claimant.
 */
export interface ExpectedValueHousehold {
  readonly single: boolean
  readonly spouse?: ExpectedValueSpouse
}

export interface ExpectedValueOptions {
  /** The present value is at the start of this year, in its dollars; ages are this year less the birth year. */
  readonly startYear: number
  /** Real yearly discount rate, above −1 (0.02 for 2%). */
  readonly discountRate: number
  readonly assumptions: Pick<Assumptions, 'inflationPct' | 'ssCola' | 'ssHaircut'>
}

function currentAgeOf(dob: DobParts, startYear: number): number {
  const age = startYear - dob.year
  if (!Number.isInteger(age) || age < 0) {
    throw new RangeError(`An expected value needs a person born by ${startYear}; got a birth year of ${dob.year}`)
  }
  return age
}

function checkRate(discountRate: number): void {
  if (!Number.isFinite(discountRate) || discountRate <= -1) {
    throw new RangeError(`A discount rate must be a finite number above -1; got ${discountRate}`)
  }
}

/**
 * The real value of a start-year dollar of benefit paid in `year`, for a year
 * from the start year through `endYear`: the ledger's COLA factor over its
 * inflation factor, times the haircut. Exactly 1 each year when the COLA
 * matches inflation and there is no haircut. The expected values here and the
 * survivor switching values (analysis/survivorSwitching.ts) scale by it.
 */
export function realBenefitScale(options: Pick<ExpectedValueOptions, 'startYear' | 'assumptions'>, endYear: number): (year: number) => number {
  const { assumptions, startYear } = options
  const inflationFrom = planInflationFactorFrom(assumptions.inflationPct, startYear, endYear)
  return (year: number): number =>
    (socialSecurityColaFactor(assumptions.ssCola, inflationFrom, startYear, year) / inflationFrom(startYear, year)) *
    socialSecurityHaircutFactor(assumptions.ssHaircut, year)
}

const isoDate = (dob: DobParts): string => `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`

function claimantPathPerson(claimant: ExpectedValueClaimant, fallbackId: string): PathPerson {
  const id = claimant.id ?? fallbackId
  const stream: SocialSecurityStream = {
    type: 'socialSecurity',
    id: `${id}--ss`,
    personId: id,
    piaMonthly: claimant.piaMonthly,
    earnings: null,
    claimAge: { years: claimant.claimAge.years, months: claimant.claimAge.months },
    ...(claimant.formerSpouses !== undefined && claimant.formerSpouses.length > 0 ? { formerSpouses: [...claimant.formerSpouses] } : {}),
  }
  return { person: { id, name: id, dob: isoDate(claimant.dob) }, stream, piaMonthly: claimant.piaMonthly }
}

/** A spouse who has no benefit here: present so the claimant is married while the spouse lives. */
function spousePathPerson(dob: DobParts, id: string): PathPerson {
  return { person: { id, name: id, dob: isoDate(dob) }, stream: null, piaMonthly: 0 }
}

function wagesOf(entries: readonly { id: string; wages?: (year: number) => number }[]): (personId: string, year: number) => number {
  const byId = new Map(entries.map((entry) => [entry.id, entry.wages]))
  return (personId, year) => byId.get(personId)?.(year) ?? 0
}

/** One weighted person of an expected value: the survival curve from the current age. */
interface WeightedPerson {
  readonly id: string
  readonly curve: SurvivalCurve
  readonly x: number
}

/**
 * The expected present value of a household's priced paths at a discount rate:
 * Σ_t (1 + r)^−t [S_A(t) S_B(t) both(t) + Σ_s S_s(t) Σ_{k<t} D_d(k) alone_s(t, k)]
 * for a couple, and Σ_t (1 + r)^−t S(t) b(t) for one person weighted alone,
 * with the paths' benefits in start-year dollars. `payees` names whose benefits
 * count (everyone, unless a spouse is only there to be married to).
 */
function presentValueOfPaths(paths: HouseholdPaths, people: readonly WeightedPerson[], payees: ReadonlySet<string>, discountRate: number): number {
  const { household, factors } = paths
  const startYear = household.startYear
  const lastT = paths.lastYear - startYear
  const discount = (t: number): number => Math.pow(1 + discountRate, -t)
  const paid = (path: PricedPath, year: number): number => {
    let sum = 0
    for (const id of payees) sum += pathValue(path, id, year, factors)
    return sum
  }
  let pv = 0
  if (people.length === 1) {
    const person = people[0]!
    for (let t = 0; t <= lastT; t++) {
      const value = paid(paths.alive, startYear + t)
      if (value === 0) continue
      pv += person.curve.survivalTo(t) * value * discount(t)
    }
    return pv
  }
  const [a, b] = people as readonly [WeightedPerson, WeightedPerson]
  for (let t = 0; t <= lastT; t++) {
    const value = paid(paths.alive, startYear + t)
    if (value === 0) continue
    pv += a.curve.survivalTo(t) * b.curve.survivalTo(t) * value * discount(t)
  }
  // One survivor s after the other's death in year k: the path's changing
  // years, then its steady benefit against the survival-weighted, discounted
  // real scale of the years after them.
  for (let s = 0; s < 2; s++) {
    const survivor = people[s]!
    const deceased = people[1 - s]!
    const byDeath = paths.survivors?.[s] ?? []
    if (byDeath.length === 0 || !payees.has(survivor.id)) continue
    const weightedScale: number[] = new Array<number>(lastT + 2).fill(0)
    for (let t = lastT; t >= 0; t--) {
      weightedScale[t] = weightedScale[t + 1]! + survivor.curve.survivalTo(t) * factors.realScale(startYear + t) * discount(t)
    }
    for (let k = 0; k < byDeath.length; k++) {
      const died = deceased.curve.deathProbabilityInYear(k)
      if (died <= 0) continue
      const path = byDeath[k]!
      let sum = 0
      // A path starts the year after the death, or with the survivor's first
      // paid year when nothing is paid before it.
      let t = path.fromYear - startYear
      for (let index = 0; index < path.explicit.length && t <= lastT; index++, t++) {
        const value = path.explicit[index]!.get(survivor.id) ?? 0
        if (value !== 0) sum += survivor.curve.survivalTo(t) * value * discount(t)
      }
      const steady = path.steady.get(survivor.id) ?? 0
      if (steady !== 0 && t <= lastT) sum += steady * weightedScale[t]!
      pv += died * sum
    }
  }
  return pv
}

function lastYearFor(startYear: number, xs: readonly number[]): number {
  return startYear + Math.max(0, ...xs.map((x) => LAST_TABLE_AGE - x))
}

/**
 * The benefits one claimant is paid in `year` before any earnings test, in
 * today's dollars before the COLA drift and haircut: the ledger's year for a
 * person who has claimed and is alive (the own benefit, or a larger
 * former-spouse benefit the ledger would pay that year); 0 before the claim
 * year. With `household.single` false the claimant is married that year.
 */
export function singleBenefitInYear(
  claimant: ExpectedValueClaimant,
  household: ExpectedValueHousehold,
  year: number,
): number {
  const person = claimantPathPerson(claimant, 'claimant')
  const people = household.single ? [person] : [person, spousePathPerson(household.spouse?.dob ?? claimant.dob, household.spouse?.id ?? 'spouse')]
  const pathHousehold: PathHousehold = {
    people,
    startYear: year,
    assumptions: { inflationPct: 0, ssCola: { mode: 'matchInflation' }, ssHaircut: null },
    wages: () => 0,
  }
  const result = householdPathYear(pathHousehold, { year, deaths: new Map(), credits: NO_CREDITS, withWages: false, cola: 1, haircut: 1 })
  return result.paidByPerson.get(person.person.id) ?? 0
}

/**
 * Expected present value of one claimant's benefits: Σ over years t from the
 * start year while the claimant is at most 119, of S(t) × the year's benefits
 * × scale(y) × (1 + r)^−t, each year priced by the ledger's year function with
 * the claimant's wages (the earnings test) and the former-spouse benefits the
 * ledger would pay. A claimant in a couple is married while the given spouse
 * lives and unmarried after the spouse's death, weighted by the spouse's
 * survival; with no spouse given, married throughout. The spouse's own
 * benefits do not count here.
 */
export function expectedPvSingle(
  claimant: ExpectedValueClaimant,
  household: ExpectedValueHousehold,
  options: ExpectedValueOptions,
): number {
  checkRate(options.discountRate)
  const x = currentAgeOf(claimant.dob, options.startYear)
  const person = claimantPathPerson(claimant, 'claimant')
  const claimantId = person.person.id
  const weighted: WeightedPerson[] = [{ id: claimantId, curve: survivalCurve(x, claimant.sex), x }]
  const people: PathPerson[] = [person]
  let survivors = false
  if (!household.single) {
    const spouseId = household.spouse?.id ?? 'spouse'
    people.push(spousePathPerson(household.spouse?.dob ?? claimant.dob, spouseId))
    if (household.spouse !== undefined) {
      const sx = currentAgeOf(household.spouse.dob, options.startYear)
      weighted.push({ id: spouseId, curve: survivalCurve(sx, household.spouse.sex), x: sx })
      survivors = true
    }
  }
  const pathHousehold: PathHousehold = {
    people,
    startYear: options.startYear,
    assumptions: options.assumptions,
    wages: wagesOf([{ id: claimantId, ...(claimant.wages === undefined ? {} : { wages: claimant.wages }) }]),
  }
  const paths = priceHouseholdPaths(pathHousehold, lastYearFor(options.startYear, weighted.map((w) => w.x)), { survivors })
  return presentValueOfPaths(paths, weighted, new Set([claimantId]), options.discountRate)
}

/**
 * Expected present value of a couple's benefits under a pair of claim ages,
 * with independent lives on the engine's survival curve:
 *
 *   EV = Σ_t (1 + r)^−t [ S_A(t) S_B(t) both(t)
 *        + Σ_{k<t} S_A(t) D_B(k) alone_A(t, k) + Σ_{k<t} S_B(t) D_A(k) alone_B(t, k) ]
 *
 * where D(k) is the probability of dying in year k (alive through year k, the
 * ledger's death convention), both(t) is the year's benefits on the path on
 * which both are alive, and alone_s(t, k) the survivor's on the path on which
 * the other died in year k, each year priced by the ledger's year function
 * from the crediting months the path has reached, in start-year dollars.
 */
export function expectedPvCouple(
  a: ExpectedValueClaimant,
  b: ExpectedValueClaimant,
  options: ExpectedValueOptions,
): number {
  checkRate(options.discountRate)
  const xa = currentAgeOf(a.dob, options.startYear)
  const xb = currentAgeOf(b.dob, options.startYear)
  const personA = claimantPathPerson(a, 'a')
  const personB = claimantPathPerson(b, 'b')
  const weighted: WeightedPerson[] = [
    { id: personA.person.id, curve: survivalCurve(xa, a.sex), x: xa },
    { id: personB.person.id, curve: survivalCurve(xb, b.sex), x: xb },
  ]
  const household: PathHousehold = {
    people: [personA, personB],
    startYear: options.startYear,
    assumptions: options.assumptions,
    wages: wagesOf([
      { id: personA.person.id, ...(a.wages === undefined ? {} : { wages: a.wages }) },
      { id: personB.person.id, ...(b.wages === undefined ? {} : { wages: b.wages }) },
    ]),
  }
  const paths = priceHouseholdPaths(household, lastYearFor(options.startYear, [xa, xb]))
  return presentValueOfPaths(paths, weighted, new Set([personA.person.id, personB.person.id]), options.discountRate)
}

export interface BenefitsPvRow {
  /** Whole-year claim age by person id. */
  readonly claimByPersonId: Readonly<Record<string, number>>
  readonly expectedPv: number
  /**
   * The people whose excess earnings the earnings test charges at this row's
   * claim ages on the path on which everyone lives: the plan's wages withhold
   * part of some benefit before full retirement age. Empty when none.
   */
  readonly withheldBy: readonly string[]
}

export interface BenefitsOnlyRanking {
  /** The claimants whose claim age is ranked: the open claims, in household order. */
  readonly personIds: readonly string[]
  /** Each row's `claimByPersonId` names the open claimants only; a claim already made is held at its own age. */
  readonly rows: readonly BenefitsPvRow[]
  /** The rows by expected value, highest first. */
  readonly ranked: readonly BenefitsPvRow[]
  /** People whose benefit is a disability benefit from its onset; when any, nothing is ranked. */
  readonly disabilityPersonIds: readonly string[]
  /**
   * Claimants whose claim was made before the start year
   * (socialSecurity/openClaims.ts#isClaimAlreadyMade), held at their own claim
   * age; when every claimant is here, nothing is ranked.
   */
  readonly alreadyClaimed: readonly AlreadyClaimed[]
}

interface PricedRow {
  readonly claimByPersonId: Readonly<Record<string, number>>
  readonly paths: HouseholdPaths
  readonly withheldBy: readonly string[]
}

interface PricedRanking {
  readonly personIds: readonly string[]
  readonly rows: readonly PricedRow[]
  readonly weighted: readonly WeightedPerson[]
  readonly payees: ReadonlySet<string>
  readonly disabilityPersonIds: readonly string[]
  readonly alreadyClaimed: readonly AlreadyClaimed[]
}

/**
 * The priced paths of every row, by plan and start year: the paths do not
 * depend on the discount rate, so a new rate re-weights them without pricing
 * them again.
 */
const pricedRankings = new WeakMap<Plan, Map<number, PricedRanking>>()

function priceRanking(plan: Plan, startYear: number): PricedRanking {
  const claimants = socialSecurityClaimants(plan, startYear)
  const isOpen = (entry: SocialSecurityClaimant) => !isClaimAlreadyMade(entry.person, entry.stream.claimAge, startYear)
  const open = claimants.filter(isOpen)
  const personIds = open.map((entry) => entry.person.id)
  const alreadyClaimed: AlreadyClaimed[] = claimants
    .filter((entry) => !isOpen(entry))
    .map((entry) => ({
      personId: entry.person.id,
      streamId: entry.stream.id,
      claimAge: { years: entry.stream.claimAge.years, months: entry.stream.claimAge.months },
      claimYear: claimYearOf(entry.person, entry.stream.claimAge),
    }))
  const disabilityPersonIds = claimants.filter((entry) => disabilityReplacesClaimAge(entry.stream, entry.person)).map((entry) => entry.person.id)
  const ages = plan.household.people.map((person) => startYear - socialSecurityDobParts(person).y)
  const weighted: WeightedPerson[] = plan.household.people.map((person, index) => ({
    id: person.id,
    curve: survivalCurve(ages[index]!, person.sex),
    x: ages[index]!,
  }))
  const payees = new Set(claimants.map((entry) => entry.person.id))
  if (disabilityPersonIds.length > 0 || open.length === 0 || claimants.length > 2) {
    return { personIds, rows: [], weighted, payees, disabilityPersonIds, alreadyClaimed }
  }
  const wages = planWages(plan, startYear)
  const claimantById = new Map(claimants.map((entry) => [entry.person.id, entry]))
  // A claimant's claim at each whole-year age, or its own claim when already made.
  const claimsOf = (entry: SocialSecurityClaimant): Array<{ age: number | null; claimAge: ClaimAge }> =>
    isOpen(entry)
      ? benefitsOnlyClaimAges(entry.person, startYear).map((age) => ({ age, claimAge: { years: age, months: 0 } }))
      : [{ age: null, claimAge: entry.stream.claimAge }]
  const lastYear = lastYearFor(startYear, ages)
  // Every combination of the claimants' claims, in household order.
  let combinations: Array<Record<string, { age: number | null; claimAge: ClaimAge }>> = [{}]
  for (const entry of claimants) {
    const next: typeof combinations = []
    for (const partial of combinations) for (const claim of claimsOf(entry)) next.push({ ...partial, [entry.person.id]: claim })
    combinations = next
  }
  const rows: PricedRow[] = combinations.map((combination) => {
    const people: PathPerson[] = plan.household.people.map((person) => {
      const entry = claimantById.get(person.id)
      if (entry === undefined) return { person, stream: null, piaMonthly: 0 }
      return { person, stream: streamAtClaimAge(entry.stream, combination[person.id]!.claimAge), piaMonthly: entry.piaMonthly }
    })
    const household: PathHousehold = { people, startYear, assumptions: plan.assumptions, wages }
    const paths = priceHouseholdPaths(household, lastYear)
    const claimByPersonId: Record<string, number> = {}
    for (const entry of claimants) {
      const age = combination[entry.person.id]!.age
      if (age !== null) claimByPersonId[entry.person.id] = age
    }
    const withheldBy = plan.household.people
      .filter((person) => (paths.alive.excessChargedByPerson.get(person.id) ?? 0) > 0)
      .map((person) => person.id)
    return { claimByPersonId, paths, withheldBy }
  })
  return { personIds, rows, weighted, payees, disabilityPersonIds: [], alreadyClaimed }
}

function pricedRankingFor(plan: Plan, startYear: number): PricedRanking {
  let byYear = pricedRankings.get(plan)
  if (byYear === undefined) {
    byYear = new Map()
    pricedRankings.set(plan, byYear)
  }
  let priced = byYear.get(startYear)
  if (priced === undefined) {
    priced = priceRanking(plan, startYear)
    byYear.set(startYear, priced)
  }
  return priced
}

/**
 * The expected value of every whole-year claim-age combination for the plan's
 * one or two claimants (#benefitsOnlyClaimAges each), ranked highest first,
 * each row priced on the plan's own household: a claimant living alone, a
 * couple, or a claimant whose spouse has no benefit, whose death leaves the
 * claimant unmarried. A claim already made (its claim year before the start
 * year, socialSecurity/openClaims.ts#isClaimAlreadyMade) is held at its own
 * claim age and named in `alreadyClaimed`; when every claim is already made,
 * nothing is ranked. A claimant whose benefit the ledger pays as a disability
 * benefit from its onset is named and nothing is ranked, since the claim age
 * would not start it. The paths are priced once per plan and start year.
 */
export function benefitsOnlyRanking(plan: Plan, discountRate: number, startYear: number): BenefitsOnlyRanking {
  checkRate(discountRate)
  const priced = pricedRankingFor(plan, startYear)
  const rows: BenefitsPvRow[] = priced.rows.map((row) => ({
    claimByPersonId: row.claimByPersonId,
    expectedPv: presentValueOfPaths(row.paths, priced.weighted, priced.payees, discountRate),
    withheldBy: row.withheldBy,
  }))
  const ranked = [...rows].sort((x, y) => y.expectedPv - x.expectedPv)
  return { personIds: priced.personIds, rows, ranked, disabilityPersonIds: priced.disabilityPersonIds, alreadyClaimed: priced.alreadyClaimed }
}

/** A person's wages in a year from the plan's wage rows, at the plan's inflation from `startYear`; 0 before it. */
export function personWagesInYear(plan: Plan, personId: string, startYear: number): (year: number) => number {
  const wages = planWages(plan, startYear)
  return (year) => wages(personId, year)
}
