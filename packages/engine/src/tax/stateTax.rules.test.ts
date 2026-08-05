/**
 * Discriminating fixtures for the `settled` state records in the tax rule
 * registry — the first records this registry carries for a sovereign other than
 * the United States.
 *
 * A state record has a failure mode a federal one does not. The pack is a table
 * of numbers with no statute attached to any cell, so a wrong cell looks exactly
 * like a right one and a fixture written from the pack confirms only that the
 * pack was transcribed as written. Every fixture below is therefore built the
 * other way round: it names the value the state's own law predicts, names the
 * value a plausible competing reading predicts, and drives the engine to show
 * which of the two it produces. Where the competing reading can be expressed as
 * a one-field change to the pack entry — a conformity tag, an age gate, a
 * capital-gain flag — the fixture prices BOTH, so the assertion pins the exact
 * field the record is about rather than the whole arithmetic around it.
 */

import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { packForYear } from '../params/index.js'
import { conformStateStandardDeduction, stateParamsFor } from '../params/state/index.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTax, computeStateTaxableIncome } from './stateTax.js'

const TAX_YEAR = 2026

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: TAX_YEAR,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

/**
 * Guarded rather than asserted with `!`. A missing pack entry is the one
 * failure this file must not swallow: every fixture below prices a state
 * against its own law, so a mistyped code would hand the calculator undefined
 * params and fail somewhere downstream with no mention of the state that was
 * actually wanted.
 */
function pack(code: string): StateTaxParams {
  const params = stateParamsFor(code, TAX_YEAR)
  if (params === undefined) throw new Error(`no ${TAX_YEAR} state pack for ${code}`)
  return params
}

/** A projected year 10% further into the horizon than the published pack. */
const INFLATION_SCALE = 1.1

/**
 * The federal age-65 addition the conformity helper takes, sourced the way
 * production sources it rather than restated as a literal. It contributes
 * nothing to any assertion below, but not for the reason a reader might guess:
 * several scenarios do set `agesAlive: [70]`. What keeps the addition out is
 * `peopleAged65Plus: 0` in the `input()` helper, which is the field the
 * addition is actually counted against — `agesAlive` drives the retirement
 * exclusions' minimum-age gates and nothing else here. A fixture that wanted
 * to exercise the addition would have to raise the count, not the ages.
 *
 * It still has to be the real value rather than a stand-in, because a stand-in
 * would make the test agree with itself instead of with the pack.
 */
const FEDERAL_AGE65_ADDITION = packForYear(TAX_YEAR).pack.federalTax.age65Addition

describeRule('ndcc-57-38-30-3-federal-taxable-income-base', {
  readings: {
    // North Dakota's brackets run on FEDERAL taxable income, so the deduction
    // the pack carries is the federal one and has to travel with it.
    federalDeductionCarriedForward: 16_100 * INFLATION_SCALE,
    aStateFigureFrozenAtThePackYear: 16_100,
  },
  accepted: 'federalDeductionCarriedForward',
}, ({ accepted, readings }) => {
  it('moves North Dakota’s deduction with the federal figure it is a copy of', () => {
    const projected = conformStateStandardDeduction(pack('ND'), FEDERAL_AGE65_ADDITION, INFLATION_SCALE)
    expect(projected.standardDeduction.single).toBeCloseTo(accepted, 6)
    expect(projected.standardDeduction.marriedFilingJointly).toBeCloseTo(32_200 * INFLATION_SCALE, 6)
  })

  it('would freeze it if the conformity tag were dropped, which is the reading the statute rejects', () => {
    // The whole content of the record is the tag. Priced without it, the same
    // helper returns the pack-year figure, and every dollar of the widening gap
    // would be taxed at a North Dakota rate.
    const untagged = { ...pack('ND'), standardDeductionConformity: undefined }
    expect(conformStateStandardDeduction(untagged, FEDERAL_AGE65_ADDITION, INFLATION_SCALE).standardDeduction.single)
      .toBe(readings.aStateFigureFrozenAtThePackYear)
  })
})

// The North Dakota gain fixture prices a bracketed figure, so it takes an
// arithmetic helper rather than open-coding the bands inside the assertions.
//
// The 2026 schedule the tax commissioner published (Form ND-1ES): single 0% to
// 49,575, 1.95% to 250,400, 2.50% above. Deduction 16,100 single, which is the
// conformed FEDERAL figure — see the record above for why North Dakota carries it.
//
// Written out here rather than read from the pack on purpose. A fixture that
// took its expected bands from the same table the calculator reads would agree
// with the pack whatever the pack said, which is precisely the failure mode the
// header of this file describes.
function northDakotaBandedTax(
  bands: readonly (readonly [number, number, number])[],
  taxable: number,
): number {
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}
const ND_2026_SINGLE = [[0, 49_575, 0], [49_575, 250_400, 1.95], [250_400, Infinity, 2.5]] as const
const ND_DEDUCTION_SINGLE = 16_100
const ndSingleTax = (taxable: number) => northDakotaBandedTax(ND_2026_SINGLE, taxable)

const ND_GAIN_ORDINARY = 120_000
const ND_LONG_TERM_GAIN = 100_000

describeRule('ndcc-57-38-30-3-2-d-long-term-gain-exclusion', {
  readings: {
    sixtyPercentOfTheGainInTheBase:
      ndSingleTax(ND_GAIN_ORDINARY + ND_LONG_TERM_GAIN * 0.6 - ND_DEDUCTION_SINGLE),
    theWholeGainInTheBase:
      ndSingleTax(ND_GAIN_ORDINARY + ND_LONG_TERM_GAIN - ND_DEDUCTION_SINGLE),
  },
  accepted: 'sixtyPercentOfTheGainInTheBase',
}, ({ accepted, readings }) => {
  // This fixture used to live in rules/approximations/ and asserted the
  // opposite: that the engine produced `theWholeGainInTheBase`. The pack now
  // carries `capitalGainsTaxablePct: 60`, so the record is settled and the
  // assertion is inverted rather than deleted — which is exactly the transition
  // `produced` exists to force.
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_GAIN_ORDINARY,
    capitalGains: ND_LONG_TERM_GAIN,
    agesAlive: [70],
  })

  it('leaves forty percent of a long-term gain out of the North Dakota base', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('ND'), scenario)).not.toBeCloseTo(readings.theWholeGainInTheBase, 6)
    expect(computeStateTaxableIncome(pack('ND'), scenario))
      .toBeCloseTo(ND_GAIN_ORDINARY + ND_LONG_TERM_GAIN * 0.6 - ND_DEDUCTION_SINGLE, 6)
  })

  it('would tax the whole gain with the included share left at its default', () => {
    // Without the field the calculator falls back to 100% for any state whose
    // gains are ordinary, which is the reading the subdivision rejects.
    const wholeGain = { ...pack('ND'), capitalGainsTaxablePct: undefined }
    expect(computeStateTax(wholeGain, scenario)).toBeCloseTo(readings.theWholeGainInTheBase, 6)
  })

  it('still taxes the included sixty percent at ordinary North Dakota rates', () => {
    // `capitalGainsAsOrdinary` stays true, and it is not redundant with the
    // included share: North Dakota has no preferential RATE, only a partial
    // exclusion, so the sixty percent that arrives is stacked with ordinary
    // income rather than priced on a schedule of its own.
    const equivalentOrdinary = input({
      state: 'ND',
      ordinaryIncome: ND_GAIN_ORDINARY + ND_LONG_TERM_GAIN * 0.6,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('ND'), equivalentOrdinary)).toBeCloseTo(accepted, 6)
  })
})

// PA is flat 3.07% with no standard deduction, so a Pennsylvania figure is the
// taxable base times one rate and nothing else moves underneath it.
const PA_RATE = 0.0307
const PA_REALIZED_GAIN = 40_000
const PA_CARRIED_LOSS = -10_000
/** What the federal ledger reports once the carryforward has been absorbed. */
const PA_FEDERALLY_NETTED_GAIN = PA_REALIZED_GAIN + PA_CARRIED_LOSS

describeRule('pa-pit-no-capital-loss-carryforward', {
  readings: {
    // Only the year's own realized gain is a Pennsylvania gain.
    currentYearNetGainOnly: PA_REALIZED_GAIN * PA_RATE,
    // The federal ledger has already netted a prior-year loss against it.
    federalCarryforwardConformity: PA_FEDERALLY_NETTED_GAIN * PA_RATE,
  },
  accepted: 'currentYearNetGainOnly',
}, ({ accepted, readings }) => {
  // Both figures are supplied because the two readings consume different ones:
  // `currentYearOnly` re-reads the pre-carryforward realized gain, federal
  // conformity takes the netted `capitalGains`. The netted figure is kept
  // POSITIVE on purpose. An earlier version of this fixture passed the bare
  // -10,000 carryforward as `capitalGains`, which made the conforming reading
  // come out at zero — but from the loss floor rather than from the netting,
  // so the fixture discriminated against a case the rule is not about. Two
  // non-zero figures that differ by the carryforward test the actual mechanism.
  const scenario = input({
    state: 'PA',
    capitalGains: PA_FEDERALLY_NETTED_GAIN,
    realizedCapitalGainsBeforeCarryforward: PA_REALIZED_GAIN,
    agesAlive: [70],
  })

  it('taxes the realized gain and ignores the prior-year carryforward', () => {
    expect(computeStateTax(pack('PA'), scenario)).toBeCloseTo(accepted, 6)
  })

  it('would tax only the netted gain under federal conformity', () => {
    const conforming = { ...pack('PA'), capitalLossCarryforwardConformity: 'federal' as const }
    expect(computeStateTax(conforming, scenario))
      .toBeCloseTo(readings.federalCarryforwardConformity, 6)
  })
})

// The three constitutional records share a shape: the pack answers with
// `hasIncomeTax: false`, which zeroes the base outright, and the discriminating
// question is whether the constitutional bar really reaches the income a
// retiree actually has. Each fixture prices the same scenario a second time
// with `hasIncomeTax: true` so the zero is provably the bar's doing and not an
// empty input.

describeRule('nv-const-10-1-9-no-personal-income-tax', {
  readings: {
    barsWagesAndAllOtherPersonalIncome: 0,
    barsWagesOnlyLeavingRetirementIncomeReachable: 120_000,
  },
  accepted: 'barsWagesAndAllOtherPersonalIncome',
}, ({ accepted, readings }) => {
  // Not one dollar of this is wages, which is the point: a bar written for
  // wages alone would leave all of it in a Nevada base.
  const scenario = input({
    state: 'NV',
    ordinaryIncome: 120_000,
    privateRetirementIncome: 120_000,
    ssBenefits: 30_000,
    agesAlive: [70],
  })

  it('leaves a Nevada retiree with no state base at all', () => {
    expect(computeStateTaxableIncome(pack('NV'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('NV'), scenario)).toBe(0)
  })

  it('would carry the pension and IRA income under the narrower reading', () => {
    const reachable = { ...pack('NV'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(reachable, scenario))
      .toBe(readings.barsWagesOnlyLeavingRetirementIncomeReachable)
  })
})

// Texas is two records, one per constitutional section, because the sections
// have different start years. Two fixtures, each on the income its own section
// reaches, and neither leaning on the other.

describeRule('tx-const-8-24-a-individual-income-tax-prohibited', {
  readings: {
    netIncomeBeyondTheLegislaturesReach: 0,
    netIncomeReachableAsInAnyOtherState: 120_000,
  },
  accepted: 'netIncomeBeyondTheLegislaturesReach',
}, ({ accepted, readings }) => {
  // Ordinary retirement income only: this is what section 24-a bars on its own,
  // with no capital gain in the scenario to borrow section 24-b's authority.
  const scenario = input({
    state: 'TX',
    ordinaryIncome: 120_000,
    privateRetirementIncome: 120_000,
    ssBenefits: 30_000,
    agesAlive: [70],
  })

  it('leaves a Texas retiree’s pension and IRA income out of any state base', () => {
    expect(computeStateTaxableIncome(pack('TX'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('TX'), scenario)).toBe(0)
  })

  it('would carry all of it if the legislature could reach net income', () => {
    const reachable = { ...pack('TX'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(reachable, scenario))
      .toBe(readings.netIncomeReachableAsInAnyOtherState)
  })
})

describeRule('tx-const-8-24-b-capital-gains-tax-prohibited', {
  readings: {
    // Section 24-b, adopted November 2025 and in force from tax year 2026.
    realizedGainBarredBySection24b: 0,
    // The state of the law through tax year 2025: section 24-a bars a tax on
    // "net incomes", and whether that reached a realized-gains tax was open.
    // The answer decides $100,000 of base.
    gainOutsideTheNetIncomeBarOfSection24a: 100_000,
  },
  accepted: 'realizedGainBarredBySection24b',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'TX', capitalGains: 100_000, agesAlive: [70] })

  it('leaves a realized gain outside any Texas base', () => {
    expect(computeStateTaxableIncome(pack('TX'), scenario)).toBe(accepted)
  })

  it('would put the gain in the base under the question section 24-a left open', () => {
    const gainsReachable = { ...pack('TX'), hasIncomeTax: true, capitalGainsAsOrdinary: true }
    expect(computeStateTaxableIncome(gainsReachable, scenario))
      .toBe(readings.gainOutsideTheNetIncomeBarOfSection24a)
  })
})

describeRule('fl-const-7-5-a-income-tax-prohibited', {
  readings: {
    // Chapter 220 imposes the tax on "every taxpayer", and "taxpayer" is
    // defined as a corporation.
    chapter220ReachesCorporationsOnly: 0,
    chapter220ReachingIndividualsToo: 120_000,
  },
  accepted: 'chapter220ReachesCorporationsOnly',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'FL',
    ordinaryIncome: 120_000,
    privateRetirementIncome: 120_000,
    agesAlive: [70],
  })

  it('leaves a Florida retiree with no state base at all', () => {
    expect(computeStateTaxableIncome(pack('FL'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('FL'), scenario)).toBe(0)
  })

  it('would tax the same income if the imposition reached natural persons', () => {
    const reachable = { ...pack('FL'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(reachable, scenario)).toBe(readings.chapter220ReachingIndividualsToo)
  })
})

// WV brackets, single and joint alike: 2.22% to 10k, 2.96% to 25k, 3.33% to
// 40k, 4.44% to 60k, 4.82% above. No standard deduction.
function westVirginiaTax(taxable: number): number {
  const bands: readonly [number, number, number][] = [
    [0, 10_000, 2.22], [10_000, 25_000, 2.96], [25_000, 40_000, 3.33],
    [40_000, 60_000, 4.44], [60_000, Infinity, 4.82],
  ]
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}

const WV_OTHER_INCOME = 90_000
const WV_SS = 40_000
// Provisional income (90,000 + 20,000) is far above the single 34,000
// threshold and the 85% ceiling binds: 0.85 × 40,000.
const WV_FEDERALLY_TAXABLE_SS = 0.85 * WV_SS

describeRule('wv-code-11-21-12-social-security-full-modification', {
  readings: {
    fullDecreasingModificationFrom2026: westVirginiaTax(WV_OTHER_INCOME),
    federallyTaxableSocialSecurityStillInTheBase:
      westVirginiaTax(WV_OTHER_INCOME + WV_FEDERALLY_TAXABLE_SS),
  },
  accepted: 'fullDecreasingModificationFrom2026',
}, ({ accepted, readings }) => {
  // No retirement income in the scenario, so the separate $8,000 modification
  // for a taxpayer over 65 stays out of the arithmetic and the only thing
  // moving between the two readings is Social Security.
  const scenario = input({ state: 'WV', ordinaryIncome: WV_OTHER_INCOME, ssBenefits: WV_SS, agesAlive: [70] })

  it('keeps every dollar of Social Security out of the West Virginia base', () => {
    expect(computeStateTax(pack('WV'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('WV'), scenario)).toBeCloseTo(WV_OTHER_INCOME, 6)
  })

  it('would add the federally taxable portion under the pre-2026 treatment', () => {
    const taxing = { ...pack('WV'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.federallyTaxableSocialSecurityStillInTheBase, 6)
    expect(computeStateTaxableIncome(taxing, scenario))
      .toBeCloseTo(WV_OTHER_INCOME + WV_FEDERALLY_TAXABLE_SS, 6)
  })
})

const IL_RATE = 0.0495
const IL_RETIREMENT = 100_000

describeRule('il-ita-203-a-2-F-retirement-income-subtraction', {
  readings: {
    subtractionCarriesNoAgeCondition: 0,
    subtractionGatedOnRetirementAge: IL_RETIREMENT * IL_RATE,
  },
  accepted: 'subtractionCarriesNoAgeCondition',
}, ({ accepted, readings }) => {
  // Fifty-eight: too young for every other state's exclusion in the pack, and
  // squarely inside Illinois's, because 203(a)(2)(F) states no age at all.
  const scenario = input({
    state: 'IL',
    ordinaryIncome: IL_RETIREMENT,
    privateRetirementIncome: IL_RETIREMENT,
    agesAlive: [58],
  })

  it('subtracts an Illinois retiree’s IRA income at 58', () => {
    expect(computeStateTax(pack('IL'), scenario)).toBe(accepted)
  })

  it('would tax all of it if the subtraction carried the usual age gate', () => {
    const gated = {
      ...pack('IL'),
      retirementPrivate: { kind: 'full' as const, minAge: 65 },
      retirementPublic: { kind: 'full' as const, minAge: 65 },
    }
    expect(computeStateTax(gated, scenario)).toBeCloseTo(readings.subtractionGatedOnRetirementAge, 6)
  })
})

// MO 2026 brackets: 0% to 1,348 then 2%, 2.5%, 3%, 3.5%, 4%, 4.5% in 1,348-wide
// steps, 4.7% above 9,436. Standard deduction 16,100 (federal-conformed).
function missouriTax(taxable: number): number {
  const bands: readonly [number, number, number][] = [
    [0, 1348, 0], [1348, 2696, 2], [2696, 4044, 2.5], [4044, 5392, 3],
    [5392, 6740, 3.5], [6740, 8088, 4], [8088, 9436, 4.5], [9436, Infinity, 4.7],
  ]
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}

const MO_ORDINARY = 60_000
const MO_GAIN = 100_000
const MO_DEDUCTION = 16_100

describeRule('mo-rsmo-143-121-capital-gain-deduction', {
  readings: {
    hundredPercentOfTheGainSubtracted: missouriTax(MO_ORDINARY - MO_DEDUCTION),
    gainTaxedAsOrdinaryIncome: missouriTax(MO_ORDINARY + MO_GAIN - MO_DEDUCTION),
  },
  accepted: 'hundredPercentOfTheGainSubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'MO', ordinaryIncome: MO_ORDINARY, capitalGains: MO_GAIN, agesAlive: [70] })

  it('leaves the whole capital gain out of the Missouri base', () => {
    expect(computeStateTax(pack('MO'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('MO'), scenario)).toBeCloseTo(MO_ORDINARY - MO_DEDUCTION, 6)
  })

  it('would tax it like every other income-tax state in the pack', () => {
    const ordinaryGains = { ...pack('MO'), capitalGainsAsOrdinary: true }
    expect(computeStateTax(ordinaryGains, scenario)).toBeCloseTo(readings.gainTaxedAsOrdinaryIncome, 6)
  })
})

const IA_RATE = 0.038
const IA_RETIREMENT = 90_000
const IA_DEDUCTION = 16_100

describeRule('iowa-code-422-7-19-a-retirement-income-exclusion', {
  readings: {
    exclusionFromFiftyFive: 0,
    exclusionFromSixtyFive: (IA_RETIREMENT - IA_DEDUCTION) * IA_RATE,
  },
  accepted: 'exclusionFromFiftyFive',
}, ({ accepted, readings }) => {
  // Fifty-six: past Iowa's line and short of everyone else's.
  const scenario = input({
    state: 'IA',
    ordinaryIncome: IA_RETIREMENT,
    privateRetirementIncome: IA_RETIREMENT,
    agesAlive: [56],
  })

  it('excludes an Iowa retiree’s pension in full at 56', () => {
    expect(computeStateTax(pack('IA'), scenario)).toBe(accepted)
  })

  it('would tax it under the sixty-five gate most states use', () => {
    const gated = {
      ...pack('IA'),
      retirementPrivate: { kind: 'full' as const, minAge: 65 },
      retirementPublic: { kind: 'full' as const, minAge: 65 },
    }
    expect(computeStateTax(gated, scenario)).toBeCloseTo(readings.exclusionFromSixtyFive, 6)
  })
})

describeRule('mrs-36-5124-c-1-b-decoupled-standard-deduction', {
  readings: {
    maineSetsItsOwnAmountFrom2026: 15_700,
    federalDeductionCarriedForward: 15_700 * INFLATION_SCALE,
  },
  accepted: 'maineSetsItsOwnAmountFrom2026',
}, ({ accepted, readings }) => {
  it('holds Maine’s deduction still as the federal figure is projected upward', () => {
    // Untagged, so the conformity indexer must pass it through untouched.
    expect(pack('ME').standardDeductionConformity).toBeUndefined()
    expect(conformStateStandardDeduction(pack('ME'), FEDERAL_AGE65_ADDITION, INFLATION_SCALE).standardDeduction.single)
      .toBe(accepted)
  })

  it('would inflate it every projected year if it were tagged as conforming', () => {
    const mistagged = { ...pack('ME'), standardDeductionConformity: 'federal' as const }
    expect(conformStateStandardDeduction(mistagged, FEDERAL_AGE65_ADDITION, INFLATION_SCALE).standardDeduction.single)
      .toBeCloseTo(readings.federalDeductionCarriedForward, 6)
  })
})

describe('state jurisdiction records', () => {
  it('models every state these records describe', () => {
    // A record naming a state the pack does not carry would be a claim about
    // code that is not there.
    for (const code of ['ND', 'PA', 'NV', 'TX', 'FL', 'WV', 'NY', 'IL', 'MO', 'IA', 'ME', 'SC']) {
      expect(stateParamsFor(code, TAX_YEAR), code).toBeDefined()
    }
  })
})
