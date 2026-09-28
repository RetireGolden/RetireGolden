/**
 * Annual Social Security phase extracted from `simulatePlan`.
 *
 * The phase intentionally keeps plan-order iteration, last-write stream gates,
 * and the observable per-person insertion-order benefit fold. State effects
 * are returned explicitly and applied by the caller immediately after the
 * phase. Published stream rows are materialized once here and handed to the
 * caller unreconstructed.
 */
import type { IncomeStream, Person } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import { claimFactor, creditedAgeMonths, type ClaimAge } from '../../socialSecurity/claimFactor.js'
import {
  claimStartMonthIndex,
  spouseEntitlementAgeMonths,
  spouseReductionFactorAtAgeMonths,
} from '../../socialSecurity/dualEntitlement.js'
import {
  inSsdiWindow,
  ssdiMonthlyBenefit,
  ssdiMonthsInYear,
  ssdiSchedule,
  ssdiSuspendedBySga,
} from '../../socialSecurity/disability.js'
import { claimAgeTotalMonths, currentSpouseMonthlyUnderFamilyMaximum } from '../../socialSecurity/familyMaximum.js'
import { earningsTestWithheldAnnual } from '../../socialSecurity/earningsTest.js'
import { maritalBenefitFor, type MaritalBenefitCandidate } from '../../socialSecurity/maritalBenefits.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from '../../socialSecurity/nra.js'
import { neverClaimedDeceasedFactor, survivorBenefitMonthly, widowEntitlementAgeMonths } from '../../socialSecurity/survivorBenefit.js'
import { socialSecurityDobParts } from '../../socialSecurity/annualTiming.js'
import type {
  SocialSecurityBenefitSource,
  SocialSecurityStreamActivity,
} from '../types.js'
import type { PersonYearState } from '../types.js'

/**
 * The key of one auxiliary benefit's earnings-test month count: the claimant
 * and the record the benefit is paid on, a current spouse (`person`, that
 * person's id) or a former-spouse entry (`formerSpouse`, the entry's id).
 * 42 U.S.C. 402(q)(7) adjusts a benefit's reduction only for the months in
 * which "such benefit" was withheld, so each record keeps its own count.
 */
export function auxiliaryBenefitSourceKey(claimantId: string, kind: 'person' | 'formerSpouse', sourceId: string): string {
  return `${claimantId}|${kind}|${sourceId}`
}

export interface AnnualSocialSecurityInput {
  readonly incomes: readonly Readonly<IncomeStream>[]
  readonly people: readonly Readonly<Person>[]
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly resolvedPiaByStreamId: ReadonlyMap<string, number>
  readonly wagesByPerson: ReadonlyMap<string, number>
  readonly withheldMonthsByPerson: ReadonlyMap<string, number>
  /**
   * Of those months, the ones withheld while the person was paid a widow(er)
   * benefit, by the record it was paid on (#auxiliaryBenefitSourceKey). Only a
   * record's own months adjust that widow(er) reduction at the survivor FRA:
   * 42 U.S.C. 402(q)(7) excludes the months in which "such benefit" was
   * withheld, and neither an own benefit withheld before the death nor a
   * widow(er) benefit on another worker's record is that benefit.
   */
  readonly withheldSurvivorMonthsBySource: ReadonlyMap<string, number>
  /**
   * Of those months, the ones withheld while the person was paid a spouse
   * benefit (current or divorced), by the record it was paid on. Only a
   * record's own months adjust that spouse reduction at FRA, by the same
   * 402(q)(7) rule.
   */
  readonly withheldSpouseMonthsBySource: ReadonlyMap<string, number>
  readonly year: number
  readonly ssColaFactor: number
  readonly ssHaircutFactor: number
  readonly pack: Readonly<ParameterPack>
  readonly limitGrowth: number
}

export interface AnnualSocialSecurityResult {
  readonly socialSecurity: number
  readonly socialSecurityStreams: readonly SocialSecurityStreamActivity[]
  readonly ssEarningsTestWithheld: number
  readonly ssdiPaid: number
  readonly withheldMonthWrites: readonly {
    readonly personId: string
    readonly value: number
  }[]
  /** New running totals of `withheldSurvivorMonthsBySource`, applied by the caller. */
  readonly withheldSurvivorMonthWrites: readonly {
    readonly sourceKey: string
    readonly value: number
  }[]
  /** New running totals of `withheldSpouseMonthsBySource`, applied by the caller. */
  readonly withheldSpouseMonthWrites: readonly {
    readonly sourceKey: string
    readonly value: number
  }[]
  readonly warnings: readonly string[]
}

function claimAgeFromTotalMonths(totalMonths: number): ClaimAge {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
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

/** Annual-ledger approximation: a same-year claim pays only months after the claim month. */
export function annualSocialSecurityPayableMonths(
  ageAttained: number,
  claimAge: Readonly<ClaimAge>,
): number {
  if (ageAttained < claimAge.years) return 0
  if (ageAttained > claimAge.years) return 12
  return Math.max(0, 12 - claimAge.months)
}

export function annualSocialSecurity(
  input: AnnualSocialSecurityInput,
): AnnualSocialSecurityResult {
  const {
    incomes,
    people,
    personById,
    stateOf,
    resolvedPiaByStreamId,
    wagesByPerson,
    withheldMonthsByPerson,
    withheldSurvivorMonthsBySource,
    withheldSpouseMonthsBySource,
    year,
    ssColaFactor,
    ssHaircutFactor,
    pack,
    limitGrowth,
  } = input
  const withheldMonthWrites: { personId: string; value: number }[] = []
  const withheldSurvivorMonthWrites: { sourceKey: string; value: number }[] = []
  const withheldSpouseMonthWrites: { sourceKey: string; value: number }[] = []
  const warningValues: string[] = []

  const creditedClaimAgeFor = (
    person: Readonly<Person>,
    claimAge: ClaimAge,
    ageAttained: number,
    capMonths: number,
  ): ClaimAge => {
    const originalMonths = claimAgeTotalMonths(claimAge)
    const credited = creditedAgeMonths(originalMonths, withheldMonthsByPerson.get(person.id) ?? 0, ageAttained, capMonths)
    return credited === originalMonths ? claimAge : claimAgeFromTotalMonths(credited)
  }
  // The widow(er) reduction age after the ARF: only months withheld while the
  // widow(er) benefit on this record was paid are credited (402(q)(7)).
  const creditedSurvivorAgeFor = (sourceKey: string, entitlementMonths: number, ageAttained: number, survivorFraMonths: number): ClaimAge =>
    claimAgeFromTotalMonths(
      creditedAgeMonths(entitlementMonths, withheldSurvivorMonthsBySource.get(sourceKey) ?? 0, ageAttained, survivorFraMonths),
    )
  // The spouse reduction age after the ARF: only months withheld while the
  // spouse benefit on this record was paid are credited (402(q)(7)).
  const creditedSpouseAgeMonthsFor = (sourceKey: string, entitlementMonths: number, ageAttained: number, fraMonths: number): number =>
    creditedAgeMonths(entitlementMonths, withheldSpouseMonthsBySource.get(sourceKey) ?? 0, ageAttained, fraMonths)
  // Whose benefit this year is a widow(er) or a spouse benefit, and on which
  // record, for the earnings test's month counts: the last replacement below
  // decides it.
  const auxiliaryPaidByPerson = new Map<string, { kind: 'spouse' | 'survivor'; sourceKey: string }>()

  const ssOwnByPerson = new Map<string, number>()
  const ssActualMonthlyByPerson = new Map<string, number>()
  // People whose own old-age benefit was paid reduced for a claim before FRA:
  // only their survivors are held to the 402(e)(2)(D) limit (RIB-LIM).
  const ssEverReducedByPerson = new Set<string>()
  const ssStreamByPerson = new Map<string, {
    pia: number
    claimAge: { years: number; months: number }
    streamId: string
  }>()
  const ssStreamPub = new Map<string, {
    personId: string
    streamId: string
    source: SocialSecurityBenefitSource
    preWithholdingAnnual: number
    claimInForce: boolean
  }>()
  const ensureSsStreamPub = (streamId: string, personId: string) => {
    let entry = ssStreamPub.get(streamId)
    if (entry === undefined) {
      entry = {
        personId,
        streamId,
        source: 'none',
        preWithholdingAnnual: 0,
        claimInForce: false,
      }
      ssStreamPub.set(streamId, entry)
    }
    return entry
  }
  // Per person on a disability path this year: the share of the paid dollars
  // that are disability months (the rest are the converted old-age benefit
  // from the FRA month), over every such stream of the person, each weighted
  // by its own dollars so each counts its own months (a person may hold two
  // streams); those dollars; and whether the annual SGA test applies, which
  // every paying stream of one person agrees on, since they share the FRA month.
  const ssdiByPerson = new Map<string, { disabilityShare: number; ssdiAnnual: number; sgaApplies: boolean }>()

  for (const stream of incomes) {
    if (stream.type !== 'socialSecurity') continue
    const pia = resolvedPiaByStreamId.get(stream.id)
    if (pia === undefined) continue
    ssStreamByPerson.set(stream.personId, {
      pia,
      claimAge: stream.claimAge,
      streamId: stream.id,
    })
    const streamPub = ensureSsStreamPub(stream.id, stream.personId)
    const person = personById.get(stream.personId)!
    const s = stateOf(stream.personId)
    const { y, m, d } = socialSecurityDobParts(person)
    const fra = fraForBirthYear(effectiveBirthYear(y, m, d))

    // A disability onset replaces this stream's retirement-claim path when a
    // disability month is payable before the full-retirement-age month
    // (42 U.S.C. 423(a)(1), (c)(2)). When the first payable month is at or after
    // it, entitlement never begins: the stream is an ordinary retirement claim
    // at its claim age (or, for a worker who died before it, never claimed),
    // and the plan says which.
    const schedule = stream.disability === undefined
      ? null
      : ssdiSchedule({ year: y, month: m, day: d }, stream.disability)
    // A worker who died before the year his benefit would first have been paid
    // (his configured claim age, or the first month after the disability waiting
    // period) never claimed. His survivor is priced on the benefit he would upon
    // application have received for the month before his death (42 U.S.C.
    // 402(e)(2)(C)), from the first year after the death, whatever claim age the
    // plan configured. The ledger keeps a person alive through the whole year he
    // attains his life age, so December, the latest month that allows, is the
    // death month, and a waiting period that ends after it pays nothing.
    const firstPaidYear = schedule !== null
      ? Math.floor(schedule.firstPayableMonthIndex / 12)
      : y + stream.claimAge.years
    const deathYear = !s.alive && s.lifeAge !== undefined ? y + s.lifeAge : null
    const neverClaimed = deathYear !== null && firstPaidYear > deathYear
    if (stream.disability !== undefined && schedule === null) {
      warningValues.push(neverClaimed
        ? ssdiNotPayableBeforeFraNeverClaimedWarning(person.name)
        : ssdiNotPayableBeforeFraWarning(person.name))
    }
    if (neverClaimed) {
      const monthly = pia * neverClaimedDeceasedFactor({ year: y, month: m, day: d }, deathYear, 12)
      ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
      continue
    }

    if (schedule !== null) {
      // Disability months run from the first payable month to the month before
      // FRA; from the FRA month the same PIA is the converted old-age benefit
      // (402(a)(3)), with no new filing decision and no delayed credits.
      const months = ssdiMonthsInYear(schedule, year)
      const paidMonths = months.disability + months.retirement
      if (paidMonths > 0) {
        const monthly = ssdiMonthlyBenefit(pia)
        const annual = monthly * paidMonths * ssColaFactor * ssHaircutFactor
        // Keep computation rows for deceased workers as survivor anchors, but
        // publish only while alive. The published source is the benefit in
        // force at the end of the year: own retirement from the year that holds
        // the FRA month, whose disability months are in `ssdiPaid`.
        ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
        ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
        const share = months.disability / paidMonths
        const priorSsdi = ssdiByPerson.get(stream.personId)
        const ssdiAnnual = (priorSsdi?.ssdiAnnual ?? 0) + annual
        ssdiByPerson.set(stream.personId, {
          disabilityShare: priorSsdi === undefined || ssdiAnnual <= 0
            ? share
            : (priorSsdi.disabilityShare * priorSsdi.ssdiAnnual + share * annual) / ssdiAnnual,
          ssdiAnnual,
          sgaApplies: (priorSsdi?.sgaApplies ?? false) || inSsdiWindow(months),
        })
        if (s.alive) {
          streamPub.claimInForce = true
          streamPub.preWithholdingAnnual += annual
          streamPub.source = months.retirement > 0 ? 'own-retirement' : 'ssdi'
        }
      }
      continue
    }

    const payableMonths = annualSocialSecurityPayableMonths(s.ageAttained, stream.claimAge)
    if (payableMonths <= 0) continue
    const fraMonths = fraTotalMonths(fra)
    if (claimAgeTotalMonths(stream.claimAge) < fraMonths) ssEverReducedByPerson.add(stream.personId)
    const claimForFactor = creditedClaimAgeFor(person, stream.claimAge, s.ageAttained, fraMonths)
    const factor = claimFactor(y, m, d, claimForFactor)
    const monthly = pia * factor
    let annual = monthly * payableMonths * ssColaFactor
    annual *= ssHaircutFactor
    // Deceased workers remain in computation maps for survivor pricing; only
    // the per-stream publication row is gated on the worker being alive.
    ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
    ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
    if (s.alive) {
      streamPub.claimInForce = true
      streamPub.preWithholdingAnnual += annual
      streamPub.source = 'own-retirement'
    }
  }

  const householdIsSingle = people.length === 1
  for (const stream of incomes) {
    if (stream.type !== 'socialSecurity') continue
    if (!stream.formerSpouses || stream.formerSpouses.length === 0) continue
    const s = stateOf(stream.personId)
    const payableMonths = annualSocialSecurityPayableMonths(s.ageAttained, stream.claimAge)
    if (!s.alive || payableMonths <= 0) continue
    const claimant = personById.get(stream.personId)!
    const { y, m, d } = socialSecurityDobParts(claimant)
    const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
    // The largest candidate across the records, as bestMaritalBenefit picks it
    // (the first of equal amounts), each credited with its own record's
    // earnings-test months.
    let best: (MaritalBenefitCandidate & { sourceKey: string }) | null = null
    for (const record of stream.formerSpouses) {
      const sourceKey = auxiliaryBenefitSourceKey(stream.personId, 'formerSpouse', record.id)
      const candidate = maritalBenefitFor(record, {
        claimantDob: { year: y, month: m, day: d },
        claimantClaimAge: stream.claimAge,
        // A divorced spouse's benefit is the own benefit plus the reduced excess
        // (402(k)(3)(A)), so the menu takes the claimant's own PIA and benefit.
        claimantOwnPiaMonthly: ssStreamByPerson.get(stream.personId)?.pia ?? 0,
        claimantOwnActualMonthly: ssActualMonthlyByPerson.get(stream.personId) ?? 0,
        claimantSpouseWithheldMonths: withheldSpouseMonthsBySource.get(sourceKey) ?? 0,
        // A former spouse's death date is not in the plan; the widow(er) benefit is
        // taken to start with the claimant's own claim, after that death.
        claimantSurvivorClaimAge: creditedSurvivorAgeFor(sourceKey, claimAgeTotalMonths(stream.claimAge), s.ageAttained, survivorFraMonths),
        claimantAge: s.ageAttained,
        year,
        claimantIsSingle: householdIsSingle,
      })
      if (candidate && (best === null || candidate.monthly > best.monthly)) best = { ...candidate, sourceKey }
    }
    if (best) {
      const annual = best.monthly * payableMonths * ssColaFactor * ssHaircutFactor
      if (annual > (ssOwnByPerson.get(stream.personId) ?? 0)) {
        ssOwnByPerson.set(stream.personId, annual)
        const maritalSource: SocialSecurityBenefitSource =
          best.kind === 'survivor' ? 'survivor' : 'spousal'
        auxiliaryPaidByPerson.set(stream.personId, { kind: maritalSource === 'survivor' ? 'survivor' : 'spouse', sourceKey: best.sourceKey })
        const paying = ensureSsStreamPub(stream.id, stream.personId)
        paying.preWithholdingAnnual = annual
        paying.source = maritalSource
        paying.claimInForce = true
        for (const entry of ssStreamPub.values()) {
          if (entry.personId !== stream.personId || entry.streamId === stream.id) continue
          entry.preWithholdingAnnual = 0
          entry.source = 'none'
        }
      }
    }
  }

  if (people.length === 2) {
    const [a, b] = people
    const aSs = ssStreamByPerson.get(a!.id)
    const bSs = ssStreamByPerson.get(b!.id)
    if (aSs && bSs) {
      const higher = aSs.pia >= bSs.pia ? { p: a!, ss: aSs } : { p: b!, ss: bSs }
      const lower = aSs.pia >= bSs.pia ? { p: b!, ss: bSs } : { p: a!, ss: aSs }
      const spouseSourceKey = auxiliaryBenefitSourceKey(lower.p.id, 'person', higher.p.id)
      const lowerState = stateOf(lower.p.id)
      const higherState = stateOf(higher.p.id)
      const lowerPayableMonths = annualSocialSecurityPayableMonths(lowerState.ageAttained, lower.ss.claimAge)
      const higherPayableMonths = annualSocialSecurityPayableMonths(higherState.ageAttained, higher.ss.claimAge)
      const spousalPayableMonths = Math.min(lowerPayableMonths, higherPayableMonths)
      if (lowerState.alive && higherState.alive && spousalPayableMonths > 0) {
        const { y, m, d } = socialSecurityDobParts(lower.p)
        const lowerDob = { year: y, month: m, day: d }
        const lowerFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))

        const higherDob = socialSecurityDobParts(higher.p)
        // The spouse benefit starts in the later of the lower earner's own claim
        // month and the month the worker's benefit starts (deemed filing, 402(r)),
        // and is reduced for the lower earner's age then (402(q)(6)(A)(ii)).
        const spouseAgeMonths = creditedSpouseAgeMonthsFor(
          spouseSourceKey,
          spouseEntitlementAgeMonths(
            lowerDob,
            claimAgeTotalMonths(lower.ss.claimAge),
            claimStartMonthIndex(
              { year: higherDob.y, month: higherDob.m, day: higherDob.d },
              claimAgeTotalMonths(higher.ss.claimAge),
            ),
          ),
          lowerState.ageAttained,
          lowerFraMonths,
        )
        // Own benefit plus the separately reduced excess (402(q)(3)(B), (k)(3)(A)),
        // with half the worker's PIA held first to the family maximum room above
        // his PIA (20 CFR 404.404, 404.410(b)), whatever the worker is paid; the
        // lower earner's own benefit stays on that person's record unchanged.
        const lowerOwnMonthly = ssActualMonthlyByPerson.get(lower.p.id) ?? 0
        const spousalTotalMonthly = currentSpouseMonthlyUnderFamilyMaximum({
          workerPiaMonthly: higher.ss.pia,
          workerDob: { year: higherDob.y, month: higherDob.m, day: higherDob.d },
          ownPiaMonthly: lower.ss.pia,
          ownActualMonthly: lowerOwnMonthly,
          spouseFactor: spouseReductionFactorAtAgeMonths(lowerDob, spouseAgeMonths),
        })
        const spousalAnnual = spousalTotalMonthly * spousalPayableMonths * ssColaFactor * ssHaircutFactor
        const own = ssOwnByPerson.get(lower.p.id) ?? 0
        if (spousalAnnual > own) {
          ssOwnByPerson.set(lower.p.id, spousalAnnual)
          auxiliaryPaidByPerson.set(lower.p.id, { kind: 'spouse', sourceKey: spouseSourceKey })
          const gateStreamId = lower.ss.streamId
          for (const entry of ssStreamPub.values()) {
            if (entry.personId !== lower.p.id) continue
            if (entry.streamId === gateStreamId) {
              entry.preWithholdingAnnual = spousalAnnual
              entry.source = 'spousal'
              entry.claimInForce = true
            } else {
              entry.preWithholdingAnnual = 0
              entry.source = 'none'
            }
          }
        }
      }
    }
  }

  if (people.length === 2) {
    const [a, b] = people
    for (const [deceased, survivor] of [
      [a!, b!],
      [b!, a!],
    ] as const) {
      const survivorState = stateOf(survivor.id)
      if (stateOf(deceased.id).alive || !survivorState.alive) continue
      const survivorStream = ssStreamByPerson.get(survivor.id)
      const deceasedPia = ssStreamByPerson.get(deceased.id)?.pia
      const deceasedActualMonthly = ssActualMonthlyByPerson.get(deceased.id) ?? 0
      if (!survivorStream || deceasedPia === undefined || deceasedActualMonthly <= 0) continue
      const payableMonths = annualSocialSecurityPayableMonths(survivorState.ageAttained, survivorStream.claimAge)
      if (payableMonths <= 0) continue
      const ownBenefit = ssOwnByPerson.get(survivor.id) ?? 0
      const { y, m, d } = socialSecurityDobParts(survivor)
      const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
      // The widow(er) benefit is reduced for the months from its own first month
      // of entitlement, not from the survivor's earlier own claim (402(q)(6)(A)(iii),
      // 402(q)(3)(E)): the later of that claim and January after the year of death,
      // the first month the ledger pays it. The death year is the last year the
      // ledger keeps the deceased alive; a caller whose person-year state carries
      // no life age cannot place it, and the reduction then starts at the
      // survivor's own claim.
      const deceasedLifeAge = stateOf(deceased.id).lifeAge
      const ownClaimMonths = claimAgeTotalMonths(survivorStream.claimAge)
      const entitlementMonths = deceasedLifeAge !== undefined
        ? widowEntitlementAgeMonths(
          { year: y, month: m, day: d },
          socialSecurityDobParts(deceased).y + deceasedLifeAge,
          ownClaimMonths,
        )
        : ownClaimMonths
      const survivorSourceKey = auxiliaryBenefitSourceKey(survivor.id, 'person', deceased.id)
      const survivorClaimAge = creditedSurvivorAgeFor(survivorSourceKey, entitlementMonths, survivorState.ageAttained, survivorFraMonths)
      const survivorAnnual =
        survivorBenefitMonthly({
          deceasedPiaMonthly: deceasedPia,
          deceasedActualMonthly,
          deceasedEverReduced: ssEverReducedByPerson.has(deceased.id),
          survivorClaimAge,
          survivorFraMonths,
        }) *
        payableMonths *
        ssColaFactor *
        ssHaircutFactor
      if (survivorAnnual > ownBenefit) {
        ssOwnByPerson.set(survivor.id, survivorAnnual)
        auxiliaryPaidByPerson.set(survivor.id, { kind: 'survivor', sourceKey: survivorSourceKey })
        const gateStreamId = survivorStream.streamId
        for (const entry of ssStreamPub.values()) {
          if (entry.personId !== survivor.id) continue
          if (entry.streamId === gateStreamId) {
            entry.preWithholdingAnnual = survivorAnnual
            entry.source = 'survivor'
            entry.claimInForce = true
          } else {
            entry.preWithholdingAnnual = 0
            entry.source = 'none'
          }
        }
      }
    }
  }

  let ssEarningsTestWithheld = 0
  let ssdiPaid = 0
  for (const [personId, benefit] of ssOwnByPerson) {
    const s = stateOf(personId)
    if (!s.alive || benefit <= 0) continue
    const ssdi = ssdiByPerson.get(personId)
    if (ssdi) {
      let paid = benefit
      if (ssdi.sgaApplies) {
        const wages = wagesByPerson.get(personId) ?? 0
        const annualSga = pack.socialSecurity.sgaMonthlyNonBlind * 12 * limitGrowth
        if (wages > 0 && ssdiSuspendedBySga(wages, annualSga)) {
          paid = 0
          ssOwnByPerson.set(personId, 0)
          warningValues.push(
            'Earnings above Substantial Gainful Activity (SGA) suspended Social Security disability (SSDI) for a working year.',
          )
        }
      }
      // Only the disability months are SSDI; in the year that holds the FRA
      // month the months from it on are the converted old-age benefit, each
      // stream by its own months (the dollar-weighted share above).
      ssdiPaid += paid * ssdi.disabilityShare
      continue
    }
    const wages = wagesByPerson.get(personId) ?? 0
    if (wages <= 0) continue
    const person = personById.get(personId)!
    const { y, m, d } = socialSecurityDobParts(person)
    const fraYears = fraForBirthYear(effectiveBirthYear(y, m, d)).years
    const withheld = earningsTestWithheldAnnual({
      ageAttained: s.ageAttained,
      fraYears,
      wages,
      benefit,
      belowFraExemptAnnual: pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth,
      fraYearExemptAnnual: pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth,
    })
    if (withheld > 0) {
      ssOwnByPerson.set(personId, benefit - withheld)
      ssEarningsTestWithheld += withheld
      // ARF credits are capped by months actually payable in this year, so a
      // midyear first claim cannot earn credit for all twelve months.
      const claimAge = ssStreamByPerson.get(personId)?.claimAge
      const payableMonths = claimAge
        ? annualSocialSecurityPayableMonths(s.ageAttained, claimAge)
        : 12
      const monthsWithheld = Math.min(payableMonths, Math.round((withheld / benefit) * payableMonths))
      withheldMonthWrites.push({
        personId,
        value: (withheldMonthsByPerson.get(personId) ?? 0) + monthsWithheld,
      })
      const auxiliaryPaid = auxiliaryPaidByPerson.get(personId)
      if (auxiliaryPaid?.kind === 'survivor' && monthsWithheld > 0) {
        withheldSurvivorMonthWrites.push({
          sourceKey: auxiliaryPaid.sourceKey,
          value: (withheldSurvivorMonthsBySource.get(auxiliaryPaid.sourceKey) ?? 0) + monthsWithheld,
        })
      }
      if (auxiliaryPaid?.kind === 'spouse' && monthsWithheld > 0) {
        withheldSpouseMonthWrites.push({
          sourceKey: auxiliaryPaid.sourceKey,
          value: (withheldSpouseMonthsBySource.get(auxiliaryPaid.sourceKey) ?? 0) + monthsWithheld,
        })
      }
      warningValues.push(
        'The earnings test withheld benefits for working early claimants; withheld months are credited back at full retirement age (annual approximation).',
      )
    }
  }

  let socialSecurity = 0
  for (const [personId, benefit] of ssOwnByPerson) {
    if (stateOf(personId).alive) socialSecurity += benefit
  }

  const postWithholdingByPerson = new Map<string, number>()
  for (const person of people) {
    postWithholdingByPerson.set(
      person.id,
      stateOf(person.id).alive ? (ssOwnByPerson.get(person.id) ?? 0) : 0,
    )
  }
  const preWithholdingSumByPerson = new Map<string, number>()
  for (const entry of ssStreamPub.values()) {
    preWithholdingSumByPerson.set(
      entry.personId,
      (preWithholdingSumByPerson.get(entry.personId) ?? 0) + entry.preWithholdingAnnual,
    )
  }
  const socialSecurityStreams: SocialSecurityStreamActivity[] = []
  for (const stream of incomes) {
    if (stream.type !== 'socialSecurity') continue
    const resolved = resolvedPiaByStreamId.get(stream.id) !== undefined
    const entry = ssStreamPub.get(stream.id)
    if (!resolved) {
      const auxPaid =
        entry !== undefined &&
        (entry.source === 'spousal' || entry.source === 'survivor') &&
        (entry.preWithholdingAnnual > 0 || entry.claimInForce)
      if (!auxPaid) {
        socialSecurityStreams.push({
          personId: stream.personId,
          streamId: stream.id,
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: false,
        })
        continue
      }
    }
    const pub = entry ?? ensureSsStreamPub(stream.id, stream.personId)
    const gateStreamId = ssStreamByPerson.get(stream.personId)?.streamId
    const preSum = preWithholdingSumByPerson.get(stream.personId) ?? 0
    const post = postWithholdingByPerson.get(stream.personId) ?? 0
    const annualAmount = preSum > 0
      ? pub.preWithholdingAnnual * (post / preSum)
      : 0
    socialSecurityStreams.push({
      personId: stream.personId,
      streamId: stream.id,
      source: pub.source,
      annualAmount,
      claimInForce: pub.claimInForce,
      preWithholdingAnnual: pub.preWithholdingAnnual,
      isSpousalSurvivorGateStream: gateStreamId === stream.id,
    })
  }

  return {
    socialSecurity,
    socialSecurityStreams,
    ssEarningsTestWithheld,
    ssdiPaid,
    withheldMonthWrites,
    withheldSurvivorMonthWrites,
    withheldSpouseMonthWrites,
    warnings: warningValues,
  }
}
