/**
 * Plausibility warnings beside a field: decisions D1, D2, D3, D7 and the
 * past-year half of D4 from the list on #495, answered there on 2026-09-02.
 * (#465 is D9, the grid rhythm, and is not this module.)
 *
 * The engine decides what is VALID; `validationIssues.ts` reports what it
 * refused. This module is the other half: a value the engine accepts but that
 * almost certainly is not what the person meant — a 999 % debt rate, a
 * $999,999,999,999 cash balance, a goal in 1999. Nathan's answer to D1–D3 and
 * D7 was explicit that none of these becomes a bound: the value is still
 * committed, nothing is refused, and the control never goes `aria-invalid`.
 * The field shows a note under it and the plan stores what was typed.
 *
 * Money math stays in the engine (AGENTS.md): the only arithmetic here is
 * comparing the number a person typed against a threshold. Nothing is scaled,
 * converted, or projected. That holds only because no warned path is one the
 * card shows in a different unit from the one the plan stores — `DISPLAY_SCALE`
 * in validationIssues.ts names exactly one such path today (the brokerage
 * qualified-dividend share) and it is not in the table below. Adding a scaled
 * path here would need the threshold expressed in the field's own unit, the way
 * `boundsForPath` converts the engine's bound.
 *
 * The thresholds are the decision, verbatim (#495, comment of 2026-09-02):
 *
 *   | Kind                              | Warns                        |
 *   |-----------------------------------|------------------------------|
 *   | returns, inflation, raises        | beyond ±30 %                 |
 *   | debt interest, cash-value growth  | above 50 % or below 0        |
 *   | volatility, yields                | above 100 %                  |
 *   | balances and dollar amounts       | at or above $100 million     |
 *   | deductions such as SALT           | above $1 million             |
 *   | spending-phase multiplier         | exactly 0 (phase spends none)|
 *   | calendar years                    | before the plan's start year |
 *
 * `designQa.decisions.test.ts` pins every number above, so a later edit that
 * moves one has to move the pin and say why.
 */

import { boundsKey } from './schemaBounds'

/** The bands the decision names. One band per row of the table above. */
type Band =
  /** D1: returns, inflation and raises. */
  | 'rate30'
  /** D1: debt interest and cash-value growth. */
  | 'growth50'
  /** D2: asset-class volatility and yields. */
  | 'share100'
  /** D3: balances and dollar amounts. */
  | 'amount100m'
  /** D3: deductions such as SALT. */
  | 'deduction1m'
  /** D7: a spending phase that spends nothing. */
  | 'phaseZero'
  /** D4: a calendar year before the plan's first projected year. */
  | 'pastYear'

/** The numbers the decision fixed. Named so the pin reads as the decision does. */
export const WARNING_THRESHOLDS = {
  /** Returns, inflation and raises warn beyond ±30 %. */
  ratePct: 30,
  /** Debt interest and cash-value growth warn above 50 % or below 0. */
  growthPctMax: 50,
  growthPctMin: 0,
  /** Volatility and yields warn above 100 %. */
  sharePctMax: 100,
  /** Balances and dollar amounts warn at or above $100 million. */
  amountDollars: 100_000_000,
  /** Deductions such as SALT warn above $1 million. */
  deductionDollars: 1_000_000,
  /** A spending-phase multiplier of exactly this warns that the phase spends nothing. */
  phaseMultiplier: 0,
} as const

const ASSET_CLASSES = ['usStocks', 'intlStocks', 'bonds', 'cash'] as const

const classPaths = (leaf: string): string[] =>
  ASSET_CLASSES.map((id) => `assumptions.assetClassParams.${id}.${leaf}`)

/**
 * Which band each wired field sits in, keyed the way `schemaBounds` keys its
 * map (`accounts.N.balance`), so an indexed path finds its row.
 *
 * Scope notes, so the omissions are deliberate rather than forgotten:
 *
 * - COLA rates (`assumptions.ssCola.annualPct`, `accounts.N.colaPct`) ride with
 *   inflation. A cost-of-living adjustment is an inflation rate by definition,
 *   and leaving them alone would warn on a 40 % inflation assumption while
 *   accepting a 40 % COLA on the annuity priced against it.
 * - The past-year band covers exactly the fields the #495 decision list
 *   enumerated under "past calendar years": the goal year and its funding
 *   window, the one-time income year, a recurring stream's start and end, and
 *   the household move year. A lump-sum payoff year, a planned sale year, and
 *   a TIPS-ladder purchase year are not in that list — a ladder must be bought
 *   BEFORE its first payout year, so a purchase in the current year's past is
 *   the shape the engine requires, not a mistake.
 * - `strategies.rothConversion.targetValue` carries a bracket rate, a tier
 *   index, or a MAGI ceiling at one path, so no single band fits it. The
 *   engine validates it per target kind instead (plan.ts, D6).
 */
const BAND_BY_PATH: Readonly<Record<string, Band>> = {
  // D1 — returns, inflation and raises: beyond ±30 %.
  'assumptions.inflationPct': 'rate30',
  'assumptions.healthcareExtraInflationPct': 'rate30',
  'assumptions.defaultReturnPct': 'rate30',
  'assumptions.ssCola.annualPct': 'rate30',
  'accounts.N.colaPct': 'rate30',
  'accounts.N.annualReturnPct': 'rate30',
  'incomes.N.realGrowthPct': 'rate30',
  ...Object.fromEntries(classPaths('returnPct').map((p) => [p, 'rate30' as const])),

  // D1 — debt interest and cash-value growth: above 50 % or below 0.
  'accounts.N.interestPct': 'growth50',
  'insurance.N.cashValueGrowthPct': 'growth50',

  // D2 — volatility and yields: above 100 %.
  ...Object.fromEntries(classPaths('volatilityPct').map((p) => [p, 'share100' as const])),
  ...Object.fromEntries(classPaths('interestYieldPct').map((p) => [p, 'share100' as const])),
  ...Object.fromEntries(classPaths('dividendYieldPct').map((p) => [p, 'share100' as const])),
  'accounts.N.interestYieldPct': 'share100',
  'accounts.N.dividendYieldPct': 'share100',

  // D3 — balances and dollar amounts: at or above $100 million.
  'accounts.N.balance': 'amount100m',
  'accounts.N.value': 'amount100m',
  'accounts.N.costBasis': 'amount100m',
  'accounts.N.annualContribution': 'amount100m',
  'accounts.N.monthlyAmount': 'amount100m',
  'accounts.N.monthlyPayment': 'amount100m',
  'assumptions.recentAnnualMagi': 'amount100m',
  'careEvents.N.annualCost': 'amount100m',
  'expenses.baseAnnual': 'amount100m',
  'expenses.requiredAnnual': 'amount100m',
  'expenses.oneTimeGoals.N.amount': 'amount100m',
  'expenses.healthcare.pre65MonthlyPremiumPerPerson': 'amount100m',
  'expenses.healthcare.medicareExtrasMonthlyPerPerson': 'amount100m',
  'household.capitalLossCarryforward': 'amount100m',
  'incomeFloor.ladders.N.annualRealAmount': 'amount100m',
  'incomes.N.amount': 'amount100m',
  'incomes.N.annualAmount': 'amount100m',
  'incomes.N.annualGross': 'amount100m',
  'incomes.N.piaMonthly': 'amount100m',
  'insurance.N.annualPremium': 'amount100m',
  'insurance.N.cashValue': 'amount100m',
  'insurance.N.cashValueSchedule.N.value': 'amount100m',
  'insurance.N.deathBenefit': 'amount100m',
  'strategies.qcdAnnual': 'amount100m',
  'strategies.rothConversion.conversions.N.amount': 'amount100m',
  'strategies.survivorReserveTarget': 'amount100m',
  'strategies.taxableSafetyNetFloor': 'amount100m',

  // D3 — deductions such as SALT: above $1 million.
  'strategies.itemizedDeductions.stateAndLocalTaxes': 'deduction1m',
  'strategies.itemizedDeductions.mortgageInterest': 'deduction1m',
  'strategies.itemizedDeductions.charitable': 'deduction1m',

  // D7 — a spending phase that spends nothing.
  'expenses.phases.N.multiplier': 'phaseZero',

  // D4 — a calendar year before the plan's first projected year.
  //
  // A known and accepted cost: a rental that began in 2015, or a move that
  // already happened, is legitimate history, and its field carries this note
  // for as long as it holds that year (review r1-5). The decision took that
  // trade knowingly — these are exactly the fields the #495 list enumerated —
  // because the same entry is far more often a typo (a goal in 1999, a stream
  // ending in 2020) than a record of the past, and nothing is refused either
  // way. Narrowing it would need a way to tell "already happened" from
  // "mistyped", which the plan does not carry; that is a product question,
  // not something to guess at here.
  'expenses.oneTimeGoals.N.year': 'pastYear',
  'expenses.oneTimeGoals.N.earliestYear': 'pastYear',
  'expenses.oneTimeGoals.N.latestYear': 'pastYear',
  'household.stateMoves.N.fromYear': 'pastYear',
  'incomes.N.year': 'pastYear',
  'incomes.N.startYear': 'pastYear',
  'incomes.N.endYear': 'pastYear',
}

export interface WarningContext {
  /**
   * The plan's first projected year.
   *
   * The fields do not pass one, and that is not an omission: the projection's
   * first year IS the current calendar year — `currentStartYear` in
   * `planner-ui/src/projection.ts` is `new Date().getFullYear()`, and
   * `projectPlan` defaults to it — so the fallback below is the same number,
   * read the same way, without dragging the projection module (and the engine
   * simulation it imports) into every field component. The parameter exists so
   * a test can pin a year instead of depending on the clock, and so this stays
   * a one-line change if the projection ever starts somewhere else.
   */
  startYear?: number
}

/**
 * The note to show under the field at `path` for the value it currently holds,
 * or null when the value is ordinary. Null for an unwired field, a blank one,
 * and anything the table above does not name.
 */
export function warningFor(
  path: string | undefined,
  value: number | null | undefined,
  ctx?: WarningContext,
): string | null {
  if (!path || value === null || value === undefined || !Number.isFinite(value)) return null
  const band = BAND_BY_PATH[boundsKey(path)]
  if (band === undefined) return null
  const t = WARNING_THRESHOLDS
  switch (band) {
    case 'rate30':
      return value > t.ratePct || value < -t.ratePct
        ? `Outside the −${t.ratePct}% to ${t.ratePct}% range most plans use. Kept as entered.`
        : null
    case 'growth50':
      return value > t.growthPctMax || value < t.growthPctMin
        ? `Outside the ${t.growthPctMin}% to ${t.growthPctMax}% range most plans use. Kept as entered.`
        : null
    case 'share100':
      return value > t.sharePctMax ? `Above ${t.sharePctMax}%, which is unusual here. Kept as entered.` : null
    case 'amount100m':
      return value >= t.amountDollars ? 'At or above $100 million, which is unusual. Kept as entered.' : null
    case 'deduction1m':
      return value > t.deductionDollars ? 'Above $1 million, which is unusual for a deduction. Kept as entered.' : null
    case 'phaseZero':
      return value === t.phaseMultiplier ? 'A multiplier of 0 means this phase spends nothing. Kept as entered.' : null
    case 'pastYear': {
      const startYear = ctx?.startYear ?? new Date().getFullYear()
      return value < startYear ? `Before this plan's first year (${startYear}). Kept as entered.` : null
    }
  }
}

/** The paths the table names, for the design-QA pin. */
export function warnedPaths(): string[] {
  return Object.keys(BAND_BY_PATH).sort()
}

/** The band a path sits in, for the design-QA pin. */
export function bandForPath(path: string): string | undefined {
  return BAND_BY_PATH[boundsKey(path)]
}
