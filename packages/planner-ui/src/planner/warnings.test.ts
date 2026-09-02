/**
 * The plausibility bands, at their edges (#495 decisions D1, D2, D3, D7 and the
 * past-year half of D4, answered 2026-09-02).
 *
 * Every expected value here is the decision's own number. The boundary cases
 * are what discriminate: the threshold itself is ordinary for every band the
 * decision worded as "beyond" or "above", and only the value past it warns.
 */
import { describe, expect, it } from 'vitest'

import { displayScaleFor } from './validationIssues'
import { bandForPath, warningFor, warnedPaths, WARNING_THRESHOLDS } from './warnings'

describe('the thresholds are the ones decided on #495', () => {
  it('holds each number the decision named', () => {
    expect(WARNING_THRESHOLDS).toEqual({
      ratePct: 30,
      growthPctMax: 50,
      growthPctMin: 0,
      sharePctMax: 100,
      amountDollars: 100_000_000,
      deductionDollars: 1_000_000,
      phaseMultiplier: 0,
    })
  })

  it('every wired path names a band, and an unknown path names none', () => {
    expect(warnedPaths().length).toBeGreaterThan(30)
    expect(bandForPath('assumptions.inflationPct')).toBe('rate30')
    expect(bandForPath('accounts.7.interestPct')).toBe('growth50')
    expect(bandForPath('assumptions.assetClassParams.usStocks.volatilityPct')).toBe('share100')
    expect(bandForPath('accounts.2.balance')).toBe('amount100m')
    expect(bandForPath('strategies.itemizedDeductions.stateAndLocalTaxes')).toBe('deduction1m')
    expect(bandForPath('expenses.phases.1.multiplier')).toBe('phaseZero')
    expect(bandForPath('expenses.oneTimeGoals.0.year')).toBe('pastYear')
    expect(bandForPath('household.people.0.retirementAge')).toBeUndefined()
  })

  it('no warned path is shown in a different unit from the one the plan stores', () => {
    // The thresholds are compared against the number typed into the field. That
    // is only sound while every warned path stores what it displays; a scaled
    // path (the brokerage qualified-dividend share) would need its threshold
    // converted the way `boundsForPath` converts the engine's bound.
    for (const path of warnedPaths()) {
      expect(displayScaleFor(path.replace(/\bN\b/g, '0')), path).toBe(1)
    }
  })
})

describe('returns, inflation and raises warn beyond ±30% (D1)', () => {
  it.each([
    'assumptions.inflationPct',
    'assumptions.defaultReturnPct',
    'assumptions.healthcareExtraInflationPct',
    'assumptions.assetClassParams.usStocks.returnPct',
    'assumptions.ssCola.annualPct',
    'accounts.3.colaPct',
    'incomes.0.realGrowthPct',
  ])('%s', (path) => {
    expect(warningFor(path, 30)).toBeNull()
    expect(warningFor(path, -30)).toBeNull()
    expect(warningFor(path, 30.1)).toBe('Outside the −30% to 30% range most plans use. Kept as entered.')
    expect(warningFor(path, -30.1)).toBe('Outside the −30% to 30% range most plans use. Kept as entered.')
    // The values the walks typed.
    expect(warningFor(path, 999)).not.toBeNull()
    expect(warningFor(path, -99)).not.toBeNull()
    expect(warningFor(path, -50)).not.toBeNull()
  })
})

describe('debt interest and cash-value growth warn above 50% or below 0 (D1)', () => {
  it.each(['accounts.9.interestPct', 'insurance.0.cashValueGrowthPct'])('%s', (path) => {
    expect(warningFor(path, 0)).toBeNull()
    expect(warningFor(path, 50)).toBeNull()
    expect(warningFor(path, 50.1)).toBe('Outside the 0% to 50% range most plans use. Kept as entered.')
    expect(warningFor(path, -0.1)).toBe('Outside the 0% to 50% range most plans use. Kept as entered.')
    expect(warningFor(path, 999)).not.toBeNull()
  })
})

describe('volatility and yields warn above 100% (D2)', () => {
  it.each([
    'assumptions.assetClassParams.bonds.volatilityPct',
    'assumptions.assetClassParams.cash.interestYieldPct',
    'assumptions.assetClassParams.intlStocks.dividendYieldPct',
    'accounts.1.interestYieldPct',
    'accounts.1.dividendYieldPct',
  ])('%s', (path) => {
    expect(warningFor(path, 100)).toBeNull()
    expect(warningFor(path, 100.1)).toBe('Above 100%, which is unusual here. Kept as entered.')
    expect(warningFor(path, 100_000)).not.toBeNull()
  })
})

describe('balances and amounts warn at or above $100 million (D3)', () => {
  it.each([
    'accounts.0.balance',
    'accounts.0.value',
    'incomes.2.annualAmount',
    'insurance.0.deathBenefit',
    'expenses.baseAnnual',
    'strategies.qcdAnnual',
  ])('%s', (path) => {
    expect(warningFor(path, 99_999_999)).toBeNull()
    // "at or above", so the threshold itself warns — unlike every other band.
    expect(warningFor(path, 100_000_000)).toBe('At or above $100 million, which is unusual. Kept as entered.')
    expect(warningFor(path, 999_999_999_999)).not.toBeNull()
  })
})

describe('deductions such as SALT warn above $1 million (D3)', () => {
  it.each([
    'strategies.itemizedDeductions.stateAndLocalTaxes',
    'strategies.itemizedDeductions.mortgageInterest',
    'strategies.itemizedDeductions.charitable',
  ])('%s', (path) => {
    expect(warningFor(path, 1_000_000)).toBeNull()
    expect(warningFor(path, 1_000_001)).toBe('Above $1 million, which is unusual for a deduction. Kept as entered.')
    expect(warningFor(path, 99_999_999)).not.toBeNull()
  })
})

describe('a spending-phase multiplier of 0 warns (D7)', () => {
  it('warns at exactly 0 and nowhere else in the engine range', () => {
    expect(warningFor('expenses.phases.0.multiplier', 0)).toBe(
      'A multiplier of 0 means this phase spends nothing. Kept as entered.',
    )
    expect(warningFor('expenses.phases.0.multiplier', 0.01)).toBeNull()
    expect(warningFor('expenses.phases.0.multiplier', 1)).toBeNull()
    expect(warningFor('expenses.phases.0.multiplier', 3)).toBeNull()
  })
})

describe("a year before the plan's start year warns (D4)", () => {
  const ctx = { startYear: 2026 }

  it.each([
    'expenses.oneTimeGoals.0.year',
    'expenses.oneTimeGoals.0.earliestYear',
    'expenses.oneTimeGoals.0.latestYear',
    'household.stateMoves.0.fromYear',
    'incomes.1.year',
    'incomes.1.startYear',
    'incomes.1.endYear',
  ])('%s', (path) => {
    expect(warningFor(path, 2026, ctx)).toBeNull()
    expect(warningFor(path, 2050, ctx)).toBeNull()
    expect(warningFor(path, 2025, ctx)).toBe("Before this plan's first year (2026). Kept as entered.")
    expect(warningFor(path, 1999, ctx)).not.toBeNull()
  })

  it('falls back to the current calendar year when no start year is given', () => {
    const thisYear = new Date().getFullYear()
    expect(warningFor('expenses.oneTimeGoals.0.year', thisYear)).toBeNull()
    expect(warningFor('expenses.oneTimeGoals.0.year', thisYear - 1)).toContain(String(thisYear))
  })

  it('leaves the calendar-year fields the decision did not list alone', () => {
    // A TIPS ladder must be BOUGHT before its first payout year, so a purchase
    // year in the past is the shape the engine requires, not a mistake.
    expect(warningFor('incomeFloor.ladders.0.purchase.year', 1999, ctx)).toBeNull()
    expect(warningFor('accounts.0.payoffYear', 1999, ctx)).toBeNull()
    expect(warningFor('accounts.0.plannedSaleYear', 1899, ctx)).toBeNull()
  })
})

describe('nothing is warned about without a value', () => {
  it('returns null for a blank field, a missing path, and a non-finite number', () => {
    expect(warningFor(undefined, 999)).toBeNull()
    expect(warningFor('assumptions.inflationPct', null)).toBeNull()
    expect(warningFor('assumptions.inflationPct', undefined)).toBeNull()
    expect(warningFor('assumptions.inflationPct', Number.NaN)).toBeNull()
    expect(warningFor('household.people.0.retirementAge', 999)).toBeNull()
  })
})
