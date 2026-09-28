/**
 * The benefits-only expected present value of Social Security: each future
 * year's benefits, weighted by the chance of being alive to receive them and
 * discounted to today at a real rate, for one claimant or a couple, and the
 * ranking of every whole-year claim-age combination by it.
 *
 * Each year's benefit is priced by the ledger's own Social Security rules
 * (owner decision R7): the claim factor with its months and the ledger's
 * payable months in the claim year; for a single claimant, the largest
 * former-spouse benefit the ledger would pay (socialSecurity/maritalBenefits.ts);
 * for a couple while both are alive, the lower earner's own benefit plus the
 * separately reduced spouse excess from the month the spouse benefit starts
 * (socialSecurity/dualEntitlement.ts, capped by the worker's family maximum as
 * the ledger caps it); and after a death, the survivor's own benefit or the
 * widow(er) benefit, whichever is larger, on the deceased's actual benefit
 * (or, for a worker who died before claiming, the benefit for the month before
 * the death), reduced for the survivor's age in the first month of widow(er)
 * entitlement and then held to the widow's limit when the deceased's benefit
 * was reduced (socialSecurity/survivorBenefit.ts). Survival is the engine's one
 * curve (montecarlo/survival.ts#survivalCurve), with independent lives. The
 * year's benefits are scaled by the ledger's cost-of-living factor over its
 * inflation factor and by the trust-fund haircut, so a COLA below inflation or
 * a haircut lowers the real value (1 when the COLA matches inflation and there
 * is no haircut).
 *
 * @see DOCS/calculations/social-security/social-security-expected-value.md
 */
import type { Assumptions, FormerSpouse, Plan } from '../../model/plan.js'
import { survivalCurve } from '../../montecarlo/survival.js'
import type { Sex } from '../../montecarlo/mortality.js'
import { annualSocialSecurityPayableMonths } from '../../projection/internal/annualSocialSecurity.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import { claimFactor, type ClaimAge } from '../claimFactor.js'
import { socialSecurityColaFactor, socialSecurityHaircutFactor } from '../colaFactor.js'
import {
  claimStartMonthIndex,
  spouseEntitlementAgeMonths,
  spouseReductionFactorAtAgeMonths,
} from '../dualEntitlement.js'
import { claimAgeTotalMonths, currentSpouseMonthlyUnderFamilyMaximum } from '../familyMaximum.js'
import { bestMaritalBenefit } from '../maritalBenefits.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear, type DobParts } from '../nra.js'
import { neverClaimedDeceasedFactor, survivorBenefitMonthly, widowEntitlementAgeMonths } from '../survivorBenefit.js'
import { planInflationFactorFrom } from './breakEven.js'
import { benefitsOnlyClaimAges, disabilityReplacesClaimAge, socialSecurityClaimants, type SocialSecurityClaimant } from './claimants.js'

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
  /** Former-spouse records; priced for a single claimant only. */
  readonly formerSpouses?: readonly FormerSpouse[]
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

/**
 * The claimant's monthly benefit in a year the claim is in force: the own
 * benefit, or a larger former-spouse benefit the ledger would pay that year.
 */
function singleMonthly(
  claimant: ExpectedValueClaimant,
  ownMonthly: number,
  age: number,
  year: number,
  householdSingle: boolean,
): number {
  if (!claimant.formerSpouses || claimant.formerSpouses.length === 0) return ownMonthly
  const best = bestMaritalBenefit([...claimant.formerSpouses], {
    claimantDob: { year: claimant.dob.year, month: claimant.dob.month, day: claimant.dob.day },
    claimantClaimAge: claimant.claimAge,
    claimantOwnPiaMonthly: claimant.piaMonthly,
    claimantOwnActualMonthly: ownMonthly,
    claimantAge: age,
    year,
    claimantIsSingle: householdSingle,
  })
  return best !== null && best.monthly > ownMonthly ? best.monthly : ownMonthly
}

/**
 * The benefits one claimant is paid in `year` (its payable months times the
 * monthly benefit of #singleMonthly), in start-year dollars before the COLA
 * drift and haircut; 0 before the claim year.
 */
export function singleBenefitInYear(
  claimant: ExpectedValueClaimant,
  household: { readonly single: boolean },
  year: number,
): number {
  const age = year - claimant.dob.year
  const months = annualSocialSecurityPayableMonths(age, claimant.claimAge)
  if (months <= 0) return 0
  const own = claimant.piaMonthly * claimFactor(claimant.dob.year, claimant.dob.month, claimant.dob.day, claimant.claimAge)
  return singleMonthly(claimant, own, age, year, household.single) * months
}

/**
 * Expected present value of one claimant's benefits: Σ over years t from the
 * start year while the claimant is at most 119, of S(t) × monthly(t) ×
 * payableMonths(t) × scale(y) × (1 + r)^−t, with S the engine's survival
 * curve from the current age, monthly the own benefit (claim factor with
 * months) or a larger former-spouse benefit the ledger would pay that year
 * (the divorced-spouse benefit only when `household.single`), and scale the
 * real COLA drift and haircut.
 */
export function expectedPvSingle(
  claimant: ExpectedValueClaimant,
  household: { readonly single: boolean },
  options: ExpectedValueOptions,
): number {
  checkRate(options.discountRate)
  const x = currentAgeOf(claimant.dob, options.startYear)
  const curve = survivalCurve(x, claimant.sex)
  const scale = realBenefitScale(options, options.startYear + Math.max(0, LAST_TABLE_AGE - x))
  let pv = 0
  for (let t = 0; x + t <= LAST_TABLE_AGE; t++) {
    const year = options.startYear + t
    const paid = singleBenefitInYear(claimant, household, year)
    if (paid <= 0) continue
    pv += curve.survivalTo(t) * paid * scale(year) * Math.pow(1 + options.discountRate, -t)
  }
  return pv
}

interface CouplePerson {
  readonly claimant: ExpectedValueClaimant
  readonly x: number
  readonly claimMonths: number
  readonly fraMonths: number
  readonly survivorFraMonths: number
  readonly own: number
  readonly everReduced: boolean
}

function couplePerson(claimant: ExpectedValueClaimant, startYear: number): CouplePerson {
  const { dob } = claimant
  const effectiveYear = effectiveBirthYear(dob.year, dob.month, dob.day)
  const claimMonths = claimAgeTotalMonths(claimant.claimAge)
  const fraMonths = fraTotalMonths(fraForBirthYear(effectiveYear))
  return {
    claimant,
    x: currentAgeOf(dob, startYear),
    claimMonths,
    fraMonths,
    survivorFraMonths: fraTotalMonths(survivorFraForBirthYear(effectiveYear)),
    own: claimant.piaMonthly * claimFactor(dob.year, dob.month, dob.day, claimant.claimAge),
    everReduced: claimMonths < fraMonths,
  }
}

/**
 * The survivor's monthly widow(er) benefit on the deceased's record when the
 * deceased dies in `deathYear` (alive through it, the ledger's convention): on
 * the deceased's claimed benefit if the deceased's claim year had come, else
 * on the benefit for the month before a December death; reduced for the
 * survivor's age in the first month of entitlement, the later of the
 * survivor's own claim and January after the death; the widow's limit applies
 * only to a deceased who claimed before full retirement age.
 */
function widowMonthly(survivor: CouplePerson, deceased: CouplePerson, deathYear: number): number {
  const deathAge = deathYear - deceased.claimant.dob.year
  const claimed = deceased.claimant.claimAge.years <= deathAge
  const actual = claimed
    ? deceased.own
    : deceased.claimant.piaMonthly * neverClaimedDeceasedFactor(deceased.claimant.dob, deathYear, 12)
  if (actual <= 0) return 0
  const entitlementMonths = widowEntitlementAgeMonths(survivor.claimant.dob, deathYear, survivor.claimMonths)
  return survivorBenefitMonthly({
    deceasedPiaMonthly: deceased.claimant.piaMonthly,
    deceasedActualMonthly: actual,
    deceasedEverReduced: claimed && deceased.everReduced,
    survivorClaimAge: { years: Math.floor(entitlementMonths / 12), months: entitlementMonths % 12 },
    survivorFraMonths: survivor.survivorFraMonths,
  })
}

/**
 * Expected present value of a couple's benefits under a pair of claim ages,
 * with independent lives on the engine's survival curve:
 *
 *   EV = Σ_t (1 + r)^−t × scale(y) × [ S_A(t) S_B(t) both(t)
 *        + Σ_{k<t} S_A(t) D_B(k) alone_A(t, k) + Σ_{k<t} S_B(t) D_A(k) alone_B(t, k) ]
 *
 * where D(k) is the probability of dying in year k (alive through year k, the
 * ledger's death convention), both(t) is each person's own benefit for the
 * year's payable months with the lower earner (by PIA; the second person on a
 * tie, as the ledger) paid the own benefit plus the reduced spouse excess for
 * the months both are paid, and alone_s(t, k) is the survivor's payable months
 * times the larger of the own benefit and the widow(er) benefit on the
 * deceased's record, paid from the year after the death. Former-spouse records
 * of a person in a couple are not priced.
 */
export function expectedPvCouple(
  a: ExpectedValueClaimant,
  b: ExpectedValueClaimant,
  options: ExpectedValueOptions,
): number {
  checkRate(options.discountRate)
  const { startYear } = options
  const people = [couplePerson(a, startYear), couplePerson(b, startYear)] as const
  const higherIndex = a.piaMonthly >= b.piaMonthly ? 0 : 1
  const higher = people[higherIndex]
  const lower = people[1 - higherIndex]!
  const curves = [survivalCurve(people[0].x, a.sex), survivalCurve(people[1].x, b.sex)] as const
  const lastT = Math.max(LAST_TABLE_AGE - people[0].x, LAST_TABLE_AGE - people[1].x, 0)
  const scale = realBenefitScale(options, startYear + lastT)

  // The spouse benefit's first month, the lower earner's age then, and the
  // lower earner's monthly total while both are paid: the ledger's own
  // composition, half the worker's PIA held first to the family maximum less
  // that PIA (20 CFR 404.404, 404.410(b)), then own plus the reduced excess.
  const spouseAgeMonths = spouseEntitlementAgeMonths(
    lower.claimant.dob,
    lower.claimMonths,
    claimStartMonthIndex(higher.claimant.dob, higher.claimMonths),
  )
  const lowerTotalMonthly = currentSpouseMonthlyUnderFamilyMaximum({
    workerPiaMonthly: higher.claimant.piaMonthly,
    workerDob: higher.claimant.dob,
    ownPiaMonthly: lower.claimant.piaMonthly,
    ownActualMonthly: lower.own,
    spouseFactor: spouseReductionFactorAtAgeMonths(lower.claimant.dob, spouseAgeMonths),
  })

  // The widow(er) monthly for each survivor by the deceased's death year k.
  const widowByDeath = [0, 1].map((s) => {
    const survivor = people[s]!
    const deceased = people[1 - s]!
    const byK: number[] = []
    for (let k = 0; k < lastT; k++) byK.push(widowMonthly(survivor, deceased, startYear + k))
    return byK
  })
  const deathProbability = [0, 1].map((d) => {
    const byK: number[] = []
    for (let k = 0; k < lastT; k++) byK.push(curves[d]!.deathProbabilityInYear(k))
    return byK
  })

  let pv = 0
  for (let t = 0; t <= lastT; t++) {
    const year = startYear + t
    const payable = people.map((p) => annualSocialSecurityPayableMonths(p.x + t, p.claimant.claimAge))
    // Both alive.
    const both = people.map((p, i) => {
      const months = payable[i]!
      if (months <= 0) return 0
      if (p === lower) {
        const shared = Math.min(months, payable[higherIndex]!)
        return lowerTotalMonthly * shared + p.own * (months - shared)
      }
      return p.own * months
    })
    const alive = [curves[0].survivalTo(t), curves[1].survivalTo(t)]
    let expected = alive[0]! * alive[1]! * (both[0]! + both[1]!)
    // One survivor s, the other d died in an earlier year k.
    for (let s = 0; s < 2; s++) {
      const months = payable[s]!
      if (alive[s]! <= 0 || months <= 0) continue
      const own = people[s]!.own
      const d = 1 - s
      let weighted = 0
      for (let k = 0; k < t; k++) {
        const died = deathProbability[d]![k]!
        if (died <= 0) continue
        weighted += died * Math.max(own, widowByDeath[s]![k]!)
      }
      expected += alive[s]! * weighted * months
    }
    pv += expected * scale(year) * Math.pow(1 + options.discountRate, -t)
  }
  return pv
}

export interface BenefitsPvRow {
  /** Whole-year claim age by person id. */
  readonly claimByPersonId: Readonly<Record<string, number>>
  readonly expectedPv: number
}

export interface BenefitsOnlyRanking {
  readonly personIds: readonly string[]
  readonly rows: readonly BenefitsPvRow[]
  /** The rows by expected value, highest first. */
  readonly ranked: readonly BenefitsPvRow[]
  /** People whose benefit is a disability benefit from its onset; when any, nothing is ranked. */
  readonly disabilityPersonIds: readonly string[]
}

function claimantOf(entry: SocialSecurityClaimant, claimYears: number): ExpectedValueClaimant {
  const { y, m, d } = socialSecurityDobParts(entry.person)
  return {
    dob: { year: y, month: m, day: d },
    sex: entry.person.sex,
    piaMonthly: entry.piaMonthly,
    claimAge: { years: claimYears, months: 0 },
    formerSpouses: entry.stream.formerSpouses ?? [],
  }
}

/**
 * The expected value of every whole-year claim-age combination for the plan's
 * one or two claimants (#benefitsOnlyClaimAges each), ranked highest first. A
 * claimant whose benefit the ledger pays as a disability benefit from its onset
 * is named and nothing is ranked, since the claim age would not start it.
 */
export function benefitsOnlyRanking(plan: Plan, discountRate: number, startYear: number): BenefitsOnlyRanking {
  const claimants = socialSecurityClaimants(plan, startYear)
  const personIds = claimants.map((entry) => entry.person.id)
  const disabilityPersonIds = claimants.filter((entry) => disabilityReplacesClaimAge(entry.stream, entry.person)).map((entry) => entry.person.id)
  if (disabilityPersonIds.length > 0 || claimants.length === 0 || claimants.length > 2) {
    return { personIds, rows: [], ranked: [], disabilityPersonIds }
  }
  const options: ExpectedValueOptions = { startYear, discountRate, assumptions: plan.assumptions }
  const rows: BenefitsPvRow[] = []
  if (claimants.length === 1) {
    const entry = claimants[0]!
    const household = { single: plan.household.people.length === 1 }
    for (const age of benefitsOnlyClaimAges(entry.person, startYear)) {
      rows.push({ claimByPersonId: { [entry.person.id]: age }, expectedPv: expectedPvSingle(claimantOf(entry, age), household, options) })
    }
  } else {
    const [first, second] = claimants as [SocialSecurityClaimant, SocialSecurityClaimant]
    for (const ageA of benefitsOnlyClaimAges(first.person, startYear)) {
      for (const ageB of benefitsOnlyClaimAges(second.person, startYear)) {
        rows.push({
          claimByPersonId: { [first.person.id]: ageA, [second.person.id]: ageB },
          expectedPv: expectedPvCouple(claimantOf(first, ageA), claimantOf(second, ageB), options),
        })
      }
    }
  }
  const ranked = [...rows].sort((x, y) => y.expectedPv - x.expectedPv)
  return { personIds, rows, ranked, disabilityPersonIds: [] }
}
