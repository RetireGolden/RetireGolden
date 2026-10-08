/**
 * How a year split between states hands its income to each state's slice
 * (tax/statePartYear.ts), apart from any state's pricing. The rule is the
 * derivation's design note of 2026-10-07: a dated row goes whole into the
 * slice holding its date; Social Security goes by the months it is paid; the
 * rest, undated lumps and the pensions, annuities and wages the projection
 * pays for whole years, by the months; a split row scales its amounts together.
 */
import { describe, expect, it } from 'vitest'
import type { TaxYearInput } from '../projection/types.js'
import type { StateQcdEventFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { allocateSplitYear, federalAgiItems, residencySpans, spanShare, undatedIncome } from './statePartYear.js'

const year: TaxYearInput = {
  year: 2026,
  filingStatus: 'single',
  ordinaryIncome: 140_000,
  capitalGains: 6_000,
  qualifiedDividends: 2_000,
  ssBenefits: 0,
  peopleAged65Plus: 0,
  state: 'TX',
  stateResidency: [{ state: 'CA', months: 6 }, { state: 'TX', months: 6 }],
}
const [first, second] = residencySpans(year.stateResidency!)

const row = (changes: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
  accountId: 'ira',
  ownerPersonId: 'p1',
  sourceKind: 'ira',
  federallyIncludedAmount: 40_000,
  grossDistribution: 40_000,
  rothConversionAmount: 40_000,
  recipientAgeYears: 50,
  cause: 'ordinary',
  earlyDistributionDisqualifier: 'false',
  ...changes,
})

describe('residency spans', () => {
  it('numbers the months in the order the segments come, the state left first', () => {
    expect(residencySpans([{ state: 'CA', months: 6 }, { state: 'TX', months: 6 }])).toEqual([
      { state: 'CA', months: 6, first: 1, last: 6 },
      { state: 'TX', months: 6, first: 7, last: 12 },
    ])
    // A move on April 1: three months in the first state, nine in the second.
    expect(residencySpans([{ state: 'NY', months: 3 }, { state: 'FL', months: 9 }])).toEqual([
      { state: 'NY', months: 3, first: 1, last: 3 },
      { state: 'FL', months: 9, first: 4, last: 12 },
    ])
  })

  it('never runs past December, and drops an empty segment', () => {
    expect(residencySpans([{ state: 'NY', months: 9 }, { state: 'FL', months: 0 }, { state: 'NJ', months: 9 }])).toEqual([
      { state: 'NY', months: 9, first: 1, last: 9 },
      { state: 'NJ', months: 3, first: 10, last: 12 },
    ])
  })
})

describe('the share of an amount a span receives', () => {
  it('puts a dated amount whole in the span holding its month', () => {
    expect(spanShare(first!, 2026, '2026-03-15')).toBe(1)
    expect(spanShare(second!, 2026, '2026-03-15')).toBe(0)
    expect(spanShare(second!, 2026, '2026-07-01')).toBe(1)
  })

  it('spreads an undated amount, or one dated in another year, by the months', () => {
    expect(spanShare(first!, 2026, undefined)).toBe(0.5)
    expect(spanShare(first!, 2026, '2025-03-15')).toBe(0.5)
    // A malformed date is no date.
    expect(spanShare(first!, 2026, '2026-13-01')).toBe(0.5)
  })
})

describe('allocating a split year to one span', () => {
  it('moves a dated row whole, and with it the ordinary income it is part of', () => {
    // $100,000 of other ordinary income spread by months and a $40,000
    // conversion on March 15: 50,000 + 40,000 to January to June, 50,000 to
    // July to December. Gains and dividends have no date: 3,000 and 1,000 each.
    const rows = [row({ distributionDate: '2026-03-15' })]
    const early = allocateSplitYear(year, first!, rows, undefined, undefined, 0)
    const late = allocateSplitYear(year, second!, rows, undefined, undefined, 0)
    expect(early.input.ordinaryIncome).toBe(90_000)
    expect(late.input.ordinaryIncome).toBe(50_000)
    expect(early.input.capitalGains).toBe(3_000)
    expect(early.input.qualifiedDividends).toBe(1_000)
    expect(early.rows).toEqual(rows)
    expect(late.rows).toEqual([])
    // Federal AGI items: 90,000 + 1,000 + 3,000; 50,000 + 1,000 + 3,000.
    expect(early.federalAgiItems).toBe(94_000)
    expect(late.federalAgiItems).toBe(54_000)
    expect(early.retirementShare).toBe(1)
    expect(late.retirementShare).toBe(0)
    expect(early.input.state).toBe('CA')
    expect(early.input.stateResidency).toBeUndefined()
  })

  it('splits an undated row by the months, scaling its amounts together and keeping its identity', () => {
    const undated = row({ grossDistribution: 50_000, rothConversionAmountAtAge59HalfOrOlder: 10_000, taxableSocialSecurityAllocated: 600, knownPreviouslyTaxedBasis: 5_000 })
    const slice = allocateSplitYear(year, first!, [undated], undefined, undefined, 0)
    expect(slice.rows).toEqual([{
      ...undated,
      federallyIncludedAmount: 20_000,
      grossDistribution: 25_000,
      rothConversionAmount: 20_000,
      rothConversionAmountAtAge59HalfOrOlder: 5_000,
      taxableSocialSecurityAllocated: 300,
    }])
    // The opening basis is the account's, not the row's: never split.
    expect(slice.rows![0]!.knownPreviouslyTaxedBasis).toBe(5_000)
    expect(slice.input.ordinaryIncome).toBe(70_000)
    expect(slice.retirementShare).toBe(0.5)
  })

  it('places a QCD transfer by its date, and splits an undated one', () => {
    const qcd = (transferDate?: string): StateQcdEventFacts => ({
      eventId: 'q', accountId: 'ira', ownerPersonId: 'p1', grossIraDistribution: 10_000, directCharityTransfer: 10_000,
      federalExcludedAmount: 10_000, federalTaxableAmount: 0, federalBasisAllocated: 0, residency: 'partYear', splitInterest: false,
      directTransfer: true, ...(transferDate === undefined ? {} : { transferDate }),
    })
    expect(allocateSplitYear(year, second!, undefined, [qcd('2026-11-02')], undefined, 0).qcdEvents).toEqual([qcd('2026-11-02')])
    expect(allocateSplitYear(year, first!, undefined, [qcd('2026-11-02')], undefined, 0).qcdEvents).toEqual([])
    expect(allocateSplitYear(year, first!, undefined, [qcd()], undefined, 0).qcdEvents).toEqual([{
      ...qcd(), grossIraDistribution: 5_000, directCharityTransfer: 5_000, federalExcludedAmount: 5_000,
    }])
  })

  it('gives Social Security by the months each recipient is paid', () => {
    // One recipient's $12,000 paid July to December (six months), the other's
    // $24,000 all year. January to June: 0 + 24,000 x 6/12 = 12,000 of 36,000,
    // a third. July to December: 12,000 + 12,000 = 24,000, two thirds.
    const ss: TaxYearInput = { ...year, ssBenefits: 36_000 }
    const facts = { recipientSocialSecurity: [
      { ownerPersonId: 'p1', grossSocialSecurity: 12_000, grossRailroadTier1: 0, paidMonths: 6 },
      { ownerPersonId: 'p2', grossSocialSecurity: 24_000, grossRailroadTier1: 0 },
    ] }
    const early = allocateSplitYear(ss, first!, undefined, undefined, facts, 9_000)
    const late = allocateSplitYear(ss, second!, undefined, undefined, facts, 9_000)
    expect(early.input.ssBenefits).toBeCloseTo(12_000, 9)
    expect(late.input.ssBenefits).toBeCloseTo(24_000, 9)
    // The year's taxable Social Security, $9,000, in the same proportion.
    expect(early.taxableSocialSecurity).toBeCloseTo(3_000, 9)
    expect(late.taxableSocialSecurity).toBeCloseTo(6_000, 9)
  })

  it('spreads Social Security by the months when no recipient names paid months', () => {
    const ss: TaxYearInput = { ...year, ssBenefits: 20_000 }
    expect(allocateSplitYear(ss, first!, undefined, undefined, undefined, 8_000).taxableSocialSecurity).toBe(4_000)
  })
})

describe('the income spread by months', () => {
  it('is the year federal AGI items before Social Security, less the dated rows', () => {
    // 140,000 + 2,000 + 6,000, less the $40,000 dated in March.
    expect(undatedIncome(year, [row({ distributionDate: '2026-03-15' })])).toBe(108_000)
    expect(undatedIncome(year, [row()])).toBe(148_000)
    expect(federalAgiItems(year, 5_000)).toBe(153_000)
  })
})
