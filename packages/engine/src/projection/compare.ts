/**
 * Projection summaries and the convert-vs-don't comparison (roadmap V3).
 * Scenario diffing generalizes in V4; this covers the headline question.
 */

import { selectedLogicalBalanceAccounts, type Account, type Plan } from '../model/plan.js'
import { estateTraditionalTaxableBase } from './estateTraditionalBasis.js'
import { estateHsaIncomeBase } from './estateHsaIncome.js'
import { moneyLasts, type MoneyLasts } from './moneyLasts.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'
import { householdRetirement, type PersonRetirement, type RetirementYearRule } from './householdRetirement.js'
import type { ProjectionResult } from './types.js'
import { balancesByCategory, spendingWithTaxAndPenalties } from './yearFigures.js'

function isoYear(isoDate: string): number {
  return Number(isoDate.slice(0, 4))
}

export type EstateDestination = 'spouse' | 'nonSpouse' | 'charity'

/** How one account's ending balance is discounted on the way to heirs/charity. */
export interface EstateAccountBreakdown {
  accountId: string
  name: string
  category: 'cash' | 'taxable' | 'traditional' | 'roth' | 'hsa'
  grossBalance: number
  destination: EstateDestination
  /** Pre-tax portion exposed to heir income tax (traditional net of allocated household remaining basis; non-spouse HSA). */
  taxablePretaxBase: number
  heirTaxRatePct: number
  /** Portion passing to charity, untaxed. */
  charityAmount: number
  /**
   * Assumed heir income tax on the non-charity slice of the taxable pre-tax
   * base: `taxablePretaxBase × (1 − charity fraction) × heir rate`, and 0
   * for a spouse destination. The charity fraction therefore reduces both
   * the amount heirs receive and the base they are taxed on; it is not
   * carved from the gross balance alone.
   */
  heirTax: number
  /** grossBalance − charityAmount − heirTax. */
  netToHeirs: number
}

/**
 * Resolve an account's estate destination for the after-tax estate metric.
 * Explicit `estateBeneficiary` wins; otherwise the legacy defaults reproduce the
 * old flat haircut exactly: pre-tax (traditional) balances go to a taxed heir,
 * an HSA follows its legacy `beneficiary` shorthand, and everything else passes
 * to a (untaxed) spouse-equivalent.
 */
function resolveEstateDestination(account: Account): { destination: EstateDestination; charityPct: number } {
  if ('estateBeneficiary' in account && account.estateBeneficiary) {
    return {
      destination: account.estateBeneficiary.destination,
      charityPct: account.estateBeneficiary.charityPct ?? 0,
    }
  }
  if (account.type === 'hsa') {
    return { destination: account.beneficiary === 'nonSpouse' ? 'nonSpouse' : 'spouse', charityPct: 0 }
  }
  if (account.type === 'traditional') return { destination: 'nonSpouse', charityPct: 0 }
  return { destination: 'spouse', charityPct: 0 }
}

export interface ProjectionSummary {
  /**
   * Sum of taxes and penalties over the whole projection: each year's tax plus
   * penalties in that year's nominal dollars, added in ledger order from 0,
   * undiscounted.
   */
  lifetimeTaxesAndPenalties: number
  /** Sum of each year's executed Roth conversion, nominal dollars of each year, undiscounted. */
  lifetimeRothConversions: number
  /** ProjectionResult.endingInvestable: nominal dollars of the projection's endYear. */
  endingInvestable: number
  /** ProjectionResult.endingNetWorth: nominal dollars of the projection's endYear. */
  endingNetWorth: number
  /**
   * In nominal dollars of the projection's endYear:
   * ending net worth minus the charity carve-outs and minus the income tax
   * heirs owe on inherited pre-tax (traditional) balances at the plan's assumed
   * heir tax rate: `endingAfterTaxEstate = endingNetWorth − endingEstateToCharity
   * − endingEstateHeirTax`. With no charity destination this is net worth minus
   * heir tax. Remaining
   * nondeductible IRA basis is excluded from each traditional taxable pretax
   * base by estateTraditionalTaxableBase, which spreads the household
   * remaining-basis scalar across traditional accounts by gross — a disclosed
   * approximation of assumed future income-tax exposure, not a death-year
   * Form 8606. Roth, taxable
   * (stepped-up at death), cash, and property are treated as passing through
   * untaxed — the standard simplification for an estate comparison.
   * Designated surviving-spouse HSA continuation under IRC §223(f)(8)(A)
   * contributes a zero inclusion; the legacy omitted-`beneficiary`
   * convention independently maps to the same zero and does not prove a
   * statutory designation. Any other modeled destination uses the ending gross as the
   * terminal inclusion base under IRC §223(f)(8)(B)(i); the
   * §223(f)(8)(B)(ii)(I) predeath-expense reduction is not applied. Charity
   * carve-outs are subtracted from this figure and reported in
   * endingEstateToCharity; the gross base for charity is the
   * pre-carveout model value, not a claim that charity owes income under the
   * HSA statute. That figure is assumed terminal exposure at the horizon, not a death-year return.
   */
  endingAfterTaxEstate: number
  /** Total heir income tax discounted from the estate (sum of the breakdown's heirTax). */
  endingEstateHeirTax: number
  /** Total passing to charity untaxed (sum of the breakdown's charityAmount). */
  endingEstateToCharity: number
  /** Per-account estate discounting, so the summary can explain each class's haircut. */
  estateBreakdown: EstateAccountBreakdown[]
  /**
   * The last ledger row's balances summed by account type into the five
   * categories (cash, taxable, traditional, roth, hsa); equity-compensation
   * accounts are not one of them and are left out here.
   */
  endingByCategory: { cash: number; taxable: number; traditional: number; roth: number; hsa: number }
  /**
   * The projection's depletion year, copied from ProjectionResult: the first
   * year whose funding shortfall after any HECM backstop draw exceeds
   * ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS (half a cent, the ledger's own
   * residual budget), else null. A residual at or below that budget is not
   * depletion.
   */
  depletionYear: number | null
  warnings: string[]
  // Derived FIRE metrics
  /**
   * One row per projection year: savings (contributions + employer match +
   * surplus invested) over gross income, as a percentage clamped to [0, 100];
   * 0 when gross income is 0.
   */
  savingsRates: Array<{ year: number; ratePct: number }>
  /**
   * Arithmetic mean of savingsRates[].ratePct over the years strictly before
   * the household's later retirement year (`fiBasis.retirementYear`,
   * projection/householdRetirement.ts: a retirement age gives birth year +
   * that age; a person with none retires in the first year without their
   * wages, else in the start year; a person who never retires in the plan is
   * left out), or over every year when nobody retires in the plan;
   * 0 when no year qualifies. Unweighted: every qualifying year counts once
   * regardless of income.
   */
  averagePreRetirementSavingsRatePct: number
  /**
   * Portfolio target in projection-start-year ("today's") dollars. One calendar
   * year's nominal outflows, deflated to `result.startYear`, divided by the
   * plan's safe-withdrawal-rate decimal. The rate convention is
   * `assumptions.safeWithdrawalRatePct` percent per year (default 4) used as a
   * lens only — the ledger does not spend at this rate.
   *
   * Spending year: the calendar year `max(startYear, retirementYear)`, looked
   * up on `result.years`, where `retirementYear` is the household's later
   * retirement (projection/householdRetirement.ts): each person's first year
   * without work (birth year plus retirement age; else the year after their
   * last wage year; else the start year), the latest among the people alive
   * in the year it would be priced. A tie goes to the older person, then the
   * smaller id, so list order never decides it (decision D-PEOPLE-ORDER);
   * `fiBasis.personId` names that person. If that year is absent, the first
   * ledger year (`result.years[0]`) is used.
   *
   * Null when nobody in the household retires in the plan (everyone works
   * through it, reaches a retirement age only after the planning age, or
   * died before it starts): there is no retirement year to price, and FI is
   * never priced in a year after the person's death (the independent
   * review's N3). `fiBasis.spendingSource` is then `noRetirementInPlan` and
   * `fiBasis.notRetiring` says who and why; `fiYear`, `fiAge` and
   * `coastFireNumber` are null too.
   *
   * Spending base: that year's published `expenses.total + tax + penalties`
   * (nominal dollars for that calendar year). `expenses.total` is funded
   * spending after guardrail cuts — funded lifestyle layers, funded one-time
   * goals, debt service, property costs, healthcare, insurance premiums, and
   * net LTC (`careCost − ltcBenefit`) — not `intendedSpending` and not net of
   * incomes. `tax` and `penalties` are that year's published liabilities.
   *
   * A Roth conversion is a one-off prepayment of tax, not spending the
   * portfolio must fund every year, so it never enters the base (decision
   * D-FI-CONVERSION-TAX). When the plan converts in any year of the projection
   * (`rothConversion > 0`, or a named conversion request, even one the ledger
   * refused), the spending year's `expenses.total + tax + penalties` are read
   * from the same calendar year of the plan run with its Roth conversions
   * removed (`withoutRothConversions`, run on the projection's own options):
   * the year's outflows had the household never converted, so neither a
   * conversion's one-off tax nor what it costs in later years (the IRMAA
   * lookback, a drained taxable account) is priced, even when the spending
   * year itself converts nothing. That run is supplied by the caller
   * (`SummarizeProjectionOptions.conversionFreeRun`); a caller that supplies
   * none keeps that year's conversion tax in the base, and `fiBasis` says so.
   * `fiBasis` names the year and the source of every published FI number.
   *
   * Deflation is discrete annual with the plan's general inflation rate
   * `plan.assumptions.inflationPct` (never `healthcareExtraInflationPct`):
   * `nominal / (1 + inflationPct/100)^(spendingYear − startYear)`. No rounding
   * or floor.
   *
   * Formula: fiNumber = ((expenses.total + tax + penalties) / (1 + inflationPct/100)^(spendingYear − startYear)) / (safeWithdrawalRatePct / 100),
   * with the three figures from the conversion-free run when any year of the plan converts
   *
   * Empty ledger (`result.years` empty): `plan.expenses.baseAnnual / (safeWithdrawalRatePct / 100)`
   * with no tax, no penalties, and no deflation.
   *
   * Note: the empty-ledger path is base lifestyle only, unlike the normal path
   * which adds tax and penalties; a horizon that ends before retirement prices
   * the first ledger year rather than interpolating a retirement-year spend;
   * guaranteed income is not subtracted (gross outflows, not `netPortfolioNeed`).
   */
  fiNumber: number | null
  fiYear: number | null
  /**
   * Attained age in the first ledger year whose end-of-year investable, deflated
   * to `result.startYear`, meets or exceeds `fiNumber`; `null` if none does.
   * Age-from-date-of-birth: `fiAge = fiYear − birthYear`, where `birthYear` is
   * the ISO year of the `dob` of the person named by `fiBasis.personId` (the
   * household's later retirement; first four characters of the ISO date; month
   * and day are ignored), else 1980. That is calendar-year attained
   * age (`year − birth year`), the same convention as
   * `PersonYearState.ageAttained`, not age-on-birthday.
   *
   * Threshold: walk `result.years` in ledger order. For each year, deflate the
   * published end-of-year `investableTotal` (the ledger's own figure: every
   * physical balance row — cash, taxable, equity compensation, traditional,
   * Roth and HSA — plus unassigned cash; excluding property, insurance cash
   * value and TIPS-ladder principal; nominal dollars at year end) by
   * `investableTotal / (1 + inflationPct/100)^(year − startYear)`, with
   * `inflationPct` = `plan.assumptions.inflationPct`. Derive from the published
   * field, not from a sum of account types. The first
   * year whose deflated investable is **greater than or equal to** `fiNumber`
   * (inclusive) is the crossing: `fiYear` is that calendar year and `fiAge` is
   * `fiYear − birthYear`. Never-crossing and an empty ledger both leave
   * `fiYear` and `fiAge` as `null`. No rounding.
   *
   * Formula: fiAge = min { year − birthYear | investableTotal / (1 + inflationPct/100)^(year − startYear) ≥ fiNumber }, else null
   *
   * Reads upstream `fiNumber` (start-year dollars) and each year's published
   * end-of-year `investableTotal` (nominal).
   *
   * Note: a December birthday still counts as attaining `year − birthYear` for
   * the whole calendar year; the comparison is inclusive (`>=`), not strict.
   */
  fiAge: number | null
  /**
   * Amount needed in projection-start-year dollars today so that, with no
   * further contributions, discrete real growth from the start year to
   * retirement age reaches `fiNumber`. Growth rate is the simple real return
   * `defaultReturnPct/100 − inflationPct/100` (`plan.assumptions.defaultReturnPct`
   * and `plan.assumptions.inflationPct`, the general rate, not the healthcare
   * extra). Horizon is whole years to the household's later retirement:
   * `max(0, retirementYear − startYear)`, with `retirementYear` as for
   * `fiNumber` (for one person this is `retirementAge − (startYear −
   * birthYear)`). Already at or past that year ⇒ 0-year horizon ⇒ this equals
   * `fiNumber`. Compounding is
   * discrete annual (`Math.pow`), not continuous. No rounding or floor.
   *
   * Formula: coastFireNumber = fiNumber / (1 + defaultReturnPct/100 − inflationPct/100)^max(0, retirementYear − startYear)
   *
   * Reads upstream `fiNumber`; null when `fiNumber` is. An empty ledger has
   * no extra fallback here beyond whatever `fiNumber` already published.
   *
   * Note: real return is a subtraction of the two rates, not the Fisher
   * `(1+r)/(1+i)−1`; the horizon is retirement age, not the FI-number spending
   * year, so a ledger that ends before retirement still discounts to retirement
   * while `fiNumber` may have fallen back to the first ledger year's spending.
   */
  coastFireNumber: number | null
  /** Which year and which outflows `fiNumber` (and so `fiYear`, `fiAge` and `coastFireNumber`) prices. */
  fiBasis: FiBasis
}

/**
 * Where the FI number's spending base came from.
 * - `projection`: the plan converts to Roth in no year; the spending year's
 *   own `expenses.total + tax + penalties`.
 * - `conversionFreeProjection`: the plan converts to Roth in some year; the
 *   spending year's outflows from the plan run with its Roth conversions
 *   removed, so neither a conversion's one-off tax nor what it costs in later
 *   years (the two-year IRMAA lookback, a taxable account drained to pay the
 *   tax) is priced as spending, whichever year the conversion fell in.
 * - `conversionTaxIncluded`: the plan converts and the caller supplied no
 *   conversion-free run, so the spending year may carry conversion costs. No
 *   planner page shows a figure on this basis; a caller that shows one should
 *   pass `conversionFreeRun`.
 * - `baseAnnual`: the ledger is empty; `plan.expenses.baseAnnual` alone.
 * - `noRetirementInPlan`: nobody in the household retires in the plan, so no
 *   FI number is priced (`fiBasis.notRetiring` says who and why).
 */
export type FiSpendingSource = 'projection' | 'conversionFreeProjection' | 'conversionTaxIncluded' | 'baseAnnual' | 'noRetirementInPlan'

export interface FiBasis {
  /** The calendar year priced; null for an empty ledger or when nobody retires in the plan. */
  spendingYear: number | null
  spendingSource: FiSpendingSource
  /**
   * The person whose retirement is the household's later one
   * (projection/householdRetirement.ts): `fiAge` is this person's age, and
   * `retirementYear` is theirs. Null when nobody retires in the plan (or the
   * household has no people, which a parsed plan never has).
   */
  personId: string | null
  /** That person's retirement year under `retirementRule`. */
  retirementYear: number | null
  /**
   * Which rule gave the retirement year: a retirement age (`retirementAge`),
   * the first year without wages paid past it (`wagesPastRetirementAge`), the
   * first year without wages for a person with no retirement age
   * (`wagesEnd`), or the start year (`startYear`).
   */
  retirementRule: RetirementYearRule | null
  /** That person's last year alive at the planning age. */
  personLastYearAlive: number | null
  /**
   * The people who never retire in the plan, left out of the household's
   * later retirement (projection/householdRetirement.ts), in the canonical
   * people order: a page says who works through the plan and whose
   * retirement is priced instead, or, when nobody retires, why no FI number
   * is priced.
   */
  notRetiring: readonly PersonRetirement[]
}

export interface SummarizeProjectionOptions {
  /**
   * Runs the same plan with its Roth conversions removed
   * (`withoutRothConversions(plan)`) on the options the projection itself ran
   * on; `conversionFreeRun(plan, opts)` builds it. Called at most once, and
   * only when the plan converts to Roth in some year.
   *
   * Required, and null only by the caller's own choice (the independent
   * review's M3): a caller that passes null gets, for a converting plan, an FI
   * base that may carry conversion costs, published as
   * `fiBasis.spendingSource: 'conversionTaxIncluded'`, and must not show that
   * FI figure without saying so. Every caller in this repository decides here.
   */
  readonly conversionFreeRun: (() => ProjectionResult) | null
}

/**
 * The plan with its voluntary Roth conversions removed: the conversion
 * strategy set to `none`, every named or legacy-aggregate Roth-conversion
 * request dropped, and every withdrawal request a dropped conversion names as
 * its tax funding (`linkedWithdrawal`) dropped with it, since it exists only
 * to pay that conversion's tax. Nothing else changes.
 */
export function withoutRothConversions(plan: Plan): Plan {
  const actions = plan.strategies.retirementActions
  const taxFundingIds = new Set(
    actions.flatMap((action) =>
      action.kind === 'rothConversion' && action.taxFunding.kind === 'linkedWithdrawal'
        ? [action.taxFunding.withdrawalActionId]
        : [],
    ),
  )
  return {
    ...plan,
    strategies: {
      ...plan.strategies,
      rothConversion: { mode: 'none' },
      retirementActions: actions.filter(
        (action) =>
          action.kind !== 'rothConversion' &&
          action.kind !== 'legacyAggregateRothConversion' &&
          !taxFundingIds.has(action.actionId),
      ),
    },
  }
}

/**
 * The conversion-free run for `summarizeProjection`: `withoutRothConversions(plan)`
 * simulated on `opts`, without the capture sinks (they observe the real run only).
 */
export function conversionFreeRun(plan: Plan, opts: SimulateOptions): () => ProjectionResult {
  return () => {
    const counterfactual: SimulateOptions = { ...opts }
    delete counterfactual.captureOptimizerInputs
    delete counterfactual.annualCounterfactual
    delete counterfactual.captureAnnualCashFlow
    return simulatePlan(withoutRothConversions(plan), counterfactual)
  }
}

/** A year carries a Roth conversion when it converts, or when a named conversion request was executed or refused in it. */
function yearConverts(year: ProjectionResult['years'][number]): boolean {
  return year.rothConversion > 0 || year.rothConversionActionExecution !== undefined
}

export function summarizeProjection(
  plan: Plan,
  result: ProjectionResult,
  options: SummarizeProjectionOptions,
): ProjectionSummary {
  let taxes = 0
  let conversions = 0
  for (const y of result.years) {
    taxes += y.tax + y.penalties
    conversions += y.rothConversion
  }
  const endingByCategory = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0 }
  const last = result.years[result.years.length - 1]
  if (last) {
    // The one roll-up of balances by category (one value per logical account
    // id), read for the last row; equity compensation is not one of these five.
    const lastByCategory = balancesByCategory(plan, last)
    endingByCategory.cash = lastByCategory.cash
    endingByCategory.taxable = lastByCategory.taxable
    endingByCategory.traditional = lastByCategory.traditional
    endingByCategory.roth = lastByCategory.roth
    endingByCategory.hsa = lastByCategory.hsa
  }

  // --- estate depth (guaranteed-income-and-estate-depth) --------------------
  // Discount each account's ending balance on the way to heirs/charity, so the
  // summary can explain how every class was treated. Pre-tax classes are taxed
  // at a class heir rate (heirTaxByClass override, else the flat heirTaxRatePct);
  // charity carve-outs pass untaxed; Roth/taxable (stepped-up)/cash pass free.
  // With no beneficiary fields set anywhere the defaults reproduce the old flat
  // haircut exactly, so existing plans stay byte-identical.
  // Scope: the breakdown covers investable account classes only. Property,
  // debts, TIPS-ladder face, insurance cash value, and any HECM loan (already
  // netted into endingNetWorth with its non-recourse cap) ride through
  // netWorth without per-account rows here, so the breakdown's rows sum to
  // the investable slice of the estate, not the whole headline figure.
  const flatHeirRate = plan.assumptions.heirTaxRatePct / 100
  const heirRateFor = (category: EstateAccountBreakdown['category']): number => {
    const byClass = plan.assumptions.heirTaxByClass
    if (category === 'traditional' && byClass?.traditional !== undefined) return byClass.traditional / 100
    if (category === 'hsa' && byClass?.hsa !== undefined) return byClass.hsa / 100
    return flatHeirRate
  }
  // Nondeductible IRA basis is excluded from the taxable pretax base.
  // estateTraditionalTaxableBase spreads the household remaining-basis scalar
  // across traditional accounts by gross; that allocation is the registered
  // approximation of assumed future income-tax exposure, not a death-year
  // owner-wide IRA computation.
  const estateBreakdown: EstateAccountBreakdown[] = []
  if (last) {
    for (const account of selectedLogicalBalanceAccounts(plan.accounts)) {
      // Equity comp is stepped-up at death like a taxable account, and it is part
      // of ending net worth, so it must appear in the breakdown (and honor a
      // charity destination) to keep endingAfterTaxEstate consistent — otherwise
      // it would silently pass untaxed but be un-markable and invisible here.
      const category = (account.type === 'equityComp' ? 'taxable' : account.type) as EstateAccountBreakdown['category']
      if (!(category in endingByCategory)) continue
      const grossBalance = last.balances[account.id] ?? 0
      if (grossBalance <= 0) continue
      const { destination, charityPct } = resolveEstateDestination(account)
      let taxablePretaxBase = 0
      if (category === 'traditional') {
        taxablePretaxBase = estateTraditionalTaxableBase(
          grossBalance,
          endingByCategory.traditional,
          result.endingNondeductibleIraBasis,
        )
      } else if (category === 'hsa') {
        // Spouse continuation is a zero inclusion; any other modeled destination
        // uses ending gross as the terminal base (expense reduction omitted).
        taxablePretaxBase = estateHsaIncomeBase(grossBalance, destination)
      }
      const heirTaxRatePct = heirRateFor(category) * 100
      const charityFraction = destination === 'charity' ? Math.min(1, charityPct / 100) : 0
      const charityAmount = grossBalance * charityFraction
      // Spouse destinations carry no terminal income-tax haircut under the
      // valuation convention; other destinations apply the assumed class rate to
      // the non-charity slice of the pre-tax base.
      const heirTax = destination === 'spouse' ? 0 : taxablePretaxBase * (1 - charityFraction) * heirRateFor(category)
      estateBreakdown.push({
        accountId: account.id,
        name: account.name,
        category,
        grossBalance,
        destination,
        taxablePretaxBase,
        heirTaxRatePct,
        charityAmount,
        heirTax,
        netToHeirs: grossBalance - charityAmount - heirTax,
      })
    }
  }
  const heirTax = estateBreakdown.reduce((sum, b) => sum + b.heirTax, 0)
  const estateToCharity = estateBreakdown.reduce((sum, b) => sum + b.charityAmount, 0)

  // FIRE metrics computation
  const startYear = result.startYear
  const inflationRate = plan.assumptions.inflationPct / 100
  const defaultReturn = plan.assumptions.defaultReturnPct / 100
  const realReturn = defaultReturn - inflationRate

  // The household's later retirement (decision D-PEOPLE-ORDER, rule R4; one
  // rule with the funded ratio, projection/householdRetirement.ts): the FI
  // figures are household figures, so they price the year the last person
  // retires, never whoever is listed first. A person with no retirement age
  // retires in the first year without their wages, else in the start year;
  // a person who works through the plan is left out, and when nobody retires
  // in the plan no FI figure is priced (the independent review's N3).
  const household = householdRetirement(plan, startYear)
  const retirement = household.retirement
  const fiPerson = retirement === null ? undefined : plan.household.people.find((p) => p.id === retirement.personId)
  const birthYear = fiPerson ? isoYear(fiPerson.dob) : 1980
  const targetYear: number | null = retirement ? retirement.year : null

  // 1. Savings rates
  const savingsRates = result.years.map((y) => {
    const savings = y.contributions + y.employerMatch + y.surplusInvested
    const gross = y.incomes.total
    const ratePct = gross > 0 ? Math.max(0, Math.min(100, (savings / gross) * 100)) : 0
    return { year: y.year, ratePct }
  })

  // 2. Average pre-retirement savings rate
  const preRetirementRates = savingsRates.filter((r) => targetYear === null || r.year < targetYear)
  const averagePreRetirementSavingsRatePct =
    preRetirementRates.length > 0
      ? preRetirementRates.reduce((acc, r) => acc + r.ratePct, 0) / preRetirementRates.length
      : 0

  // 3. FI Number. The spending year's outflows, or, when the plan converts to
  // Roth in any year, the same year's outflows from the conversion-free run
  // (decision D-FI-CONVERSION-TAX): a conversion's tax is paid once, and so are
  // the costs it causes later, such as the IRMAA surcharge its MAGI sets two
  // years on or a taxable account it drained. Dividing any of them by the
  // withdrawal rate would price them as spending every year, so a plan that
  // converts earlier than the spending year is read the same way; a
  // conversion after it cannot reach it, and reading the free run then
  // changes nothing. Converting more can therefore never lower the figure.
  const targetResult = targetYear === null
    ? undefined
    : result.years.find((y) => y.year === Math.max(startYear, targetYear)) ?? result.years[0]
  let fiSpendingSource: FiSpendingSource = targetYear === null
    ? 'noRetirementInPlan'
    : targetResult === undefined ? 'baseAnnual' : 'projection'
  let pricedYear: ProjectionResult['years'][number] | undefined = targetResult
  if (targetResult !== undefined && result.years.some(yearConverts)) {
    if (options.conversionFreeRun === null) {
      fiSpendingSource = 'conversionTaxIncluded'
    } else {
      const counterfactualYear = options.conversionFreeRun().years.find((y) => y.year === targetResult.year)
      if (counterfactualYear === undefined) {
        throw new Error(`The conversion-free run has no year ${targetResult.year}, the FI number's spending year`)
      }
      pricedYear = counterfactualYear
      fiSpendingSource = 'conversionFreeProjection'
    }
  }
  const nominalSpendingAtFI = pricedYear
    ? spendingWithTaxAndPenalties(pricedYear)
    : plan.expenses.baseAnnual
  const yearsToFIYear = targetResult ? targetResult.year - startYear : 0
  const annualSpendingAtFIToday = nominalSpendingAtFI / Math.pow(1 + inflationRate, yearsToFIYear)
  const swr = (plan.assumptions.safeWithdrawalRatePct ?? 4) / 100
  const fiNumber = targetYear === null ? null : annualSpendingAtFIToday / swr

  // 4. FI Year and Age
  let fiYear: number | null = null
  let fiAge: number | null = null
  for (const y of fiNumber === null ? [] : result.years) {
    const deflatedInvestable = y.investableTotal / Math.pow(1 + inflationRate, y.year - startYear)
    if (deflatedInvestable >= fiNumber!) {
      fiYear = y.year
      fiAge = y.year - birthYear
      break
    }
  }

  // 5. Coast FIRE Number
  const coastFireNumber = fiNumber === null || targetYear === null
    ? null
    : fiNumber / Math.pow(1 + realReturn, Math.max(0, targetYear - startYear))

  return {
    lifetimeTaxesAndPenalties: taxes,
    lifetimeRothConversions: conversions,
    endingInvestable: result.endingInvestable,
    endingNetWorth: result.endingNetWorth,
    // What heirs receive: net worth less heir tax and less any charitable
    // bequests (charity leaves the heirs' estate but is never taxed). With no
    // charity destination this equals net worth − heir tax, as before.
    endingAfterTaxEstate: result.endingNetWorth - estateToCharity - heirTax,
    endingEstateHeirTax: heirTax,
    endingEstateToCharity: estateToCharity,
    estateBreakdown,
    endingByCategory,
    depletionYear: result.depletionYear,
    warnings: result.warnings,
    savingsRates,
    averagePreRetirementSavingsRatePct,
    fiNumber,
    fiYear,
    fiAge,
    coastFireNumber,
    fiBasis: {
      spendingYear: targetResult?.year ?? null,
      spendingSource: fiSpendingSource,
      personId: retirement?.personId ?? null,
      retirementYear: retirement?.year ?? null,
      retirementRule: retirement?.rule ?? null,
      personLastYearAlive: retirement?.lastYearAlive ?? null,
      notRetiring: household.notRetiring,
    },
  }
}

export interface RothComparison {
  withConversions: ProjectionSummary
  withoutConversions: ProjectionSummary
}

/** Runs the plan as-is and with conversions disabled, for side-by-side display. */
export function compareRothConversion(plan: Plan, opts: SimulateOptions): RothComparison {
  const disabled: Plan = {
    ...plan,
    strategies: { ...plan.strategies, rothConversion: { mode: 'none' } },
  }
  return {
    withConversions: summarizeProjection(plan, simulatePlan(plan, opts), {
      conversionFreeRun: conversionFreeRun(plan, opts),
    }),
    withoutConversions: summarizeProjection(disabled, simulatePlan(disabled, opts), {
      conversionFreeRun: conversionFreeRun(disabled, opts),
    }),
  }
}

export interface LtcStressComparison {
  /** No care episode, LTC policies held out — the premium-neutral baseline. */
  noCare: ProjectionSummary
  /** The care episode occurs and is fully self-funded (LTC policies removed). */
  careUninsured: ProjectionSummary
  /** The care episode occurs with the plan's LTC policies (premiums + benefits). */
  careInsured: ProjectionSummary
  /**
   * How long the money lasts in each of the three runs, in the one published
   * convention (projection/moneyLasts.ts): the last fully funded year and the
   * first short year, so the page names the same years every other surface does.
   */
  lasts: { noCare: MoneyLasts; careUninsured: MoneyLasts; careInsured: MoneyLasts }
  hasCareEvents: boolean
  hasLtcPolicy: boolean
}

/**
 * The "LTC stress" comparison: how a deterministic care episode hits the plan,
 * and what the LTC policy does about it.
 *
 * noCare and careUninsured both hold LTC out, so they differ only by the care
 * episode — `noCare − careUninsured` is the raw care shock, free of premium
 * effects. careInsured adds the policies back, so `careInsured − careUninsured`
 * is the policy's value *net of its premiums* (it can be negative if lifetime
 * premiums exceed the benefits paid). The UI labels it as such.
 */
export function compareLtcStress(plan: Plan, opts: SimulateOptions): LtcStressComparison {
  const run = (p: Plan) => {
    const result = simulatePlan(p, opts)
    return { summary: summarizeProjection(p, result, { conversionFreeRun: null }), lasts: moneyLasts(result) }
  }
  const withoutLtc = plan.insurance.filter((i) => i.kind !== 'ltc')
  const noCare = run({ ...plan, careEvents: [], insurance: withoutLtc })
  const careUninsured = run({ ...plan, insurance: withoutLtc })
  const careInsured = run(plan)
  return {
    noCare: noCare.summary,
    careUninsured: careUninsured.summary,
    careInsured: careInsured.summary,
    lasts: { noCare: noCare.lasts, careUninsured: careUninsured.lasts, careInsured: careInsured.lasts },
    hasCareEvents: plan.careEvents.length > 0,
    hasLtcPolicy: plan.insurance.some((i) => i.kind === 'ltc'),
  }
}
