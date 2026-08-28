/**
 * Pins for the `approximated` state records — the gaps between what a state's
 * own law allows a retiree and what the "big levers" pack can express.
 *
 * They all have the same cause. `StateTaxParams` models a state's retirement
 * treatment as two exclusions, each one an optional integer `minAge` and an
 * optional per-person cap, and its capital-gain treatment as a single included
 * percentage. These states do not fit through that shape:
 *
 *   - North Dakota subtracts military and 20-year peace-officer retirement and
 *     no other public pension; the public bucket is one flag, so setting it
 *     exempts civil-service pensions North Dakota taxes.
 *   - North Dakota also excludes 40% of qualified dividends; the included-share
 *     field governs capital gains only, so dividends enter at 100%.
 *   - Arkansas exempts uniformed-services retirement in full and caps every
 *     other pension at $6,000; the same one flag, pointed the other way.
 *   - Arkansas gates its $6,000 at 59½ for an IRA and not at all for an
 *     employer plan; `minAge` gates the whole bucket and cannot see which.
 *   - Arkansas exempts capital gain above $10,000,000 outright; the
 *     included-share field has no ceiling above which the share falls to zero.
 *   - Arizona exempts uniformed-services retired pay in full and caps a
 *     civil-service pension at $2,500 — the North Dakota shape exactly, with a
 *     cap in place of nothing.
 *   - Arizona's 25% gain subtraction reaches only an asset acquired after 2011;
 *     the engine carries no acquisition date.
 *   - Arizona's age-65 relief is a $2,100 per-person exemption above the
 *     deduction line; the pack's only age-65 field is the FEDERAL addition, and
 *     it attaches to conforming states alone.
 *   - Indiana deducts military retirement in full and gives every other public
 *     pension nothing; the North Dakota and Arizona shape again, pointed the
 *     way Arkansas's is.
 *   - Indiana's civil service annuity adjustment is capped at $16,000, gated at
 *     62, and reduced by Social Security received; nothing in the bucket
 *     offsets one income stream against another.
 *   - Indiana's county income tax is universal and is not in the pack at all —
 *     the one gap here that is a missing DEFAULT rather than a missing shape.
 *   - Indiana's exemptions and Mississippi's are flat per-person subtractions
 *     with an age-conditioned half; `standardDeduction` is per filing status.
 *   - Mississippi's exclusion stops at a distribution bearing the federal
 *     72(t) additional tax; that is a fact about a distribution and the input
 *     model carries only household ages.
 *   - A Mississippi COMBINED return runs the whole schedule per spouse;
 *     `PerStatus<StateTaxBracket[]>` has one schedule per filing status.
 *   - Pennsylvania conditions on the PLAN's age or service requirement; the
 *     pack substitutes a flat age 60.
 *   - New York conditions on attaining 59½; `minAge` is compared against an
 *     integer, so the pack rounds it down to 59.
 *   - South Carolina has a $3,000 tier below 65 and a $10,000 tier from 65; the
 *     pack holds one cap and one age, so only the upper tier survives.
 *
 * Each fixture drives the shipped pack to show the engine produces the
 * approximated figure, and prices the same scenario a second time through the
 * change that would close the gap to show the statute's figure is reachable
 * and different. The day someone closes one of these, the first assertion fails
 * and names the record to reclassify — which is the entire reason `produced`
 * exists. North Dakota's 40% long-term-gain exclusion was on this list until
 * 2026-08-05 and left it that way: the pack gained `capitalGainsTaxablePct: 60`,
 * the assertion here failed, and the record and its fixture moved to
 * `tax/stateTax.rules.test.ts` as `settled`.
 *
 * Directions are mixed, and which way each runs is the thing to read first.
 * North Dakota's and Arizona's public-pension entries, Arkansas's age gate,
 * Arizona's gain subtraction, Indiana's absent county rate and Mississippi's
 * early-distribution carve-out all under-charge — several of them because
 * closing a real gap with a flag coarser than the statute opened a smaller one
 * facing the other way. The rest over-charge. An under-charge is the dangerous
 * direction and is registered for exactly that reason: a correction that
 * quietly introduces one is worse than the overstatement it replaced if nobody
 * can see it.
 *
 * Mississippi is the state where the sign flips WITHIN one jurisdiction rather
 * than between two, which is why its records are never netted: the exemptions
 * over-charge a 65-plus household living on exempt pension income, and the
 * early-distribution carve-out under-charges the pre-59½ drawdown. Reading a
 * blended direction for Mississippi would hide both.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import { stateParamsFor } from '../../params/state/index.js'
import type { StateTaxParams } from '../../params/state/types.js'
import type { TaxYearInput } from '../../projection/types.js'
import { computeStateTax, computeStateTaxDetail, computeStateTaxableIncome } from '../../tax/stateTax.js'

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
 * Guarded rather than asserted with `!`. These fixtures price a state against
 * its own law, so a mistyped code would hand the calculator undefined params
 * and fail downstream without naming the state that was actually wanted.
 */
function pack(code: string): StateTaxParams {
  const params = stateParamsFor(code, TAX_YEAR)
  if (params === undefined) throw new Error(`no ${TAX_YEAR} state pack for ${code}`)
  return params
}

function bandedTax(bands: readonly (readonly [number, number, number])[], taxable: number): number {
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}

// ND single, 2026 published schedule: 0% to 49,575, 1.95% to 250,400, 2.5%
// above. Deduction 16,100 (the conformed federal figure).
const northDakotaTax = (taxable: number) => bandedTax(
  [[0, 49_575, 0], [49_575, 250_400, 1.95], [250_400, Infinity, 2.5]],
  taxable,
)
const ND_DEDUCTION = 16_100
const ND_CIVIL_SERVICE_OTHER_INCOME = 160_000
const ND_CIVIL_SERVICE_PENSION = 55_000

describeRule('ndcc-57-38-30-3-2-closed-subtraction-list', {
  readings: {
    // 57-38-30.3(2) subtracts military retirement and 20-year peace-officer
    // retirement. A state PERS or federal civil-service annuity is on neither
    // list, and (2)(a) reaches only income a federal statute exempts.
    civilServiceAnnuityTaxedInFull:
      northDakotaTax(ND_CIVIL_SERVICE_OTHER_INCOME - ND_DEDUCTION),
    everyPublicPensionExempt:
      northDakotaTax(ND_CIVIL_SERVICE_OTHER_INCOME - ND_CIVIL_SERVICE_PENSION - ND_DEDUCTION),
  },
  accepted: 'civilServiceAnnuityTaxedInFull',
  produced: 'everyPublicPensionExempt',
}, ({ accepted, produced }) => {
  // A retired North Dakota schoolteacher. Nothing about this household is
  // uniformed, so no subdivision of 57-38-30.3(2) reaches the pension — and the
  // engine exempts it anyway, because `publicPensionIncome` is one bucket.
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_CIVIL_SERVICE_OTHER_INCOME,
    publicPensionIncome: ND_CIVIL_SERVICE_PENSION,
    agesAlive: [70],
  })

  it('exempts a civil-service pension North Dakota taxes in full', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('ND'), scenario)).toBeLessThan(accepted)
  })

  it('reaches the statute’s figure once the public bucket stops exempting', () => {
    // What would close it is not a flag but a fact the input model does not
    // carry: whether the pension is military, peace-officer with twenty years'
    // service, or neither. Priced here as the bucket the pack held before the
    // military exclusion landed, which is the right answer for this household
    // and the wrong one for a military retiree.
    const taxed = { ...pack('ND'), retirementPublic: { kind: 'none' as const } }
    expect(computeStateTax(taxed, scenario)).toBeCloseTo(accepted, 6)
  })

  it('still taxes private retirement income, which is the half the pack gets right', () => {
    const privateOnly = input({
      state: 'ND',
      ordinaryIncome: ND_CIVIL_SERVICE_OTHER_INCOME,
      privateRetirementIncome: ND_CIVIL_SERVICE_PENSION,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('ND'), privateOnly)).toBeCloseTo(accepted, 6)
  })
})

const ND_DIVIDEND_ORDINARY = 80_000
const ND_QUALIFIED_DIVIDENDS = 40_000

describeRule('ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion', {
  readings: {
    sixtyPercentOfTheDividendInTheBase:
      northDakotaTax(ND_DIVIDEND_ORDINARY + ND_QUALIFIED_DIVIDENDS * 0.6 - ND_DEDUCTION),
    theWholeDividendInTheBase:
      northDakotaTax(ND_DIVIDEND_ORDINARY + ND_QUALIFIED_DIVIDENDS - ND_DEDUCTION),
  },
  accepted: 'sixtyPercentOfTheDividendInTheBase',
  produced: 'theWholeDividendInTheBase',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_DIVIDEND_ORDINARY,
    qualifiedDividends: ND_QUALIFIED_DIVIDENDS,
    agesAlive: [70],
  })

  it('taxes the whole qualified dividend rather than the statute’s 60%', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('ND'), scenario)).not.toBeCloseTo(accepted, 6)
  })

  it('reaches the statute’s figure only by shrinking the input, which is not a fix', () => {
    // Unlike the long-term-gain gap, this one has no field to set:
    // `capitalGainsTaxablePct` governs `capitalGains` and nothing else. The
    // accepted figure is therefore priced by handing the calculator sixty
    // percent of the dividend, which is what the missing field would compute
    // internally — and which a caller must never do, because the same input
    // feeds the federal calculator, where the whole dividend belongs.
    const preExcluded = input({
      state: 'ND',
      ordinaryIncome: ND_DIVIDEND_ORDINARY,
      qualifiedDividends: ND_QUALIFIED_DIVIDENDS * 0.6,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('ND'), preExcluded)).toBeCloseTo(accepted, 6)
  })
})

const PA_RATE = 0.0307
const PA_PENSION = 60_000

describeRule('pa-pit-retirement-benefits-not-compensation', {
  readings: {
    // Retired from service having met the plan's own service requirement, so
    // the distribution is not Pennsylvania compensation whatever the age.
    planAgeOrServiceRequirementMet: 0,
    flatAgeSixtyGate: PA_PENSION * PA_RATE,
  },
  accepted: 'planAgeOrServiceRequirementMet',
  produced: 'flatAgeSixtyGate',
}, ({ accepted, produced }) => {
  // Fifty-eight, retired after a stated period of employment: exempt under the
  // regulation, two years short under the pack.
  const scenario = input({
    state: 'PA',
    ordinaryIncome: PA_PENSION,
    privateRetirementIncome: PA_PENSION,
    agesAlive: [58],
  })

  it('charges a retired 58-year-old Pennsylvania tax the regulation does not', () => {
    expect(computeStateTax(pack('PA'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('PA'), scenario)).not.toBeCloseTo(accepted, 6)
  })

  it('exempts the same distribution once the gate reaches the retiree', () => {
    const reaching = {
      ...pack('PA'),
      retirementPrivate: { kind: 'full' as const, minAge: 55 },
      retirementPublic: { kind: 'full' as const, minAge: 55 },
    }
    expect(computeStateTax(reaching, scenario)).toBe(accepted)
  })

  it('still charges a Pennsylvanian who has not retired at all, in the other direction', () => {
    // `bothDirections` is not a hedge. Above the flat gate the proxy is loose
    // rather than tight: a 62-year-old still working and taking an in-service
    // IRA distribution has not "retired from service", so the regulation taxes
    // this and the pack does not.
    const stillWorking = input({
      state: 'PA',
      ordinaryIncome: PA_PENSION,
      privateRetirementIncome: PA_PENSION,
      agesAlive: [62],
    })
    expect(computeStateTax(pack('PA'), stillWorking)).toBe(0)
  })
})

// NY single: 3.9% to 8,500, 4.4% to 11,700, 5.15% to 13,900, 5.4% to 80,650,
// 5.9% to 215,400, and higher bands above. Deduction 8,000.
const newYorkTax = (taxable: number) => bandedTax(
  [
    [0, 8500, 3.9], [8500, 11_700, 4.4], [11_700, 13_900, 5.15],
    [13_900, 80_650, 5.4], [80_650, 215_400, 5.9],
  ],
  taxable,
)
const NY_PENSION = 80_000
const NY_DEDUCTION = 8000
const NY_EXCLUSION = 20_000

describeRule('ny-tax-612-c-3-a-pension-annuity-exclusion', {
  readings: {
    // Fifty-nine and not yet fifty-nine and a half: no exclusion.
    attainmentOfFiftyNineAndAHalfRequired: newYorkTax(NY_PENSION - NY_DEDUCTION),
    exclusionGrantedFromTheFiftyNinthBirthday:
      newYorkTax(NY_PENSION - NY_EXCLUSION - NY_DEDUCTION),
  },
  accepted: 'attainmentOfFiftyNineAndAHalfRequired',
  produced: 'exclusionGrantedFromTheFiftyNinthBirthday',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'NY',
    ordinaryIncome: NY_PENSION,
    privateRetirementIncome: NY_PENSION,
    agesAlive: [59],
  })

  it('grants a 59-year-old the $20,000 subtraction half a year early', () => {
    expect(computeStateTax(pack('NY'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('NY'), scenario)).toBeLessThan(accepted)
  })

  it('withholds it once the gate is raised past the incomplete year', () => {
    // The half-year cannot be written into `minAge` at all — this is the
    // nearest integer that excludes someone who has not yet attained 59½, and
    // it necessarily also excludes those who have.
    const raised = {
      ...pack('NY'),
      retirementPrivate: { kind: 'capped' as const, capPerPerson: NY_EXCLUSION, minAge: 60 },
    }
    expect(computeStateTax(raised, scenario)).toBeCloseTo(accepted, 6)
  })
})

// SC single: 1.99% to 30,000, 5.21% above. Deduction 15,000.
const southCarolinaTax = (taxable: number) => bandedTax(
  [[0, 30_000, 1.99], [30_000, Infinity, 5.21]],
  taxable,
)
const SC_RETIREMENT = 70_000
const SC_DEDUCTION = 15_000
const SC_LOWER_TIER = 3000

describeRule('sc-code-12-6-1170-retirement-income-deduction', {
  readings: {
    threeThousandDollarTierBelowSixtyFive:
      southCarolinaTax(SC_RETIREMENT - SC_LOWER_TIER - SC_DEDUCTION),
    onlyTheSixtyFiveTierModelled: southCarolinaTax(SC_RETIREMENT - SC_DEDUCTION),
  },
  accepted: 'threeThousandDollarTierBelowSixtyFive',
  produced: 'onlyTheSixtyFiveTierModelled',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'SC',
    ordinaryIncome: SC_RETIREMENT,
    privateRetirementIncome: SC_RETIREMENT,
    agesAlive: [62],
  })

  it('gives a 62-year-old South Carolinian no deduction at all', () => {
    expect(computeStateTax(pack('SC'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('SC'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure once the lower tier is modelled', () => {
    const lowerTier = {
      ...pack('SC'),
      retirementPrivate: { kind: 'capped' as const, capPerPerson: SC_LOWER_TIER },
    }
    expect(computeStateTax(lowerTier, scenario)).toBeCloseTo(accepted, 6)
  })
})

// Arkansas, DFA's published 2026 schedule: 0% to 5,600, 2% to 11,200, 3% to
// 16,000, 3.4% to 26,400, 3.9% above. Deduction 2,470 per taxpayer.
const arkansasTax = (taxable: number) => bandedTax(
  [[0, 5_600, 0], [5_600, 11_200, 2], [11_200, 16_000, 3], [16_000, 26_400, 3.4], [26_400, Infinity, 3.9]],
  taxable,
)
const AR_DEDUCTION = 2_470
const AR_MILITARY_OTHER_INCOME = 50_000
const AR_MILITARY_PENSION = 45_000
const AR_MILITARY_GROSS = AR_MILITARY_OTHER_INCOME + AR_MILITARY_PENSION

describeRule('aca-26-51-307-e-uniformed-services-full-exemption', {
  readings: {
    militaryRetirementFullyExempt: arkansasTax(AR_MILITARY_OTHER_INCOME - AR_DEDUCTION),
    cappedAtTheSixThousandEveryOtherPensionGets: arkansasTax(AR_MILITARY_GROSS - 6_000 - AR_DEDUCTION),
  },
  accepted: 'militaryRetirementFullyExempt',
  produced: 'cappedAtTheSixThousandEveryOtherPensionGets',
}, ({ accepted, produced }) => {
  // An Arkansas military retiree. 26-51-307(e) exempts the pension outright;
  // the pack's public bucket carries the $6,000 rule Arkansas applies to every
  // OTHER public pension, so this household is over-charged.
  const scenario = input({
    state: 'AR',
    ordinaryIncome: AR_MILITARY_GROSS,
    publicPensionIncome: AR_MILITARY_PENSION,
    agesAlive: [70],
  })

  it('charges Arkansas tax on a military pension above $6,000', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AR'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure only by exempting every public pension in the state', () => {
    // Which is what closing it with the one flag available would mean, and what
    // the pack did until 2026-08-05. The direction was chosen deliberately: an
    // ATRS, APERS, county, police or fire pension is inside 26-51-307(a)(1)
    // with a $6,000 ceiling, and there are far more of those households than
    // military ones. What would actually close the gap is a fact the input
    // model does not carry — whether the pension is uniformed or civil.
    const uniformedBucket = {
      ...pack('AR'),
      retirementRuleShared: false,
      retirementPublic: { kind: 'full' as const },
    }
    expect(computeStateTax(uniformedBucket, scenario)).toBeCloseTo(accepted, 6)
  })
})

const AR_EARLY_IRA_OTHER_INCOME = 15_000
const AR_EARLY_IRA_WITHDRAWAL = 25_000
const AR_EARLY_IRA_GROSS = AR_EARLY_IRA_OTHER_INCOME + AR_EARLY_IRA_WITHDRAWAL

describeRule('aca-26-51-307-a-2-ira-age-fifty-nine-and-a-half-gate', {
  readings: {
    prematureIraDistributionGetsNothing: arkansasTax(AR_EARLY_IRA_GROSS - AR_DEDUCTION),
    sixThousandGrantedAtAnyAge: arkansasTax(AR_EARLY_IRA_GROSS - 6_000 - AR_DEDUCTION),
  },
  accepted: 'prematureIraDistributionGetsNothing',
  produced: 'sixThousandGrantedAtAnyAge',
}, ({ accepted, produced }) => {
  // Fifty-five, drawing on a traditional IRA. 26-51-307(a)(2)(C) denies the
  // exemption to every premature distribution that is not death or disability.
  const scenario = input({
    state: 'AR',
    ordinaryIncome: AR_EARLY_IRA_GROSS,
    privateRetirementIncome: AR_EARLY_IRA_WITHDRAWAL,
    agesAlive: [55],
  })

  it('exempts $6,000 of an early IRA withdrawal Arkansas taxes in full', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AR'), scenario)).toBeLessThan(accepted)
  })

  it('reaches the statute’s figure only by gating an employer pension the same way', () => {
    // `minAge` gates the whole bucket, and the pack cannot see whether the
    // income came from an IRA or an employer plan. So the setting that prices
    // this household correctly also denies the exemption to a 55-year-old
    // drawing an employer pension, which Arkansas allows — the department says
    // expressly that the recipient need not even be retired.
    const gated = {
      ...pack('AR'),
      retirementPrivate: { kind: 'capped' as const, capPerPerson: 6_000, minAge: 59.5 },
    }
    expect(computeStateTax(gated, scenario)).toBeCloseTo(accepted, 6)
    expect(computeStateTax(gated, scenario)).toBeGreaterThan(computeStateTax(pack('AR'), scenario))
  })
})

const AR_LARGE_GAIN = 12_000_000
const AR_EXEMPT_CEILING = 10_000_000

describeRule('aca-26-51-815-b-3-ten-million-dollar-gain-exemption', {
  readings: {
    halfOfTheFirstTenMillionOnly: arkansasTax(AR_EXEMPT_CEILING * 0.5 - AR_DEDUCTION),
    halfOfTheWholeRealization: arkansasTax(AR_LARGE_GAIN * 0.5 - AR_DEDUCTION),
  },
  accepted: 'halfOfTheFirstTenMillionOnly',
  produced: 'halfOfTheWholeRealization',
}, ({ accepted, produced }) => {
  const scenario = input({ state: 'AR', capitalGains: AR_LARGE_GAIN, agesAlive: [70] })

  it('taxes half of the excess above $10,000,000 that Arkansas exempts outright', () => {
    expect(computeStateTax(pack('AR'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AR'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure only by shrinking the input, which is not a fix', () => {
    // `capitalGainsTaxablePct` is one share with no ceiling above which it
    // falls to zero, so the accepted figure has to be priced by handing the
    // calculator the capped gain Form AR1000D line 7b computes — which a
    // caller must never do, because the same input feeds the federal
    // calculator, where the whole realization belongs.
    const capped = input({ state: 'AR', capitalGains: AR_EXEMPT_CEILING, agesAlive: [70] })
    expect(computeStateTax(pack('AR'), capped)).toBeCloseTo(accepted, 6)
  })
})

// Arizona is 2.5% of the base and nothing else moves underneath it. Deduction
// 15,750, which is Arizona's own published figure.
const AZ_RATE = 0.025
const AZ_DEDUCTION = 15_750
const azTax = (taxable: number) => Math.max(0, taxable) * AZ_RATE
const AZ_CIVIL_SERVICE_OTHER_INCOME = 50_000
const AZ_CIVIL_SERVICE_PENSION = 45_000
const AZ_CIVIL_SERVICE_GROSS = AZ_CIVIL_SERVICE_OTHER_INCOME + AZ_CIVIL_SERVICE_PENSION
const AZ_GOVERNMENT_PENSION_CAP = 2_500

describeRule('ars-43-1022-2-government-pension-exclusion', {
  readings: {
    twentyFiveHundredSubtracted:
      azTax(AZ_CIVIL_SERVICE_GROSS - AZ_GOVERNMENT_PENSION_CAP - AZ_DEDUCTION),
    everyPublicPensionExempt: azTax(AZ_CIVIL_SERVICE_OTHER_INCOME - AZ_DEDUCTION),
  },
  accepted: 'twentyFiveHundredSubtracted',
  produced: 'everyPublicPensionExempt',
}, ({ accepted, produced }) => {
  // A retired Arizona state employee. 43-1022(2) subtracts $2,500 of an ASRS
  // pension and no more; the pack's public bucket is `full` for the sake of
  // 43-1022(26)'s military exclusion, so the whole pension leaves the base.
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_CIVIL_SERVICE_GROSS,
    publicPensionIncome: AZ_CIVIL_SERVICE_PENSION,
    agesAlive: [70],
  })

  it('exempts an ASRS pension Arizona taxes above $2,500', () => {
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AZ'), scenario)).toBeLessThan(accepted)
  })

  it('reaches the statute’s figure only by capping the military exclusion too', () => {
    // The bucket is one flag. Capping it at $2,500 prices this household right
    // and puts a military retiree's whole pension back in the Arizona base,
    // which 43-1022(26)(c) removes. What would close it is a fact the input
    // model does not carry: whether the pension is uniformed or civil.
    const capped = {
      ...pack('AZ'),
      retirementPublic: { kind: 'capped' as const, capPerPerson: AZ_GOVERNMENT_PENSION_CAP },
    }
    expect(computeStateTax(capped, scenario)).toBeCloseTo(accepted, 6)
  })
})

const AZ_GAIN_ORDINARY = 80_000
const AZ_PRE_2012_GAIN = 100_000

describeRule('ars-43-1022-22-long-term-capital-gain-subtraction', {
  readings: {
    preTwentyTwelveAssetTaxedInFull: azTax(AZ_GAIN_ORDINARY + AZ_PRE_2012_GAIN - AZ_DEDUCTION),
    twentyFivePercentSubtractedFromEveryGain:
      azTax(AZ_GAIN_ORDINARY + AZ_PRE_2012_GAIN * 0.75 - AZ_DEDUCTION),
  },
  accepted: 'preTwentyTwelveAssetTaxedInFull',
  produced: 'twentyFivePercentSubtractedFromEveryGain',
}, ({ accepted, produced }) => {
  // A position bought before 2012 — or one whose acquisition date cannot be
  // verified, which 43-1022(22)(c) treats the same way. Arizona allows no
  // subtraction on either, and the engine cannot tell them from a post-2011
  // holding because it carries no acquisition date at all.
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_GAIN_ORDINARY,
    capitalGains: AZ_PRE_2012_GAIN,
    agesAlive: [70],
  })

  it('subtracts a quarter of a pre-2012 gain that Arizona taxes in full', () => {
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AZ'), scenario)).toBeLessThan(accepted)
  })

  it('reaches the statute’s figure only for a household holding nothing bought since 2011', () => {
    // The included share is one number for the whole state. Setting it to 100
    // prices this household correctly and over-charges every Arizonan whose
    // gain came from an asset acquired after 2011, which is the majority and
    // grows every year.
    const noSubtraction = { ...pack('AZ'), capitalGainsTaxablePct: 100 }
    expect(computeStateTax(noSubtraction, scenario)).toBeCloseTo(accepted, 6)
  })
})

const AZ_AGE65_INCOME = 120_000
const AZ_AGE65_EXEMPTION = 2_100

describeRule('ars-43-1023-e-age-65-exemption', {
  readings: {
    twentyOneHundredPerPersonSubtracted:
      azTax(AZ_AGE65_INCOME - AZ_AGE65_EXEMPTION - AZ_DEDUCTION),
    noAgeRelatedSubtractionAtAll: azTax(AZ_AGE65_INCOME - AZ_DEDUCTION),
  },
  accepted: 'twentyOneHundredPerPersonSubtracted',
  produced: 'noAgeRelatedSubtractionAtAll',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'AZ',
    ordinaryIncome: AZ_AGE65_INCOME,
    peopleAged65Plus: 1,
    agesAlive: [70],
  })

  it('gives a 65-year-old Arizonan no exemption at all', () => {
    expect(computeStateTax(pack('AZ'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AZ'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure only by shrinking the input, which is not a fix', () => {
    // There is no field. `standardDeductionAge65Addition` is attached by the
    // conformity indexer only to a state whose deduction IS the federal one,
    // and it carries the FEDERAL amount under IRC 63(c)(3) — a different figure
    // under a different statute, indexed every year while 43-1023(E)'s $2,100
    // is frozen. So the accepted figure is priced by handing the calculator the
    // income net of the exemption, which a caller must never do: the same input
    // feeds the federal calculator, where no such exemption exists.
    const preExempted = input({
      state: 'AZ',
      ordinaryIncome: AZ_AGE65_INCOME - AZ_AGE65_EXEMPTION,
      peopleAged65Plus: 1,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('AZ'), preExempted)).toBeCloseTo(accepted, 6)
  })
})

// Indiana is one flat rate on one base and the pack grants no deduction at
// all, so every fixture below is 2.95% of whatever the pack leaves in that
// base — which, for three of the four, is the whole of it.
const IN_RATE = 0.0295
const inTax = (taxable: number) => Math.max(0, taxable) * IN_RATE
const IN_MILITARY_OTHER_INCOME = 24_000
const IN_MILITARY_PENSION = 36_000
const IN_MILITARY_GROSS = IN_MILITARY_OTHER_INCOME + IN_MILITARY_PENSION

describeRule('ic-6-3-2-4-military-retirement-deduction', {
  readings: {
    militaryRetirementDeductedInFull: inTax(IN_MILITARY_OTHER_INCOME),
    noDeductionAtAllLikeEveryOtherIndianaPension: inTax(IN_MILITARY_GROSS),
  },
  accepted: 'militaryRetirementDeductedInFull',
  produced: 'noDeductionAtAllLikeEveryOtherIndianaPension',
}, ({ accepted, produced }) => {
  // An Indiana military retiree. IC 6-3-2-4(a)(2) deducts the pension outright
  // with no age condition; the pack's public bucket carries the `none` Indiana
  // applies to every OTHER public pension, so this household is over-charged.
  const scenario = input({
    state: 'IN',
    ordinaryIncome: IN_MILITARY_GROSS,
    publicPensionIncome: IN_MILITARY_PENSION,
    agesAlive: [70],
  })

  it('charges Indiana tax on a military pension Indiana deducts in full', () => {
    expect(computeStateTax(pack('IN'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('IN'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure only by exempting every public pension in the state', () => {
    // Which is what closing it with the one flag available would mean, and
    // what the pack did until 2026-08-05. The direction was chosen: an
    // INPRS/PERF, TRF, municipal police or fire pension gets NOTHING under
    // IC 6-3-2's closed list, and there are far more of those households than
    // military ones. What would actually close the gap is a fact the input
    // model does not carry — whether the pension is uniformed or civil.
    const uniformedBucket = {
      ...pack('IN'),
      retirementRuleShared: false,
      retirementPublic: { kind: 'full' as const },
    }
    expect(computeStateTax(uniformedBucket, scenario)).toBeCloseTo(accepted, 6)
  })
})

const IN_CSRS_ANNUITY = 40_000
const IN_CSRS_OTHER_INCOME = 10_000
const IN_CSRS_GROSS = IN_CSRS_ANNUITY + IN_CSRS_OTHER_INCOME
const IN_CSRS_DEDUCTION_CEILING = 16_000

describeRule('ic-6-3-2-3-7-civil-service-annuity-age-62', {
  readings: {
    sixteenThousandDeductedAtSixtyTwo: inTax(IN_CSRS_GROSS - IN_CSRS_DEDUCTION_CEILING),
    noCivilServiceAdjustmentAtAll: inTax(IN_CSRS_GROSS),
  },
  accepted: 'sixteenThousandDeductedAtSixtyTwo',
  produced: 'noCivilServiceAdjustmentAtAll',
}, ({ accepted, produced }) => {
  // Sixty-five, a federal civil service annuity, and no Social Security — so
  // IC 6-3-2-3.7(a)(2)'s offset takes nothing off and the whole $16,000
  // ceiling is available. That is where the gap is widest, and it is a real
  // household: a CSRS annuitant who never paid into Social Security.
  const scenario = input({
    state: 'IN',
    ordinaryIncome: IN_CSRS_GROSS,
    publicPensionIncome: IN_CSRS_ANNUITY,
    agesAlive: [65],
  })

  it('gives a 65-year-old CSRS annuitant no adjustment at all', () => {
    expect(computeStateTax(pack('IN'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('IN'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure only through a cap that cannot also carry the military case', () => {
    // `capped` is the closest shape the bucket has, and it is wrong twice
    // over: it carries no offset against Social Security received, which is
    // what (a)(2) subtracts and what takes most annuitants to zero, and
    // setting it puts a $16,000 ceiling on the military pension IC 6-3-2-4
    // deducts outright. One flag cannot hold both.
    const capped = {
      ...pack('IN'),
      retirementRuleShared: false,
      retirementPublic: { kind: 'capped' as const, capPerPerson: IN_CSRS_DEDUCTION_CEILING, minAge: 62 },
    }
    expect(computeStateTax(capped, scenario)).toBeCloseTo(accepted, 6)
  })
})

// A county at 2%, mid-range across the 92 for 2026 (the published extremes are
// Porter at 0.5% and Randolph at 3%). Written as a rate a caller supplies,
// because that is the only way one can reach the calculator.
const IN_COUNTY_RATE_PCT = 2
const IN_COUNTY_INCOME = 70_000

describeRule('ic-6-3-6-2-2-county-income-tax-shares-the-state-base', {
  readings: {
    stateAndCountyOnTheSameBase:
      inTax(IN_COUNTY_INCOME) + IN_COUNTY_INCOME * (IN_COUNTY_RATE_PCT / 100),
    stateAloneWithTheCallerSilent: inTax(IN_COUNTY_INCOME),
  },
  accepted: 'stateAndCountyOnTheSameBase',
  produced: 'stateAloneWithTheCallerSilent',
}, ({ accepted, produced }) => {
  const scenario = input({ state: 'IN', ordinaryIncome: IN_COUNTY_INCOME, agesAlive: [70] })

  it('charges an Indiana household no county tax when the caller names no rate', () => {
    // `assumptions.localIncomeTaxPct` defaults to 0 and a relocation candidate
    // documents omission as 0, so this is what an Indiana projection costs
    // unless somebody enters a county rate by hand — about $1,400 a year less
    // than Indiana charges, against $2,065 of state tax.
    expect(computeStateTaxDetail(pack('IN'), scenario).totalTax).toBeCloseTo(produced, 6)
    expect(computeStateTaxDetail(pack('IN'), scenario).localTax).toBe(0)
    expect(computeStateTaxDetail(pack('IN'), scenario).totalTax).toBeLessThan(accepted)
  })

  it('reaches the statute’s figure the moment a rate is supplied, which is the shape being right', () => {
    // The mechanism is not missing — the county tax runs on state taxable
    // income, which is exactly what `localRatePct` multiplies. What is missing
    // is a per-state DEFAULT, and `StateTaxParams` has no field for one. No
    // figure is invented here either: the 92 published rates span sixfold and
    // Indiana publishes no statewide number to stand for them, so an average
    // would be a figure with no publisher.
    const withCounty = computeStateTaxDetail(pack('IN'), scenario, { localRatePct: IN_COUNTY_RATE_PCT })
    expect(withCounty.totalTax).toBeCloseTo(accepted, 6)
    expect(withCounty.localTax).toBeCloseTo(withCounty.taxableIncome * (IN_COUNTY_RATE_PCT / 100), 6)
  })
})

// A married couple, both 67. Schedule 3 gives them $2,000 of personal
// exemption and $1,000 each for age, so $4,000 in all.
const IN_EXEMPTION_INCOME = 70_000
const IN_EXEMPTIONS_65_PLUS_JOINT = 4_000

describeRule('ic-6-3-1-3-5-exemptions-not-a-standard-deduction', {
  readings: {
    scheduleThreeExemptionsSubtracted: inTax(IN_EXEMPTION_INCOME - IN_EXEMPTIONS_65_PLUS_JOINT),
    nothingSubtractedAtAll: inTax(IN_EXEMPTION_INCOME),
  },
  accepted: 'scheduleThreeExemptionsSubtracted',
  produced: 'nothingSubtractedAtAll',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'IN',
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: IN_EXEMPTION_INCOME,
    peopleAged65Plus: 2,
    agesAlive: [67, 67],
  })

  it('subtracts nothing from an Indiana base Indiana subtracts $4,000 from', () => {
    expect(computeStateTax(pack('IN'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('IN'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure only by borrowing a field that then over-deducts under 65', () => {
    // `standardDeduction` is the only flat subtraction the pack has, and the
    // figure that prices THIS household right is $4,000 — of which $2,000 is
    // conditioned on age. A household under 65 gets $2,000 and would be
    // over-deducted by the other half, turning an over-charge into an
    // under-charge. That, plus the pack modelling no state personal exemption
    // anywhere, is why the field stays at zero.
    const borrowed = {
      ...pack('IN'),
      standardDeduction: { single: 2_000, marriedFilingJointly: IN_EXEMPTIONS_65_PLUS_JOINT },
    }
    expect(computeStateTax(borrowed, scenario)).toBeCloseTo(accepted, 6)
    const underSixtyFive = input({
      state: 'IN',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: IN_EXEMPTION_INCOME,
      agesAlive: [60, 60],
    })
    expect(computeStateTax(borrowed, underSixtyFive))
      .toBeLessThan(inTax(IN_EXEMPTION_INCOME - 2_000))
  })
})

// Mississippi: 0% on the first $10,000 of taxable income, 4% above it.
const MS_RATE = 0.04
const MS_ZERO_BAND = 10_000
const MS_DEDUCTION_SINGLE = 2_300
const MS_DEDUCTION_JOINT = 4_600
const msTax = (taxable: number) => Math.max(0, Math.max(0, taxable) - MS_ZERO_BAND) * MS_RATE
const MS_EARLY_WITHDRAWAL = 40_000

describeRule('ms-early-or-excess-distribution-not-exempt', {
  readings: {
    earlyDistributionTaxedLikeOtherIncome: msTax(MS_EARLY_WITHDRAWAL - MS_DEDUCTION_SINGLE),
    exemptLikeEveryOtherRetirementDistribution: 0,
  },
  accepted: 'earlyDistributionTaxedLikeOtherIncome',
  produced: 'exemptLikeEveryOtherRetirementDistribution',
}, ({ accepted, produced }) => {
  // Fifty-eight, drawing a traditional IRA with no IRC 72(t) exception, so the
  // distribution bears the additional tax and Form 80-100's Line 46
  // instruction puts it on the taxable line.
  const scenario = input({
    state: 'MS',
    ordinaryIncome: MS_EARLY_WITHDRAWAL,
    privateRetirementIncome: MS_EARLY_WITHDRAWAL,
    agesAlive: [58],
  })

  it('exempts an early withdrawal Mississippi taxes in full', () => {
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('MS'), scenario)).toBeLessThan(accepted)
  })

  it('is not reachable through minAge, which asks a different question', () => {
    // Two independent reasons, and both matter. `retirementExclusion` reads
    // minAge against the HOUSEHOLD — if any person alive meets it the whole
    // bucket is excluded — so the same setting that prices this filer right
    // restores the exemption the moment an older spouse appears. And the
    // statutory test is the federal 72(t) additional tax rather than an age: a
    // substantially-equal-periodic-payment series bears no additional tax and
    // stays exempt at any age, which an age gate would deny. So `minAge` is a
    // different wrong rather than a smaller one.
    const aged = { ...pack('MS'), retirementPrivate: { kind: 'full' as const, minAge: 60 } }
    expect(computeStateTax(aged, scenario)).toBeCloseTo(accepted, 6)
    const withOlderSpouse = input({
      state: 'MS',
      ordinaryIncome: MS_EARLY_WITHDRAWAL,
      privateRetirementIncome: MS_EARLY_WITHDRAWAL,
      agesAlive: [58, 62],
    })
    expect(computeStateTax(aged, withOlderSpouse)).toBeCloseTo(produced, 6)
  })
})

// A Mississippi couple both 67, living on exempt pension income plus $40,000
// of investment income. 27-7-21 gives them $12,000 of personal exemption and
// $1,500 each for age.
const MS_INVESTMENT_INCOME = 40_000
const MS_EXEMPTIONS_65_PLUS_JOINT = 15_000

describeRule('ms-27-7-21-personal-and-age-65-exemptions', {
  readings: {
    twelveThousandPlusThreeSubtracted:
      msTax(MS_INVESTMENT_INCOME - MS_DEDUCTION_JOINT - MS_EXEMPTIONS_65_PLUS_JOINT),
    standardDeductionAlone: msTax(MS_INVESTMENT_INCOME - MS_DEDUCTION_JOINT),
  },
  accepted: 'twelveThousandPlusThreeSubtracted',
  produced: 'standardDeductionAlone',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'MS',
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: MS_INVESTMENT_INCOME,
    peopleAged65Plus: 2,
    agesAlive: [67, 67],
  })

  it('charges the modal Mississippi retiree 4% on $15,000 Mississippi exempts', () => {
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('MS'), scenario)).toBeGreaterThan(accepted)
    // The direction here is the OPPOSITE of the early-distribution record's,
    // and this is the household where it bites: the pension and the Social
    // Security are already outside the base, so nothing runs the other way.
    expect(computeStateTax(pack('MS'), scenario) - accepted)
      .toBeCloseTo(MS_EXEMPTIONS_65_PLUS_JOINT * MS_RATE, 6)
  })

  it('reaches the statute’s figure only by folding an exemption into the deduction field', () => {
    // Which the pack does nowhere: that slot holds a state's STANDARD
    // deduction, or for Colorado and North Dakota the federal-taxable-income
    // converter. Doing it here would make Mississippi an unmarked exception,
    // and the $3,000 age half would over-deduct for a couple under 65 exactly
    // as Indiana's would.
    const folded = {
      ...pack('MS'),
      standardDeduction: {
        single: MS_DEDUCTION_SINGLE + 7_500,
        marriedFilingJointly: MS_DEDUCTION_JOINT + MS_EXEMPTIONS_65_PLUS_JOINT,
      },
    }
    expect(computeStateTax(folded, scenario)).toBeCloseTo(accepted, 6)
  })
})

describeRule('ms-combined-return-runs-the-schedule-per-spouse', {
  readings: {
    aZeroBandInEachSpousesColumn:
      Math.max(0, MS_INVESTMENT_INCOME - MS_DEDUCTION_JOINT - 2 * MS_ZERO_BAND) * MS_RATE,
    oneZeroBandForTheReturn: msTax(MS_INVESTMENT_INCOME - MS_DEDUCTION_JOINT),
  },
  accepted: 'aZeroBandInEachSpousesColumn',
  produced: 'oneZeroBandForTheReturn',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'MS',
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: MS_INVESTMENT_INCOME,
    agesAlive: [67, 67],
  })

  it('gives a married couple one $10,000 zero band where a combined return gets two', () => {
    expect(computeStateTax(pack('MS'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('MS'), scenario)).toBeGreaterThan(accepted)
    expect(computeStateTax(pack('MS'), scenario) - accepted).toBeCloseTo(MS_ZERO_BAND * MS_RATE, 6)
  })

  it('reaches the combined figure only by doubling the band for every married couple', () => {
    // Expressible, and still wrong to ship. A single-income couple cannot use
    // the combined method at all — the department's own gloss is "(both
    // spouses work)" — so doubling the threshold would under-charge them by
    // the same $400 it over-charges a two-income couple today, and swap a
    // conservative error for a flattering one. What the pack lacks is a
    // per-spouse column, which `PerStatus<StateTaxBracket[]>` has no room for.
    const doubled = {
      ...pack('MS'),
      brackets: {
        ...pack('MS').brackets,
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 2 * MS_ZERO_BAND, ratePct: 4 }],
      },
    }
    expect(computeStateTax(doubled, scenario)).toBeCloseTo(accepted, 6)
  })
})

// ─── WS4d Batch B approximated fixtures ─────────────────────────────────────
//
// Closed-form pack math, the same construction as the PA / NY / SC pins above.
// The engine was not run. Each `produced` value is the figure
// `computeStateTax` must return given the shipped pack and the scenario;
// PRODUCED_TBD is the slot the orchestrator overwrites if a pin cannot be
// derived from the calculator's published formula. All five of these could.

const PRODUCED_TBD = -1

const MI_RATE = 0.0425
const miTax = (taxable: number) => Math.max(0, taxable) * MI_RATE
const MI_PRIVATE = 80_000
const MI_PACK_CAP = 49_423

describeRule('mi-mcl-206-30-retirement-and-ss', {
  readings: {
    // (1)(f)(iv) is "payments are made for life to a senior citizen". Fifty
    // is not a senior citizen, so the statute allows no private-pension
    // deduction at all.
    noDeductionUntilSeniorCitizen: miTax(MI_PRIVATE),
    // Pack `{ kind: 'capped', capPerPerson: 49423 }` has no minAge and no
    // senior-citizen test, so the cap is granted at any age.
    flatFortyNineThousandCapAtAnyAge: miTax(MI_PRIVATE - MI_PACK_CAP),
  },
  accepted: 'noDeductionUntilSeniorCitizen',
  produced: 'flatFortyNineThousandCapAtAnyAge',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'MI',
    ordinaryIncome: MI_PRIVATE,
    privateRetirementIncome: MI_PRIVATE,
    agesAlive: [50],
  })

  it('grants a 50-year-old the $49,423 cap a senior-citizen deduction does not', () => {
    expect(computeStateTax(pack('MI'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('MI'), scenario)).toBeLessThan(accepted)
    // Derivation the orchestrator observes: (80000 - 49423) × 4.25% = 1300.5225.
    expect(produced).not.toBe(PRODUCED_TBD)
  })

  it('reaches the statute once the cap is withheld from a non-senior', () => {
    const noCap = {
      ...pack('MI'),
      retirementPrivate: { kind: 'none' as const },
    }
    expect(computeStateTax(noCap, scenario)).toBeCloseTo(accepted, 6)
  })
})

const mnSingleTax = (taxable: number) => bandedTax(
  [
    [0, 31_690, 5.35], [31_690, 104_090, 6.8],
    [104_090, 193_240, 7.85], [193_240, Infinity, 9.85],
  ],
  taxable,
)
const MN_DEDUCTION = 14_575
const MN_ORDINARY = 50_000
const MN_SS = 40_000
const MN_SS_FEDERALLY_TAXABLE = 0.85 * MN_SS
// FAGI = 50,000 + 34,000 = 84,000. Phaseout threshold $78,000. Excess $6,000
// is two $4,000 steps counting the fraction, so the simplified subtraction
// shrinks 20%: 34,000 × 0.80 = 27,200.
const MN_SIMPLIFIED_SUBTRACTION = MN_SS_FEDERALLY_TAXABLE * 0.8

describeRule('mn-stat-290-0132-subd-26-social-security-inclusion', {
  readings: {
    simplifiedSubtractionAtThisAgi:
      mnSingleTax(MN_ORDINARY + MN_SS_FEDERALLY_TAXABLE - MN_SIMPLIFIED_SUBTRACTION - MN_DEDUCTION),
    federallyTaxableShareLeftInTheBase:
      mnSingleTax(MN_ORDINARY + MN_SS_FEDERALLY_TAXABLE - MN_DEDUCTION),
  },
  accepted: 'simplifiedSubtractionAtThisAgi',
  produced: 'federallyTaxableShareLeftInTheBase',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'MN',
    ordinaryIncome: MN_ORDINARY,
    ssBenefits: MN_SS,
    agesAlive: [70],
  })

  it('leaves the whole federally taxable share in, with no subdivision-26 subtraction', () => {
    expect(computeStateTax(pack('MN'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTaxDetail(pack('MN'), scenario).taxableIncome)
      .toBeCloseTo(MN_ORDINARY + MN_SS_FEDERALLY_TAXABLE - MN_DEDUCTION, 6)
    expect(computeStateTax(pack('MN'), scenario)).toBeGreaterThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
  })

  it('reaches the statute once the simplified subtraction is taken off the base', () => {
    // No pack field for an income-tested SS subtraction. The accepted figure
    // is priced by handing the calculator the post-subtraction ordinary, which
    // is what the missing field would compute internally.
    const preSubtracted = input({
      state: 'MN',
      ordinaryIncome: MN_ORDINARY + MN_SS_FEDERALLY_TAXABLE - MN_SIMPLIFIED_SUBTRACTION,
      ssBenefits: 0,
      agesAlive: [70],
    })
    const noSsFlag = { ...pack('MN'), taxesSocialSecurity: false }
    expect(computeStateTax(noSsFlag, preSubtracted)).toBeCloseTo(accepted, 6)
  })
})

const neSingleTax = (taxable: number) => bandedTax(
  [[0, 4130, 2.46], [4130, 24_760, 3.51], [24_760, Infinity, 4.55]],
  taxable,
)
const NE_DEDUCTION = 8850
const NE_PUBLIC = 50_000

describeRule('ne-stat-77-2716-public-pension-exemption', {
  readings: {
    // A Nebraska school-retirement annuity is neither military retirement
    // under (15)(b) nor a CSRS annuity under (20), so it stays in the base.
    closedListLeavesSchoolRetirementInTheBase: neSingleTax(NE_PUBLIC - NE_DEDUCTION),
    everyPublicPensionExempt: 0,
  },
  accepted: 'closedListLeavesSchoolRetirementInTheBase',
  produced: 'everyPublicPensionExempt',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'NE',
    ordinaryIncome: NE_PUBLIC,
    publicPensionIncome: NE_PUBLIC,
    agesAlive: [70],
  })

  it('exempts a school-retirement annuity the closed list does not name', () => {
    expect(computeStateTax(pack('NE'), scenario)).toBe(produced)
    expect(computeStateTax(pack('NE'), scenario)).toBeLessThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
  })

  it('taxes a private IRA of the same amount, which is the other bucket', () => {
    const privateIra = input({
      state: 'NE',
      ordinaryIncome: NE_PUBLIC,
      privateRetirementIncome: NE_PUBLIC,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('NE'), privateIra)).toBeCloseTo(accepted, 6)
  })

  it('reaches the statute once the public override is dropped', () => {
    const noOverride = {
      ...pack('NE'),
      retirementPublic: { kind: 'none' as const },
    }
    expect(computeStateTax(noOverride, scenario)).toBeCloseTo(accepted, 6)
  })
})

const njSingleTax = (taxable: number) => bandedTax(
  [
    [0, 20_000, 1.4], [20_000, 35_000, 1.75], [35_000, 40_000, 3.5],
    [40_000, 75_000, 5.525], [75_000, 500_000, 6.37],
  ],
  taxable,
)
const NJ_HIGH_AGI = 200_000
const NJ_PENSION = 80_000
const NJ_PACK_CAP = 50_000
const NJ_SINGLE_STATUTE_CAP = 75_000

describeRule('nj-stat-54a-6-10-retirement-income-exclusion', {
  readings: {
    // $200,000 of gross income is over the $150,000 ceiling, so the exclusion
    // is $0 even though the filer is 62 and the payments are pension.
    agiCeilingWithholdsTheExclusion: njSingleTax(NJ_HIGH_AGI),
    fiftyThousandGrantedRegardlessOfAgi: njSingleTax(NJ_HIGH_AGI - NJ_PACK_CAP),
  },
  accepted: 'agiCeilingWithholdsTheExclusion',
  produced: 'fiftyThousandGrantedRegardlessOfAgi',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'NJ',
    ordinaryIncome: NJ_HIGH_AGI,
    privateRetirementIncome: NJ_PENSION,
    agesAlive: [62],
  })

  it('grants a $50,000 subtraction to a household over the $150,000 AGI ceiling', () => {
    expect(computeStateTax(pack('NJ'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('NJ'), scenario)).toBeLessThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
  })

  it('reaches the statute once the cap is withheld', () => {
    const noCap = {
      ...pack('NJ'),
      retirementPrivate: { kind: 'none' as const },
    }
    expect(computeStateTax(noCap, scenario)).toBeCloseTo(accepted, 6)
  })

  it('under-excludes a single filer below $100,000 of income, in the other direction', () => {
    // bothDirections is not a hedge. Below the AGI ceiling a single filer is
    // allowed $75,000; the pack's per-person $50,000 leaves $25,000 in the
    // base the statute takes out.
    const underTheCeiling = input({
      state: 'NJ',
      ordinaryIncome: 80_000,
      privateRetirementIncome: 80_000,
      agesAlive: [62],
    })
    const packTax = computeStateTax(pack('NJ'), underTheCeiling)
    const statuteTax = njSingleTax(80_000 - NJ_SINGLE_STATUTE_CAP)
    expect(packTax).toBeCloseTo(njSingleTax(80_000 - NJ_PACK_CAP), 6)
    expect(packTax).toBeGreaterThan(statuteTax)
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
const MD_IRA = 80_000
const MD_PACK_CAP = 41_200

describeRule('md-tax-10-209-pension-exclusion', {
  readings: {
    // §10-209(a)(2)(i): an IRA is not an "employee retirement system", so a
    // 65-year-old's IRA distribution stays in Maryland AGI in full.
    iraStaysInTheBase: mdSingleTax(MD_IRA - MD_DEDUCTION),
    // Pack `{ kind: 'capped', capPerPerson: 41200, minAge: 65 }` cannot see
    // IRA versus 401(k), so the cap is granted on the IRA too.
    fortyOneThousandTwoHundredGrantedOnAnIra: mdSingleTax(MD_IRA - MD_PACK_CAP - MD_DEDUCTION),
  },
  accepted: 'iraStaysInTheBase',
  produced: 'fortyOneThousandTwoHundredGrantedOnAnIra',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'MD',
    ordinaryIncome: MD_IRA,
    privateRetirementIncome: MD_IRA,
    agesAlive: [65],
  })

  it('grants a 65-year-old $41,200 of IRA exclusion the statute withholds', () => {
    expect(computeStateTax(pack('MD'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('MD'), scenario)).toBeLessThan(accepted)
    // Derivation the orchestrator observes:
    // produced taxable 80,000 − 41,200 − 3,350 = 35,450 → 1,631.375
    // accepted taxable 80,000 − 3,350 = 76,650 → 3,588.375
    expect(produced).not.toBe(PRODUCED_TBD)
  })

  it('reaches the statute once the cap is withheld from the IRA', () => {
    const noCap = {
      ...pack('MD'),
      retirementPrivate: { kind: 'none' as const },
    }
    expect(computeStateTax(noCap, scenario)).toBeCloseTo(accepted, 6)
  })

  it('also withholds the cap at 64, which is the age the statute names', () => {
    const tooYoung = input({
      state: 'MD',
      ordinaryIncome: MD_IRA,
      privateRetirementIncome: MD_IRA,
      agesAlive: [64],
    })
    expect(computeStateTax(pack('MD'), tooYoung)).toBeCloseTo(accepted, 6)
  })
})

// ─── WS4d PR #334 round-1 approximation pins ────────────────────────────────
//
// Closed-form pack math. PRODUCED_TBD is the orchestrator sentinel when a pin
// cannot be derived; each of these could.

const MA_RATE = 0.05
const maTax = (taxable: number) => Math.max(0, taxable) * MA_RATE
const MA_PUBLIC = 80_000

describeRule('ma-gen-laws-ch62-s2-public-pension-exclusion', {
  readings: {
    // A noncontributory public pension that is neither Uniformed-Services
    // retirement pay nor a contributory government fund stays in the base.
    noncontributoryPublicPensionRemainsTaxable: maTax(MA_PUBLIC),
    // Pack `{ kind: 'full' }` cannot see contributory identity, so every
    // publicPensionIncome dollar is exempted.
    everyPublicPensionExempt: 0,
  },
  accepted: 'noncontributoryPublicPensionRemainsTaxable',
  produced: 'everyPublicPensionExempt',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'MA',
    ordinaryIncome: MA_PUBLIC,
    publicPensionIncome: MA_PUBLIC,
    agesAlive: [70],
  })

  it('exempts a noncontributory public pension the statute leaves in', () => {
    expect(computeStateTax(pack('MA'), scenario)).toBe(produced)
    expect(computeStateTax(pack('MA'), scenario)).toBeLessThan(accepted)
    // Derivation: produced = 0; accepted = 80,000 × 5% = 4,000.
    expect(produced).not.toBe(PRODUCED_TBD)
    expect(produced).toBe(0)
    expect(accepted).toBe(4_000)
  })

  it('taxes a private IRA of the same amount, which is the other bucket', () => {
    const privateIra = input({
      state: 'MA',
      ordinaryIncome: MA_PUBLIC,
      privateRetirementIncome: MA_PUBLIC,
      agesAlive: [70],
    })
    expect(computeStateTax(pack('MA'), privateIra)).toBeCloseTo(accepted, 6)
  })

  it('reaches the statute once the public override is dropped', () => {
    const noOverride = {
      ...pack('MA'),
      retirementPublic: { kind: 'none' as const },
    }
    expect(computeStateTax(noOverride, scenario)).toBeCloseTo(accepted, 6)
  })
})

const LA_RATE = 0.03
const LA_DEDUCTION = 12_500
const laTax = (taxable: number) => Math.max(0, taxable) * LA_RATE
const LA_RETIREMENT = 40_000
const LA_PACK_EXEMPTION = 12_000

describeRule('la-rs-47-44-1-retirement-exemption', {
  readings: {
    // Accepted reading is the indexing method itself: prior-year exemption ×
    // (1 + CPI-U increase for the previous calendar year), first adjustment
    // beginning January 1, 2026. The staged text does not publish the 2026
    // indexed dollar, so the accepted side is that method note rather than a
    // derived amount.
    cpiUIndexedFromPriorYearExemption:
      'priorYearExemption × (1 + CPI-U % increase for previous calendar year); first adjustment begins January 1, 2026; 2026 indexed dollar not in staged text',
    // Pack holds the unindexed $12,000 starting amount.
    heldForwardUnindexedTwelveThousand:
      laTax(LA_RETIREMENT - LA_PACK_EXEMPTION - LA_DEDUCTION),
  },
  accepted: 'cpiUIndexedFromPriorYearExemption',
  produced: 'heldForwardUnindexedTwelveThousand',
}, ({ accepted, produced, readings }) => {
  // `produced`/`accepted` are the readings union (string | number) because the
  // accepted side is the CPI-U method note; pin dollars through the numeric
  // reading key so toBeCloseTo stays typed.
  const heldForward = readings.heldForwardUnindexedTwelveThousand

  const scenario = input({
    state: 'LA',
    ordinaryIncome: LA_RETIREMENT,
    privateRetirementIncome: LA_RETIREMENT,
    agesAlive: [65],
  })

  it('pins the held-forward unindexed $12,000 against the CPI-U indexing method', () => {
    expect(computeStateTax(pack('LA'), scenario)).toBeCloseTo(heldForward, 6)
    expect(computeStateTaxableIncome(pack('LA'), scenario))
      .toBeCloseTo(LA_RETIREMENT - LA_PACK_EXEMPTION - LA_DEDUCTION, 6)
    expect(produced).toBe(heldForward)
    expect(produced).not.toBe(PRODUCED_TBD)
    // Derivation: (40,000 − 12,000 − 12,500) × 3% = 465.
    expect(heldForward).toBeCloseTo(465, 6)
    expect(produced).not.toBe(accepted)
    expect(typeof accepted).toBe('string')
  })

  it('withholds the exemption at 64, which is the age the statute names', () => {
    const tooYoung = input({
      state: 'LA',
      ordinaryIncome: LA_RETIREMENT,
      privateRetirementIncome: LA_RETIREMENT,
      agesAlive: [64],
    })
    expect(computeStateTax(pack('LA'), tooYoung))
      .toBeCloseTo(laTax(LA_RETIREMENT - LA_DEDUCTION), 6)
    expect(computeStateTax(pack('LA'), tooYoung)).toBeGreaterThan(heldForward)
  })
})

// ─── Alabama approximated pins (Form 40 booklet, 2026-08-28) ─────────────────
//
// Closed-form pack math — the engine was not run. PRODUCED_TBD remains the
// orchestrator sentinel; each pin below is the figure `computeStateTax` must
// return from the shipped AL pack and the scenario.

const alApproxSingleTax = (taxable: number) => bandedTax(
  [[0, 500, 2], [500, 3000, 4], [3000, Infinity, 5]],
  taxable,
)
const AL_APPROX_DEDUCTION = 3_000
const AL_PACK_CAP = 6_000
const AL_DB_PENSION = 40_000
// Chart row (Single): AGI $17,750 and above → standard deduction $2,500.
const AL_CHART_SLID_SINGLE_DEDUCTION = 2_500
const AL_HIGH_AGI = 50_000

describeRule('al-form40-defined-benefit-414j-exemption', {
  readings: {
    // Booklet: any IRC 414(j) defined-benefit payment is not reported, so the
    // Alabama base keeps none of the $40,000 and tax is zero after the
    // deduction floor — whichever employer paid it.
    bookletExemptsTheDefinedBenefitPayment: 0,
    // Pack private bucket: 40,000 − 6,000 − 3,000 = 31,000 taxable.
    // Tax: 500×2% + 2,500×4% + 28,000×5% = 10 + 100 + 1,400 = 1,510.
    packCapsThePrivateBucketAtSixThousand:
      alApproxSingleTax(AL_DB_PENSION - AL_PACK_CAP - AL_APPROX_DEDUCTION),
  },
  accepted: 'bookletExemptsTheDefinedBenefitPayment',
  produced: 'packCapsThePrivateBucketAtSixThousand',
  note: 'private-bucket defined-benefit limb',
}, ({ accepted, produced }) => {
  // The booklet's exemption keys on 414(j) plan identity; the pack keys on the
  // payment bucket, so a private-employer defined-benefit pension rides the
  // capped private bucket. The record registers only this overstating limb:
  // the staged sources do not establish taxability of non-exempt public-bucket
  // draws, so no understating oracle is asserted.
  const privateEmployerDefinedBenefit = input({
    state: 'AL',
    ordinaryIncome: AL_DB_PENSION,
    privateRetirementIncome: AL_DB_PENSION,
    agesAlive: [70],
  })

  it('taxes a private-employer 414(j) pension above the $6,000 private-bucket cap', () => {
    expect(computeStateTax(pack('AL'), privateEmployerDefinedBenefit)).toBeCloseTo(produced, 6)
    expect(produced).toBeGreaterThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
    // Derivation: (40,000 − 6,000 − 3,000) through AL 2/4/5% = 1,510.
    expect(produced).toBeCloseTo(1510, 6)
  })

  it('reaches the booklet for the private pension once that bucket is full', () => {
    const fullPrivateDefinedBenefit = {
      ...pack('AL'),
      retirementRuleShared: false,
      retirementPrivate: { kind: 'full' as const },
    }
    expect(computeStateTax(fullPrivateDefinedBenefit, privateEmployerDefinedBenefit)).toBeCloseTo(accepted, 6)
  })
})

describeRule('al-form40-standard-deduction-agi-slide', {
  readings: {
    // Page-9 Single chart: AGI $17,750 and above → $2,500 (not the $3,000 max).
    // Taxable 50,000 − 2,500 = 47,500 → tax 2,335.
    chartSlidesSingleDeductionAtHighAgi:
      alApproxSingleTax(AL_HIGH_AGI - AL_CHART_SLID_SINGLE_DEDUCTION),
    // Pack holds the $3,000 maximum flat at every AGI.
    // Taxable 50,000 − 3,000 = 47,000 → tax 2,310.
    packHoldsMaximumStandardDeductionFlat:
      alApproxSingleTax(AL_HIGH_AGI - AL_APPROX_DEDUCTION),
  },
  accepted: 'chartSlidesSingleDeductionAtHighAgi',
  produced: 'packHoldsMaximumStandardDeductionFlat',
}, ({ accepted, produced }) => {
  // Fixture AGI $50,000 is above the Single chart row "$17,750 and above"
  // ($2,500). The pack still grants the $3,000 maximum.
  const scenario = input({
    state: 'AL',
    ordinaryIncome: AL_HIGH_AGI,
    agesAlive: [50],
  })

  it('grants the $3,000 single maximum where the chart has slid to $2,500', () => {
    expect(computeStateTax(pack('AL'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('AL'), scenario)).toBeLessThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
    expect(produced).toBeCloseTo(2310, 6)
    expect(accepted).toBeCloseTo(2335, 6)
  })

  it('reaches the chart once the pack deduction is replaced with the slid amount', () => {
    const slid = {
      ...pack('AL'),
      standardDeduction: {
        single: AL_CHART_SLID_SINGLE_DEDUCTION,
        marriedFilingJointly: pack('AL').standardDeduction.marriedFilingJointly,
      },
    }
    expect(computeStateTax(slid, scenario)).toBeCloseTo(accepted, 6)
  })

  it('grants the $8,500 joint maximum where the chart row reads $5,000', () => {
    // Joint chart row "$35,500 and above" → $5,000; the pack grants $8,500.
    // Pack: banded joint tax on 50,000 − 8,500 = 41,500; chart: on 45,000.
    const joint = input({
      state: 'AL',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: AL_HIGH_AGI,
      agesAlive: [50, 50],
    })
    const alApproxJointTax = (taxable: number) => bandedTax(
      [[0, 1_000, 2], [1_000, 6_000, 4], [6_000, Infinity, 5]],
      taxable,
    )
    expect(computeStateTax(pack('AL'), joint))
      .toBeCloseTo(alApproxJointTax(AL_HIGH_AGI - 8_500), 6)
    expect(computeStateTax(pack('AL'), joint))
      .toBeLessThan(alApproxJointTax(AL_HIGH_AGI - 5_000))
  })
})

describeRule('al-form40-personal-and-dependent-exemptions-not-modeled', {
  readings: {
    // Form 40 line 13: single personal exemption $1,500 (the quotable figure).
    // Taxable 50,000 − 3,000 − 1,500 = 45,500 → tax 2,235.
    bookletSubtractsThePersonalExemption:
      alApproxSingleTax(AL_HIGH_AGI - AL_APPROX_DEDUCTION - 1_500),
    // Engine subtracts only the standard deduction: taxable 47,000 → 2,310.
    packSubtractsOnlyTheStandardDeduction:
      alApproxSingleTax(AL_HIGH_AGI - AL_APPROX_DEDUCTION),
  },
  accepted: 'bookletSubtractsThePersonalExemption',
  produced: 'packSubtractsOnlyTheStandardDeduction',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'AL',
    ordinaryIncome: AL_HIGH_AGI,
    agesAlive: [50],
  })

  it('charges tax on the exemption dollars every Alabama return subtracts', () => {
    expect(computeStateTax(pack('AL'), scenario)).toBeCloseTo(produced, 6)
    expect(produced).toBeGreaterThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
    expect(produced).toBeCloseTo(2310, 6)
    expect(accepted).toBeCloseTo(2235, 6)
  })
})

describeRule('al-dor-filing-threshold-not-modeled', {
  readings: {
    // Single AGI $3,500 sits under the quoted $4,000 applicability level, so
    // the schedule never attaches and no Alabama tax is due.
    belowThresholdOwesNothing: 0,
    // Engine: taxable 3,500 − 3,000 = 500 → 2% × 500 = 10.
    packTaxesTheRemainderOverTheDeduction:
      alApproxSingleTax(3_500 - AL_APPROX_DEDUCTION),
  },
  accepted: 'belowThresholdOwesNothing',
  produced: 'packTaxesTheRemainderOverTheDeduction',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'AL',
    ordinaryIncome: 3_500,
    agesAlive: [50],
  })

  it('charges banded tax below the quoted filing threshold', () => {
    expect(computeStateTax(pack('AL'), scenario)).toBeCloseTo(produced, 6)
    expect(produced).toBeGreaterThan(accepted)
    expect(produced).not.toBe(PRODUCED_TBD)
    expect(produced).toBeCloseTo(10, 6)
    expect(accepted).toBe(0)
  })
})
