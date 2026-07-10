import type { AssetClassId } from '../model/plan'
import type { FilingStatus } from '../params/types'

/**
 * Projection engine types. The deterministic annual ledger is the core v2
 * artifact: Monte Carlo (roadmap V4) drives this same simulation with
 * stochastic inputs, never a separate model.
 *
 * @see DOCS/architecture.md (simulation core)
 */

/**
 * Per-year stochastic market conditions for one simulation path (roadmap V4).
 * Index 0 = the projection's startYear. Years past the end of a series fall
 * back to the deterministic assumptions, so a short series degrades gracefully.
 */
export interface MarketSeries {
  /**
   * Additive percentage-point shock applied each year to every non-cash
   * investable account's expected return (single-factor market model). For
   * allocated accounts it applies to the non-cash share of the blend unless
   * per-class shocks are supplied below.
   */
  returnShockPct?: number[]
  /** Realized inflation rate (percent) per year, replacing assumptions.inflationPct from startYear on. */
  inflationPct?: number[]
  /**
   * Per-class additive shocks for accounts with an opt-in allocation
   * (asset-allocation-and-return-model-v2, step 6). A class without a series
   * falls back to `returnShockPct` (cash: no shock). Unallocated accounts
   * always use `returnShockPct`, so single-return plans are unaffected.
   */
  classReturnShockPct?: Partial<Record<AssetClassId, number[]>>
}

export type ProjectedFilingStatus = FilingStatus | 'qualifyingSurvivingSpouse'

/**
 * QSS uses the joint tax tables, deduction, and AMT exemption. IRMAA is the
 * exception: SSA's threshold tables group qualifying surviving spouses with
 * single/HOH filers (POMS HI 01101.020), so the Medicare premium calculation
 * maps QSS to `single` instead of using this helper.
 */
export function taxParameterFilingStatus(status: ProjectedFilingStatus): FilingStatus {
  return status === 'single' ? 'single' : 'marriedFilingJointly'
}

export interface TaxYearInput {
  year: number
  filingStatus: ProjectedFilingStatus
  /** Wages, traditional withdrawals, pension/annuity taxable parts, taxable recurring/one-time income. */
  ordinaryIncome: number
  /** Realized long-term gains (taxable-account withdrawals via basis ratio). */
  capitalGains: number
  /** Realized gains before federal capital-loss carryforward netting; used by nonconforming states. */
  realizedCapitalGainsBeforeCarryforward?: number
  /** Taxable interest generated in taxable brokerage accounts (already included in ordinaryIncome). */
  taxableInterestIncome?: number
  /**
   * Interest on U.S. government obligations (TIPS ladder coupons + inflation
   * accretion), already included in ordinaryIncome AND taxableInterestIncome.
   * Federal tax applies in full (incl. NIIT); every state exempts it, so the
   * state calculator subtracts it from state taxable income.
   */
  usGovernmentInterest?: number
  /** Non-qualified dividends generated in taxable brokerage accounts (already included in ordinaryIncome). */
  ordinaryDividends?: number
  /** Qualified dividends taxed at preferential federal rates but included in AGI/MAGI. */
  qualifiedDividends?: number
  /** Gross Social Security benefits received. */
  ssBenefits: number
  /** Living household members aged 65+ this year (drives age-based deductions). */
  peopleAged65Plus: number
  /** State of residence this year (two-letter code); drives state tax. */
  state?: string
  /** Part-year state residency allocation for the tax year. */
  stateResidency?: { state: string; months: number }[]
  /**
   * Portion of ordinaryIncome that is retirement income (pension + annuity
   * taxable part + traditional/RMD distributions, excluding Roth conversions),
   * for state retirement-income exclusions. Federal tax ignores this.
   */
  retirementIncome?: number
  /**
   * Private retirement income eligible for the state's private retirement rule.
   * Replaces retirementIncome; the legacy field remains accepted by calculators.
   */
  privateRetirementIncome?: number
  /** Public civil/military pension income eligible for the state's public pension rule. */
  publicPensionIncome?: number
  /** Ages of living household members this year, for age-based state exclusions. */
  agesAlive?: number[]
  /**
   * Itemized-deduction components in nominal dollars (roadmap V8). When present,
   * federal tax uses the greater of the standard deduction and the itemized
   * total. SALT is the user's estimated deductible state/local/property tax
   * (kept as an input to avoid a circular dependency on the computed state tax).
   */
  itemizedDeductions?: {
    stateAndLocalTaxes: number
    mortgageInterest: number
    charitable: number
  }
  /**
   * Advanced calculator-only AMT preference/adjustment items. Projection does
   * not populate this from Plan fields today; the federal tax calculator already
   * derives standard-deduction and itemized-SALT add-backs from normal inputs.
   */
  amtPreferenceItems?: number
}

/**
 * Pluggable tax computation. V1 ships a flat placeholder; the real federal
 * engine (roadmap V2) implements the same interface.
 */
export interface TaxCalculator {
  compute(input: TaxYearInput): number
}

export interface PersonYearState {
  personId: string
  /** Age attained during this calendar year (year − birth year). */
  ageAttained: number
  /** Alive while ageAttained ≤ longevity planning age. */
  alive: boolean
}

/**
 * Per-year linearization inputs the V8 optimizer needs from a baseline ledger
 * run (roadmap V8). Emitted via `SimulateOptions.captureOptimizerInputs`; a
 * no-op unless that sink is supplied, so the normal projection is unaffected.
 * The optimizer's MILP carries balances forward itself, so only these exogenous
 * quantities (not per-year balances) are probed. @see strategies/optimizer.ts
 */
export interface OptimizerYearProbe {
  year: number
  /**
   * Ordinary taxable income EXCLUDING any traditional-account distribution or
   * Roth conversion, plus the baseline taxable Social-Security portion (which
   * the LP holds fixed rather than re-deriving as conversions change).
   */
  ordinaryIncomeBase: number
  /** Total cash uses besides tax/penalties this year (expenses + contributions). */
  spendingNeed: number
  /** Non-account cash inflows this year (income streams: SS, pensions, etc.). */
  exogenousCash: number
  /** Forced RMD this year in the baseline (0 when not age-eligible). */
  rmd: number
  /** Start-of-year owner-convertible traditional balance, used to recover the owner RMD divisor ratio. */
  startTraditional: number
  /** Forced inherited-traditional distribution this year in the baseline. */
  inheritedDistribution: number
  /** Start-of-year inherited traditional balance, used to recover the inherited distribution divisor ratio. */
  startInheritedTraditional: number
  /** Living people aged 65+ (drives the standard-deduction age addition). */
  peopleAged65Plus: number
  /**
   * Deposits landing in owner-traditional accounts this year: scheduled
   * employee contributions plus employer match into traditional. The cash cost
   * of employee contributions is already inside `spendingNeed`; this is the
   * asset side, so the optimizer's compressed balances receive the same money
   * the exact ledger does.
   */
  traditionalInflow: number
  /** Deposits landing in Roth/taxable/cash/equity-comp/HSA accounts this year (contributions + any Roth-employer match). */
  otherInflow: number
  /**
   * Subset of `otherInflow` that lands specifically in taxable brokerage /
   * equity-comp accounts this year. The optimizer (Step 2, taxable-gain
   * realization) splits the lumped "other" bucket into a taxable bucket — whose
   * withdrawals realize LTCG — and a tax-free bucket (Roth/cash/HSA); this is
   * the taxable side of the split. `otherInflow − taxableInflow` is the tax-free
   * side.
   */
  taxableInflow: number
  /**
   * Gross Social Security benefits received this year. Powers the optimizer's
   * in-solve taxable-SS PWL (Step 3): with it, the LP re-derives the 0/50/85%
   * provisional-income phase-in as conversions change instead of holding the
   * probe-time taxable portion fixed.
   */
  ssBenefits: number
  /**
   * The taxable-SS portion folded into `ordinaryIncomeBase` at the probe run
   * (the amount the in-solve PWL replaces with its own variable).
   */
  taxableSsBase: number
  /**
   * Realized capital gains + qualified dividends at the probe run, EXCLUDING
   * gains from taxable-account withdrawals (the optimizer re-decides those as
   * its own variable, so including them would double-count). Counts toward the
   * SS phase-in's provisional income and IRMAA MAGI but is not in
   * `ordinaryIncomeBase`.
   */
  capitalGainsBase: number
  /**
   * True when the ledger priced this premium year's IRMAA under an SSA-44
   * redetermination (the two years after a qualifying life-changing event, see
   * `healthcareConfigSchema.ssa44`). The optimizer's lookback treatment shifts
   * this year's IRMAA MAGI source from year (t−2) to year (t−1) — the in-solve
   * stand-in for the ledger's min(lookback, prior year).
   */
  ssa44IrmaaRedetermination: boolean
}

export interface YearIncomes {
  wages: number
  socialSecurity: number
  pension: number
  annuity: number
  /** TIPS-ladder cash flows (coupons + maturing principal); 0 when the plan has no ladders. */
  tipsLadder: number
  recurring: number
  oneTime: number
  taxableInterest: number
  ordinaryDividends: number
  qualifiedDividends: number
  taxableYield: number
  total: number
}

export interface YearExpenses {
  baseSpending: number
  oneTimeGoals: number
  /** Debt principal & interest (incl. any scheduled lump-sum payoff this year). */
  debtService: number
  /** Property tax + homeowner's insurance on owned properties (continues after mortgage payoff). */
  propertyCosts: number
  /** Pre-65 marketplace premiums net of ACA credit + Medicare (Part B incl. IRMAA, Part D surcharge, extras). */
  healthcare: number
  /** Level (fixed-nominal) insurance premiums charged this year (LTC + permanent life). */
  insurancePremiums: number
  /** Gross LTC care-episode cost this year (additive spending spike, before any policy offset). */
  careCost: number
  /** LTC policy benefit applied against careCost this year (income-tax-free; reduces net spending). */
  ltcBenefit: number
  /**
   * Must-fund spending this year: system-computed costs (healthcare, debt,
   * property, insurance, net LTC) + the required-floor lifestyle layer +
   * required-classified funded goals. A guardrail policy never cuts below this.
   */
  requiredSpending: number
  /**
   * Full intended spending with no guardrail cut: requiredSpending + the full
   * target lifestyle layer + target-classified goals. Equals `total` for older
   * fixed-target plans without ideal/excess layers.
   */
  targetSpending: number
  /** Incremental ideal spending intended this year above the target lifestyle. */
  idealSpending: number
  /** Incremental excess/opportunistic spending intended this year above ideal. */
  excessSpending: number
  /** Full intended spending with no guardrail cut across required/target/ideal/excess. */
  intendedSpending: number
  /** Discretionary multiplier the guardrail policy applied this year (1 = no cut). */
  guardrailFactor: number
  total: number
}

/** Withdrawal totals by account category (sequential order: cash → taxable → traditional → roth → hsa). */
export interface YearWithdrawals {
  cash: number
  taxable: number
  traditional: number
  roth: number
  hsa: number
  total: number
}

export interface YearResult {
  year: number
  people: PersonYearState[]
  /** Filing treatment used for federal/state thresholds in this projection year. */
  filingStatus: ProjectedFilingStatus
  incomes: YearIncomes
  expenses: YearExpenses
  /** Contributions actually made this year (after IRS caps). */
  contributions: number
  /** Employer match contributions made this year. */
  employerMatch: number
  /** Forced traditional-account distributions (included in withdrawals.traditional). */
  rmd: number
  /** Penalty-free 72(t) SEPP distributions this year (included in withdrawals.traditional). */
  sepp: number
  /** Forced inherited-IRA distributions this year under the 10-year rule (included in withdrawals.traditional). */
  inheritedDistribution: number
  /** Qualified charitable distributions routed out of the RMD (excluded from income). */
  qcd: number
  /** Dollars moved traditional → Roth this year (taxed as ordinary income, no penalty). */
  rothConversion: number
  /** Early-withdrawal penalties (10% traditional pre-59½, 20% HSA non-medical pre-65); not in `tax`. */
  penalties: number
  /** MAGI realized this year (drives IRMAA two years later and the ACA credit). */
  magi: number
  /** Medicare premiums charged this year (Part B incl. IRMAA + Part D surcharge, all covered people; excludes the user's "extras"). */
  medicarePremiums: number
  /** IRMAA tier the year's Medicare premiums were priced at (0 = standard premium; 1–5 = surcharge tiers). */
  irmaaTier: number
  /** Federal alternative minimum tax included in `tax` when the planning-grade AMT screen binds. */
  amt: number
  /** Additional long-term gains realizable this year still taxed at 0% (gain-harvesting advisory). */
  ltcgZeroHeadroom: number
  /** Benefits withheld by the retirement earnings test (working early claimants). */
  ssEarningsTestWithheld: number
  /** SSDI paid this year (included in `incomes.socialSecurity`; 0 when disability is off). */
  ssdiPaid: number
  tax: number
  withdrawals: YearWithdrawals
  /** Realized capital gains embedded in taxable withdrawals + annual-rebalance sales. */
  realizedGains: number
  /** Taxable account interest + dividends generated this year. */
  taxableYield: number
  /** Capital-loss carryforward applied against this year's realized gains. */
  capitalLossUsedAgainstGains: number
  /** Capital-loss carryforward applied against ordinary income (≤ annual limit). */
  capitalLossUsedAgainstOrdinary: number
  /** Capital-loss carryforward balance carried into next year. */
  capitalLossCarryforwardRemaining: number
  /** Surplus cashflow invested (into cash, else taxable, else unassigned). */
  surplusInvested: number
  /** Spending the portfolio could not cover this year. */
  shortfall: number
  /**
   * Required-floor spending the portfolio could not cover this year — the
   * serious failure signal (a portfolio shortfall is charged to the
   * discretionary layer first and only reaches the floor once it is exhausted).
   */
  requiredShortfall: number
  /**
   * Target-lifestyle miss this year: a guardrail's deliberate discretionary cut
   * plus any portfolio shortfall that ate into funded discretionary spending.
   * Not the same as running out of money for essentials (see requiredShortfall).
   */
  targetShortfall: number
  /** Ideal spending not funded this year. */
  idealShortfall: number
  /** Excess/opportunistic spending not funded this year. */
  excessShortfall: number
  /** Guardrail action taken this year under a withdrawal-rate policy ('hold' when inactive). */
  guardrailAction: 'hold' | 'cut' | 'raise'
  /** Flexible one-time-goal outcomes this year (all 0 outside guardrail mode). */
  flexibleGoals: {
    funded: number
    partiallyFunded: number
    deferred: number
    skipped: number
    fundedAmount: number
    unfundedAmount: number
  }
  /** End-of-year balance per account id (after flows and growth). */
  balances: Record<string, number>
  /** Cash + taxable + traditional + roth + hsa (+ unassigned). */
  investableTotal: number
  /** Permanent-life cash value at year end (an asset, but held out of withdrawals). */
  insuranceCashValue: number
  /**
   * Remaining TIPS-ladder principal at year end (nominal book value: unmatured
   * face × inflation to date, ignoring rate moves). A dedicated asset held out
   * of withdrawals — counted in netWorth, not investableTotal. 0 without ladders.
   */
  ladderValue: number
  /** Income-tax-free life death benefit paid into the estate/beneficiary this year. */
  deathBenefit: number
  /** Tax-free HECM line-of-credit loan proceeds drawn this year (0 without a HECM). */
  hecmDraw: number
  /** Total HECM loan balance at year end, before the non-recourse floor (0 without a HECM). */
  hecmLoanBalance: number
  /**
   * investableTotal + property + insuranceCashValue + ladderValue − debt −
   * HECM loans (each capped at its home's value: non-recourse).
   */
  netWorth: number
}

export interface ProjectionResult {
  startYear: number
  endYear: number
  years: YearResult[]
  /** First year with any shortfall, else null. */
  depletionYear: number | null
  endingInvestable: number
  endingNetWorth: number
  /**
   * Remaining nondeductible (after-tax) traditional-IRA basis at the horizon,
   * capped per owner at their ending aggregated-IRA balance. This is after-tax
   * money an heir inherits tax-free (they file a separate Form 8606), so the
   * after-tax estate metric excludes it from the traditional heir tax. 0 when
   * no IRA carries nondeductible basis.
   */
  endingNondeductibleIraBasis: number
  /** Modeling caveats hit during this run (e.g. SS stream without a PIA). */
  warnings: string[]
}
