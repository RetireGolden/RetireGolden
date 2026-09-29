/**
 * The plausibility bands, at their edges (#495 decisions D1, D2, D3, D7 and the
 * past-year half of D4, answered 2026-09-02).
 *
 * Every expected value here is the decision's own number. The boundary cases
 * are what discriminate: the threshold itself is ordinary for every band the
 * decision worded as "beyond" or "above", and only the value past it warns.
 */
import { describe, expect, it } from 'vitest'

import { WILDCARD, wiredFieldPaths } from '../testSupport/wiredFieldPaths'
import { boundsKey } from './schemaBounds'
import { displayScaleFor } from './validationIssues'
import { bandForPath, warningContextFor, warningFor, warnedPaths, WARNING_THRESHOLDS } from './warnings'


/** No plan in context (the import wizard, the lever editors): no first year. */
const NO_PLAN = { startYear: null }

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

  it('every band entry names a path a field is actually wired to', () => {
    // A band entry for a control that passes no `path` prop is dead: the field
    // renders, the value stores, and the note never appears (review r1-3). The
    // scanner is the same one the bounds drift guard uses, so the two suites
    // agree on what "wired" means.
    const wired = wiredFieldPaths().map((path) => boundsKey(path).split('.'))
    const isWired = (path: string): boolean => {
      const want = path.split('.')
      return wired.some(
        (got) => got.length === want.length && got.every((segment, i) => segment === WILDCARD || segment === want[i]),
      )
    }
    for (const path of warnedPaths()) expect(isWired(path), `${path} has no field wired to it`).toBe(true)
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
    expect(warningFor(path, 30, NO_PLAN)).toBeNull()
    expect(warningFor(path, -30, NO_PLAN)).toBeNull()
    expect(warningFor(path, 30.1, NO_PLAN)).toBe('Outside the −30% to 30% range most plans use. Kept as entered.')
    expect(warningFor(path, -30.1, NO_PLAN)).toBe('Outside the −30% to 30% range most plans use. Kept as entered.')
    // The values the walks typed.
    expect(warningFor(path, 999, NO_PLAN)).not.toBeNull()
    expect(warningFor(path, -99, NO_PLAN)).not.toBeNull()
    expect(warningFor(path, -50, NO_PLAN)).not.toBeNull()
  })
})

describe('debt interest and cash-value growth warn above 50% or below 0 (D1)', () => {
  it.each(['accounts.9.interestPct', 'insurance.0.cashValueGrowthPct'])('%s', (path) => {
    expect(warningFor(path, 0, NO_PLAN)).toBeNull()
    expect(warningFor(path, 50, NO_PLAN)).toBeNull()
    expect(warningFor(path, 50.1, NO_PLAN)).toBe('Outside the 0% to 50% range most plans use. Kept as entered.')
    expect(warningFor(path, -0.1, NO_PLAN)).toBe('Outside the 0% to 50% range most plans use. Kept as entered.')
    expect(warningFor(path, 999, NO_PLAN)).not.toBeNull()
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
    expect(warningFor(path, 100, NO_PLAN)).toBeNull()
    expect(warningFor(path, 100.1, NO_PLAN)).toBe('Above 100%, which is unusual here. Kept as entered.')
    expect(warningFor(path, 100_000, NO_PLAN)).not.toBeNull()
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
    expect(warningFor(path, 99_999_999, NO_PLAN)).toBeNull()
    // "at or above", so the threshold itself warns — unlike every other band.
    expect(warningFor(path, 100_000_000, NO_PLAN)).toBe('At or above $100 million, which is unusual. Kept as entered.')
    expect(warningFor(path, 999_999_999_999, NO_PLAN)).not.toBeNull()
  })
})

describe('deductions such as SALT warn above $1 million (D3)', () => {
  it.each([
    'strategies.itemizedDeductions.stateAndLocalTaxes',
    'strategies.itemizedDeductions.mortgageInterest',
    'strategies.itemizedDeductions.charitable',
  ])('%s', (path) => {
    expect(warningFor(path, 1_000_000, NO_PLAN)).toBeNull()
    expect(warningFor(path, 1_000_001, NO_PLAN)).toBe('Above $1 million, which is unusual for a deduction. Kept as entered.')
    expect(warningFor(path, 99_999_999, NO_PLAN)).not.toBeNull()
  })
})

describe('a spending-phase multiplier of 0 warns (D7)', () => {
  it('warns at exactly 0 and nowhere else in the engine range', () => {
    expect(warningFor('expenses.phases.0.multiplier', 0, NO_PLAN)).toBe(
      'A multiplier of 0 means this phase spends nothing. Kept as entered.',
    )
    expect(warningFor('expenses.phases.0.multiplier', 0.01, NO_PLAN)).toBeNull()
    expect(warningFor('expenses.phases.0.multiplier', 1, NO_PLAN)).toBeNull()
    expect(warningFor('expenses.phases.0.multiplier', 3, NO_PLAN)).toBeNull()
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

  it('reads no clock: with no plan in context there is no first year, so nothing is before it', () => {
    // D-2027-ROLLOVER: the note used to fall back to the clock's year, which is
    // not an example's first year. The fields read the plan's start year
    // (`fields.tsx#usePlanWarningContext`); outside a plan (the import wizard,
    // the lever editors) there is none.
    expect(warningFor('expenses.oneTimeGoals.0.year', 1999, NO_PLAN)).toBeNull()
    expect(warningFor('accounts.0.purchase.year', 1999, NO_PLAN)).toBeNull()
  })

  it('an example reads its own first year, not the clock', () => {
    // A library example starts in EXAMPLE_FIXED_YEAR whatever the clock says,
    // so its 2026 events carry no note in 2027.
    expect(warningFor('expenses.oneTimeGoals.0.year', 2026, { startYear: 2026 })).toBeNull()
    expect(warningFor('expenses.oneTimeGoals.0.year', 2026, { startYear: 2027 })).toBe(
      "Before this plan's first year (2027). Kept as entered.",
    )
  })

  it('an unelected pension offer dated before the first year is kept, with the plain note', () => {
    expect(warningFor('accounts.2.lumpSumOffer.electionYear', 2026, ctx)).toBeNull()
    expect(warningFor('accounts.2.lumpSumOffer.electionYear', 2025, ctx)).toBe(
      "Before this plan's first year (2026). Kept as entered.",
    )
  })

  it.each(['accounts.1.purchase.year', 'incomeFloor.ladders.0.purchase.year'])(
    'a purchase dated before the first year is named as already paid: %s',
    (path) => {
      // The engine treats a purchase dated before the projection start as
      // already funded (projection/simulate.ts), so the premium or ladder cost
      // is not taken from the funding account. A TIPS ladder must be bought
      // before its first PAYOUT year; that is a different year from the plan's
      // first year, and a purchase in the plan's first year or later carries no
      // note.
      expect(warningFor(path, 2026, ctx)).toBeNull()
      expect(warningFor(path, 2030, ctx)).toBeNull()
      expect(warningFor(path, 2025, ctx)).toBe(
        "Before this plan's first year (2026), so the purchase is treated as already paid: its cost is not taken from the funding account. If that balance still includes it, lower the balance. Kept as entered.",
      )
    },
  )

  it('a Roth conversion window that opened before the first year says where it starts instead', () => {
    expect(warningFor('strategies.rothConversion.startYear', 2026, ctx)).toBeNull()
    expect(warningFor('strategies.rothConversion.startYear', 2024, ctx)).toBe(
      "Before this plan's first year (2026), so conversions run from 2026. Kept as entered.",
    )
  })

  it('a HECM line dated to open before the first year says it opens in the first year', () => {
    expect(warningFor('accounts.2.hecm.openYear', 2026, ctx)).toBeNull()
    expect(warningFor('accounts.2.hecm.openYear', 2025, ctx)).toBe(
      "Before this plan's first year (2026), so the line is modeled as opening in 2026. Kept as entered.",
    )
  })

  it('a Roth window that ended before the first year says it converts nothing (review L1)', () => {
    const ended = { ...ctx, rothWindowEndYear: 2025 }
    expect(warningFor('strategies.rothConversion.startYear', 2024, ended)).toBe(
      "Before this plan's first year (2026), and the window ends in 2025, so no conversion runs. Kept as entered.",
    )
    expect(warningFor('strategies.rothConversion.endYear', 2025, ended)).toBe(
      "Before this plan's first year (2026), so no conversion runs in this window. Kept as entered.",
    )
    // Still open: the start note says where conversions now start.
    expect(warningFor('strategies.rothConversion.startYear', 2024, { ...ctx, rothWindowEndYear: 2028 })).toBe(
      "Before this plan's first year (2026), so conversions run from 2026. Kept as entered.",
    )
    expect(warningFor('strategies.rothConversion.endYear', 2026, ended)).toBeNull()
    expect(warningContextFor(null, 2026)).toEqual({ startYear: 2026, rothWindowEndYear: null })
    expect(
      warningContextFor(
        { strategies: { rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2024, endYear: 2025 } } } as never,
        2026,
      ),
    ).toEqual({ startYear: 2026, rothWindowEndYear: 2025 })
  })

  it('a sale, a payoff or a conversion row dated before the first year says what the plan does (review H1, L4)', () => {
    expect(warningFor('accounts.3.plannedSaleYear', 2025, ctx)).toBe(
      "Before this plan's first year (2026), so its property tax and insurance stop from 2026, and the plan sells it then if it has a value. If it has already been sold, remove the property and add any proceeds to an account. Kept as entered.",
    )
    expect(warningFor('accounts.4.payoffYear', 2025, ctx)).toBe(
      "Before this plan's first year (2026), so the plan pays it off in 2026. If it was paid, set its balance to $0. Kept as entered.",
    )
    expect(warningFor('strategies.rothConversion.conversions.0.year', 2025, ctx)).toBe(
      "Before this plan's first year (2026), so this conversion is not modeled. Kept as entered.",
    )
    for (const path of ['accounts.3.plannedSaleYear', 'accounts.4.payoffYear', 'strategies.rothConversion.conversions.0.year']) {
      expect(warningFor(path, 2026, ctx)).toBeNull()
    }
  })

  it('leaves calendar years that are legitimately in the past alone', () => {
    expect(warningFor('accounts.0.inherited.ownerDeathYear', 2019, ctx)).toBeNull()
    expect(warningFor('accounts.0.allocation.startYear', 2020, ctx)).toBeNull()
  })
})

describe('nothing is warned about without a value', () => {
  it('returns null for a blank field, a missing path, and a non-finite number', () => {
    expect(warningFor(undefined, 999, NO_PLAN)).toBeNull()
    expect(warningFor('assumptions.inflationPct', null, NO_PLAN)).toBeNull()
    expect(warningFor('assumptions.inflationPct', undefined, NO_PLAN)).toBeNull()
    expect(warningFor('assumptions.inflationPct', Number.NaN, NO_PLAN)).toBeNull()
    expect(warningFor('household.people.0.retirementAge', 999, NO_PLAN)).toBeNull()
  })
})
