/**
 * Fixtures pinning four `approximated` records: the two annuity payout-form
 * gaps (Treas. Reg. 1.72-7 refund feature, 1.72-5(b)(2) joint-and-survivor
 * expected return) and the two property-disposition gaps (IRC 1(h)(1)(E)
 * unrecaptured section 1250 gain, IRC 121 eligibility tests).
 *
 * Each asserts the engine returns the APPROXIMATED figure, not the statutory
 * one. That is the point: an approximated record is a claim about what this
 * engine gets wrong, and left unwatched it rots in the direction of looking
 * responsible. The day someone closes one of these gaps the assertion below
 * fails and names the record that has to be reclassified.
 *
 * Every accepted value is arithmetic from the authority quoted in the record —
 * Table V from the parameter pack (which is Pub 939 Table V), Table VI's 22.0
 * from the Example 2 text quoted on the 1.72-5(b)(2) record, the 25 percent
 * ceiling of 1(h)(1)(E), the 121(b)(5) nonqualified-use ratio — never a number
 * read off the implementation.
 */

import { expect, it } from 'vitest'
import { describeRule } from '../describeRule.js'
import { annuityExpectedReturnMultiple, packForYear } from '../../params/index.js'
import { annuityExclusionMultiple } from '../../projection/annuityForms.js'
import { propertySaleTax } from '../../tax/propertySale.js'
import type { Account, Person } from '../../model/plan.js'

type AnnuityAccount = Extract<Account, { type: 'annuity' }>

const pack = packForYear(2026).pack

function person(id: string, birthYear: number, sex: Person['sex']): Person {
  return {
    id,
    name: id,
    dob: `${birthYear}-01-01`,
    sex,
    retirementAge: 65,
    longevity: { planningAge: 95, source: 'model' },
  }
}

function annuity(
  startAge: number,
  monthlyAmount: number,
  payoutForm: AnnuityAccount['payoutForm'],
): AnnuityAccount {
  return {
    id: 'annuity-1',
    name: 'Non-qualified SPIA',
    ownerPersonId: 'owner',
    annualReturnPct: null,
    type: 'annuity',
    startAge,
    monthlyAmount,
    colaPct: 0,
    taxablePct: 0,
    payoutForm,
  }
}

// ---------------------------------------------------------------------------
// Treas. Reg. 1.72-7 — refund feature (life annuity with a period certain)
// ---------------------------------------------------------------------------

/**
 * The regulation handles a period-certain guarantee entirely on the NUMERATOR:
 * the expected-return multiple stays the ordinary single-life Table V multiple
 * (1.72-5(a)(1)), and 1.72-7(b) instead subtracts the Table VII value of the
 * refund feature from the investment in the contract. The engine does the
 * opposite — it leaves the investment alone and raises the multiple to
 * `max(Table V, certainYears)`.
 *
 * Age 80 with a twenty-year guarantee separates the two readings by more than
 * a factor of two, and no authority prescribes the engine's figure.
 */
const AGE_AT_START = 80
const CERTAIN_YEARS = 20
/** Pub 939 Table V, age 80 — the pack's own table entry, read at fixture time. */
const TABLE_V_AGE_80 = annuityExpectedReturnMultiple(pack, AGE_AT_START)

describeRule('treas-reg-1-72-7-refund-feature-investment-adjustment', {
  readings: {
    // 1.72-5(a)(1): a life annuity's expected return is the annual payment
    // times the Table V multiple. The guarantee never enters the multiple.
    statuteKeepsTheSingleLifeMultipleAndReducesTheInvestment: TABLE_V_AGE_80,
    // annuityForms.ts: `Math.max(lifeMultiple, form.certainYears)`.
    engineRaisesTheMultipleToTheCertainPeriod: CERTAIN_YEARS,
  },
  accepted: 'statuteKeepsTheSingleLifeMultipleAndReducesTheInvestment',
  produced: 'engineRaisesTheMultipleToTheCertainPeriod',
  note: 'a guarantee longer than the single-life multiple',
}, ({ accepted, produced }) => {
  const owner = person('owner', 1946, 'average')

  it('the accepted multiple is the pack Table V entry, not a figure chosen here', () => {
    // 9.5 years at age 80 in Pub 939 Table V; the fixture reads it rather than
    // restating it, so a table correction moves both sides together.
    expect(accepted).toBe(TABLE_V_AGE_80)
    expect(accepted).toBeLessThan(CERTAIN_YEARS)
  })

  it('raises the denominator to the certain period instead of adjusting the investment', () => {
    const multiple = annuityExclusionMultiple(
      pack,
      annuity(AGE_AT_START, 1000, { kind: 'periodCertain', certainYears: CERTAIN_YEARS }),
      owner,
      undefined,
    )
    expect(multiple).toBe(produced)
    expect(multiple).not.toBe(accepted)
  })

  it('makes no adjustment at all where the guarantee is shorter than the life multiple', () => {
    // The record's headline case: a ten-year certain bought at 65. Table V at
    // 65 is 20.0, so `max(20, 10)` is the life-only multiple unchanged and the
    // investment is untouched too — the regulation prescribes a positive
    // Table VII reduction here and the engine applies nothing on either side.
    const lifeOnly = annuityExclusionMultiple(
      pack,
      annuity(65, 1000, { kind: 'lifeOnly' }),
      owner,
      undefined,
    )
    const tenYearCertain = annuityExclusionMultiple(
      pack,
      annuity(65, 1000, { kind: 'periodCertain', certainYears: 10 }),
      owner,
      undefined,
    )
    expect(tenYearCertain).toBe(lifeOnly)
  })
})

// ---------------------------------------------------------------------------
// Treas. Reg. 1.72-5(b)(2) — joint and survivor expected return
// ---------------------------------------------------------------------------

/**
 * Example 2 of the regulation, quoted verbatim on the record: ages 70 and 67,
 * $1,200 a year to the first annuitant and $600 to the survivor, Table VI
 * multiple 22.0, Table V multiple 16.0, expected return $22,800.
 *
 * The engine reproduces the decomposition but substitutes an SSA-derived,
 * per-sex joint last-survivor expectancy for Table VI's unisex 22.0. SSA
 * population mortality is heavier than the annuitant mortality behind Table VI,
 * so the survivor tail is short and the expected return comes out below the
 * prescribed figure.
 */
const FIRST_ANNUITANT_ANNUAL = 1200
const SURVIVOR_ANNUAL = 600
/** Quoted on the record: "Multiple from Table V (age 70) 16.0". */
const TABLE_V_AGE_70 = 16.0
/** Quoted on the record: "Multiple from Table VI (ages 70, 67) 22.0". */
const TABLE_VI_AGES_70_67 = 22.0
const PRESCRIBED_EXPECTED_RETURN =
  FIRST_ANNUITANT_ANNUAL * TABLE_V_AGE_70
  + SURVIVOR_ANNUAL * (TABLE_VI_AGES_70_67 - TABLE_V_AGE_70)

describeRule('treas-reg-1-72-5-b-2-joint-and-survivor-expected-return', {
  readings: {
    // $1,200 × 16.0 + $600 × (22.0 − 16.0) = $22,800.
    statuteTakesTheJointMultipleFromTableVI: PRESCRIBED_EXPECTED_RETURN,
    // Same decomposition, joint expectancy from the SSA-based mortality model.
    engineDerivesTheJointExpectancyFromSsaMortality: 22330.89,
  },
  accepted: 'statuteTakesTheJointMultipleFromTableVI',
  produced: 'engineDerivesTheJointExpectancyFromSsaMortality',
}, ({ accepted, produced }) => {
  const owner = person('owner', 1956, 'male')
  const joint = person('joint', 1959, 'female')
  const account = annuity(70, FIRST_ANNUITANT_ANNUAL / 12, {
    kind: 'jointSurvivor',
    survivorPct: (SURVIVOR_ANNUAL / FIRST_ANNUITANT_ANNUAL) * 100,
  })

  /** Expected return as simulate.ts computes it: annual payment × the multiple. */
  function engineExpectedReturn(first: Person, second: Person): number {
    return FIRST_ANNUITANT_ANNUAL * annuityExclusionMultiple(pack, account, first, second)
  }

  it('the accepted figure is Example 2 arithmetic, not a number chosen here', () => {
    expect(accepted).toBe(22800)
    // The pack's Table V agrees with the multiple the example quotes, so the
    // two readings differ only in where the joint multiple comes from.
    expect(annuityExpectedReturnMultiple(pack, 70)).toBe(TABLE_V_AGE_70)
  })

  it('understates the expected return prescribed by Table VI', () => {
    const produced_ = Math.round(engineExpectedReturn(owner, joint) * 100) / 100
    expect(produced_).toBe(produced)
    expect(produced_).not.toBe(accepted)
    // errorDirection: 'understatesTax'. A short survivor tail understates the
    // expected return, which overstates the exclusion ratio.
    expect(produced_).toBeLessThan(accepted as number)
  })

  it('varies by sex, which a unisex Table VI cannot do', () => {
    const maleFirst = engineExpectedReturn(person('owner', 1956, 'male'), person('joint', 1959, 'female'))
    const femaleFirst = engineExpectedReturn(person('owner', 1956, 'female'), person('joint', 1959, 'male'))
    // Same two ages either way; Table VI would return 22.0 for both.
    expect(maleFirst).not.toBe(femaleFirst)
  })
})

// ---------------------------------------------------------------------------
// IRC 1(h)(1)(E) — unrecaptured section 1250 gain
// ---------------------------------------------------------------------------

/**
 * Real property placed in service after 1986 is depreciated straight line, so
 * its depreciation is not section 1250 recapture and not ordinary income: it is
 * unrecaptured section 1250 gain, long-term capital gain to which 25 percent is
 * a CEILING. The engine routes the whole recapture figure to ordinary income.
 */
const SALE_PRICE = 900_000
const COST_BASIS = 500_000
const DEPRECIATION = 100_000
const RENTAL_GAIN = SALE_PRICE - COST_BASIS

describeRule('irc-1-h-1-E-unrecaptured-section-1250-gain', {
  readings: {
    // 1(h)(6)(A)(i): long-term capital gain, taxed at no more than 25 percent.
    // None of it is ordinary income.
    statuteTreatsStraightLineDepreciationAsCappedCapitalGain: 0,
    // propertySale.ts: `ordinaryGain = min(gain, depreciationRecapture)`.
    engineAddsTheWholeRecaptureToOrdinaryIncome: DEPRECIATION,
  },
  accepted: 'statuteTreatsStraightLineDepreciationAsCappedCapitalGain',
  produced: 'engineAddsTheWholeRecaptureToOrdinaryIncome',
}, ({ accepted, produced }) => {
  const result = propertySaleTax({
    salePrice: SALE_PRICE,
    costBasis: COST_BASIS,
    sellingCostPct: 0,
    primaryResidence: false,
    depreciationRecapture: DEPRECIATION,
    filingStatus: 'single',
    pack,
  })

  it('classifies the depreciation as ordinary income rather than capital gain', () => {
    expect(result.ordinaryGain).toBe(produced)
    expect(result.ordinaryGain).not.toBe(accepted)
  })

  it('leaves the capital-gain slice short by the depreciation', () => {
    // Under the statute the whole $400,000 is long-term capital gain, of which
    // $100,000 is the unrecaptured 1250 slice carrying a 25 percent ceiling.
    expect(result.capitalGain).toBe(RENTAL_GAIN - DEPRECIATION)
    expect(result.capitalGain + result.ordinaryGain).toBe(RENTAL_GAIN)
  })

  it('returns no field in which a 25 percent ceiling could be carried', () => {
    // The ceiling is a rate cap on a slice of capital gain, so expressing it at
    // all requires a third bucket the result shape does not have. This fails
    // the moment one is added, which is exactly when the record changes.
    expect(Object.keys(result).sort()).toStrictEqual([
      'capitalGain',
      'excludedGain',
      'netProceeds',
      'ordinaryGain',
      'sellingCosts',
    ])
  })
})

// ---------------------------------------------------------------------------
// IRC 121(a)/(b) — principal-residence eligibility tests
// ---------------------------------------------------------------------------

const RESIDENCE_PRICE = 800_000
const RESIDENCE_BASIS = 300_000
const RESIDENCE_GAIN = RESIDENCE_PRICE - RESIDENCE_BASIS
const JOINT_CAP = pack.federalTax.section121Exclusion.marriedFilingJointly

function sellResidence() {
  return propertySaleTax({
    salePrice: RESIDENCE_PRICE,
    costBasis: RESIDENCE_BASIS,
    sellingCostPct: 0,
    primaryResidence: true,
    filingStatus: 'marriedFilingJointly',
    pack,
  })
}

/**
 * The record's extreme case: a full joint exclusion where the correct answer is
 * nothing at all. A house bought fourteen months ago and sold today fails the
 * two-year ownership-and-use test of 121(a); so does a seller who took the
 * exclusion on another sale last year, under 121(b)(3). Either way the statute
 * excludes zero. The engine has one boolean and applies the whole cap.
 */
describeRule('irc-121-a-b-principal-residence-eligibility-tests', {
  readings: {
    statuteDeniesTheExclusionOutright: 0,
    engineAppliesTheWholeFilingStatusCap: RESIDENCE_GAIN,
  },
  accepted: 'statuteDeniesTheExclusionOutright',
  produced: 'engineAppliesTheWholeFilingStatusCap',
  note: 'a seller who fails the two-year test entirely',
}, ({ accepted, produced }) => {
  it('excludes the whole gain from a sale that qualifies for nothing', () => {
    const result = sellResidence()
    expect(result.excludedGain).toBe(produced)
    expect(result.excludedGain).not.toBe(accepted)
    // errorDirection: 'understatesTax' — the taxable capital gain is zero where
    // the statute leaves the entire $500,000 in income.
    expect(result.capitalGain).toBe(0)
    expect(RESIDENCE_GAIN).toBeLessThanOrEqual(JOINT_CAP)
  })

  it('takes no input by which any eligibility test could be expressed', () => {
    // Ownership months, use months, the date of the last qualifying sale, and
    // periods of nonqualified use are all absent from the call site, so the
    // tests are not merely unapplied — they are unrepresentable. Adding any of
    // them fails this and names the record.
    const input = {
      salePrice: RESIDENCE_PRICE,
      costBasis: RESIDENCE_BASIS,
      sellingCostPct: 0,
      primaryResidence: true,
      filingStatus: 'marriedFilingJointly' as const,
      pack,
    }
    expect(propertySaleTax(input).excludedGain).toBe(produced)
    expect(Object.keys(input).sort()).toStrictEqual([
      'costBasis',
      'filingStatus',
      'pack',
      'primaryResidence',
      'salePrice',
      'sellingCostPct',
    ])
  })
})

/**
 * 121(b)(5): gain allocated to periods of nonqualified use after 2008 is not
 * excludable at all, on the ratio of nonqualified years to years owned. Ten of
 * twenty years rented out is half the gain — $250,000 of the $500,000 stays in
 * income even though the seller passes every other test and sits under the cap.
 */
const YEARS_OWNED = 20
const NONQUALIFIED_YEARS = 10
const NONQUALIFIED_SHARE = (RESIDENCE_GAIN * NONQUALIFIED_YEARS) / YEARS_OWNED

describeRule('irc-121-a-b-principal-residence-eligibility-tests', {
  readings: {
    statuteExcludesOnlyTheQualifiedShare: RESIDENCE_GAIN - NONQUALIFIED_SHARE,
    engineAppliesTheWholeFilingStatusCap: RESIDENCE_GAIN,
  },
  accepted: 'statuteExcludesOnlyTheQualifiedShare',
  produced: 'engineAppliesTheWholeFilingStatusCap',
  note: 'gain allocated to periods of nonqualified use after 2008',
}, ({ accepted, produced }) => {
  it('excludes the nonqualified-use share along with the rest', () => {
    expect(accepted).toBe(250_000)
    const result = sellResidence()
    expect(result.excludedGain).toBe(produced)
    expect(result.excludedGain).not.toBe(accepted)
    // The over-exclusion is exactly the share the statute allocates away.
    expect((produced as number) - (accepted as number)).toBe(NONQUALIFIED_SHARE)
  })
})
