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
 * North Dakota's and Arizona's public-pension entries, Arkansas's age gate and
 * Arizona's gain subtraction all under-charge — three of them because closing a
 * real gap with a flag coarser than the statute opened a smaller one facing the
 * other way. The rest over-charge. An under-charge is the dangerous direction
 * and is registered for exactly that reason: a correction that quietly
 * introduces one is worse than the overstatement it replaced if nobody can see
 * it.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import { stateParamsFor } from '../../params/state/index.js'
import type { StateTaxParams } from '../../params/state/types.js'
import type { TaxYearInput } from '../../projection/types.js'
import { computeStateTax } from '../../tax/stateTax.js'

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
