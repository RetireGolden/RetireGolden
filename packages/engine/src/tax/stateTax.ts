/**
 * State income tax (V5, "big levers"). State taxable income starts from
 * ordinary income plus capital gains (most states tax gains as ordinary) plus
 * the federally taxable Social Security amount only where the state taxes SS,
 * minus the major retirement-income exclusion and the state standard
 * deduction; brackets then apply.
 *
 * A single calculator instance resolves the right state+year from each
 * TaxYearInput, so mid-retirement moves and year-specific packs work without
 * rebuilding it. The plan's flat effective-rate override takes precedence when
 * set above zero (a manual correction); otherwise a modeled pack is used, and
 * unmodeled states contribute zero until their pack ships.
 *
 * Railroad Retirement Act annuities come off the base in every state with an
 * income tax, under 45 U.S.C. 231m (usc-45-231m-state-tax-bar, applied at the
 * top of `characterizedRetirementDelta`).
 *
 * Military retirement: a state's own military rule is modeled only in
 * Arkansas, California, Delaware, Idaho, Iowa, Kansas, Massachusetts,
 * Missouri, New Jersey, Rhode Island, South Carolina, Utah, Vermont, Virginia
 * and West Virginia. Everywhere else a pension tagged Military retirement or
 * Military survivor benefit is priced under the state's general retirement
 * rules, and the state's own military exclusion, with its age or income
 * tests, is not modeled yet. The first known case is Wisconsin, which
 * subtracts U.S. military retirement pay in full (2025 Schedule SB, line 12);
 * the engine gives it only the retirement income subtraction at 67 or older.
 * This is a stated limit of the state-enacted-tax-year-figures calculation.
 *
 * @see DOCS/features/taxes.md
 */

import {
  LATEST_STATE_PACK_YEAR,
  conformStateStandardDeduction,
  stateParamsFor,
  type StateRetirementExclusion,
  type StateTaxBracket,
  type StateTaxParams,
} from '../params/state/index.js'
import { computeFederalTax, taxableSocialSecurity } from './federalTax.js'
import {
  californiaMilitaryExclusions,
  federalSeniorDeductionSubtraction,
  marylandCapitalGainSurtax,
  marylandPublicSafetySubtraction,
  rhodeIslandPensionModificationAllowed,
  rhodeIslandSocialSecurityModification,
  statutorilyIndexedStandardDeduction,
  virginiaPersonalExemptions,
} from './stateEnactedLaw.js'
import { age65StandardDeductionAddition, packForYear } from '../params/index.js'
import { taxParameterFilingStatus, type TaxCalculator, type TaxComputationResult, type TaxYearInput } from '../projection/types.js'
import { phaseOutStandardDeduction } from './stateStandardDeduction.js'
import {
  isKnownMoney,
  isMilitarySource,
  isRailroadSource,
  mapStateIncomeComponents,
  rothConversionPart,
  rothConversionPartAtAge59HalfOrOlder,
  type StateHsaAccountYearFacts,
  type StateHouseholdTaxFacts,
  type StateHsaYearFacts,
  type StateIncomeComponent,
  type StateLeafAdjustment,
  type StateNjIraOwnerPoolFacts,
  type StateQcdEventFacts,
  type StateQcdYearFacts,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'
import { iowaAlternateOrMinimumTax, iowaRetirementExclusionTotal } from './stateIowaRetirement.js'
import { arkansasRetirementExclusion } from './stateArkansasRetirement.js'
import {
  scAge65Deduction,
  scMilitaryDeduction,
  scSection1170Deduction,
  scSciadDeduction,
} from './stateSouthCarolinaRetirement.js'
import {
  louisianaAge65RetirementExemption,
  louisianaFederalRailroadExclusion,
} from './stateLouisianaRetirement.js'
import {
  coloradoHighAgiFederalDeductionAddback,
  coloradoRailroadSubtraction,
  coloradoSsPensionSubtraction,
} from './stateColoradoTax.js'
import {
  californiaHsaAdjustment,
  californiaHsaCollectionAdjustment,
  newJerseyWorksheetCTaxableAmount,
  newJerseyHsaAdjustment,
  newJerseyHsaCollectionAdjustment,
  stateDirectQcdAdjustment,
  stateDirectQcdCollectionAdjustment,
} from './stateQcdHsa.js'
import {
  connecticutIraSubtractionFraction,
  connecticutPersonalExemption,
  dcGovernmentSurvivorExclusion,
  delawareUnder60PensionDeduction,
  massachusettsPersonalExemption,
  massachusettsRetirementAdjustment,
  massachusettsTaxOnTaxableIncome,
  newJerseyMilitaryExemption,
  newJerseyPensionExclusion,
} from './stateNortheastExtras.js'
import {
  hawaiiTaxForStatus,
  idahoQualifiedRetirementDeduction,
  montanaLtcgTax,
  oregonRetirementIncomeCredit,
  utahOrVirginiaMilitaryFromFacts,
  utahRailroadSubtraction,
  utahSelectNonrefundableCredit,
  utahMilitaryRetirementCredit,
  utahPriorTaxed401aSubtraction,
  virginiaSsTier1Subtraction,
  utahRetirementCredit,
  utahSocialSecurityCredit,
  virginiaAgeDeduction,
  virginiaMilitarySubtraction,
  virginiaPriorStateBasisSubtraction,
  vermontCivilServiceExclusion,
  vermontMilitaryExclusion,
  vermontMinimumTaxComparison,
  vermontRailroadExclusion,
} from './stateWestExtras.js'
import {
  illinoisPersonalExemptionAllowance,
  kansasNamedPlanExclusion,
  missouriMilitaryAndRailroad,
  missouriPrivatePensionDeduction,
  missouriPublicPensionDeduction,
  westVirginiaAge65Modification,
  westVirginiaExemptions,
  westVirginiaPublicMilitary,
  westVirginiaSocialSecuritySubtraction,
  wisconsinPersonalExemption,
  wisconsinStandardDeduction,
} from './stateMidwestExtras.js'
import {
  federalRailroadRetirementActKinds,
  railroadRetirementActSubtraction,
  rhodeIslandMilitaryServicePensionModification,
} from './stateRailroadAndMilitary.js'
import { ageOnDate } from '../projection/internal/stateRetirementFactsAdapter.js'

function bracketTax(brackets: StateTaxBracket[], taxable: number): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!
    const lower = bracket.lowerBound
    const upper = i + 1 < brackets.length ? brackets[i + 1]!.lowerBound : Infinity
    if (taxable <= lower) break
    const marginal = (Math.min(taxable, upper) - lower) * (bracket.ratePct / 100)
    if (bracket.baseTax !== undefined) {
      tax = bracket.baseTax + marginal
    } else {
      tax += marginal
    }
  }
  return tax
}

/** Retirement income excluded from state taxable income, per the state's rule. */
function retirementExclusion(rule: StateRetirementExclusion, retirementIncome: number, agesAlive: number[]): number {
  const r = rule
  const income = Math.max(0, retirementIncome)
  if (r.kind === 'none' || income === 0) return 0
  const eligibleCount = r.minAge === undefined ? agesAlive.length : agesAlive.filter((a) => a >= r.minAge!).length
  if (eligibleCount === 0) return 0
  if (r.kind === 'full') return income
  return Math.min(income, (r.capPerPerson ?? 0) * eligibleCount)
}

function derivedAge65EligibleCount(facts: StateHouseholdTaxFacts | undefined, taxYear: number): number | undefined {
  if (facts?.age65EligibleCount !== undefined) return facts.age65EligibleCount
  if (facts?.claimantDatesOfBirth === undefined) return undefined
  const ages = facts.claimantDatesOfBirth.map((dob) => ageOnDate(dob, `${taxYear}-12-31`))
  if (ages.some((age) => age === undefined)) return undefined
  return ages.filter((age) => age !== undefined && age >= 65).length
}

/**
 * Virginia's count of taxpayers 65 or older for the $800 additional personal
 * exemption of 58.1-322.03(2)(b). Form 760 counts a taxpayer who was 65 on or
 * before January 1 of the following year, so a January 1 birthday counts for
 * the year before it. From the claimants' dates of birth when the year carries
 * them, which every projected year does; otherwise the shared count of people
 * 65 or older at the end of the year, then the household's.
 */
function virginiaAgedTaxpayerCount(input: TaxYearInput, facts: StateHouseholdTaxFacts | undefined): number {
  const dates = facts?.claimantDatesOfBirth
  const agesOnJanuary1 = dates?.map((dob) => ageOnDate(dob, `${input.year + 1}-01-01`))
  if (agesOnJanuary1 !== undefined && agesOnJanuary1.every((age) => age !== undefined)) {
    return agesOnJanuary1.filter((age) => age !== undefined && age >= 65).length
  }
  return derivedAge65EligibleCount(facts, input.year) ?? Math.max(0, input.peopleAged65Plus)
}

/**
 * New Jersey NJ-1040 line 20a and line A: the year's pension, annuity and IRA
 * payments, and the part paid to a spouse who qualifies for the exclusion (62
 * or older, or disabled, on the last day of the year). Military pensions are
 * exempt on their own and Railroad Retirement Act annuities came off under
 * 45 U.S.C. 231m, so neither is counted, and a public pension of unknown source
 * is left out because it may be military. From the characterized rows when the
 * year has them; otherwise from the coarse retirement fields, which name no
 * recipient, so all of it qualifies when anyone in the household is old enough.
 */
function newJerseyPensionPayments(
  minAge: number,
  input: TaxYearInput,
  distributions: readonly StateRetirementDistributionFact[] | undefined,
): { payments: number; qualifyingPayments: number; warnings: StateTaxExactnessWarning[] } {
  if (distributions === undefined) {
    const payments =
      Math.max(0, input.privateRetirementIncome ?? input.retirementIncome ?? 0) + Math.max(0, input.publicPensionIncome ?? 0)
    const anyoneQualifies = (input.agesAlive ?? []).some((age) => age >= minAge)
    return { payments, qualifyingPayments: anyoneQualifies ? payments : 0, warnings: [] }
  }
  let payments = 0
  let qualifyingPayments = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of distributions) {
    if (isMilitarySource(fact.sourceKind) || isRailroadSource(fact.sourceKind) || fact.sourceKind === 'unknownPublic') continue
    const included = Math.max(0, fact.federallyIncludedAmount)
    payments += included
    if (fact.recipientDisabled === true) {
      qualifyingPayments += included
    } else if (fact.recipientAgeKnown === false) {
      warnings.push({
        code: 'nj-pension-recipient-age-unknown',
        ruleId: 'nj-stat-54a-6-10-retirement-income-exclusion',
        message: 'New Jersey pension exclusion requires the recipient age on the last day of the year.',
        missingFacts: ['recipientAgeYears'],
      })
    } else if (fact.recipientAgeYears >= minAge) {
      qualifyingPayments += included
    }
  }
  return { payments, qualifyingPayments, warnings }
}

type VirginiaAgeDeductionConfig = NonNullable<StateTaxParams['virginiaAgeDeduction']>

/**
 * Who on the return takes Virginia's age deduction, and under which limb of
 * Va. Code 58.1-322.03(5). From the claimants' dates of birth when the year
 * carries them: a claimant born on or before the (5)(a) date takes the full
 * amount, and a later-born claimant has attained 65 when 65 by January 1 of the
 * following year, the cohort Form 760 names (for 2025, born on or before
 * January 1, 1961). Without dates of birth, from the year-end ages: 65 or older
 * qualifies, and a birth year before the (5)(a) year takes the full amount, so
 * a claimant born on January 1, 1939 is read as income-tested and one turning
 * 65 on the next January 1 as not yet 65. Without ages either, every person 65
 * or older is income-tested.
 */
function virginiaAgeDeductionClaimants(
  config: VirginiaAgeDeductionConfig,
  input: TaxYearInput,
  facts: StateHouseholdTaxFacts | undefined,
): { fullAmount: number; incomeTested: number } {
  let fullAmount = 0
  let incomeTested = 0
  const dates = facts?.claimantDatesOfBirth
  const agesOnJanuary1 = dates?.map((dob) => ageOnDate(dob, `${input.year + 1}-01-01`))
  if (dates !== undefined && agesOnJanuary1 !== undefined && agesOnJanuary1.every((age) => age !== undefined)) {
    dates.forEach((dob, index) => {
      if (agesOnJanuary1[index]! < config.minAge) return
      if (dob <= config.fullAmountBornOnOrBefore) fullAmount += 1
      else incomeTested += 1
    })
    return { fullAmount, incomeTested }
  }
  if (input.agesAlive !== undefined) {
    const fullAmountBirthYear = Number(config.fullAmountBornOnOrBefore.slice(0, 4))
    for (const age of input.agesAlive) {
      if (age < config.minAge) continue
      if (input.year - Math.floor(age) < fullAmountBirthYear) fullAmount += 1
      else incomeTested += 1
    }
    return { fullAmount, incomeTested }
  }
  return { fullAmount: 0, incomeTested: Math.max(0, input.peopleAged65Plus) }
}

/**
 * Virginia's adjusted federal AGI (Form 760 Age Deduction Worksheet, lines 2
 * to 8): federal AGI less the taxable Social Security and Tier 1 Railroad
 * Retirement benefits in it. The engine models no Virginia conformity
 * adjustment, so worksheet lines 3 and 5 are zero. Federal AGI and taxable
 * Social Security come from the year's household facts when the projection
 * supplies them, else from the federal calculation on the same input. Tier 1
 * is the federally included amount of the year's railroad tier I rows, the
 * figure Virginia also subtracts under 58.1-322.02(3).
 */
function virginiaAdjustedFederalAgi(
  input: TaxYearInput,
  facts: StateHouseholdTaxFacts | undefined,
  distributions: readonly StateRetirementDistributionFact[] | undefined,
): number {
  let agi: number
  let taxableSocialSecurity: number
  if (facts?.federalAgi !== undefined && facts.federallyIncludedSocialSecurity !== undefined) {
    agi = facts.federalAgi
    taxableSocialSecurity = facts.federallyIncludedSocialSecurity
  } else {
    const federal = computeFederalTax(input)
    agi = federal.agi
    taxableSocialSecurity = federal.taxableSocialSecurity
  }
  const tier1 = (distributions ?? [])
    .filter((fact) => fact.sourceKind === 'railroadTier1')
    .reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
  return agi - Math.max(0, taxableSocialSecurity) - tier1
}

function vermontCompetingBenefitsProvedZero(
  distributions: readonly StateRetirementDistributionFact[],
  facts: StateHouseholdTaxFacts,
  params: StateTaxParams,
): boolean {
  if (facts.federalAgi === undefined || !facts.stateFilingStatus || facts.federallyIncludedSocialSecurity === undefined) {
    return false
  }
  const joint =
    facts.stateFilingStatus === 'marriedFilingJointly' ||
    facts.stateFilingStatus === 'qualifyingSurvivingSpouse'
  let civilIncluded = 0
  for (const fact of distributions) {
    if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') return false
    if (
      (fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic') &&
      fact.planSystemCode !== 'CSRS' &&
      fact.planSystemCode !== 'FERS' &&
      fact.publicPlanContributory !== false &&
      fact.earningsNotCoveredBySocialSecurity === undefined
    ) {
      return false
    }
    if (
      (fact.sourceKind === 'federalCivilService' && fact.planSystemCode === 'CSRS') ||
      ((fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic') &&
        fact.publicPlanContributory === true &&
        fact.earningsNotCoveredBySocialSecurity === true &&
        fact.planSystemCode !== 'FERS')
    ) {
      civilIncluded += Math.max(0, fact.federallyIncludedAmount)
    }
  }
  const fullThrough = joint ? params.vermontExtras?.civilServiceFullThroughJoint : params.vermontExtras?.civilServiceFullThroughNonjoint
  const zeroAt = joint ? params.vermontExtras?.civilServiceZeroAtJoint : params.vermontExtras?.civilServiceZeroAtNonjoint
  if (fullThrough === undefined || zeroAt === undefined) return false
  const civilExclusion = vermontCivilServiceExclusion({
    joint,
    federalAgi: facts.federalAgi,
    includedAmount: civilIncluded,
    config: params.vermontExtras,
  })
  const ssIncluded = Math.max(0, facts.federallyIncludedSocialSecurity)
  const ssFactor =
    facts.federalAgi <= fullThrough ? 1 : facts.federalAgi >= zeroAt ? 0 : (zeroAt - facts.federalAgi) / (zeroAt - fullThrough)
  return civilExclusion === 0 && ssIncluded * ssFactor === 0
}

function oregonRetirementCreditProvedZero(
  distributions: readonly StateRetirementDistributionFact[],
): boolean {
  let qualifying = 0
  for (const row of distributions) {
    const pension = ['ordinaryPrivatePension', 'employerPlan', 'ira', 'federalCivilService', 'stateLocalPublic', 'militaryRetirement', 'militarySurvivor', 'governmentSurvivor'].includes(row.sourceKind)
    if (!pension) {
      if (row.sourceKind === 'unknownPublic' || row.sourceKind === 'unknownPrivate') return false
      continue
    }
    if (row.recipientAgeKnown === false) return false
    if (row.recipientAgeYears >= 62) qualifying += Math.max(0, row.federallyIncludedAmount)
  }
  return qualifying === 0
}

export interface ComputeStateTaxOptions {
  /**
   * Pre-computed federally taxable Social Security to add to the state base
   * instead of recomputing it here. Split-year residency uses this: taxable SS
   * must be derived once from full-year income against full-year federal
   * thresholds, then apportioned to each state — recomputing it per partial-year
   * slice against annual thresholds would understate it.
   */
  taxableSocialSecurityOverride?: number
  /**
   * Optional flat local rate (percent) applied to computed state taxable
   * income — and only in a state that levies an income tax. A no-income-tax
   * state cannot acquire one through a caller parameter; see the gate in
   * `computeStateTaxDetail`.
   */
  localRatePct?: number
  /**
   * Annual modeled income for standard-deduction phase-out when the segment
   * income is prorated but the published thresholds are annual (split-year
   * residency). The phase-out fraction is chosen from this proxy; prorated
   * pack parameters supply the scaled raw deduction.
   */
  standardDeductionPhaseoutIncomeOverride?: number
  /**
   * Segment standard deduction to subtract instead of computing from pack
   * parameters. The only production use is `0` on a full-year input to observe
   * modeled income before the standard deduction (split-year phase-out proxy);
   * it is not a legal input claim for a completed return.
   */
  standardDeductionAllowedOverride?: number
  /**
   * Characterized retirement distributions (leaf vocabulary). When present,
   * replaces coarse private/public bucket exclusions for jurisdictions that
   * implement source-typed limbs. Integrator may supply proposal
   * `stateIncomeComponents` instead via `stateIncomeComponents`.
   */
  retirementDistributions?: readonly StateRetirementDistributionFact[]
  /** Shared-contract proposal components; mapped when `retirementDistributions` is omitted. */
  stateIncomeComponents?: readonly StateIncomeComponent[]
  householdFacts?: StateHouseholdTaxFacts
  /**
   * HSA account-year rows. `undefined` = unavailable (no adjustment).
   * Empty array = known no HSA activity. Legacy `hsaFacts` is accepted when
   * this collection is omitted.
   */
  hsaAccounts?: readonly StateHsaAccountYearFacts[]
  /** @deprecated Prefer `hsaAccounts`. */
  hsaFacts?: StateHsaYearFacts
  /**
   * QCD event collection. Pack `directQcdPolicy` is authoritative.
   * Legacy `qcdFacts` is accepted when this collection is omitted.
   */
  qcdEvents?: readonly StateQcdEventFacts[]
  /** @deprecated Prefer `qcdEvents`. */
  qcdFacts?: StateQcdYearFacts
  /** New Jersey Worksheet C owner pools keyed for QCD reconstruction. */
  njIraOwnerPools?: readonly StateNjIraOwnerPoolFacts[]
  /**
   * Full-year federal AGI and senior deduction for a split-year slice, whose
   * prorated input cannot reproduce them. Read only by the provisions that test
   * federal AGI or carry the federal senior deduction.
   */
  federalOverride?: FederalFactsForState
}

/** Federal figures some state provisions read: AGI and the IRC 151(d)(5)(C) senior deduction. */
interface FederalFactsForState {
  agi: number
  seniorDeduction: number
}

/**
 * The federal AGI and senior deduction for the return: from the household
 * facts the projection passes, else the split-year override, else computed from
 * the same input. Computed at most once per call, and only when a provision
 * asks.
 */
function federalFactsFor(input: TaxYearInput, opts: ComputeStateTaxOptions): () => FederalFactsForState {
  let memo: FederalFactsForState | undefined
  return () => {
    if (memo !== undefined) return memo
    const facts = opts.householdFacts
    if (facts?.federalAgi !== undefined && facts.federalSeniorDeduction !== undefined) {
      memo = { agi: facts.federalAgi, seniorDeduction: facts.federalSeniorDeduction }
    } else if (opts.federalOverride !== undefined) {
      memo = opts.federalOverride
    } else {
      const federal = computeFederalTax(input)
      memo = { agi: facts?.federalAgi ?? federal.agi, seniorDeduction: facts?.federalSeniorDeduction ?? federal.seniorDeduction }
    }
    return memo
  }
}

interface TaxableIncomeComputation {
  taxableIncome: number
  taxCredit: number
  warnings: StateTaxExactnessWarning[]
  /** Ordinary taxable income before LTCG stacking (Montana). */
  ordinaryTaxableIncomeBeforeLtcg?: number
}

export interface StateTaxDetail {
  taxableIncome: number
  stateTax: number
  localTax: number
  totalTax: number
}

export interface StateTaxComputationResult {
  amount: number
  taxableIncome: number
  stateTax: number
  localTax: number
  totalTax: number
  taxCredit: number
  status: 'complete' | 'incomplete'
  warnings: readonly StateTaxExactnessWarning[]
  /** State-keyed HSA basis transitions for the annual ledger, when computable. */
  hsaBasisPools?: readonly StateHsaBasisPoolResult[]
  njIraBasisPools?: readonly StateNjIraBasisPoolResult[]
  pensionBasisPools?: readonly StatePensionBasisPoolResult[]
}

export interface StatePensionBasisPoolResult {
  state: string
  accountId: string
  ownerPersonId: string
  kind: 'pension' | 'eligiblePlan' | 'otherState401a'
  status: 'complete' | 'incomplete'
  openingBasis?: number
  basisConsumed?: number
  closingBasis?: number
}

export interface StateNjIraBasisPoolResult {
  state: 'NJ'
  ownerPersonId: string
  status: 'complete' | 'incomplete'
  openingBasis?: number
  basisConsumed?: number
  closingBasis?: number
}

export interface StateHsaBasisPoolResult {
  state: string
  accountId: string
  ownerPersonId: string
  status: 'complete' | 'incomplete'
  openingBasis?: number
  basisAdded?: number
  basisConsumed?: number
  closingBasis?: number
}

function resolvedDistributions(opts: ComputeStateTaxOptions): StateRetirementDistributionFact[] | undefined {
  if (opts.retirementDistributions !== undefined) return [...opts.retirementDistributions]
  return mapStateIncomeComponents(opts.stateIncomeComponents)
}

/**
 * Source-typed retirement adjustments for jurisdictions with characterized
 * leaf helpers. Returns a taxable-income delta (negative = exclusion).
 */
function characterizedRetirementDelta(
  params: StateTaxParams,
  distributions: readonly StateRetirementDistributionFact[],
  agesAlive: number[],
  opts: ComputeStateTaxOptions,
  context: {
    federal: () => FederalFactsForState
    /** Joint tax parameters: a joint return or a qualifying surviving spouse. */
    joint: boolean
    /** A joint return of a married couple; a qualifying surviving spouse is unmarried. */
    married: boolean
  },
): { taxableIncomeDelta: number; taxCredit: number; warnings: StateTaxExactnessWarning[] } {
  const warnings: StateTaxExactnessWarning[] = []
  let taxableIncomeDelta = 0
  const taxCredit = 0
  const code = params.code

  // 45 U.S.C. 231m(a): no state may tax a Railroad Retirement Act annuity
  // (usc-45-231m-state-tax-bar). Subtracted here, before every state's own
  // rules, for the railroad sources the state's own law does not already
  // subtract below; no retirement pool below counts a railroad source.
  taxableIncomeDelta -= railroadRetirementActSubtraction(distributions, federalRailroadRetirementActKinds(code))

  if (code === 'IA') {
    const part = iowaRetirementExclusionTotal(distributions)
    taxableIncomeDelta += part.taxableIncomeDelta
    warnings.push(...part.warnings)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'AR') {
    const part = arkansasRetirementExclusion(
      distributions,
      params.retirementPrivate.capPerPerson,
    )
    taxableIncomeDelta += part.taxableIncomeDelta
    warnings.push(...part.warnings)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'SC') {
    // Railroad retirement (SC1040 line o) came off above under 45 U.S.C. 231m
    // and does not enter the section 1170 pool below.
    const military = scMilitaryDeduction(distributions)
    taxableIncomeDelta += military.taxableIncomeDelta
    warnings.push(...military.warnings)
    // Per-owner §1170 using each distinct owner age.
    const byOwner = new Map<string, StateRetirementDistributionFact[]>()
    for (const fact of distributions) {
      const list = byOwner.get(fact.ownerPersonId) ?? []
      list.push(fact)
      byOwner.set(fact.ownerPersonId, list)
    }
    for (const row of opts.householdFacts?.ownerStateTaxFacts ?? []) {
      if (!byOwner.has(row.ownerPersonId)) byOwner.set(row.ownerPersonId, [])
    }
    for (const [owner, ownerFacts] of byOwner) {
      const ownerRow = opts.householdFacts?.ownerStateTaxFacts?.find((row) => row.ownerPersonId === owner)
      const age = ownerFacts[0]?.recipientAgeYears ?? ownerRow?.recipientAgeYears
      if (age === undefined) {
        warnings.push({ code: 'sc-owner-age-unknown', message: 'South Carolina age deduction requires known owner age.', missingFacts: ['ownerStateTaxFacts.recipientAgeYears'] })
        continue
      }
      if (ownerFacts.some((fact) => fact.recipientAgeKnown === false)) {
        warnings.push({ code: 'sc-owner-age-unknown', ruleId: 'sc-code-12-6-1170-retirement-income-deduction', message: 'South Carolina retirement deduction requires known owner age.', missingFacts: ['recipientAgeYears'] })
        continue
      }
      const ownFacts = ownerFacts.filter((fact) => fact.survivorSpouse !== true)
      const survivorFacts = ownerFacts.filter((fact) => fact.survivorSpouse === true && !isMilitarySource(fact.sourceKind))
      const section1170 = scSection1170Deduction({ facts: ownFacts, recipientAgeYears: age })
      taxableIncomeDelta += section1170.taxableIncomeDelta
      warnings.push(...section1170.warnings)
      if (survivorFacts.length) {
        const decedentAges = [...new Set(survivorFacts.map((fact) => fact.decedentAgeYears))]
        if (decedentAges.length !== 1 || decedentAges[0] === undefined) warnings.push({ code: 'sc-survivor-decedent-age-unknown', message: 'South Carolina separate survivor retirement deduction requires the deceased spouse age.', missingFacts: ['decedentAgeYears'] })
        else {
          const survivorDeduction = scSection1170Deduction({ facts: survivorFacts, recipientAgeYears: decedentAges[0] })
          taxableIncomeDelta += survivorDeduction.taxableIncomeDelta
          warnings.push(...survivorDeduction.warnings)
        }
      }
      const ownRetirementBeforeMilitary = -section1170.taxableIncomeDelta
      const ownMilitary = -scMilitaryDeduction(ownerFacts.filter((fact) => fact.sourceKind !== 'militarySurvivor' && fact.survivorSpouse !== true)).taxableIncomeDelta
      // Section1170(C) reduces the own ordinary retirement deduction by
      // own military retirement; surviving-spouse military is excepted.
      const ownRetirement = Math.max(0, ownRetirementBeforeMilitary - ownMilitary)
      taxableIncomeDelta += ownRetirementBeforeMilitary - ownRetirement
      if (age < 65) continue
      const remaining = ownerRow?.remainingScIncome
      if (remaining === undefined) {
        warnings.push({ code: 'sc-age65-income-unknown', ruleId: 'sc-code-12-6-1170-b-age-65', message: 'South Carolina age-65 deduction requires owner-attributed remaining South Carolina income.', missingFacts: ['ownerStateTaxFacts.remainingScIncome'] })
      } else {
        const age65 = scAge65Deduction({ recipientAgeYears: age, remainingScIncome: remaining, ownRetirementDeduction: ownRetirement, ownMilitaryDeduction: ownMilitary })
        taxableIncomeDelta += age65.taxableIncomeDelta
      }
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'LA') {
    const federal = louisianaFederalRailroadExclusion(distributions)
    taxableIncomeDelta += federal.taxableIncomeDelta
    warnings.push(...federal.warnings)
    const age65 = louisianaAge65RetirementExemption({
      facts: distributions,
      capPerPerson: params.retirementPrivate.capPerPerson,
    })
    taxableIncomeDelta += age65.taxableIncomeDelta
    warnings.push(...age65.warnings)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'MD') {
    // Tax-General 10-207(mm) first; 10-209(d)(2) keeps what it subtracts out
    // of the pension exclusion below.
    let publicSafetyTaken: ReadonlyMap<string, number> = new Map()
    if (params.marylandPublicSafetySubtraction) {
      const part = marylandPublicSafetySubtraction({ config: params.marylandPublicSafetySubtraction, distributions })
      taxableIncomeDelta += part.taxableIncomeDelta
      warnings.push(...part.warnings)
      publicSafetyTaken = part.subtractedByOwner
    }
    const owners = new Map<string, StateRetirementDistributionFact[]>()
    for (const fact of distributions) {
      const rows = owners.get(fact.ownerPersonId) ?? []
      rows.push(fact)
      owners.set(fact.ownerPersonId, rows)
    }
    for (const [owner, rows] of owners) {
      const qualifying = rows.filter((fact) => fact.sourceKind === 'employerPlan' || fact.sourceKind === 'ordinaryPrivatePension' || fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic')
      if (!qualifying.length) continue
      const age = qualifying[0]!.recipientAgeYears
      if (qualifying.some((fact) => fact.recipientAgeKnown === false)) {
        warnings.push({ code: 'md-pension-age-unknown', message: 'Maryland pension exclusion requires recipient age.', missingFacts: ['recipientAgeYears'] })
        continue
      }
      if (age < 65) continue
      const recipient = opts.householdFacts?.recipientSocialSecurity?.find((row) => row.ownerPersonId === owner)
      const ss = recipient?.grossSocialSecurity ?? (owners.size === 1 ? opts.householdFacts?.householdGrossSocialSecurity : undefined)
      // Maryland offsets all RRB benefits, not only Tier I. A Tier-I-only
      // recipient row cannot prove the owner's total when other RRB exists.
      const householdRrb = opts.householdFacts?.householdGrossRailroadBenefits
      const knownTier1Total = opts.householdFacts?.recipientSocialSecurity?.reduce((sum, row) => sum + row.grossRailroadTier1, 0)
      const rrb = owners.size === 1 ? householdRrb
        : householdRrb === 0 ? 0 : householdRrb !== undefined && knownTier1Total === householdRrb ? recipient?.grossRailroadTier1 : undefined
      if (ss === undefined || rrb === undefined || params.retirementPrivate.capPerPerson === undefined) {
        warnings.push({ code: 'md-pension-benefit-offset-unknown', message: 'Maryland pension exclusion needs the owner gross Social Security and Railroad Retirement benefits.', missingFacts: ['householdGrossSocialSecurity', 'householdGrossRailroadBenefits'] })
        continue
      }
      const cap = Math.max(0, params.retirementPrivate.capPerPerson - Math.max(0, ss) - Math.max(0, rrb))
      const qualifyingIncome = qualifying.reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
      taxableIncomeDelta -= Math.min(cap, Math.max(0, qualifyingIncome - (publicSafetyTaken.get(owner) ?? 0)))
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'NJ') {
    const military = newJerseyMilitaryExemption(distributions)
    taxableIncomeDelta += military.taxableIncomeDelta
    warnings.push(...military.warnings)
    // The pension exclusion of 54A:6-10(b) tests New Jersey gross income
    // after every other adjustment, so it is taken later in
    // computeStateTaxableIncomeResult (newJerseyPensionPayments), not here.
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'DE') {
    const byOwner = new Map<string, StateRetirementDistributionFact[]>()
    for (const fact of distributions) {
      const rows = byOwner.get(fact.ownerPersonId) ?? []
      rows.push(fact)
      byOwner.set(fact.ownerPersonId, rows)
    }
    for (const ownerRows of byOwner.values()) {
      // Box7/penalty classification applies to that distribution, before the
      // owner's annual cap or greater-of comparison aggregates eligible income.
      const rows = ownerRows.filter((fact) => {
        if (fact.earlyDistributionDisqualifier === 'true') return false
        if (fact.earlyDistributionDisqualifier !== 'false') {
          warnings.push({ code: 'de-pension-early-unknown', ruleId: 'de-early-distribution-gate', message: 'Delaware pension exclusion withheld for a distribution with unknown early-distribution status.', missingFacts: ['earlyDistributionDisqualifier'] })
          return false
        }
        return true
      })
      if (rows.length === 0) continue
      if (rows.some((fact) => fact.recipientAgeKnown === false)) {
        warnings.push({ code: 'de-pension-age-unknown', ruleId: 'de-under-60-pension-deduction', message: 'Delaware under-60 pension deduction requires recipient age.', missingFacts: ['recipientAgeYears'] })
        continue
      }
      const age60Plus = rows[0]!.recipientAgeYears >= 60
      const ordinary = rows.filter((fact) => {
        if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') {
          warnings.push({ code: 'de-pension-source-unknown', ruleId: 'de-under-60-pension-deduction', message: 'Delaware pension exclusion requires a characterized qualifying source.', missingFacts: ['sourceKind'] })
          return false
        }
        // Section1106(b)(3): eligible retirement income (including IRA) is
        // an age60+ limb; under60 ordinary relief is employer/government pension.
        // Railroad sources came off in full above (45 U.S.C. 231m) and take
        // no room in either limb.
        return age60Plus
          ? !isMilitarySource(fact.sourceKind) && !isRailroadSource(fact.sourceKind)
          : ['ordinaryPrivatePension', 'employerPlan', 'federalCivilService', 'stateLocalPublic'].includes(fact.sourceKind)
      }).reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
      const military = rows.filter((fact) => isMilitarySource(fact.sourceKind)).reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
      if (age60Plus) {
        const cap = params.retirementPrivate.capPerPerson
        if (cap === undefined) warnings.push({ code: 'de-pension-cap-pack-missing', ruleId: 'de-pension-exclusion-age-60', message: 'Delaware age-60 pension exclusion requires an annual cap from the published parameter set.', missingFacts: ['retirementPrivate.capPerPerson'] })
        else {
          // From 2027, 1106(b)(3) lets a filer 60 or older take the greater of
          // that limb and the capped U.S. military pension.
          const militaryLimb = params.delawareMilitaryPension60Plus === undefined ? 0 : Math.min(params.delawareMilitaryPension60Plus.militaryCap, military)
          taxableIncomeDelta -= Math.max(Math.min(cap, ordinary + military), militaryLimb)
        }
        continue
      }
      const part = delawareUnder60PensionDeduction({ recipientAgeYears: rows[0]!.recipientAgeYears, ordinaryPensionIncluded: ordinary, militaryPensionIncluded: military, earlyDistributionDisqualifier: 'false', ordinaryCap: params.delawareUnder60Pension?.ordinaryCap, militaryCap: params.delawareUnder60Pension?.militaryCap })
      taxableIncomeDelta += part.taxableIncomeDelta
      warnings.push(...part.warnings)
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'DC') {
    for (const fact of distributions) {
      if (fact.recipientAgeKnown === false) {
        warnings.push({ code: 'dc-survivor-age-unknown', ruleId: 'dc-government-survivor-n-ii', message: 'District survivor exclusion requires recipient age.', missingFacts: ['recipientAgeYears'] })
        continue
      }
      const part = dcGovernmentSurvivorExclusion(fact)
      taxableIncomeDelta += part.taxableIncomeDelta
      warnings.push(...part.warnings)
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'KS') {
    const codes = params.kansasNamedPlanCodes
    for (const fact of distributions) {
      const part = kansasNamedPlanExclusion(fact, codes)
      taxableIncomeDelta += part.taxableIncomeDelta
      warnings.push(...part.warnings)
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'VA') {
    const military = virginiaMilitarySubtraction(
      distributions,
      params.virginiaMilitarySubtractionCap ?? 40_000,
    )
    taxableIncomeDelta += military.taxableIncomeDelta
    warnings.push(...military.warnings)
    // Virginia's pack already excludes federally taxable Social Security from
    // the starting base. Only Tier I that entered ordinary income is removed
    // here; applying the SS paragraph again would subtract unrelated income.
    const tier1 = distributions.filter((fact) => fact.sourceKind === 'railroadTier1').reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
    taxableIncomeDelta -= virginiaSsTier1Subtraction({ federallyIncludedSocialSecurity: 0, federallyIncludedRailroadTier1: tier1 })
    // Tier II, the vested dual benefit and the other Railroad Retirement Act
    // annuities came off above under 45 U.S.C. 231m(a).
    const remainingBasis = new Map<string, number>()
    for (const fact of distributions) {
      const enumerated =
        virginiaEnumeratedEmployerPlan(fact) ||
        fact.sourceKind === 'ira' ||
        fact.sourceKind === 'federalCivilService'
      const basisKey = `${fact.ownerPersonId}:${fact.accountId ?? fact.planSystemCode ?? fact.qualifiedPlanType ?? fact.sourceKind}`
      const opening = remainingBasis.get(basisKey) ?? fact.knownPreviouslyTaxedBasis
      const basis = virginiaPriorStateBasisSubtraction({
        enumeratedPlan: enumerated && Boolean(fact.priorTaxState) && fact.priorTaxState !== 'VA' && fact.planSystemCode !== 'VRS',
        federallyIncluded: fact.federallyIncludedAmount,
        knownPriorStateTaxedBasis: opening,
      })
      taxableIncomeDelta += basis.taxableIncomeDelta
      warnings.push(...basis.warnings)
      if (opening !== undefined) remainingBasis.set(basisKey, Math.max(0, opening + basis.taxableIncomeDelta))
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'MA') {
    const part = massachusettsRetirementAdjustment(distributions)
    taxableIncomeDelta += part.taxableIncomeDelta
    warnings.push(...part.warnings)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'UT') {
    const rrb = utahRailroadSubtraction(distributions)
    taxableIncomeDelta += rrb.taxableIncomeDelta
    warnings.push(...rrb.warnings)
    const remainingBasis = new Map<string, number>()
    for (const fact of distributions) {
      const key = `${fact.ownerPersonId}:${fact.accountId ?? fact.planSystemCode ?? '401a'}`
      const opening = remainingBasis.get(key) ?? fact.knownPreviouslyTaxedBasis
      const prior = utahPriorTaxed401aSubtraction({
        qualifiedPlanType: fact.qualifiedPlanType,
        federallyIncluded: fact.federallyIncludedAmount,
        documentedRemainingOtherStateTaxedContribution: opening,
      })
      taxableIncomeDelta += prior.taxableIncomeDelta
      warnings.push(...prior.warnings)
      if (opening !== undefined) remainingBasis.set(key, Math.max(0, opening + prior.taxableIncomeDelta))
    }
    // Credits applied after precredit tax in computeStateTaxDetailResult.
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'WV') {
    const pub = westVirginiaPublicMilitary(distributions, params.westVirginiaExemptions)
    taxableIncomeDelta += pub.taxableIncomeDelta
    warnings.push(...pub.warnings)
    for (const row of opts.householdFacts?.ownerStateTaxFacts ?? []) {
      if (row.westVirginiaEligibleAge65OrDisabled === undefined && row.westVirginiaSurvivorEligible === undefined) {
        warnings.push({ code: 'wv-c9-eligibility-unknown', ruleId: 'wv-11-21-12-c-9', message: 'West Virginia c(9) requires owner age/disability or survivor qualification.', missingFacts: ['ownerStateTaxFacts.westVirginiaEligibleAge65OrDisabled'] })
        continue
      }
      if (row.westVirginiaRemainingFederalAgiIncome === undefined || row.westVirginiaPriorNamedModifications === undefined) {
        warnings.push({ code: 'wv-c9-ledger-unknown', ruleId: 'wv-11-21-12-c-9', message: 'West Virginia c(9) requires owner remaining AGI and named-prior-modification ledger.', missingFacts: ['ownerStateTaxFacts.westVirginiaRemainingFederalAgiIncome', 'ownerStateTaxFacts.westVirginiaPriorNamedModifications'] })
        continue
      }
      taxableIncomeDelta -= westVirginiaAge65Modification({ eligible: row.westVirginiaEligibleAge65OrDisabled === true || row.westVirginiaSurvivorEligible === true, remainingOwnerFederalAgiIncome: row.westVirginiaRemainingFederalAgiIncome, priorNamedModifications: row.westVirginiaPriorNamedModifications, config: params.westVirginiaExemptions })
    }
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'ID') {
    const facts = opts.householdFacts
    if (!facts?.stateFilingStatus || facts.householdGrossSocialSecurity === undefined || facts.householdGrossRailroadBenefits === undefined) {
      warnings.push({ code: 'id-retirement-facts-incomplete', ruleId: 'idaho-63-3022a-qualified-retirement', message: 'Idaho retirement deduction requires full filing status and household Social Security/Railroad totals.', missingFacts: ['stateFilingStatus', 'householdGrossSocialSecurity', 'householdGrossRailroadBenefits'] })
      return { taxableIncomeDelta, taxCredit, warnings }
    }
    const qualifyingRows = distributions.filter((fact) => {
      const ageKnown = fact.recipientAgeKnown !== false
      if (isMilitarySource(fact.sourceKind)) return fact.recipientDisabled === true || (ageKnown && fact.recipientAgeYears >= 62) || fact.idahoEmploymentRequiresFederalReturn === true
      const ageOrDisability = ageKnown && (fact.recipientAgeYears >= 65 || (fact.recipientAgeYears >= 62 && fact.recipientDisabled === true))
      if (!ageOrDisability) return false
      if (fact.sourceKind === 'federalCivilService') {
        return fact.planSystemCode === 'CSRS' || fact.planSystemCode === 'FSRDS'
      }
      return fact.sourceKind === 'stateLocalPublic' && (
        fact.planSystemCode === 'ID-POLICE-FIRE' || fact.planSystemCode === 'IDAHO-POLICE-FIRE'
      )
    })
    const qualifying = qualifyingRows.reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
    const hasUnprovenPotential = distributions.some((fact) =>
      fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic' ||
      fact.sourceKind === 'militaryRetirement' || fact.sourceKind === 'militarySurvivor',
    ) && qualifyingRows.length === 0
    const part = idahoQualifiedRetirementDeduction({ filingStatus: facts.stateFilingStatus, qualifyingFederallyIncludedBenefits: qualifying, householdGrossSocialSecurity: facts.householdGrossSocialSecurity, householdGrossRailroadBenefits: facts.householdGrossRailroadBenefits, factsProveQualifyingPlan: !hasUnprovenPotential, caps: params.idahoQualifiedRetirementCaps })
    taxableIncomeDelta += part.taxableIncomeDelta
    warnings.push(...part.warnings)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'MO') {
    taxableIncomeDelta -= missouriMilitaryAndRailroad(distributions)
    const facts = opts.householdFacts
    if (!facts?.stateFilingStatus || facts.missouriIncome === undefined) {
      warnings.push({ code: 'mo-retirement-facts-incomplete', ruleId: 'mo-retirement-deductions', message: 'Missouri retirement deductions require Missouri income and full filing status.', missingFacts: ['missouriIncome', 'stateFilingStatus'] })
      return { taxableIncomeDelta, taxCredit, warnings }
    }
    const byOwner = new Map<string, StateRetirementDistributionFact[]>()
    for (const fact of distributions) {
      const rows = byOwner.get(fact.ownerPersonId) ?? []
      rows.push(fact)
      byOwner.set(fact.ownerPersonId, rows)
    }
    let privateDeduction = 0
    let publicDeduction = 0
    for (const rows of byOwner.values()) {
      const privatePension = rows.filter((fact) => fact.sourceKind === 'ordinaryPrivatePension' || fact.sourceKind === 'ira' || fact.sourceKind === 'employerPlan').reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
      const publicPension = rows.filter((fact) => fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic').reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
      privateDeduction += missouriPrivatePensionDeduction({ filingStatus: facts.stateFilingStatus, missouriIncome: facts.missouriIncome, privatePension, config: params.missouriRetirement })
      if (publicPension > 0) {
        const ownerOffset = rows.every((row) => row.taxableSocialSecurityAllocated !== undefined)
          ? rows.reduce((sum, row) => sum + Math.max(0, row.taxableSocialSecurityAllocated ?? 0), 0)
          : byOwner.size === 1 ? facts.federallyIncludedSocialSecurity : undefined
        if (ownerOffset === undefined) warnings.push({ code: 'mo-public-ss-offset-unknown', message: 'Missouri public pension subtraction requires the owner Social Security subtraction.', missingFacts: ['taxableSocialSecurityAllocated'] })
        else publicDeduction += missouriPublicPensionDeduction({ publicPension, socialSecuritySubtraction: ownerOffset, config: params.missouriRetirement })
      }
    }
    taxableIncomeDelta -= privateDeduction + publicDeduction
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'VT') {
    const facts = opts.householdFacts
    if (facts?.federalAgi === undefined || !facts.stateFilingStatus) {
      warnings.push({ code: 'vt-retirement-facts-unknown', ruleId: 'vt-5830e-retirement-exclusions', message: 'Vermont retirement exclusions require AGI, filing status, and the civil-service/Social Security election.', missingFacts: ['federalAgi', 'stateFilingStatus', 'vermontRetirementElection'] })
      return { taxableIncomeDelta, taxCredit, warnings }
    }
    const electionImmaterial = vermontCompetingBenefitsProvedZero(distributions, facts, params)
    if (!electionImmaterial && !facts.vermontRetirementElection) {
      warnings.push({ code: 'vt-retirement-facts-unknown', ruleId: 'vt-5830e-retirement-exclusions', message: 'Vermont retirement exclusions require AGI, filing status, and the civil-service/Social Security election.', missingFacts: ['federalAgi', 'stateFilingStatus', 'vermontRetirementElection'] })
      return { taxableIncomeDelta, taxCredit, warnings }
    }
    const agi = facts.federalAgi
    const joint =
      facts.stateFilingStatus === 'marriedFilingJointly' ||
      facts.stateFilingStatus === 'qualifyingSurvivingSpouse'
    let civil = 0
    let military = 0
    for (const fact of distributions) {
      if ((fact.sourceKind === 'federalCivilService' && fact.planSystemCode === 'CSRS') || ((fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic') && fact.publicPlanContributory === true && fact.earningsNotCoveredBySocialSecurity === true && fact.planSystemCode !== 'FERS')) {
        civil += Math.max(0, fact.federallyIncludedAmount)
      }
      if ((fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'stateLocalPublic') && fact.planSystemCode !== 'CSRS' && fact.planSystemCode !== 'FERS' && fact.publicPlanContributory !== false && fact.earningsNotCoveredBySocialSecurity === undefined) {
        warnings.push({ code: 'vt-contributory-coverage-unknown', message: 'Vermont government retirement exclusion requires proof of earnings not covered by Social Security.', missingFacts: ['earningsNotCoveredBySocialSecurity'] })
      }
      if (isMilitarySource(fact.sourceKind)) {
        military += Math.max(0, fact.federallyIncludedAmount)
      }
    }
    if (!electionImmaterial && facts.vermontRetirementElection === 'civilService') {
      taxableIncomeDelta -= vermontCivilServiceExclusion({
        joint,
        federalAgi: agi,
        includedAmount: civil,
        config: params.vermontExtras,
      })
    } else if (!electionImmaterial && facts.vermontRetirementElection === 'socialSecurity') {
      if (facts.federallyIncludedSocialSecurity === undefined) {
        warnings.push({ code: 'vt-social-security-facts-unknown', ruleId: 'vt-5830e-social-security-inclusion', message: 'Vermont Social Security election requires the federally included Social Security amount.', missingFacts: ['federallyIncludedSocialSecurity'] })
      } else {
        const fullThrough = joint ? params.vermontExtras?.civilServiceFullThroughJoint : params.vermontExtras?.civilServiceFullThroughNonjoint
        const zeroAt = joint ? params.vermontExtras?.civilServiceZeroAtJoint : params.vermontExtras?.civilServiceZeroAtNonjoint
        if (fullThrough === undefined || zeroAt === undefined) warnings.push({ code: 'vt-social-security-pack-missing', ruleId: 'vt-5830e-social-security-inclusion', message: 'Vermont Social Security election requires its phaseout figures from the published parameter set.', missingFacts: ['vermontExtras'] })
        else {
          const factor = agi <= fullThrough ? 1 : agi >= zeroAt ? 0 : (zeroAt - agi) / (zeroAt - fullThrough)
          taxableIncomeDelta -= Math.max(0, facts.federallyIncludedSocialSecurity) * factor
        }
      }
    }
    taxableIncomeDelta -= vermontMilitaryExclusion({
      federalAgi: agi,
      includedAmount: military,
      config: params.vermontExtras,
    })
    taxableIncomeDelta -= vermontRailroadExclusion(distributions)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'CO') {
    if (opts.householdFacts?.federalAgi === undefined || !opts.householdFacts.stateFilingStatus) {
      warnings.push({ code: 'co-ss-pension-facts-missing', ruleId: 'co-ss-pension-shared-cap', message: 'Colorado SS/pension subtraction requires federal AGI and filing status.', missingFacts: ['federalAgi', 'stateFilingStatus'] })
      return { taxableIncomeDelta, taxCredit, warnings }
    }
    const recipientFacts = opts.householdFacts.recipientSocialSecurity
    const owners = new Set([...distributions.map((row) => row.ownerPersonId), ...(recipientFacts ?? []).map((row) => row.ownerPersonId)])
    const recipients = [...owners].map((ownerPersonId) => {
      const owned = distributions.filter((row) => row.ownerPersonId === ownerPersonId)
      const ssRow = recipientFacts?.find((row) => row.ownerPersonId === ownerPersonId)
      const ownerRow = opts.householdFacts?.ownerStateTaxFacts?.find((row) => row.ownerPersonId === ownerPersonId)
      const age = owned.find((row) => row.recipientAgeKnown !== false)?.recipientAgeYears ?? ssRow?.ageYears ?? ownerRow?.recipientAgeYears
      if (age === undefined) warnings.push({ code: 'co-recipient-age-unknown', message: 'Colorado retirement subtraction requires known recipient age.', missingFacts: ['ownerStateTaxFacts.recipientAgeYears'] })
      const allocations = [...new Set(owned.flatMap((row) => row.taxableSocialSecurityAllocated === undefined ? [] : [row.taxableSocialSecurityAllocated]))]
      // Legacy owner allocation repeats on source events; it is one annual
      // owner fact, not an amount to sum for every withdrawal.
      const included = ssRow?.federallyIncludedSocialSecurity ?? (allocations.length === 1 ? allocations[0]
        : opts.householdFacts?.federallyIncludedSocialSecurity === 0 ? 0 : undefined)
      if (included === undefined || allocations.length > 1) warnings.push({ code: 'co-ss-allocation-unknown', message: 'Colorado needs one reconciled annual Social Security inclusion per recipient.', missingFacts: ['recipientSocialSecurity.federallyIncludedSocialSecurity'] })
      const pension = owned.filter((row) => ['ordinaryPrivatePension', 'ira', 'employerPlan', 'federalCivilService', 'stateLocalPublic'].includes(row.sourceKind)).reduce((sum, row) => sum + Math.max(0, row.federallyIncludedAmount), 0)
      return { ownerPersonId, ageYears: age ?? 0, taxableSocialSecurityAllocated: Math.max(0, included ?? 0), qualifyingPensionAnnuity: pension,
        deathOrDisabilitySurvivorUnder55: owned.some((row) => row.deathOrDisabilitySurvivorUnder55 === true) }
    })
    const part = coloradoSsPensionSubtraction({
      config: params.coloradoRetirement,
      filingStatus: opts.householdFacts.stateFilingStatus === 'marriedFilingJointly' ? 'marriedFilingJointly' : 'single',
      federalAgi: opts.householdFacts.federalAgi,
      recipients,
    })
    taxableIncomeDelta += part.taxableIncomeDelta
    taxableIncomeDelta -= coloradoRailroadSubtraction(distributions)
    return { taxableIncomeDelta, taxCredit, warnings }
  }

  if (code === 'CA' && params.californiaMilitaryExclusions) {
    const part = californiaMilitaryExclusions({
      config: params.californiaMilitaryExclusions,
      joint: context.joint,
      federalAgi: context.federal().agi,
      distributions,
    })
    taxableIncomeDelta += part.taxableIncomeDelta
    warnings.push(...part.warnings)
  }

  // Railroad sources came off at the top under 45 U.S.C. 231m(a) and are in
  // neither retirement pool below.
  // Rhode Island 44-30-12(c)(11): military service pensions in full, with no
  // age or AGI test, so before the (c)(9) AGI test returns.
  if (code === 'RI') {
    taxableIncomeDelta -= rhodeIslandMilitaryServicePensionModification(distributions)
  }

  // Rhode Island 44-30-12(c)(9): no pension modification at or above the
  // Social Security modification's AGI limit, and the Division's instructions
  // leave IRA distributions out of it, and military service pensions, which
  // (c)(11) subtracts above and (c)(11)(iii) keeps from being counted twice.
  if (code === 'RI' && params.rhodeIslandSocialSecurityModification && !rhodeIslandPensionModificationAllowed({
    config: params.rhodeIslandSocialSecurityModification,
    joint: context.joint,
    federalAgi: context.federal().agi,
  })) {
    return { taxableIncomeDelta, taxCredit, warnings }
  }
  const eligibleDistributions = code === 'RI'
    ? distributions.filter((fact) => fact.sourceKind !== 'ira' && !isMilitarySource(fact.sourceKind))
    : distributions

  // Most default pack caps are per recipient (KY, AL, GA, ME, NY, OK,
  // RI), so another spouse's unused exclusion cannot shelter this owner's
  // conversion or withdrawal. Michigan's current maximum is instead a
  // combined qualifying-benefit limit on the joint return (MI domain note).
  const byOwner = new Map<string, StateRetirementDistributionFact[]>()
  for (const fact of eligibleDistributions) {
    if (!fact.ownerPersonId?.trim()) {
      warnings.push({ code: 'state-retirement-owner-unknown', message: 'Retirement exclusion requires the recipient owner; an unused household cap cannot establish entitlement.', missingFacts: ['ownerPersonId'] })
      continue
    }
    const key = code === 'MI' ? 'michigan-return' : fact.ownerPersonId
    const rows = byOwner.get(key) ?? []
    rows.push(fact)
    byOwner.set(key, rows)
  }
  for (const rows of byOwner.values()) {
    // Pennsylvania does not tax a traditional IRA converted to a Roth IRA when
    // the whole amount goes into the Roth (2025 PA-40 instructions), at any
    // age, so it comes off before the age-60 exclusion below and stays out of
    // that pool (pa-40-roth-ira-conversion-not-taxable).
    if (code === 'PA') {
      taxableIncomeDelta -= rows.filter((row) => row.sourceKind === 'ira').reduce((sum, row) => sum + rothConversionPart(row), 0)
    }
    // Connecticut subtracts IRA distributions, a conversion among them, on its
    // own federal-AGI schedule (12-701(a)(20)(B)(xxviii) and (xxix)); the
    // other retirement income stays with the pack's rule below.
    if (code === 'CT' && params.connecticutIraDistributionSchedule) {
      const iraIncluded = rows.filter((row) => row.sourceKind === 'ira').reduce((sum, row) => sum + Math.max(0, row.federallyIncludedAmount), 0)
      taxableIncomeDelta -= iraIncluded * connecticutIraSubtractionFraction(
        params.connecticutIraDistributionSchedule,
        context.married,
        context.federal().agi,
      )
    }
    const poolAmount = (row: StateRetirementDistributionFact): number => {
      const included = Math.max(0, row.federallyIncludedAmount)
      const conversion = rothConversionPart(row)
      if (conversion === 0) return included
      // Maine: a conversion is not a retirement benefit received
      // (me-1040me-roth-conversion-not-pension-income).
      if (code === 'ME') return included - conversion
      // Michigan and New York: a conversion counts only if the owner was 59
      // and a half when it happened (mi-treasury-roth-conversion-at-59-and-a-half,
      // ny-tsb-m-98-7-i-roth-conversion-at-59-and-a-half).
      if (code === 'MI' || code === 'NY') return included - conversion + rothConversionPartAtAge59HalfOrOlder(row)
      if (code === 'PA' && row.sourceKind === 'ira') return included - conversion
      return included
    }
    const privateAmt = rows
      .filter((row) => ['ordinaryPrivatePension', 'ira', 'employerPlan', 'unknownPrivate'].includes(row.sourceKind))
      .filter((row) => !(code === 'CT' && params.connecticutIraDistributionSchedule && row.sourceKind === 'ira'))
      .reduce((sum, row) => sum + poolAmount(row), 0)
    const publicAmt = rows.filter((row) => ['federalCivilService', 'stateLocalPublic', 'militaryRetirement', 'militarySurvivor', 'unknownPublic'].includes(row.sourceKind)).reduce((sum, row) => sum + Math.max(0, row.federallyIncludedAmount), 0)
    const ages = [...new Set(rows.filter((row) => row.recipientAgeKnown !== false).map((row) => row.recipientAgeYears))]
    const ageRequired = (privateAmt > 0 && params.retirementPrivate.minAge !== undefined) || (publicAmt > 0 && params.retirementPublic.minAge !== undefined)
    const usedAgeGates = [privateAmt > 0 ? params.retirementPrivate.minAge : undefined, publicAmt > 0 ? params.retirementPublic.minAge : undefined].filter((gate): gate is number => gate !== undefined)
    const ageEligibilityConflicts = usedAgeGates.some((gate) => ages.some((age) => age >= gate) && ages.some((age) => age < gate))
    if (code !== 'MI' && ageRequired && (ages.length === 0 || ageEligibilityConflicts)) {
      warnings.push({ code: 'state-retirement-recipient-age-unknown', message: 'Age-gated retirement exclusion requires this recipient age, not another household member age.', missingFacts: ['recipientAgeYears'] })
      continue
    }
    const recipientAges = code === 'MI' ? agesAlive : [ages.length ? Math.min(...ages) : 0]
    if (params.retirementRuleShared) {
      taxableIncomeDelta -= retirementExclusion(params.retirementPrivate, privateAmt + publicAmt, recipientAges)
    } else {
      taxableIncomeDelta -= retirementExclusion(params.retirementPrivate, privateAmt, recipientAges)
      taxableIncomeDelta -= retirementExclusion(params.retirementPublic, publicAmt, recipientAges)
    }
  }
  return { taxableIncomeDelta, taxCredit, warnings }
}

function accumulateLeaf(
  into: { taxableIncomeDelta: number; taxCredit: number; warnings: StateTaxExactnessWarning[] },
  part: StateLeafAdjustment,
): void {
  into.taxableIncomeDelta += part.taxableIncomeDelta
  into.taxCredit += part.taxCredit
  into.warnings.push(...part.warnings)
}

/**
 * Rich taxable-income computation: accumulates every selected leaf warning and
 * credit. Numeric `computeStateTaxableIncome` is a view over this result.
 */
export function computeStateTaxableIncomeResult(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): TaxableIncomeComputation {
  if (!params.hasIncomeTax) {
    return { taxableIncome: 0, taxCredit: 0, warnings: [] }
  }
  const taxStatus = taxParameterFilingStatus(input.filingStatus)
  const ordinary = Math.max(0, input.ordinaryIncome)
  const qualifiedDividends = Math.max(0, input.qualifiedDividends ?? 0)
  const netCapital =
    params.capitalLossCarryforwardConformity === 'currentYearOnly'
      ? Math.max(0, input.realizedCapitalGainsBeforeCarryforward ?? input.capitalGains)
      : input.capitalGains
  const taxableCapitalPct = (params.capitalGainsTaxablePct ?? (params.capitalGainsAsOrdinary ? 100 : 0)) / 100
  const ss = Math.max(0, input.ssBenefits)
  const usGovInterest = Math.min(ordinary, Math.max(0, input.usGovernmentInterest ?? 0))

  let taxable = ordinary - usGovInterest + qualifiedDividends
  if (taxableCapitalPct > 0) taxable += netCapital * taxableCapitalPct
  let includedSocialSecurity = 0
  if (params.taxesSocialSecurity && ss > 0) {
    if (opts.taxableSocialSecurityOverride !== undefined) {
      includedSocialSecurity = Math.max(0, opts.taxableSocialSecurityOverride)
    } else {
      const { pack } = packForYear(input.year)
      includedSocialSecurity = taxableSocialSecurity(
        pack,
        taxStatus,
        ordinary + qualifiedDividends + netCapital,
        ss,
        input.taxExemptInterest,
        input.foreignExclusionAddback,
      )
    }
    taxable += includedSocialSecurity
  }

  const acc = { taxableIncomeDelta: 0, taxCredit: 0, warnings: [] as StateTaxExactnessWarning[] }
  const federal = federalFactsFor(input, opts)
  const joint = taxStatus === 'marriedFilingJointly'
  if (params.rhodeIslandSocialSecurityModification && includedSocialSecurity > 0) {
    accumulateLeaf(acc, rhodeIslandSocialSecurityModification({
      config: params.rhodeIslandSocialSecurityModification,
      joint,
      federalAgi: federal().agi,
      includedSocialSecurity,
      claimantAges: input.agesAlive ?? [],
      ...(opts.householdFacts?.recipientSocialSecurity ? { recipients: opts.householdFacts.recipientSocialSecurity } : {}),
    }))
  }
  if (params.federalSeniorDeduction === 'subtracted' && input.peopleAged65Plus > 0) {
    accumulateLeaf(acc, federalSeniorDeductionSubtraction({ federalSeniorDeduction: federal().seniorDeduction }))
  }
  if (params.code === 'WV' && input.year < (params.westVirginiaSocialSecurity?.fullExclusionFrom ?? 2026)) {
    const facts = opts.householdFacts
    const config = params.westVirginiaSocialSecurity
    if (!config || config.aboveThresholdFractionByYear[input.year] === undefined || facts?.federalAgi === undefined || facts.federallyIncludedSocialSecurity === undefined) {
      acc.warnings.push({ code: 'wv-historical-ss-incomplete', message: 'Historical WV Social Security adjustment requires a supported year, federal AGI and federally included benefits.', missingFacts: ['supportedTaxYear', 'federalAgi', 'federallyIncludedSocialSecurity'] })
    } else {
      const included = Math.max(0, facts.federallyIncludedSocialSecurity)
      // The current WV starting pack excludes SS; restore only the historical taxable remainder.
      acc.taxableIncomeDelta += included - westVirginiaSocialSecuritySubtraction({ taxYear: input.year, filingStatus: facts.stateFilingStatus ?? input.filingStatus, federalAgi: facts.federalAgi, federallyIncludedSocialSecurity: included, config })
    }
  }
  const privateRetirement = input.privateRetirementIncome ?? input.retirementIncome ?? 0
  const publicPension = input.publicPensionIncome ?? 0
  const agesAlive = input.agesAlive ?? []
  const distributions = resolvedDistributions(opts)
  if (distributions !== undefined) {
    const characterized = characterizedRetirementDelta(params, distributions, agesAlive, opts, { federal, joint, married: input.filingStatus === 'marriedFilingJointly' })
    accumulateLeaf(acc, {
      taxableIncomeDelta: characterized.taxableIncomeDelta,
      taxCredit: characterized.taxCredit,
      warnings: characterized.warnings,
    })
  } else if (params.code === 'RI' && params.rhodeIslandSocialSecurityModification && !rhodeIslandPensionModificationAllowed({
    config: params.rhodeIslandSocialSecurityModification,
    joint,
    federalAgi: federal().agi,
  })) {
    // Rhode Island 44-30-12(c)(9): no pension modification at or above the limit.
  } else if (params.retirementRuleShared) {
    taxable -= retirementExclusion(params.retirementPrivate, privateRetirement + publicPension, agesAlive)
  } else {
    taxable -= retirementExclusion(params.retirementPrivate, privateRetirement, agesAlive)
    taxable -= retirementExclusion(params.retirementPublic, publicPension, agesAlive)
  }

  // HSA: collection preferred; legacy singular accepted.
  if (params.hsaConformity === 'nonconformingCalifornia') {
    if (opts.hsaAccounts !== undefined) {
      accumulateLeaf(acc, californiaHsaCollectionAdjustment(opts.hsaAccounts))
    } else if (opts.hsaFacts) {
      accumulateLeaf(acc, californiaHsaAdjustment(opts.hsaFacts))
    } else accumulateLeaf(acc, californiaHsaCollectionAdjustment(undefined))
  } else if (params.hsaConformity === 'newJerseyCategories') {
    if (opts.hsaAccounts !== undefined) {
      accumulateLeaf(acc, newJerseyHsaCollectionAdjustment(opts.hsaAccounts))
    } else if (opts.hsaFacts) {
      accumulateLeaf(acc, newJerseyHsaAdjustment(opts.hsaFacts))
    } else accumulateLeaf(acc, newJerseyHsaCollectionAdjustment(undefined))
  }

  // QCD: pack policy is authoritative unconditionally.
  if (opts.qcdEvents !== undefined) {
    accumulateLeaf(
      acc,
      stateDirectQcdCollectionAdjustment({
        events: opts.qcdEvents,
        packPolicy: params.directQcdPolicy,
        njPools: opts.njIraOwnerPools,
      }),
    )
  } else if (opts.qcdFacts) {
    accumulateLeaf(acc, stateDirectQcdAdjustment(opts.qcdFacts, params.directQcdPolicy))
  } else if (params.directQcdPolicy !== undefined) {
    acc.warnings.push({
      code: 'state-qcd-annual-activity-unavailable',
      ruleId: 'state-direct-qcd-conformity',
      message: 'State QCD result requires an explicit known-empty annual event collection when no QCD occurred.',
      missingFacts: ['qcdEvents'],
    })
  }

  if (params.code === 'CO' && params.highAgiFederalDeductionAddback && opts.householdFacts?.federalAgi !== undefined) {
    const deductionUsed = opts.householdFacts.federalDeductionUsed
    if (deductionUsed !== undefined) {
      accumulateLeaf(
        acc,
        coloradoHighAgiFederalDeductionAddback({
          federalAgi: opts.householdFacts.federalAgi,
          federalDeductionUsed: deductionUsed,
          config: params.highAgiFederalDeductionAddback,
          joint: taxStatus === 'marriedFilingJointly',
        }),
      )
    } else {
      acc.warnings.push({
        code: 'co-federal-deduction-unknown',
        ruleId: 'co-high-agi-federal-deduction-addback',
        message: 'Colorado high-AGI federal deduction addback incomplete without federalDeductionUsed.',
        missingFacts: ['federalDeductionUsed'],
      })
    }
  } else if (params.code === 'CO' && params.highAgiFederalDeductionAddback) {
    acc.warnings.push({ code: 'co-federal-agi-unknown', ruleId: 'co-high-agi-federal-deduction-addback', message: 'Colorado high-AGI federal deduction addback requires federal AGI and deduction facts.', missingFacts: ['federalAgi', 'federalDeductionUsed'] })
  }

  // New Jersey 54A:6-10(b): the pension exclusion tests New Jersey gross
  // income (NJ-1040 line 27), read here as the base after every adjustment
  // above, so it comes after them.
  if (params.newJerseyPensionExclusion) {
    const payments = newJerseyPensionPayments(params.newJerseyPensionExclusion.minAge, input, distributions)
    acc.warnings.push(...payments.warnings)
    accumulateLeaf(acc, newJerseyPensionExclusion({
      config: params.newJerseyPensionExclusion,
      married: input.filingStatus === 'marriedFilingJointly',
      grossIncome: taxable + acc.taxableIncomeDelta,
      payments: payments.payments,
      qualifyingPayments: payments.qualifyingPayments,
    }))
  }

  const preExemptionReliefBound = taxable + acc.taxableIncomeDelta
  const standardDeductionOverrideAllowsZeroProof =
    opts.standardDeductionAllowedOverride === undefined || opts.standardDeductionAllowedOverride >= 0

  if (params.code === 'CT' && opts.householdFacts?.connecticutAgi !== undefined && opts.householdFacts.stateFilingStatus) {
    taxable -= connecticutPersonalExemption({
      filingStatus: opts.householdFacts.stateFilingStatus,
      connecticutAgi: opts.householdFacts.connecticutAgi,
      schedule: params.connecticutPersonalExemption,
    })
  } else if (
    params.code === 'CT' &&
    !(preExemptionReliefBound <= 0 && standardDeductionOverrideAllowsZeroProof)
  ) {
    acc.warnings.push({ code: 'ct-personal-exemption-incomplete', ruleId: 'ct-personal-exemption-ws4d', message: 'Connecticut personal exemption requires Connecticut AGI and full filing status.', missingFacts: ['connecticutAgi', 'stateFilingStatus'] })
  }

  if (params.code === 'IL' && opts.householdFacts?.federalAgi !== undefined) {
    const ilExemption = params.illinoisPersonalExemption
    const joint = taxStatus === 'marriedFilingJointly'
    const belowAgiCutoff = ilExemption !== undefined &&
      opts.householdFacts.federalAgi <= (joint ? ilExemption.agiCutoffJoint : ilExemption.agiCutoffNonjoint)
    const ilExemptionCountsMissing =
      opts.householdFacts.exemptionTaxpayerCount === undefined ||
      opts.householdFacts.exemptionDependentCount === undefined ||
      opts.householdFacts.age65EligibleCount === undefined
    const ilExemptionProvedImmaterial =
      belowAgiCutoff &&
      ilExemptionCountsMissing &&
      preExemptionReliefBound <= 0 &&
      standardDeductionOverrideAllowsZeroProof
    if (!ilExemptionProvedImmaterial) {
      accumulateLeaf(
        acc,
        illinoisPersonalExemptionAllowance({
          federalAgi: opts.householdFacts.federalAgi,
          joint,
          eligibleTaxpayerCount: opts.householdFacts.exemptionTaxpayerCount,
          eligibleDependentCount: opts.householdFacts.exemptionDependentCount,
          age65EligibleCount: opts.householdFacts.age65EligibleCount,
          config: ilExemption,
        }),
      )
    }
  } else if (params.code === 'IL') {
    acc.warnings.push({ code: 'il-exemption-agi-unknown', ruleId: 'il-personal-exemption-allowance', message: 'Illinois personal exemption requires federal AGI and household counts.', missingFacts: ['federalAgi', 'householdFacts'] })
  }

  if (
    params.code === 'WI' &&
    preExemptionReliefBound <= 0 &&
    standardDeductionOverrideAllowsZeroProof
  ) {
    // Nonnegative personal exemptions cannot raise taxable income above zero.
  } else if (params.code === 'WI' && opts.householdFacts) {
    accumulateLeaf(
      acc,
      wisconsinPersonalExemption({
        eligibleTaxpayerCount: opts.householdFacts.exemptionTaxpayerCount,
        eligibleDependentCount: opts.householdFacts.exemptionDependentCount,
        age65EligibleCount: opts.householdFacts.age65EligibleCount,
        claimedAsDependent: opts.householdFacts.claimedAsDependent === true,
        config: params.wisconsinStandardDeduction,
      }),
    )
  } else if (params.code === 'WI') {
    acc.warnings.push({ code: 'wi-exemption-facts-unknown', ruleId: 'wi-personal-exemptions', message: 'Wisconsin exemptions require household facts, including claimed-dependent status.', missingFacts: ['householdFacts', 'claimedAsDependent'] })
  }

  if (params.virginiaPersonalExemptions) {
    accumulateLeaf(acc, virginiaPersonalExemptions({
      config: params.virginiaPersonalExemptions,
      exemptionCount: opts.householdFacts?.exemptionTaxpayerCount ?? (joint ? 2 : 1),
      agedTaxpayerCount: virginiaAgedTaxpayerCount(input, opts.householdFacts),
    }))
  }

  // Virginia 58.1-322.03(5): the age deduction comes off income of every
  // kind, so it runs whether or not the year has characterized retirement
  // rows. A qualifying surviving spouse is not married, so the single
  // threshold applies to that return.
  if (params.virginiaAgeDeduction) {
    const claimants = virginiaAgeDeductionClaimants(params.virginiaAgeDeduction, input, opts.householdFacts)
    if (claimants.fullAmount + claimants.incomeTested > 0) {
      accumulateLeaf(acc, virginiaAgeDeduction({
        config: params.virginiaAgeDeduction,
        married: input.filingStatus === 'marriedFilingJointly',
        fullAmountClaimants: claimants.fullAmount,
        incomeTestedClaimants: claimants.incomeTested,
        adjustedFederalAgi: claimants.incomeTested > 0
          ? virginiaAdjustedFederalAgi(input, opts.householdFacts, distributions)
          : 0,
      }))
    }
  }

  if (params.code === 'WV' && opts.householdFacts) {
    accumulateLeaf(
      acc,
      westVirginiaExemptions({
        federalExemptionCount: opts.householdFacts.federalExemptionCount,
        zeroFederalExemptionReason: opts.householdFacts.zeroFederalExemptionReason,
        survivingSpouse: opts.householdFacts.survivingSpouseQualification
          ? {
              deathYear: opts.householdFacts.survivingSpouseQualification.deathYear,
              taxYear: input.year,
              remarried: opts.householdFacts.survivingSpouseQualification.remarried,
            }
          : undefined,
        config: params.westVirginiaExemptions,
      }),
    )
    // TY2026 WV pack already removes Social Security from the base.
  }

  taxable += acc.taxableIncomeDelta

  if (opts.standardDeductionAllowedOverride !== undefined) {
    return {
      taxableIncome: Math.max(0, taxable - opts.standardDeductionAllowedOverride),
      taxCredit: acc.taxCredit,
      warnings: acc.warnings,
    }
  }

  let rawTotal = params.standardDeduction[taxStatus]
  const age65EligibleCount = derivedAge65EligibleCount(opts.householdFacts, input.year)
  if (params.code === 'MA' && opts.householdFacts?.stateFilingStatus && age65EligibleCount !== undefined) {
    rawTotal += massachusettsPersonalExemption({ filingStatus: opts.householdFacts.stateFilingStatus, age65EligibleCount, config: params.massachusettsRates })
  } else if (params.code === 'MA') {
    acc.warnings.push({ code: 'ma-personal-exemption-incomplete', ruleId: 'ma-personal-age-exemptions', message: 'Massachusetts personal and age exemptions require filing status and age-65 count.', missingFacts: ['stateFilingStatus', 'age65EligibleCount'] })
  }
  if (params.code === 'VT') {
    const status = opts.householdFacts?.stateFilingStatus
    const exemptionTaxpayerCount = opts.householdFacts?.exemptionTaxpayerCount
    const section63fQualificationCount = opts.householdFacts?.section63fQualificationCount
    const vtDeductionCountsMissing =
      !status ||
      exemptionTaxpayerCount === undefined ||
      section63fQualificationCount === undefined
    if (
      vtDeductionCountsMissing &&
      !(preExemptionReliefBound <= 0 && standardDeductionOverrideAllowsZeroProof)
    ) {
      acc.warnings.push({ code: 'vt-deduction-exemption-incomplete', ruleId: 'vt-2026-deduction-exemption', message: 'Vermont deductions require full filing status, personal-exemption count, and §63(f) qualification count.', missingFacts: ['stateFilingStatus', 'exemptionTaxpayerCount', 'section63fQualificationCount'] })
    } else if (status && exemptionTaxpayerCount !== undefined && section63fQualificationCount !== undefined) {
      const extras = params.vermontExtras
      const deduction = extras?.standardDeductionByStatus?.[status] ?? (status === 'headOfHousehold' ? 11800 : status === 'marriedFilingSeparately' || status === 'single' ? 7850 : 15700)
      rawTotal = deduction + (extras?.personalExemption ?? 5400) * exemptionTaxpayerCount + (extras?.additional63f ?? 1300) * section63fQualificationCount
    }
  }
  if (params.code === 'SC') {
    const status = opts.householdFacts?.stateFilingStatus
    const agi = opts.householdFacts?.federalAgi
    if (!status || agi === undefined) acc.warnings.push({ code: 'sc-sciad-incomplete', ruleId: 'sc-sciad-deduction', message: 'South Carolina SCIAD deduction requires federal AGI and full filing status.', missingFacts: ['federalAgi', 'stateFilingStatus'] })
    else if (!params.southCarolinaSciad) acc.warnings.push({ code: 'sc-sciad-pack-missing', ruleId: 'sc-sciad-deduction', message: 'South Carolina SCIAD selection requires its annual schedule from the published parameter set.', missingFacts: ['southCarolinaSciad'] })
    else {
      const sciad = scSciadDeduction({ filingStatus: status, federalAgi: agi, config: params.southCarolinaSciad })
      acc.warnings.push(...sciad.warnings)
      rawTotal = sciad.deduction
    }
  }
  if (params.code === 'WI' && params.wisconsinStandardDeduction) {
    const extended =
      opts.householdFacts?.stateFilingStatus ??
      (taxStatus === 'marriedFilingJointly' ? 'marriedFilingJointly' : 'single')
    // Form 1-ES phase-down uses Wisconsin income before the standard deduction.
    // When the integrator has not supplied the worksheet line, use the
    // pre-retirement ordinary/gain base rather than the post-exclusion taxable
    // figure so retirement subtractions do not silently change the SD band.
    const preRetirementBase = ordinary - usGovInterest + qualifiedDividends + netCapital * taxableCapitalPct
    const wiIncome =
      opts.householdFacts?.wisconsinIncomeForStandardDeduction ??
      opts.standardDeductionPhaseoutIncomeOverride ??
      preRetirementBase
    if (
      opts.householdFacts?.wisconsinIncomeForStandardDeduction === undefined &&
      opts.standardDeductionPhaseoutIncomeOverride === undefined &&
      taxable > 0
    ) {
      acc.warnings.push({ code: 'wi-standard-deduction-income-unknown', ruleId: 'wi-2026-standard-deduction', message: 'Wisconsin standard deduction uses a state worksheet income line; reconstructed proxy is incomplete.', missingFacts: ['wisconsinIncomeForStandardDeduction'] })
    }
    rawTotal = wisconsinStandardDeduction({
      filingStatus: extended,
      wisconsinIncome: wiIncome,
      config: params.wisconsinStandardDeduction,
    })
  } else if (params.standardDeductionAge65Addition) {
    rawTotal += age65StandardDeductionAddition(
      params.standardDeductionAge65Addition,
      taxStatus,
      Math.max(0, input.peopleAged65Plus),
    )
  }
  const phaseout = params.standardDeductionPhaseout
  const allowed =
    params.code === 'WI' && params.wisconsinStandardDeduction
      ? rawTotal
      : phaseout
        ? phaseOutStandardDeduction(
            rawTotal,
            opts.standardDeductionPhaseoutIncomeOverride ?? taxable,
            phaseout.startsAt[taxStatus],
            phaseout.range[taxStatus],
          )
        : rawTotal

  const taxableIncome = Math.max(0, taxable - allowed)
  return {
    taxableIncome,
    taxCredit: acc.taxCredit,
    warnings: acc.warnings,
    ordinaryTaxableIncomeBeforeLtcg: taxableIncome,
  }
}

export function computeStateTaxableIncome(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): number {
  return computeStateTaxableIncomeResult(params, input, opts).taxableIncome
}

export function computeStateTaxDetail(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): StateTaxDetail {
  const result = computeStateTaxDetailResult(params, input, opts)
  return {
    taxableIncome: result.taxableIncome,
    stateTax: result.stateTax,
    localTax: result.localTax,
    totalTax: result.totalTax,
  }
}

export function computeStateTaxDetailResult(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): StateTaxComputationResult {
  const income = computeStateTaxableIncomeResult(params, input, opts)
  const warnings: StateTaxExactnessWarning[] = [...income.warnings]
  let taxCredit = income.taxCredit
  const taxStatus = taxParameterFilingStatus(input.filingStatus)
  const extendedStatus = opts.householdFacts?.stateFilingStatus
  const taxableIncome = income.taxableIncome
  let stateTax = 0

  if (params.hasIncomeTax) {
    if (params.code === 'HI' && extendedStatus === 'headOfHousehold') {
      stateTax = hawaiiTaxForStatus({
        filingStatus: 'headOfHousehold',
        taxableIncome,
        singleBrackets: params.brackets.single,
        mfjBrackets: params.brackets.marriedFilingJointly,
        hohBrackets: params.bracketsHeadOfHousehold,
      })
    } else if (params.code === 'MA') {
      stateTax = massachusettsTaxOnTaxableIncome(taxableIncome, params.massachusettsRates)
    } else if (params.code === 'VT') {
      // Prefer pack brackets when present; leaf helper covers HOH/MFS derived tables.
      if (extendedStatus === 'headOfHousehold' || extendedStatus === 'marriedFilingSeparately') {
        stateTax = bracketTax(extendedStatus === 'headOfHousehold' ? (params.bracketsHeadOfHousehold ?? []) : (params.bracketsMarriedFilingSeparately ?? []), taxableIncome)
      } else if (extendedStatus) {
        stateTax = bracketTax(extendedStatus === 'single' ? params.brackets.single : params.brackets.marriedFilingJointly, taxableIncome)
      } else {
        stateTax = bracketTax(params.brackets[taxStatus], taxableIncome)
      }
      const federalAgi = opts.householdFacts?.federalAgi
      const minimumTaxThreshold = params.vermontExtras?.minimumTaxAgiThreshold
      const minimumTaxComparisonImmaterial =
        federalAgi !== undefined &&
        minimumTaxThreshold !== undefined &&
        federalAgi <= minimumTaxThreshold
      const min = vermontMinimumTaxComparison({
        config: params.vermontExtras,
        ordinaryTax: stateTax,
        federalAgi,
        usObligationAdjustment: opts.householdFacts?.vermontUsObligationAdjustment,
      })
      stateTax = min.tax
      warnings.push(...(minimumTaxComparisonImmaterial
        ? min.warnings.filter((warning) => warning.code !== 'vt-minimum-tax-incomplete')
        : min.warnings))
    } else if (params.code === 'WI' && extendedStatus) {
      const brackets =
        extendedStatus === 'headOfHousehold'
          ? (params.bracketsHeadOfHousehold ?? params.brackets.single)
          : extendedStatus === 'marriedFilingSeparately'
            ? (params.bracketsMarriedFilingSeparately ?? params.brackets.single)
            : extendedStatus === 'marriedFilingJointly' || extendedStatus === 'qualifyingSurvivingSpouse'
              ? params.brackets.marriedFilingJointly
              : params.brackets.single
      stateTax = bracketTax(brackets, taxableIncome)
    } else {
      stateTax = bracketTax(params.brackets[taxStatus], taxableIncome)
    }

    // Montana: ordinary tax on ordinary taxable income; LTCG stacked separately.
    if (params.code === 'MT' && params.montanaLtcg && opts.householdFacts?.montanaNetTaxableLtcg !== undefined && extendedStatus) {
      const ltcg = Math.max(0, opts.householdFacts.montanaNetTaxableLtcg)
      const status =
        extendedStatus === 'marriedFilingJointly' || extendedStatus === 'qualifyingSurvivingSpouse'
          ? 'marriedFilingJointly'
          : extendedStatus === 'headOfHousehold'
            ? 'headOfHousehold'
            : extendedStatus === 'marriedFilingSeparately'
              ? 'marriedFilingSeparately'
              : 'single'
      // Ordinary taxable income is the base before adding LTCG into the combined
      // figure; when LTCG was included in capitalGains as ordinary, subtract it
      // back for stacking capacity.
      const ordinaryOnly = Math.max(0, taxableIncome - ltcg)
      const gainTax = montanaLtcgTax({
        filingStatus: status,
        ordinaryTaxableIncome: ordinaryOnly,
        netTaxableLtcg: ltcg,
        config: params.montanaLtcg,
      })
      const ordinaryBrackets = status === 'headOfHousehold'
        ? (params.bracketsHeadOfHousehold ?? [])
        : status === 'marriedFilingSeparately'
          ? (params.bracketsMarriedFilingSeparately ?? [])
          : status === 'marriedFilingJointly'
            ? params.brackets.marriedFilingJointly
            : params.brackets.single
      stateTax = bracketTax(ordinaryBrackets, ordinaryOnly) + gainTax
    } else if (params.code === 'MT' && params.montanaLtcg) {
      warnings.push({ code: 'mt-ltcg-stack-incomplete', ruleId: 'mt-2026-ltcg-separate-schedule', message: 'Montana LTCG pricing requires net taxable LTCG and full filing status.', missingFacts: ['montanaNetTaxableLtcg', 'stateFilingStatus'] })
    }

    if (params.code === 'IA') {
      const alt = iowaAlternateOrMinimumTax({ ordinaryTax: stateTax, filingStatus: extendedStatus ?? (taxStatus === 'marriedFilingJointly' ? 'marriedFilingJointly' : 'single'), testNetIncome: opts.householdFacts?.iowaTestNetIncome, seniorForThreshold: opts.householdFacts?.iowaSeniorForThreshold === true, config: params.iowaAlternateTax, householdFacts: opts.householdFacts, taxableIncome })
      stateTax = alt.tax
      warnings.push(...alt.warnings)
    }

    // An Oregon year whose figures no longer carry the credit (it cannot be
    // claimed for tax years from 2032) prices no credit and asks for no facts.
    if (params.code === 'OR' && params.oregonRetirementIncomeCredit) {
      const facts = opts.householdFacts
      const distributions = resolvedDistributions(opts)
      const tier1 = facts?.recipientSocialSecurity !== undefined
        ? facts.recipientSocialSecurity.reduce((sum, row) => sum + Math.max(0, row.grossRailroadTier1), 0)
        : facts?.householdGrossRailroadBenefits === 0 ? 0 : undefined
      if (distributions !== undefined && oregonRetirementCreditProvedZero(distributions)) {
        // A complete zero qualifying-pension ledger proves a zero credit without
        // Oregon household worksheet income.
      } else if (!facts?.stateFilingStatus || facts.oregonHouseholdIncome === undefined || facts.householdGrossSocialSecurity === undefined || tier1 === undefined || distributions === undefined) {
        warnings.push({ code: 'or-retirement-credit-incomplete', ruleId: 'or-316-157-retirement-income-credit', message: 'Oregon retirement credit requires characterized pension recipients, household income, and TitleII/TierI benefit offsets.', missingFacts: ['retirementDistributions', 'oregonHouseholdIncome', 'householdGrossSocialSecurity', 'recipientSocialSecurity.grossRailroadTier1', 'stateFilingStatus'] })
      } else {
        const eligible = distributions.filter((row) => {
          const pension = ['ordinaryPrivatePension', 'employerPlan', 'ira', 'federalCivilService', 'stateLocalPublic', 'militaryRetirement', 'militarySurvivor', 'governmentSurvivor'].includes(row.sourceKind)
          if (!pension) {
            if (row.sourceKind === 'unknownPublic' || row.sourceKind === 'unknownPrivate') warnings.push({ code: 'or-pension-source-unknown', message: 'Oregon credit requires a characterized qualifying pension source.', missingFacts: ['sourceKind'] })
            return false
          }
          if (row.recipientAgeKnown === false) {
            warnings.push({ code: 'or-pension-recipient-age-unknown', message: 'Oregon credit requires the pension recipient to be62orolder; another household member age does not qualify the pension.', missingFacts: ['recipientAgeYears'] })
            return false
          }
          return row.recipientAgeYears >= 62
        })
        const qualifyingPension = eligible.reduce((sum, row) => sum + Math.max(0, row.federallyIncludedAmount), 0)
        const credit = oregonRetirementIncomeCredit({ recipientAgeYears: eligible.length ? 62 : 0, qualifyingPension, householdSocialSecurityAndTier1: facts.householdGrossSocialSecurity + tier1, householdIncome: facts.oregonHouseholdIncome, joint: facts.stateFilingStatus === 'marriedFilingJointly' || facts.stateFilingStatus === 'qualifyingSurvivingSpouse', precreditOregonTax: stateTax, config: params.oregonRetirementIncomeCredit })
        taxCredit += credit.taxCredit
        warnings.push(...credit.warnings)
      }
    }

    // Utah nonrefundable credits after precredit tax.
    if (params.code === 'UT') {
      const knownDistributions = resolvedDistributions(opts)
      const distributions = knownDistributions ?? []
      const config = params.utahRetirementCredits
      if (!config) {
        warnings.push({ code: 'ut-credit-pack-missing', ruleId: 'ut-retirement-credits', message: 'Utah credit calculation requires a published set of Utah credit parameters.', missingFacts: ['utahRetirementCredits'] })
      } else {
      const facts = opts.householdFacts
      const militaryAmt = utahOrVirginiaMilitaryFromFacts(distributions)
      const military = utahMilitaryRetirementCredit({
        federallyIncludedMilitaryRetirement: militaryAmt,
        taxRate: config.taxRate,
      })
      const utahMagi = facts?.federalAgi === undefined || facts.interestExcludedFromFederalAgi === undefined || facts.utahSection59_10_114Additions === undefined
        ? undefined
        : facts.federalAgi + facts.interestExcludedFromFederalAgi + facts.utahSection59_10_114Additions
      const taxableSsEnteringUtah = params.taxesSocialSecurity
        ? opts.taxableSocialSecurityOverride ?? taxableSocialSecurity(
            packForYear(input.year).pack,
            taxStatus,
            Math.max(0, input.ordinaryIncome) + Math.max(0, input.qualifiedDividends ?? 0) + input.capitalGains,
            Math.max(0, input.ssBenefits),
            input.taxExemptInterest,
            input.foreignExclusionAddback,
          )
        : 0
      const rrbSubtracted = distributions
        .filter((fact) => isRailroadSource(fact.sourceKind))
        .reduce((sum, fact) => sum + Math.max(0, fact.federallyIncludedAmount), 0)
      const ssWarnings: StateTaxExactnessWarning[] = []
      const rrbOverlap = facts?.railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome
      const ssBase = facts?.socialSecurityIncludedInUtahTaxableIncome === undefined
        ? undefined
        : rrbSubtracted > 0 && rrbOverlap === undefined
          ? undefined
          : Math.max(0, facts.socialSecurityIncludedInUtahTaxableIncome - (rrbOverlap ?? 0))
      if (rrbSubtracted > 0 && rrbOverlap === undefined) {
        ssWarnings.push({ code: 'ut-ss-rrb-overlap-unknown', ruleId: 'ut-59-10-1042-social-security-credit', message: 'Utah Social Security credit cannot assume zero RRB overlap after an RRA subtraction.', missingFacts: ['railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome'] })
      }
      if (ssBase !== undefined && ssBase > taxableSsEnteringUtah) {
        ssWarnings.push({ code: 'ut-ss-credit-base-exceeds-taxable-ss', ruleId: 'ut-59-10-1042-social-security-credit', message: 'Utah Social Security credit base cannot exceed Social Security entering Utah taxable income.', missingFacts: ['socialSecurityIncludedInUtahTaxableIncome'] })
      }
      const retirement = utahRetirementCredit({
        claimantDatesOfBirth: facts?.claimantDatesOfBirth,
        utahMagi,
        filingStatus: facts?.stateFilingStatus,
        config,
      })
      const ssCredit = utahSocialSecurityCredit({
        socialSecurityIncludedInUtahTaxableIncome: ssBase === undefined ? undefined : Math.min(ssBase, taxableSsEnteringUtah),
        utahMagi,
        filingStatus: facts?.stateFilingStatus,
        config,
      })
      const selected = utahSelectNonrefundableCredit({
        militaryCredit: military.taxCredit,
        retirementCredit: retirement.taxCredit,
        socialSecurityCredit: ssCredit.taxCredit,
        retirementComplete: retirement.warnings.length === 0,
        socialSecurityAndMilitaryComplete: knownDistributions !== undefined && !distributions.some((row) => row.sourceKind === 'unknownPublic' || row.sourceKind === 'unknownPrivate') && military.warnings.length === 0 && ssCredit.warnings.length === 0 && ssWarnings.length === 0,
        election: facts?.utahCreditElection,
        apportionment: facts?.utahCreditApportionment,
        precreditUtahTax: stateTax,
      })
      taxCredit += selected.taxCredit
      const explicitSsMilitary = facts?.utahCreditElection === 'socialSecurityAndMilitary'
      if (!explicitSsMilitary) warnings.push(...retirement.warnings)
      if (facts?.utahCreditElection !== 'retirement') warnings.push(...military.warnings, ...ssCredit.warnings, ...ssWarnings)
      warnings.push(...selected.warnings)
      }
    }
  }

  // Maryland's additional tax on net capital gain is state tax only; the
  // county rate below applies to taxable income, not to it.
  if (params.hasIncomeTax && params.marylandCapitalGainSurtax && input.capitalGains > 0) {
    const taxablePct = (params.capitalGainsTaxablePct ?? (params.capitalGainsAsOrdinary ? 100 : 0)) / 100
    stateTax += marylandCapitalGainSurtax({
      config: params.marylandCapitalGainSurtax,
      federalAgi: federalFactsFor(input, opts)().agi,
      netCapitalGain: input.capitalGains * taxablePct,
    })
  }

  // Local rate gated on hasIncomeTax (see Wyo. Stat. 39-12-101 / Tenn. Const. art. II § 28).
  const localTax = params.hasIncomeTax ? taxableIncome * (Math.max(0, opts.localRatePct ?? 0) / 100) : 0
  const stateTaxAfterCredit = Math.max(0, stateTax - taxCredit)
  const totalTax = Math.max(0, stateTaxAfterCredit + localTax)
  const hsaPools = hsaBasisPools(params.code, opts.hsaAccounts)
  const njPools = njIraBasisPools(params.code, opts.njIraOwnerPools)
  const pensionPools = pensionBasisPools(params.code, resolvedDistributions(opts))
  if ([...(hsaPools ?? []), ...(njPools ?? []), ...(pensionPools ?? [])].some((pool) => pool.status === 'incomplete')) {
    warnings.push({ code: 'state-basis-transition-incomplete', message: 'The annual state basis transition requires complete account, contribution and distribution facts.', missingFacts: ['stateBasisPoolFacts'] })
  }
  const status = warnings.length > 0 ? 'incomplete' : 'complete'
  return {
    amount: totalTax,
    taxableIncome,
    stateTax: stateTaxAfterCredit,
    localTax,
    totalTax,
    taxCredit,
    status,
    warnings,
    hsaBasisPools: hsaPools,
    njIraBasisPools: njPools,
    pensionBasisPools: pensionPools,
  }
}

export function computeStateTax(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): number {
  return computeStateTaxDetail(params, input, opts).stateTax
}

function scaleExclusion(rule: StateRetirementExclusion, scale: number): StateRetirementExclusion {
  return rule.capPerPerson === undefined ? rule : { ...rule, capPerPerson: rule.capPerPerson * scale }
}

function prorateParams(params: StateTaxParams, scale: number): StateTaxParams {
  const age65 = params.standardDeductionAge65Addition
  return {
    ...params,
    standardDeduction: {
      single: params.standardDeduction.single * scale,
      marriedFilingJointly: params.standardDeduction.marriedFilingJointly * scale,
    },
    // The per-person age-65 addition is part of the same deduction and prorates
    // with it: a 65+ filer resident for five months takes five twelfths of it
    // against five twelfths of the year's income, not the whole year's.
    ...(age65 === undefined
      ? {}
      : {
          standardDeductionAge65Addition: {
            single: age65.single * scale,
            marriedFilingJointly: age65.marriedFilingJointly * scale,
          },
        }),
    // Scaling the brackets with the months taxes the year's income as a
    // resident and keeps the resident share. A state whose part-year return
    // taxes the resident-period income on its ordinary rate schedule
    // (Virginia's Form 760PY) carries `partYearRateSchedule: 'unscaled'` and
    // keeps its brackets.
    brackets: params.partYearRateSchedule === 'unscaled' ? params.brackets : {
      single: params.brackets.single.map((b) => ({
        ...b,
        lowerBound: b.lowerBound * scale,
        ...(b.baseTax === undefined ? {} : { baseTax: b.baseTax * scale }),
      })),
      marriedFilingJointly: params.brackets.marriedFilingJointly.map((b) => ({
        ...b,
        lowerBound: b.lowerBound * scale,
        ...(b.baseTax === undefined ? {} : { baseTax: b.baseTax * scale }),
      })),
    },
    retirementPrivate: scaleExclusion(params.retirementPrivate, scale),
    retirementPublic: scaleExclusion(params.retirementPublic, scale),
    // Form 760PY multiplies the full-year age deduction by the residency
    // ratio. Scaling the amount and both thresholds with the prorated income
    // the slice prices does the same: the slice's adjusted federal AGI, which
    // excludes Social Security, is the year's figure times the same scale.
    ...(params.virginiaAgeDeduction === undefined
      ? {}
      : {
          virginiaAgeDeduction: {
            ...params.virginiaAgeDeduction,
            amount: params.virginiaAgeDeduction.amount * scale,
            singleAfagiThreshold: params.virginiaAgeDeduction.singleAfagiThreshold * scale,
            marriedAfagiThreshold: params.virginiaAgeDeduction.marriedAfagiThreshold * scale,
          },
        }),
    // NJ-1040 line 28a for a part-year resident: the income test is on the
    // whole year's income and the dollar maximum is prorated by the months
    // resident. Scaling the income bounds with the slice's prorated income
    // tests the whole year; scaling the maximum prorates it; a tier's percent
    // of the slice's payments needs no change.
    ...(params.newJerseyPensionExclusion === undefined
      ? {}
      : {
          newJerseyPensionExclusion: {
            ...params.newJerseyPensionExclusion,
            grossIncomeLimit: params.newJerseyPensionExclusion.grossIncomeLimit * scale,
            fullThrough: params.newJerseyPensionExclusion.fullThrough * scale,
            maximum: {
              unmarried: params.newJerseyPensionExclusion.maximum.unmarried * scale,
              marriedFilingJointly: params.newJerseyPensionExclusion.maximum.marriedFilingJointly * scale,
            },
            tiers: params.newJerseyPensionExclusion.tiers.map((tier) => ({ ...tier, grossIncomeAbove: tier.grossIncomeAbove * scale })),
          },
        }),
    // Form 760PY's Prorated Exemption Worksheet reduces the personal
    // exemptions in proportion to the time resident; the $800 for a taxpayer
    // 65 or older is an additional personal exemption under 58.1-322.03(2)(b),
    // so it is prorated with them.
    ...(params.virginiaPersonalExemptions === undefined
      ? {}
      : {
          virginiaPersonalExemptions: {
            perExemption: params.virginiaPersonalExemptions.perExemption * scale,
            perAgedTaxpayer: params.virginiaPersonalExemptions.perAgedTaxpayer * scale,
          },
        }),
  }
}

function prorateInput(input: TaxYearInput, scale: number, state: string): TaxYearInput {
  return {
    ...input,
    state,
    stateResidency: undefined,
    ordinaryIncome: input.ordinaryIncome * scale,
    capitalGains: input.capitalGains * scale,
    realizedCapitalGainsBeforeCarryforward:
      input.realizedCapitalGainsBeforeCarryforward === undefined
        ? undefined
        : input.realizedCapitalGainsBeforeCarryforward * scale,
    taxableInterestIncome: (input.taxableInterestIncome ?? 0) * scale,
    taxExemptInterest: (input.taxExemptInterest ?? 0) * scale,
    foreignExclusionAddback: (input.foreignExclusionAddback ?? 0) * scale,
    usGovernmentInterest: input.usGovernmentInterest === undefined ? undefined : input.usGovernmentInterest * scale,
    ordinaryDividends: (input.ordinaryDividends ?? 0) * scale,
    qualifiedDividends: (input.qualifiedDividends ?? 0) * scale,
    ssBenefits: input.ssBenefits * scale,
    retirementIncome: input.retirementIncome === undefined ? undefined : input.retirementIncome * scale,
    privateRetirementIncome: input.privateRetirementIncome === undefined ? undefined : input.privateRetirementIncome * scale,
    publicPensionIncome: input.publicPensionIncome === undefined ? undefined : input.publicPensionIncome * scale,
  }
}

export interface StateTaxOptions {
  /** Flat effective rate (percent). When > 0 it overrides modeled packs. */
  overridePct?: number
  /** Flat local income-tax rate (percent), applied to state taxable income. */
  localPct?: number
}

export interface StateTaxYearOptions extends StateTaxOptions, ComputeStateTaxOptions {
  /**
   * Transform the resolved state params before computing. Used by the
   * relocation-compare driver attribution to re-price a year with one state
   * feature neutralized (e.g. "as if this state taxed Social Security");
   * with no transform the result is exactly what the calculator charged.
   */
  mapParams?: (params: StateTaxParams) => StateTaxParams
}

/**
 * Full state+local tax for one TaxYearInput — the single computation behind
 * `createStateTaxCalculator`, exported so callers can re-price a recorded
 * ledger year (relocation-compare drivers) through the identical path,
 * including the flat override and split-year residency proration.
 */
export function computeStateTaxYearTotal(input: TaxYearInput, opts: StateTaxYearOptions = {}): number {
  if (
    !input.stateResidency?.length && (
      opts.retirementDistributions !== undefined ||
      opts.stateIncomeComponents !== undefined ||
      opts.householdFacts !== undefined ||
      opts.hsaAccounts !== undefined ||
      opts.hsaFacts !== undefined ||
      opts.qcdEvents !== undefined ||
      opts.qcdFacts !== undefined ||
      opts.njIraOwnerPools !== undefined
    )
  ) {
    return computeStateTaxYearResult(input, opts).totalTax
  }
  const overrideRate = Math.max(0, opts.overridePct ?? 0) / 100
  const localRatePct = Math.max(0, opts.localPct ?? 0)
  const localRate = localRatePct / 100
  const resolveParams = (code: string): StateTaxParams | undefined => {
    const published = stateParamsFor(code, input.year)
    if (!published) return undefined
    // Resolve borrowed federal deduction components before pricing. Whole-
    // federal packs carry a federal basic that must move with IRC
    // 63(c)(7)(B)(ii) projection, plus the 63(c)(3) age-65 addition that
    // 63(c)(1) includes in "the standard deduction." Maine keeps its own
    // published basic and adopts only the age addition through the independent
    // policy. Everything else in the pack — brackets included — stays nominal.
    //
    // Resolving here rather than later is deliberate: the params returned from
    // this point on already hold any attached age addition, so the split-year
    // path below hands `prorateParams` a resolved pair and residency scales
    // basic and addition together instead of only the basic half.
    // A deduction the state's own statute indexes (Washington's, from 2029) is
    // projected on that statute's schedule at the plan's inflation.
    const { pack } = packForYear(input.year)
    const params = statutorilyIndexedStandardDeduction(
      conformStateStandardDeduction(
        published,
        pack.federalTax.age65Addition,
        input.inflationScale ?? 1,
        pack.federalTax.standardDeduction,
      ),
      {
        year: input.year,
        packYear: LATEST_STATE_PACK_YEAR,
        inflationScale: input.stateIndexingScale ?? input.inflationScale ?? 1,
      },
    )
    return opts.mapParams ? opts.mapParams(params) : params
  }
  if (overrideRate > 0) {
    // The flat effective rate approximates a state return, so it still
    // honors the universal U.S.-government-interest exemption.
    const base =
      Math.max(0, Math.max(0, input.ordinaryIncome) - Math.max(0, input.usGovernmentInterest ?? 0)) +
      Math.max(0, input.capitalGains) +
      Math.max(0, input.qualifiedDividends ?? 0)
    return base * (overrideRate + localRate)
  }
  if (input.stateResidency && input.stateResidency.length > 0) {
    // Taxable SS is a full-year federal computation: derive it once from
    // annual income and thresholds, then apportion it to each state by
    // months of residency (recomputing per slice would understate it).
    let annualTaxableSs = 0
    if (input.ssBenefits > 0) {
      const { pack } = packForYear(input.year)
      annualTaxableSs = taxableSocialSecurity(
        pack,
        taxParameterFilingStatus(input.filingStatus),
        Math.max(0, input.ordinaryIncome) + Math.max(0, input.qualifiedDividends ?? 0) + input.capitalGains,
        input.ssBenefits,
        input.taxExemptInterest,
        input.foreignExclusionAddback,
      )
    }
    // Federal AGI and the senior deduction are full-year figures too: derive
    // them once, only if a segment state reads them.
    let annualFederal: FederalFactsForState | undefined
    const annualFederalFacts = (): FederalFactsForState => {
      if (annualFederal === undefined) {
        const federal = computeFederalTax(input)
        annualFederal = { agi: federal.agi, seniorDeduction: federal.seniorDeduction }
      }
      return annualFederal
    }
    return input.stateResidency.reduce((sum, segment) => {
      const months = Math.min(12, Math.max(0, segment.months))
      if (months <= 0) return sum
      const params = resolveParams(segment.state)
      if (!params) return sum
      const scale = months / 12
      const readsFederal =
        params.rhodeIslandSocialSecurityModification !== undefined ||
        params.marylandCapitalGainSurtax !== undefined ||
        params.californiaMilitaryExclusions !== undefined ||
        params.federalSeniorDeduction !== undefined
      const segmentOpts: ComputeStateTaxOptions = {
        taxableSocialSecurityOverride: annualTaxableSs * scale,
        localRatePct,
        ...(readsFederal
          ? { federalOverride: { agi: annualFederalFacts().agi, seniorDeduction: annualFederalFacts().seniorDeduction * scale } }
          : {}),
      }
      if (params.standardDeductionPhaseout) {
        const annualPreDeduction = computeStateTaxableIncome(params, input, {
          taxableSocialSecurityOverride: annualTaxableSs,
          standardDeductionAllowedOverride: 0,
        })
        segmentOpts.standardDeductionPhaseoutIncomeOverride = annualPreDeduction
      }
      const detail = computeStateTaxDetail(prorateParams(params, scale), prorateInput(input, scale, segment.state), segmentOpts)
      return sum + detail.totalTax
    }, 0)
  }
  if (!input.state) return 0
  const params = resolveParams(input.state)
  return params ? computeStateTaxDetail(params, input, { localRatePct }).totalTax : 0
}

/**
 * State tax behind the projection's pluggable interface. Resolves residence
 * (input.state) and year per call so it composes with the federal calculator
 * via combineTaxCalculators and handles mid-plan relocation.
 */
export function createStateTaxCalculator(opts: StateTaxYearOptions = {}): TaxCalculator & { computeResult(input: TaxYearInput): StateTaxComputationResult & TaxComputationResult } {
  return {
    compute(input) {
      return computeStateTaxYearResult(input, stateOptionsFromInput(input, opts)).amount
    },
    computeResult(input) {
      const result = computeStateTaxYearResult(input, stateOptionsFromInput(input, opts))
      return { ...result, issues: result.warnings.map((warning) => ({ ...warning, state: input.state, year: input.year })) }
    },
  }
}

function stateOptionsFromInput(input: TaxYearInput, opts: StateTaxYearOptions): StateTaxYearOptions {
  return {
    ...opts,
    retirementDistributions: input.stateRetirementDistributions ?? opts.retirementDistributions,
    householdFacts: input.stateHouseholdFacts ?? opts.householdFacts,
    hsaAccounts: input.stateHsaAccountYearFacts ?? opts.hsaAccounts,
    hsaFacts: input.stateHsaYearFacts ?? opts.hsaFacts,
    qcdEvents: input.stateQcdEventFacts?.map((event) => ({ ...event, directTransfer: event.directTransfer === true })) ?? (input.stateQcdYearFacts === undefined ? opts.qcdEvents : input.stateQcdYearFacts.map((event, index) => ({ ...event, eventId: `legacy-qcd-${index}`, accountId: `legacy-qcd-${index}`, directTransfer: false }))),
    qcdFacts: opts.qcdFacts,
    njIraOwnerPools: input.stateNjIraOwnerPools?.map((pool) => {
      const ira = input.stateRetirementDistributions?.filter((row) => row.ownerPersonId === pool.ownerPersonId && row.sourceKind === 'ira' && row.accountTaxTreatment !== 'roth')
      const qcd = input.stateQcdEventFacts?.filter((row) => row.ownerPersonId === pool.ownerPersonId)
      const complete = ira !== undefined && qcd !== undefined && ira.every((row) => row.grossDistribution !== undefined)
      const unmatchedIra = (ira ?? []).filter((row) => !qcd?.some((event) => event.eventId === row.eventId && event.accountId === row.accountId))
      const actualGross = unmatchedIra.reduce((sum, row) => sum + Math.max(0, row.grossDistribution ?? 0), 0) + (qcd ?? []).reduce((sum, row) => sum + Math.max(0, row.grossIraDistribution), 0)
      return { ...pool, annualInputsComplete: pool.annualInputsComplete !== false && complete && Math.abs(actualGross - pool.allAnnualDistributions) < 0.005 }
    }) ?? opts.njIraOwnerPools,
  }
}

/**
 * The employer-plan types Va. Code 58.1-322.02(11) enumerates: a 401 plan
 * (401(a), 401(k)), a 408 IRA and a 457 plan. A 403(b) is none of them, and
 * an other, unknown or undeclared type proves no enumerated plan.
 */
const VIRGINIA_ENUMERATED_EMPLOYER_PLAN_TYPES: readonly NonNullable<StateRetirementDistributionFact['qualifiedPlanType']>[] = ['401a', '401k', '457b', 'ira']

function virginiaEnumeratedEmployerPlan(fact: StateRetirementDistributionFact): boolean {
  return fact.sourceKind === 'employerPlan' && fact.qualifiedPlanType !== undefined &&
    VIRGINIA_ENUMERATED_EMPLOYER_PLAN_TYPES.includes(fact.qualifiedPlanType)
}

function pensionBasisPools(state: string, facts: readonly StateRetirementDistributionFact[] | undefined): readonly StatePensionBasisPoolResult[] | undefined {
  if (facts === undefined || !['MA', 'VA', 'UT'].includes(state)) return undefined
  const pools = new Map<string, StatePensionBasisPoolResult>()
  for (const fact of facts) {
    const eligible = state === 'UT' ? fact.qualifiedPlanType === '401a'
      : state === 'MA' ? ['ordinaryPrivatePension', 'ira', 'employerPlan'].includes(fact.sourceKind)
        : Boolean(fact.priorTaxState) && fact.priorTaxState !== 'VA' && fact.planSystemCode !== 'VRS' && (fact.sourceKind === 'ira' || fact.sourceKind === 'federalCivilService' ||
          virginiaEnumeratedEmployerPlan(fact))
    if (!eligible) continue
    const kind = state === 'MA' ? 'pension' : state === 'VA' ? 'eligiblePlan' : 'otherState401a'
    const key = `${fact.ownerPersonId}:${fact.accountId ?? fact.planSystemCode ?? fact.qualifiedPlanType ?? fact.sourceKind}`
    const previous = pools.get(key)
    const opening = previous?.closingBasis ?? fact.knownPreviouslyTaxedBasis
    if (!fact.accountId || opening === undefined || previous?.status === 'incomplete' || !Number.isFinite(opening) || opening < 0) {
      pools.set(key, { state, accountId: fact.accountId ?? '', ownerPersonId: fact.ownerPersonId, kind, status: 'incomplete' })
      continue
    }
    const consumed = Math.min(opening, Math.max(0, fact.federallyIncludedAmount))
    pools.set(key, { state, accountId: fact.accountId, ownerPersonId: fact.ownerPersonId, kind, status: 'complete',
      openingBasis: previous?.openingBasis ?? opening, basisConsumed: (previous?.basisConsumed ?? 0) + consumed, closingBasis: opening - consumed })
  }
  return [...pools.values()]
}

function njIraBasisPools(state: string, rows: readonly StateNjIraOwnerPoolFacts[] | undefined): readonly StateNjIraBasisPoolResult[] | undefined {
  if (state !== 'NJ' || rows === undefined) return undefined
  return rows.map((row) => {
    const worksheet = newJerseyWorksheetCTaxableAmount({ pool: row, correspondingGrossDistributions: row.allAnnualDistributions })
    if (!isKnownMoney(row.unrecoveredNjTaxedContributions) || worksheet.warnings.length || worksheet.basisRecovered === undefined) {
      return { state: 'NJ', ownerPersonId: row.ownerPersonId, status: 'incomplete' }
    }
    const opening = Math.max(0, row.unrecoveredNjTaxedContributions.amount)
    const consumed = Math.min(opening, worksheet.basisRecovered)
    return { state: 'NJ', ownerPersonId: row.ownerPersonId, status: 'complete', openingBasis: opening, basisConsumed: consumed, closingBasis: opening - consumed }
  })
}

function hsaBasisPools(
  state: string,
  rows: readonly StateHsaAccountYearFacts[] | undefined,
): readonly StateHsaBasisPoolResult[] | undefined {
  if (rows === undefined || (state !== 'CA' && state !== 'NJ')) return undefined
  return rows.map((row) => {
    const lots = state === 'CA' ? row.californiaAssetDispositions?.map((lot) => ({ proceeds: lot.proceeds, basis: lot.californiaLotBasis }))
      : row.njAssetDispositions?.map((lot) => ({ proceeds: lot.proceeds, basis: lot.njLotBasis }))
    const validLots = lots !== undefined && lots.every((lot) => Number.isFinite(lot.proceeds) && Number.isFinite(lot.basis) && lot.proceeds >= 0 && lot.basis >= 0)
    const realized = lots !== undefined ? (validLots && (state === 'CA' || !isKnownMoney(row.realizedGains)) ? lots.reduce((sum, lot) => sum + Math.max(0, lot.proceeds - lot.basis), 0) : undefined)
      : isKnownMoney(row.realizedGains) ? Math.max(0, row.realizedGains.amount) : undefined
    if (row.annualActivityComplete !== true || realized === undefined ||
      !isKnownMoney(row.stateBasisBeforeYear) || !isKnownMoney(row.federalHsaDeduction) ||
      !isKnownMoney(row.employerContributionExcludedFederally) || !isKnownMoney(row.interest) ||
      !isKnownMoney(row.dividends) ||
      !isKnownMoney(row.qualifiedCashWithdrawals) || !isKnownMoney(row.nonqualifiedCashWithdrawals)) {
      return { state, accountId: row.accountId, ownerPersonId: row.ownerPersonId, status: 'incomplete' }
    }
    const opening = Math.max(0, row.stateBasisBeforeYear.amount)
    const added = Math.max(0, row.federalHsaDeduction.amount) + Math.max(0, row.employerContributionExcludedFederally.amount) + Math.max(0, row.interest.amount) + Math.max(0, row.dividends.amount) + realized
    const consumed = Math.min(opening + added, Math.max(0, row.qualifiedCashWithdrawals.amount) + Math.max(0, row.nonqualifiedCashWithdrawals.amount))
    return { state, accountId: row.accountId, ownerPersonId: row.ownerPersonId, status: 'complete', openingBasis: opening, basisAdded: added, basisConsumed: consumed, closingBasis: opening + added - consumed }
  })
}

/**
 * Rich annual state resolver. This is the only annual state entry point that
 * preserves characterized facts, credits, and exactness warnings for the
 * projection adapter; the legacy numeric resolver below remains compatible.
 */
export function computeStateTaxYearResult(
  input: TaxYearInput,
  opts: StateTaxYearOptions = {},
): StateTaxComputationResult {
  const overrideRate = Math.max(0, opts.overridePct ?? 0) / 100
  const localRatePct = Math.max(0, opts.localPct ?? opts.localRatePct ?? 0)
  if (overrideRate > 0) {
    const base = Math.max(0, input.ordinaryIncome - Math.max(0, input.usGovernmentInterest ?? 0)) + Math.max(0, input.capitalGains) + Math.max(0, input.qualifiedDividends ?? 0)
    const totalTax = base * (overrideRate + localRatePct / 100)
    return { amount: totalTax, taxableIncome: base, stateTax: base * overrideRate, localTax: base * localRatePct / 100, totalTax, taxCredit: 0, status: 'incomplete', warnings: [{ code: 'state-flat-override-approximate', message: 'Flat state-tax override bypasses source-typed state calculations.', missingFacts: ['modeledStateTax'] }] }
  }
  if (input.stateResidency?.length) {
    const segments = input.stateResidency.filter((segment) => segment.months > 0)
    if (segments.length === 1 && segments[0]!.months === 12) {
      return computeStateTaxYearResult({ ...input, state: segments[0]!.state, stateResidency: undefined }, opts)
    }
    // Retain the existing residency computation while refusing exact rich-fact
    // allocation. Do not return a fabricated zero or commit annual basis pools.
    const totalTax = computeStateTaxYearTotal(input, opts)
    return { amount: totalTax, taxableIncome: 0, stateTax: totalTax, localTax: 0, totalTax, taxCredit: 0, status: 'incomplete', warnings: [{ code: 'state-rich-split-year-adapter-required', message: 'Rich state facts require residency-segment allocation by the projection adapter; tax retains the existing prorated estimate.', missingFacts: ['stateResidencyFactAllocation'] }] }
  }
  if (!input.state) return { amount: 0, taxableIncome: 0, stateTax: 0, localTax: 0, totalTax: 0, taxCredit: 0, status: 'complete', warnings: [] }
  const published = stateParamsFor(input.state, input.year)
  if (!published) return { amount: 0, taxableIncome: 0, stateTax: 0, localTax: 0, totalTax: 0, taxCredit: 0, status: 'incomplete', warnings: [{ code: 'state-pack-unavailable', message: `No published state parameter set is available for ${input.state} tax year ${input.year}.`, missingFacts: ['stateTaxPack'] }] }
  const { pack } = packForYear(input.year)
  // A federal-following deduction conforms to the year's federal basic, loaded
  // or projected; a statute's own indexing runs at the plan's inflation from
  // the state figures' year (decision D-2027-ROLLOVER, review V1).
  const resolved = statutorilyIndexedStandardDeduction(
    conformStateStandardDeduction(
      published,
      pack.federalTax.age65Addition,
      input.inflationScale ?? 1,
      pack.federalTax.standardDeduction,
    ),
    {
      year: input.year,
      packYear: LATEST_STATE_PACK_YEAR,
      inflationScale: input.stateIndexingScale ?? input.inflationScale ?? 1,
    },
  )
  const params = opts.mapParams ? opts.mapParams(resolved) : resolved
  return computeStateTaxDetailResult(params, input, { ...opts, localRatePct })
}
