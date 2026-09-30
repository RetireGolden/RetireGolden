/**
 * Survivor and own benefit switching for a widow(er) living alone: a person
 * entitled to a widow(er) benefit and to an own retirement benefit may take one
 * first and switch to the other later (deemed filing does not reach survivor
 * benefits, so the choice is theirs). Only the larger claimed benefit is paid
 * each year, so the value is in the order: the survivor benefit stops growing
 * at the survivor full retirement age, while the own benefit grows to 70.
 *
 * The survivor benefit is the ledger's (socialSecurity/survivorBenefit.ts): the
 * deceased's PIA, or the actual benefit when it carried delayed credits,
 * reduced for the survivor's age when the widow(er) benefit starts, and then
 * held to the widow's limit when the deceased's benefit was reduced. Survival
 * is the engine's one curve, and each year's benefit is scaled by the plan's
 * COLA drift and benefit cut as the benefits-only ranking scales it
 * (analysis/expectedValue.ts#realBenefitScale), so the panels beside each
 * other show the plan's dollars.
 *
 * With the widow(er)'s wages, the retirement earnings test is charged against
 * the larger claimed benefit each month before full retirement age by the
 * ledger's earnings-test year (socialSecurity/earningsTest.ts#earningsTestYear),
 * and its crediting months raise each benefit from that benefit's full
 * retirement age: the own benefit from the old-age FRA month, the survivor
 * benefit from the survivor FRA month, each counting only months of its own
 * reduction period, and the survivor benefit also from the month of 62 by the
 * months withheld before 62 (42 U.S.C. 402(q)(7); 20 CFR 404.412(b)). No month
 * before a benefit's first month of entitlement is charged (403(f)(1)(A)).
 *
 * @see DOCS/calculations/social-security/survivor-switching-expected-value.md
 */
import type { Assumptions, FormerSpouse, Plan } from '../../model/plan.js'
import { survivalCurve } from '../../montecarlo/survival.js'
import type { Sex } from '../../montecarlo/mortality.js'
import { componentScale, packForYear } from '../../params/index.js'
import { flatInflationPath } from '../../params/indexingScale.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import { claimFactor, creditedAgeMonths, type ClaimAge } from '../claimFactor.js'
import { socialSecurityColaFactor, socialSecurityHaircutFactor } from '../colaFactor.js'
import { earningsTestYear, excessEarnings } from '../earningsTest.js'
import {
  passesModeledOrdinaryWidowRecordGates,
  passesModeledSurvivingDivorcedRecordGates,
} from '../maritalBenefits.js'
import { ageToTotalMonths, attainedAgeZeroMonthIndex, effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear, type DobParts } from '../nra.js'
import { SURVIVOR_EARLIEST_AGE, survivorBenefitMonthly } from '../survivorBenefit.js'
import { planInflationFactorFrom } from './breakEven.js'
import { disabilityReplacesClaimAge, personWagesInYear, realBenefitScale, socialSecurityClaimants } from './expectedValue.js'

const LAST_TABLE_AGE = 119

export interface SwitchingInput {
  readonly dob: DobParts
  readonly sex: Sex
  /** Whole age in the start year, the present value's reference. */
  readonly currentAge: number
  /** The claimant's own monthly PIA, as the projection pays it in the start year. */
  readonly ownPiaMonthly: number
  /** The deceased's monthly PIA. */
  readonly deceasedPiaMonthly: number
  /** The deceased's benefit: the PIA times the deceased's claim factor (their full retirement age when none is entered). */
  readonly deceasedActualMonthly: number
  /** Whether the deceased claimed before full retirement age, which subjects the survivor to the widow's limit. */
  readonly deceasedEverReduced: boolean
  /** The widow(er)'s wages in a year, in that year's dollars, for the earnings test; none when omitted. */
  readonly wagesInYear?: (year: number) => number
}

export interface SwitchStrategy {
  /** Age the survivor benefit starts (at least 60), or null to never take it. */
  readonly survivorClaimAge: number | null
  /** Age the own retirement benefit starts (62 to 70), or null to never take it. */
  readonly ownClaimAge: number | null
}

export interface SwitchResult {
  readonly strategy: SwitchStrategy
  readonly expectedPv: number
}

export interface SwitchingOptions {
  /** Real yearly discount rate, above −1. */
  readonly discountRate: number
  /** The plan's inflation, COLA and haircut: a COLA below inflation or a haircut lowers the later years' real value. */
  readonly assumptions: Pick<Assumptions, 'inflationPct' | 'ssCola' | 'ssHaircut'>
}

function exDob(record: FormerSpouse): DobParts {
  return { year: Number(record.dob.slice(0, 4)), month: Number(record.dob.slice(5, 7)), day: Number(record.dob.slice(8, 10)) }
}

function deceasedBenefit(record: FormerSpouse): { actual: number; everReduced: boolean } {
  const dob = exDob(record)
  const fra = fraForBirthYear(effectiveBirthYear(dob.year, dob.month, dob.day))
  const claimAge: ClaimAge = record.deceasedClaimAge ?? { years: fra.years, months: fra.extraMonths }
  return {
    actual: record.piaMonthly * claimFactor(dob.year, dob.month, dob.day, claimAge),
    everReduced: ageToTotalMonths(claimAge.years, claimAge.months) < fraTotalMonths(fra),
  }
}

/**
 * The panel's input for a single household's only claimant: of the eligible
 * deceased or surviving-divorced former-spouse records (the ledger's modeled
 * record gates), the one whose survivor benefit at the claimant's survivor
 * full retirement age is largest (the first on a tie); null when the household
 * is not a single claimant, the claimant's benefit is paid as a disability
 * benefit from its onset (#disabilityReplacesClaimAge, so no own claim age
 * starts it), no record is eligible, or that record's deceased benefit is not
 * positive.
 */
export function survivorSwitchingInputs(plan: Plan, personId: string, startYear: number): SwitchingInput | null {
  if (plan.household.people.length !== 1) return null
  const claimants = socialSecurityClaimants(plan, startYear)
  if (claimants.length !== 1 || claimants[0]!.person.id !== personId) return null
  const { person, stream, piaMonthly } = claimants[0]!
  if (disabilityReplacesClaimAge(stream, person)) return null
  // A widow(er) living alone is unmarried, so a remarriage before 60 no longer bars the benefit.
  const eligible = (stream.formerSpouses ?? []).filter(
    (record) => passesModeledOrdinaryWidowRecordGates(record, true) || passesModeledSurvivingDivorcedRecordGates(record, true),
  )
  if (eligible.length === 0) return null
  const { y, m, d } = socialSecurityDobParts(person)
  const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
  const atSurvivorFra: ClaimAge = { years: Math.floor(survivorFraMonths / 12), months: survivorFraMonths % 12 }
  let best = eligible[0]!
  let bestPayable = -Infinity
  for (const record of eligible) {
    const { actual, everReduced } = deceasedBenefit(record)
    const payable = survivorBenefitMonthly({
      deceasedPiaMonthly: record.piaMonthly,
      deceasedActualMonthly: actual,
      deceasedEverReduced: everReduced,
      survivorClaimAge: atSurvivorFra,
      survivorFraMonths,
    })
    if (payable > bestPayable) {
      bestPayable = payable
      best = record
    }
  }
  const { actual, everReduced } = deceasedBenefit(best)
  if (actual <= 0) return null
  const wages = personWagesInYear(plan, person.id, startYear)
  const hasWages = Array.from({ length: 120 }, (_, i) => startYear + i).some((year) => wages(year) > 0)
  return {
    dob: { year: y, month: m, day: d },
    sex: person.sex,
    currentAge: startYear - y,
    ownPiaMonthly: piaMonthly,
    deceasedPiaMonthly: best.piaMonthly,
    deceasedActualMonthly: actual,
    deceasedEverReduced: everReduced,
    ...(hasWages ? { wagesInYear: wages } : {}),
  }
}

/**
 * The yearly benefit a strategy pays at each age from the current age to 119
 * (the larger claimed benefit), in today's dollars before the COLA drift and
 * haircut; with wages, #strategyStreamWithEarningsTest.
 */
function strategyStream(input: SwitchingInput, strategy: SwitchStrategy, options: SwitchingOptions): number[] {
  if (input.wagesInYear !== undefined) return strategyStreamWithEarningsTest(input, strategy, options)
  const survivorFraMonths = fraTotalMonths(
    survivorFraForBirthYear(effectiveBirthYear(input.dob.year, input.dob.month, input.dob.day)),
  )
  const survivorAnnual =
    strategy.survivorClaimAge !== null
      ? survivorBenefitMonthly({
          deceasedPiaMonthly: input.deceasedPiaMonthly,
          deceasedActualMonthly: input.deceasedActualMonthly,
          deceasedEverReduced: input.deceasedEverReduced,
          survivorClaimAge: { years: strategy.survivorClaimAge, months: 0 },
          survivorFraMonths,
        }) * 12
      : 0
  const ownAnnual =
    strategy.ownClaimAge !== null
      ? input.ownPiaMonthly * 12 * claimFactor(input.dob.year, input.dob.month, input.dob.day, { years: strategy.ownClaimAge, months: 0 })
      : 0
  const stream: number[] = []
  for (let age = input.currentAge; age <= LAST_TABLE_AGE; age++) {
    const survivorOn = strategy.survivorClaimAge !== null && age >= strategy.survivorClaimAge
    const ownOn = strategy.ownClaimAge !== null && age >= strategy.ownClaimAge
    stream.push(Math.max(survivorOn ? survivorAnnual : 0, ownOn ? ownAnnual : 0))
  }
  return stream
}

/**
 * A strategy's yearly benefits with the earnings test on the widow(er)'s wages,
 * month by month, in today's dollars before the COLA drift and haircut: each
 * month pays the larger claimed benefit, the survivor benefit at its claim age
 * and the own benefit at its, each raised by its crediting months from its full
 * retirement age, and the survivor benefit also from the month of 62 by the
 * months withheld before 62 (20 CFR 404.412(b)); the year's excess, restated in
 * today's dollars at the year's COLA factor and haircut, is charged against the
 * two benefits, a partial month in proportion to each (RS 02501.145 B.2), and
 * only from a benefit's first month of entitlement (a month the claim-year
 * convention pays before it is paid in full, 403(f)(1)(A)).
 */
function strategyStreamWithEarningsTest(input: SwitchingInput, strategy: SwitchStrategy, options: SwitchingOptions): number[] {
  const { dob } = input
  const effectiveYear = effectiveBirthYear(dob.year, dob.month, dob.day)
  const fraMonths = fraTotalMonths(fraForBirthYear(effectiveYear))
  const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveYear))
  const zero = attainedAgeZeroMonthIndex(dob)
  const fraMonthIndex = zero + fraMonths
  const survivorFraMonthIndex = zero + survivorFraMonths
  const startYear = dob.year + input.currentAge
  const lastYear = dob.year + LAST_TABLE_AGE
  const inflationFrom = planInflationFactorFrom(options.assumptions.inflationPct, startYear, lastYear)
  const limitPath = flatInflationPath(options.assumptions.inflationPct / 100)
  const survivorClaimMonths = strategy.survivorClaimAge === null ? null : strategy.survivorClaimAge * 12
  const ownClaimMonths = strategy.ownClaimAge === null ? null : strategy.ownClaimAge * 12
  let ownCredits = 0
  let survivorCredits = 0
  // 20 CFR 404.412(b): a widow(er) benefit's reduction is adjusted in the month
  // of 62 for the months withheld before it, as well as in the survivor
  // full-retirement-age month for every month withheld.
  const age62MonthIndex = zero + 62 * 12
  let survivorCreditsBefore62 = 0
  const survivorAgeMonths = (monthIndex: number): number => {
    if (survivorClaimMonths === null) return 0
    if (monthIndex >= survivorFraMonthIndex) return creditedAgeMonths(survivorClaimMonths, survivorCredits, monthIndex, survivorFraMonthIndex, survivorFraMonths)
    if (monthIndex >= age62MonthIndex && survivorClaimMonths < survivorFraMonths) return Math.min(survivorFraMonths, survivorClaimMonths + survivorCreditsBefore62)
    return survivorClaimMonths
  }
  const survivorMonthly = (monthIndex: number): number =>
    survivorClaimMonths === null
      ? 0
      : survivorBenefitMonthly({
          deceasedPiaMonthly: input.deceasedPiaMonthly,
          deceasedActualMonthly: input.deceasedActualMonthly,
          deceasedEverReduced: input.deceasedEverReduced,
          survivorClaimAge: claimAgeOf(survivorAgeMonths(monthIndex)),
          survivorFraMonths,
        })
  const ownMonthly = (monthIndex: number): number =>
    ownClaimMonths === null
      ? 0
      : input.ownPiaMonthly * claimFactor(dob.year, dob.month, dob.day, claimAgeOf(creditedAgeMonths(ownClaimMonths, ownCredits, monthIndex, fraMonthIndex, fraMonths)))
  const stream: number[] = []
  for (let age = input.currentAge; age <= LAST_TABLE_AGE; age++) {
    const year = dob.year + age
    const survivorOn = strategy.survivorClaimAge !== null && age >= strategy.survivorClaimAge
    const ownOn = strategy.ownClaimAge !== null && age >= strategy.ownClaimAge
    const monthDue = (month: number): { own: number; survivor: number; survivorFull: number } => {
      const monthIndex = year * 12 + month
      const survivor = survivorOn ? survivorMonthly(monthIndex) : 0
      const own = ownOn ? ownMonthly(monthIndex) : 0
      const total = Math.max(survivor, own)
      const ownPart = Math.min(own, total)
      return { own: ownPart, survivor: total - ownPart, survivorFull: survivor }
    }
    const yearParameters = packForYear(year)
    const pack = yearParameters.pack
    // SSA's own publication of the exempt amounts decides how far they grow.
    const limitGrowth = componentScale(yearParameters, 'ssaProgram', year, limitPath)
    const excess = excessEarnings({
      wages: input.wagesInYear!(year),
      fraMonthIndex,
      year,
      belowFraExemptAnnual: pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth,
      fraYearExemptAnnual: pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth,
    })
    const scale = socialSecurityColaFactor(options.assumptions.ssCola, inflationFrom, startYear, year) * socialSecurityHaircutFactor(options.assumptions.ssHaircut, year)
    let paid = 0
    if (excess > 0 && scale > 0 && (survivorOn || ownOn)) {
      const survivorStart = survivorClaimMonths === null ? Infinity : zero + survivorClaimMonths
      const ownStart = ownClaimMonths === null ? Infinity : zero + ownClaimMonths
      const test = earningsTestYear({
        year,
        people: [{ id: 'widow', excess: excess / scale, fraMonthIndex }],
        workerId: null,
        due: (month) => {
          const monthIndex = year * 12 + month
          const due = monthDue(month)
          const ownEntitled = monthIndex >= ownStart
          const survivorEntitled = monthIndex >= survivorStart
          // A month the claim-year convention pays the own benefit before its
          // entitlement, with the survivor benefit already entitled: she is
          // entitled to the survivor benefit alone, which is charged in full,
          // and the rest the convention pays is not (403(f)(1)(A)).
          const survivorAlone = survivorEntitled && !ownEntitled && due.own > 0
          const chargeableSurvivor = survivorAlone ? Math.min(due.survivorFull, due.own + due.survivor) : due.survivor
          return new Map([['widow', {
            own: due.own + due.survivor - chargeableSurvivor,
            auxiliary: chargeableSurvivor,
            auxiliaryWorkerId: null,
            ownEntitled,
            auxiliaryEntitled: survivorEntitled,
            ownInReductionPeriod: monthIndex >= ownStart && monthIndex < fraMonthIndex,
            auxiliaryInReductionPeriod: monthIndex >= survivorStart && monthIndex < survivorFraMonthIndex,
          }]])
        },
        credit: (month, _personId, benefit) => {
          if (benefit === 'own') {
            ownCredits++
            return
          }
          survivorCredits++
          if (year * 12 + month < age62MonthIndex) survivorCreditsBefore62++
        },
      })
      for (const value of test.paidByMonth.get('widow') ?? []) paid += value
    } else {
      for (let month = 0; month < 12; month++) {
        const due = monthDue(month)
        paid += due.own + due.survivor
      }
    }
    stream.push(paid)
  }
  return stream
}

function claimAgeOf(totalMonths: number): ClaimAge {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}

function presentValue(input: SwitchingInput, stream: readonly number[], options: SwitchingOptions): number {
  if (!Number.isFinite(options.discountRate) || options.discountRate <= -1) {
    throw new RangeError(`A discount rate must be a finite number above -1; got ${options.discountRate}`)
  }
  const curve = survivalCurve(input.currentAge, input.sex)
  // The start year is the year the current age is reached.
  const startYear = input.dob.year + input.currentAge
  const scale = realBenefitScale({ startYear, assumptions: options.assumptions }, startYear + stream.length - 1)
  let pv = 0
  for (let t = 0; t < stream.length; t++) {
    const benefit = stream[t]!
    if (benefit > 0) pv += curve.survivalTo(t) * benefit * scale(startYear + t) * Math.pow(1 + options.discountRate, -t)
  }
  return pv
}

/**
 * Expected present value of one strategy: Σ over ages from the current age to
 * 119 of S(age) × the larger claimed yearly benefit × scale(year) ×
 * (1 + r)^−(age − current age), with the survivor benefit priced at the
 * survivor claim age and the own benefit at the own claim age (whole years),
 * and scale the plan's real COLA drift and haircut for the year the age is
 * reached (#realBenefitScale; 1 when the COLA matches inflation and there is
 * no haircut).
 */
export function expectedPvSwitch(input: SwitchingInput, strategy: SwitchStrategy, options: SwitchingOptions): number {
  return presentValue(input, strategyStream(input, strategy, options), options)
}

function claimCount(strategy: SwitchStrategy): number {
  return (strategy.survivorClaimAge === null ? 0 : 1) + (strategy.ownClaimAge === null ? 0 : 1)
}

/** The order that decides between strategies paying the same stream, or of equal value: fewer claims, then earlier ages, a missing claim last. */
function preferenceOrder(a: SwitchStrategy, b: SwitchStrategy): number {
  const byCount = claimCount(a) - claimCount(b)
  if (byCount !== 0) return byCount
  // A claim not taken sorts after any age.
  const age = (value: number | null): number => (value === null ? Number.POSITIVE_INFINITY : value)
  const compare = (x: number, y: number): number => (x === y ? 0 : x < y ? -1 : 1)
  return compare(age(a.survivorClaimAge), age(b.survivorClaimAge)) || compare(age(a.ownClaimAge), age(b.ownClaimAge))
}

/**
 * The candidate strategies ranked by expected value, highest first. Survivor
 * ages: the current age (at least 60) and the survivor full retirement age's
 * year; own ages: the current age (62 to 70), the full retirement age's year
 * and 70; every pairing, then each benefit alone. Strategies that pay the same
 * yearly stream (the second benefit never exceeds the first) are one strategy,
 * kept as the one with fewer claims, then the earlier ages; equal values are
 * ordered the same way.
 */
export function rankSwitchStrategies(input: SwitchingInput, options: SwitchingOptions): SwitchResult[] {
  const { dob, currentAge } = input
  const effectiveYear = effectiveBirthYear(dob.year, dob.month, dob.day)
  const survivorFraYears = survivorFraForBirthYear(effectiveYear).years
  const ownFraYears = fraForBirthYear(effectiveYear).years
  const survivorNow = Math.max(currentAge, SURVIVOR_EARLIEST_AGE)
  const survivorAges = [...new Set([survivorNow, Math.max(survivorNow, survivorFraYears)])]
  const ownNow = Math.min(70, Math.max(currentAge, 62))
  const ownAges = [...new Set([ownNow, ownFraYears, 70].filter((age) => age >= ownNow && age <= 70))]

  const strategies: SwitchStrategy[] = []
  for (const s of survivorAges) for (const o of ownAges) strategies.push({ survivorClaimAge: s, ownClaimAge: o })
  for (const s of survivorAges) strategies.push({ survivorClaimAge: s, ownClaimAge: null })
  for (const o of ownAges) strategies.push({ survivorClaimAge: null, ownClaimAge: o })

  // One strategy per distinct yearly stream, the preferred one of each.
  const byStream = new Map<string, { strategy: SwitchStrategy; stream: number[] }>()
  for (const strategy of strategies) {
    const stream = strategyStream(input, strategy, options)
    const key = stream.join(',')
    const held = byStream.get(key)
    if (held === undefined || preferenceOrder(strategy, held.strategy) < 0) byStream.set(key, { strategy, stream })
  }
  const results = [...byStream.values()].map(({ strategy, stream }) => ({
    strategy,
    expectedPv: presentValue(input, stream, options),
  }))
  return results.sort((a, b) => b.expectedPv - a.expectedPv || preferenceOrder(a.strategy, b.strategy))
}
