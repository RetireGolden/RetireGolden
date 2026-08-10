import type { AssetClassId } from '../model/plan.js'
import type { FilingStatus } from '../params/types.js'
import type {
  AccountId,
  AnnualIraBasisAllocationEvidence,
  AnnualIraBasisRatio,
  AnnualQcdExecutionPrerequisiteEvidence,
  AnnualRetirementActionPublication,
  ExecuteAnnualQcdsResult,
  ExecuteConversionLinkedWithdrawalGroupsResult,
  ExecuteOrdinaryWithdrawalsResult,
  ExecuteRothConversionsResult,
  PersonId,
  PlanId,
  UsdCents,
} from '../actions/index.js'
import type { FederalTaxDetail } from '../tax/federalTax.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from './annualRetirementRuntimeJournal.js'
import type { CompleteSimulatorOwnedNonRothIraAnnualObservation } from
  './ownedNonRothIraAnnualObservation.js'

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
  /** Signed realized long-term capital result; losses are negative. */
  capitalGains: number
  /** Raw signed capital result before federal carryforward netting; used by nonconforming states. */
  realizedCapitalGainsBeforeCarryforward?: number
  /** Taxable interest generated in taxable brokerage accounts (already included in ordinaryIncome). */
  taxableInterestIncome?: number
  /**
   * Federally tax-exempt interest. Not ordinary income, but included in Social
   * Security provisional income and program-specific ACA household MAGI. May be
   * contract-supplied (ACA attestation) or account-generated from taxable
   * brokerage `taxExemptInterestYieldPct`.
   */
  taxExemptInterest?: number
  /**
   * Income excluded from AGI under the foreign and possessions exclusions —
   * §911 foreign earned income and housing, and §931/§933 possessions income
   * (American Samoa, Guam, the Northern Marianas, Puerto Rico), which is not
   * "foreign earned" in the §911 sense but is excluded all the same. The engine
   * carries one figure for all of them.
   *
   * It is not ordinary taxable income and never enters the AGI line, but three
   * separate definitions reach past AGI to pick it back up: IRC §86 puts it
   * into Social Security provisional income, §1411(d) and
   * §151(d)(5)(C)(iii)(II) put it into the modified AGI that prices the NIIT
   * threshold and the senior-deduction phase-out, and ACA household MAGI
   * carries it too. Omitting it therefore understates tax and overstates the
   * senior deduction at once — supply it whenever the household claims any of
   * those exclusions, not only when Social Security is in play.
   */
  foreignExclusionAddback?: number
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
  /**
   * Cumulative general-inflation factor from the parameter pack's year to this
   * one, used to project the annually-indexed federal figures (rate brackets,
   * standard deduction, capital-gain breakpoints, AMT amounts) onto a year the
   * pack only stands in for. 1 -- the default -- means "use the pack as
   * published", which is right for a year that has its own pack.
   *
   * The projection is nominal, so omitting this measures inflated income
   * against frozen thresholds and invents bracket creep the statute does not
   * create. Unindexed figures (sections 86, 1411, 121, 1211(b), 151(d)(5)(C),
   * and the 164(b)(7) SALT schedule) ignore it by construction.
   */
  inflationScale?: number
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
/**
 * One account's committed retirement-action balance movement in a probe year.
 *
 * The exact-cent action executors debit and credit NAMED accounts, while the
 * optimizer collapses the portfolio into four bucket scalars. Reporting the
 * movement per account — rather than pre-bucketed — keeps the bucket taxonomy
 * in the one place that already owns it (`buildOptimizerInput`), so the two
 * cannot drift into disagreeing about which bucket an account belongs to.
 *
 * One entry per account, even where two executors named the same one: an
 * ordinary withdrawal and a conversion can both draw the same IRA in a year,
 * and their exact cents are summed before the single dollar conversion.
 */
export interface OptimizerCommittedActionAccountMovement {
  accountId: string
  /**
   * Signed plan dollars, closing − opening: a withdrawal from this account is
   * NEGATIVE. Zero-movement accounts are omitted entirely.
   */
  amount: number
}

/**
 * One account's already-applied balance movement from a plan STRATEGY, in a
 * probe year.
 *
 * Same shape and same purpose as the committed-action movement above — dollars
 * the exact ledger has already moved, which the solver may not re-decide — and
 * deliberately a separate channel rather than a widening of that one.
 * `committedActionAccountMovement` is the exact-cent retirement-action
 * executors' report and nothing else; a scalar strategy that moves a balance is
 * not an action and reporting it there would make that field's name untrue.
 *
 * The producers are named on `OptimizerYearProbe.exogenousStrategyAccountMovement`.
 */
export interface OptimizerExogenousStrategyAccountMovement {
  accountId: string
  /**
   * Signed plan dollars: a debit from this account is NEGATIVE. Zero-movement
   * accounts are omitted entirely.
   */
  amount: number
}

export interface OptimizerYearProbe {
  year: number
  /**
   * Balance movement the exact-cent retirement-action executors COMMITTED this
   * year, per account, sorted by account id; empty in a year with no committed
   * action movement (which is every year of an action-free plan).
   *
   * All three moving executors report here: ordinary withdrawals (a debit,
   * paired with `committedActionProceeds` below), named Roth conversions (a
   * debit per executed allocation and a credit to the named destination, no
   * proceeds), and named QCDs (a debit only — the gift leaves the household).
   *
   * Without this the LP's balance recursion carries a portfolio the exact
   * ledger never holds: an executor debits the named source inside `simulate`
   * while the solver evolves opening buckets that never saw the debit. Worse
   * than fully blind — the action's tax consequence is already priced, by
   * `capitalGainsBase` for a taxable withdrawal and by
   * `forcedDistributionOrdinaryIncomeExclusion` for a gift routed out of an
   * RMD, so the solve pays for the action and keeps its dollars.
   */
  committedActionAccountMovement: readonly OptimizerCommittedActionAccountMovement[]
  /**
   * Balance movement a plan STRATEGY already applied this year, per account,
   * sorted by account id.
   *
   * FIVE producers, enumerated rather than described by a rule, so the field
   * makes no universal claim it cannot enforce. Four debit and one credits:
   *   1. the aggregate `strategies.qcdAnnual` gift taken BEYOND the year's
   *      owned-IRA RMD (`simulate.ts`, the `beyondRmd` loop). The dollars leave
   *      the household; its charitable exclusion reaches the LP separately, as
   *      `forcedDistributionOrdinaryIncomeExclusion` below.
   *   2. a 72(t) SEPP series payment, which debits its account every series
   *      year. Its ordinary income is already booked inside
   *      `ordinaryIncomeBase` and the LP re-decides none of the movement —
   *      `incumbentTraditionalDistribution` excludes `seppTotal` — so income
   *      was charged with no debit until this carried it.
   *   3. an annuity purchase premium, which leaves an LP bucket for a contract
   *      the LP does not carry.
   *   4. a TIPS-ladder purchase, the same transfer in the same direction (its
   *      own block says so): the price leaves an LP bucket for a ladder the LP
   *      carries in no bucket, and the rungs pay back through
   *      `incomes.tipsLadder`, already inside `exogenousCash`.
   *   5. an elected pension lump sum, which rolls the commuted offer INTO the
   *      named traditional account (`simulate.ts`, the `rolloverInflow` block)
   *      while the pension stream stops paying. The LP already saw the stream
   *      vanish out of `exogenousCash`; booking only that half made the solve
   *      poorer than the household by the whole offer, for the rest of the
   *      horizon.
   *
   * NOT reported here, and correctly so: the RMD-routed part of the same gift.
   * Those dollars leave through the RMD, which the LP re-decides as its own
   * `wt` variable, so booking them here would debit the bucket twice. Their
   * CASH side is `forcedDistributionCashDiversion` below, which is a different
   * kind of correction — a credit the LP made on its own variable, not a
   * movement this channel could report.
   *
   * KNOWN AND ABSENT, and one class rather than a list: cash and value crossing
   * between the household and an asset the LP carries in NO bucket, where there
   * is no far side for it to book. A planned property sale's net proceeds
   * (`propertySaleProceedsTotal` in `baseCashInflows`, and the legacy
   * `expectedNetProceeds` deposit in the property-events block) — whose GAIN
   * the LP is already charged, through `preWithdrawalCapitalResult` into
   * `capitalGainsBase`; a permanent-life death benefit deposited by the
   * insurance block; and a HECM draw (`hecmDraw`).
   *
   * ALL FOUR OMISSIONS — the two property-sale paths, the HECM draw, and
   * the death benefit — RUN IN THE SAME DIRECTION: they make the solve POORER
   * than the household, which is why omitting them is the conservative answer
   * until the channel and the bucket that would carry them exist. The HECM draw
   * is measured, not assumed — the draw funds the ledger's own spending while
   * the probe reports `exogenousCash` of 0 and the full `spendingNeed`, so the
   * LP funds the whole year out of buckets the household never had to touch.
   * What is special about it is not its direction but its FIX: booking the
   * draw's cash ALONE, with no bucket for the loan balance it creates and
   * accrues, would flip the solve from poorer to richer and hand it a line of
   * free money it never repays. That is why it needs a debt bucket rather than
   * a cash credit, and why it cannot ride this channel. A separate slice.
   *
   * Read back off what each producer published — the year's runtime
   * OCCURRENCES for the gift, the series and the lump sum (the occurrence is
   * emitted at the mutation site for every account shape the block can reach,
   * where the runtime APPLICATION is gated on `isAggregatedIra`: a SEPP may run
   * on an employer plan and a lump sum may roll into one), and a mutation-site
   * capture for the two purchases (the annuity premium's occurrence is emitted
   * only for a traditional funding source, and a TIPS-ladder purchase publishes
   * none at all). Never re-derived from the strategy or election that asked, so
   * a movement the arm capped, truncated, skipped as sub-cent, or could not
   * fund reports what actually moved and nothing more.
   */
  exogenousStrategyAccountMovement: readonly OptimizerExogenousStrategyAccountMovement[]
  /**
   * Gross cash those strategy movements delivered into this year's cash flow.
   *
   * Only the 72(t) series delivers any: it is a withdrawal, so it REALLOCATES
   * between buckets, and the ledger's `baseCashInflows` carries `+ seppTotal`.
   * Debiting it without this credit would make the solver poorer than the
   * household by the whole series payment, every year.
   *
   * The other four producers deliver none, and the asymmetry is the point: a
   * gift leaves, the two purchases buy instruments that pay back later through
   * `incomes.annuity` and `incomes.tipsLadder` (both already inside
   * `exogenousCash`), and a pension lump sum is a DIRECT rollover that never
   * passes through the household's hands.
   */
  exogenousStrategyProceeds: number
  /**
   * Charitable exclusion riding on this year's forced owned-IRA distribution:
   * `qcdIncomeOffset + namedQcdIncomeOffset`, capped at the taxable forced
   * total, zero in a year no gift routed out of an RMD.
   *
   * The LP re-decides the forced distribution as its own `wt` variable and
   * charges ordinary income on every dollar of it, so the exclusion cannot ride
   * inside `ordinaryIncomeBase` — that field is what remains AFTER the forced
   * distributions are netted out. It reached the LP as a negative residue until
   * this term existed, and the base's `Math.max(0, …)` guard (written for
   * pre-tax contributions exceeding wages) deleted the residue outright
   * whenever non-forced income was smaller than the gift.
   *
   * §408(d)(8) is why it belongs on the LP's MAGI path and not only its bracket
   * path: an excluded distribution is out of gross income entirely, so it is
   * out of MAGI, which is most of what a QCD is for.
   *
   * The aggregate arm contributes the routed GROSS, not a share of it, because
   * §408(d)(8)(D) deems the gift to consist of otherwise-includible dollars up
   * to the owner's aggregate includible amount. The cap above still holds — the
   * required distribution's line-7 gross has the gift carved out of it before
   * any basis is recovered, so the basis recovered can never reach the gift.
   */
  forcedDistributionOrdinaryIncomeExclusion: number
  /**
   * Cash the ledger's own inflows netted back OUT of this year's forced
   * owned-IRA distribution because it went to a charity instead of the
   * household: `qcdFromRmd + namedQcdRmdSatisfied`, capped at the forced total,
   * zero in a year no gift routed out of an RMD.
   *
   * The sibling of `forcedDistributionOrdinaryIncomeExclusion` on the other
   * side of the same gift, and the reason both are needed: an exclusion takes
   * dollars out of INCOME, this takes the same dollars out of SPENDABLE MONEY,
   * and a QCD routed out of an RMD does both. `baseCashInflows` books
   * `+ rmdTotal − qcdFromRmd − namedQcdRmdSatisfied`; the LP re-decides the
   * whole forced distribution as `wt` and credits it at 1.0, so without this
   * the solve funds spending out of dollars the household gave away — and
   * every gifted dollar it spends is a dollar it never withdrew, so the buckets
   * it carries forward are too large as well.
   *
   * THE GROSS, not the qualified share, and still deliberately a separate
   * figure from the exclusion. Every routed dollar left the cash flow; only the
   * part that qualified under §408(d)(8)(D) left income. They cannot
   * double-adjust: they are subtracted from different constants on different
   * sides of the model.
   *
   * THEY COINCIDE ON THE ORDINARY HOUSEHOLD, and separate only past the
   * statutory ceiling. §408(d)(8)(D) deems the gift to consist of
   * otherwise-includible dollars up to the owner's AGGREGATE includible amount
   * — all of their individual retirement plans treated as one contract, less
   * basis — so wherever the IRAs hold more pre-tax dollars than the gift, the
   * qualified amount IS the gross and both fields carry the same number. On a
   * near-all-basis IRA the gift outruns that amount, the excess is not a QCD,
   * and the exclusion legitimately falls short of the cash the household still
   * gave away. Until 2026-08-07 they differed for a different and wrong reason:
   * `qcdIncomeOffset` capped at the required distribution's own taxable share.
   * That is fixed, and `irc-408-d-8-D-projection-qcd-after-pro-rata` on
   * `taxRuleRegistry.ts` is settled. This field is the GROSS and never moved.
   *
   * The gift's BEYOND-RMD part is not here. Those dollars never entered
   * `baseCashInflows`, so the LP never credited cash for them; they are on
   * `exogenousStrategyAccountMovement` as a bucket debit instead.
   *
   * IT CAN TURN AN OPTIMAL SOLVE INFEASIBLE, and that is the term working. A
   * gift-heavy plan whose exact ledger runs out of money used to return a
   * confident schedule built on the gifted dollars; taking that cash back
   * leaves some of those years with no way to fund spending at all, so the LP
   * now reports infeasible where the ledger depletes — the LP agreeing with its
   * own ledger instead of contradicting it. A sweep of the gift/spending/cash
   * grid moved 7 of 24 cells from optimal to infeasible on that account.
   */
  forcedDistributionCashDiversion: number
  /**
   * Ordinary income a COMMITTED named Roth conversion put on this year's return
   * — the taxable (post-§408(d)(2) pro-rata) part of what the conversion
   * executor actually moved, zero in a year no conversion action committed.
   *
   * Held apart from `ordinaryIncomeBase` because the two have opposite
   * treatments in the LP even though they sum in the ledger: the base is
   * exogenous income the solver prices around, while every OTHER conversion
   * dollar in the year is the solver's own `conv` variable. This is a
   * conversion the household has already made, so the solver may neither
   * re-decide nor avoid it — the LP stacks its own conversions on top (see
   * `OptimizerYear.committedOrdinaryIncome`).
   *
   * The NAMED authority only. The aggregate strategy's conversions are in the
   * same ledger figure (`totalRothConversionTaxable`) and are excluded here:
   * those are exactly what the LP re-decides, so including them would price a
   * conversion twice.
   *
   * No overlap with the year's other action income. An ordinary-withdrawal
   * action's income (`retirementActionOrdinaryIncome`) and a named QCD's offset
   * (`namedQcdIncomeOffset`) both already reach `ordinaryIncomeBase` through
   * `incomeBeforeConversion`; only conversions are excluded there, which is
   * exactly the hole this fills.
   */
  committedConversionOrdinaryIncome: number
  /**
   * Gross cash those committed actions delivered into this year's cash flow —
   * the ledger's own `retirementActionProceeds` term, which sits alongside RMDs
   * and property-sale proceeds in `baseCashInflows` and is NOT part of
   * `exogenousCash` below.
   *
   * The pair matters: an ordinary withdrawal REALLOCATES between buckets rather
   * than destroying net worth, so a debit booked without its matching cash
   * credit would make the solver poorer than the household actually is.
   */
  committedActionProceeds: number
  /**
   * Ordinary taxable income EXCLUDING any traditional-account distribution or
   * Roth conversion, plus the baseline taxable Social-Security portion (which
   * the LP holds fixed rather than re-deriving as conversions change).
   *
   * Forced distributions are netted out at their GROSS taxable figure, so any
   * charitable exclusion riding on them is NOT here — it is
   * `forcedDistributionOrdinaryIncomeExclusion` below. Netting them net of the
   * exclusion instead left it as a negative residue that this field's
   * nonnegative clamp then deleted.
   */
  ordinaryIncomeBase: number
  /** Total cash uses besides tax/penalties this year (expenses + contributions). */
  spendingNeed: number
  /** Non-account cash inflows this year (income streams: SS, pensions, etc.). */
  exogenousCash: number
  /** Forced RMD this year in the baseline (0 when not age-eligible). */
  rmd: number
  /** Taxable part of `rmd` after exact owned-IRA basis character. */
  rmdTaxable?: number
  /**
   * Gross incumbent owner-traditional distributions (forced plus
   * discretionary). Settlement uses this to distinguish an exact realized-flow
   * fraction from a no-flow marginal balance fraction.
   */
  incumbentTraditionalDistribution: number
  /**
   * Incumbent taxable share of gross owner-traditional withdrawals. The LP
   * applies this exact-ledger linearization to both forced and discretionary
   * dollars; absent preserves the historical all-taxable assumption.
   */
  traditionalWithdrawalTaxableFraction?: number
  /** Start-of-year owner-convertible traditional balance, used to recover the owner RMD divisor ratio. */
  startTraditional: number
  /**
   * Forced inherited-traditional distribution this year in the baseline
   * (traditional accounts only — Roth forced is excluded). Same meaning as
   * `YearResult.inheritedTraditionalDistribution`.
   */
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
   * Fixed non-taxable amounts included in §86 provisional income: characterized
   * ACA tax-exempt interest plus foreign earned-income/housing exclusions.
   */
  ssProvisionalIncomeAddbacks: number
  /**
   * The year's characterized tax-exempt interest as the realized-MAGI history
   * counts it (IRMAA lookback). Kept separate from `ssProvisionalIncomeAddbacks`
   * because §86 adds both exempt interest and the foreign exclusion while IRMAA
   * MAGI adds only the former.
   */
  magiTaxExemptInterest: number
  /**
   * Realized capital gains + qualified dividends at the probe run, EXCLUDING
   * gains from taxable-account withdrawals (the optimizer re-decides those as
   * its own variable, so including them would double-count). Counts toward the
   * SS phase-in's provisional income and IRMAA MAGI but is not in
   * `ordinaryIncomeBase`.
   */
  capitalGainsBase: number
  /**
   * Remaining actionable ACA MAGI room at the exact-ledger probe. Null when
   * no supported current-year ACA ceiling exists.
   */
  acaConversionMagiHeadroom: number | null
  /**
   * Incumbent value of the optimizer's modeled MAGI expression before the
   * gain-weighted taxable-withdrawal term. `buildOptimizerInput` applies the
   * same aggregate opening-basis coefficient used by the LP, rather than the
   * exact ledger's account-order-dependent realized gain.
   */
  incumbentModeledMagiBeforeTaxableWithdrawalGains: number
  /** Incumbent taxable/equity-comp withdrawal dollars (`wtax` in the LP). */
  incumbentTaxableWithdrawal: number
  /** Allowable PTC actually preserved by the exact-ledger probe, if modeled. */
  acaModeledAllowablePtc: number | null
  /** Exact-ledger cliff position used to decide whether a preservation bound is meaningful. */
  acaCliffState: YearAcaResult['cliffState'] | null
  /** Conversion already executed in the probe schedule for absolute-bound reconstruction. */
  incumbentRothConversion: number
  /**
   * Incumbent taxable share of gross Roth conversions after exact line-8 basis
   * character; absent preserves the historical all-taxable assumption.
   */
  rothConversionTaxableFraction?: number
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
  /** Federally tax-exempt interest generated by taxable accounts this year. Cash-real but never ordinary income; characterized per DOCS §20. */
  taxExemptInterest: number
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

export type AcaSupportCode =
  | 'actionable'
  | 'missing-year-contract'
  | 'duplicate-year-contract'
  | 'tax-family-member-unknown'
  | 'tax-family-structure-unsupported'
  | 'covered-member-duplicate'
  | 'medicare-overlap-unsupported'
  | 'slcsp-benchmark-missing'
  | 'benchmark-only-coverage-unsupported'
  | 'example-contract-input-mismatch'
  | 'dependent-filing-status-unknown'
  | 'dependent-modeled-person-overlap'
  | 'tax-exempt-interest-unknown'
  /** Informational — ACA MAGI tax-exempt interest came from plan-generated income, not household attestation; does not block actionability. */
  | 'tax-exempt-interest-plan-derived'
  /** Informational — contract attests none while plan accounts generate exempt interest; engine uses generated figure; does not block actionability. */
  | 'tax-exempt-interest-contract-contradicted'
  | 'foreign-exclusion-addback-unknown'
  | 'coverage-eligibility-unsupported'
  | 'form-8814-unsupported'
  | 'special-allocation-unsupported'
  | 'mfs-exception-unsupported'
  | 'self-employed-deduction-unsupported'
  | 'other-material-facts-unsupported'
  | 'below-100-fpl-exception-unsupported'
  | 'tax-year-parameters-unsupported'
  | 'guardrail-interaction-unsupported'
  | 'hsa-cap-fixed-point-nonconvergent'
  | 'conflicting-cliff-fixed-points'
  | 'fixed-point-nonconvergent'

export interface YearAcaResult {
  readiness: 'actionable' | 'nonActionable'
  supportCodes: AcaSupportCode[]
  /** Final return-year ACA household MAGI; null when material facts are unsupported. */
  householdMagi: number | null
  magiComponents: {
    federalAgi: number
    nontaxableSocialSecurity: number
    taxExemptInterest: number
    foreignExclusionAddback: number
    requiredFilerDependentMagi: number
  }
  fplRegion: 'contiguous' | 'alaska' | 'hawaii' | null
  federalPovertyLine: number | null
  fplPct: number | null
  taxFamilySize: number | null
  taxFamilyMembers: Array<{
    personId: string
    relationship: 'primary' | 'spouse' | 'dependent'
    requiredToFile: 'required' | 'notRequired' | 'unknown'
    magi: number
    includedMagi: number
  }>
  coveredMembers: Array<{
    personId: string
    coveredMonths: number[]
    grossEnrollmentPremium: number
    applicableSlcspPremium: number
  }>
  grossEnrollmentPremium: number
  applicableSlcspPremium: number | null
  /** Current-year planning result; not actual APTC cash/refund/balance-due reconciliation. */
  modeledAllowablePtc: number | null
  economicNetPremium: number
  aptcModeled: false
  form8962ReconciliationSupported: false
  cliffState: 'below-eligibility-floor' | 'below-cliff' | 'at-cliff' | 'above-cliff' | 'unsupported'
  convergence: {
    converged: boolean
    iterations: number
    maxIterations: number
    residualDollars: number
    grossPremiumFallback: boolean
  }
}

/**
 * One donor's share of a charitable gift routed out of a required distribution.
 *
 * IRC 408(d)(8)(D) is measured against ONE individual's retirement plans treated
 * as one contract, and each owner has their own Form 8606 denominator, so the
 * routed gift is only characterizable once it is charged to the owners whose
 * required distributions carried it. Both figures are published because they are
 * different amounts and answer different questions: the routed gross is what the
 * published annual QCD total is made of, and the qualified amount is the part of
 * it that (D) deems includible and that the Form 8606 line-7 instructions
 * therefore keep off line 7. They differ exactly where the gift ran past the
 * owner's aggregate includible amount, since the excess is not a QCD at all and
 * stays in the section 72 computation.
 */
export interface SimulatorAnnualRetirementLegacyQcdOwnerAttribution {
  readonly ownerPersonId: string
  /** Gross routed out of THIS owner's owned-IRA required distributions. */
  readonly routedGrossPlanDollars: number
  /**
   * The part of that routed gross which qualified under 408(d)(8)(D) and must
   * therefore leave this owner's Form 8606 line-7 gross and the annual
   * denominator built from it. Never greater than the routed gross.
   */
  readonly qualifiedLine7ExclusionPlanDollars: number
}

/**
 * How much of one moving charitable draw was a qualified charitable
 * distribution, and how much of it never was.
 *
 * IRC 408(d)(8)(B)'s closing sentence treats a distribution as a QCD "only to
 * the extent that the distribution would be includible in gross income", and
 * (D) caps that at the owner's aggregate includible amount. A draw past the cap
 * is an ordinary distribution: the Form 8606 line-7 instructions exclude
 * "Qualified charitable distributions (QCDs)" by name and nothing else, so the
 * unqualified part belongs on line 7, inside the line-9 denominator, recovering
 * basis pro rata.
 *
 * Published per occurrence rather than per owner because the replay prices Form
 * 8606 one occurrence at a time, and an owner-level remainder cannot say which
 * account's draw it was. The routed half of the same gift travels on the
 * nonmoving overlay instead, because it moves no dollars of its own and has no
 * occurrence to ride.
 */
export interface SimulatorAnnualRetirementLegacyQcdCharacterization {
  /** Exact key of the `legacyQcd` occurrence this characterizes. */
  readonly producerOccurrenceKey: string
  readonly ownerPersonId: string
  readonly grossAmountPlanDollars: number
  /**
   * The part of that gross which was NOT a qualified charitable distribution
   * and therefore stays on Form 8606 line 7. Never greater than the gross; zero
   * on the ordinary household, whose gift is inside its aggregate includible
   * amount.
   */
  readonly nonQualifiedLine7GrossPlanDollars: number
}

/**
 * The share of the published annual QCD total that moved no additional dollars
 * because an RMD debit already carried it out of the owned IRA. A gift taken
 * with no RMD behind it is not in here: it physically leaves an account and is
 * published as a `legacyQcd` runtime occurrence with its own application.
 *
 * It carries no single owner or source account because it is a household gift
 * spread over whichever required distributions funded it; `ownerAttributions`
 * is how the replay learns whose line-7 gross it shrinks, and it is what makes
 * this overlay replayable instead of a refusal.
 */
export interface SimulatorAnnualRetirementNonmovingLegacyQcdOverlay {
  readonly status: 'nonmovingLegacyQcdCaptured'
  readonly kind: 'legacyQcd'
  readonly taxYear: number
  readonly grossAmountPlanDollars: number
  /** Ascending by owner id, positive routed shares only, summing to the gross. */
  readonly ownerAttributions:
    readonly Readonly<SimulatorAnnualRetirementLegacyQcdOwnerAttribution>[]
  readonly physicalMovement: 'notAdditionalMovement'
  readonly inventoryReplay: 'attributedToOwnedIraRequiredDistributionGrosses'
}

export interface SimulatorAnnualRetirementRuntimeSource {
  readonly status: 'runtimeOccurrenceSourcesCaptured'
  readonly captureBoundary:
    'legacyAnnualPassCommittedBeforeYearResultPublication'
  readonly journalValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly runtimeOccurrences:
    readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[]
  readonly nonmovingLegacyQcdOverlay:
    Readonly<SimulatorAnnualRetirementNonmovingLegacyQcdOverlay> | null
  /**
   * One entry per `legacyQcd` occurrence, in the order the draws moved. Empty
   * in a year whose gift moved nothing on its own.
   */
  readonly legacyQcdCharacterizations:
    readonly Readonly<SimulatorAnnualRetirementLegacyQcdCharacterization>[]
}

export type SimulatorRetirementRuntimeApplicationPhase =
  | 'annuityPurchaseFunding'
  /**
   * The other half of the premium. `annuityPurchaseFunding` debits the IRA the
   * premium left; this credits the contract it arrived in, so the value the
   * Form 8606 line-6 aggregate has to carry is recorded where it went instead
   * of being inferred from where it came from.
   */
  | 'annuityPurchaseContractCredit'
  /**
   * A payment out of a contract an owned IRA bought. It runs after the premium
   * and before the year's contributions, which is where the projection's income
   * block sits, and it debits the contract's value channel rather than any IRA
   * balance.
   */
  | 'annuityContractDistribution'
  | 'pensionLumpSumRollover'
  | 'employeeContribution'
  | 'ownerRmdDistribution'
  | 'automaticSeppDistribution'
  | 'legacyQcdDistribution'
  | 'namedQcdDistribution'
  | 'namedRothConversionDebit'
  | 'namedRothConversionDestinationCredit'
  | 'legacyRothConversion'
  | 'legacyRothConversionAggregateDestinationCredit'
  | 'legacyNeedBasedWithdrawal'

interface SimulatorRetirementRuntimeApplicationBase {
  /** Exact key of the raw runtime occurrence that this mutation applied. */
  readonly producerOccurrenceKey: string
  /** Truthful simulator pass; not a civil date or authoritative schedule. */
  readonly simulatorPhase: SimulatorRetirementRuntimeApplicationPhase
  /** One-based order of captured retirement applications in this annual pass. */
  readonly mutationOrdinal: number
  /** Raw Plan identity is preserved; later replay rejects missing/invalid facts. */
  readonly ownerPersonId: string | null
  readonly sourceAccountId: string | null
  readonly sourceBalanceBeforePlanDollars: number
  readonly sourceBalanceAfterPlanDollars: number
}

export interface SimulatorRetirementRuntimeDebitApplication
  extends SimulatorRetirementRuntimeApplicationBase {
  readonly applicationKind: 'debit'
  readonly appliedAmountPlanDollars: number
}

export interface SimulatorRetirementRuntimeCreditApplication
  extends SimulatorRetirementRuntimeApplicationBase {
  readonly applicationKind: 'credit'
  readonly creditedAmountPlanDollars: number
}

export interface SimulatorRetirementRuntimeAggregateRothDestinationCredit {
  readonly applicationKind: 'aggregateRothDestinationCredit'
  readonly simulatorPhase: 'legacyRothConversionAggregateDestinationCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** Exact runtime occurrence keys whose debits produced this one legacy credit. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationRothAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationBalanceBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationBalanceAfterPlanDollars: number
}

/**
 * One named conversion's own destination credit.
 *
 * This is deliberately not the aggregate shape above. That one exists because
 * the legacy strategy has a single household destination and picks it by Plan
 * array position; a named request states its destination, so this credit
 * carries the `actionId` that chose it and is validated against that request's
 * `destinationRothAccountId` alone. Two requests in the same year therefore
 * produce two credits to two different Roth accounts, which the aggregate
 * shape cannot express.
 */
export interface SimulatorRetirementRuntimeNamedRothDestinationCredit {
  readonly applicationKind: 'namedRothDestinationCredit'
  readonly simulatorPhase: 'namedRothConversionDestinationCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** The named request whose committed movement produced this credit. */
  readonly actionId: string
  /** Exact runtime occurrence keys whose debits produced this one credit. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationRothAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationBalanceBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationBalanceAfterPlanDollars: number
}

/**
 * The credit side of an annuity premium paid out of an owned IRA.
 *
 * Shaped like the two Roth destination credits above, and for the same reason:
 * one physical movement has one occurrence, and a credit that rejoined that
 * occurrence a second time would break the replay's rule that each application
 * rejoins one unique occurrence. So the key travels in `producerOccurrenceKeys`
 * and this application carries no key of its own.
 *
 * What it credits is not a balance. A Plan annuity account has no balance field
 * and is not in the projection's ledger at all, so the destination figures
 * below are the engine's own contract-value channel: premium in, payments out,
 * floored at zero. That channel is a convention rather than a fair market
 * value, registered as
 * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
 */
export interface SimulatorRetirementRuntimeAnnuityContractPremiumCredit {
  readonly applicationKind: 'annuityContractPremiumCredit'
  readonly simulatorPhase: 'annuityPurchaseContractCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** Exactly one key: the `annuityFundingTransfer` debit that paid the premium. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationAnnuityAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationContractValueBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationContractValueAfterPlanDollars: number
}

export type SimulatorRetirementRuntimeApplication =
  | Readonly<SimulatorRetirementRuntimeDebitApplication>
  | Readonly<SimulatorRetirementRuntimeCreditApplication>
  | Readonly<SimulatorRetirementRuntimeNamedRothDestinationCredit>
  | Readonly<SimulatorRetirementRuntimeAnnuityContractPremiumCredit>
  | Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit>

/**
 * Cheap simulator-owned balance transitions captured at the actual owned,
 * non-inherited traditional-IRA mutation sites, plus the one unchanged legacy
 * aggregate Roth destination credit when those sources fund a conversion. A
 * later internal replay owns exact-cent conversion, occurrence/inventory
 * rejoining, validation, identity, and sealing.
 */
export interface SimulatorAnnualRetirementRuntimeApplicationSource {
  readonly status: 'runtimeApplicationSourcesCaptured'
  readonly captureBoundary:
    'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth'
  readonly applicationValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly applications:
    readonly Readonly<SimulatorRetirementRuntimeApplication>[]
}

export interface SimulatorOwnedNonRothIraPostGrowthAccountBalanceSource {
  readonly sourceAccountId: string
  readonly balancePlanDollars: number
}

/**
 * One annuity contract an owned IRA bought, and what the engine says it is
 * worth on December 31.
 *
 * Section 408(d)(2)(A) treats every individual retirement plan as one contract
 * for section 72 and Form 8606 line 6 asks for the total VALUE of the
 * traditional IRAs, so a contract bought with IRA dollars belongs in the
 * denominator whether it is a section 408(b) individual retirement annuity or
 * an annuity contract held inside the section 408(a) trust. No authority
 * supplies its fair market value here -- that is an actuarial quantity, and the
 * Form 1099-R instructions for 2026 stop requiring even the issuer to report
 * the year-end value of an annuitized commercial contract -- so this figure is
 * the engine's own convention: premium paid in, payments taken out, floored at
 * zero, with no growth because the Plan carries no contract growth rate.
 * Registered, with its direction of error, as
 * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
 */
export interface SimulatorOwnedNonRothIraPostGrowthAnnuityContractValueSource {
  readonly annuityAccountId: string
  /** The owned IRA whose dollars bought it, which is why it is in this pool. */
  readonly fundingAccountId: string
  /**
   * The channel as this year opened, which the replay needs for the same reason
   * it needs `plan.accounts[].balance`: a settlement that replays ONE year
   * cannot derive where a multi-year channel had got to. It is bounded rather
   * than trusted -- the value can never exceed the purchase premium, and it must
   * be exactly zero in a year at or before the purchase -- and every credit and
   * debit between it and the closing figure has to reconcile in exact cents.
   */
  readonly contractValueOpeningPlanDollars: number
  readonly contractValuePlanDollars: number
}

export interface SimulatorOwnedNonRothIraPostGrowthOwnerPoolSource {
  /** Null is preserved only for an unvalidated malformed Plan; replay must reject it. */
  readonly ownerPersonId: string | null
  readonly accountBalances:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthAccountBalanceSource>[]
  /**
   * This owner's IRA-funded annuity contracts, ascending by account id. Empty
   * for every owner who bought none, which is almost every owner. Absent
   * entirely on a year published before this channel existed, which the replay
   * treats as "no contracts" rather than as a missing fact, because a
   * projection with no annuity purchase in it has nothing to say here.
   */
  readonly annuityContractValues?:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthAnnuityContractValueSource>[]
}

/**
 * Cheap simulator-owned source facts captured from the live balance ledger
 * after every annual mutation and growth pass. A later internal replay owns
 * exact-cent conversion, pool validation, structural identity, and sealing.
 */
export interface SimulatorAnnualOwnedNonRothIraPostGrowthSource {
  readonly status: 'postGrowthOwnedNonRothIraBalancesCaptured'
  readonly captureBoundary:
    'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication'
  readonly annualObservationValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly ownerPools:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthOwnerPoolSource>[]
}

export interface SimulatorOwnedNonRothIraAggregateRothDestinationReplay {
  readonly status: 'aggregateDestinationCreditSourceReconciled'
  readonly destinationAttribution: 'aggregateOnlyNotSourceAllocated'
  readonly actionability: 'notEstablished'
  readonly destinationRothAccountId: AccountId
  readonly destinationOwnerPersonId: PersonId
  readonly destinationCreditedAmount: UsdCents
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly PersonId[]
  readonly evidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualOwnerReplay {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly openingBasisSource: 'planSeed' | 'priorYearCarryforward'
  readonly openingBasisAmount: UsdCents
  readonly taxYearNondeductibleContributionAmount: 0
  readonly postYearNondeductibleContributionExcludedAmount: 0
  readonly outstandingRolloverAmount: 0
  readonly rolloverRepaymentAdjustmentAmount: 0
  readonly annualObservation:
    Readonly<CompleteSimulatorOwnedNonRothIraAnnualObservation>
  readonly annualBasisRatio: Readonly<AnnualIraBasisRatio>
  readonly line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly nextYearOpeningBasisAmount: UsdCents
  readonly sourceChainEvidenceId: string
  readonly replayEvidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualReplay {
  readonly taxYear: number
  readonly ownerReplays:
    readonly Readonly<SimulatorOwnedNonRothIraAnnualOwnerReplay>[]
  /**
   * One credit per converting owner, not one per year. IRC 408(d)(3)(A)(i)
   * admits a conversion only between accounts held by the same individual, so
   * the aggregate strategy's household target is sliced by owner and each
   * slice lands in that owner's own Roth. The array is empty in a year with no
   * owned-IRA conversion.
   */
  readonly aggregateRothDestinationCredits:
    readonly Readonly<SimulatorOwnedNonRothIraAggregateRothDestinationReplay>[]
  readonly evidenceId: string
}

/**
 * Exact basis-character evidence published only after the private bounded
 * annual-pass controller commits an observed-versus-assumed exact match.
 * Commit here settles a simulator attempt; it does not establish legal
 * movement, filing completeness, or implementation actionability.
 */
export interface SimulatorCommittedOwnedNonRothIraAnnualReplay {
  readonly status: 'committedOwnedNonRothIraAnnualReplay'
  readonly settlement: 'exactReplayEffectsMatched'
  readonly evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'
  readonly filingCompleteness: 'notEstablished'
  readonly planId: PlanId
  readonly projectionStartTaxYear: number
  readonly taxYear: number
  readonly sourceSeriesEvidenceId: string
  readonly contiguousReplayEvidenceId: string
  readonly annualReplay: Readonly<SimulatorOwnedNonRothIraAnnualReplay>
}

/**
 * Per-account, per-year inherited-IRA execution evidence (WS4 exact ledger).
 * Regime law is produced solely by `classifyInheritedRegime` /
 * `inheritedRequirementForYear` in strategies/inheritedIra.ts — this surface
 * records what the ledger forced and what the planner took beyond that.
 */
export interface InheritedAccountYearEvidence {
  accountId: string
  /** The beneficiary person holding the account. */
  ownerPersonId: string
  /** InheritedRegimeKey | refusal key (e.g. legacy-planning-approximation). */
  regime: string
  matrixRow: string
  classification?: 'settled' | 'unsettled'
  /**
   * Present when the classifier refused (non-X1 → legacy fallback) OR when the
   * successor-clock / out-of-scope condition suppresses the schedule (matrix X2
   * beneficiary-death rows).
   */
  refusalReason?: string
  requirementKind: 'year-of-death-rmd' | 'annual-rmd' | 'none' | 'final-sweep' | 'legacy'
  /** Evidence amount on the real prior-Dec-31 balance (0 on the legacy path when forced is 0). */
  requiredAmount: number
  /** What the ledger actually forced (≤ live balance; entire balance on final-sweep). */
  executedRequiredAmount: number
  /** Planner draws beyond the requirement this year (need-based withdrawals). */
  voluntaryAmount: number
  divisor?: number
  divisorArm?: string
  noticeWaived?: boolean
  limitation?: string
  finalDeadlineYear?: number
  disclosures: string[]
  citations: string[]
}

/**
 * One owner's aggregated Roth-IRA pool activity for a projection year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive withdrawals or
 * credited contributions from plan schedules, household aggregates, or
 * `YearWithdrawals.roth` (which mixes inherited and employer Roth).
 */
export interface OwnedRothIraPoolActivity {
  /** Resolved owner id (`null` owner already resolves to the household primary). */
  ownerPersonId: string
  /** Withdrawals taken from this owner's aggregated Roth-IRA pool this year. */
  withdrawals: number
  /**
   * Contribution basis actually credited this year (post-limit `allowed`
   * amounts, not scheduled/configured figures).
   */
  creditedContributions: number
  /**
   * Conversion principal credited to this owner's Roth-IRA basis pool this year
   * (destination credits only). Starts the 5-taxable-year seasoning clock at
   * `conversionYear` (this projection year) — see `splitRothWithdrawal`.
   */
  creditedConversionPrincipal: number
  /**
   * Portion of `creditedConversionPrincipal` that was included in income at
   * conversion. The 10% recapture penalty on an unseasoned pre-59½ tap applies
   * only to this taxable share; the nontaxable remainder (nondeductible IRA
   * basis rolled in) is free cover like contributions. Equals principal for a
   * fully-taxable conversion; 0 when the whole layer was basis return.
   * Observation-only — mirrors the layer `taxableAmount` written at the same
   * conversion-layer commit sites (see `splitRothWithdrawal`).
   */
  creditedConversionTaxableAmount: number
  /** Calendar year the conversion principal was credited (starts its 5-year clock). */
  conversionYear: number | null
}

/**
 * One employer-designated Roth account's separate basis-pool activity for a
 * projection year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive it; employer
 * Roth pools stay per-account and never join an owner's Roth-IRA aggregate.
 */
export interface EmployerRothAccountActivity {
  accountId: string
  /** Resolved owner id (`null` owner already resolves to the household primary). */
  ownerPersonId: string
  withdrawals: number
  /** Post-limit `allowed` contribution credits, not scheduled amounts. */
  creditedContributions: number
  /**
   * Conversion principal credited to this employer Roth account's basis this
   * year (destination credits only). Starts the 5-taxable-year seasoning clock
   * at `conversionYear` — see `splitRothWithdrawal`. Per-account, never joined
   * to an owned Roth-IRA aggregate.
   */
  creditedConversionPrincipal: number
  /**
   * Portion of `creditedConversionPrincipal` that was included in income at
   * conversion. Same semantics as `OwnedRothIraPoolActivity.creditedConversionTaxableAmount`.
   * Observation-only — mirrors the layer `taxableAmount` written at the same
   * conversion-layer commit sites.
   */
  creditedConversionTaxableAmount: number
  /** Calendar year the conversion principal was credited (starts its 5-year clock). */
  conversionYear: number | null
}

/**
 * One owner's Form 8606 owned-traditional-IRA aggregate activity for a
 * projection year (owned non-inherited IRAs only — never employer plans or
 * inherited IRAs).
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive attribution from
 * aggregate `withdrawals.traditional` / `rothConversion` household totals.
 */
export interface OwnedTraditionalIraAggregateActivity {
  ownerPersonId: string
  /**
   * Distributions drawn from the owner's owned-IRA aggregate this year
   * (RMD, SEPP, need-based, QCD — excludes conversions, employer plans, and
   * inherited sources).
   */
  distributions: number
  /** Conversion amounts drawn from the same owned-IRA aggregate this year. */
  conversions: number
}

/**
 * One qualified annuity contract's payment actually paid this year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive payout-form
 * gates or funding linkage from plan inputs. Absent (or no entry) when the
 * payout-form gate pays nothing this year.
 */
export interface QualifiedAnnuityPaymentActivity {
  annuityAccountId: string
  /** Payment amount actually paid this year. */
  payment: number
  /**
   * Form 8606 pool owner of the traditional IRA that funded the contract
   * (funding-account owner, not necessarily the annuity account's owner).
   */
  fundingOwnerPersonId: string
}

/**
 * Benefit source the Social Security pass actually paid for a stream this year.
 * Published fact — detectors must not re-derive eligibility or precedence.
 */
export type SocialSecurityBenefitSource =
  | 'own-retirement'
  | 'ssdi'
  | 'spousal'
  | 'survivor'
  | 'none'

/**
 * Per-stream Social Security activity for a projection year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive PIA, claim
 * gates, spousal/survivor anchors, or SSDI path selection from plan inputs.
 *
 * One entry per `socialSecurity` income stream each year (including streams
 * not yet in force). When a person has multiple streams with unequal claim
 * ages, each stream's payments and claim-in-force state are attributed
 * exactly — not collapsed into a single per-person row.
 *
 * `isSpousalSurvivorGateStream` marks the sim's last-resolved stream for the
 * person (the stream that keys spousal/survivor auxiliary benefits).
 *
 * `claimInForce` / `preWithholdingAnnual` are captured **before** the
 * earnings-test / SGA withholding step so a filing decision is visible even
 * when withholding reduces the paid amount to zero.
 */
export interface SocialSecurityStreamActivity {
  personId: string
  streamId: string
  source: SocialSecurityBenefitSource
  /**
   * Annual amount actually paid this year after COLA, haircut, and
   * earnings-test / SGA withholding. May be $0 when a claim is in force but
   * fully withheld.
   */
  annualAmount: number
  /**
   * True when this stream has payable months > 0 this year (the claim is in
   * force), independent of earnings-test / SGA withholding.
   */
  claimInForce: boolean
  /**
   * Annual amount after COLA and haircut, before earnings-test / SGA
   * withholding.
   */
  preWithholdingAnnual: number
  /**
   * True when this stream is the last stream written into the sim's
   * `ssStreamByPerson` map for its person — the spousal/survivor gate winner.
   */
  isSpousalSurvivorGateStream: boolean
}

export interface YearResult {
  year: number
  /**
   * Exact cumulative general-inflation factor used by this simulation year.
   * `simulatePlan` always publishes it; optionality preserves compatibility
   * for external consumers that construct partial YearResult fixtures.
   */
  inflationScale?: number
  people: PersonYearState[]
  /** Filing treatment used for federal/state thresholds in this projection year. */
  filingStatus: ProjectedFilingStatus
  incomes: YearIncomes
  expenses: YearExpenses
  /** Contributions actually made this year (after IRS caps). */
  contributions: number
  /**
   * Employee contributions credited specifically to complete owner-wide
   * non-Roth IRA pools. Published independently from runtime occurrence
   * records so source replay can prove that no physical credit was omitted.
   */
  ownedNonRothIraContributions?: number
  /**
   * Independently published live owned-IRA balances after every annual
   * mutation and immediately before growth. This authoritative boundary lets
   * source replay bind per-account applications without inferring stochastic
   * or allocation returns from year-end balances.
   */
  ownedNonRothIraBalancesBeforeGrowth?:
    Readonly<Record<string, number>>
  /**
   * Per-owner owned Roth-IRA pool activity this year (withdrawals + post-limit
   * credited contributions). Published fact from the ledger's own execution —
   * the one-source-of-truth channel for insight detectors. Consumers must not
   * re-derive it from schedules or household aggregates. `simulatePlan` always
   * publishes it (possibly empty); optionality preserves fixture compatibility.
   */
  ownedRothIraPoolActivity?: readonly Readonly<OwnedRothIraPoolActivity>[]
  /**
   * Per-account employer Roth activity this year. Published fact from the
   * ledger's own execution — detectors must not re-derive it. `simulatePlan`
   * always publishes it (possibly empty); optionality preserves fixtures.
   */
  employerRothAccountActivity?: readonly Readonly<EmployerRothAccountActivity>[]
  /**
   * Per-owner Form 8606 owned-traditional-IRA aggregate activity this year
   * (excludes inherited and employer sources by construction). Published fact
   * from the ledger's own execution — detectors must not re-derive attribution
   * from household withdrawal/conversion totals. `simulatePlan` always
   * publishes it (possibly empty); optionality preserves fixtures.
   */
  ownedTraditionalIraAggregateActivity?:
    readonly Readonly<OwnedTraditionalIraAggregateActivity>[]
  /**
   * Qualified annuity payments actually paid this year, keyed by contract.
   * Published fact from the ledger's own execution — detectors must not
   * re-derive payout-form gates. Zero-payment contracts are omitted.
   * `simulatePlan` always publishes the array (possibly empty).
   */
  qualifiedAnnuityPayments?: readonly Readonly<QualifiedAnnuityPaymentActivity>[]
  /**
   * Per-stream Social Security activity this year. Published fact from the
   * ledger's own execution — detectors must not re-derive stream precedence,
   * benefit source, claim-in-force, or paid amounts. One entry per
   * `socialSecurity` income stream (including not-yet-claimed streams).
   * `simulatePlan` always publishes the array (possibly empty); optionality
   * preserves fixtures.
   */
  socialSecurityStreams?: readonly Readonly<SocialSecurityStreamActivity>[]
  /** Employer match contributions made this year. */
  employerMatch: number
  /** Forced traditional-account distributions (included in withdrawals.traditional). */
  rmd: number
  /** Penalty-free 72(t) SEPP distributions this year (included in withdrawals.traditional). */
  sepp: number
  /**
   * Forced inherited-IRA distributions this year (traditional + Roth character).
   * Equals the sum of each `inheritedAccounts[]` row's executed required amount
   * (annual/year-of-death) plus final-sweep amounts; voluntary draws are not
   * included. Traditional forced dollars also join `withdrawals.traditional`
   * and ordinary income; Roth forced dollars join `withdrawals.roth` only.
   */
  inheritedDistribution: number
  /**
   * Forced inherited amounts from TRADITIONAL accounts only (forced-only;
   * subset of `withdrawals.traditional`). Roth forced dollars are excluded —
   * they are not ordinary income and never join the traditional withdrawal
   * total. Equals the traditional share of `inheritedDistribution`.
   */
  inheritedTraditionalDistribution: number
  /**
   * Per-account inherited-IRA execution evidence for the year. Present whenever
   * the plan carries any inherited account; one row per inherited account whose
   * beneficiary is alive in the year (and a successor-scope flag row after a
   * beneficiary death).
   */
  inheritedAccounts?: InheritedAccountYearEvidence[]
  /** Qualified charitable distributions routed out of the RMD (excluded from income). */
  qcd: number
  /** Dollars moved traditional → Roth this year (taxed as ordinary income, no penalty). */
  rothConversion: number
  /**
   * The live balances the shared aggregate-conversion allocation policy
   * weighted this year's owners by, keyed by account ID.
   *
   * THE KEYS CARRY NO ORDER, and a consumer must not read one into them. This
   * is a plain object, so JavaScript enumerates any integer-like key first and
   * in numeric order regardless of insertion — an account whose ID is `"12"`
   * moves to the front — and nothing in the Plan schema forbids such an ID.
   * Plan order is real and load-bearing for this policy (it decides the owner
   * slices, the destination search, and the order sources are drawn from), but
   * it lives in `plan.accounts` and is recovered by joining on it, which is
   * exactly what `optimizerAggregateConversionPromotion.ts` does before it
   * allocates. A caller that iterates these keys instead is reading an order
   * this field never had.
   *
   * These are the exact figures
   * `actions/aggregateRothConversionOwnerAllocation.ts` read, captured at the
   * instant it read them: after the year's forced distributions (Treas. Reg.
   * 1.408A-4 A-6(b) puts the RMD first) and before anything below drains a
   * source. They are pre-drain by definition, so they are not the year's
   * closing balances and never agree with `balances` for a converting account.
   *
   * WHY IT IS PUBLISHED. The optimizer's promotion path has to name whose
   * dollars moved, out of which account, into which — and the owner weights
   * that decide it are a fact about this projection, not about the Plan. A
   * promotion that re-derived them from the Plan's opening balances, or from
   * any other year's, would put a second-source number on a schedule a person
   * is invited to act on. This field is what the ledger saw.
   *
   * THE SET IS EXACTLY `participatesInAggregateRothConversionAllocation`:
   * every owned non-inherited traditional account (employer plans included)
   * and every Roth account of both kinds. A designated Roth account is in it
   * although no conversion may land in one, because it is what tells an owner
   * who holds only that kind apart from an owner who holds no Roth at all.
   * Nothing else is: cash, taxable, equity compensation, HSA, inherited
   * traditional, property and debt are absent because the policy reads none of
   * them.
   *
   * WHY IT MIGHT BE ABSENT, in full. `simulatePlan` publishes it for exactly
   * the years in which the aggregate allocation policy ran, so absence means
   * one of:
   *
   * - the year had a named conversion request, which makes the named executor
   *   authoritative and forces the aggregate mode to `none`;
   * - the Plan's conversion strategy is `mode: 'none'`;
   * - nobody in the household was alive in the year;
   * - a `fillToTarget` strategy whose window does not cover the year;
   * - a `fillToTarget` sizing that produced nothing to convert — an invalid
   *   bracket target, non-actionable ACA evidence, a safety-net floor trim, or
   *   simply no headroom — or a `manual`/`optimized` schedule with no entry for
   *   the year; in every one of those the sized household amount failed the
   *   `> 0.01` test and the policy was never called;
   * - the `YearResult` was constructed by an external consumer rather than by
   *   `simulatePlan`, which is what the optionality is for.
   *
   * Presence says the policy was asked, and nothing more. It does not say the
   * household converted: the policy may have refused it for want of any Roth
   * IRA, or trimmed an owner who has none, and the year then publishes this
   * snapshot beside a `rothConversion` of zero.
   *
   * The amount it was asked FOR is the sibling field
   * `aggregateRothConversionAllocationDesired`, published from the same call.
   */
  aggregateRothConversionAllocationBalances?: Readonly<Record<string, number>>
  /**
   * The household conversion amount the aggregate allocation policy was asked
   * for this year, in Plan dollars, BEFORE the policy trimmed any owner.
   *
   * WHY IT IS PUBLISHED SEPARATELY FROM `rothConversion`. `rothConversion` is
   * what the ledger moved, which for a household with an owner who holds no
   * Roth IRA is strictly less than the figure the policy was handed: that
   * owner's slice is dropped, and the difference never converts. A promotion
   * path that re-allocated the executed total would slice the surviving
   * owners' figure across the whole household a second time and trim the same
   * absent owner again, converting less than the ledger did for no reason
   * anyone chose. This field is the figure the ledger's own allocation
   * answers, so re-running the policy on it reproduces that allocation exactly.
   *
   * It is the amount AFTER the sizing pass and after the safety-net floor trim
   * — both decide how much the household is asking to convert — and BEFORE the
   * identity trim, which decides how much of that request can lawfully land.
   *
   * PUBLISHED IN EXACTLY THE YEARS
   * `aggregateRothConversionAllocationBalances` is, at the same instant and
   * from the same call: presence on one is presence on the other, and every
   * cause of absence listed on that field is a cause of absence here. Two
   * fields rather than one nested object because the balances are a map and
   * this is a scalar, and each is read on its own.
   *
   * Presence says the policy was asked for this much. It does not say the
   * household converted it.
   */
  aggregateRothConversionAllocationDesired?: number
  /**
   * Projection-only raw source capture for legacy retirement-account
   * mutations. A later replay consumer owns journal validation, structural
   * identity derivation, and sealing; this field changes no legacy movement.
   * `simulatePlan` always publishes it, while optionality preserves source
   * compatibility for external consumers that construct `YearResult` values.
   */
  retirementRuntimeSource?:
    Readonly<SimulatorAnnualRetirementRuntimeSource>
  /**
   * Raw owned non-Roth IRA balance applications observed at their live ledger
   * mutation sites. Additive only; no validation, identity, or sealing has run.
   */
  retirementRuntimeApplicationSource?:
    Readonly<SimulatorAnnualRetirementRuntimeApplicationSource>
  /**
   * Projection-only raw post-growth balances for every complete owner-wide
   * owned non-Roth IRA pool. This additive source does not affect simulation
   * economics and is not itself a validated or sealed annual observation.
   * `simulatePlan` always publishes it, while optionality preserves source
   * compatibility for external consumers that construct `YearResult` values.
   */
  ownedNonRothIraPostGrowthSource?:
    Readonly<SimulatorAnnualOwnedNonRothIraPostGrowthSource>
  /**
   * Present only for a private annual-pass attempt whose complete contiguous
   * replay exactly matched the basis character used by simulator economics.
   * A blocked or rolled-back replay is represented by absence, never by an
   * empty substitute. A year without a settlement attempt is also absent.
   */
  ownedNonRothIraAnnualReplay?:
    Readonly<SimulatorCommittedOwnedNonRothIraAnnualReplay>
  /**
   * Exact-cent ordinary-executor evidence. Named conversions publish through
   * `rothConversionActionExecution` instead of this legacy mixed-kind result.
   */
  retirementActionExecution?: ExecuteOrdinaryWithdrawalsResult
  /**
   * Canonical identity-bearing publication across annual action executors.
   * Present when the ordinary executor result is publication-eligible: either
   * clean execution evidence or conflict-only schedule diagnostics. Omitted for
   * legacy-only action-year-mismatch or duplicate-action-ID schedule issues,
   * which remain on `retirementActionExecution`. Executor-specific artifacts
   * remain on their dedicated result fields.
   */
  retirementActionPublication?: AnnualRetirementActionPublication
  /**
   * The year's conversion-linked withdrawal groups, executed.
   *
   * Present only in a year that declares at least one linked group, because a
   * year with none has nothing to say about them and an empty result would be
   * indistinguishable from a year whose groups were all evaluated to nothing.
   *
   * Nothing here moves a dollar, and the type says so: every group carries
   * `movement: 'none'` and the result carries `status: 'refused'`. What it
   * carries that the publication's records cannot is the merged schedule the
   * group's two legs would occupy, and — when the funding evaluation was
   * refused rather than made — which of its inputs was missing.
   */
  conversionLinkedWithdrawalGroupExecution?:
    Readonly<ExecuteConversionLinkedWithdrawalGroupsResult>
  /**
   * Request-keyed named Roth-conversion movement evidence. A non-actionable
   * result is published when annual basis, RMD-reserve, or funding proof is
   * unavailable; absence means no named conversion request existed this year.
   */
  rothConversionActionExecution?: ExecuteRothConversionsResult
  /**
   * Planning-prerequisite evidence for the named QCD requests this year that
   * the QCD executor published: the donor's exact age 70½ threshold date, the
   * resolved source and copied charity designation, and the annual stages that
   * remain unestablished. It establishes what is proven before any gift moves,
   * never that one moved or became actionable.
   *
   * Neither absence nor a short array proves what the year requested. A single
   * QCD is omitted when it shares an execution slot with a non-QCD action and
   * so stayed with the ordinary-withdrawal executor — and a year whose every
   * QCD is routed away like that has no field at all. The whole field is also
   * absent when the prerequisite batch failed closed on malformed input or a
   * legacy diagnostics-only year published no executor sources at all.
   * `retirementActionPublication` remains the authority on which requests were
   * published and by which executor, and this field is never present without
   * it.
   */
  qcdActionPrerequisites?:
    readonly Readonly<AnnualQcdExecutionPrerequisiteEvidence>[]
  /**
   * Request-keyed named charitable-distribution movement evidence, and the sole
   * authority on whether a gift moved. A committed result carries each gift's
   * executed cents, its execution date and sequence, and the complete post-pass
   * derived facts behind them; a staged result carries the issue that stopped
   * the year and no derived facts at all. Absence means no named QCD reached
   * its own executor this year.
   *
   * It never replaces `qcdActionPrerequisites`, which keeps publishing what was
   * proven before any gift moved. The two are always present together.
   */
  qcdActionExecution?: ExecuteAnnualQcdsResult
  /** Early-withdrawal penalties (10% traditional pre-59½, 20% HSA non-medical pre-65); not in `tax`. */
  penalties: number
  /** MAGI realized this year (drives IRMAA two years later and the ACA credit). */
  magi: number
  /** Present only in years with a credit-enabled Marketplace premium. */
  aca?: YearAcaResult
  /** Medicare premiums charged this year (Part B incl. IRMAA + Part D surcharge, all covered people; excludes the user's "extras"). */
  medicarePremiums: number
  /** IRMAA-only portion of medicarePremiums (Part B and Part D surcharges above standard Part B). */
  irmaaSurcharge: number
  /** IRMAA tier the year's Medicare premiums were priced at (0 = standard premium; 1–5 = surcharge tiers). */
  irmaaTier: number
  /**
   * MAGI figure the year's IRMAA tier decision actually read (SSA-44 / two-year
   * lookback), not the current-year MAGI on `magi`. `simulatePlan` always
   * publishes it; optionality preserves compatibility for external consumers
   * that construct partial `YearResult` fixtures. Absence is evidence-absent —
   * never approximate the lookback from `magi`.
   */
  irmaaLookbackMagi?: number
  /**
   * Which arm of the MAGI fallback chain
   * (`magiHistory` → `historicalAnnualMagiByYear` → `recentAnnualMagi`)
   * supplied the SELECTED lookback figure on `irmaaLookbackMagi`.
   * `'planFallback'` is the coarse `recentAnnualMagi` stand-in (often 0) — not
   * evidence for implementation claims. Published beside `irmaaLookbackMagi`
   * whenever that field is; absence is evidence-absent.
   */
  irmaaLookbackMagiSource?: 'projected' | 'historicalInput' | 'planFallback'
  /**
   * Calendar year whose MAGI was selected for `irmaaLookbackMagi`. Under SSA-44
   * `min(year-2, year-1)`, this is the year of the minimum (ties keep year-2).
   * Published beside `irmaaLookbackMagi` whenever that field is; absence is
   * evidence-absent.
   */
  irmaaLookbackMagiYear?: number
  /**
   * MAGI boundary the household would have to stay under to avoid the NEXT
   * surcharge tier, priced by the simulator with its own inflation path and
   * IRMAA filing status (POMS HI 01101.020 QSS-on-single mapping). `null` when
   * no alive person had Medicare months this year (pre-enrollment — do not
   * treat as a live boundary) OR at the frozen top tier. Gate is Medicare
   * activity, not `irmaaTier === 0` (a low-MAGI enrollee still gets distance
   * to the first surcharge). `simulatePlan` always publishes it; optionality
   * preserves compatibility for external consumers that construct partial
   * `YearResult` fixtures. Absence (`undefined`) is evidence-absent — never
   * reconstruct the threshold from `inflationScale` or pack tables.
   */
  irmaaNextTierThreshold?: number | null
  /**
   * Advisory recomputation for planning surfaces: the exact `TaxYearInput`
   * handed to `computeFederalTax` for the gain-harvesting headroom probe, and
   * the `FederalTaxDetail` it returned. `detail.totalTax` is NOT the year's
   * settled liability (`tax` is — the funding solves can differ). Consumers
   * must treat absence as evidence-absent, never approximate. `simulatePlan`
   * always publishes it; optionality preserves compatibility for external
   * consumers that construct partial `YearResult` fixtures.
   */
  advisoryFederalTax?: Readonly<{ input: TaxYearInput; detail: FederalTaxDetail }>
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
  /** Signed capital gain-or-loss embedded in taxable withdrawals and other legacy taxable sales. */
  realizedGains: number
  /** Taxable account interest + dividends generated this year. */
  taxableYield: number
  /** Tax-exempt interest characterized for this year's program bases: in a known ACA contract year, the greater of the attested household total and the plan-generated subset; otherwise the account-generated total. */
  taxExemptInterest: number
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
