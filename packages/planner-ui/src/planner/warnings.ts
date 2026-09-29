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

import type { Plan } from '@retiregolden/engine/model/plan'

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
  /**
   * D4, a purchase: an annuity premium or a TIPS-ladder cost dated before the
   * first year is treated as already paid (D-2027-ROLLOVER).
   */
  | 'pastPurchaseYear'
  /** D4, a Roth conversion window that opened before the first year. */
  | 'pastWindowStart'
  /** D4, a Roth conversion window that ended before the first year: it converts nothing. */
  | 'pastWindowEnd'
  /** D4, a manual conversion row dated before the first year: not modeled. */
  | 'pastConversionYear'
  /** D4, a property sale dated before the first year: the ledger sells it in the first year. */
  | 'pastSaleYear'
  /** D4, a debt payoff dated before the first year: the ledger pays it off in the first year. */
  | 'pastPayoffYear'
  /** D4, a HECM line of credit dated to open before the first year: it opens in the first year. */
  | 'pastLineOpen'

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
 *   the household move year. Decision D-2027-ROLLOVER added the dated fields a
 *   later start reads differently: a purchase year (treated as already paid),
 *   the Roth window's start and end, a pension election year, a HECM line's
 *   open year, and, after the review (H1, L4), a property's planned sale year
 *   and a debt's payoff year (the ledger acts on each in the first year) and a
 *   manual conversion row's year. Years that are legitimately in the past (an
 *   inherited account owner's death year, a glide path's start) carry no note.
 * - `strategies.rothConversion.targetValue` carries a bracket rate, a tier
 *   index, or a MAGI ceiling at one path, so no single band fits it. The
 *   engine validates it per target kind instead (model/planCrossFieldChecks.ts,
 *   D6).
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
  // D-2027-ROLLOVER (2026-09-28): the four dated fields that had no note. An
  // unelected pension offer whose election year has passed is kept, and the
  // pension pays; an ELECTED one in the past is refused at save by the as-of
  // check (`asOfIssues`), whose error takes this note's place on the field.
  'accounts.N.lumpSumOffer.electionYear': 'pastYear',
  'accounts.N.purchase.year': 'pastPurchaseYear',
  'incomeFloor.ladders.N.purchase.year': 'pastPurchaseYear',
  'strategies.rothConversion.startYear': 'pastWindowStart',
  // The check's spec 4 named HECM lines too: one dated to open earlier opens
  // in the start year (engine hecmLineOpenings), and the projection says so.
  'accounts.N.hecm.openYear': 'pastLineOpen',
  // The review's H1, L1 and L4: a Roth window that has ended converts
  // nothing, and a sale or payoff dated earlier runs in the first year
  // (engine projection/propertySaleYear.ts, annualDebtAndLongTermCare.ts).
  'strategies.rothConversion.endYear': 'pastWindowEnd',
  'strategies.rothConversion.conversions.N.year': 'pastConversionYear',
  'accounts.N.plannedSaleYear': 'pastSaleYear',
  'accounts.N.payoffYear': 'pastPayoffYear',
}

export interface WarningContext {
  /**
   * The plan's first projected year, `projectionStartYear(plan)`: the clock's
   * year for a user plan and EXAMPLE_FIXED_YEAR for a library example. There is
   * no clock fallback: the field components read it from the plan in context
   * (`usePlanStartYear`), so the note and the projection read one year. Null
   * where no plan is in context (the import wizard, the lever editors): with
   * no first year there is nothing for a year to be before.
   */
  startYear: number | null
  /**
   * The Roth conversion window's last year when the plan has one
   * (`fillToTarget`), so the window-start note can say that a window which
   * ended before the first year converts nothing (review L1). Absent or null
   * otherwise.
   */
  rothWindowEndYear?: number | null
}

/** The context a field reads its note against, for the plan in view (or none). */
export function warningContextFor(plan: Pick<Plan, 'strategies'> | null, startYear: number | null): WarningContext {
  const roth = plan?.strategies.rothConversion
  return { startYear, rothWindowEndYear: roth?.mode === 'fillToTarget' ? roth.endYear : null }
}

/**
 * The note to show under the field at `path` for the value it currently holds,
 * or null when the value is ordinary. Null for an unwired field, a blank one,
 * and anything the table above does not name.
 */
export function warningFor(
  path: string | undefined,
  value: number | null | undefined,
  ctx: WarningContext,
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
      const startYear = ctx.startYear
      return startYear !== null && value < startYear ? `Before this plan's first year (${startYear}). Kept as entered.` : null
    }
    case 'pastPurchaseYear': {
      const startYear = ctx.startYear
      return startYear !== null && value < startYear
        ? `Before this plan's first year (${startYear}), so the purchase is treated as already paid: its cost is not taken from the funding account. If that balance still includes it, lower the balance. Kept as entered.`
        : null
    }
    case 'pastWindowStart': {
      const startYear = ctx.startYear
      if (startYear === null || value >= startYear) return null
      const endYear = ctx.rothWindowEndYear ?? null
      return endYear !== null && endYear < startYear
        ? `Before this plan's first year (${startYear}), and the window ends in ${endYear}, so no conversion runs. Kept as entered.`
        : `Before this plan's first year (${startYear}), so conversions run from ${startYear}. Kept as entered.`
    }
    case 'pastWindowEnd': {
      const startYear = ctx.startYear
      return startYear !== null && value < startYear
        ? `Before this plan's first year (${startYear}), so no conversion runs in this window. Kept as entered.`
        : null
    }
    case 'pastConversionYear': {
      const startYear = ctx.startYear
      return startYear !== null && value < startYear
        ? `Before this plan's first year (${startYear}), so this conversion is not modeled. Kept as entered.`
        : null
    }
    case 'pastSaleYear': {
      const startYear = ctx.startYear
      return startYear !== null && value < startYear
        ? `Before this plan's first year (${startYear}), so the plan sells it in ${startYear}. If it has already been sold, remove the property and add the proceeds to an account. Kept as entered.`
        : null
    }
    case 'pastPayoffYear': {
      const startYear = ctx.startYear
      return startYear !== null && value < startYear
        ? `Before this plan's first year (${startYear}), so the plan pays it off in ${startYear}. If it was paid, set its balance to $0. Kept as entered.`
        : null
    }
    case 'pastLineOpen': {
      const startYear = ctx.startYear
      return startYear !== null && value < startYear
        ? `Before this plan's first year (${startYear}), so the line is modeled as opening in ${startYear}. Kept as entered.`
        : null
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
