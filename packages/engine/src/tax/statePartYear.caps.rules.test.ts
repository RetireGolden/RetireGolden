/**
 * Retirement-exclusion caps in a part year (`StateTaxParams.partYear.exclusionCap`),
 * the basis pools committed once a year, and what still marks a split year
 * incomplete. Until 2026-10-08 the characterized rows never reached a slice,
 * and every cap was prorated by the months.
 *
 * The cap policies, from the derivation's cap table of 2026-10-07:
 * - `full`: the whole cap for the receipts of the resident period (New York's
 *   $20,000 "for each of your taxable periods"; Kentucky's Schedule P, on the
 *   pension income received while a resident);
 * - `retirementShare`: the cap times the share of the year's retirement income
 *   received while resident (Delaware's Column B);
 * - `incomeRatio`: the cap times the income ratio (Wisconsin's 67+ subtraction);
 * - `viaTaxRatio`: the exclusion stays in the full-year tax the ratio dilutes,
 *   and the ratio is on income the exclusion does not reduce (West Virginia);
 * - left out: the year's exclusion by the months, as `months` does, and the
 *   year is incomplete only where the whole cap on the slice's own receipts
 *   would give the slice a different income (Arkansas, Colorado, Rhode Island
 *   and Missouri, whose returns do not say).
 *
 * Each household is resident six months in the state and six in Texas. Before
 * 2026-10-08 the slice was the months share of the year on the coarse inputs,
 * without the rows: New York 2,134.875, Delaware 2,024.50, Wisconsin
 * 1,638.7084, West Virginia 1,433.25 and Kentucky 932.40 for the households
 * below, each without its exclusion.
 */
import { describe, expect, it } from 'vitest'
import type { TaxYearInput } from '../projection/types.js'
import { knownMoney, type StateHsaAccountYearFacts, type StateQcdEventFacts, type StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { computeStateTaxYearResult } from './stateTax.js'

function sixMonths(state: string, changes: Partial<TaxYearInput>): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state,
    stateResidency: [{ state, months: 6 }, { state: 'TX', months: 6 }],
    ...changes,
  }
}

const retirement = (changes: Partial<StateRetirementDistributionFact>): StateRetirementDistributionFact => ({
  accountId: 'pension', ownerPersonId: 'p1', sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: 0,
  recipientAgeYears: 62, recipientAgeKnown: true, cause: 'ordinary', earlyDistributionDisqualifier: 'false',
  ...changes,
})

describe('a capped exclusion in a part year', () => {
  it('New York (full): the whole $20,000 for the resident period’s pension', () => {
    // 62, a $30,000 pension and $60,000 of other income, both spread over the
    // year. IT-203: the base tax as a full-year resident on New York AGI after
    // the exclusion, 90,000 - 20,000 = 70,000; 62,000 taxable: 331.50 + 140.80
    // + 113.30 + 48,100 x 5.4% = 2,597.40; 3,183. Line 45, New York column over
    // federal column, both after the exclusion: the resident period's 45,000
    // less the whole cap on its $15,000 of pension, 30,000, over 70,000: 3/7.
    // 3,183 x 3/7 = 1,364.142857. With the cap prorated by months the
    // numerator would be 35,000 and the tax 1,591.50.
    const result = computeStateTaxYearResult(sixMonths('NY', { ordinaryIncome: 90_000, agesAlive: [62] }), {
      retirementDistributions: [retirement({ federallyIncludedAmount: 30_000 })],
    })
    expect(result.totalTax).toBeCloseTo(1_364.142857, 5)
    expect(result.partYear?.slices[0]?.incomeRatio).toBeCloseTo(3 / 7, 12)
    expect(result.status).toBe('complete')
  })

  it('Delaware (retirementShare): the cap times the share of the retirement income received while resident', () => {
    // 62: a $20,000 pension spread over the year and a $10,000 IRA
    // distribution on March 1, both in the $12,500 exclusion at 60 or older,
    // and $50,000 of other income. PIT-NON: the tax on all income, 80,000 -
    // 12,500 = 67,500 of Delaware AGI; 64,250 taxable: 66 + 195 + 480 + 260 +
    // 1,942.50 + 4,250 x 6.6% = 280.50; 3,224. Line 43, Delaware-source income
    // after its exclusion: the resident period received 10,000 + 10,000 of the
    // 30,000 of retirement income, two thirds, so its exclusion is 12,500 x 2/3
    // = 8,333.33; 45,000 - 8,333.33 = 36,666.67 over 67,500 = 0.543210.
    // 3,224 x 36,666.67 / 67,500 = 1,751.31. The whole cap would give
    // 1,552.30, the months 1,850.81.
    const result = computeStateTaxYearResult(sixMonths('DE', { ordinaryIncome: 80_000, agesAlive: [62] }), {
      retirementDistributions: [
        retirement({ federallyIncludedAmount: 20_000 }),
        retirement({ accountId: 'ira', sourceKind: 'ira', federallyIncludedAmount: 10_000, distributionDate: '2026-03-01' }),
      ],
    })
    expect(result.totalTax).toBeCloseTo(3_224 * (36_666.666667 / 67_500), 4)
  })

  it('Wisconsin (incomeRatio): the 67+ subtraction times the ratio, over federal income', () => {
    // 68: a $40,000 pension and $40,000 of other income. 1NPR: the sliding
    // deduction on the year's $80,000, 13,960 - 0.12 x 59,880 = 6,774.40; the
    // subtraction, $24,000; 49,225.60 taxable: 528.85 + 34,115.60 x 4.4% =
    // 1,501.0864; 2,029.9364. Line 32, Wisconsin income over federal income:
    // 40,000 less the subtraction times the ratio, 24,000 x 1/2 = 12,000, is
    // 28,000, over 80,000: 0.35. 2,029.9364 x 0.35 = 710.47774. The whole cap
    // would give 20,000 / 80,000 and 507.4841.
    const result = computeStateTaxYearResult(sixMonths('WI', { ordinaryIncome: 80_000, agesAlive: [68], peopleAged65Plus: 1 }), {
      retirementDistributions: [retirement({ federallyIncludedAmount: 40_000, recipientAgeYears: 68 })],
    })
    expect(result.totalTax).toBeCloseTo(710.47774, 5)
  })

  it('West Virginia (viaTaxRatio): the exclusion in the full-year tax, the ratio on unreduced federal AGI', () => {
    // 66: a $30,000 pension and $50,000 of other income. The 11-21-12(c)(9)
    // modification at 65, $8,000 of the owner's remaining federal AGI income
    // (no earlier named modification). IT-140: the tax on 80,000 - 8,000 =
    // 72,000: 211 + 421.50 + 474 + 844 + 12,000 x 4.58% =
    // 549.60; 2,500.10. Schedule A: West Virginia income over federal AGI,
    // neither reduced, 40,000 / 80,000: 1,250.05.
    const result = computeStateTaxYearResult(sixMonths('WV', { ordinaryIncome: 80_000, agesAlive: [66], peopleAged65Plus: 1 }), {
      retirementDistributions: [retirement({ federallyIncludedAmount: 30_000, recipientAgeYears: 66 })],
      householdFacts: { ownerStateTaxFacts: [{ ownerPersonId: 'p1', westVirginiaEligibleAge65OrDisabled: true, westVirginiaRemainingFederalAgiIncome: 80_000, westVirginiaPriorNamedModifications: 0 }] },
    })
    expect(result.totalTax).toBeCloseTo(1_250.05, 6)
  })

  it('Kentucky (full): the whole $31,110 for the pension income received while resident', () => {
    // 66, a $40,000 pension spread over the year and $20,000 of other income.
    // 2025 Schedule P: a Form 740-NP filer reports only the pension income
    // received while a Kentucky resident, here 20,000, and Part III line 3
    // excludes the lesser of it and $31,110. (30,000 - 3,360 - 20,000) x 3.5%
    // = 232.40. The cap by the months, 15,555, would give 387.975.
    const result = computeStateTaxYearResult(sixMonths('KY', { ordinaryIncome: 60_000, agesAlive: [66], peopleAged65Plus: 1 }), {
      retirementDistributions: [retirement({ federallyIncludedAmount: 40_000, recipientAgeYears: 66 })],
    })
    expect(result.totalTax).toBeCloseTo(232.4, 6)
    expect(result.status).toBe('complete')
  })
})

describe('what still marks a split year incomplete', () => {
  // Arkansas, a single filer of 62 with $50,000 of income, part of it a
  // pension, all spread over the year. Arkansas's return does not say how
  // its $6,000 exemption applies to a part year, so the slice takes the
  // year's exemption times 6/12; the other reading is the whole $6,000 on the
  // slice's own receipts. AR1000NR: the tax on the year's income as if
  // resident, times Arkansas income over all income, both after the
  // exemption. 2026 brackets: 2% from 5,600, 3% from 11,200, 3.4% from 16,000,
  // 3.7% from 26,400 (112 + 144 + 353.60 below 26,400); deduction 2,470.
  const arkansas = (pension: number) => computeStateTaxYearResult(
    sixMonths('AR', { ordinaryIncome: 50_000, agesAlive: [62] }),
    { retirementDistributions: [retirement({ federallyIncludedAmount: pension })], qcdEvents: [] },
  )

  it('Arkansas: the readings agree while the slice’s pension is within the months’ share of the cap', () => {
    // A $4,000 pension: the year excludes 4,000; the slice receives 2,000, and
    // 4,000 x 6/12 = 2,000 either way. 46,000 - 2,470 = 43,530: 609.60 +
    // 17,130 x 3.7% = 633.81; 1,243.41, times 23,000 / 46,000: 621.705.
    const result = arkansas(4_000)
    expect(result.totalTax).toBeCloseTo(621.705, 6)
    expect(result.status).toBe('complete')
  })

  it('Arkansas: the readings differ once the slice’s pension exceeds the months’ share of the cap, and the year says so', () => {
    // A $10,000 pension: the year excludes 6,000; the slice receives 5,000,
    // more than 6,000 x 6/12 = 3,000. 44,000 - 2,470 = 41,530: 609.60 + 15,130
    // x 3.7% = 559.81; 1,169.41. The months reading, 25,000 - 3,000 = 22,000
    // over 44,000: 584.705. The whole cap would take 25,000 - 5,000 = 20,000,
    // and 531.55.
    const result = arkansas(10_000)
    expect(result.totalTax).toBeCloseTo(584.705, 6)
    expect(result.status).toBe('incomplete')
    const warning = result.warnings.find((w) => w.code === 'state-rich-split-year-adapter-required')
    expect(warning?.missingFacts).toEqual(['partYearExclusionCap'])
    expect(warning?.message).toContain('AR')
  })

  it('California and New Jersey: a slice that needs HSA facts of a state other than the year-end state', () => {
    // The year's HSA facts are the year-end state's (the projection's
    // residence state). A California slice before a move to Texas would need
    // California's own; the year is marked incomplete. With California the
    // year-end state, or no HSA activity, nothing is missing.
    const hsa: StateHsaAccountYearFacts = {
      accountId: 'hsa', ownerPersonId: 'p1', federalHsaDeduction: knownMoney(3_000),
      employerContributionExcludedFederally: knownMoney(0), employerContributionAlreadyInStateWages: knownMoney(0),
      interest: knownMoney(200), dividends: knownMoney(0), realizedGains: knownMoney(0),
      unrealizedAppreciation: knownMoney(0), qualifiedCashWithdrawals: knownMoney(0),
      nonqualifiedDistributionFederalAmount: knownMoney(0), nonqualifiedCashWithdrawals: knownMoney(0),
      stateBasisBeforeYear: knownMoney(10_000), annualActivityComplete: true,
    }
    const year = (first: string, last: string, hsaAccounts: StateHsaAccountYearFacts[]) => computeStateTaxYearResult({
      ...sixMonths(first, { ordinaryIncome: 100_000 }),
      state: last,
      stateResidency: [{ state: first, months: 6 }, { state: last, months: 6 }],
    }, { hsaAccounts, qcdEvents: [] })
    const before = year('CA', 'TX', [hsa])
    expect(before.status).toBe('incomplete')
    expect(before.warnings.filter((w) => w.missingFacts.includes('stateHsaAccountYearFacts')).map((w) => w.message)).toEqual([
      "CA's slice prices HSA income on the year's HSA facts, which are those of TX; CA's own are not supplied.",
    ])
    expect(year('NJ', 'TX', [hsa]).warnings.some((w) => w.missingFacts.includes('stateHsaAccountYearFacts'))).toBe(true)
    expect(year('TX', 'CA', [hsa]).status).toBe('complete')
    expect(year('CA', 'TX', []).status).toBe('complete')
  })

  it('a state with no published parameters: its months are not priced, and the year says so', () => {
    // As the annual path does for a state without a pack.
    const result = computeStateTaxYearResult({
      ...sixMonths('NY', { ordinaryIncome: 100_000 }),
      stateResidency: [{ state: 'ZZ', months: 6 }, { state: 'NY', months: 6 }],
    }, { qcdEvents: [] })
    expect(result.status).toBe('incomplete')
    expect(result.warnings.find((w) => w.code === 'state-pack-unavailable')).toEqual({
      code: 'state-pack-unavailable',
      message: 'No published state parameter set is available for ZZ tax year 2026: its 6 months are not priced.',
      missingFacts: ['stateTaxPack'],
    })
    expect(result.partYear?.slices.map((slice) => slice.state)).toEqual(['NY'])
  })

  it('a residency that leaves months out: income in them is taxed by no state, and the year says so', () => {
    // Four months in New York and four in Texas: a distribution dated
    // November falls in neither. The projection's segments always cover the
    // year; a host-built residency may not.
    const short = computeStateTaxYearResult({
      ...sixMonths('NY', { ordinaryIncome: 90_000, agesAlive: [50] }),
      stateResidency: [{ state: 'NY', months: 4 }, { state: 'TX', months: 4 }],
    }, {
      retirementDistributions: [retirement({ accountId: 'ira', sourceKind: 'ira', federallyIncludedAmount: 30_000, recipientAgeYears: 50, distributionDate: '2026-11-15' })],
      qcdEvents: [],
    })
    expect(short.status).toBe('incomplete')
    expect(short.warnings.filter((w) => w.missingFacts.includes('stateResidency')).map((w) => w.message)).toEqual([
      "The year's residency covers 8 of its 12 months; income dated in, or spread by months to, the months it leaves out is taxed by no state.",
    ])
    const long = computeStateTaxYearResult({
      ...sixMonths('NY', { ordinaryIncome: 90_000 }),
      stateResidency: [{ state: 'NY', months: 8 }, { state: 'TX', months: 8 }],
    }, { qcdEvents: [] })
    expect(long.status).toBe('incomplete')
    expect(long.warnings.some((w) => w.message === "The year's residency segments give 16 months; the segments past December are cut to fit the year.")).toBe(true)
  })

  it('a state named in two segments: priced in each, its pools committed once, and the year says so', () => {
    // Massachusetts three months, Texas six, Massachusetts three again, with
    // a pension of $8,000 spread over the year and $6,000 of basis already
    // taxed. Each Massachusetts segment receives $2,000; one pool is
    // committed, from the first, consuming its 2,000.
    const result = computeStateTaxYearResult({
      ...sixMonths('MA', { ordinaryIncome: 8_000, agesAlive: [62] }),
      stateResidency: [{ state: 'MA', months: 3 }, { state: 'TX', months: 6 }, { state: 'MA', months: 3 }],
    }, { retirementDistributions: [retirement({ federallyIncludedAmount: 8_000, knownPreviouslyTaxedBasis: 6_000 })], qcdEvents: [] })
    expect(result.status).toBe('incomplete')
    expect(result.warnings.filter((w) => w.missingFacts.includes('stateResidency')).map((w) => w.message)).toEqual([
      "MA appears in two of the year's residency segments: each is priced as its own part year, and its basis pools are committed from the first only.",
    ])
    expect(result.partYear?.slices.map((slice) => [slice.state, slice.months])).toEqual([['MA', 3], ['TX', 6], ['MA', 3]])
    expect(result.pensionBasisPools).toEqual([{
      state: 'MA', accountId: 'pension', ownerPersonId: 'p1', kind: 'pension', status: 'complete',
      openingBasis: 6_000, basisConsumed: 2_000, closingBasis: 4_000,
    }])
  })

  it('a QCD in a split year: the year is incomplete and no state QCD adjustment is applied', () => {
    // A $10,000 direct QCD, in New York's months or in Texas's. The state
    // QCD rules are written for a full-year resident; a part-year resident's
    // QCD is marked, not priced, wherever it falls.
    const qcd = (transferDate: string): StateQcdEventFacts => ({
      eventId: 'qcd', accountId: 'ira', ownerPersonId: 'p1', grossIraDistribution: 10_000,
      directCharityTransfer: 10_000, federalExcludedAmount: 10_000, federalTaxableAmount: 0,
      federalBasisAllocated: 0, residency: 'fullYearResident', splitInterest: false, directTransfer: true, transferDate,
    })
    const year = (qcdEvents: StateQcdEventFacts[]) => computeStateTaxYearResult(
      sixMonths('NY', { ordinaryIncome: 100_000, agesAlive: [75], peopleAged65Plus: 1 }),
      { retirementDistributions: [], qcdEvents },
    )
    const none = year([])
    expect(none.status).toBe('complete')
    for (const date of ['2026-03-15', '2026-09-15']) {
      const result = year([qcd(date)])
      expect(result.status).toBe('incomplete')
      expect(result.warnings.some((w) => w.code === 'state-qcd-residency-incomplete')).toBe(true)
      expect(result.totalTax).toBeCloseTo(none.totalTax, 6)
    }
  })

  it('a state whose parameters carry no part-year method: the months share, marked incomplete', () => {
    // New York's parameters with the method taken away: every amount and
    // bracket edge times 6/12 on half the income, the months share of the
    // full-year tax on $100,000, 4,859.75 / 2 = 2,429.875.
    const result = computeStateTaxYearResult(sixMonths('NY', { ordinaryIncome: 100_000 }), {
      mapParams: (params) => ({ ...params, partYear: undefined }),
    })
    expect(result.totalTax).toBeCloseTo(2_429.875, 6)
    expect(result.warnings.map((w) => w.code)).toEqual(['state-rich-split-year-adapter-required'])
    expect(result.partYear?.slices[0]?.method).toBe('monthsShare')
  })

  it('a fully priced split year carries no split-year code', () => {
    const result = computeStateTaxYearResult(sixMonths('NC', { ordinaryIncome: 100_000 }))
    expect(result.status).toBe('complete')
    expect(result.partYear).toEqual({
      slices: [
        // D-401: (100,000 - 12,750) x 3.99% = 3,481.275, times 50,000 / 100,000.
        { state: 'NC', months: 6, method: 'incomePercentage', incomeRatio: 0.5, totalTax: expect.closeTo(1_740.6375, 6) },
        { state: 'TX', months: 6, method: 'noIncomeTax', totalTax: 0 },
      ],
      undatedIncomeSpreadByMonths: 100_000,
    })
  })
})

describe('basis pools, committed once a year', () => {
  it('a Massachusetts pension pool consumes basis on the Massachusetts months’ receipts only', () => {
    // Utah six months, Massachusetts six: an $8,000 pension spread over the
    // year with $6,000 of contributions already taxed. Massachusetts's pool
    // meets its $4,000: opening 6,000, consumed 4,000, closing 2,000. Utah's
    // pool is for 401(a) plans, which this is not. Until 2026-10-08 a split
    // year committed no pool.
    const result = computeStateTaxYearResult({
      ...sixMonths('UT', { ordinaryIncome: 8_000, agesAlive: [62] }),
      stateResidency: [{ state: 'UT', months: 6 }, { state: 'MA', months: 6 }],
    }, { retirementDistributions: [retirement({ federallyIncludedAmount: 8_000, knownPreviouslyTaxedBasis: 6_000 })] })
    expect(result.pensionBasisPools).toEqual([{
      state: 'MA', accountId: 'pension', ownerPersonId: 'p1', kind: 'pension', status: 'complete',
      openingBasis: 6_000, basisConsumed: 4_000, closingBasis: 2_000,
    }])
  })
})
