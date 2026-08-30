/**
 * The per-year probe the V8 optimizer reads off a baseline ledger run.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
import type { YearAcaResult } from './aca.js'

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
