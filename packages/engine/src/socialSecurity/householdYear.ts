/**
 * One year of a household's Social Security, the one year function the
 * projection and the analysis models share. The projection's Social Security
 * pass (projection/internal/annualSocialSecurity.ts) delegates to it every
 * year; the benefits-only models on the Social Security analysis page
 * (analysis/expectedValue.ts through analysis/householdPaths.ts, and
 * analysis/breakEven.ts) call it for each year of each path they weight, so the
 * two tabs price a year the same way by construction.
 *
 * The year is composed month by month where a month can differ from the one
 * before it: the month a stream's claim starts paying under the claim-year
 * convention, the month both spouses are paid, each person's full-retirement-
 * age and survivor-full-retirement-age months (where the adjustment of a
 * reduction factor takes effect, 20 CFR 404.412(b)), and the month a
 * disability benefit starts. Months between those boundaries are priced once.
 *
 * In each month, as the ledger always did for the year: each person's own
 * benefits (retirement, disability, or the benefit of a worker who died before
 * claiming, which prices his survivor); then a former-spouse benefit that
 * replaces them when larger; then, while both spouses live, the lower earner's
 * own benefit plus the reduced spouse excess on the higher earner's record;
 * then, after a death, the widow(er) benefit on the deceased's record when
 * larger. The retirement earnings test (socialSecurity/earningsTest.ts)
 * then charges each working person's excess earnings month by month, the
 * worker's first against the family benefit on his record, and reports each
 * crediting month, which adjusts that benefit's reduction from the full-
 * retirement-age month of that benefit: the old-age FRA for an own or spouse
 * benefit, the survivor FRA for a widow(er) benefit, and, for the deceased's
 * benefit that prices the widow's limit, the deceased's own FRA month, as if
 * he were still living (42 U.S.C. 402(e)(2)(D); POMS RS 00615.320 B.2.c).
 *
 * A couple member is unmarried from January after the current spouse's death
 * (the ledger's December death; POMS RS 00202.046): a living ex's divorced-
 * spouse benefit is then payable (42 U.S.C. 402(b)(1)(C), deemed filed under
 * 402(r)(1)), and a remarriage before 60 no longer bars a survivor benefit on
 * an earlier spouse's record (POMS RS 00207.003 A). A household of one is
 * unmarried throughout.
 *
 * Every amount is in the year's dollars: the monthly benefit (today's dollars)
 * times the ledger's COLA factor and haircut. A year with no boundary and no
 * one's excess earnings is priced exactly as the ledger priced it before
 * 2026-09-29, product for product.
 *
 * @see social-security-benefit-annual in rules/calculations/socialSecurity.ts
 */
import type { FormerSpouse, IncomeStream, Person } from '../model/plan.js'
import type { ParameterPack } from '../params/types.js'
import type {
  PersonYearState,
  SocialSecurityBenefitSource,
  SocialSecurityStreamActivity,
} from '../projection/types.js'
import { socialSecurityDobParts } from './annualTiming.js'
import { claimFactor, creditedAgeMonths, type ClaimAge } from './claimFactor.js'
import {
  inSsdiWindow,
  ssdiMonthlyBenefit,
  ssdiMonthsInYear,
  ssdiSchedule,
  ssdiSuspendedBySga,
  type SsdiSchedule,
} from './disability.js'
import {
  claimStartMonthIndex,
  divorcedExFirstMonthIndex,
  spouseEntitlementAgeMonths,
  spouseReductionFactorAtAgeMonths,
} from './dualEntitlement.js'
import { earningsTestYear, excessEarnings, type EarningsTestMonthlyDue, type EarningsTestPerson } from './earningsTest.js'
import { claimAgeTotalMonths, currentSpouseMonthlyUnderFamilyMaximum } from './familyMaximum.js'
import { formerSpouseSurvivorEntitlementAgeMonths, maritalBenefitFor, type MaritalBenefitCandidate } from './maritalBenefits.js'
import {
  attainedAgeZeroMonthIndex,
  effectiveBirthYear,
  fraForBirthYear,
  fraTotalMonths,
  survivorFraForBirthYear,
  type DobParts,
} from './nra.js'
import { neverClaimedDeceasedFactor, survivorBenefitMonthly, widowEntitlementAgeMonths } from './survivorBenefit.js'

/**
 * The key of one auxiliary benefit's crediting-month count: the claimant and
 * the record the benefit is paid on, a current spouse (`person`, that person's
 * id) or a former-spouse entry (`formerSpouse`, the entry's id). 42 U.S.C.
 * 402(q)(7) adjusts a benefit's reduction only for the months in which "such
 * benefit" was withheld, so each record keeps its own count.
 */
export function auxiliaryBenefitSourceKey(claimantId: string, kind: 'person' | 'formerSpouse', sourceId: string): string {
  return `${claimantId}|${kind}|${sourceId}`
}

/** Annual-ledger convention: a same-year claim pays only months after the claim month. */
export function annualSocialSecurityPayableMonths(
  ageAttained: number,
  claimAge: Readonly<ClaimAge>,
): number {
  if (ageAttained < claimAge.years) return 0
  if (ageAttained > claimAge.years) return 12
  return Math.max(0, 12 - claimAge.months)
}

/**
 * Said, naming the person, when a disability onset leaves no disability month
 * before full retirement age, so the stream is priced as a retirement claim at
 * its claim age instead. Before 2026-09-27 this fall-through was silent.
 */
export const ssdiNotPayableBeforeFraWarning = (personName: string): string =>
  `The date ${personName}'s disability began leaves no Social Security disability month before full retirement age (the first payment would fall at or after it), so ${personName}'s benefit is priced as a retirement claim at the claim age.`

/**
 * The same fall-through for a worker who died before the year of that claim
 * age: the stream is then priced as never claimed, the survivor on the benefit
 * the worker would have received for the month before the death (42 U.S.C.
 * 402(e)(2)(C)), not as a retirement claim.
 */
export const ssdiNotPayableBeforeFraNeverClaimedWarning = (personName: string): string =>
  `The date ${personName}'s disability began leaves no Social Security disability month before full retirement age (the first payment would fall at or after it), and ${personName} died before the claim age, so the survivor benefit is priced as if ${personName} never claimed.`

/** The warning the year carries when the earnings test withheld any benefit. */
export const EARNINGS_TEST_WITHHELD_WARNING =
  'The earnings test withheld benefits for working early claimants; the months withheld are credited back from full retirement age.'

/** The warning the year carries when earnings above SGA suspended a disability benefit. */
export const SGA_SUSPENDED_WARNING =
  'Earnings above Substantial Gainful Activity (SGA) suspended Social Security disability (SSDI) for a working year.'

/** What the year function reads of a person: the id, the name its warnings use and the date of birth. */
export type SocialSecurityYearPerson = Pick<Person, 'id' | 'name' | 'dob'>

export interface SocialSecurityYearInput {
  readonly incomes: readonly Readonly<IncomeStream>[]
  readonly people: readonly Readonly<SocialSecurityYearPerson>[]
  readonly personById: ReadonlyMap<string, Readonly<SocialSecurityYearPerson>>
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly resolvedPiaByStreamId: ReadonlyMap<string, number>
  /** Each living person's wages for the year (the plan's wage rows): the earnings the test counts. */
  readonly wagesByPerson: ReadonlyMap<string, number>
  /**
   * Crediting months so far for each person's own old-age benefit: months of
   * its reduction period with a full or partial earnings-test deduction
   * (402(q)(7)(A)). They adjust the reduction from the person's
   * full-retirement-age month, and a deceased's count prices the benefit his
   * survivor's widow's limit is measured against.
   */
  readonly withheldMonthsByPerson: ReadonlyMap<string, number>
  /**
   * Crediting months for each widow(er) benefit, by the record it is paid on
   * (#auxiliaryBenefitSourceKey): only months of the widow(er) reduction
   * period, which ends before the survivor full-retirement-age month, count.
   */
  readonly withheldSurvivorMonthsBySource: ReadonlyMap<string, number>
  /** Crediting months for each spouse or divorced-spouse benefit, by record. */
  readonly withheldSpouseMonthsBySource: ReadonlyMap<string, number>
  readonly year: number
  readonly ssColaFactor: number
  readonly ssHaircutFactor: number
  readonly pack: Readonly<ParameterPack>
  /** The factor the year's exempt amounts and SGA limit are carried by past the latest published pack. */
  readonly limitGrowth: number
}

export interface SocialSecurityYearResult {
  readonly socialSecurity: number
  readonly socialSecurityStreams: readonly SocialSecurityStreamActivity[]
  readonly ssEarningsTestWithheld: number
  readonly ssdiPaid: number
  /** New totals of `withheldMonthsByPerson`, applied by the caller. */
  readonly withheldMonthWrites: readonly { readonly personId: string; readonly value: number }[]
  /** New totals of `withheldSurvivorMonthsBySource`, applied by the caller. */
  readonly withheldSurvivorMonthWrites: readonly { readonly sourceKey: string; readonly value: number }[]
  /** New totals of `withheldSpouseMonthsBySource`, applied by the caller. */
  readonly withheldSpouseMonthWrites: readonly { readonly sourceKey: string; readonly value: number }[]
  readonly warnings: readonly string[]
  /** Each living person's benefits paid in the year, after the earnings test and SGA. */
  readonly paidByPerson: ReadonlyMap<string, number>
  /** Each person's benefits the earnings test withheld in the year. */
  readonly withheldByPerson: ReadonlyMap<string, number>
  /** The part of each person's excess earnings the test charged this year. */
  readonly excessChargedByPerson: ReadonlyMap<string, number>
}

type SocialSecurityStream = Extract<IncomeStream, { type: 'socialSecurity' }>

interface PersonFacts {
  readonly id: string
  readonly dob: DobParts
  readonly zero: number
  readonly fraMonths: number
  readonly fraMonthIndex: number
  readonly survivorFraMonths: number
  readonly survivorFraMonthIndex: number
  readonly alive: boolean
  readonly ageAttained: number
  /** The year of death for a person dead this year whose life age is known (alive through it). */
  readonly deathYear: number | null
}

/** One resolved stream's own pay site in the year. */
interface OwnSite {
  readonly stream: SocialSecurityStream
  readonly person: PersonFacts
  readonly kind: 'retirement' | 'ssdi' | 'neverClaimed'
  readonly pia: number
  readonly claimMonths: number
  /** The first month (0-11) the stream pays in the year; 12 when it pays none. */
  readonly payableFrom: number
  /** The months it pays: the ledger's claim-year convention, or the disability months. */
  readonly payableMonths: number
  /** A fixed monthly amount (disability, or a worker who died before claiming). */
  readonly fixedMonthly: number | null
}

/** Who is paid what in a month, before the earnings test, in today's dollars. */
interface Arrangement {
  total: number
  ownPart: number
  auxKind: 'spouse' | 'survivor' | null
  auxSourceKey: string | null
  auxWorkerId: string | null
  /** The first month of the auxiliary benefit's reduction period, and the month it ends before. */
  auxPeriodStart: number
  auxPeriodEnd: number
  /** The stream the replacing benefit is paid through; null while the own streams pay. */
  payingStreamId: string | null
  payingSource: SocialSecurityBenefitSource | null
}

interface MonthComposition {
  readonly arrangements: ReadonlyMap<string, Arrangement>
  /**
   * Each own pay site's monthly due this month, by its index in the year's
   * sites (today's dollars): 0 when it does not pay this month or a larger
   * benefit on another record replaces the person's own benefits.
   */
  readonly siteDue: readonly number[]
  /** Whether each own pay site is in force this month (paying, whatever the amount) and not replaced. */
  readonly siteActive: readonly boolean[]
}

function claimAgeFromTotalMonths(totalMonths: number): ClaimAge {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}

function dobOfRecord(record: FormerSpouse): DobParts {
  return { year: Number(record.dob.slice(0, 4)), month: Number(record.dob.slice(5, 7)), day: Number(record.dob.slice(8, 10)) }
}

/** A running count read through to the input map until this year writes it. */
class CreditCounts {
  private readonly written = new Map<string, number>()
  private readonly base: ReadonlyMap<string, number>
  constructor(base: ReadonlyMap<string, number>) {
    this.base = base
  }
  get(key: string): number {
    return this.written.get(key) ?? this.base.get(key) ?? 0
  }
  bump(key: string): void {
    this.written.set(key, this.get(key) + 1)
  }
  writes(): { key: string; value: number }[] {
    return [...this.written].map(([key, value]) => ({ key, value }))
  }
}

export function socialSecurityYear(input: SocialSecurityYearInput): SocialSecurityYearResult {
  const {
    incomes,
    people,
    personById,
    stateOf,
    resolvedPiaByStreamId,
    wagesByPerson,
    year,
    ssColaFactor,
    ssHaircutFactor,
    pack,
    limitGrowth,
  } = input
  const yearStart = year * 12
  const warningValues: string[] = []
  const ownCredits = new CreditCounts(input.withheldMonthsByPerson)
  const survivorCredits = new CreditCounts(input.withheldSurvivorMonthsBySource)
  const spouseCredits = new CreditCounts(input.withheldSpouseMonthsBySource)

  const factsById = new Map<string, PersonFacts>()
  const factsOf = (personId: string): PersonFacts => {
    let facts = factsById.get(personId)
    if (facts === undefined) {
      const person = personById.get(personId)!
      const { y, m, d } = socialSecurityDobParts(person)
      const dob = { year: y, month: m, day: d }
      const effective = effectiveBirthYear(y, m, d)
      const fraMonths = fraTotalMonths(fraForBirthYear(effective))
      const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effective))
      const zero = attainedAgeZeroMonthIndex(dob)
      const state = stateOf(personId)
      facts = {
        id: personId,
        dob,
        zero,
        fraMonths,
        fraMonthIndex: zero + fraMonths,
        survivorFraMonths,
        survivorFraMonthIndex: zero + survivorFraMonths,
        alive: state.alive,
        ageAttained: state.ageAttained,
        deathYear: !state.alive && state.lifeAge !== undefined ? y + state.lifeAge : null,
      }
      factsById.set(personId, facts)
    }
    return facts
  }

  // ---------------------------------------------------------------- own sites
  // The person's gate stream (the last resolved stream, whose PIA and claim age
  // key the spouse and survivor benefits), every resolved stream's own pay site,
  // and the order streams are published in.
  const gateByPerson = new Map<string, { pia: number; claimAge: ClaimAge; streamId: string }>()
  const ownSites: OwnSite[] = []
  const everReduced = new Set<string>()
  const publicationOrder: string[] = []
  const claimInForce = new Set<string>()
  const ssdiByPerson = new Map<string, { disabilityShare: number; ssdiAnnual: number; sgaApplies: boolean }>()
  const ssdiSiteMonths = new Map<string, { disability: number; retirement: number }>()

  for (const income of incomes) {
    if (income.type !== 'socialSecurity') continue
    const stream = income
    const pia = resolvedPiaByStreamId.get(stream.id)
    if (pia === undefined) continue
    gateByPerson.set(stream.personId, { pia, claimAge: stream.claimAge, streamId: stream.id })
    if (!publicationOrder.includes(stream.id)) publicationOrder.push(stream.id)
    const person = factsOf(stream.personId)
    const personName = personById.get(stream.personId)!.name
    const schedule: SsdiSchedule | null = stream.disability === undefined ? null : ssdiSchedule(person.dob, stream.disability)
    // A worker who died before the year his benefit would first have been paid
    // never claimed; his survivor is priced on the benefit he would upon
    // application have received for the month before his December death
    // (42 U.S.C. 402(e)(2)(C)), whatever claim age the plan configured.
    const firstPaidYear = schedule !== null ? Math.floor(schedule.firstPayableMonthIndex / 12) : person.dob.year + stream.claimAge.years
    const neverClaimed = person.deathYear !== null && firstPaidYear > person.deathYear
    if (stream.disability !== undefined && schedule === null) {
      warningValues.push(neverClaimed ? ssdiNotPayableBeforeFraNeverClaimedWarning(personName) : ssdiNotPayableBeforeFraWarning(personName))
    }
    const claimMonths = claimAgeTotalMonths(stream.claimAge)
    if (neverClaimed) {
      ownSites.push({
        stream, person, kind: 'neverClaimed', pia, claimMonths, payableFrom: 12, payableMonths: 0,
        fixedMonthly: pia * neverClaimedDeceasedFactor(person.dob, person.deathYear!, 12),
      })
      continue
    }
    if (schedule !== null) {
      // Disability months run from the first payable month to the month before
      // FRA; from the FRA month the same PIA is the converted old-age benefit
      // (402(a)(3)), with no new filing decision and no delayed credits.
      const months = ssdiMonthsInYear(schedule, year)
      const paidMonths = months.disability + months.retirement
      if (paidMonths <= 0) continue
      const monthly = ssdiMonthlyBenefit(pia)
      const annual = monthly * paidMonths * ssColaFactor * ssHaircutFactor
      ownSites.push({ stream, person, kind: 'ssdi', pia, claimMonths, payableFrom: 12 - paidMonths, payableMonths: paidMonths, fixedMonthly: monthly })
      ssdiSiteMonths.set(stream.id, months)
      const share = months.disability / paidMonths
      const prior = ssdiByPerson.get(stream.personId)
      const ssdiAnnual = (prior?.ssdiAnnual ?? 0) + annual
      ssdiByPerson.set(stream.personId, {
        disabilityShare: prior === undefined || ssdiAnnual <= 0 ? share : (prior.disabilityShare * prior.ssdiAnnual + share * annual) / ssdiAnnual,
        ssdiAnnual,
        sgaApplies: (prior?.sgaApplies ?? false) || inSsdiWindow(months),
      })
      if (person.alive) claimInForce.add(stream.id)
      continue
    }
    const payableMonths = annualSocialSecurityPayableMonths(person.ageAttained, stream.claimAge)
    if (payableMonths <= 0) continue
    if (claimMonths < person.fraMonths) everReduced.add(stream.personId)
    ownSites.push({ stream, person, kind: 'retirement', pia, claimMonths, payableFrom: 12 - payableMonths, payableMonths, fixedMonthly: null })
    if (person.alive) claimInForce.add(stream.id)
  }

  // A household of one is unmarried; a couple member is from January after the
  // other's death (the ledger keeps a person alive through the death year).
  const unmarriedFromOf = (personId: string): number | null => {
    if (people.length === 1) return -Infinity
    if (people.length !== 2) return null
    const other = people.find((p) => p.id !== personId)
    if (other === undefined) return null
    const otherFacts = factsOf(other.id)
    if (otherFacts.alive) return null
    return otherFacts.deathYear === null ? -Infinity : (otherFacts.deathYear + 1) * 12
  }

  // ------------------------------------------------- former-spouse candidates
  const formerSites: { stream: SocialSecurityStream; person: PersonFacts; payableFrom: number; unmarriedFrom: number | null }[] = []
  for (const income of incomes) {
    if (income.type !== 'socialSecurity') continue
    if (!income.formerSpouses || income.formerSpouses.length === 0) continue
    const person = factsOf(income.personId)
    const payableMonths = annualSocialSecurityPayableMonths(person.ageAttained, income.claimAge)
    if (!person.alive || payableMonths <= 0) continue
    formerSites.push({ stream: income, person, payableFrom: 12 - payableMonths, unmarriedFrom: unmarriedFromOf(income.personId) })
  }

  // ------------------------------------------------------ the current spouse
  let couple: {
    higher: PersonFacts
    lower: PersonFacts
    higherGate: { pia: number; claimAge: ClaimAge; streamId: string }
    lowerGate: { pia: number; claimAge: ClaimAge; streamId: string }
    sourceKey: string
    sharedFrom: number
    entitlementMonths: number
  } | null = null
  if (people.length === 2) {
    const [a, b] = people
    const aGate = gateByPerson.get(a!.id)
    const bGate = gateByPerson.get(b!.id)
    if (aGate && bGate) {
      const aHigher = aGate.pia >= bGate.pia
      const higher = factsOf(aHigher ? a!.id : b!.id)
      const lower = factsOf(aHigher ? b!.id : a!.id)
      const higherGate = aHigher ? aGate : bGate
      const lowerGate = aHigher ? bGate : aGate
      const lowerPayable = annualSocialSecurityPayableMonths(lower.ageAttained, lowerGate.claimAge)
      const higherPayable = annualSocialSecurityPayableMonths(higher.ageAttained, higherGate.claimAge)
      const shared = Math.min(lowerPayable, higherPayable)
      if (lower.alive && higher.alive && shared > 0) {
        couple = {
          higher,
          lower,
          higherGate,
          lowerGate,
          sourceKey: auxiliaryBenefitSourceKey(lower.id, 'person', higher.id),
          sharedFrom: 12 - shared,
          // The spouse benefit starts in the later of the lower earner's own
          // claim month and the month the worker's benefit starts (deemed
          // filing, 402(r)), and is reduced for the lower earner's age then.
          entitlementMonths: spouseEntitlementAgeMonths(
            lower.dob,
            claimAgeTotalMonths(lowerGate.claimAge),
            claimStartMonthIndex(higher.dob, claimAgeTotalMonths(higherGate.claimAge)),
          ),
        }
      }
    }
  }

  // --------------------------------------------------------------- survivors
  const survivorSites: {
    deceased: PersonFacts
    survivor: PersonFacts
    survivorGate: { pia: number; claimAge: ClaimAge; streamId: string }
    deceasedPia: number
    payableFrom: number
    entitlementMonths: number
    sourceKey: string
  }[] = []
  if (people.length === 2) {
    const [a, b] = people
    for (const [deceasedPerson, survivorPerson] of [[a!, b!], [b!, a!]] as const) {
      const deceased = factsOf(deceasedPerson.id)
      const survivor = factsOf(survivorPerson.id)
      if (deceased.alive || !survivor.alive) continue
      const survivorGate = gateByPerson.get(survivor.id)
      const deceasedPia = gateByPerson.get(deceased.id)?.pia
      if (!survivorGate || deceasedPia === undefined) continue
      const payableMonths = annualSocialSecurityPayableMonths(survivor.ageAttained, survivorGate.claimAge)
      if (payableMonths <= 0) continue
      // The widow(er) benefit is reduced for the survivor's age in its own first
      // month of entitlement (402(q)(6)(A)(iii), 402(q)(3)(E)): the later of the
      // survivor's own claim and January after the year of death, the first
      // month the ledger pays it. A caller whose person-year state carries no
      // life age cannot place the death; the reduction then starts at the
      // survivor's own claim.
      const ownClaimMonths = claimAgeTotalMonths(survivorGate.claimAge)
      survivorSites.push({
        deceased,
        survivor,
        survivorGate,
        deceasedPia,
        payableFrom: 12 - payableMonths,
        entitlementMonths: deceased.deathYear !== null ? widowEntitlementAgeMonths(survivor.dob, deceased.deathYear, ownClaimMonths) : ownClaimMonths,
        sourceKey: auxiliaryBenefitSourceKey(survivor.id, 'person', deceased.id),
      })
    }
  }

  // --------------------------------------------------- month-by-month compose
  const ownMonthlyAt = (site: OwnSite, monthIndex: number): number => {
    if (site.fixedMonthly !== null) return site.fixedMonthly
    const credited = creditedAgeMonths(site.claimMonths, ownCredits.get(site.person.id), monthIndex, site.person.fraMonthIndex, site.person.fraMonths)
    const claimForFactor = credited === site.claimMonths ? site.stream.claimAge : claimAgeFromTotalMonths(credited)
    return site.pia * claimFactor(site.person.dob.year, site.person.dob.month, site.person.dob.day, claimForFactor)
  }

  const compose = (month: number): MonthComposition => {
    const monthIndex = yearStart + month
    // The own benefit as paid, by person, for every stream paying in the year
    // (it prices a spouse's or a survivor's benefit), and each stream's due.
    const actualByPerson = new Map<string, number>()
    const siteDue: number[] = []
    const siteActive: boolean[] = []
    const ownDueByPerson = new Map<string, number>()
    for (const site of ownSites) {
      const monthly = ownMonthlyAt(site, monthIndex)
      actualByPerson.set(site.person.id, (actualByPerson.get(site.person.id) ?? 0) + monthly)
      const active = site.kind !== 'neverClaimed' && site.person.alive && month >= site.payableFrom
      siteActive.push(active)
      siteDue.push(active ? monthly : 0)
      if (active) ownDueByPerson.set(site.person.id, (ownDueByPerson.get(site.person.id) ?? 0) + monthly)
    }
    const arrangements = new Map<string, Arrangement>()
    const arrangementOf = (personId: string): Arrangement => {
      let arrangement = arrangements.get(personId)
      if (arrangement === undefined) {
        const own = ownDueByPerson.get(personId) ?? 0
        arrangement = {
          total: own, ownPart: own, auxKind: null, auxSourceKey: null, auxWorkerId: null,
          auxPeriodStart: 0, auxPeriodEnd: 0, payingStreamId: null, payingSource: null,
        }
        arrangements.set(personId, arrangement)
      }
      return arrangement
    }
    for (const person of people) if (factsOf(person.id).alive) arrangementOf(person.id)

    // Former-spouse records: the largest candidate replaces the own benefit.
    for (const site of formerSites) {
      if (month < site.payableFrom) continue
      const claimant = site.person
      const unmarried = site.unmarriedFrom !== null
      let best: (MaritalBenefitCandidate & { sourceKey: string; record: FormerSpouse }) | null = null
      for (const record of site.stream.formerSpouses!) {
        const sourceKey = auxiliaryBenefitSourceKey(claimant.id, 'formerSpouse', record.id)
        const candidate = maritalBenefitFor(record, {
          claimantDob: claimant.dob,
          claimantClaimAge: site.stream.claimAge,
          // A divorced spouse's benefit is the own benefit plus the reduced
          // excess (402(k)(3)(A)), so the menu takes the claimant's own PIA and
          // benefit.
          claimantOwnPiaMonthly: gateByPerson.get(claimant.id)?.pia ?? 0,
          claimantOwnActualMonthly: actualByPerson.get(claimant.id) ?? 0,
          claimantSpouseWithheldMonths: spouseCredits.get(sourceKey),
          // A former spouse's death date is not in the plan; the widow(er)
          // benefit is taken to start with the claimant's own claim, after that
          // death, or, when a remarriage before 60 barred it until the current
          // spouse's death, with the January after that death; its credits
          // adjust it from the survivor FRA month.
          claimantSurvivorClaimAge: claimAgeFromTotalMonths(
            creditedAgeMonths(
              formerSpouseSurvivorEntitlementAgeMonths(record, claimant.zero, claimAgeTotalMonths(site.stream.claimAge), site.unmarriedFrom),
              survivorCredits.get(sourceKey),
              monthIndex,
              claimant.survivorFraMonthIndex,
              claimant.survivorFraMonths,
            ),
          ),
          claimantAge: claimant.ageAttained,
          year,
          monthIndex,
          claimantIsSingle: unmarried,
          ...(site.unmarriedFrom !== null && Number.isFinite(site.unmarriedFrom) ? { claimantUnmarriedFromMonthIndex: site.unmarriedFrom } : {}),
        })
        if (candidate && (best === null || candidate.monthly > best.monthly)) best = { ...candidate, sourceKey, record }
      }
      if (best === null) continue
      const arrangement = arrangementOf(claimant.id)
      if (best.monthly > arrangement.total) {
        const own = ownDueByPerson.get(claimant.id) ?? 0
        const isSurvivor = best.kind === 'survivor'
        arrangement.total = best.monthly
        arrangement.ownPart = Math.min(own, best.monthly)
        arrangement.auxKind = isSurvivor ? 'survivor' : 'spouse'
        arrangement.auxSourceKey = best.sourceKey
        arrangement.auxWorkerId = null
        if (isSurvivor) {
          arrangement.auxPeriodStart = claimant.zero + formerSpouseSurvivorEntitlementAgeMonths(best.record, claimant.zero, claimAgeTotalMonths(site.stream.claimAge), site.unmarriedFrom)
          arrangement.auxPeriodEnd = claimant.survivorFraMonthIndex
        } else {
          const unmarriedFrom = site.unmarriedFrom ?? -Infinity
          arrangement.auxPeriodStart = claimant.zero + spouseEntitlementAgeMonths(
            claimant.dob,
            claimAgeTotalMonths(site.stream.claimAge),
            Math.max(divorcedExFirstMonthIndex(dobOfRecord(best.record)), unmarriedFrom),
          )
          arrangement.auxPeriodEnd = claimant.fraMonthIndex
        }
        arrangement.payingStreamId = site.stream.id
        arrangement.payingSource = isSurvivor ? 'survivor' : 'spousal'
      }
    }

    // The current spouse: own benefit plus the separately reduced excess
    // (402(q)(3)(B), (k)(3)(A)), with half the worker's PIA held first to the
    // family maximum room above his PIA (20 CFR 404.404, 404.410(b)).
    if (couple !== null && month >= couple.sharedFrom) {
      const { higher, lower, higherGate, lowerGate } = couple
      const spouseAgeMonths = creditedAgeMonths(couple.entitlementMonths, spouseCredits.get(couple.sourceKey), monthIndex, lower.fraMonthIndex, lower.fraMonths)
      const total = currentSpouseMonthlyUnderFamilyMaximum({
        workerPiaMonthly: higherGate.pia,
        workerDob: higher.dob,
        ownPiaMonthly: lowerGate.pia,
        ownActualMonthly: actualByPerson.get(lower.id) ?? 0,
        spouseFactor: spouseReductionFactorAtAgeMonths(lower.dob, spouseAgeMonths),
      })
      const arrangement = arrangementOf(lower.id)
      if (total > arrangement.total) {
        const own = ownDueByPerson.get(lower.id) ?? 0
        arrangement.total = total
        arrangement.ownPart = Math.min(own, total)
        arrangement.auxKind = 'spouse'
        arrangement.auxSourceKey = couple.sourceKey
        arrangement.auxWorkerId = higher.id
        arrangement.auxPeriodStart = lower.zero + couple.entitlementMonths
        arrangement.auxPeriodEnd = lower.fraMonthIndex
        arrangement.payingStreamId = lowerGate.streamId
        arrangement.payingSource = 'spousal'
      }
    }

    // After a death: the widow(er) benefit on the deceased's benefit, which
    // carries the deceased's own crediting months from his FRA month.
    for (const site of survivorSites) {
      if (month < site.payableFrom) continue
      const deceasedActual = actualByPerson.get(site.deceased.id) ?? 0
      if (deceasedActual <= 0) continue
      const survivorAgeMonths = creditedAgeMonths(site.entitlementMonths, survivorCredits.get(site.sourceKey), monthIndex, site.survivor.survivorFraMonthIndex, site.survivor.survivorFraMonths)
      const widow = survivorBenefitMonthly({
        deceasedPiaMonthly: site.deceasedPia,
        deceasedActualMonthly: deceasedActual,
        deceasedEverReduced: everReduced.has(site.deceased.id),
        survivorClaimAge: claimAgeFromTotalMonths(survivorAgeMonths),
        survivorFraMonths: site.survivor.survivorFraMonths,
      })
      const arrangement = arrangementOf(site.survivor.id)
      if (widow > arrangement.total) {
        const own = ownDueByPerson.get(site.survivor.id) ?? 0
        arrangement.total = widow
        arrangement.ownPart = Math.min(own, widow)
        arrangement.auxKind = 'survivor'
        arrangement.auxSourceKey = site.sourceKey
        arrangement.auxWorkerId = null
        arrangement.auxPeriodStart = site.survivor.zero + site.entitlementMonths
        arrangement.auxPeriodEnd = site.survivor.survivorFraMonthIndex
        arrangement.payingStreamId = site.survivorGate.streamId
        arrangement.payingSource = 'survivor'
      }
    }

    // A benefit on another record replaces the person's own benefits this month.
    ownSites.forEach((site, index) => {
      if (arrangements.get(site.person.id)?.payingStreamId != null) {
        siteDue[index] = 0
        siteActive[index] = false
      }
    })
    return { arrangements, siteDue, siteActive }
  }

  // The months a composition can change: a stream's first paying month, the
  // months both spouses are paid, and each full-retirement-age month.
  const boundaries = new Set<number>([0])
  const addBoundary = (month: number): void => {
    if (month > 0 && month < 12) boundaries.add(month)
  }
  for (const site of ownSites) addBoundary(site.payableFrom)
  for (const site of formerSites) addBoundary(site.payableFrom)
  if (couple !== null) addBoundary(couple.sharedFrom)
  for (const site of survivorSites) addBoundary(site.payableFrom)
  for (const facts of factsById.values()) {
    addBoundary(facts.fraMonthIndex - yearStart)
    addBoundary(facts.survivorFraMonthIndex - yearStart)
  }
  const segmentStarts = [...boundaries].sort((x, y) => x - y)
  const segmentOf = (month: number): number => {
    let index = 0
    while (index + 1 < segmentStarts.length && segmentStarts[index + 1]! <= month) index++
    return index
  }

  // The earnings test: each living person's excess, if anyone has one.
  const lower = pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth
  const higherExempt = pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth
  const tested: EarningsTestPerson[] = []
  for (const person of people) {
    const facts = factsOf(person.id)
    if (!facts.alive || ssdiByPerson.has(person.id)) continue
    const wages = wagesByPerson.get(person.id) ?? 0
    const excess = excessEarnings({ wages, fraMonthIndex: facts.fraMonthIndex, year, belowFraExemptAnnual: lower, fraYearExemptAnnual: higherExempt })
    tested.push({ id: person.id, excess, fraMonthIndex: facts.fraMonthIndex })
  }
  const anyExcess = tested.some((person) => person.excess > 0)

  // Compose each segment once, in order; with an excess, charge month by month
  // so the months credited before a full-retirement-age month price it.
  const compositions: MonthComposition[] = []
  const compositionFor = (month: number): MonthComposition => {
    const segment = segmentOf(month)
    while (compositions.length <= segment) compositions.push(compose(segmentStarts[compositions.length]!))
    return compositions[segment]!
  }
  const scale = (monthly: number): number => monthly * ssColaFactor * ssHaircutFactor
  let test: ReturnType<typeof earningsTestYear> | null = null
  if (anyExcess) {
    const workerId = couple !== null ? couple.higher.id : null
    test = earningsTestYear({
      year,
      people: tested,
      workerId,
      due: (month) => {
        const composition = compositionFor(month)
        const dues = new Map<string, EarningsTestMonthlyDue>()
        const monthIndex = yearStart + month
        for (const person of tested) {
          const arrangement = composition.arrangements.get(person.id)
          if (arrangement === undefined || arrangement.total <= 0) continue
          const facts = factsOf(person.id)
          const gate = gateByPerson.get(person.id)
          const ownStart = gate === undefined ? Infinity : claimStartMonthIndex(facts.dob, claimAgeTotalMonths(gate.claimAge))
          const own = scale(arrangement.ownPart)
          dues.set(person.id, {
            own,
            auxiliary: Math.max(0, scale(arrangement.total) - own),
            auxiliaryWorkerId: arrangement.auxWorkerId,
            ownEntitled: monthIndex >= ownStart,
            auxiliaryEntitled: arrangement.auxKind !== null && monthIndex >= arrangement.auxPeriodStart,
            ownInReductionPeriod: monthIndex >= ownStart && monthIndex < facts.fraMonthIndex,
            auxiliaryInReductionPeriod: arrangement.auxKind !== null && monthIndex >= arrangement.auxPeriodStart && monthIndex < arrangement.auxPeriodEnd,
          })
        }
        return dues
      },
      credit: (month, personId, benefit) => {
        if (benefit === 'own') {
          ownCredits.bump(personId)
          return
        }
        const arrangement = compositionFor(month).arrangements.get(personId)
        if (arrangement === undefined || arrangement.auxSourceKey === null) return
        if (arrangement.auxKind === 'survivor') survivorCredits.bump(arrangement.auxSourceKey)
        else spouseCredits.bump(arrangement.auxSourceKey)
      },
    })
  }
  for (let month = 0; month < 12; month++) compositionFor(month)

  // Each pay site's year: consecutive months with the same monthly due priced
  // as one product, (monthly × months × COLA) × haircut, as the ledger priced a
  // stream's paying months, so a year with no boundary is the ledger's product.
  const monthComposition = (month: number): MonthComposition => compositions[segmentOf(month)]!
  const runsProduct = (monthly: (month: number) => number): number => {
    let annual = 0
    let run = 0
    let length = 0
    for (let month = 0; month <= 12; month++) {
      const value = month < 12 ? monthly(month) : Number.NaN
      if (month < 12 && value === run) {
        length++
        continue
      }
      if (length > 0 && run !== 0) annual += run * length * ssColaFactor * ssHaircutFactor
      run = value
      length = 1
    }
    return annual
  }
  const siteAnnual = ownSites.map((_, index) => runsProduct((month) => monthComposition(month).siteDue[index]!))
  const replacementAnnual = (personId: string, streamId: string | null): number =>
    runsProduct((month) => {
      const arrangement = monthComposition(month).arrangements.get(personId)
      if (arrangement === undefined || arrangement.payingStreamId === null) return 0
      return streamId === null || arrangement.payingStreamId === streamId ? arrangement.total : 0
    })

  // Each person's year before the test: the own sites in plan order, then any
  // benefit on another record that replaced them.
  const preByPerson = new Map<string, number>()
  ownSites.forEach((site, index) => {
    if (site.kind === 'neverClaimed') return
    preByPerson.set(site.person.id, (preByPerson.get(site.person.id) ?? 0) + siteAnnual[index]!)
  })
  for (const person of people) {
    if (!factsOf(person.id).alive) continue
    const replaced = replacementAnnual(person.id, null)
    if (replaced !== 0 || preByPerson.has(person.id)) preByPerson.set(person.id, (preByPerson.get(person.id) ?? 0) + replaced)
  }

  // Each published stream's year, source and claim in force, by stream id (the
  // ledger's publication entries: a stream id shared by two people is one
  // entry, named by the first).
  const streamPre = new Map<string, number>()
  const streamSource = new Map<string, SocialSecurityBenefitSource>()
  const payingStreams = new Set<string>()
  for (let month = 0; month < 12; month++) {
    const composition = monthComposition(month)
    ownSites.forEach((site, index) => {
      if (!composition.siteActive[index]) return
      const ssdiMonths = ssdiSiteMonths.get(site.stream.id)
      streamSource.set(site.stream.id, ssdiMonths !== undefined && ssdiMonths.retirement <= 0 ? 'ssdi' : 'own-retirement')
    })
    for (const [personId, arrangement] of composition.arrangements) {
      if (arrangement.payingStreamId === null) continue
      payingStreams.add(arrangement.payingStreamId)
      for (const income of incomes) {
        if (income.type !== 'socialSecurity' || income.personId !== personId) continue
        if (!publicationOrder.includes(income.id)) publicationOrder.push(income.id)
        streamSource.set(income.id, income.id === arrangement.payingStreamId ? arrangement.payingSource! : 'none')
      }
    }
  }
  for (const streamId of publicationOrder) {
    let pre = 0
    ownSites.forEach((site, index) => {
      if (site.stream.id === streamId && site.person.alive && site.kind !== 'neverClaimed') pre += siteAnnual[index]!
    })
    for (const person of people) {
      if (factsOf(person.id).alive) pre += replacementAnnual(person.id, streamId)
    }
    streamPre.set(streamId, pre)
  }

  // The earnings test's result, and SGA for a disability beneficiary.
  const postByPerson = new Map<string, number>()
  const withheldByPerson = new Map<string, number>()
  let ssEarningsTestWithheld = 0
  let ssdiPaid = 0
  let anyWithheld = false
  for (const [personId, pre] of preByPerson) {
    if (!factsOf(personId).alive || pre <= 0) {
      postByPerson.set(personId, factsOf(personId).alive ? pre : 0)
      continue
    }
    const ssdi = ssdiByPerson.get(personId)
    if (ssdi) {
      let paid = pre
      if (ssdi.sgaApplies) {
        const wages = wagesByPerson.get(personId) ?? 0
        const annualSga = pack.socialSecurity.sgaMonthlyNonBlind * 12 * limitGrowth
        if (wages > 0 && ssdiSuspendedBySga(wages, annualSga)) {
          paid = 0
          warningValues.push(SGA_SUSPENDED_WARNING)
        }
      }
      // Only the disability months are SSDI; in the year that holds the FRA
      // month the months from it on are the converted old-age benefit.
      ssdiPaid += paid * ssdi.disabilityShare
      postByPerson.set(personId, paid)
      continue
    }
    const withheld = test?.withheldByPerson.get(personId) ?? 0
    if (withheld > 0) {
      const months = test!.paidByMonth.get(personId)!
      const paid = months.reduce((sum, value) => sum + value, 0)
      const post = paid <= 0 ? 0 : Math.max(0, pre - withheld)
      postByPerson.set(personId, post)
      withheldByPerson.set(personId, pre - post)
      ssEarningsTestWithheld += pre - post
      anyWithheld = true
    } else {
      postByPerson.set(personId, pre)
    }
  }
  if (anyWithheld) warningValues.push(EARNINGS_TEST_WITHHELD_WARNING)

  let socialSecurity = 0
  const paidByPerson = new Map<string, number>()
  for (const [personId, post] of postByPerson) {
    if (!factsOf(personId).alive) continue
    socialSecurity += post
    paidByPerson.set(personId, post)
  }
  for (const person of people) if (factsOf(person.id).alive && !paidByPerson.has(person.id)) paidByPerson.set(person.id, 0)

  // Published rows: each stream's share of its person's paid year.
  const preSumByPerson = new Map<string, number>()
  for (const streamId of publicationOrder) {
    const stream = incomes.find((income) => income.id === streamId)
    if (stream === undefined || stream.type !== 'socialSecurity') continue
    if (!factsOf(stream.personId).alive) continue
    preSumByPerson.set(stream.personId, (preSumByPerson.get(stream.personId) ?? 0) + (streamPre.get(streamId) ?? 0))
  }
  const socialSecurityStreams: SocialSecurityStreamActivity[] = []
  for (const income of incomes) {
    if (income.type !== 'socialSecurity') continue
    const alive = factsOf(income.personId).alive
    const resolved = resolvedPiaByStreamId.get(income.id) !== undefined
    const pre = alive ? (streamPre.get(income.id) ?? 0) : 0
    const source = alive ? (streamSource.get(income.id) ?? 'none') : 'none'
    const inForce = alive && (claimInForce.has(income.id) || payingStreams.has(income.id))
    if (!resolved && !((source === 'spousal' || source === 'survivor') && (pre > 0 || inForce))) {
      socialSecurityStreams.push({
        personId: income.personId, streamId: income.id, source: 'none', annualAmount: 0,
        claimInForce: false, preWithholdingAnnual: 0, isSpousalSurvivorGateStream: false,
      })
      continue
    }
    const preSum = preSumByPerson.get(income.personId) ?? 0
    const post = postByPerson.get(income.personId) ?? 0
    socialSecurityStreams.push({
      personId: income.personId,
      streamId: income.id,
      source,
      annualAmount: preSum > 0 ? pre * (post / preSum) : 0,
      claimInForce: inForce,
      preWithholdingAnnual: pre,
      isSpousalSurvivorGateStream: gateByPerson.get(income.personId)?.streamId === income.id,
    })
  }

  return {
    socialSecurity,
    socialSecurityStreams,
    ssEarningsTestWithheld,
    ssdiPaid,
    withheldMonthWrites: ownCredits.writes().map(({ key, value }) => ({ personId: key, value })),
    withheldSurvivorMonthWrites: survivorCredits.writes().map(({ key, value }) => ({ sourceKey: key, value })),
    withheldSpouseMonthWrites: spouseCredits.writes().map(({ key, value }) => ({ sourceKey: key, value })),
    warnings: warningValues,
    paidByPerson,
    withheldByPerson,
    excessChargedByPerson: test?.excessChargedByPerson ?? new Map(),
  }
}
