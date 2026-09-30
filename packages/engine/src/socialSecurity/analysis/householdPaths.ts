/**
 * The paths the benefits-only models weight, each priced a year at a time by
 * the ledger's own year function (socialSecurity/householdYear.ts#socialSecurityYear),
 * so the Social Security analysis page and the projection price a year the
 * same way, the earnings test included.
 *
 * A household of one has one path: the person alive every year. A household of
 * two has the path on which both are alive, and for each person s and each year
 * k the path on which the other dies in December of year k (the ledger's death
 * convention) and s lives on from the state both reached at the end of year k:
 * the crediting months counted so far, including the deceased's, which price
 * the widow's limit. On every path each living person's wages are the plan's
 * wage rows at the plan's flat inflation, and the exempt amounts are the
 * published figures, carried past the latest published year at the plan's
 * inflation, as a deterministic projection carries them.
 *
 * A path stops changing once every claim has started, every full-retirement-
 * age and survivor-full-retirement-age month has passed, every former-spouse
 * gate has opened and (for a survivor path) the first year after the death has
 * begun: no month can then differ from the one before it, and no excess can be
 * charged after the full-retirement-age year. From that year on the path pays
 * the same monthly benefits in today's dollars, so it is priced once there and
 * carried by the COLA drift and haircut. Nothing is rounded.
 */
import type { Assumptions, FormerSpouse, Person, Plan } from '../../model/plan.js'
import { componentScale, packForYear } from '../../params/index.js'
import { flatInflationPath } from '../../params/indexingScale.js'
import { wageIncomeStreams } from '../../projection/internal/wageIncomeStreams.js'
import type { PersonYearState } from '../../projection/types.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import type { ClaimAge } from '../claimFactor.js'
import { socialSecurityColaFactor, socialSecurityHaircutFactor } from '../colaFactor.js'
import { ssdiSchedule } from '../disability.js'
import { claimStartMonthIndex, divorcedExFirstMonthIndex } from '../dualEntitlement.js'
import { claimAgeTotalMonths } from '../familyMaximum.js'
import {
  socialSecurityYear,
  type SocialSecurityYearPerson,
  type SocialSecurityYearResult,
} from '../householdYear.js'
import { attainedAgeZeroMonthIndex, effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear, type DobParts } from '../nra.js'
import { neverClaimedDeceasedFactor } from '../survivorBenefit.js'
import { planInflationFactorFrom } from './breakEven.js'
import type { SocialSecurityStream } from './claimants.js'

/** One person of a priced household: the person, and the Social Security stream as priced (null when none). */
export interface PathPerson {
  readonly person: SocialSecurityYearPerson
  readonly stream: SocialSecurityStream | null
  /** The monthly PIA the projection pays from; unused when there is no stream. */
  readonly piaMonthly: number
}

export interface PathHousehold {
  /** The household's people, in plan order: one, or a couple. */
  readonly people: readonly PathPerson[]
  readonly startYear: number
  readonly assumptions: Pick<Assumptions, 'inflationPct' | 'ssCola' | 'ssHaircut'>
  /** A living person's wages in a year, in that year's dollars; 0 when none. */
  readonly wages: (personId: string, year: number) => number
}

/** Crediting-month counts, as the ledger carries them from year to year. */
export interface PathCredits {
  readonly own: ReadonlyMap<string, number>
  readonly survivor: ReadonlyMap<string, number>
  readonly spouse: ReadonlyMap<string, number>
}

export const NO_CREDITS: PathCredits = { own: new Map(), survivor: new Map(), spouse: new Map() }

/** One path's benefits, each person's in start-year dollars after the COLA drift and haircut. */
export interface PricedPath {
  /** The first year of the path. */
  readonly fromYear: number
  /** Each year's paid benefits by person, from `fromYear`, while the path can still change. */
  readonly explicit: readonly ReadonlyMap<string, number>[]
  /**
   * From the year after the explicit ones on, each person's benefits for a
   * whole year in today's dollars before the COLA and haircut: the year's
   * value is this times the real COLA drift and haircut for the year.
   */
  readonly steady: ReadonlyMap<string, number>
}

/** The inflation, COLA and exempt-amount factors a household's years are priced with. */
export interface PathYearFactors {
  readonly inflation: (year: number) => number
  readonly cola: (year: number) => number
  readonly haircut: (year: number) => number
  /** The COLA factor over the inflation factor, times the haircut: a start-year dollar's value in `year`. */
  readonly realScale: (year: number) => number
}

export function pathYearFactors(household: Pick<PathHousehold, 'startYear' | 'assumptions'>, endYear: number): PathYearFactors {
  const { assumptions, startYear } = household
  const inflationFrom = planInflationFactorFrom(assumptions.inflationPct, startYear, Math.max(startYear, endYear))
  const inflation = (year: number): number => inflationFrom(startYear, year)
  const cola = (year: number): number => socialSecurityColaFactor(assumptions.ssCola, inflationFrom, startYear, year)
  const haircut = (year: number): number => socialSecurityHaircutFactor(assumptions.ssHaircut, year)
  return {
    inflation,
    cola,
    haircut,
    realScale: (year) => (cola(year) / inflation(year)) * haircut(year),
  }
}

function dobOf(person: SocialSecurityYearPerson): DobParts {
  const { y, m, d } = socialSecurityDobParts(person)
  return { year: y, month: m, day: d }
}

function dobOfRecord(record: FormerSpouse): DobParts {
  return { year: Number(record.dob.slice(0, 4)), month: Number(record.dob.slice(5, 7)), day: Number(record.dob.slice(8, 10)) }
}

/**
 * The first year from which a path on which no one dies later can no longer
 * change: the year after the last of each person's claim year, the year of the
 * claim's first month, a disability benefit's first year and its
 * full-retirement-age year, each former-spouse gate (the year a living ex is 62
 * throughout a month, the year the claimant turns 60) and, when a crediting
 * month can exist on the path (`withCredits`), the years of the full-retirement-
 * age and survivor full-retirement-age months, where the credits take effect.
 * Without a crediting month those months change nothing. No earnings are
 * charged after the full-retirement-age year, so the wages do not enter.
 */
export function steadyFromYear(household: Pick<PathHousehold, 'people' | 'startYear'>, withCredits = true): number {
  let last = household.startYear
  for (const { person, stream } of household.people) {
    const dob = dobOf(person)
    const zero = attainedAgeZeroMonthIndex(dob)
    const effective = effectiveBirthYear(dob.year, dob.month, dob.day)
    if (withCredits) {
      last = Math.max(
        last,
        Math.floor((zero + fraTotalMonths(fraForBirthYear(effective))) / 12),
        Math.floor((zero + fraTotalMonths(survivorFraForBirthYear(effective))) / 12),
      )
    }
    if (stream === null) continue
    last = Math.max(last, dob.year + stream.claimAge.years, Math.floor(claimStartMonthIndex(dob, claimAgeTotalMonths(stream.claimAge)) / 12))
    if (stream.disability !== undefined) {
      const schedule = ssdiSchedule(dob, stream.disability)
      if (schedule !== null) last = Math.max(last, Math.floor(schedule.firstPayableMonthIndex / 12), Math.floor(schedule.fraMonthIndex / 12))
    }
    for (const record of stream.formerSpouses ?? []) {
      last = Math.max(last, record.relationship === 'divorced' ? Math.floor(divorcedExFirstMonthIndex(dobOfRecord(record)) / 12) : dob.year + 60)
    }
  }
  return last + 1
}

interface YearCall {
  readonly year: number
  /** The year of death of each person who dies on the path (alive through it); absent while alive. */
  readonly deaths: ReadonlyMap<string, number>
  readonly credits: PathCredits
  readonly withWages: boolean
  readonly cola: number
  readonly haircut: number
}

/**
 * The year's figures and how far to grow the Social Security ones: SSA's own
 * publication decides it (componentScale on 'ssaProgram', as the ledger's
 * pass does), from the latest year SSA is loaded for, not the base pack's.
 */
function limitScaleFor(inflationPct: number, year: number): { pack: ReturnType<typeof packForYear>['pack']; limitGrowth: number } {
  const yearParameters = packForYear(year)
  return { pack: yearParameters.pack, limitGrowth: componentScale(yearParameters, 'ssaProgram', year, flatInflationPath(inflationPct / 100)) }
}

/** One year of a household path through the ledger's year function. */
export function householdPathYear(household: PathHousehold, call: YearCall): SocialSecurityYearResult {
  const people = household.people.map((entry) => entry.person)
  const personById = new Map(people.map((person) => [person.id, person]))
  const birthYear = new Map(people.map((person) => [person.id, dobOf(person).year]))
  const incomes = household.people.flatMap((entry) => (entry.stream === null ? [] : [entry.stream]))
  const resolvedPiaByStreamId = new Map<string, number>()
  for (const entry of household.people) if (entry.stream !== null) resolvedPiaByStreamId.set(entry.stream.id, entry.piaMonthly)
  const stateOf = (personId: string): PersonYearState => {
    const born = birthYear.get(personId)!
    const death = call.deaths.get(personId)
    return death === undefined
      ? { personId, ageAttained: call.year - born, alive: true }
      : { personId, ageAttained: call.year - born, alive: call.year <= death, lifeAge: death - born }
  }
  const wagesByPerson = new Map<string, number>()
  if (call.withWages) {
    for (const person of people) {
      const death = call.deaths.get(person.id)
      if (death !== undefined && call.year > death) continue
      const wages = household.wages(person.id, call.year)
      if (wages > 0) wagesByPerson.set(person.id, wages)
    }
  }
  const { pack, limitGrowth } = limitScaleFor(household.assumptions.inflationPct, call.year)
  return socialSecurityYear({
    incomes,
    people,
    personById,
    stateOf,
    resolvedPiaByStreamId,
    wagesByPerson,
    withheldMonthsByPerson: call.credits.own,
    withheldSurvivorMonthsBySource: call.credits.survivor,
    withheldSpouseMonthsBySource: call.credits.spouse,
    year: call.year,
    ssColaFactor: call.cola,
    ssHaircutFactor: call.haircut,
    pack,
    limitGrowth,
  })
}

function withWrites(credits: PathCredits, result: SocialSecurityYearResult): PathCredits {
  if (result.withheldMonthWrites.length === 0 && result.withheldSurvivorMonthWrites.length === 0 && result.withheldSpouseMonthWrites.length === 0) {
    return credits
  }
  const own = new Map(credits.own)
  const survivor = new Map(credits.survivor)
  const spouse = new Map(credits.spouse)
  for (const write of result.withheldMonthWrites) own.set(write.personId, write.value)
  for (const write of result.withheldSurvivorMonthWrites) survivor.set(write.sourceKey, write.value)
  for (const write of result.withheldSpouseMonthWrites) spouse.set(write.sourceKey, write.value)
  return { own, survivor, spouse }
}

/**
 * The first year anyone alive on a path from `fromYear` is paid: each such
 * person's claim year, or first disability year.
 */
function firstPaidYear(household: Pick<PathHousehold, 'people'>, deaths: ReadonlyMap<string, number>, fromYear: number): number {
  let first = Infinity
  for (const { person, stream } of household.people) {
    if (stream === null) continue
    const death = deaths.get(person.id)
    if (death !== undefined && death < fromYear) continue
    const dob = dobOf(person)
    first = Math.min(first, dob.year + stream.claimAge.years)
    if (stream.disability !== undefined) {
      const schedule = ssdiSchedule(dob, stream.disability)
      if (schedule !== null) first = Math.min(first, Math.floor(schedule.firstPayableMonthIndex / 12))
    }
  }
  return first
}

/** Whether anyone in the household has wages in a year up to the calendar year of that person's full-retirement-age month. */
function hasWagesBeforeFullRetirement(household: PathHousehold): boolean {
  for (const { person } of household.people) {
    const dob = dobOf(person)
    const effective = effectiveBirthYear(dob.year, dob.month, dob.day)
    const fraYear = Math.floor((attainedAgeZeroMonthIndex(dob) + fraTotalMonths(fraForBirthYear(effective))) / 12)
    for (let year = household.startYear; year <= fraYear; year++) {
      if (household.wages(person.id, year) > 0) return true
    }
  }
  return false
}

function hasCredits(credits: PathCredits): boolean {
  const any = (counts: ReadonlyMap<string, number>): boolean => [...counts.values()].some((count) => count > 0)
  return any(credits.own) || any(credits.survivor) || any(credits.spouse)
}

export interface PricePathOptions {
  readonly fromYear: number
  /** The first year from which the path cannot change (#steadyFromYear, and no earlier than the first year after a death). */
  readonly steadyFrom: number
  /** The last year anyone on the path can be alive. */
  readonly lastYear: number
  readonly deaths: ReadonlyMap<string, number>
  readonly credits: PathCredits
  readonly factors: PathYearFactors
}

export interface PricedPathWithStates extends PricedPath {
  /** The crediting months at the end of each explicit year, and after the last one for every later year. */
  readonly creditsAfter: readonly PathCredits[]
  readonly finalCredits: PathCredits
  /** Each person's benefits the earnings test withheld on the path, in each year's dollars. */
  readonly withheldByPerson: ReadonlyMap<string, number>
  /** The part of each person's excess earnings charged on the path, in each year's dollars. */
  readonly excessChargedByPerson: ReadonlyMap<string, number>
}

/** Price one path: each year from `fromYear` explicitly while it can change, then once in today's dollars. */
export function pricePath(household: PathHousehold, options: PricePathOptions): PricedPathWithStates {
  const { factors } = options
  let credits = options.credits
  const explicit: ReadonlyMap<string, number>[] = []
  const creditsAfter: PathCredits[] = []
  const withheldByPerson = new Map<string, number>()
  const excessChargedByPerson = new Map<string, number>()
  const explicitEnd = Math.min(options.steadyFrom, options.lastYear + 1)
  // Before anyone on the path is paid, a year pays nothing and credits nothing.
  const firstPaid = firstPaidYear(household, options.deaths, options.fromYear)
  for (let year = options.fromYear; year < explicitEnd; year++) {
    if (year < firstPaid) {
      explicit.push(new Map())
      creditsAfter.push(credits)
      continue
    }
    const result = householdPathYear(household, {
      year,
      deaths: options.deaths,
      credits,
      withWages: true,
      cola: factors.cola(year),
      haircut: factors.haircut(year),
    })
    const inflation = factors.inflation(year)
    const real = new Map<string, number>()
    for (const [personId, paid] of result.paidByPerson) real.set(personId, paid / inflation)
    explicit.push(real)
    for (const [personId, withheld] of result.withheldByPerson) withheldByPerson.set(personId, (withheldByPerson.get(personId) ?? 0) + withheld)
    for (const [personId, charged] of result.excessChargedByPerson) excessChargedByPerson.set(personId, (excessChargedByPerson.get(personId) ?? 0) + charged)
    credits = withWrites(credits, result)
    creditsAfter.push(credits)
  }
  const steadyYear = Math.max(options.steadyFrom, options.fromYear)
  const steady = new Map<string, number>()
  if (steadyYear <= options.lastYear) {
    const result = householdPathYear(household, { year: steadyYear, deaths: options.deaths, credits, withWages: false, cola: 1, haircut: 1 })
    for (const [personId, paid] of result.paidByPerson) steady.set(personId, paid)
  }
  return { fromYear: options.fromYear, explicit, steady, creditsAfter, finalCredits: credits, withheldByPerson, excessChargedByPerson }
}

/**
 * What a person who dies in December of `deathYear` passes on to a survivor:
 * nothing without a stream; the claimed benefit when the claim year had come;
 * otherwise the benefit for the month before the death (42 U.S.C.
 * 402(e)(2)(C)), which is the only part that depends on the year.
 */
function passedOnKey(deceased: PathPerson, deathYear: number): string {
  if (deceased.stream === null) return 'none'
  const dob = dobOf(deceased.person)
  if (deceased.stream.disability !== undefined) return 'death:' + deathYear
  if (dob.year + deceased.stream.claimAge.years <= deathYear) return 'claimed'
  return 'never:' + neverClaimedDeceasedFactor(dob, deathYear, 12)
}

/** A path's paid benefits for `personId` in `year`, in start-year dollars. */
export function pathValue(path: PricedPath, personId: string, year: number, factors: PathYearFactors): number {
  const index = year - path.fromYear
  if (index < 0) return 0
  if (index < path.explicit.length) return path.explicit[index]!.get(personId) ?? 0
  return (path.steady.get(personId) ?? 0) * factors.realScale(year)
}

/** Every path of a household: the one with everyone alive, and each survivor's after each death year. */
export interface HouseholdPaths {
  readonly household: PathHousehold
  readonly factors: PathYearFactors
  readonly lastYear: number
  readonly alive: PricedPathWithStates
  /** survivors[s][k]: person s alone after the other dies in December of startYear + k; absent in a household of one. */
  readonly survivors: readonly (readonly PricedPath[])[] | null
}

/**
 * Price every path of a household through `lastYear`. A survivor path is priced
 * only for a survivor who has a Social Security stream; the other survivor is
 * paid nothing. With `survivors: false` only the path on which everyone lives
 * is priced (a couple member priced as married throughout).
 */
export function priceHouseholdPaths(household: PathHousehold, lastYear: number, options: { readonly survivors?: boolean } = {}): HouseholdPaths {
  const factors = pathYearFactors(household, lastYear)
  // Without wages before a full retirement age no month is ever credited, and
  // the full-retirement-age months change nothing.
  const testable = hasWagesBeforeFullRetirement(household)
  const steadyFrom = steadyFromYear(household, testable)
  const steadyWithCredits = testable ? steadyFrom : steadyFromYear(household, true)
  const alive = pricePath(household, {
    fromYear: household.startYear,
    steadyFrom,
    lastYear,
    deaths: new Map(),
    credits: NO_CREDITS,
    factors,
  })
  if (household.people.length !== 2 || options.survivors === false) return { household, factors, lastYear, alive, survivors: null }
  const survivors = household.people.map((survivor, s) => {
    const deceased = household.people[1 - s]!
    const paths: PricedPath[] = []
    if (survivor.stream === null) return paths
    // A death more than a year before the survivor is first paid, with no month
    // credited yet, leaves a path that starts with the survivor's own claim and
    // depends on the death only through what the deceased passes on: whether he
    // had claimed by then and, if not, the benefit for the month before his
    // death. The widow(er) benefit's first month is then the survivor's own
    // claim, as is a divorced-spouse benefit's, so those paths are priced once.
    const survivorFirstPaid = firstPaidYear({ people: [survivor] }, new Map(), household.startYear)
    const early = new Map<string, PricedPath>()
    for (let deathYear = household.startYear; deathYear < lastYear; deathYear++) {
      const k = deathYear - household.startYear
      const credits = alive.creditsAfter[k] ?? alive.finalCredits
      const price = (fromYear: number): PricedPath =>
        pricePath(household, {
          fromYear,
          steadyFrom: Math.max(hasCredits(credits) ? steadyWithCredits : steadyFrom, deathYear + 1),
          lastYear,
          deaths: new Map([[deceased.person.id, deathYear]]),
          credits,
          factors,
        })
      if (deathYear + 1 < survivorFirstPaid && !hasCredits(credits)) {
        const key = passedOnKey(deceased, deathYear)
        let path = early.get(key)
        if (path === undefined) {
          path = price(survivorFirstPaid)
          early.set(key, path)
        }
        paths.push(path)
        continue
      }
      paths.push(price(deathYear + 1))
    }
    return paths
  })
  return { household, factors, lastYear, alive, survivors }
}

/** The plan's wage rows by year and person, at the plan's flat inflation from `startYear`, cached. */
export function planWages(plan: Pick<Plan, 'incomes' | 'household' | 'assumptions'>, startYear: number): (personId: string, year: number) => number {
  const personById = new Map<string, Person>(plan.household.people.map((person) => [person.id, person]))
  const birthYear = (personId: string): number => socialSecurityDobParts(personById.get(personId)!).y
  const lastYear = startYear + 120
  const inflationFrom = planInflationFactorFrom(plan.assumptions.inflationPct, startYear, lastYear)
  const cache = new Map<number, Map<string, number>>()
  return (personId, year) => {
    if (year < startYear) return 0
    let byPerson = cache.get(year)
    if (byPerson === undefined) {
      byPerson = new Map()
      const rows = wageIncomeStreams({
        incomes: plan.incomes,
        personById,
        stateOf: (id) => ({ personId: id, ageAttained: year - birthYear(id), alive: true }),
        year,
        startYear,
        inflFactor: inflationFrom(startYear, Math.min(year, lastYear)),
      })
      for (const row of rows) byPerson.set(row.personId, (byPerson.get(row.personId) ?? 0) + row.amount)
      cache.set(year, byPerson)
    }
    return byPerson.get(personId) ?? 0
  }
}

/** A stream priced at a whole-year or year-and-month claim age. */
export function streamAtClaimAge(stream: SocialSecurityStream, claimAge: ClaimAge): SocialSecurityStream {
  return { ...stream, claimAge: { years: claimAge.years, months: claimAge.months } }
}
