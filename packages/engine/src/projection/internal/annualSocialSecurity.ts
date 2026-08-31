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
import { claimFactor, spousalBenefitFactor, type ClaimAge } from '../../socialSecurity/claimFactor.js'
import { inSsdiWindow, ssdiMonthlyBenefit, ssdiSuspendedBySga } from '../../socialSecurity/disability.js'
import { capAuxiliaryForFamilyMaximum, claimAgeTotalMonths } from '../../socialSecurity/familyMaximum.js'
import { bestMaritalBenefit } from '../../socialSecurity/maritalBenefits.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from '../../socialSecurity/nra.js'
import { survivorBenefitMonthly } from '../../socialSecurity/survivorBenefit.js'
import type {
  SocialSecurityBenefitSource,
  SocialSecurityStreamActivity,
} from '../types.js'
import type { PersonYearState } from '../types.js'

export interface AnnualSocialSecurityInput {
  readonly incomes: readonly Readonly<IncomeStream>[]
  readonly people: readonly Readonly<Person>[]
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly resolvedPiaByStreamId: ReadonlyMap<string, number>
  readonly wagesByPerson: ReadonlyMap<string, number>
  readonly withheldMonthsByPerson: ReadonlyMap<string, number>
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
  readonly warnings: readonly string[]
}

function dobParts(person: Readonly<Person>): { y: number; m: number; d: number } {
  return {
    y: Number(person.dob.slice(0, 4)),
    m: Number(person.dob.slice(5, 7)),
    d: Number(person.dob.slice(8, 10)),
  }
}

function claimAgeFromTotalMonths(totalMonths: number): ClaimAge {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}

function payableMonthsAtAge(ageAttained: number, claimAge: ClaimAge): number {
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
    year,
    ssColaFactor,
    ssHaircutFactor,
    pack,
    limitGrowth,
  } = input
  const withheldMonthWrites: { personId: string; value: number }[] = []
  const warningValues: string[] = []

  const creditedClaimAgeFor = (
    person: Readonly<Person>,
    claimAge: ClaimAge,
    ageAttained: number,
    capMonths: number,
  ): ClaimAge => {
    const originalMonths = claimAgeTotalMonths(claimAge)
    if (originalMonths >= capMonths || ageAttained < Math.floor(capMonths / 12)) return claimAge
    const credited = Math.min(capMonths, originalMonths + (withheldMonthsByPerson.get(person.id) ?? 0))
    return claimAgeFromTotalMonths(credited)
  }

  const ssOwnByPerson = new Map<string, number>()
  const ssActualMonthlyByPerson = new Map<string, number>()
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
  const ssdiByPerson = new Map<string, { onsetAge: number; benefit: number; fraYears: number }>()

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
    const { y, m, d } = dobParts(person)
    const fra = fraForBirthYear(effectiveBirthYear(y, m, d))

    const onsetAge = stream.disability?.onsetAge
    if (onsetAge !== undefined && onsetAge < fra.years) {
      if (s.ageAttained >= onsetAge) {
        const monthly = ssdiMonthlyBenefit(pia)
        const annual = monthly * 12 * ssColaFactor * ssHaircutFactor
        ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
        ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
        ssdiByPerson.set(stream.personId, { onsetAge, benefit: annual, fraYears: fra.years })
        if (s.alive) {
          streamPub.claimInForce = true
          streamPub.preWithholdingAnnual += annual
          streamPub.source = s.ageAttained >= fra.years ? 'own-retirement' : 'ssdi'
        }
      }
      continue
    }

    const payableMonths = payableMonthsAtAge(s.ageAttained, stream.claimAge)
    if (payableMonths <= 0) continue
    const fraMonths = fraTotalMonths(fra)
    const claimForFactor = creditedClaimAgeFor(person, stream.claimAge, s.ageAttained, fraMonths)
    const factor = claimFactor(y, m, d, claimForFactor)
    const monthly = pia * factor
    let annual = monthly * payableMonths * ssColaFactor
    annual *= ssHaircutFactor
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
    const payableMonths = payableMonthsAtAge(s.ageAttained, stream.claimAge)
    if (!s.alive || payableMonths <= 0) continue
    const claimant = personById.get(stream.personId)!
    const { y, m, d } = dobParts(claimant)
    const retirementFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
    const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
    const best = bestMaritalBenefit(stream.formerSpouses, {
      claimantDob: { year: y, month: m, day: d },
      claimantClaimAge: creditedClaimAgeFor(claimant, stream.claimAge, s.ageAttained, retirementFraMonths),
      claimantSurvivorClaimAge: creditedClaimAgeFor(claimant, stream.claimAge, s.ageAttained, survivorFraMonths),
      claimantAge: s.ageAttained,
      year,
      claimantIsSingle: householdIsSingle,
    })
    if (best) {
      const annual = best.monthly * payableMonths * ssColaFactor * ssHaircutFactor
      if (annual > (ssOwnByPerson.get(stream.personId) ?? 0)) {
        ssOwnByPerson.set(stream.personId, annual)
        const maritalSource: SocialSecurityBenefitSource =
          best.kind === 'survivor' ? 'survivor' : 'spousal'
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
      const lowerState = stateOf(lower.p.id)
      const higherState = stateOf(higher.p.id)
      const lowerPayableMonths = payableMonthsAtAge(lowerState.ageAttained, lower.ss.claimAge)
      const higherPayableMonths = payableMonthsAtAge(higherState.ageAttained, higher.ss.claimAge)
      const spousalPayableMonths = Math.min(lowerPayableMonths, higherPayableMonths)
      if (lowerState.alive && higherState.alive && spousalPayableMonths > 0) {
        const { y, m, d } = dobParts(lower.p)
        const lowerFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
        const spousalClaimAge = creditedClaimAgeFor(lower.p, lower.ss.claimAge, lowerState.ageAttained, lowerFraMonths)
        const rawSpousalMonthly = 0.5 * higher.ss.pia * spousalBenefitFactor(y, m, d, spousalClaimAge)

        const higherDob = dobParts(higher.p)
        const workerActualMonthly =
          ssActualMonthlyByPerson.get(higher.p.id) ??
          higher.ss.pia *
            claimFactor(
              higherDob.y,
              higherDob.m,
              higherDob.d,
              creditedClaimAgeFor(
                higher.p,
                higher.ss.claimAge,
                higherState.ageAttained,
                fraTotalMonths(fraForBirthYear(effectiveBirthYear(higherDob.y, higherDob.m, higherDob.d))),
              ),
            )
        const lowerOwnMonthly = ssActualMonthlyByPerson.get(lower.p.id) ?? 0
        const excessSpousalMonthly = Math.max(0, rawSpousalMonthly - lowerOwnMonthly)
        const cappedExcessMonthly = capAuxiliaryForFamilyMaximum({
          workerPiaMonthly: higher.ss.pia,
          workerActualMonthly,
          workerDob: { year: higherDob.y, month: higherDob.m, day: higherDob.d },
          auxiliaryMonthly: excessSpousalMonthly,
        })
        const spousalTotalMonthly = lowerOwnMonthly + cappedExcessMonthly
        const spousalAnnual = spousalTotalMonthly * spousalPayableMonths * ssColaFactor * ssHaircutFactor
        const own = ssOwnByPerson.get(lower.p.id) ?? 0
        if (spousalAnnual > own) {
          ssOwnByPerson.set(lower.p.id, spousalAnnual)
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
      const payableMonths = payableMonthsAtAge(survivorState.ageAttained, survivorStream.claimAge)
      if (payableMonths <= 0) continue
      const ownBenefit = ssOwnByPerson.get(survivor.id) ?? 0
      const { y, m, d } = dobParts(survivor)
      const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
      const survivorClaimAge = creditedClaimAgeFor(survivor, survivorStream.claimAge, survivorState.ageAttained, survivorFraMonths)
      const survivorAnnual =
        survivorBenefitMonthly({
          deceasedPiaMonthly: deceasedPia,
          deceasedActualMonthly,
          survivorClaimAge,
          survivorFraMonths,
        }) *
        payableMonths *
        ssColaFactor *
        ssHaircutFactor
      if (survivorAnnual > ownBenefit) {
        ssOwnByPerson.set(survivor.id, survivorAnnual)
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
      if (inSsdiWindow(s.ageAttained, ssdi.onsetAge, ssdi.fraYears)) {
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
      ssdiPaid += paid
      continue
    }
    const wages = wagesByPerson.get(personId) ?? 0
    if (wages <= 0) continue
    const person = personById.get(personId)!
    const { y, m, d } = dobParts(person)
    const fraYears = fraForBirthYear(effectiveBirthYear(y, m, d)).years
    let withheld = 0
    if (s.ageAttained < fraYears) {
      withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth) / 2)
    } else if (s.ageAttained === fraYears) {
      withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth) / 3)
    }
    withheld = Math.min(withheld, benefit)
    if (withheld > 0) {
      ssOwnByPerson.set(personId, benefit - withheld)
      ssEarningsTestWithheld += withheld
      const claimAge = ssStreamByPerson.get(personId)?.claimAge
      const payableMonths = claimAge ? payableMonthsAtAge(s.ageAttained, claimAge) : 12
      const monthsWithheld = Math.min(payableMonths, Math.round((withheld / benefit) * payableMonths))
      withheldMonthWrites.push({
        personId,
        value: (withheldMonthsByPerson.get(personId) ?? 0) + monthsWithheld,
      })
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
    warnings: warningValues,
  }
}
