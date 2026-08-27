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

// The remaining North Dakota fixtures all price a bracketed figure, so they
// share one arithmetic helper rather than restating the bands five times.
//
// The 2026 schedule the tax commissioner published (Form ND-1ES): single 0% to
// 49,575, 1.95% to 250,400, 2.50% above; joint 0% to 82,800, 1.95% to 304,850,
// 2.50% above. Deduction 16,100 single / 32,200 joint, which is the conformed
// FEDERAL figure — see the record above for why North Dakota carries it.
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
const ND_2026_JOINT = [[0, 82_800, 0], [82_800, 304_850, 1.95], [304_850, Infinity, 2.5]] as const
const ND_2025_SINGLE = [[0, 48_475, 0], [48_475, 244_825, 1.95], [244_825, Infinity, 2.5]] as const
const ND_2025_JOINT = [[0, 80_975, 0], [80_975, 298_075, 1.95], [298_075, Infinity, 2.5]] as const
const ND_DEDUCTION_SINGLE = 16_100
const ND_DEDUCTION_JOINT = 32_200
const ndSingleTax = (taxable: number) => northDakotaBandedTax(ND_2026_SINGLE, taxable)

// A single filer with 100,000 of ordinary income lands inside the 1.95% band
// under both schedules, so the whole difference between them is the 1,100
// dollars by which the zero bracket moved. That is the point: the readings
// differ by the indexation and by nothing else.
const ND_SCHEDULE_INCOME = 100_000
const ND_SCHEDULE_TAXABLE = ND_SCHEDULE_INCOME - ND_DEDUCTION_SINGLE

describeRule('ndcc-57-38-30-3-1-g-commissioner-indexed-rate-schedule', {
  readings: {
    publishedTwentyTwentySixSchedule: northDakotaBandedTax(ND_2026_SINGLE, ND_SCHEDULE_TAXABLE),
    priorYearScheduleHeldForward: northDakotaBandedTax(ND_2025_SINGLE, ND_SCHEDULE_TAXABLE),
  },
  accepted: 'publishedTwentyTwentySixSchedule',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'ND', ordinaryIncome: ND_SCHEDULE_INCOME, agesAlive: [70] })

  it('measures a 2026 North Dakotan against the 2026 schedule the commissioner published', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('ND'), scenario)).not.toBeCloseTo(readings.priorYearScheduleHeldForward, 6)
  })

  it('would over-tax the same household on the schedule the pack used to carry', () => {
    // The defect this replaces, priced: 2025 thresholds inside a 2026 pack.
    // 57-38-30.3(1)(g) is not optional — a new schedule applies IN LIEU OF the
    // statutory one every year — so holding a year forward is not conservatism,
    // it is taxing income North Dakota has moved into the zero bracket.
    const heldForward = {
      ...pack('ND'),
      brackets: {
        single: ND_2025_SINGLE.map(([lowerBound, , ratePct]) => ({ lowerBound, ratePct })),
        marriedFilingJointly: ND_2025_JOINT.map(([lowerBound, , ratePct]) => ({ lowerBound, ratePct })),
      },
    }
    const stale = computeStateTax(heldForward, scenario)
    expect(stale).toBeCloseTo(readings.priorYearScheduleHeldForward, 6)
    expect(stale).toBeGreaterThan(accepted)
  })

  it('carries the joint schedule too, which indexes by a different amount', () => {
    // 82,800 against 80,975: the joint zero bracket moved 1,825 dollars, not the
    // 1,100 the single one did. A pack that indexed one schedule and copied the
    // other would pass the assertions above and fail here.
    const joint = input({
      state: 'ND',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: 150_000,
      agesAlive: [70, 70],
    })
    const taxable = 150_000 - ND_DEDUCTION_JOINT
    expect(computeStateTax(pack('ND'), joint))
      .toBeCloseTo(northDakotaBandedTax(ND_2026_JOINT, taxable), 6)
    expect(computeStateTax(pack('ND'), joint))
      .not.toBeCloseTo(northDakotaBandedTax(ND_2025_JOINT, taxable), 6)
  })
})

// 90,000 of other income puts the household far above every section 86
// threshold, so the federally taxable share of the benefit is the 85% ceiling:
// 34,000 of the 40,000. That is the amount the repealed rule would have left in
// the North Dakota base for a household over the old 50,000 dollar cap.
const ND_SS_OTHER_INCOME = 90_000
const ND_SS_BENEFITS = 40_000
const ND_SS_FEDERALLY_TAXABLE = ND_SS_BENEFITS * 0.85

describeRule('ndcc-57-38-30-3-2-s-social-security-subtraction', {
  readings: {
    everyBenefitDollarSubtracted: ndSingleTax(ND_SS_OTHER_INCOME - ND_DEDUCTION_SINGLE),
    repealedAdjustedGrossIncomeCap:
      ndSingleTax(ND_SS_OTHER_INCOME + ND_SS_FEDERALLY_TAXABLE - ND_DEDUCTION_SINGLE),
  },
  accepted: 'everyBenefitDollarSubtracted',
}, ({ accepted, readings }) => {
  // Chosen so the household is over the repealed threshold: 90,000 of other
  // income is well past the 50,000 dollar single cap H.B. 1174 imposed in 2019.
  // A fixture run under the cap would return the same figure either way and
  // prove nothing about which rule the engine holds.
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_SS_OTHER_INCOME,
    ssBenefits: ND_SS_BENEFITS,
    agesAlive: [70],
  })

  it('leaves a high-income North Dakotan’s Social Security out of the state base', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('ND'), scenario))
      .toBeCloseTo(ND_SS_OTHER_INCOME - ND_DEDUCTION_SINGLE, 6)
  })

  it('would pull 34,000 of benefit into the base under the pre-2021 threshold rule', () => {
    // S.B. 2351 of the November 2021 special session struck the thresholds for
    // taxable years beginning after 2020. Priced as the flag that would restore
    // them: the base grows by the federally taxable share and nothing else.
    const capped = { ...pack('ND'), taxesSocialSecurity: true }
    expect(computeStateTax(capped, scenario)).toBeCloseTo(readings.repealedAdjustedGrossIncomeCap, 6)
    expect(computeStateTaxableIncome(capped, scenario) - computeStateTaxableIncome(pack('ND'), scenario))
      .toBeCloseTo(ND_SS_FEDERALLY_TAXABLE, 6)
  })
})

// Both uniformed-retirement records drive the same field — the public bucket —
// so they use different households and different dollar figures, and each
// prices the taxed reading through `retirementPublic: { kind: 'none' }`, which
// is what the pack held before this pass.
const ND_MILITARY_OTHER_INCOME = 95_000
const ND_MILITARY_PENSION = 45_000
const ND_PUBLIC_BUCKET_TAXED = { kind: 'none' } as const

describeRule('ndcc-57-38-30-3-2-r-military-retirement-exclusion', {
  readings: {
    retiredMilitaryPayFullySubtracted:
      ndSingleTax(ND_MILITARY_OTHER_INCOME - ND_DEDUCTION_SINGLE),
    taxedLikeAnyOtherRetirementIncome:
      ndSingleTax(ND_MILITARY_OTHER_INCOME + ND_MILITARY_PENSION - ND_DEDUCTION_SINGLE),
  },
  accepted: 'retiredMilitaryPayFullySubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_MILITARY_OTHER_INCOME + ND_MILITARY_PENSION,
    publicPensionIncome: ND_MILITARY_PENSION,
    agesAlive: [70],
  })

  it('takes the whole military pension out of a North Dakota base', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('ND'), scenario)).toBeLessThan(readings.taxedLikeAnyOtherRetirementIncome)
  })

  it('would tax all 45,000 of it if the public bucket carried no exclusion', () => {
    const taxed = { ...pack('ND'), retirementPublic: ND_PUBLIC_BUCKET_TAXED }
    expect(computeStateTax(taxed, scenario)).toBeCloseTo(readings.taxedLikeAnyOtherRetirementIncome, 6)
  })

  it('does not spill the exclusion onto private retirement income', () => {
    // `retirementRuleShared` is false for North Dakota precisely because the
    // public rule is a rule of its own. An IRA distribution of the same size is
    // taxed in full, which is what makes the public exclusion a fact about the
    // pension rather than about retirement income generally.
    const privatePension = input({
      state: 'ND',
      ordinaryIncome: ND_MILITARY_OTHER_INCOME + ND_MILITARY_PENSION,
      privateRetirementIncome: ND_MILITARY_PENSION,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('ND'), privatePension))
      .toBeCloseTo(readings.taxedLikeAnyOtherRetirementIncome, 6)
  })
})

const ND_OFFICER_OTHER_INCOME = 120_000
const ND_OFFICER_PENSION = 38_000

describeRule('ndcc-57-38-30-3-2-t-retired-peace-officer-exclusion', {
  readings: {
    twentyYearOfficerBenefitFullySubtracted:
      ndSingleTax(ND_OFFICER_OTHER_INCOME - ND_DEDUCTION_SINGLE),
    taxedLikeAnyOtherRetirementIncome:
      ndSingleTax(ND_OFFICER_OTHER_INCOME + ND_OFFICER_PENSION - ND_DEDUCTION_SINGLE),
  },
  accepted: 'twentyYearOfficerBenefitFullySubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_OFFICER_OTHER_INCOME + ND_OFFICER_PENSION,
    publicPensionIncome: ND_OFFICER_PENSION,
    agesAlive: [70],
  })

  it('takes a retired officer’s benefit out of a North Dakota base in full', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(accepted, 6)
  })

  it('would tax it as ordinary retirement income without the subdivision', () => {
    const taxed = { ...pack('ND'), retirementPublic: ND_PUBLIC_BUCKET_TAXED }
    expect(computeStateTax(taxed, scenario)).toBeCloseTo(readings.taxedLikeAnyOtherRetirementIncome, 6)
    expect(computeStateTax(taxed, scenario)).toBeGreaterThan(accepted)
  })
})

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

// ─── The rest of the seven no-individual-income-tax states ───────────────────
//
// Same outward shape as the Nevada, Texas and Florida fixtures above — the pack
// answers `hasIncomeTax: false`, and each fixture prices the scenario a second
// time with the state's own law neutralised so the zero is provably the law's
// doing rather than an empty input. What differs is the counterfactual, and the
// counterfactual is the record. Nevada's competing reading was a bar confined
// to wages; Alaska's is a chapter that reaches individuals as well as
// corporations; South Dakota's is the Legislature having used the power article
// XI, section 2 gives it; Tennessee's is two different competing readings for
// two different halves of one state's income, which is why Tennessee has two
// records and neither leans on the other.
//
// Each scenario is built out of the income the competing reading would actually
// catch. That matters most for Tennessee: a fixture that priced wages against
// the Hall record, or dividends against the constitutional record, would come
// out zero either way and prove nothing about either.

describeRule('ak-stat-43-20-012-a-tax-does-not-apply-to-individuals', {
  readings: {
    individualsExcludedFromTheOnlyChapterThatImposes: 0,
    theChapterReachingIndividualsAsItReachesCorporations: 150_000,
  },
  accepted: 'individualsExcludedFromTheOnlyChapterThatImposes',
}, ({ accepted, readings }) => {
  // Alaska DOES levy an income tax — 43.20.011(e) imposes one on every
  // corporation. The whole content of 43.20.012(a) is that this taxpayer is not
  // in it, so the scenario is an individual's income and nothing else.
  const scenario = input({
    state: 'AK',
    // Retirement income is a SUBSET of ordinary income in this model, not an
    // addition to it: the exclusion subtracts, nothing adds it in. So the
    // counterfactual base is the ordinary figure, and the retirement line is
    // here to say that all of it is what a retiree actually lives on.
    ordinaryIncome: 150_000,
    privateRetirementIncome: 150_000,
    ssBenefits: 30_000,
    agesAlive: [70],
  })

  it('leaves an Alaska individual outside the chapter that does impose a tax', () => {
    expect(computeStateTaxableIncome(pack('AK'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('AK'), scenario)).toBe(0)
  })

  it('would carry the whole of it if the exclusion in 43.20.012(a) were not there', () => {
    const reachable = { ...pack('AK'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(reachable, scenario))
      .toBe(readings.theChapterReachingIndividualsAsItReachesCorporations)
  })
})

describeRule('sd-no-individual-income-tax', {
  readings: {
    noImpositionExistsSoThereIsNoBase: 0,
    theLegislatureHavingUsedItsArticleXiPower: 150_000,
  },
  accepted: 'noImpositionExistsSoThereIsNoBase',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'SD',
    // Retirement income is a SUBSET of ordinary income in this model, not an
    // addition to it: the exclusion subtracts, nothing adds it in. So the
    // counterfactual base is the ordinary figure, and the retirement line is
    // here to say that all of it is what a retiree actually lives on.
    ordinaryIncome: 150_000,
    privateRetirementIncome: 150_000,
    ssBenefits: 30_000,
    agesAlive: [70],
  })

  it('leaves a South Dakota retiree with no state base at all', () => {
    expect(computeStateTaxableIncome(pack('SD'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('SD'), scenario)).toBe(0)
  })

  it('would build a base the day the Legislature exercised the power it holds', () => {
    // The competing reading here is not a misreading of a prohibition — South
    // Dakota has none. It is the same state one session later, which is exactly
    // what separates this record from Nevada's and is why it is priced.
    const enacted = { ...pack('SD'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(enacted, scenario))
      .toBe(readings.theLegislatureHavingUsedItsArticleXiPower)
  })
})

describeRule('tn-const-2-28-earned-income-tax-prohibited', {
  readings: {
    payrollBeyondTheReachOfStateAndLocalTaxAlike: 0,
    payrollReachableAsInAnyOtherState: 140_000,
  },
  accepted: 'payrollBeyondTheReachOfStateAndLocalTaxAlike',
}, ({ accepted, readings }) => {
  // Earned income only, because earned income is all article II, section 28
  // reaches. Not one dollar of retirement or investment income is in here; the
  // sister record below prices that, and the split is the point.
  const scenario = input({ state: 'TN', ordinaryIncome: 140_000, agesAlive: [70] })

  it('keeps a Tennessee wage earner’s payroll out of any state base', () => {
    expect(computeStateTaxableIncome(pack('TN'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('TN'), scenario)).toBe(0)
  })

  it('would tax the same payroll without the constitutional bar', () => {
    const reachable = { ...pack('TN'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(reachable, scenario))
      .toBe(readings.payrollReachableAsInAnyOtherState)
  })
})

describeRule('tn-hall-income-tax-repealed-from-2021', {
  readings: {
    interestAndDividendsUntaxedFrom2021: 0,
    // The Hall base, had the elimination not arrived: interest from bonds and
    // notes, and dividends from stock. Article II, section 28 does not reach a
    // dollar of it, and still grants the power to tax it.
    theHallBaseAsItStoodBeforeTheRamp: 100_000,
  },
  accepted: 'interestAndDividendsUntaxedFrom2021',
}, ({ accepted, readings }) => {
  // Deliberately no wages. If this scenario carried any, the constitutional
  // record above would explain the zero and this one would prove nothing.
  const scenario = input({
    state: 'TN',
    ordinaryIncome: 60_000, // interest from bonds and notes
    qualifiedDividends: 40_000,
    agesAlive: [70],
  })

  it('leaves a Tennessee retiree’s interest and dividends untaxed', () => {
    expect(computeStateTaxableIncome(pack('TN'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('TN'), scenario)).toBe(0)
  })

  it('would reach every dollar of it if the Hall tax had survived', () => {
    const hallStillInForce = { ...pack('TN'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(hallStillInForce, scenario))
      .toBe(readings.theHallBaseAsItStoodBeforeTheRamp)
  })
})

describeRule('wy-stat-39-12-101-no-state-or-local-income-tax', {
  readings: {
    theFieldIsEmptyOfAnyImposition: 0,
    titleThirtyNineCarryingAnImpositionAsWellAsAPreemption: 150_000,
  },
  accepted: 'theFieldIsEmptyOfAnyImposition',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'WY',
    // Retirement income is a SUBSET of ordinary income in this model, not an
    // addition to it: the exclusion subtracts, nothing adds it in. So the
    // counterfactual base is the ordinary figure, and the retirement line is
    // here to say that all of it is what a retiree actually lives on.
    ordinaryIncome: 150_000,
    privateRetirementIncome: 150_000,
    ssBenefits: 30_000,
    agesAlive: [70],
  })

  it('leaves a Wyoming retiree with no state base at all', () => {
    expect(computeStateTaxableIncome(pack('WY'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('WY'), scenario)).toBe(0)
  })

  it('would build a base if chapter 12 imposed as well as preempted', () => {
    // 39-12-101 is the whole of Wyoming's income tax chapter and it imposes
    // nothing — it reserves the field. The competing reading is a chapter that
    // did both, which is what almost every other state's title 39 equivalent
    // does. The LOCAL half of this record — that no Wyoming county or city can
    // levy one either, whatever rate a caller supplies — is priced separately
    // in stateTax.test.ts, because it is a fact about `localRatePct` rather
    // than about the state base.
    const imposing = { ...pack('WY'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(imposing, scenario))
      .toBe(readings.titleThirtyNineCarryingAnImpositionAsWellAsAPreemption)
  })
})

// Arkansas, the schedule DFA published for 2026 (Form AR1000ES): 0% to 5,600,
// 2% to 11,200, 3% to 16,000, 3.4% to 26,400, 3.9% above. Deduction 2,470 per
// taxpayer, which is Arkansas's own figure and not the federal one.
//
// Written out rather than read from the pack, for the reason the North Dakota
// helper above gives: a fixture that took its bands from the table the
// calculator reads would agree with a wrong table as readily as a right one.
function arkansasBandedTax(
  bands: readonly (readonly [number, number, number])[],
  taxable: number,
): number {
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}
const AR_2026_PUBLISHED = [
  [0, 5_600, 0], [5_600, 11_200, 2], [11_200, 16_000, 3], [16_000, 26_400, 3.4], [26_400, Infinity, 3.9],
] as const
// 26-51-201(a)(3)(B)'s un-indexed schedule, which the pack carried until
// 2026-08-05 and which Arkansas applies only to a filer above roughly $94,700.
const AR_HIGH_INCOME_UNINDEXED = [[0, 4_500, 2], [4_500, Infinity, 3.9]] as const
const AR_DEDUCTION_SINGLE = 2_470
const AR_DEDUCTION_2024 = 2_410
const arSingleTax = (taxable: number) => arkansasBandedTax(AR_2026_PUBLISHED, taxable)

// 50,000 lands in the top band under both schedules, so the whole difference
// between the readings is the four bands below it that the published schedule
// has and the high-income one does not.
const AR_SCHEDULE_INCOME = 50_000
const AR_SCHEDULE_TAXABLE = AR_SCHEDULE_INCOME - AR_DEDUCTION_SINGLE

describeRule('aca-26-51-201-published-indexed-rate-schedule', {
  readings: {
    publishedTwentyTwentySixSchedule: arSingleTax(AR_SCHEDULE_TAXABLE),
    unindexedHighIncomeSchedule: arkansasBandedTax(AR_HIGH_INCOME_UNINDEXED, AR_SCHEDULE_TAXABLE),
  },
  accepted: 'publishedTwentyTwentySixSchedule',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'AR', ordinaryIncome: AR_SCHEDULE_INCOME, agesAlive: [70] })

  it('measures a 2026 Arkansan against the schedule the department published', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('AR'), scenario)).not.toBeCloseTo(readings.unindexedHighIncomeSchedule, 6)
  })

  it('would over-tax the same household on the schedule the pack used to carry', () => {
    // The defect this replaces, priced. Under 26-51-201(a)(3)(B) the first
    // 5,600 dollars are taxed at 2% instead of nothing and the three middle
    // bands disappear, so an ordinary retiree pays about 335 dollars a year
    // Arkansas does not charge.
    const highIncomeSchedule = {
      ...pack('AR'),
      brackets: {
        single: AR_HIGH_INCOME_UNINDEXED.map(([lowerBound, , ratePct]) => ({ lowerBound, ratePct })),
        marriedFilingJointly: AR_HIGH_INCOME_UNINDEXED.map(([lowerBound, , ratePct]) => ({ lowerBound, ratePct })),
      },
    }
    const stale = computeStateTax(highIncomeSchedule, scenario)
    expect(stale).toBeCloseTo(readings.unindexedHighIncomeSchedule, 6)
    expect(stale).toBeGreaterThan(accepted)
  })

  it('opens with a zero bracket, which the schedule it replaced does not', () => {
    // The cleanest single consequence: an Arkansan whose net taxable income is
    // inside the zero band owes nothing at all.
    const small = input({ state: 'AR', ordinaryIncome: 7_000, agesAlive: [70] })
    expect(computeStateTaxableIncome(pack('AR'), small)).toBeCloseTo(4_530, 6)
    expect(computeStateTax(pack('AR'), small)).toBe(0)
  })
})

describeRule('aca-26-51-430-c-published-indexed-standard-deduction', {
  readings: {
    publishedTwentyTwentySixDeduction: arSingleTax(AR_SCHEDULE_INCOME - AR_DEDUCTION_SINGLE),
    twentyTwentyFourDeduction: arSingleTax(AR_SCHEDULE_INCOME - AR_DEDUCTION_2024),
  },
  accepted: 'publishedTwentyTwentySixDeduction',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'AR', ordinaryIncome: AR_SCHEDULE_INCOME, agesAlive: [70] })

  it('deducts the amount the department published for 2026', () => {
    expect(computeStateTaxableIncome(pack('AR'), scenario)).toBeCloseTo(AR_SCHEDULE_TAXABLE, 6)
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(accepted, 6)
    expect(pack('AR').standardDeduction.marriedFilingJointly).toBe(4_940)
  })

  it('would carry a two-year-stale figure on the amount the pack used to hold', () => {
    const stale = { ...pack('AR'), standardDeduction: { single: AR_DEDUCTION_2024, marriedFilingJointly: 4_820 } }
    expect(computeStateTax(stale, scenario)).toBeCloseTo(readings.twentyTwentyFourDeduction, 6)
    expect(computeStateTax(stale, scenario)).toBeGreaterThan(accepted)
  })

  it('is Arkansas’s own figure, so the federal conformity indexer must not touch it', () => {
    // 26-51-430(c) indexes it on Arkansas's own schedule with a 3% ceiling.
    // Tagging it would move it with IRC 63(c) instead and hand the Arkansas
    // base a federal age-65 addition Arkansas does not grant.
    expect(pack('AR').standardDeductionConformity).toBeUndefined()
    const projected = conformStateStandardDeduction(pack('AR'), FEDERAL_AGE65_ADDITION, INFLATION_SCALE)
    expect(projected.standardDeduction.single).toBe(AR_DEDUCTION_SINGLE)
    expect(projected.standardDeductionAge65Addition).toBeUndefined()
  })
})

// One household, two pensions, and the question is how many $6,000 exemptions
// it gets. 26-51-307(b)(1)(B) says one.
const AR_OTHER_INCOME = 30_000
const AR_PRIVATE_PENSION = 20_000
const AR_PUBLIC_PENSION = 10_000
const AR_TWO_PENSION_GROSS = AR_OTHER_INCOME + AR_PRIVATE_PENSION + AR_PUBLIC_PENSION

describeRule('aca-26-51-307-six-thousand-retirement-exemption', {
  readings: {
    oneSixThousandPerTaxpayer:
      arSingleTax(AR_TWO_PENSION_GROSS - 6_000 - AR_DEDUCTION_SINGLE),
    sixThousandInEachBucket:
      arSingleTax(AR_TWO_PENSION_GROSS - 12_000 - AR_DEDUCTION_SINGLE),
  },
  accepted: 'oneSixThousandPerTaxpayer',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'AR',
    ordinaryIncome: AR_TWO_PENSION_GROSS,
    privateRetirementIncome: AR_PRIVATE_PENSION,
    publicPensionIncome: AR_PUBLIC_PENSION,
    agesAlive: [70],
  })

  it('exempts $6,000 across both pensions rather than $6,000 of each', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('AR'), scenario))
      .toBeCloseTo(AR_TWO_PENSION_GROSS - 6_000 - AR_DEDUCTION_SINGLE, 6)
  })

  it('would grant two exemptions if the public bucket carried a rule of its own', () => {
    // Which is what an entry in PUBLIC_PENSION_OVERRIDES does: it clears
    // `retirementRuleShared`, and the calculator then runs each bucket's rule
    // against its own income.
    const separateBuckets = { ...pack('AR'), retirementRuleShared: false }
    expect(computeStateTax(separateBuckets, scenario)).toBeCloseTo(readings.sixThousandInEachBucket, 6)
    expect(computeStateTax(separateBuckets, scenario)).toBeLessThan(accepted)
  })
})

const AR_CIVIL_SERVICE_GROSS = 55_000
const AR_CIVIL_SERVICE_PENSION = 40_000

describeRule('aca-26-51-307-a-1-public-pension-inside-the-six-thousand', {
  readings: {
    sixThousandLikeAnyOtherPension:
      arSingleTax(AR_CIVIL_SERVICE_GROSS - 6_000 - AR_DEDUCTION_SINGLE),
    everyPublicPensionExempt:
      arSingleTax(AR_CIVIL_SERVICE_GROSS - AR_CIVIL_SERVICE_PENSION - AR_DEDUCTION_SINGLE),
  },
  accepted: 'sixThousandLikeAnyOtherPension',
}, ({ accepted, readings }) => {
  // A retired Arkansas schoolteacher. ATRS is a "public ... employment-related
  // retirement system" and nothing about it is uniformed, so 26-51-307(a)(1) is
  // the whole of her exemption.
  const scenario = input({
    state: 'AR',
    ordinaryIncome: AR_CIVIL_SERVICE_GROSS,
    publicPensionIncome: AR_CIVIL_SERVICE_PENSION,
    agesAlive: [70],
  })

  it('taxes an ATRS pension above $6,000', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(accepted, 6)
  })

  it('would exempt the whole pension under the override the pack used to carry', () => {
    // AR: { kind: 'full' } in PUBLIC_PENSION_OVERRIDES, priced. It also cleared
    // `retirementRuleShared`, so both halves of the old entry are restored here.
    const fullyExempt = {
      ...pack('AR'),
      retirementRuleShared: false,
      retirementPublic: { kind: 'full' as const },
    }
    expect(computeStateTax(fullyExempt, scenario)).toBeCloseTo(readings.everyPublicPensionExempt, 6)
    expect(computeStateTax(fullyExempt, scenario)).toBeLessThan(accepted)
  })
})

// Well past every section 86 threshold, so the federally taxable share of the
// benefit is the 85% ceiling — 34,000 of 40,000 — and that is what a state
// taxing Social Security would pull into its base.
const AR_SS_OTHER_INCOME = 70_000
const AR_SS_BENEFITS = 40_000
const AR_SS_FEDERALLY_TAXABLE = AR_SS_BENEFITS * 0.85

describeRule('aca-26-51-404-b-6-social-security-exclusion', {
  readings: {
    outsideArkansasGrossIncome: arSingleTax(AR_SS_OTHER_INCOME - AR_DEDUCTION_SINGLE),
    federallyTaxableShareInTheBase:
      arSingleTax(AR_SS_OTHER_INCOME + AR_SS_FEDERALLY_TAXABLE - AR_DEDUCTION_SINGLE),
  },
  accepted: 'outsideArkansasGrossIncome',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'AR',
    ordinaryIncome: AR_SS_OTHER_INCOME,
    ssBenefits: AR_SS_BENEFITS,
    agesAlive: [70],
  })

  it('leaves a high-income Arkansan’s Social Security out of the state base', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('AR'), scenario))
      .toBeCloseTo(AR_SS_OTHER_INCOME - AR_DEDUCTION_SINGLE, 6)
  })

  it('would pull 34,000 of benefit into the base if Arkansas taxed it', () => {
    const taxing = { ...pack('AR'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario)).toBeCloseTo(readings.federallyTaxableShareInTheBase, 6)
    expect(computeStateTaxableIncome(taxing, scenario) - computeStateTaxableIncome(pack('AR'), scenario))
      .toBeCloseTo(AR_SS_FEDERALLY_TAXABLE, 6)
  })
})

const AR_GAIN_ORDINARY = 40_000
const AR_CAPITAL_GAIN = 60_000

describeRule('aca-26-51-815-b-2-fifty-percent-capital-gain-exclusion', {
  readings: {
    halfTheGainInTheBase:
      arSingleTax(AR_GAIN_ORDINARY + AR_CAPITAL_GAIN * 0.5 - AR_DEDUCTION_SINGLE),
    theWholeGainInTheBase:
      arSingleTax(AR_GAIN_ORDINARY + AR_CAPITAL_GAIN - AR_DEDUCTION_SINGLE),
  },
  accepted: 'halfTheGainInTheBase',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'AR',
    ordinaryIncome: AR_GAIN_ORDINARY,
    capitalGains: AR_CAPITAL_GAIN,
    agesAlive: [70],
  })

  it('leaves half of a capital gain out of the Arkansas base', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('AR'), scenario))
      .toBeCloseTo(AR_GAIN_ORDINARY + AR_CAPITAL_GAIN * 0.5 - AR_DEDUCTION_SINGLE, 6)
  })

  it('would tax the whole gain with the included share left at its default', () => {
    const wholeGain = { ...pack('AR'), capitalGainsTaxablePct: undefined }
    expect(computeStateTax(wholeGain, scenario)).toBeCloseTo(readings.theWholeGainInTheBase, 6)
  })

  it('still taxes the included half at ordinary Arkansas rates', () => {
    // `capitalGainsAsOrdinary` stays true: Arkansas has no preferential RATE,
    // only a partial exclusion, so the half that arrives is stacked with
    // ordinary income rather than priced on a schedule of its own.
    const equivalentOrdinary = input({
      state: 'AR',
      ordinaryIncome: AR_GAIN_ORDINARY + AR_CAPITAL_GAIN * 0.5,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('AR'), equivalentOrdinary)).toBeCloseTo(accepted, 6)
  })
})

// Arizona is one rate on one base, so every fixture below is 2.5% of what the
// pack leaves in that base and nothing else moves underneath it.
const AZ_RATE = 0.025
const AZ_DEDUCTION_SINGLE = 15_750
const azTax = (taxable: number) => Math.max(0, taxable) * AZ_RATE
const AZ_INCOME = 120_000

describeRule('ars-43-1011-a-9-flat-rate', {
  readings: {
    // 43-1011(A)(9), the paragraph 43-243(D) makes operative.
    flatTwoAndAHalfPercent: azTax(AZ_INCOME - AZ_DEDUCTION_SINGLE),
    // 43-1011(A)(8), the graduated schedule that would still govern had only
    // the lesser revenue notice of 43-243(B)(1) been given: 2.53% to 27,272,
    // then 690 dollars plus 2.75%.
    paragraphEightGraduatedSchedule:
      690 + (AZ_INCOME - AZ_DEDUCTION_SINGLE - 27_272) * 0.0275,
  },
  accepted: 'flatTwoAndAHalfPercent',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'AZ', ordinaryIncome: AZ_INCOME, agesAlive: [70] })

  it('charges one rate on the whole Arizona base', () => {
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('AZ'), scenario)).not.toBeCloseTo(readings.paragraphEightGraduatedSchedule, 6)
  })

  it('applies the same rate to a joint return, since the paragraph is status-blind', () => {
    const joint = input({
      state: 'AZ',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: 200_000,
      agesAlive: [70, 70],
    })
    expect(computeStateTax(pack('AZ'), joint)).toBeCloseTo(azTax(200_000 - 31_500), 6)
  })
})

describeRule('ars-43-1041-standard-deduction-published-amount', {
  readings: {
    arizonasOwnPublishedAmount: azTax(AZ_INCOME - AZ_DEDUCTION_SINGLE),
    federalFigureWithItsAgeSixtyFiveAddition:
      azTax(AZ_INCOME - 16_100 - FEDERAL_AGE65_ADDITION.single),
  },
  accepted: 'arizonasOwnPublishedAmount',
}, ({ accepted, readings }) => {
  // 65 and over, which is where the two readings come apart: the tag would
  // attach the federal age-65 addition to the Arizona base, and Arizona grants
  // no addition to its deduction at all.
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_INCOME,
    peopleAged65Plus: 1,
    agesAlive: [70],
  })

  it('deducts Arizona’s published amount and adds no federal age-65 amount', () => {
    expect(pack('AZ').standardDeductionConformity).toBeUndefined()
    const conformed = conformStateStandardDeduction(pack('AZ'), FEDERAL_AGE65_ADDITION, 1)
    expect(conformed.standardDeduction.single).toBe(AZ_DEDUCTION_SINGLE)
    expect(conformed.standardDeductionAge65Addition).toBeUndefined()
    expect(computeStateTax(conformed, scenario)).toBeCloseTo(accepted, 6)
  })

  it('would take the federal figure and the federal age-65 addition if it were tagged', () => {
    // What the pack carried until 2026-08-05. Both halves are wrong for
    // Arizona: 43-1041(A) sets Arizona's own amounts, and the age-65 relief
    // Arizona does grant is 43-1023(E)'s $2,100 exemption, a different figure
    // under a different statute that no provision indexes.
    const tagged = {
      ...pack('AZ'),
      standardDeduction: { single: 16_100, marriedFilingJointly: 32_200 },
      standardDeductionConformity: 'federal' as const,
    }
    const conformed = conformStateStandardDeduction(tagged, FEDERAL_AGE65_ADDITION, 1)
    expect(computeStateTax(conformed, scenario))
      .toBeCloseTo(readings.federalFigureWithItsAgeSixtyFiveAddition, 6)
  })
})

const AZ_SS_OTHER_INCOME = 90_000
const AZ_SS_BENEFITS = 40_000
const AZ_SS_FEDERALLY_TAXABLE = AZ_SS_BENEFITS * 0.85

describeRule('ars-43-1022-10-social-security-railroad-exclusion', {
  readings: {
    everyBenefitDollarSubtracted: azTax(AZ_SS_OTHER_INCOME - AZ_DEDUCTION_SINGLE),
    federallyTaxableShareInTheBase:
      azTax(AZ_SS_OTHER_INCOME + AZ_SS_FEDERALLY_TAXABLE - AZ_DEDUCTION_SINGLE),
  },
  accepted: 'everyBenefitDollarSubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_SS_OTHER_INCOME,
    ssBenefits: AZ_SS_BENEFITS,
    agesAlive: [70],
  })

  it('leaves a high-income Arizonan’s Social Security out of the state base', () => {
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(accepted, 6)
  })

  it('would pull the federally taxable share in if Arizona taxed it', () => {
    const taxing = { ...pack('AZ'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario)).toBeCloseTo(readings.federallyTaxableShareInTheBase, 6)
  })
})

const AZ_MILITARY_OTHER_INCOME = 50_000
const AZ_MILITARY_PENSION = 45_000
const AZ_MILITARY_GROSS = AZ_MILITARY_OTHER_INCOME + AZ_MILITARY_PENSION

describeRule('ars-43-1022-26-uniformed-services-exclusion', {
  readings: {
    retiredMilitaryPayFullySubtracted: azTax(AZ_MILITARY_OTHER_INCOME - AZ_DEDUCTION_SINGLE),
    taxedLikeAnyOtherRetirementIncome: azTax(AZ_MILITARY_GROSS - AZ_DEDUCTION_SINGLE),
  },
  accepted: 'retiredMilitaryPayFullySubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_MILITARY_GROSS,
    publicPensionIncome: AZ_MILITARY_PENSION,
    agesAlive: [70],
  })

  it('takes the whole military pension out of an Arizona base', () => {
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('AZ'), scenario)).toBeLessThan(readings.taxedLikeAnyOtherRetirementIncome)
  })

  it('would tax all 45,000 of it if the public bucket carried no exclusion', () => {
    const taxed = { ...pack('AZ'), retirementPublic: { kind: 'none' as const } }
    expect(computeStateTax(taxed, scenario)).toBeCloseTo(readings.taxedLikeAnyOtherRetirementIncome, 6)
  })
})

describeRule('ars-43-1022-no-private-retirement-exclusion', {
  readings: {
    privatePensionTaxedInFull: azTax(AZ_MILITARY_GROSS - AZ_DEDUCTION_SINGLE),
    publicExclusionCopiedOntoIt: azTax(AZ_MILITARY_OTHER_INCOME - AZ_DEDUCTION_SINGLE),
  },
  accepted: 'privatePensionTaxedInFull',
}, ({ accepted, readings }) => {
  // The same dollars as the military fixture above, drawn from a private plan.
  // No paragraph of 43-1022 reaches them.
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_MILITARY_GROSS,
    privateRetirementIncome: AZ_MILITARY_PENSION,
    agesAlive: [70],
  })

  it('taxes an Arizona IRA or private pension distribution in full', () => {
    expect(pack('AZ').retirementPrivate).toEqual({ kind: 'none' })
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(accepted, 6)
  })

  it('does not let the public bucket’s exclusion spill onto it', () => {
    // `retirementRuleShared` is false for Arizona precisely because 43-1022's
    // paragraphs are independent. Were it true, the public rule would be
    // applied to the household's combined retirement income.
    expect(pack('AZ').retirementRuleShared).toBe(false)
    const shared = { ...pack('AZ'), retirementRuleShared: true, retirementPrivate: { kind: 'full' as const } }
    expect(computeStateTax(shared, scenario)).toBeCloseTo(readings.publicExclusionCopiedOntoIt, 6)
  })
})

// Indiana is one flat rate on one base, so every fixture below is 2.95% of
// what the pack leaves in that base. The rate is written out rather than read
// from the pack for the reason the North Dakota helper gives: a fixture that
// took its rate from the table the calculator reads would agree with a wrong
// table as readily as a right one.
const IN_RATE = 0.0295
const IN_RATE_2025 = 0.03
const inTax = (taxable: number) => Math.max(0, taxable) * IN_RATE
const IN_INCOME = 70_000

describeRule('ic-6-3-2-1-flat-rate-ramp', {
  readings: {
    // IC 6-3-2-1(b)(7), the subdivision that governs a taxable year beginning
    // in 2026.
    twentyTwentySixRampStep: IN_INCOME * IN_RATE,
    // (b)(6), the 2025 step. The whole difference between the two readings is
    // the five hundredths of a point the ramp took off on January 1.
    twentyTwentyFiveRateHeldForward: IN_INCOME * IN_RATE_2025,
  },
  accepted: 'twentyTwentySixRampStep',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'IN', ordinaryIncome: IN_INCOME, agesAlive: [70] })

  it('charges the 2026 step of the ramp, not the 2025 one', () => {
    expect(computeStateTax(pack('IN'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('IN'), scenario)).not.toBeCloseTo(readings.twentyTwentyFiveRateHeldForward, 6)
  })

  it('would over-charge by the ramp step if the prior year were held forward', () => {
    const heldForward = {
      ...pack('IN'),
      brackets: {
        single: [{ lowerBound: 0, ratePct: 3 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 3 }],
      },
    }
    expect(computeStateTax(heldForward, scenario)).toBeCloseTo(readings.twentyTwentyFiveRateHeldForward, 6)
    expect(computeStateTax(heldForward, scenario)).toBeGreaterThan(accepted)
  })

  it('is filing-status blind, with no married-filing-jointly doubling', () => {
    // IC 6-3-2-1(b) sets one rate on all Indiana adjusted gross income and
    // never mentions filing status, so the same income costs the same tax
    // whichever status it is priced under. Every bracketed state in the pack
    // behaves the other way, which is what makes this worth pinning.
    const joint = input({
      state: 'IN', filingStatus: 'marriedFilingJointly', ordinaryIncome: IN_INCOME, agesAlive: [70, 68],
    })
    expect(computeStateTax(pack('IN'), joint)).toBeCloseTo(accepted, 6)
  })
})

// Well past every section 86 threshold, so the federally taxable share of the
// benefit is the 85% ceiling — 34,000 of 40,000.
const IN_SS_OTHER_INCOME = 70_000
const IN_SS_BENEFITS = 40_000
const IN_SS_FEDERALLY_TAXABLE = IN_SS_BENEFITS * 0.85

describeRule('ic-6-3-1-3-5-a-8-social-security-railroad-subtraction', {
  readings: {
    federallyTaxableAmountSubtractedBackOut: inTax(IN_SS_OTHER_INCOME),
    federallyTaxableShareLeftInTheBase: inTax(IN_SS_OTHER_INCOME + IN_SS_FEDERALLY_TAXABLE),
  },
  accepted: 'federallyTaxableAmountSubtractedBackOut',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'IN',
    ordinaryIncome: IN_SS_OTHER_INCOME,
    ssBenefits: IN_SS_BENEFITS,
    agesAlive: [70],
  })

  it('leaves a high-income Hoosier’s Social Security out of the Indiana base', () => {
    expect(computeStateTax(pack('IN'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('IN'), scenario)).toBeCloseTo(IN_SS_OTHER_INCOME, 6)
  })

  it('would pull 34,000 of benefit into the base if Indiana taxed it', () => {
    const taxing = { ...pack('IN'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario)).toBeCloseTo(readings.federallyTaxableShareLeftInTheBase, 6)
    expect(computeStateTaxableIncome(taxing, scenario) - computeStateTaxableIncome(pack('IN'), scenario))
      .toBeCloseTo(IN_SS_FEDERALLY_TAXABLE, 6)
  })
})

// A retired Indiana schoolteacher. TRF is a state retirement fund, nothing
// about it is federal civil service or military, and no line of Schedule 2
// reaches it — so Indiana taxes the pension exactly like her other income.
const IN_TRF_OTHER_INCOME = 24_000
const IN_TRF_PENSION = 36_000
const IN_TRF_GROSS = IN_TRF_OTHER_INCOME + IN_TRF_PENSION

describeRule('ic-6-3-2-no-general-retirement-deduction', {
  readings: {
    everyPensionInTheBase: inTax(IN_TRF_GROSS),
    everyPublicPensionExempt: inTax(IN_TRF_OTHER_INCOME),
  },
  accepted: 'everyPensionInTheBase',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'IN',
    ordinaryIncome: IN_TRF_GROSS,
    publicPensionIncome: IN_TRF_PENSION,
    agesAlive: [70],
  })

  it('taxes a TRF pension in full', () => {
    expect(computeStateTax(pack('IN'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('IN'), scenario)).toBeCloseTo(IN_TRF_GROSS, 6)
  })

  it('taxes a private pension and an IRA distribution the same way', () => {
    // The closed list reaches neither, so which bucket the income arrives in
    // cannot change the answer.
    const privateSide = input({
      state: 'IN',
      ordinaryIncome: IN_TRF_GROSS,
      privateRetirementIncome: IN_TRF_PENSION,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('IN'), privateSide)).toBeCloseTo(accepted, 6)
  })

  it('would exempt the whole pension under the override the pack used to carry', () => {
    // IN: { kind: 'full' } in PUBLIC_PENSION_OVERRIDES, priced. It also cleared
    // `retirementRuleShared`, so both halves of the old entry are restored
    // here. The gap is the whole state tax on a $36,000 pension — and the
    // county tax on it as well, which no fixture here can show because the
    // pack carries no county rate.
    const fullyExempt = {
      ...pack('IN'),
      retirementRuleShared: false,
      retirementPublic: { kind: 'full' as const },
    }
    expect(computeStateTax(fullyExempt, scenario)).toBeCloseTo(readings.everyPublicPensionExempt, 6)
    expect(computeStateTax(fullyExempt, scenario)).toBeLessThan(accepted)
  })
})

// Mississippi: 0% on the first $10,000 of taxable income, 4% above it, over a
// $2,300 single standard deduction.
const MS_RATE = 0.04
const MS_ZERO_BAND = 10_000
const MS_DEDUCTION_SINGLE = 2_300
const MS_DEDUCTION_JOINT = 4_600
const msTax = (taxable: number) => Math.max(0, Math.max(0, taxable) - MS_ZERO_BAND) * MS_RATE

describeRule('ms-27-7-5-rate-ramp', {
  readings: {
    // 27-7-5(1)(b)(ii)3 for the rate, (1)(a)(i)6 and (1)(b)(i) for the band.
    zeroBandThenFourPercent: msTax(60_000 - MS_DEDUCTION_SINGLE),
    // No zero band, which is what the flat characterisation of Mississippi
    // would predict: 4% from the first dollar.
    fourPercentFromTheFirstDollar: (60_000 - MS_DEDUCTION_SINGLE) * MS_RATE,
  },
  accepted: 'zeroBandThenFourPercent',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'MS', ordinaryIncome: 60_000, agesAlive: [70] })

  it('exempts the first $10,000 of taxable income and charges 4% above it', () => {
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(pack('MS'), scenario)).not.toBeCloseTo(readings.fourPercentFromTheFirstDollar, 6)
  })

  it('costs exactly the zero band times the rate less than a bandless schedule', () => {
    const bandless = {
      ...pack('MS'),
      brackets: {
        single: [{ lowerBound: 0, ratePct: 4 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 4 }],
      },
    }
    expect(computeStateTax(bandless, scenario)).toBeCloseTo(readings.fourPercentFromTheFirstDollar, 6)
    expect(computeStateTax(bandless, scenario) - accepted).toBeCloseTo(MS_ZERO_BAND * MS_RATE, 6)
  })

  it('charges nothing at all below the band', () => {
    const small = input({ state: 'MS', ordinaryIncome: 12_000, agesAlive: [70] })
    expect(computeStateTaxableIncome(pack('MS'), small)).toBeCloseTo(12_000 - MS_DEDUCTION_SINGLE, 6)
    expect(computeStateTax(pack('MS'), small)).toBe(0)
  })
})

// A Mississippi couple living on a pension plus investment income. The pension
// never enters gross income at all, so the tax is 4% of the investment income
// above the deduction and the band.
const MS_PENSION = 45_000
const MS_INVESTMENT_INCOME = 40_000
const MS_RETIREMENT_GROSS = MS_PENSION + MS_INVESTMENT_INCOME

describeRule('ms-27-7-15-4-retirement-income-excluded-from-gross-income', {
  readings: {
    pensionOutsideGrossIncome: msTax(MS_INVESTMENT_INCOME - MS_DEDUCTION_JOINT),
    pensionTaxedLikeOtherIncome: msTax(MS_RETIREMENT_GROSS - MS_DEDUCTION_JOINT),
  },
  accepted: 'pensionOutsideGrossIncome',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'MS',
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: MS_RETIREMENT_GROSS,
    privateRetirementIncome: MS_PENSION,
    agesAlive: [67, 67],
  })

  it('leaves a private pension out of the Mississippi base entirely', () => {
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('MS'), scenario))
      .toBeCloseTo(MS_INVESTMENT_INCOME - MS_DEDUCTION_JOINT, 6)
  })

  it('reaches paragraph (k) income on the same terms as paragraph (l) income', () => {
    // (k) covers PERS and the federal systems, (l) covers everything else, and
    // neither is capped — so a public pension and a private one of the same
    // size cost the same, which is why `retirementRuleShared` is true here
    // without a cap to share.
    const publicSide = input({
      state: 'MS',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: MS_RETIREMENT_GROSS,
      publicPensionIncome: MS_PENSION,
      agesAlive: [67, 67],
    })
    expect(computeStateTax(pack('MS'), publicSide)).toBeCloseTo(accepted, 6)
    expect(pack('MS').retirementRuleShared).toBe(true)
  })

  it('would tax the pension if the exclusion were dropped', () => {
    const noExclusion = {
      ...pack('MS'),
      retirementPrivate: { kind: 'none' as const },
      retirementPublic: { kind: 'none' as const },
    }
    expect(computeStateTax(noExclusion, scenario)).toBeCloseTo(readings.pensionTaxedLikeOtherIncome, 6)
    expect(computeStateTax(noExclusion, scenario)).toBeGreaterThan(accepted)
  })
})

describeRule('ms-27-7-17-standard-deduction-unindexed', {
  readings: {
    mississippisOwnFrozenAmount: msTax(60_000 - MS_DEDUCTION_SINGLE),
    // What the tag would do to it: `conformStateStandardDeduction` moves a
    // tagged amount with the federal indexation under IRC 63(c)(7)(B)(ii), so
    // by a projected year ten percent into the horizon Mississippi's $2,300
    // would have grown to $2,530 — a figure 27-7-17(3)(b) does not authorise
    // in any year, since it fixes the amount "for each calendar year
    // thereafter" and provides no adjustment at all.
    theSameAmountDriftingWithTheFederalIndexation:
      msTax(60_000 - MS_DEDUCTION_SINGLE * INFLATION_SCALE),
  },
  accepted: 'mississippisOwnFrozenAmount',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'MS', ordinaryIncome: 60_000, agesAlive: [70] })

  it('deducts Mississippi’s own statutory amount', () => {
    expect(computeStateTaxableIncome(pack('MS'), scenario)).toBeCloseTo(60_000 - MS_DEDUCTION_SINGLE, 6)
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(accepted, 6)
    expect(pack('MS').standardDeduction.marriedFilingJointly).toBe(MS_DEDUCTION_JOINT)
  })

  it('is untagged, so the federal conformity indexer moves neither it nor an age-65 addition', () => {
    // 27-7-17(3)(b) fixes the amount with no indexation clause, so unlike
    // Arkansas's it cannot go stale — and nothing in Mississippi law
    // references IRC 63(c), so the tag would import a federal figure and a
    // federal age-65 addition Mississippi does not grant.
    expect(pack('MS').standardDeductionConformity).toBeUndefined()
    const projected = conformStateStandardDeduction(pack('MS'), FEDERAL_AGE65_ADDITION, INFLATION_SCALE)
    expect(projected.standardDeduction.single).toBe(MS_DEDUCTION_SINGLE)
    expect(projected.standardDeductionAge65Addition).toBeUndefined()
  })

  it('would drift away from the statute in every projected year if it were tagged', () => {
    const tagged = { ...pack('MS'), standardDeductionConformity: 'federal' as const }
    const projected = conformStateStandardDeduction(tagged, FEDERAL_AGE65_ADDITION, INFLATION_SCALE)
    expect(computeStateTax(projected, scenario))
      .toBeCloseTo(readings.theSameAmountDriftingWithTheFederalIndexation, 6)
    expect(projected.standardDeduction.single).toBeCloseTo(MS_DEDUCTION_SINGLE * INFLATION_SCALE, 6)
    // And it would pick up a federal age-65 addition alongside — a second
    // subtraction under IRC 63(c)(3) that no Mississippi provision grants,
    // indexed on the same scale again.
    expect(projected.standardDeductionAge65Addition?.single)
      .toBeCloseTo(FEDERAL_AGE65_ADDITION.single * INFLATION_SCALE, 6)
  })
})

const MS_GAIN_ORDINARY = 30_000
const MS_CAPITAL_GAIN = 50_000

describeRule('ms-capital-gains-taxed-as-ordinary', {
  readings: {
    wholeGainAtTheOrdinaryRate: msTax(MS_GAIN_ORDINARY + MS_CAPITAL_GAIN - MS_DEDUCTION_SINGLE),
    halfTheGainExcludedLikeArkansas:
      msTax(MS_GAIN_ORDINARY + MS_CAPITAL_GAIN * 0.5 - MS_DEDUCTION_SINGLE),
  },
  accepted: 'wholeGainAtTheOrdinaryRate',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'MS',
    ordinaryIncome: MS_GAIN_ORDINARY,
    capitalGains: MS_CAPITAL_GAIN,
    agesAlive: [70],
  })

  it('puts the whole gain in the base at the ordinary rate', () => {
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(accepted, 6)
    expect(pack('MS').capitalGainsTaxablePct).toBeUndefined()
  })

  it('prices a gain exactly as it prices the same amount of ordinary income', () => {
    const allOrdinary = input({
      state: 'MS', ordinaryIncome: MS_GAIN_ORDINARY + MS_CAPITAL_GAIN, agesAlive: [70],
    })
    expect(computeStateTax(pack('MS'), allOrdinary)).toBeCloseTo(accepted, 6)
  })

  it('would exclude half the gain if the included share were set as Arkansas’s is', () => {
    // The change a sweep across the ND/AR/AZ pattern would make. Mississippi
    // is one of the two states in that sweep where the default is simply
    // right, so this is the reading to reject rather than adopt.
    const partialExclusion = { ...pack('MS'), capitalGainsTaxablePct: 50 }
    expect(computeStateTax(partialExclusion, scenario)).toBeCloseTo(readings.halfTheGainExcludedLikeArkansas, 6)
    expect(computeStateTax(partialExclusion, scenario)).toBeLessThan(accepted)
  })
})

// IRC 86 does not apply in California, so none of its federally taxable
// $34,000 Social Security share enters the state base. The $5,540 California
// standard deduction is the only subtraction in this fixture.
const CA_SS_OTHER_INCOME = 90_000
const CA_SS_BENEFITS = 40_000
const CA_FEDERALLY_TAXABLE_SS = 0.85 * CA_SS_BENEFITS
const CA_DEDUCTION_SINGLE = 5_540

describeRule('ca-rtc-17087-social-security-exclusion', {
  readings: {
    sectionEightySixDoesNotEnterTheCaliforniaBase:
      CA_SS_OTHER_INCOME - CA_DEDUCTION_SINGLE,
    federallyTaxableBenefitLeftInCaliforniaBase:
      CA_SS_OTHER_INCOME + CA_FEDERALLY_TAXABLE_SS - CA_DEDUCTION_SINGLE,
  },
  accepted: 'sectionEightySixDoesNotEnterTheCaliforniaBase',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'CA',
    ordinaryIncome: CA_SS_OTHER_INCOME,
    ssBenefits: CA_SS_BENEFITS,
    agesAlive: [70],
  })

  it('omits California Social Security from the taxable base', () => {
    expect(computeStateTaxableIncome(pack('CA'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('CA'), scenario))
      .not.toBeCloseTo(readings.federallyTaxableBenefitLeftInCaliforniaBase, 6)
  })
})

// D.C. lists the federally taxable share itself among gross-income exclusions.
// Its pack-year standard deduction is the only non-Social-Security reduction in
// this direct pricing fixture.
const DC_SS_OTHER_INCOME = 90_000
const DC_SS_BENEFITS = 40_000
const DC_FEDERALLY_TAXABLE_SS = 0.85 * DC_SS_BENEFITS
const DC_DEDUCTION_SINGLE = 16_100

describeRule('dc-code-47-1803-03-federal-standard-and-ss', {
  readings: {
    federallyTaxableSocialSecurityExcludedFromDistrictGrossIncome:
      DC_SS_OTHER_INCOME - DC_DEDUCTION_SINGLE,
    federallyTaxableSocialSecurityLeftInDistrictGrossIncome:
      DC_SS_OTHER_INCOME + DC_FEDERALLY_TAXABLE_SS - DC_DEDUCTION_SINGLE,
  },
  accepted: 'federallyTaxableSocialSecurityExcludedFromDistrictGrossIncome',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'DC',
    ordinaryIncome: DC_SS_OTHER_INCOME,
    ssBenefits: DC_SS_BENEFITS,
    agesAlive: [70],
  })

  it('omits the District Social Security subtraction from the taxable base', () => {
    expect(computeStateTaxableIncome(pack('DC'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('DC'), scenario))
      .not.toBeCloseTo(readings.federallyTaxableSocialSecurityLeftInDistrictGrossIncome, 6)
  })
})


// CRS 39-22-104(4)(f) grants this 60-year-old a $20,000 pension/IRA
// subtraction. The pack's only comparable cap starts at 65, so it leaves the
// full $40,000 in the pre-deduction base.
const CO_PRE65_RETIREMENT_INCOME = 40_000
const CO_PRE65_RETIREMENT_CAP = 20_000
const CO_DEDUCTION_SINGLE = 16_100

describeRule('co-crs-39-22-104-federal-base-and-pension-cap', {
  readings: {
    ageSixtyTakesTheTwentyThousandDollarColoradoSubtraction:
      CO_PRE65_RETIREMENT_INCOME - CO_PRE65_RETIREMENT_CAP - CO_DEDUCTION_SINGLE,
    packWaitsUntilAgeSixtyFive: 23_900,
  },
  accepted: 'ageSixtyTakesTheTwentyThousandDollarColoradoSubtraction',
  produced: 'packWaitsUntilAgeSixtyFive',
  note: 'age-55-through-64 pension-and-annuity limb',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'CO',
    ordinaryIncome: CO_PRE65_RETIREMENT_INCOME,
    privateRetirementIncome: CO_PRE65_RETIREMENT_INCOME,
    agesAlive: [60],
  })

  it('pins the missing Colorado age-60 retirement subtraction', () => {
    expect(computeStateTaxableIncome(pack('CO'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('CO'), scenario)).not.toBeCloseTo(accepted, 6)
  })
})

// Ordinary income of $40,000 plus half of the $40,000 benefit makes provisional
// income $60,000. IRC 86 therefore includes $26,600: 85% x ($60,000 -
// $34,000) + $4,500. At 65 Colorado raises the statutory subtraction cap to
// that entire federally taxable share, leaving only the $40,000 other income
// before the federal deduction.
const CO_SS_OTHER_INCOME = 40_000
const CO_SS_BENEFITS = 40_000
const CO_FEDERALLY_TAXABLE_SS = 26_600

describeRule('co-crs-39-22-104-social-security-inclusion', {
  readings: {
    ageSixtyFiveSubtractsAllFederallyTaxableSocialSecurity:
      CO_SS_OTHER_INCOME - CO_DEDUCTION_SINGLE,
    packLeavesFederallyTaxableSocialSecurityInTheColoradoBase: 50_500,
  },
  accepted: 'ageSixtyFiveSubtractsAllFederallyTaxableSocialSecurity',
  produced: 'packLeavesFederallyTaxableSocialSecurityInTheColoradoBase',
  note: 'age-65 Social Security limb',
}, ({ accepted, produced, readings }) => {
  const scenario = input({
    state: 'CO',
    ordinaryIncome: CO_SS_OTHER_INCOME,
    ssBenefits: CO_SS_BENEFITS,
    agesAlive: [65],
  })

  it('pins the Colorado age-65 Social Security subtraction the pack misses', () => {
    expect(computeStateTaxableIncome(pack('CO'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('CO'), scenario)).not.toBeCloseTo(accepted, 6)
    expect(readings.ageSixtyFiveSubtractsAllFederallyTaxableSocialSecurity + CO_FEDERALLY_TAXABLE_SS)
      .toBe(CO_SS_OTHER_INCOME + CO_FEDERALLY_TAXABLE_SS - CO_DEDUCTION_SINGLE)
  })
})

// The DOR booklet permits $35,000 for this 63-year-old. It is deliberately a
// taxable IRA-only example: the DOR page confirms the real exclusion reaches
// more source categories, but this is the part of it the existing bucket can
// represent once its absent 62-64 tier is supplied.
const GA_RETIREMENT_INCOME = 70_000
const GA_PRE65_RETIREMENT_CAP = 35_000
const GA_DEDUCTION_SINGLE = 15_000

describeRule('ga-code-48-7-27-retirement-and-social-security-exclusion', {
  readings: {
    ageSixtyThreeTakesTheThirtyFiveThousandDollarGeorgiaExclusion:
      GA_RETIREMENT_INCOME - GA_PRE65_RETIREMENT_CAP - GA_DEDUCTION_SINGLE,
    packWaitsUntilAgeSixtyFive: 55_000,
  },
  accepted: 'ageSixtyThreeTakesTheThirtyFiveThousandDollarGeorgiaExclusion',
  produced: 'packWaitsUntilAgeSixtyFive',
  note: 'age-62-through-64 retirement-income limb',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'GA',
    ordinaryIncome: GA_RETIREMENT_INCOME,
    privateRetirementIncome: GA_RETIREMENT_INCOME,
    agesAlive: [63],
  })

  it('pins the missing Georgia age-63 retirement exclusion', () => {
    expect(computeStateTaxableIncome(pack('GA'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('GA'), scenario)).not.toBeCloseTo(accepted, 6)
  })
})

// Connecticut: ordinary income $40,000 plus half of a $40,000 benefit gives
// provisional income of $60,000. IRC 86's 85% tier therefore includes
// 0.85 × ($60,000 - $34,000) + $4,500 = $26,600; federal AGI is $66,600, below
// the section 12-701(a)(20)(B)(x)(III) $75,000 threshold. Connecticut must
// subtract all $26,600, leaving exactly the $40,000 non-Social-Security base.
const CT_SS_OTHER_INCOME = 40_000
const CT_SS_BENEFITS = 40_000
const CT_FEDERALLY_TAXABLE_SS = 26_600

describeRule('ct-cgs-12-701-20-b-social-security-retirement', {
  readings: {
    lowIncomeSocialSecurityFullySubtracted: CT_SS_OTHER_INCOME,
    packLeavesFederallyTaxableSocialSecurityInTheBase: 66_600,
  },
  accepted: 'lowIncomeSocialSecurityFullySubtracted',
  produced: 'packLeavesFederallyTaxableSocialSecurityInTheBase',
  note: 'low-income Social Security limb',
}, ({ accepted, produced, readings }) => {
  const scenario = input({
    state: 'CT',
    ordinaryIncome: CT_SS_OTHER_INCOME,
    ssBenefits: CT_SS_BENEFITS,
    agesAlive: [70],
  })

  it('pins the pack’s failure to subtract the low-income federally taxable benefit', () => {
    expect(computeStateTaxableIncome(pack('CT'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('CT'), scenario)).not.toBeCloseTo(accepted, 6)
    // The two readings differ by the authority-derived $26,600 IRC 86 amount,
    // not by a Connecticut rate or a standard deduction (both are zero here).
    expect(readings.lowIncomeSocialSecurityFullySubtracted + CT_FEDERALLY_TAXABLE_SS)
      .not.toBe(accepted)
  })
})

// Table 32 is 0% at federal AGI of $100,000 and over. This source pension is
// $50,000 of a $100,000 AGI, so the statutory base keeps all $100,000; the
// unconditional pack exemption removes the $50,000 pension instead.
const CT_HIGH_AGI_PENSION = 50_000
const CT_HIGH_AGI_TOTAL = 100_000

describeRule('ct-cgs-12-701-20-b-social-security-retirement', {
  readings: {
    highIncomePensionRemainsInTheBase: CT_HIGH_AGI_TOTAL,
    packUnconditionallySubtractsThePension: 50_000,
  },
  accepted: 'highIncomePensionRemainsInTheBase',
  produced: 'packUnconditionallySubtractsThePension',
  note: 'high-income pension limb',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'CT',
    ordinaryIncome: CT_HIGH_AGI_TOTAL,
    privateRetirementIncome: CT_HIGH_AGI_PENSION,
    agesAlive: [70],
  })

  it('pins the pack’s unconditional pension exclusion above the statutory schedule', () => {
    expect(computeStateTaxableIncome(pack('CT'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('CT'), scenario)).not.toBeCloseTo(accepted, 6)
  })
})

const DE_SS_OTHER_INCOME = 90_000
const DE_SS_BENEFITS = 40_000
const DE_FEDERALLY_TAXABLE_SS = 0.85 * DE_SS_BENEFITS
const DE_DEDUCTION_SINGLE = 5_700

describeRule('de-code-30-1106-social-security-retirement-subtractions', {
  readings: {
    federallyTaxableSocialSecuritySubtracted: DE_SS_OTHER_INCOME - DE_DEDUCTION_SINGLE,
    federallyTaxableSocialSecurityLeftInTheBase:
      DE_SS_OTHER_INCOME + DE_FEDERALLY_TAXABLE_SS - DE_DEDUCTION_SINGLE,
  },
  accepted: 'federallyTaxableSocialSecuritySubtracted',
  note: 'Social Security limb',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'DE',
    ordinaryIncome: DE_SS_OTHER_INCOME,
    ssBenefits: DE_SS_BENEFITS,
    agesAlive: [70],
  })

  it('subtracts Delaware Social Security included in federal AGI', () => {
    expect(computeStateTaxableIncome(pack('DE'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('DE'), scenario))
      .not.toBeCloseTo(readings.federallyTaxableSocialSecurityLeftInTheBase, 6)
  })
})

const DE_RETIREMENT_INCOME = 40_000
const DE_RETIREMENT_CAP = 12_500

describeRule('de-code-30-1106-social-security-retirement-subtractions', {
  readings: {
    ageSixtyTakesTheSharedTwelveThousandFiveHundredCap:
      DE_RETIREMENT_INCOME - DE_RETIREMENT_CAP - DE_DEDUCTION_SINGLE,
    ageFiftyNineGetsNoRetirementSubtraction: DE_RETIREMENT_INCOME - DE_DEDUCTION_SINGLE,
  },
  accepted: 'ageSixtyTakesTheSharedTwelveThousandFiveHundredCap',
  note: 'retirement-age limb',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'DE',
    ordinaryIncome: DE_RETIREMENT_INCOME,
    privateRetirementIncome: DE_RETIREMENT_INCOME,
    agesAlive: [60],
  })

  it('subtracts the $12,500 Delaware retirement cap from age 60', () => {
    expect(computeStateTaxableIncome(pack('DE'), scenario)).toBeCloseTo(accepted, 6)
    const tooYoung = {
      ...pack('DE'),
      retirementPrivate: { kind: 'capped' as const, capPerPerson: DE_RETIREMENT_CAP, minAge: 61 },
      retirementPublic: { kind: 'capped' as const, capPerPerson: DE_RETIREMENT_CAP, minAge: 61 },
    }
    expect(computeStateTaxableIncome(tooYoung, scenario))
      .toBeCloseTo(readings.ageFiftyNineGetsNoRetirementSubtraction, 6)
  })
})

// HRS 235-7(a)(3) reaches a private pension for past services. The source
// reading has no remaining income at all; the pack’s private bucket leaves its
// $40,000 in the base. The Plan has no field separating that pension from an
// IRA distribution, so the test is deliberately the private-pension limb.
const HI_PRIVATE_PENSION = 40_000

describeRule('hi-hrs-235-7-pension-and-social-security', {
  readings: {
    privatePensionForPastServicesExcludedFromTheBase: 0,
    packTaxesEveryPrivateRetirementBucketDollar: 35_600,
  },
  accepted: 'privatePensionForPastServicesExcludedFromTheBase',
  produced: 'packTaxesEveryPrivateRetirementBucketDollar',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'HI',
    ordinaryIncome: HI_PRIVATE_PENSION,
    privateRetirementIncome: HI_PRIVATE_PENSION,
    agesAlive: [70],
  })

  it('pins the unmodelled Hawaii private-pension exclusion', () => {
    expect(computeStateTaxableIncome(pack('HI'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('HI'), scenario)).not.toBeCloseTo(accepted, 6)
  })
})

const ID_SS_OTHER_INCOME = 90_000
const ID_SS_BENEFITS = 40_000
const ID_FEDERALLY_TAXABLE_SS = 0.85 * ID_SS_BENEFITS
const ID_DEDUCTION_SINGLE = 16_100

describeRule('id-code-63-3022-federal-standard-and-ss', {
  readings: {
    sectionEightySixAmountDeducted:
      ID_SS_OTHER_INCOME - ID_DEDUCTION_SINGLE,
    sectionEightySixAmountTaxed:
      ID_SS_OTHER_INCOME + ID_FEDERALLY_TAXABLE_SS - ID_DEDUCTION_SINGLE,
  },
  accepted: 'sectionEightySixAmountDeducted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'ID',
    ordinaryIncome: ID_SS_OTHER_INCOME,
    ssBenefits: ID_SS_BENEFITS,
    agesAlive: [70],
  })

  it('deducts Idaho’s federally included Social Security amount', () => {
    expect(computeStateTaxableIncome(pack('ID'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('ID'), scenario)).not.toBeCloseTo(readings.sectionEightySixAmountTaxed, 6)
  })
})

const KS_SS_OTHER_INCOME = 90_000
const KS_SS_BENEFITS = 40_000
const KS_FEDERALLY_TAXABLE_SS = 0.85 * KS_SS_BENEFITS
const KS_DEDUCTION_SINGLE = 3_605

describeRule('ks-stat-79-32-117-social-security-exclusion', {
  readings: {
    post2023FederallyTaxableBenefitSubtracted:
      KS_SS_OTHER_INCOME - KS_DEDUCTION_SINGLE,
    federallyTaxableBenefitLeftInKansasBase:
      KS_SS_OTHER_INCOME + KS_FEDERALLY_TAXABLE_SS - KS_DEDUCTION_SINGLE,
  },
  accepted: 'post2023FederallyTaxableBenefitSubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'KS',
    ordinaryIncome: KS_SS_OTHER_INCOME,
    ssBenefits: KS_SS_BENEFITS,
    agesAlive: [70],
  })

  it('subtracts all post-2023 federally taxable Kansas Social Security', () => {
    expect(computeStateTaxableIncome(pack('KS'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('KS'), scenario))
      .not.toBeCloseTo(readings.federallyTaxableBenefitLeftInKansasBase, 6)
  })
})

// The source reading is an unlisted public pension. Its entire $60,000 remains
// in the Kansas base, then the unchanged $3,605 pack standard deduction
// applies. The engine has no pension-system identity, so its full
// public override removes the full $60,000 instead; the pending pin records
// that produced output without guessing it here.
const KS_UNLISTED_PUBLIC_PENSION = 60_000

describeRule('ks-stat-79-32-117-public-pension-exclusion', {
  readings: {
    unlistedPublicPensionRemainsTaxable:
      KS_UNLISTED_PUBLIC_PENSION - KS_DEDUCTION_SINGLE,
    packExemptsEveryPublicPension: 0,
  },
  accepted: 'unlistedPublicPensionRemainsTaxable',
  produced: 'packExemptsEveryPublicPension',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'KS',
    ordinaryIncome: KS_UNLISTED_PUBLIC_PENSION,
    publicPensionIncome: KS_UNLISTED_PUBLIC_PENSION,
    agesAlive: [70],
  })

  it('pins the overbroad Kansas public-pension override', () => {
    expect(computeStateTaxableIncome(pack('KS'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxableIncome(pack('KS'), scenario)).not.toBeCloseTo(accepted, 6)
  })
})

describe('state jurisdiction records', () => {
// ─── WS4d Batch B settled fixtures ──────────────────────────────────────────
//
// Same construction as the North Dakota / Illinois / West Virginia fixtures
// above: the accepted figure is the state's own law, the rejected figure is a
// one-field change that a competing reading of the same pack would produce,
// and neither number is read from the pack table the calculator uses.

function bandedTax(bands: readonly (readonly [number, number, number])[], taxable: number): number {
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}

const KY_RATE = 0.035
const KY_DEDUCTION = 3_360
const kyTax = (taxable: number) => Math.max(0, taxable) * KY_RATE
const KY_CAP = 31_110
const KY_SS_OTHER = 90_000
const KY_SS = 40_000
const KY_SS_FEDERALLY_TAXABLE = 0.85 * KY_SS

describeRule('ky-krs-141-retirement-and-social-security', {
  readings: {
    socialSecurityExcluded: kyTax(KY_SS_OTHER - KY_DEDUCTION),
    federallyTaxableShareLeftInTheBase:
      kyTax(KY_SS_OTHER + KY_SS_FEDERALLY_TAXABLE - KY_DEDUCTION),
  },
  accepted: 'socialSecurityExcluded',
  note: 'Social Security limb',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'KY',
    ordinaryIncome: KY_SS_OTHER,
    ssBenefits: KY_SS,
    agesAlive: [70],
  })

  it('keeps Social Security out of Kentucky adjusted gross income', () => {
    expect(computeStateTax(pack('KY'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('KY'), scenario))
      .toBeCloseTo(KY_SS_OTHER - KY_DEDUCTION, 6)
  })

  it('would pull the federally taxable share in if Kentucky taxed it', () => {
    const taxing = { ...pack('KY'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.federallyTaxableShareLeftInTheBase, 6)
  })
})

const KY_PRIVATE = 50_000

describeRule('ky-krs-141-retirement-and-social-security', {
  readings: {
    // KRS 141.019(1)(g) reaches IRAs and private employer plans up to $31,110.
    thirtyOneThousandOneHundredTenOfPrivateDistributions:
      kyTax(KY_PRIVATE - KY_CAP - KY_DEDUCTION),
    // Shopping-list reading: only certain public-pension relief, so a private
    // IRA distribution stays in the base in full.
    shoppingListLeavesPrivateRetirementInTheBase: kyTax(KY_PRIVATE - KY_DEDUCTION),
  },
  accepted: 'thirtyOneThousandOneHundredTenOfPrivateDistributions',
  note: 'retirement-distribution limb',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'KY',
    ordinaryIncome: KY_PRIVATE,
    privateRetirementIncome: KY_PRIVATE,
    agesAlive: [50],
  })

  it('excludes $31,110 of a private IRA distribution with no age gate', () => {
    expect(computeStateTax(pack('KY'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('KY'), scenario))
      .toBeCloseTo(KY_PRIVATE - KY_CAP - KY_DEDUCTION, 6)
  })

  it('would charge more if private retirement were left in the base', () => {
    const noPrivateCap = {
      ...pack('KY'),
      retirementPrivate: { kind: 'none' as const },
    }
    expect(computeStateTax(noPrivateCap, scenario))
      .toBeCloseTo(readings.shoppingListLeavesPrivateRetirementInTheBase, 6)
    expect(computeStateTax(noPrivateCap, scenario)).toBeGreaterThan(accepted)
  })
})

describeRule('ky-krs-141-retirement-and-social-security', {
  readings: {
    threeAndOneHalfPercentOfNetIncome: kyTax(50_000 - KY_DEDUCTION),
    // Pre-2026 rate still printed in KRS 141.020(2)(e).
    formerFourPercentRate: (50_000 - KY_DEDUCTION) * 0.04,
  },
  accepted: 'threeAndOneHalfPercentOfNetIncome',
  note: 'flat-rate limb',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'KY',
    ordinaryIncome: 50_000,
    agesAlive: [45],
  })

  it('taxes net income at three and one-half percent for 2026', () => {
    expect(computeStateTax(pack('KY'), scenario)).toBeCloseTo(accepted, 6)
  })

  it('would charge more at the former four percent rate', () => {
    const formerRate = {
      ...pack('KY'),
      brackets: {
        single: [{ lowerBound: 0, ratePct: 4 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 4 }],
      },
    }
    expect(computeStateTax(formerRate, scenario))
      .toBeCloseTo(readings.formerFourPercentRate, 6)
    expect(computeStateTax(formerRate, scenario)).toBeGreaterThan(accepted)
  })
})

const LA_RATE = 0.03
const LA_DEDUCTION = 12_500
const laTax = (taxable: number) => Math.max(0, taxable) * LA_RATE

const LA_SS_OTHER = 90_000
const LA_SS = 40_000
const LA_SS_FEDERALLY_TAXABLE = 0.85 * LA_SS

describeRule('la-rs-47-44-2-social-security-federal-retirement', {
  readings: {
    socialSecurityExempt: laTax(LA_SS_OTHER - LA_DEDUCTION),
    federallyTaxableShareLeftInTheBase: laTax(LA_SS_OTHER + LA_SS_FEDERALLY_TAXABLE - LA_DEDUCTION),
  },
  accepted: 'socialSecurityExempt',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'LA',
    ordinaryIncome: LA_SS_OTHER,
    ssBenefits: LA_SS,
    agesAlive: [70],
  })

  it('keeps Social Security out of the Louisiana base', () => {
    expect(computeStateTax(pack('LA'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('LA'), scenario))
      .toBeCloseTo(LA_SS_OTHER - LA_DEDUCTION, 6)
  })

  it('would pull the federally taxable share in if Louisiana taxed it', () => {
    const taxing = { ...pack('LA'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.federallyTaxableShareLeftInTheBase, 6)
  })

  it('also exempts a United States Government retirement annuity in the public bucket', () => {
    const federalRetirement = input({
      state: 'LA',
      ordinaryIncome: 80_000,
      publicPensionIncome: 80_000,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('LA'), federalRetirement)).toBe(0)
  })
})

const mdSingleTax = (taxable: number) => bandedTax(
  [
    [0, 1000, 2], [1000, 2000, 3], [2000, 3000, 4], [3000, 100_000, 4.75],
    [100_000, 125_000, 5], [125_000, 150_000, 5.25], [150_000, 250_000, 5.5],
  ],
  taxable,
)
const MD_DEDUCTION = 3350
const MD_SS_OTHER = 90_000
const MD_SS = 40_000
const MD_SS_FEDERALLY_TAXABLE = 0.85 * MD_SS

describeRule('md-tax-10-207-social-security-exclusion', {
  readings: {
    titleIIPaymentSubtracted: mdSingleTax(MD_SS_OTHER - MD_DEDUCTION),
    federallyTaxableShareLeftInTheBase:
      mdSingleTax(MD_SS_OTHER + MD_SS_FEDERALLY_TAXABLE - MD_DEDUCTION),
  },
  accepted: 'titleIIPaymentSubtracted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'MD',
    ordinaryIncome: MD_SS_OTHER,
    ssBenefits: MD_SS,
    agesAlive: [70],
  })

  it('keeps Social Security out of Maryland adjusted gross income', () => {
    expect(computeStateTax(pack('MD'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('MD'), scenario))
      .toBeCloseTo(MD_SS_OTHER - MD_DEDUCTION, 6)
  })

  it('would add the federally taxable portion if Maryland taxed it', () => {
    const taxing = { ...pack('MD'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.federallyTaxableShareLeftInTheBase, 6)
  })
})

const MA_RATE = 0.05
const maTax = (taxable: number) => Math.max(0, taxable) * MA_RATE

const MA_SS_OTHER = 70_000
const MA_SS = 40_000
const MA_SS_FEDERALLY_TAXABLE = 0.85 * MA_SS

describeRule('ma-gen-laws-ch62-s2-social-security', {
  readings: {
    sectionEightySixAmountDeducted: maTax(MA_SS_OTHER),
    federallyTaxableShareLeftInTheBase: maTax(MA_SS_OTHER + MA_SS_FEDERALLY_TAXABLE),
  },
  accepted: 'sectionEightySixAmountDeducted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'MA',
    ordinaryIncome: MA_SS_OTHER,
    ssBenefits: MA_SS,
    agesAlive: [70],
  })

  it('deducts Social Security included in federal gross income', () => {
    expect(computeStateTax(pack('MA'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('MA'), scenario)).toBeCloseTo(MA_SS_OTHER, 6)
  })

  it('would leave the federally taxable share in if the deduction were dropped', () => {
    const taxing = { ...pack('MA'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.federallyTaxableShareLeftInTheBase, 6)
  })
})

const MI_RATE = 0.0425
const miTax = (taxable: number) => Math.max(0, taxable) * MI_RATE
const MI_SS_OTHER = 70_000
const MI_SS = 40_000
const MI_SS_FEDERALLY_TAXABLE = 0.85 * MI_SS

describeRule('mi-mcl-206-30-f-iii-social-security', {
  readings: {
    section86AmountDeducted: miTax(MI_SS_OTHER),
    federallyTaxableShareLeftInTheBase: miTax(MI_SS_OTHER + MI_SS_FEDERALLY_TAXABLE),
  },
  accepted: 'section86AmountDeducted',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'MI',
    ordinaryIncome: MI_SS_OTHER,
    ssBenefits: MI_SS,
    agesAlive: [70],
  })

  it('deducts Social Security from Michigan taxable income', () => {
    expect(computeStateTax(pack('MI'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('MI'), scenario)).toBeCloseTo(MI_SS_OTHER, 6)
  })

  it('would add the federally taxable share if Michigan taxed it', () => {
    const taxing = { ...pack('MI'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.federallyTaxableShareLeftInTheBase, 6)
  })
})

const mtSingleTax = (taxable: number) => bandedTax(
  [[0, 47_500, 4.7], [47_500, Infinity, 5.65]],
  taxable,
)
const MT_DEDUCTION = 16_100
const MT_SS_OTHER = 90_000
const MT_SS = 40_000
const MT_SS_FEDERALLY_TAXABLE = 0.85 * MT_SS

describeRule('mt-mca-15-30-2110-federal-agi-social-security', {
  readings: {
    federallyTaxableShareInTheBase:
      mtSingleTax(MT_SS_OTHER + MT_SS_FEDERALLY_TAXABLE - MT_DEDUCTION),
    socialSecuritySubtractedOut: mtSingleTax(MT_SS_OTHER - MT_DEDUCTION),
  },
  accepted: 'federallyTaxableShareInTheBase',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'MT',
    ordinaryIncome: MT_SS_OTHER,
    ssBenefits: MT_SS,
    agesAlive: [70],
  })

  it('starts Montana from federal AGI, so federally taxable Social Security stays in', () => {
    expect(computeStateTax(pack('MT'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('MT'), scenario))
      .toBeCloseTo(MT_SS_OTHER + MT_SS_FEDERALLY_TAXABLE - MT_DEDUCTION, 6)
  })

  it('would drop the benefit if Montana subtracted it the way a false flag does', () => {
    const exempt = { ...pack('MT'), taxesSocialSecurity: false }
    expect(computeStateTax(exempt, scenario))
      .toBeCloseTo(readings.socialSecuritySubtractedOut, 6)
  })

  it('carries the federal standard deduction with it, not a frozen state figure', () => {
    expect(pack('MT').standardDeductionConformity).toBe('federal')
    const projected = conformStateStandardDeduction(pack('MT'), FEDERAL_AGE65_ADDITION, INFLATION_SCALE)
    expect(projected.standardDeduction.single).toBeCloseTo(MT_DEDUCTION * INFLATION_SCALE, 6)
  })
})

const neSingleTax = (taxable: number) => bandedTax(
  [[0, 4130, 2.46], [4130, 24_760, 3.51], [24_760, Infinity, 4.55]],
  taxable,
)
const NE_DEDUCTION = 8850
const NE_SS_OTHER = 90_000
const NE_SS = 40_000
const NE_SS_FEDERALLY_TAXABLE = 0.85 * NE_SS

describeRule('ne-stat-77-2716-social-security-subtraction', {
  readings: {
    oneHundredPercentSubtractedFrom2024: neSingleTax(NE_SS_OTHER - NE_DEDUCTION),
    // The shopping-list reading: 85% of the benefit still in the Nebraska base.
    eightyFivePercentStillTaxable:
      neSingleTax(NE_SS_OTHER + NE_SS_FEDERALLY_TAXABLE - NE_DEDUCTION),
  },
  accepted: 'oneHundredPercentSubtractedFrom2024',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'NE',
    ordinaryIncome: NE_SS_OTHER,
    ssBenefits: NE_SS,
    agesAlive: [70],
  })

  it('subtracts every federally included Social Security dollar from 2024', () => {
    expect(computeStateTax(pack('NE'), scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTaxableIncome(pack('NE'), scenario))
      .toBeCloseTo(NE_SS_OTHER - NE_DEDUCTION, 6)
  })

  it('would tax 85% of the benefit under the shopping-list reading', () => {
    const taxing = { ...pack('NE'), taxesSocialSecurity: true }
    expect(computeStateTax(taxing, scenario))
      .toBeCloseTo(readings.eightyFivePercentStillTaxable, 6)
    expect(computeStateTax(taxing, scenario)).toBeGreaterThan(accepted)
  })
})

describeRule('nh-rsa-77-taxation-of-incomes-repealed', {
  readings: {
    noImpositionExistsSoThereIsNoBase: 0,
    // The competing reading is Chapter 77 still in force — the 2024 tax year,
    // before the January 1, 2025 effective date the compiler's note names.
    chapterSeventySevenStillInForce: 150_000,
  },
  accepted: 'noImpositionExistsSoThereIsNoBase',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'NH',
    // Retirement income is a SUBSET of ordinary income in this model, not an
    // addition to it: the exclusion subtracts, nothing adds it in. So the
    // counterfactual base is the ordinary figure, and the retirement line is
    // here to say that all of it is what a retiree actually lives on.
    ordinaryIncome: 150_000,
    privateRetirementIncome: 150_000,
    ssBenefits: 30_000,
    agesAlive: [70],
  })

  it('leaves a New Hampshire retiree with no state base at all', () => {
    expect(computeStateTaxableIncome(pack('NH'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('NH'), scenario)).toBe(0)
  })

  it('would build a base if Chapter 77 were still in force', () => {
    const stillInForce = { ...pack('NH'), hasIncomeTax: true }
    expect(computeStateTaxableIncome(stillInForce, scenario))
      .toBe(readings.chapterSeventySevenStillInForce)
  })
})


describeRule('nm-stat-7-2-5-14-social-security-and-federal-standard', {
  readings: {
    // The NM DOR threshold is exceeded: federal taxable Social Security must
    // remain in the state base. 34,000 is the federal 85% share for this
    // non-degenerate high-income scenario, and 16,100 is NM's federal standard.
    // The rejected pack reading is 120,000 - 16,100 = 103,900 because its
    // blanket `taxesSocialSecurity: false` drops the benefit entirely.
    sourceIncludesTaxableSocialSecurity: 120_000 + 34_000 - 16_100,
    packBooleanExcludesSocialSecurity: 103_900,
  },
  accepted: 'sourceIncludesTaxableSocialSecurity',
  produced: 'packBooleanExcludesSocialSecurity',
}, ({ accepted, produced }) => {
  const scenario = input({ state: 'NM', ordinaryIncome: 120_000, ssBenefits: 40_000 })

  it('pins the high-income path where the blanket pack exclusion diverges from the source threshold', () => {
    const taxable = computeStateTaxableIncome(pack('NM'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('ncgs-105-153-5-social-security-exclusion', {
  readings: {
    sourceSubtractsTitleIISocialSecurity: 100_000 - 12_750,
    competingTaxableShareReading: 100_000 + 34_000 - 12_750,
  },
  accepted: 'sourceSubtractsTitleIISocialSecurity',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'NC', ordinaryIncome: 100_000, ssBenefits: 40_000 })

  it('subtracts Title II Social Security from North Carolina income', () => {
    expect(computeStateTaxableIncome(pack('NC'), scenario)).toBe(accepted)
    const taxed = computeStateTaxableIncome({ ...pack('NC'), taxesSocialSecurity: true }, scenario)
    expect(taxed).toBe(readings.competingTaxableShareReading)
    expect(taxed).not.toBe(accepted)
  })
})

describeRule('oh-rev-code-5747-01-social-security-and-public-pension', {
  readings: {
    sourceLeavesNonUniformedPublicPensionInTheBase: 60_000,
    packExemptsEveryPublicPensionDollar: 0,
  },
  accepted: 'sourceLeavesNonUniformedPublicPensionInTheBase',
  produced: 'packExemptsEveryPublicPensionDollar',
  note: 'public-pension deduction limb',
}, ({ accepted, produced }) => {
  // Ohio's quoted §5747.01(A)(23) deduction is for uniformed-service pay. A
  // generic public pension is not in that source-backed category, while the
  // pack's OH public override is full and has no category fact to test.
  const scenario = input({
    state: 'OH',
    ordinaryIncome: 60_000,
    publicPensionIncome: 60_000,
    agesAlive: [70],
  })

  it('pins the over-broad full public-pension override', () => {
    const taxable = computeStateTaxableIncome(pack('OH'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('oh-rev-code-5747-01-social-security-and-public-pension', {
  readings: {
    sourceAppliesTheTwoHundredDollarRetirementCredit: (50_000 - 26_050) * 0.0275 - 200,
    packOmitsTheRetirementCredit: 658.625,
  },
  accepted: 'sourceAppliesTheTwoHundredDollarRetirementCredit',
  produced: 'packOmitsTheRetirementCredit',
  note: 'retirement-income credit limb',
}, ({ accepted, produced }) => {
  // Section 5747.055(B) gives $200 when retirement income exceeds $8,000 and
  // modified AGI is below $100,000. The pack computes the pre-credit $658.625
  // Ohio tax and has no credit channel.
  const scenario = input({ state: 'OH', ordinaryIncome: 50_000, privateRetirementIncome: 10_000 })

  it('pins the omitted Ohio retirement-income credit', () => {
    const tax = computeStateTax(pack('OH'), scenario)
    expect(tax).toBe(produced)
    expect(tax).not.toBe(accepted)
  })
})

describeRule('ok-stat-68-2358-retirement-and-social-security', {
  readings: {
    sourceFullyExcludesMilitaryRetirement: 0,
    packAppliesTheTenThousandDollarCap: 3_650,
  },
  accepted: 'sourceFullyExcludesMilitaryRetirement',
  produced: 'packAppliesTheTenThousandDollarCap',
  note: 'military-retirement exception to the common cap',
}, ({ accepted, produced }) => {
  // The OTC packet's line A4 is a full exclusion, while the generic pack has
  // one shared $10,000 cap for a retirement bucket with no military category.
  const scenario = input({
    state: 'OK',
    ordinaryIncome: 20_000,
    publicPensionIncome: 20_000,
    agesAlive: [70],
  })

  it('pins the military exception the generic retirement bucket cannot express', () => {
    const taxable = computeStateTaxableIncome(pack('OK'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('ut-code-59-10-114-social-security-tax-credit', {
  readings: {
    // The credit cancels the Utah tax on the federally taxable Social
    // Security share, leaving the ordinary-income tax: 48,100 x 4.5% -
    // 18,100 x 4.5% = 1,350.
    sourceAppliesTheSocialSecurityBenefitsCredit: (30_000 + 18_100) * 0.045 - 18_100 * 0.045,
    packOmitsTheSocialSecurityBenefitsCredit: 2_164.5,
  },
  accepted: 'sourceAppliesTheSocialSecurityBenefitsCredit',
  produced: 'packOmitsTheSocialSecurityBenefitsCredit',
}, ({ accepted, produced }) => {
  // At $30,000 of other income and $40,000 of benefits, federal section 86
  // makes $18,100 taxable. Utah's single-filer AGI threshold is $54,000, so
  // the 2.5% reduction is zero and the credit is 18,100 x 4.5% = 814.50.
  const scenario = input({ state: 'UT', ordinaryIncome: 30_000, ssBenefits: 40_000 })

  it('pins the unmodeled Utah Social Security benefits credit', () => {
    const taxable = computeStateTax(pack('UT'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('or-stat-316-054-social-security-exclusion', {
  readings: {
    // ORS 316.054 subtracts every federally taxable benefit; at this income
    // the federal 85% cap is 34,000, so retaining it would be 100,000 +
    // 34,000 - 2,835 = 131,165.
    subtractTheFederalSocialSecurityAmount: 100_000 - 2_835,
    includeTheFederalSocialSecurityAmount: 100_000 + 34_000 - 2_835,
  },
  accepted: 'subtractTheFederalSocialSecurityAmount',
}, ({ accepted, readings }) => {
  const scenario = input({ state: 'OR', ordinaryIncome: 100_000, ssBenefits: 40_000 })

  it('subtracts federally taxable Social Security as ORS 316.054 directs', () => {
    expect(computeStateTaxableIncome(pack('OR'), scenario)).toBe(accepted)
    const asTaxable = computeStateTaxableIncome({ ...pack('OR'), taxesSocialSecurity: true }, scenario)
    expect(asTaxable).toBe(readings.includeTheFederalSocialSecurityAmount)
    expect(asTaxable).not.toBe(accepted)
  })
})

describeRule('ri-gen-laws-44-30-12-social-security-and-pension-modification', {
  readings: {
    sourceExcludesSocialSecurityBelowTheThreshold: 30_000 - 10_900,
    packIncludesTheTaxableShareForEveryFiler: 37_200,
  },
  accepted: 'sourceExcludesSocialSecurityBelowTheThreshold',
  produced: 'packIncludesTheTaxableShareForEveryFiler',
  note: 'Social Security AGI threshold limb',
}, ({ accepted, produced }) => {
  // Federal AGI is below RI's $80,000 single threshold, so the source removes
  // the entire federally taxable Social Security amount; the pack still adds
  // its computed 18,100 federal share (30,000 + 18,100 - 10,900 = 37,200)
  // because `taxesSocialSecurity` is true.
  const scenario = input({ state: 'RI', ordinaryIncome: 30_000, ssBenefits: 40_000, agesAlive: [70] })

  it('pins the low-AGI age-qualified Social Security modification', () => {
    const taxable = computeStateTaxableIncome(pack('RI'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('ri-gen-laws-44-30-12-social-security-and-pension-modification', {
  readings: {
    sourceAllowsTheCurrentFiftyThousandDollarCeiling: 10_000 + 60_000 - 50_000 - 10_900,
    packAppliesTheTwentyThousandDollarCeiling: 39_100,
  },
  accepted: 'sourceAllowsTheCurrentFiftyThousandDollarCeiling',
  produced: 'packAppliesTheTwentyThousandDollarCeiling',
  note: 'pension ceiling limb',
}, ({ accepted, produced }) => {
  // Federal AGI is $70,000, below the $80,000 single threshold, so the 2025+
  // $50,000 source ceiling is reachable and differs from the pack's $20,000;
  // the rejected pack reading is 70,000 - 20,000 - 10,900 = 39,100.
  const scenario = input({
    state: 'RI',
    ordinaryIncome: 70_000,
    privateRetirementIncome: 60_000,
    agesAlive: [70],
  })

  it('pins the current pension ceiling rather than the stale pack cap', () => {
    const taxable = computeStateTaxableIncome(pack('RI'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('ri-gen-laws-44-30-12-social-security-and-pension-modification', {
  readings: {
    sourceDeniesThePensionModificationAboveTheAGIThreshold: 210_000 - 10_900,
    packStillAppliesTheAgeSixtySevenCap: 179_100,
  },
  accepted: 'sourceDeniesThePensionModificationAboveTheAGIThreshold',
  produced: 'packStillAppliesTheAgeSixtySevenCap',
  note: 'pension AGI-threshold limb',
}, ({ accepted, produced }) => {
  // The $210,000 ordinary total includes the $60,000 pension, so federal AGI
  // is above RI's $80,000 threshold: the source allows no modification while
  // the pack still subtracts its age-67 $20,000 cap (210,000 - 20,000 -
  // 10,900 = 179,100).
  const scenario = input({
    state: 'RI',
    ordinaryIncome: 210_000,
    privateRetirementIncome: 60_000,
    agesAlive: [70],
  })

  it('pins the opposite direction when the pension AGI test disallows any modification', () => {
    const taxable = computeStateTaxableIncome(pack('RI'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('vt-stat-32-5830e-social-security-inclusion', {
  readings: {
    sourceExcludesAllBenefitsAtOrBelowFiftyFiveThousandAGI: 20_000 - 7_400,
    packTaxesTheFederalTaxableShare: 22_200,
  },
  accepted: 'sourceExcludesAllBenefitsAtOrBelowFiftyFiveThousandAGI',
  produced: 'packTaxesTheFederalTaxableShare',
}, ({ accepted, produced }) => {
  // Ordinary income plus the federal taxable benefit is below $55,000, so the
  // source excludes the whole federal benefit; the pack's boolean includes its
  // computed 9,600 share, producing 20,000 + 9,600 - 7,400 = 22,200.
  const scenario = input({ state: 'VT', ordinaryIncome: 20_000, ssBenefits: 40_000 })

  it('pins Vermont\'s complete low-AGI Social Security exclusion', () => {
    const taxable = computeStateTaxableIncome(pack('VT'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('va-code-58-1-322-03-age-deduction-and-social-security', {
  readings: {
    sourcePhasesTheAgeDeductionToZero: 120_000 - 8_750,
    packSubtractsTheRetirementCapWithoutThePhaseout: 99_250,
  },
  accepted: 'sourcePhasesTheAgeDeductionToZero',
  produced: 'packSubtractsTheRetirementCapWithoutThePhaseout',
}, ({ accepted, produced }) => {
  // The $120,000 total is above Virginia's $50,000 single threshold, so the
  // source phase-out leaves no age deduction; the pack subtracts $12,000 from
  // the private-retirement bucket because the filer is 65 (120,000 - 12,000 -
  // 8,750 = 99,250).
  const scenario = input({
    state: 'VA',
    ordinaryIncome: 120_000,
    privateRetirementIncome: 20_000,
    agesAlive: [65],
  })

  it('pins the high-income phase-out that the retirement-cap mapping misses', () => {
    const taxable = computeStateTaxableIncome(pack('VA'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('va-code-58-1-322-03-age-deduction-and-social-security', {
  readings: {
    sourceAllowsTheTwelveThousandDollarWageOnlyDeduction: 40_000 - 8_750 - 12_000,
    packHasNoRetirementDistributionToSubtract: 31_250,
  },
  accepted: 'sourceAllowsTheTwelveThousandDollarWageOnlyDeduction',
  produced: 'packHasNoRetirementDistributionToSubtract',
  note: 'wage-only age deduction limb',
}, ({ accepted, produced }) => {
  // At $40,000 AGI the source grants the full $12,000 age deduction even with
  // wages only; the pack has no retirement distribution through which to map
  // it and therefore leaves 40,000 - 8,750 = 31,250 taxable.
  const scenario = input({ state: 'VA', ordinaryIncome: 40_000, agesAlive: [65] })

  it('pins the opposite direction when an age-65 filer has wages but no modeled pension', () => {
    const taxable = computeStateTaxableIncome(pack('VA'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('wa-dor-no-broad-individual-income-tax', {
  readings: {
    noBroadIndividualIncomeTaxFigure: 0,
    // A hypothetical broad 5% levy on the $100,000 ordinary base would be
    // 5,000; the competing reading is a broad income tax Washington does not
    // impose. The separate capital-gains excise is registered at
    // wa-rcw-82-87-capital-gains-excise.
    applyingAnOrdinaryFivePercentRate: 5_000,
  },
  accepted: 'noBroadIndividualIncomeTaxFigure',
}, ({ accepted, readings }) => {
  const scenario = input({
    state: 'WA',
    ordinaryIncome: 100_000,
    ssBenefits: 40_000,
    privateRetirementIncome: 30_000,
    agesAlive: [70],
  })

  it('keeps Washington out of the broad state-income-tax path', () => {
    expect(computeStateTaxableIncome(pack('WA'), scenario)).toBe(accepted)
    expect(computeStateTax(pack('WA'), scenario)).toBe(accepted)
    const hypotheticalBroadTaxPack = {
      ...pack('WA'),
      hasIncomeTax: true,
      brackets: {
        single: [{ lowerBound: 0, ratePct: 5 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 5 }],
      },
    }
    // The competing 5% broad-tax reading is reachable by this one-field
    // counterfactual pack and prices the $100,000 ordinary base at $5,000.
    expect(computeStateTax(hypotheticalBroadTaxPack, scenario)).toBe(readings.applyingAnOrdinaryFivePercentRate)
    expect(computeStateTax(pack('WA'), scenario)).not.toBe(readings.applyingAnOrdinaryFivePercentRate)
  })
})

describeRule('wi-schedule-sb-line-5-long-term-capital-gain-exclusion', {
  readings: {
    sourceSubtractsThirtyPercentOfTheLongTermGain: 40_000 + 70_000 - 13_560,
    packTaxesTheWholeGainAsOrdinaryIncome: 126_440,
  },
  accepted: 'sourceSubtractsThirtyPercentOfTheLongTermGain',
  produced: 'packTaxesTheWholeGainAsOrdinaryIncome',
  note: '30% long-term capital-gain subtraction',
}, ({ accepted, produced }) => {
  // The source subtracts 30% of a qualifying long-term gain. The pack has only
  // the undifferentiated ordinary-gain path, so it leaves all $100,000 in base
  // (40,000 + 100,000 - 13,560 = 126,440).
  const scenario = input({ state: 'WI', ordinaryIncome: 40_000, capitalGains: 100_000 })

  it('pins Wisconsin\'s unrepresented long-term capital-gain exclusion', () => {
    const taxable = computeStateTaxableIncome(pack('WI'), scenario)
    expect(taxable).toBe(produced)
    expect(taxable).not.toBe(accepted)
  })
})

describeRule('wi-stat-71-05-retirement-income-subtraction', {
  readings: {
    // Line 16 subtracts only retirement income the 67-or-older individual
    // received. With the couple's $30,000 of IRA income received entirely by
    // the 60-year-old spouse, no dollar qualifies (84,000 - 25,110 = 58,890).
    perRecipientAttributionWithholdsTheSubtraction: 84_000 - 25_110,
    // Pack min(household retirement income, $24,000 × members 67+) has no
    // attribution, so the 67-year-old's presence shelters the other spouse's
    // dollars (84,000 - 24,000 - 25,110 = 34,890).
    packCapsPooledHouseholdIncome: 84_000 - 24_000 - 25_110,
  },
  accepted: 'perRecipientAttributionWithholdsTheSubtraction',
  produced: 'packCapsPooledHouseholdIncome',
  note: 'age-67 retirement attribution and election limbs',
}, ({ accepted, produced }) => {
  const mixedAgeCouple = input({
    state: 'WI',
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: 84_000,
    ssBenefits: 40_000,
    privateRetirementIncome: 30_000,
    agesAlive: [67, 60],
  })

  it('shelters retirement dollars received by the under-67 spouse', () => {
    const taxable = computeStateTaxableIncome(pack('WI'), mixedAgeCouple)
    expect(taxable).toBe(produced)
    expect(taxable).toBeLessThan(accepted)
    // Social Security stays out on both sides; only attribution differs.
    expect(produced).toBe(34_890)
    expect(accepted).toBe(58_890)
  })

  it('matches the pooled $48,000 cap when both spouses are 67', () => {
    const bothSixtySeven = input({
      state: 'WI',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: 84_000,
      privateRetirementIncome: 48_000,
      agesAlive: [67, 68],
    })
    // 'regardless of how much retirement income each spouse received' — the
    // pooled min(income, 24,000 × 2) is exact for a both-67 couple.
    expect(computeStateTaxableIncome(pack('WI'), bothSixtySeven)).toBe(84_000 - 48_000 - 25_110)
  })

  it('grants a 65-year-old nothing where Line 17 would allow $5,000', () => {
    const lowAgiSixtyFive = input({
      state: 'WI',
      ordinaryIncome: 14_000,
      privateRetirementIncome: 14_000,
      agesAlive: [65],
    })
    // Line 17 (AGI under $15,000 single) would leave
    // max(0, 14,000 - 5,000 - 13,560) = 0; the pack's minAge-67 cap leaves 440.
    expect(computeStateTaxableIncome(pack('WI'), lowAgiSixtyFive)).toBe(14_000 - 13_560)
  })
})

  it('models every state these records describe', () => {
    // A record naming a state the pack does not carry would be a claim about
    // code that is not there.
    for (const code of [
      'ND', 'PA', 'NV', 'TX', 'FL', 'WV', 'NY', 'IL', 'MO', 'IA', 'ME', 'SC',
      'AK', 'SD', 'TN', 'WY', 'AR', 'AZ', 'IN', 'MS',
      'CA', 'CO', 'CT', 'DC', 'DE', 'GA', 'HI', 'ID', 'KS',
      'NM', 'NC', 'OH', 'OK', 'OR', 'RI', 'UT', 'VT', 'VA', 'WA', 'WI',
      'KY', 'LA', 'MD', 'MA', 'MI', 'MN', 'MT', 'NE', 'NH', 'NJ',
    ]) {
      expect(stateParamsFor(code, TAX_YEAR), code).toBeDefined()
    }
  })
})
