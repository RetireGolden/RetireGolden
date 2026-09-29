/**
 * Per-state income tax parameters (V5, "big levers"). One pack per tax year;
 * a data-only refresh each fall. Models brackets, standard deduction, whether
 * the state taxes Social Security, and the major age-based retirement-income
 * exclusion. Per-state credits, local/city taxes, and income phase-outs of
 * exclusions are out of scope.
 *
 * @see DOCS/features/taxes.md
 */

import type { FilingStatus, PerStatus } from '../types.js'

/**
 * Marginal bracket: `ratePct` applies to taxable income above `lowerBound`.
 * When `baseTax` is set, it is the fixed schedule base applied only above the band's
 * `lowerBound`; entering the band replaces accumulated lower-band tax with
 * that amount, then adds marginal tax on the excess above `lowerBound`.
 */
export interface StateTaxBracket {
  lowerBound: number
  ratePct: number
  /** Fixed schedule base applied only above `lowerBound`, before marginal tax. */
  baseTax?: number
}

/**
 * Exclusion of retirement income from state taxable income.
 *  - none:   the state taxes retirement income like other ordinary income.
 *  - full:   retirement income is entirely exempt (subject to minAge if set).
 *  - capped: each age-eligible person excludes up to capPerPerson.
 *
 * Optional `tierByAge` (South Carolina §12-6-1170) selects the applicable cap
 * from the recipient's age when characterized facts are present. Legacy
 * `capPerPerson`/`minAge` remain the coarse path when tiers are absent.
 */
export interface StateRetirementExclusion {
  kind: 'none' | 'full' | 'capped'
  /** Annual cap per eligible person (kind 'capped'), in pack-year dollars. */
  capPerPerson?: number
  /** Exclusion applies only to people at or above this age. */
  minAge?: number
  /**
   * Age-tiered caps for a single statutory retirement deduction (lowest
   * matching `minAge` wins; a null/undefined minAge row is the under-age tier).
   * Amounts are pack-year dollars.
   */
  tierByAge?: ReadonlyArray<{ minAge: number | null; cap: number }>
}

export interface StateTaxParams {
  /** Two-letter code, e.g. 'KY'. */
  code: string
  name: string
  /** Nine states levy no broad income tax → everything below is ignored. */
  hasIncomeTax: boolean
  /** ~9 states tax Social Security benefits (to the federally taxable extent). */
  taxesSocialSecurity: boolean
  /** Most states tax long-term gains as ordinary income. */
  capitalGainsAsOrdinary: boolean
  /**
   * Percent of modeled realized/net capital gain included in the state base.
   * Defaults to 100 when `capitalGainsAsOrdinary` is true, else 0.
   */
  capitalGainsTaxablePct?: number
  /**
   * Whether the state follows the federal capital-loss carryforward netting
   * already applied by the ledger, or taxes only current-year realized gains
   * and ignores prior-year carryforward offsets (PA-style planning case).
   */
  capitalLossCarryforwardConformity?: 'federal' | 'currentYearOnly'
  /** Source notes for state capital-gain/conformity treatment. */
  capitalGainsNotes?: string
  capitalGainsSources?: string[]
  standardDeduction: PerStatus<number>
  /**
   * Set to `'federal'` when the amount above is not an independent state figure
   * but the FEDERAL basic standard deduction for the pack year, carried here
   * because the state defines its own by reference to it (or, for CO and ND,
   * because the state's brackets are defined on federal taxable income and this
   * field is what converts the engine's gross base into that base).
   *
   * Marking it matters because IRC 63(c)(7)(B)(ii) increases the federal amount
   * for every taxable year beginning after 2025. A copy of that amount left
   * frozen at the pack year would take a different value from the original in
   * the very same projected year, and the whole widening gap would be taxed at
   * the state rate. `conformStateStandardDeduction` reads this flag and moves
   * the copy with the original.
   *
   * Whole-federal basic conformity also implies the federal age-65 additional
   * amount under IRC 63(c)(1)/(3): a state pointing at "the federal standard
   * deduction" is pointing at that sum. See `standardDeductionAge65Addition`
   * for that federal limb. A state that publishes its own basic amount leaves
   * this flag absent. Maine and South Carolina both decoupled the basic for
   * 2026; Maine still adopts the federal additional amount through
   * `standardDeductionAge65AdditionConformity`, which is independent of this
   * flag. A state that publishes its own fixed age addition instead carries it
   * in the pack without either conformity tag; only a federally tagged value
   * scales with federal inflation.
   */
  standardDeductionConformity?: 'federal'
  /**
   * Set to `'federal'` when the state adopts the IRC 63(c)(3) / 63(f)(1)
   * additional standard deduction for age 65 or older while keeping its own
   * published basic amount (so `standardDeductionConformity` stays absent).
   * Maine is the type case for 2026: 36 M.R.S. §5124-C(1-B) sets Maine's basic
   * and defines the additional amount as the Code §63(c)(3) amount.
   *
   * Whole-federal packs do not need this flag: `standardDeductionConformity:
   * 'federal'` already attaches the age addition. This field is unused outside
   * the conformity resolver. Blindness under 63(f)(2) is not modeled — the
   * engine's age counter drives only age relief.
   */
  standardDeductionAge65AdditionConformity?: 'federal'
  /**
   * Per-person additional standard deduction for age 65 or older, multiplied by
   * `peopleAged65Plus` in `computeStateTaxableIncome`.
   *
   * Two sources. For a state tagged `standardDeductionConformity: 'federal'` or
   * `standardDeductionAge65AdditionConformity: 'federal'`,
   * `conformStateStandardDeduction` attaches the federal IRC 63(c)(3)/63(f)(1)
   * amount from the federal pack, scaled by the same inflation factor as a
   * borrowed federal basic when that path applies — a borrowed federal figure,
   * not editable in the state pack. For a state that publishes its own fixed
   * statutory addition (Delaware is the type case), the pack carries the
   * per-status dollar amount directly and no conformity tag is set, so the
   * figure stays frozen at the pack value. A raw `stateParamsFor` result for a
   * federally tagged state therefore carries neither an indexed borrowed basic
   * nor a resolver-attached addition; conforming before pricing a federally
   * tagged household-year is the contract, and `computeStateTaxYearTotal` is
   * where it is met.
   *
   * Stored per person rather than pre-multiplied by the household's head count
   * so `prorateParams` can scale it for part-year residency exactly as it scales
   * the basic amount — a 65+ filer resident for five months gets five twelfths
   * of the addition, not all of it.
   */
  standardDeductionAge65Addition?: PerStatus<number>
  /**
   * Optional proportional phase-out of the total standard deduction (basic plus
   * any modeled additional amounts) once annual income exceeds a published
   * start. Thresholds are pack-year Maine figures — not scaled with federal
   * inflation projection or residency proration.
   */
  standardDeductionPhaseout?: {
    startsAt: PerStatus<number>
    range: PerStatus<number>
  }
  brackets: PerStatus<StateTaxBracket[]>
  /**
   * Optional head-of-household bracket schedule when the state publishes one
   * distinct from single/MFJ (Hawaii). Absent ⇒ callers must not invent HOH
   * by mapping to MFJ for exact HOH pricing; use the leaf helper instead.
   */
  bracketsHeadOfHousehold?: StateTaxBracket[]
  /**
   * Optional married-filing-separately bracket schedule when distinct from
   * single (Vermont and others). Absent ⇒ MFS uses single when the statute
   * so provides, otherwise leaf helpers require explicit status facts.
   */
  bracketsMarriedFilingSeparately?: StateTaxBracket[]
  /** Private pensions, annuities, traditional IRA/401(k), RMD, SEPP, and inherited distributions. */
  retirementPrivate: StateRetirementExclusion
  /** Public civil-service / military pensions, where state law separates them. */
  retirementPublic: StateRetirementExclusion
  /**
   * True when the state has one all-retirement rule copied into both buckets
   * (no separate public-pension law): a capped exclusion then applies once to
   * the combined retirement income, never once per bucket.
   */
  retirementRuleShared?: boolean
  /**
   * Direct QCD conformity metadata. `unknown` fails closed for exact state QCD
   * results; never infer addback from silence. Pack policy is authoritative.
   */
  directQcdPolicy?:
    | {
        kind: 'conforms'
        citation: string
        effectiveTaxYears?: { from: number; to?: number }
        authoritySourceIds?: readonly string[]
        supportedTransactionKinds?: readonly string[]
        charitableCreditAdjustment?: 'none' | 'coveredCreditAddback'
      }
    | {
        kind: 'conformsWithAdoptedCap'
        annualCap: number
        citation: string
        adoptionCutoff?: string
        effectiveTaxYears?: { from: number; to?: number }
        authoritySourceIds?: readonly string[]
        supportedTransactionKinds?: readonly string[]
        charitableCreditAdjustment?: 'none' | 'coveredCreditAddback'
      }
    | {
        kind: 'noGeneralFederalExclusion'
        citation: string
        effectiveTaxYears?: { from: number; to?: number }
        authoritySourceIds?: readonly string[]
        supportedTransactionKinds?: readonly string[]
        charitableCreditAdjustment?: 'none' | 'coveredCreditAddback'
      }
    | { kind: 'unknown' }
  /**
   * HSA state conformity. California is nonconforming; New Jersey uses GIT
   * category treatment with incomplete exactness when category facts are missing.
   */
  hsaConformity?: 'federal' | 'nonconformingCalifornia' | 'newJerseyCategories' | 'unknown'
  /**
   * Colorado §39-22-104(3)(p.7) high-AGI federal deduction addback parameters.
   */
  iowaAlternateTax?: { singleThreshold: number; jointThreshold: number; seniorSingleThreshold: number; seniorJointThreshold: number; alternateRate: number }
  highAgiFederalDeductionAddback?: {
    agiTrigger: number
    retainSingle: number
    retainJoint: number
  }
  /** Illinois personal-exemption allowance dollars and AGI cutoffs. */
  illinoisPersonalExemption?: {
    basicAllowance: number
    age65Addition: number
    agiCutoffNonjoint: number
    agiCutoffJoint: number
  }
  /** Delaware under-60 pension greater-of caps (ordinary vs military). */
  delawareUnder60Pension?: {
    ordinaryCap: number
    militaryCap: number
  }
  /** Connecticut WS personal-exemption schedule by extended filing status. */
  connecticutPersonalExemption?: Record<
    'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse',
    { maximum: number; phaseoutStart: number; phaseoutStep: number; reductionPerStep: number }
  >
  /** South Carolina TY2026 SCIAD standard-deduction phaseout schedule. */
  southCarolinaSciad?: Record<
    'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse',
    { base: number; phaseoutStart: number; phaseoutRange: number; reductionIncrement: number }
  >
  /** Massachusetts Part B rate + surtax threshold. */
  massachusettsRates?: {
    baseRate: number
    surtaxRate: number
    surtaxThreshold: number
    personalExemptionSingle: number
    personalExemptionJoint: number
    personalExemptionHoh: number
    ageBlindAddition: number
  }
  /** Idaho §63-3022A status caps. */
  idahoQualifiedRetirementCaps?: {
    single: number
    joint: number
  }
  /** Montana long-term capital-gain schedule (rates + status thresholds). */
  montanaLtcg?: {
    lowerRate: number
    upperRate: number
    thresholdSingle: number
    thresholdHoh: number
    thresholdJoint: number
  }
  /** Oregon ORS 316.157 retirement income credit parameters. */
  oregonRetirementIncomeCredit?: {
    rate: number
    pensionCeilingSingle: number
    pensionCeilingJoint: number
    incomeThresholdSingle: number
    incomeThresholdJoint: number
  }
  /** Utah credit/subtraction rates for military and related limbs. */
  utahRetirementCredits?: {
    taxRate: number
    phaseoutRate: number
    socialSecurityThresholds: Record<'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse', number>
    retirementThresholds: Record<'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse', number>
    retirementCreditPerEligibleClaimant: number
    latestEligibleBirthDate: string
  }
  /** Virginia military retirement subtraction cap per recipient. */
  virginiaMilitarySubtractionCap?: number
  /** Missouri private/public retirement parameters. */
  missouriRetirement?: {
    privateCap: number
    privatePhaseoutSingle: number
    privatePhaseoutJoint: number
    privatePhaseoutMfs: number
    publicMaxSocialSecurityBenefit: number
  }
  /** Wisconsin income-tested standard deduction (Form 1-ES) + exemptions. */
  wisconsinStandardDeduction?: {
    single: {
      maximum: number
      fullThrough: number
      phaseStart: number
      phaseRate: number
      zeroAt: number
    }
    marriedFilingJointly: {
      maximum: number
      fullThrough: number
      phaseStart: number
      phaseRate: number
      zeroAt: number
    }
    marriedFilingSeparately: {
      maximum: number
      fullThrough: number
      phaseStart: number
      phaseRate: number
      zeroAt: number
    }
    headOfHousehold: {
      maximum: number
      fullThrough: number
      phaseStart: number
      phaseRate: number
      secondSegmentStart: number
      zeroAt: number
    }
    exemptionPerPerson: number
    age65Addition: number
  }
  /** West Virginia exemption and named-system dollars. */
  coloradoRetirement?: { age55Cap: number; age65Cap: number; ssAgiNonjoint: number; ssAgiJoint: number }
  westVirginiaSocialSecurity?: { nonjointAgiThreshold: number; jointAgiThreshold: number; aboveThresholdFractionByYear: Readonly<Record<number, number>>; fullExclusionFrom: number }
  westVirginiaExemptions?: {
    qualifyingFederalSystemCodes?: readonly string[]
    perExemption: number
    zeroExemptionIrc151d2: number
    survivingSpouseAdditional: number
    age65ResidualCap: number
    namedPublicCombinedCapPerPerson: number
  }
  /** Vermont derived annual amounts beyond brackets/SD (minimum tax, retirement). */
  vermontExtras?: {
    minimumTaxAgiThreshold: number
    minimumTaxRate: number
    personalExemption: number
    additional63f: number
    civilServiceCap: number
    civilServiceFullThroughNonjoint: number
    civilServiceZeroAtNonjoint: number
    civilServiceFullThroughJoint: number
    civilServiceZeroAtJoint: number
    militaryFullThrough: number
    militaryZeroAt: number
    standardDeductionByStatus?: Record<'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse', number>
  }
  /** Kansas named statutory plan codes for the public-pension allowlist. */
  kansasNamedPlanCodes?: readonly string[]
  /**
   * Rhode Island 44-30-12(c)(8) Social Security modification: the Social
   * Security included in federal AGI is subtracted when federal AGI is below
   * the limit for the filing status (joint, or every other status) and, where
   * `minAge` is set, a filer has reached full retirement age, read as that age
   * at the end of the year. The limits are indexed; each is the latest figure
   * the Division of Taxation has published.
   */
  rhodeIslandSocialSecurityModification?: {
    nonjointAgiLimit: number
    jointAgiLimit: number
    minAge?: number
  }
  /**
   * Virginia 58.1-322.03(2) personal exemptions: an amount for each personal
   * exemption the filer could claim federally, plus an amount for each
   * taxpayer 65 or older. Dependents are not modeled.
   */
  virginiaPersonalExemptions?: {
    perExemption: number
    perAgedTaxpayer: number
  }
  /**
   * Maryland Tax-General 10-105(a)(3)-(4): an additional state rate on the net
   * capital gain in Maryland AGI when federal AGI exceeds the threshold.
   */
  marylandCapitalGainSurtax?: {
    ratePct: number
    federalAgiThreshold: number
  }
  /**
   * Maryland Tax-General 10-207(mm): the first `amount` of retirement income
   * from service as a correctional, law enforcement, fire, rescue or emergency
   * services officer, for a retiree at or above `minAge`. The plan marks such a
   * pension with the state eligibility `planSystemCode` given here.
   */
  marylandPublicSafetySubtraction?: {
    amount: number
    minAge: number
    planSystemCode: string
  }
  /**
   * Set when the state base subtracts the federal IRC 151(d)(5)(C) senior
   * deduction: Arizona by its own subtraction (43-1022(35)), Colorado and Idaho
   * by taxing federal taxable income. The amount is the federal figure for the
   * same return, so it ends when the federal deduction does (after 2028).
   */
  federalSeniorDeduction?: 'subtracted'
  /**
   * Delaware 1106(b)(3) from 2027: at 60 or older, the greater of the $12,500
   * pension limb and this cap on U.S. military pension.
   */
  delawareMilitaryPension60Plus?: {
    militaryCap: number
  }
  /**
   * California RTC 17132.9 and 17132.10 (2025 to 2029): military retirement pay
   * and Survivor Benefit Plan annuities each excluded up to a cap per return,
   * when federal AGI is at or below the limit.
   */
  californiaMilitaryExclusions?: {
    retirementCap: number
    survivorBenefitCap: number
    agiLimitNonjoint: number
    agiLimitJoint: number
  }
  /**
   * A standard deduction the state's own statute indexes on its own schedule,
   * so a year past the published amount projects it at the plan's inflation
   * (tax/stateEnactedLaw.ts#statutorilyIndexedStandardDeduction). The first
   * year an adjustment applies, the years between adjustments, and the
   * rounding of each adjusted amount. Washington, ESSB 6346 section 316: 2029,
   * every 2 years, to the nearest $1,000. The District of Columbia, D.C. Act
   * 26-416: 2027, every year, cumulative from a 2025 base, rounded down to $50.
   */
  standardDeductionStatutoryIndexing?: {
    firstIndexedYear: number
    intervalYears: number
    roundToNearest: number
    /** Rounding of each adjusted amount; absent means to the nearest multiple. */
    rounding?: 'nearest' | 'down'
    /**
     * `stepwise` (absent): each adjustment multiplies the current amount by one
     * year's inflation (Washington). `cumulative`: each year's amount is the
     * published amount times the cumulative inflation from the base, rounded
     * once (the District of Columbia, D.C. Code 47-1801.04(3A)(B)).
     */
    basis?: 'stepwise' | 'cumulative'
  }
  /** Citation / modeled simplifications for the data-refresh workstream. */
  notes?: string
}

export interface StateTaxPack {
  year: number
  /** Keyed by two-letter code. Absent states fall back to the flat override. */
  states: Record<string, StateTaxParams>
}

/**
 * The figures a state has already enacted, without a condition, for a tax year
 * after the latest pack: any field of its entry a statute changes for that year,
 * for every filing status the entry carries. Rate schedules (`brackets` and the
 * head-of-household and separate-filer schedules), the standard deduction, the
 * retirement exclusions and any state-specific block (the Montana capital-gain
 * schedule, for one) are all fields of `StateTaxParams`, and a surtax on taxable
 * income above a threshold is a further band of the schedule.
 *
 * Each field an entry names replaces the field whole, so a schedule or a block
 * is written out in full; a field it does not name keeps what the pack, or an
 * earlier enacted year, gives it. An optional field set to `null` ends: a
 * statute that repeals a credit or a subtraction from a year on (Oregon's
 * retirement income credit from 2032, say) removes the field from that year.
 * The identity fields cannot be changed. An entry that changes any rate
 * schedule sets every schedule its state's pack carries (`stateParams.test.ts`
 * holds this), so a head-of-household or separate-filer table is never left at
 * the old rates beside a new single and joint one.
 */
export type StateEnactedFigures = {
  readonly [K in Exclude<keyof StateTaxParams, 'code' | 'name'>]?:
    | StateTaxParams[K]
    | (undefined extends StateTaxParams[K] ? null : never)
}

/** Enacted figures for one tax year, keyed by two-letter code. */
export interface StateEnactedYear {
  readonly year: number
  readonly states: Readonly<Record<string, StateEnactedFigures>>
}

export type { FilingStatus }
