/**
 * Multi-year withdrawal / Roth-conversion optimizer (roadmap V8, PR 1).
 *
 * A true multi-year optimizer — unlike the greedy per-year `sizeRothConversion`
 * sizer, this reasons over the whole horizon at once, which is the entire point
 * of conversion planning: convert more now (paying tax in a low bracket) to
 * shrink later RMDs and leave more in the never-haircut Roth. It is "just
 * another strategy provider" (V8 spec §1.3): it emits a per-year schedule that
 * the existing `simulate` ledger consumes via the Roth-conversion `optimized`
 * mode — it does NOT run a parallel engine.
 *
 * Method: a mixed-integer linear program solved client-side by HiGHS-WASM (the
 * `highs` package), proven viable by the PR 0 spike (measurements recorded in
 * DOCS/features/optimizer.md §"Spike findings (historical)"). The LP is a *linearised* view of the
 * ledger; `simulate` stays the source of truth, so callers re-run the real
 * (nonlinear) ledger with the emitted schedule for exact numbers and surface
 * any gap (V8 §3.1).
 *
 * Modeled exactly (the "big levers", V8 §6):
 *   - Graduated federal ordinary tax as a CONVEX piecewise-linear cost from the
 *     pack's real brackets — minimising tax fills the cheap band first with no
 *     integer variables.
 *   - IRMAA tier surcharges as binary step thresholds (the non-convex part that
 *     makes this a MILP, not an LP).
 *   - RMD floors as a linear lower bound on each year's taxable distribution
 *     (floor = start-of-year traditional balance ÷ divisor).
 *   - Three-bucket balances (owner traditional, inherited traditional, and
 *     "other" = Roth + taxable + cash) with per-year growth and scheduled
 *     contribution / employer-match inflows from the baseline probe, so a
 *     plan whose solvency depends on future deposits is not misread as
 *     infeasible.
 *
 * The optimizer-exact-ledger-convergence plan (Track 1) closed the
 * original v1 simplifications, each opt-in via `OptimizerInput` so absent
 * fields reproduce the v1 LP byte-for-byte:
 *   - Taxable-gain realization (Step 2): `openingTaxable`/`taxableInflow` split
 *     the lumped bucket into a taxable brokerage bucket — whose withdrawals
 *     realize LTCG at `ltcgRate` on the opening gain fraction and lift IRMAA
 *     MAGI — and the tax-free Roth/cash/HSA bucket. A single LTCG rate
 *     linearizes the 0/15/20% stack; the exact ledger refines it.
 *   - Bracketed state tax (Step 3): `stateBrackets` adds a convex state PWL
 *     over the same `ti` base as the federal PWL, so progressive
 *     (non-flat-override) states are priced with real brackets rather than
 *     zero; a flat `stateEffectiveTaxPct` override keeps the flat `stateRate`.
 *   - Taxable-SS phase-in (Step 3): `ssTaxability` swaps the fixed taxable-SS
 *     constant for an in-solve convex PWL over provisional income, so the
 *     solver sees the *marginal* tax torpedo (see `taxss` constraints below).
 *   - IRMAA 2-year lookback (Step 4): `irmaaLookback` drives each premium
 *     year's binaries off MAGI(year−2), matching the ledger's causality.
 *   - OBBBA senior deduction (ground-truth 2026 law sync, Step 2):
 *     `seniorDeduction` adds the per-person 65+ deduction plus a convex
 *     phase-out floor over MAGI, so conversions in the phase-out band are
 *     priced at bracket rate × (1 + phase-out rate) in-solve instead of the
 *     deduction being ignored entirely.
 *
 * Remaining simplifications (refined when the schedule re-runs through
 * `simulate`, and by the exact-ledger convergence loop — Step 1, in
 * projection/optimizePlan.ts — which recaptures the exogenous inputs at the
 * incumbent schedule and re-solves to a fixed point): a single LTCG rate and
 * opening basis ratio for the taxable stack, the omitted 85%-of-benefit
 * taxable-SS cap (conservative), unscaled stand-in packs for future years
 * (matching the ledger's convention), and state retirement-income exclusions.
 */

import type { FilingStatus, ParameterPack } from '../params/types.js'

/** One plan year of exogenous inputs the optimizer treats as given. */
export interface OptimizerYear {
  year: number
  pack: ParameterPack
  filingStatus: FilingStatus
  /**
   * Ordinary taxable income before any conversion or discretionary traditional
   * withdrawal: wages − pre-tax contributions, pensions/annuities, the taxable
   * portion of Social Security, etc. Nominal dollars.
   */
  ordinaryIncomeBase: number
  /**
   * Ordinary income the household has ALREADY committed this year that
   * `ordinaryIncomeBase` cannot carry — today, the taxable part of a named Roth
   * conversion the exact-cent executor committed. Nominal; default 0, which
   * emits a byte-identical LP.
   *
   * WHY IT IS A SEPARATE FIELD. `ordinaryIncomeBase` excludes every conversion
   * on purpose, because the LP re-decides conversions as `conv`. A committed
   * conversion is the one kind it may not re-decide: the dollars have moved
   * (`committedActionMovement` above already debited the source and credited
   * the Roth) and the income is on the return whatever the solver does next.
   * Folding it into the base would make that field's documented exclusion
   * false; leaving it out understates the year's tax by the tax on the whole
   * converted amount, which is what this closes.
   *
   * FLOOR SEMANTICS, AND WHERE THEY COME FROM. This is added to the same
   * `ordinaryBase` constant `ordinaryIncomeBase` becomes, so it is a CONSTANT
   * on the right-hand side of `tifloor` — `ti ≥ ordinaryBase − ded + conv +
   * wt + wi`. The solver has no variable with a negative coefficient there, so
   * it can neither shrink nor offset the term; and because `ti` is partitioned
   * into ascending convex bracket segments that a minimizing objective fills
   * cheapest-first, the committed dollars consume the low brackets and the
   * solver's own `conv`/`wt`/`wi` price marginally on top. The stacking is
   * inherited from the base's existing pricing, not reimplemented here.
   *
   * It rides the same constant into the IRMAA/ACA MAGI base, the taxable-SS
   * provisional-income constant, and the senior-deduction phase-out — every
   * side channel `ordinaryIncomeBase` already feeds — because the exact ledger
   * counts committed conversion income in all of them.
   */
  committedOrdinaryIncome?: number
  /**
   * Ordinary income the LP must NOT charge on the forced distribution it
   * re-decides as `wt`: the charitable exclusion a QCD routed out of this
   * year's owned-IRA RMD. Nominal; default 0, which emits a byte-identical LP.
   *
   * The mirror of `committedOrdinaryIncome`, and it joins the same
   * `ordinaryBase` constant for the same reason. `ordinaryIncomeBase` is what
   * remains after the forced distributions are netted out at their gross
   * taxable figure, so it cannot carry an exclusion that belongs to those
   * dollars; the LP books `traditionalWithdrawalTaxableFraction × wt` for them
   * and this is what §408(d)(8) takes back out.
   *
   * SAFE AGAINST A PHANTOM DEDUCTION at the linearization point: the probe caps
   * it at the year's taxable forced total, and the RMD floor (`rmd{t}`) forces
   * `wt` to at least the modeled required distribution — so the income booked
   * for those dollars is at least what this removes. Away from that point (a
   * solve that shrinks the traditional bucket far enough to shrink the modeled
   * RMD below the gift) it can over-remove; `ti ≥ 0` bounds the bracket side,
   * and the exact-ledger tournament reprices the schedule regardless.
   *
   * It rides into MAGI with the rest of the constant, which is correct rather
   * than incidental: an excluded distribution is out of gross income, so it is
   * out of MAGI — and keeping IRMAA and the ACA credit down is most of what a
   * QCD is for.
   */
  forcedDistributionOrdinaryIncomeExclusion?: number
  /**
   * Cash the LP must NOT keep for the forced distribution it re-decides as
   * `wt`: the dollars of this year's RMD that a QCD sent to a charity instead
   * of to the household. Nominal; default 0, which emits a byte-identical LP.
   *
   * The CASH mirror of `forcedDistributionOrdinaryIncomeExclusion` above, and
   * needed beside it rather than instead of it. That term stops the LP charging
   * TAX on gifted dollars; this stops it SPENDING them. The cash constraint
   * credits `wt` at 1.0 while the exact ledger's `baseCashInflows` books the
   * forced distribution and nets these dollars straight back out, so without
   * this the solve funds spending from money the household gave away — and
   * since a spent gift dollar is a dollar it never withdrew, the buckets it
   * carries forward are inflated too. It is the GROSS routed amount where the
   * exclusion is the includible share, so the two are different figures and
   * neither can stand in for the other.
   *
   * Added to the cash constraint's right-hand side, which is where every
   * exogenous cash fact in this model already lives — `exogenousCash`, the
   * committed-action proceeds and the strategy proceeds are all subtracted from
   * the same constant, and this is added to it. The solver must therefore raise
   * these dollars somewhere real (another withdrawal, or less `save`) or the
   * year is infeasible, which is exactly the household's position.
   *
   * SO IT CAN TURN AN OPTIMAL SOLVE INFEASIBLE, and that is the term working
   * rather than a regression to route around. A gift-heavy plan whose exact
   * ledger depletes used to get a confident schedule funded out of the gifted
   * dollars; once those are taken back, some of those years cannot be funded at
   * all, and the honest answer is that there is no schedule. The LP now agrees
   * with its own ledger where it used to contradict it. A sweep across the
   * gift/spending/cash grid moved 7 of 24 cells from optimal to infeasible on
   * exactly those plans.
   *
   * THE PREMISE IT RESTS ON, and where it stops holding: that `wt` contains the
   * forced dollars whose cash this takes back. The RMD floor (`rmd{t}`) forces
   * `wt` to at least the modeled required distribution and the probe caps this
   * at the year's forced total, so at the linearization point the credit is at
   * least what this removes. Away from it — a solve that shrinks the
   * traditional bucket far enough that the MODELED RMD falls below the gift —
   * this can take back more cash than the LP credited. That direction makes the
   * solve poorer than the household, never richer, so it cannot reopen the
   * defect it closes, and the exact-ledger tournament reprices the schedule
   * regardless.
   */
  forcedDistributionCashDiversion?: number
  /** After-tax cash needed this year beyond non-withdrawal inflows. Nominal. */
  spendingNeed: number
  /** Net non-withdrawal cash already in hand (e.g. surplus SS/pension). Nominal. */
  exogenousCash: number
  /** Uniform-Lifetime (or joint) RMD divisor when age-eligible; null = no RMD. */
  rmdDivisor: number | null
  /** Forced inherited-traditional distribution from the baseline ledger. */
  inheritedDistribution: number
  /** Inherited-IRA divisor recovered from the baseline forced distribution; null = no floor. */
  inheritedDistributionDivisor: number | null
  /**
   * Number of living people 65+. Drives the age-65 standard-deduction
   * additions (`pack65Deduction`) and, when `seniorDeduction` is enabled, the
   * OBBBA senior-deduction eligibility and amount (`amountPerPerson × this`).
   */
  peopleAged65Plus: number
  /**
   * Taxable portion of the baseline forced owner-traditional distribution.
   * Not a constraint input — the RMD floor stays `trad ÷ rmdDivisor` on the
   * endogenous balance. Used only to locate the linearization point for
   * saturation skips: a 65+ RMD year whose forced income already sits past the
   * senior-deduction full phase-out must skip the phase-out PWL exactly, and
   * `ordinaryIncomeBase` excludes forced withdrawals (the LP re-decides them
   * as `wt`). Default 0.
   */
  baselineRmd?: number
  /** Taxable share of gross owner-traditional withdrawals (default 1). */
  traditionalWithdrawalTaxableFraction?: number
  /** Taxable share of gross Roth conversions (default 1). */
  rothConversionTaxableFraction?: number
  /** Scales IRMAA thresholds for years beyond the published pack. */
  inflationScale: number
  /** Nominal growth applied to end-of-year balances this year, e.g. 0.05. */
  growth: number
  /**
   * Flat state + local income-tax rate on taxable ordinary income (fraction).
   * Carries the whole state tax under a flat `stateEffectiveTaxPct` override, or
   * just the flat local rate when `stateBrackets` supplies the progressive state
   * schedule (Step 3).
   */
  stateRate: number
  /**
   * Convex state income-tax bracket PWL (Step 3): ascending segments over the
   * same taxable-ordinary base as the federal PWL, mirroring `bracketSegments`.
   * Present only for progressive (non-flat-override) states with an income tax;
   * absent means the flat `stateRate` is the whole story (byte-identical LP).
   * Retirement-income exclusions are left to the exact ledger to refine.
   */
  stateBrackets?: { width: number | null; rate: number }[]
  /**
   * Deposits landing in the owner-traditional bucket this year (scheduled
   * employee contributions + employer match into traditional). The cash side of
   * employee contributions is already inside `spendingNeed`; this is the asset
   * side, so contribution-funded plans don't read as insolvent. Nominal.
   */
  tradInflow: number
  /** Deposits landing in the lumped other bucket this year (Roth/taxable/cash/HSA contributions + Roth match). Nominal. */
  otherInflow: number
  /**
   * Deposits landing specifically in the taxable brokerage / equity-comp bucket
   * this year (a subset of `otherInflow`). Only meaningful when the taxable
   * bucket is split out (Step 2); default 0 keeps the lumped-bucket behavior.
   */
  taxableInflow?: number
  /**
   * In-solve taxable-SS PWL inputs (Step 3). When present with `ssBenefits > 0`,
   * the LP replaces the fixed taxable-SS constant baked into
   * `ordinaryIncomeBase` with a variable derived from provisional income, so
   * the solver sees the *marginal* tax torpedo (each conversion dollar dragging
   * 50–85¢ of SS into taxability) instead of the incumbent's average. Absent →
   * the fixed-constant behavior (byte-identical LP).
   */
  ssTaxability?: {
    /** Gross Social Security benefits this year (nominal). */
    ssBenefits: number
    /** Taxable-SS portion already folded into `ordinaryIncomeBase` (subtracted out when the PWL is active). */
    taxableSsBase: number
    /** Generic scalar for the year's fixed §86(b)(2) provisional-income addbacks; buildOptimizerModel sums it verbatim into PI. The production plan→optimizer adapter currently supplies tax-exempt interest plus the §911/§931/§933 foreign exclusions only — omitted addbacks are an adapter/schema gap, not a solver limit. */
    provisionalIncomeAddbacks?: number
  }
  /**
   * Baseline realized capital gains + qualified dividends this year, EXCLUDING
   * gains from taxable-account withdrawals (the LP re-decides those as `wtax`,
   * so including them would double-count). Feeds both the SS phase-in's
   * provisional income and the IRMAA MAGI base — the ledger's MAGI counts
   * gains/dividends, so omitting them would understate tier triggers. Nominal;
   * default 0.
   */
  capitalGainsBase?: number
  /**
   * Characterized tax-exempt interest counted in the exact ledger's IRMAA
   * lookback MAGI (`magiHistory`). Folded into the IRMAA binary's threshold
   * constant, not `magiBase` (senior-deduction phase-out must not pick it up).
   * Absent or zero emits a byte-identical LP.
   */
  magiTaxExemptInterest?: number
  /**
   * Maximum modeled total MAGI that preserves the actionable current-year ACA
   * result. This constrains the same MAGI expression used by the optimizer's
   * IRMAA model, including taxable-SS phase-in and taxable withdrawals.
   */
  acaMagiMax?: number
  /**
   * SSA-44 IRMAA redetermination applies to this premium year (the exact
   * ledger prices its IRMAA on min(year t−2, year t−1 MAGI); see
   * `healthcareConfigSchema.ssa44`). Under `irmaaLookback`, the year's IRMAA
   * binaries are driven by year (t−1)'s MAGI instead of (t−2)'s — a
   * single-source stand-in for the ledger's min that can only overstate the
   * surcharge (conservative direction, refined by the exact-ledger
   * tournament) while giving the solver the right marginal signal: a
   * conversion in the estimate year now lifts this year's premium. Default
   * false → the plain (t−2) lookback, byte-identical LP.
   */
  ssa44Redetermination?: boolean
  /**
   * Retirement-action movement the exact ledger already COMMITTED this year:
   * these dollars are a fait accompli, not something the solver may re-decide.
   *
   * Without it the LP evolves its buckets as though the action never happened
   * while the executor has already debited the named source, so the solve
   * optimizes a portfolio the ledger never holds. Absent (the action-free case)
   * emits a byte-identical LP.
   *
   * Consequence worth stating plainly: this SHRINKS the feasible region. An
   * over-committed plan — one whose recorded actions drain a bucket harder than
   * the horizon can stand — now reports `infeasible` rather than quietly
   * solving a richer portfolio. That is the honest answer, and it is what lets
   * the engine admit action-bearing plans at all; the only remaining refusal
   * is the Optimize page's own `optimizerUnsupportedRetirementActions` gate.
   */
  committedActionMovement?: {
    /** Signed movement in the owner-traditional bucket; a debit is negative. Nominal. */
    trad: number
    /** Signed movement in the inherited-traditional bucket. Nominal. */
    inheritedTrad: number
    /** Signed movement in the tax-free Roth/cash/HSA bucket. Nominal. */
    other: number
    /** Signed movement in the taxable brokerage / equity-comp bucket. Nominal. */
    taxable: number
    /**
     * Gross cash those committed actions delivered into this year's cash flow.
     * Booked as an inflow beside `exogenousCash`, because a withdrawal
     * REALLOCATES between buckets — debiting the source without crediting the
     * proceeds would make the solver poorer than the household actually is.
     */
    proceeds: number
  }
  /**
   * Balance movement a plan STRATEGY already applied this year — dollars the
   * ledger has moved that the solver may not re-decide, exactly like
   * `committedActionMovement`, but produced by a strategy rather than by a
   * recorded retirement action. Absent (the usual case) emits a byte-identical
   * LP.
   *
   * Five producers (enumerated on `OptimizerYearProbe`): the aggregate
   * `qcdAnnual` gift beyond the RMD, a 72(t) SEPP series payment, an annuity
   * purchase premium, a TIPS-ladder purchase, and an elected pension lump-sum
   * rollover. Each was a one-sided booking before this term — the gift and the
   * two purchases left buckets the LP kept spending from, the series had its
   * ordinary income charged with no debit at all, and the lump sum is the one
   * that ran the other way: the LP watched the pension stream stop paying and
   * never saw the balance that replaced it.
   *
   * Kept separate from `committedActionMovement` rather than summed upstream so
   * neither field's name outlives its contract, and so an action-bearing plan
   * and a strategy-bearing plan stay independently attributable at this
   * boundary.
   */
  exogenousStrategyMovement?: {
    /** Signed movement in the owner-traditional bucket; a debit is negative. Nominal. */
    trad: number
    /** Signed movement in the inherited-traditional bucket. Nominal. */
    inheritedTrad: number
    /** Signed movement in the tax-free Roth/cash/HSA bucket. Nominal. */
    other: number
    /** Signed movement in the taxable brokerage / equity-comp bucket. Nominal. */
    taxable: number
    /**
     * Gross cash those strategy movements delivered into this year's cash flow,
     * booked beside `exogenousCash` exactly like the committed-action proceeds.
     *
     * Only the 72(t) series delivers any — it is a withdrawal, so it
     * REALLOCATES rather than destroying net worth. A gift leaves and an
     * annuity premium buys a contract that pays back through `exogenousCash`
     * later, so both report zero here. Debiting the series without this would
     * make the solver poorer than the household by every series payment.
     */
    proceeds: number
  }
}

export type OptimizerSolveResult = {
  Status: string
  ObjectiveValue?: number
  Columns?: Record<string, { Primal?: number }>
}

export type OptimizerSolver = (lp: string, opts?: Record<string, unknown>) => OptimizerSolveResult

export interface OptimizerInput {
  years: OptimizerYear[]
  /** Opening balances at the first year's start. Nominal. */
  openingTrad: number
  /** Opening inherited traditional balance. Taxable and liquid, but never convertible. */
  openingInheritedTrad: number
  /**
   * Opening tax-free "other" bucket: Roth + cash + HSA (kept whole in the
   * objective; withdrawals are tax-free). When the taxable bucket is split out
   * (Step 2) this excludes taxable/equity-comp — those go in `openingTaxable`.
   * When `openingTaxable` is 0/absent this is the original lumped bucket.
   */
  openingOther: number
  /**
   * Opening taxable brokerage + equity-comp balance (Step 2, taxable-gain
   * realization). Withdrawals realize LTCG on the gain fraction at `ltcgRate`,
   * so the solver no longer treats taxable draws as free. Default 0 (no taxable
   * bucket) reproduces the lumped-`openingOther` behavior exactly.
   */
  openingTaxable?: number
  /**
   * Aggregate cost-basis fraction of the opening taxable balance (basis ÷
   * balance, in [0,1]); `1 − this` is the gain fraction realized per taxable
   * withdrawal dollar. A single opening ratio is a fair v1 linearization (the
   * exact re-run prices true per-year basis depletion). Default 1 → no gain.
   */
  taxableBasisRatio?: number
  /**
   * Single preferential LTCG rate applied to realized taxable gains inside the
   * solve (fraction, e.g. 0.15). A single rate linearizes the 0/15/20% stack;
   * the exact ledger refines it. Default 0.
   */
  ltcgRate?: number
  /**
   * Model IRMAA on the 2-year MAGI lookback (Step 4): year t's Medicare
   * surcharge binaries are driven by year (t−2)'s MAGI, matching the exact
   * ledger — so a conversion at 63 anticipates the 65 premium in-solve.
   * `buildOptimizerInput` always enables this in production; the field stays
   * optional so direct `OptimizerInput` construction (golden tests,
   * back-compat callers) defaults to the v1 same-year approximation with a
   * byte-identical LP. Premium years without an in-horizon source (the first
   * two years under lookback) carry exogenous premiums the ledger prices.
   */
  irmaaLookback?: boolean
  /**
   * Price the OBBBA senior deduction in-solve (ground-truth 2026 law sync,
   * Step 2). When enabled, eligible years (people 65+, pack carries the rule,
   * year ≤ `lastApplicableYear`) get the per-person deduction added to the
   * year's deduction constant plus a convex phase-out floor over MAGI, so the
   * solver sees the phase-out band's marginal-rate spike (each conversion
   * dollar clawing back 6¢ of deduction ⇒ bracket rate × 1.06) instead of
   * ignoring the deduction entirely. The concave full-phase-out cap is omitted
   * (overstates cost for cap-crossing conversions, which the exact ledger
   * refines), and years whose
   * baseline MAGI is already past full phase-out skip the deduction exactly.
   * `buildOptimizerInput` always enables this in production; absent, the v1
   * LP is byte-identical.
   */
  seniorDeduction?: boolean
  /** Haircut on leftover traditional in the objective (V8 §1.4; ~0.22–0.24). */
  liquidationRate: number
  /** Deflator to express the objective in today's dollars; argmax is unchanged. */
  realDollarFactor?: number
  options?: {
    /** HiGHS time limit in seconds (default 10). */
    timeLimitSec?: number
    /** Optional per-year conversion ceiling, nominal. */
    maxConversionPerYear?: number
    /**
     * Resolve the wasm asset URL in a browser worker. Omit in Node (tests),
     * where `highs` loads the wasm from disk.
     */
    locateFile?: (file: string) => string
    /** Test seam for deterministic solver-status coverage. */
    solve?: OptimizerSolver
  }
}

export interface OptimizedYear {
  year: number
  conversion: number
  /** Discretionary + RMD traditional withdrawal (taxable). */
  withdrawTraditional: number
  /** Inherited traditional withdrawal (taxable, never convertible). */
  withdrawInheritedTraditional: number
  /** Withdrawal from the tax-free Roth/cash/HSA bucket (tax-free in the LP). */
  withdrawOther: number
  /** Withdrawal from the taxable brokerage bucket (realizes LTCG on the gain fraction). */
  withdrawTaxable: number
  /** Realized long-term gains from this year's taxable withdrawal (gain fraction × withdrawTaxable). */
  taxableGainRealized: number
  taxableOrdinary: number
  irmaaTier: number
  endTrad: number
  endInheritedTrad: number
  endOther: number
  /** End-of-year taxable brokerage balance (0 when the taxable bucket isn't split out). */
  endTaxable: number
}

export interface OptimizedSchedule {
  status: 'optimal' | 'feasible' | 'infeasible' | 'timeout'
  /** Ending after-tax wealth in today's dollars (the objective). */
  endingAfterTax: number
  /** Cumulative modeled tax over the horizon (secondary readout, V8 §1.4). */
  lifetimeTax: number
  schedule: OptimizedYear[]
  /** Per-year conversions, ready to drop into the `optimized`/`manual` strategy. */
  conversions: { year: number; amount: number }[]
  solveMs: number
}

type Terms = Record<string, number>

function fmt(coef: number): string {
  // Plain decimal (HiGHS LP reader dislikes exponential notation); trim noise.
  return Number.isInteger(coef) ? String(coef) : coef.toFixed(8).replace(/\.?0+$/, '')
}

/** Render { x: 1.05, y: -2 } as a signed LP linear expression. */
function expr(terms: Terms): string {
  const parts: string[] = []
  for (const [name, coef] of Object.entries(terms)) {
    if (coef === 0) continue
    parts.push(`${coef < 0 ? '-' : '+'} ${fmt(Math.abs(coef))} ${name}`)
  }
  return parts.join(' ') || '0'
}

/** Convex piecewise-linear federal tax from a pack's ascending brackets. */
function bracketSegments(pack: ParameterPack, filing: FilingStatus): { width: number | null; rate: number }[] {
  const brackets = pack.federalTax.brackets[filing]
  return brackets.map((b, i) => ({
    width: i + 1 < brackets.length ? brackets[i + 1]!.lowerBound - b.lowerBound : null, // last band open-ended
    rate: b.ratePct / 100,
  }))
}

/** Annual Part B + Part D IRMAA surcharge increments per tier (nominal). */
function irmaaIncrements(pack: ParameterPack): { threshold: (f: FilingStatus) => number; surcharge: number }[] {
  const std = pack.medicare.partBStandardMonthly
  const tiers = pack.medicare.irmaaTiers
  return tiers.map((tier, i) => {
    const prevPct = i === 0 ? 25 : tiers[i - 1]!.applicablePct
    // Part B increment over the previous tier + this tier's Part D surcharge.
    const partB = std * ((tier.applicablePct - prevPct) / 25) * 12
    const partD = (tier.partDSurchargeMonthly ?? 0) * 12 - (i === 0 ? 0 : (tiers[i - 1]!.partDSurchargeMonthly ?? 0) * 12)
    return { threshold: (f: FilingStatus) => tier.magiOver[f], surcharge: Math.max(0, partB + partD) }
  })
}

interface BuiltModel {
  lp: string
  binaryCount: number
  bigM: number
}

/** Build the multi-year MILP in CPLEX LP format. Exported for golden tests. */
export function buildOptimizerModel(input: OptimizerInput): BuiltModel {
  const { years, liquidationRate } = input
  const n = years.length
  const maxConv = input.options?.maxConversionPerYear

  // Step 2 — taxable-gain realization. Split the lumped "other" bucket into a
  // taxable bucket (withdrawals realize LTCG on the gain fraction) and the
  // tax-free bucket (`openingOther`). Only materialized when there is a taxable
  // balance or inflow, so plans without a taxable account emit the identical LP.
  const openingTaxable = input.openingTaxable ?? 0
  const gainFraction = Math.min(1, Math.max(0, 1 - (input.taxableBasisRatio ?? 1)))
  const ltcgRate = Number.isFinite(input.ltcgRate) ? Math.max(0, input.ltcgRate ?? 0) : 0
  const hasTaxable =
    openingTaxable > 0 ||
    years.some((y) => (y.taxableInflow ?? 0) > 0) ||
    // A committed action can be the only thing that ever touches the taxable
    // bucket. Materialize it then too, or the movement would be silently
    // dropped instead of debited.
    years.some((y) => (y.committedActionMovement?.taxable ?? 0) !== 0) ||
    // Same rule for strategy movement, and here it is a LIVE path rather than a
    // guard: a QCD source is always an IRA and a lump sum always rolls into a
    // traditional account, but an annuity premium and a TIPS-ladder purchase
    // both name their own funding account, and a brokerage or equity-comp
    // account is an ordinary choice for one. Without this a plan whose only
    // taxable activity is a purchase would drop the debit silently.
    years.some((y) => (y.exogenousStrategyMovement?.taxable ?? 0) !== 0)
  // Net cash a taxable withdrawal dollar yields after its LTCG cost, and the
  // MAGI weight of its realized gain (capital gains lift MAGI for IRMAA).
  const taxableNetCash = 1 - ltcgRate * gainFraction
  const taxableGainWeight = gainFraction
  // Step 4 — drive each premium year's IRMAA binaries off year (t−2)'s MAGI.
  const irmaaLookback = input.irmaaLookback ?? false

  // Safe big-M: no year's taxable income can exceed all assets plus all income.
  // Scale by the PEAK cumulative growth factor, floored at 1 — with negative
  // returns the end-of-horizon factor can be < 1, which would shrink big-M
  // below early-year balances and let a relaxed IRMAA constraint wrongly bind.
  let cumGrowth = 1
  let peakGrowth = 1
  for (const y of years) {
    cumGrowth *= 1 + y.growth
    if (cumGrowth > peakGrowth) peakGrowth = cumGrowth
  }
  // Committed ordinary income is part of what big-M has to dominate: it lifts
  // every year's `ti` and its MAGI, and a big-M that no longer exceeds the
  // largest MAGI would let a relaxed IRMAA constraint wrongly bind.
  const incomeSum = years.reduce(
    (a, y) => a + y.ordinaryIncomeBase + Math.max(0, y.committedOrdinaryIncome ?? 0),
    0,
  )
  const inflowSum = years.reduce((a, y) => a + y.tradInflow + y.otherInflow, 0)
  const bigM =
    (input.openingTrad + input.openingInheritedTrad + input.openingOther + (input.openingTaxable ?? 0) + inflowSum) *
      peakGrowth +
    incomeSum +
    1_000_000

  const constraints: string[] = []
  const binaries: string[] = []
  const segBounds: string[] = []

  // Per-year MAGI decomposition for the IRMAA constraints: a constant base plus
  // variable terms (conversions/withdrawals, taxable gains, and — when the
  // in-solve taxable-SS PWL is active — the taxable-SS variable). Stored so the
  // 2-year lookback (Step 4) can reference an earlier year's MAGI.
  const magiBase: number[] = []
  const magiTerms: Terms[] = []
  const magiTaxExemptInterestByYear: number[] = []

  const taxableFractionOrOne = (value: number | undefined): number =>
    Number.isFinite(value)
      ? Math.min(1, Math.max(0, value!))
      : 1

  for (let t = 0; t < n; t++) {
    const y = years[t]!
    const g = 1 + y.growth
    const conv = `conv${t}`
    const wt = `wt${t}` // taxable traditional withdrawal
    const wi = `wi${t}` // taxable inherited-traditional withdrawal
    const wo = `wo${t}` // tax-free other-bucket withdrawal
    const wtax = `wtax${t}` // taxable-brokerage withdrawal (realizes LTCG on the gain fraction)
    const save = `save${t}` // surplus cash routed back to the tax-free bucket
    const ti = `ti${t}` // taxable ordinary income (post standard deduction, ≥0)
    const traditionalTaxableFraction = taxableFractionOrOne(
      y.traditionalWithdrawalTaxableFraction,
    )
    const conversionTaxableFraction = taxableFractionOrOne(
      y.rothConversionTaxableFraction,
    )
    // Exogenous ordinary income the household already committed this year (a
    // committed named conversion's taxable part). Clamped nonnegative: this is
    // a floor the solver stacks on, and a negative one would be a deduction the
    // LP has no authority to grant. It joins `ordinaryBase` below — the single
    // constant that feeds `tifloor`, the taxable-SS provisional-income
    // constant, and the MAGI base — so it is priced through the existing
    // bracket model rather than through a second one.
    const committedOrdinary = Math.max(0, y.committedOrdinaryIncome ?? 0)
    // And the exclusion the LP must NOT charge on the forced dollars it books
    // itself. Clamped nonnegative for the same reason and joined to the same
    // constant, so a QCD year's brackets, MAGI and provisional income all read
    // the distribution net of the gift, as the exact ledger does.
    const forcedOrdinaryExclusion = Math.max(
      0,
      y.forcedDistributionOrdinaryIncomeExclusion ?? 0,
    )
    const exemptRaw = y.magiTaxExemptInterest ?? 0
    const magiTaxExemptInterest = Number.isFinite(exemptRaw) ? Math.max(0, exemptRaw) : 0

    // OBBBA senior deduction in-solve (ground-truth 2026 law sync, Step 2).
    // Eligible years add the full per-person deduction to the constant and a
    // convex phase-out floor `srd ≥ rate·(MAGI − start)` (srd ≥ 0) that claws
    // it back inside the solve — the marginal-rate spike the exact ledger
    // prices via `seniorDeductionAmount`. Years already past full phase-out at
    // baseline skip it exactly (conversions only raise MAGI, so the deduction
    // stays zero); the baseline MAGI for that test must include the year's
    // forced distributions (owner RMD + inherited) — they are re-decided as
    // `wt`/`wi` so `ordinaryIncomeBase` excludes them, but the ledger's MAGI
    // counts them, and a high-RMD year can be fully phased out on forced
    // income alone. The concave full-phase-out cap is otherwise omitted — a
    // conservative overstatement for cap-crossing conversions (a hard `srd ≤ base`
    // bound would instead make cap-crossing MAGI infeasible against the floor
    // constraint, and an exact cap needs a binary).
    const srdRule = input.seniorDeduction ? y.pack.federalTax.seniorDeduction : null
    const srdEligible = srdRule !== null && y.peopleAged65Plus > 0 && y.year <= srdRule.lastApplicableYear
    // Clawback slope against the household total, not the statutory rate:
    // §151(d)(5)(C)(iii)(I) reduces the per-individual $6,000, so the total
    // n·max(0, A − rate·excess) sheds n·rate per dollar of modified AGI. The
    // full-phase-out test below then lands on start + (n·A)/(n·rate) =
    // start + A/rate, the same exhaustion point for one qualified individual
    // or two — `srdBaseRaw` already carries the n and the two cancel.
    const srdRate = srdRule && srdEligible ? (srdRule.phaseOutRatePct / 100) * y.peopleAged65Plus : 0
    const srdStart = srdRule && srdEligible ? srdRule.magiPhaseOutStart[y.filingStatus] : 0
    // The year's true no-new-conversion MAGI. Committed conversion income
    // belongs in it for the same reason the forced distributions do: the test
    // asks whether the deduction is already exhausted before the solver decides
    // anything, and the ledger's MAGI counts a conversion the household has
    // already made.
    const baselineMagi =
      y.ordinaryIncomeBase + committedOrdinary - forcedOrdinaryExclusion +
      (y.capitalGainsBase ?? 0) + (y.baselineRmd ?? 0) + y.inheritedDistribution
    const srdBaseRaw = srdRule && srdEligible ? srdRule.amountPerPerson * y.peopleAged65Plus : 0
    const srdFullyPhasedOut = srdRate > 0 && baselineMagi >= srdStart + srdBaseRaw / srdRate
    const srdBase = srdFullyPhasedOut ? 0 : srdBaseRaw
    const srdPwlActive = srdBase > 0 && srdRate > 0
    const srd = `srd${t}`
    const ded = pack65Deduction(y) + srdBase

    // Tax pieces: federal PWL segments + IRMAA binaries + flat state on `ti`.
    const segs = bracketSegments(y.pack, y.filingStatus)
    const segVars = segs.map((_, i) => `fseg${t}_${i}`)
    const irmaa = irmaaIncrements(y.pack)
    const irmaaVars = irmaa.map((_, k) => `irmaa${t}_${k}`)

    // In-solve taxable-SS PWL (Step 3): active when the year carries SS inputs
    // and the incumbent taxable share is below 84.5% of benefits (an
    // implementation shortcut, not statutory; above that band the baseline share
    // is frozen and can understate further inclusion toward the cap). Convex
    // max-affine proxy for the 0/50/85% phase-in over provisional
    // income PI = PI0 + x; both the half-benefit plateau and 0.85·B cap are
    // omitted, so an active PWL can overstate taxable SS — no universal signed
    // direction on recommendations (see registry record).
    const ssB = y.ssTaxability
    const ssPwlActive =
      ssB !== undefined && ssB.ssBenefits > 1 && ssB.taxableSsBase < 0.845 * ssB.ssBenefits
    const taxSs = `taxss${t}`
    // Ordinary base with the probe's taxable-SS constant swapped out for the
    // PWL variable when active, plus the committed ordinary-income floor. One
    // constant carries both, which is what makes the floor stack: it is the
    // right-hand side of `tifloor` (no variable can reduce it) and the low
    // bracket segments fill with it first, so the solver's own `conv`, `wt` and
    // `wi` are priced at the marginal rate above it.
    const ordinaryBase =
      (ssPwlActive ? y.ordinaryIncomeBase - ssB.taxableSsBase : y.ordinaryIncomeBase) +
      committedOrdinary -
      forcedOrdinaryExclusion

    // (taxable ordinary) ti ≥ grossOrdinary − deduction, ti ≥ 0. Minimising tax
    // pins ti to max(0, gross−ded) since every tax term is increasing in ti.
    //   gross = ordinaryBase + conv + wt + wi (+ taxSS variable when PWL active)
    const tiFloor: Terms = {
      [ti]: 1,
      [conv]: -conversionTaxableFraction,
      [wt]: -traditionalTaxableFraction,
      [wi]: -1,
    }
    if (ssPwlActive) tiFloor[taxSs] = -1
    // The phase-out variable raises the floor: ti ≥ gross − ded + srd.
    if (srdPwlActive) tiFloor[srd] = -1
    constraints.push(` tifloor${t}: ${expr(tiFloor)} >= ${fmt(ordinaryBase - ded)}`)

    if (ssPwlActive) {
      const B = ssB.ssBenefits
      const t1 = y.pack.ssBenefitTaxation.tier50Start[y.filingStatus]
      const t2 = y.pack.ssBenefitTaxation.tier85Start[y.filingStatus]
      // Provisional income: ordinary (excl. taxable SS) + gains + half the benefit.
      const pi0 =
        ordinaryBase +
        (y.capitalGainsBase ?? 0) +
        (ssB.provisionalIncomeAddbacks ?? 0) +
        0.5 * B
      const piVars: Terms = {
        [conv]: conversionTaxableFraction,
        [wt]: traditionalTaxableFraction,
        [wi]: 1,
      }
      if (hasTaxable && taxableGainWeight > 0) piVars[wtax] = taxableGainWeight
      // taxSS ≥ max(0, 0.5·(PI−T1), tier1Cap + 0.85·(PI−T2)) — convex max-affine
      // pieces mirroring the ledger's tier slopes; the half-benefit plateau and
      // concave 0.85·B cap are deliberately NOT modeled (a binary per SS year
      // makes the MILP intractably slow). Active PWL can overstate inclusion;
      // the ≥84.5% skipped branch freezes baseline share and can understate
      // further inclusion — neither branch is exact, and recommendation quality
      // has no universal signed direction. Tournament/local search re-prices on
      // the exact ledger.
      const tier1Cap = Math.min(0.5 * B, 0.5 * (t2 - t1))
      const pieces: { slope: number; constant: number; name: string }[] = [
        { slope: 0.5, constant: 0.5 * (pi0 - t1), name: 'a' },
        { slope: 0.85, constant: tier1Cap + 0.85 * (pi0 - t2), name: 'b' },
      ]
      for (const piece of pieces) {
        const terms: Terms = { [taxSs]: 1 }
        for (const [v, c] of Object.entries(piVars)) terms[v] = -piece.slope * c
        constraints.push(` taxss${t}${piece.name}: ${expr(terms)} >= ${fmt(piece.constant)}`)
      }
    }

    // MAGI decomposition for IRMAA: constant base + variable add-ons. The base
    // includes the year's baseline capital gains / qualified dividends — the
    // ledger's MAGI counts them, and the SS PWL above already does; omitting
    // them here would let a conversion look tier-safe in-solve while the exact
    // ledger prices the surcharge. Matches the pre-PWL behavior exactly when
    // both are absent (constant taxable SS rides inside ordinaryIncomeBase).
    magiBase.push(ordinaryBase + (y.capitalGainsBase ?? 0))
    magiTaxExemptInterestByYear.push(magiTaxExemptInterest)
    const myMagiTerms: Terms = {
      [conv]: conversionTaxableFraction,
      [wt]: traditionalTaxableFraction,
      [wi]: 1,
    }
    if (hasTaxable && taxableGainWeight > 0) myMagiTerms[wtax] = taxableGainWeight
    if (ssPwlActive) myMagiTerms[taxSs] = 1
    magiTerms.push(myMagiTerms)

    // Senior-deduction phase-out floor: srd ≥ rate·(MAGI − start), srd ≥ 0.
    // Tax is increasing in ti (hence in srd) and drains cash from the
    // maximized terminal estate, so the optimum pins srd to
    // max(0, rate·(MAGI − start)) — the ledger's claw-back, sans the cap.
    if (srdPwlActive) {
      const srdTerms: Terms = { [srd]: 1 }
      for (const [v, c] of Object.entries(myMagiTerms)) srdTerms[v] = -srdRate * c
      constraints.push(` srd${t}: ${expr(srdTerms)} >= ${fmt(srdRate * (magiBase[t]! - srdStart))}`)
    }

    // ti split across federal segments (convex; low bands fill first).
    const split: Terms = { [ti]: 1 }
    segVars.forEach((s) => (split[s] = -1))
    constraints.push(` fsplit${t}: ${expr(split)} = 0`)
    segs.forEach((seg, i) => {
      if (seg.width !== null) segBounds.push(` 0 <= ${segVars[i]} <= ${fmt(seg.width)}`)
    })

    // State PWL (Step 3): a second convex partition of the same `ti` into the
    // state's brackets. Present only for progressive (non-flat-override) states;
    // widths are UNSCALED, matching the ledger's stand-in convention (state
    // packs apply at face value for future years, like the federal deduction
    // and brackets). When absent the flat `stateRate` term below is the whole
    // state tax (byte-identical LP).
    const stateSegs = y.stateBrackets
    const stateSegVars = stateSegs?.map((_, i) => `sseg${t}_${i}`) ?? []
    if (stateSegs && stateSegs.length > 0) {
      const ssplit: Terms = { [ti]: 1 }
      stateSegVars.forEach((s) => (ssplit[s] = -1))
      constraints.push(` ssplit${t}: ${expr(ssplit)} = 0`)
      stateSegs.forEach((seg, i) => {
        if (seg.width !== null) segBounds.push(` 0 <= ${stateSegVars[i]} <= ${fmt(seg.width)}`)
      })
    }

    // IRMAA: MAGI (≈ gross ordinary + realized taxable gains) over a tier
    // threshold in the *premium* year forces its binary on. Same-year MAGI by
    // default; under the two-year lookback (Step 4) the trigger is year (t−2)'s
    // MAGI, matching the exact ledger's causality (a conversion at 63 raises the
    // 65 premium) — shifted to year (t−1)'s MAGI when SSA-44 redetermination
    // applies (see OptimizerYear.ssa44Redetermination). Premium years with no
    // in-horizon source (t<2 under lookback) have exogenous premiums the ledger
    // prices, so no binary is modeled.
    const irmaaSrc = irmaaLookback ? (y.ssa44Redetermination ? t - 1 : t - 2) : t
    const hasIrmaaBinaries = irmaaSrc >= 0
    if (hasIrmaaBinaries) {
      const srcTerms = magiTerms[irmaaSrc]!
      const srcBase = magiBase[irmaaSrc]!
      const srcExempt = magiTaxExemptInterestByYear[irmaaSrc]!
      irmaa.forEach((tier, k) => {
        const thr = tier.threshold(y.filingStatus) * y.inflationScale
        const step: Terms = { ...srcTerms, [irmaaVars[k]!]: -bigM }
        constraints.push(` irmaa${t}_${k}: ${expr(step)} <= ${fmt(thr - srcBase - srcExempt)}`)
        binaries.push(irmaaVars[k]!)
      })
    }

    // tax_t = Σ rate·fseg + stateRate·ti + Σ surcharge·irmaaBinary  (defined inline
    // in the cash-flow constraint to avoid a separate variable).
    const taxTerms: Terms = {}
    segs.forEach((seg, i) => (taxTerms[segVars[i]!] = seg.rate))
    // Flat state/local rate on `ti` (override + local), plus the progressive
    // state bracket PWL when supplied.
    taxTerms[ti] = (taxTerms[ti] ?? 0) + y.stateRate
    if (stateSegs && stateSegs.length > 0) stateSegs.forEach((seg, i) => (taxTerms[stateSegVars[i]!] = seg.rate))
    // The surcharge is a cash cost in the premium year t; its binary is whatever
    // the trigger constraint above bound (same-year or the t−2 lookback source).
    if (hasIrmaaBinaries) irmaa.forEach((tier, k) => (taxTerms[irmaaVars[k]!] = tier.surcharge))

    // Cash flow: withdrawals + exogenous cash − tax = spendingNeed + save.
    //   wt + wi + wo + wtax·(1 − ltcgCost) + exoCash − tax = spendingNeed + save
    // A taxable withdrawal yields less net cash than a tax-free one because its
    // gain fraction is taxed at the LTCG rate — so the solver stops treating
    // taxable draws as free and prefers the tax-free bucket where it can.
    const cash: Terms = { [wt]: 1, [wi]: 1, [wo]: 1, [save]: -1 }
    if (hasTaxable) cash[wtax] = taxableNetCash
    for (const [v, c] of Object.entries(taxTerms)) cash[v] = (cash[v] ?? 0) - c
    // Committed action proceeds are cash the ledger already delivered this
    // year, exactly like `exogenousCash`: they fund spending first and the
    // surplus routes to `save` (the tax-free bucket), which is where the exact
    // ledger's own surplus lands.
    const committed = y.committedActionMovement
    // Strategy proceeds sit beside them. Only the 72(t) series delivers any: a
    // gift leaves and an annuity premium buys a contract, so both report zero
    // and only their bucket debits land. Debiting a series payment without its
    // cash would make the solver poorer than the household every series year.
    const strategyMoved = y.exogenousStrategyMovement
    // And the one cash term with the opposite sign: dollars the LP credited on
    // its own `wt` that the household never received, because a QCD routed them
    // out of the forced distribution to a charity. ADDED to the constant every
    // other cash fact is subtracted from, so the solver has to raise them
    // somewhere real instead of spending a gift. Clamped nonnegative — this may
    // only take cash back, never hand cash out.
    const forcedCashDiversion = Math.max(0, y.forcedDistributionCashDiversion ?? 0)
    constraints.push(
      ` cash${t}: ${expr(cash)} = ${fmt(
        y.spendingNeed -
          y.exogenousCash -
          (committed?.proceeds ?? 0) -
          (strategyMoved?.proceeds ?? 0) +
          forcedCashDiversion,
      )}`,
    )

    // RMD floor: discretionary+forced taxable distribution ≥ balance ÷ divisor.
    if (y.rmdDivisor && y.rmdDivisor > 0) {
      const rmd: Terms = { [wt]: 1, [`trad${t}`]: -1 / y.rmdDivisor }
      constraints.push(` rmd${t}: ${expr(rmd)} >= 0`)
    }
    if (y.inheritedDistributionDivisor && y.inheritedDistributionDivisor > 0) {
      const inheritedFloor: Terms = { [wi]: 1, [`inh${t}`]: -1 / y.inheritedDistributionDivisor }
      constraints.push(` inhrmd${t}: ${expr(inheritedFloor)} >= 0`)
    } else if (y.inheritedDistribution > 0) {
      constraints.push(` inhrmd${t}: + 1 ${wi} >= ${fmt(y.inheritedDistribution)}`)
    }

    if (y.acaMagiMax !== undefined) {
      // `acaMagiMax` embeds the exact ledger's remaining MAGI headroom before
      // the cliff — incumbent ledger MAGI (which already includes exempt
      // interest) minus the same LP `magiBase`. The constraint stays correct
      // because that headroom is measured on the ledger's MAGI, not because
      // exempt interest cancels out of `magiBase`. If the LP's MAGI expression
      // later gains an explicit exempt term, this constraint must be reconciled.
      constraints.push(
        ` acamagi${t}: ${expr(myMagiTerms)} <= ${fmt(Math.max(0, y.acaMagiMax) - magiBase[t]!)}`,
      )
    }
    if (maxConv !== undefined) segBounds.push(` 0 <= ${conv} <= ${fmt(maxConv)}`)

    // Balance recursions (next start = growth × (this start ± activity)).
    // Scheduled contribution / employer-match inflows land in their bucket the
    // same year and grow like the exact ledger's deposits (which are applied
    // before end-of-year growth); their cash cost is already in spendingNeed.
    // Committed action movement rides the same right-hand side as an inflow —
    // a signed constant the solver cannot re-decide — so a debit leaves the
    // bucket the year the executor took it, and grows (or fails to grow) from
    // then on exactly as the exact ledger's balance does.
    //
    // Strategy movement rides it identically and is summed here rather than
    // upstream: the two arrive from different authorities (an exact-cent action
    // executor, and the strategies and elections the ledger applies itself) and
    // neither field may claim the other's dollars, but the recursion does not
    // care which moved them, or in which direction — a pension lump sum's
    // rollover credit rides the same right-hand side as the four debits. Note
    // the asymmetry that is not an oversight: only the 72(t) series among the
    // strategy producers reports `proceeds` in the cash constraint above,
    // because a gift leaves, the two purchases buy instruments that pay back
    // later, and a direct rollover never touches the year's cash at all.
    const trad: Terms = { [`trad${t + 1}`]: 1, [`trad${t}`]: -g, [conv]: g, [wt]: g }
    constraints.push(
      ` trad${t}: ${expr(trad)} = ${fmt(
        g * (y.tradInflow + (committed?.trad ?? 0) + (strategyMoved?.trad ?? 0)),
      )}`,
    )
    const inherited: Terms = { [`inh${t + 1}`]: 1, [`inh${t}`]: -g, [wi]: g }
    constraints.push(
      ` inh${t}: ${expr(inherited)} = ${fmt(
        g * ((committed?.inheritedTrad ?? 0) + (strategyMoved?.inheritedTrad ?? 0)),
      )}`,
    )
    // Tax-free bucket: `otherInflow` net of the taxable share lands here; the
    // taxable share seeds the taxable bucket below. Surplus `save` and Roth
    // conversions accrue to this tax-free bucket.
    const taxFreeInflow = hasTaxable ? Math.max(0, y.otherInflow - (y.taxableInflow ?? 0)) : y.otherInflow
    const other: Terms = { [`other${t + 1}`]: 1, [`other${t}`]: -g, [conv]: -g, [wo]: g, [save]: -g }
    constraints.push(
      ` other${t}: ${expr(other)} = ${fmt(
        g * (taxFreeInflow + (committed?.other ?? 0) + (strategyMoved?.other ?? 0)),
      )}`,
    )
    if (hasTaxable) {
      const taxable: Terms = { [`taxable${t + 1}`]: 1, [`taxable${t}`]: -g, [wtax]: g }
      constraints.push(
        ` taxable${t}: ${expr(taxable)} = ${fmt(
          g * ((y.taxableInflow ?? 0) + (committed?.taxable ?? 0) + (strategyMoved?.taxable ?? 0)),
        )}`,
      )
    }
  }

  // Objective: ending other (whole) + ending traditional net of the haircut,
  // expressed in today's dollars (a constant deflator; argmax unchanged). Plus a
  // tiny per-conversion reward so that discretionary traditional-drainage — which
  // a conversion and a taxable withdrawal-to-savings model identically here — is
  // canonically reported as a CONVERSION (the only lever `simulate` can act on
  // via the schedule). ε ≪ any bracket-rate difference, so it breaks genuine
  // ties only and never drives an uneconomic conversion.
  const deflate = input.realDollarFactor ?? 1
  const CONVERSION_TIE_BREAK = 1e-6
  const objTerms: Terms = {
    [`other${n}`]: deflate,
    [`trad${n}`]: deflate * (1 - liquidationRate),
    [`inh${n}`]: deflate * (1 - liquidationRate),
  }
  // Ending taxable counts at full value (heirs get a basis step-up; the exact
  // ledger prices the true estate treatment). Only present when split out.
  if (hasTaxable) objTerms[`taxable${n}`] = deflate
  for (let t = 0; t < n; t++) objTerms[`conv${t}`] = CONVERSION_TIE_BREAK
  const objective = expr(objTerms)

  const bounds = [
    ` trad0 = ${fmt(input.openingTrad)}`,
    ` inh0 = ${fmt(input.openingInheritedTrad)}`,
    ` other0 = ${fmt(input.openingOther)}`,
    ...(hasTaxable ? [` taxable0 = ${fmt(openingTaxable)}`] : []),
    ...segBounds,
  ]

  const lp = [
    'Maximize',
    ` obj: ${objective}`,
    'Subject To',
    ...constraints,
    'Bounds',
    ...bounds,
    'Binaries',
    ` ${binaries.join(' ')}`,
    'End',
  ].join('\n')

  return { lp, binaryCount: binaries.length, bigM }
}

/**
 * Standard deduction (+ age-65 addition) for the year, read straight off
 * `y.pack`. The caller hands the LP a pack already carried forward by
 * `indexFederalTaxPack`, so this figure — and the bracket bands in
 * `bracketSegments` — arrive indexed exactly as `computeFederalTax` will apply
 * them for the same year. The two engines must agree: an LP pricing conversions
 * off different thresholds than the exact ledger produces a schedule the ledger
 * then re-prices as worse than the solver believed, whichever way the mismatch
 * runs. (An earlier revision scaled here while the ledger did not, which is how
 * that failure was first seen; the fix is one shared projected pack, not a
 * second scaling.)
 *
 * Do NOT re-scale in this function: the pack it reads is already projected, and
 * multiplying twice is the same class of error as not multiplying at all.
 * IRMAA thresholds do not come from the projected pack at all: `buildOptimizerModel`
 * multiplies them by `y.inflationScale` itself, which is why that factor is still
 * carried on `OptimizerYear` alongside the already-projected pack. The OBBBA
 * senior deduction is handled in the model builder (it needs the MAGI-dependent
 * phase-out) and is NOT indexed — IRC 151(d)(5)(C) sets a flat 6,000 dollars
 * with no cost-of-living provision.
 */
function pack65Deduction(y: OptimizerYear): number {
  const f = y.filingStatus
  const base = y.pack.federalTax.standardDeduction[f]
  const age65 = y.peopleAged65Plus > 0 ? y.pack.federalTax.age65Addition[f] * y.peopleAged65Plus : 0
  return base + age65
}

// HiGHS loader is async + costly; memoise per process/worker.
type HighsModule = { solve: OptimizerSolver }
let highsPromise: Promise<HighsModule> | null = null
async function getHighs(locateFile?: (f: string) => string): Promise<HighsModule> {
  if (!highsPromise) {
    // highs ships CJS with an `export default` in its types; under Node16
    // resolution the namespace type isn't callable, but at runtime `.default`
    // is the loader function in both Node ESM and bundler interop.
    const loader = (await import('highs')).default as unknown as (options?: {
      locateFile?: (file: string) => string
    }) => Promise<HighsModule>
    // A REJECTED load must not stay in the memo. Storing the pending promise
    // and never clearing it turns one transient wasm load failure into a
    // permanently dead optimizer for the rest of the worker's life, with a
    // page reload the only recovery; clearing lets the next call try again.
    const loading: Promise<HighsModule> = loader(locateFile ? { locateFile } : undefined).catch(
      (reason: unknown) => {
        if (highsPromise === loading) highsPromise = null
        throw reason
      },
    )
    highsPromise = loading
  }
  return highsPromise
}

const STATUS_MAP: Record<string, OptimizedSchedule['status']> = {
  Optimal: 'optimal',
  'Time limit reached': 'timeout',
  'Iteration limit reached': 'timeout',
  Infeasible: 'infeasible',
  'Primal infeasible or unbounded': 'infeasible',
}

/**
 * Solve the multi-year conversion/withdrawal MILP. Returns a per-year schedule
 * plus a conversions array ready to feed the `optimized` Roth strategy.
 */
export async function optimizeSchedule(input: OptimizerInput): Promise<OptimizedSchedule> {
  const model = buildOptimizerModel(input)
  const solve = input.options?.solve ?? (await getHighs(input.options?.locateFile)).solve

  const t0 = globalThis.performance?.now?.() ?? Date.now()
  const sol = solve(model.lp, {
    output_flag: false,
    time_limit: input.options?.timeLimitSec ?? 10,
  })
  const solveMs = (globalThis.performance?.now?.() ?? Date.now()) - t0

  const objectiveValue = typeof sol.ObjectiveValue === 'number' ? sol.ObjectiveValue : 0
  const columns = sol.Columns ?? {}
  const status = STATUS_MAP[sol.Status] ?? (objectiveValue ? 'feasible' : 'infeasible')
  const col = (name: string) => {
    const c = columns[name]
    return c && typeof c.Primal === 'number' ? c.Primal : 0
  }

  // Gain fraction of a taxable withdrawal, for the LTCG readout (mirrors the model).
  const gainFraction = Math.min(1, Math.max(0, 1 - (input.taxableBasisRatio ?? 1)))
  const ltcgRate = Number.isFinite(input.ltcgRate) ? Math.max(0, input.ltcgRate ?? 0) : 0

  const schedule: OptimizedYear[] = []
  const conversions: { year: number; amount: number }[] = []
  let lifetimeTax = 0
  for (let t = 0; t < input.years.length; t++) {
    const y = input.years[t]!
    const conversion = round(col(`conv${t}`))
    const withdrawTraditional = round(col(`wt${t}`))
    const withdrawInheritedTraditional = round(col(`wi${t}`))
    const withdrawTaxable = round(col(`wtax${t}`))
    const taxableGainRealized = round(withdrawTaxable * gainFraction)
    const taxableOrdinary = round(col(`ti${t}`))
    // Reconstruct modeled tax for the readout (federal PWL + state + IRMAA + LTCG).
    let tier = 0
    const irmaa = irmaaIncrements(y.pack)
    irmaa.forEach((_, k) => {
      if (col(`irmaa${t}_${k}`) > 0.5) tier = k + 1
    })
    lifetimeTax +=
      federalTaxOn(taxableOrdinary, y) +
      taxableOrdinary * y.stateRate +
      stateBracketTaxOn(taxableOrdinary, y) +
      irmaaSurchargeFor(y, tier) +
      taxableGainRealized * ltcgRate
    if (conversion > 0.5) conversions.push({ year: y.year, amount: conversion })
    schedule.push({
      year: y.year,
      conversion,
      withdrawTraditional,
      withdrawInheritedTraditional,
      withdrawOther: round(col(`wo${t}`)),
      withdrawTaxable,
      taxableGainRealized,
      taxableOrdinary,
      irmaaTier: tier,
      endTrad: round(col(`trad${t + 1}`)),
      endInheritedTrad: round(col(`inh${t + 1}`)),
      endOther: round(col(`other${t + 1}`)),
      endTaxable: round(col(`taxable${t + 1}`)),
    })
  }

  return {
    status,
    endingAfterTax: round(objectiveValue),
    lifetimeTax: round(lifetimeTax),
    schedule,
    conversions,
    solveMs,
  }
}

function round(x: number): number {
  return Math.round(x * 100) / 100
}

function federalTaxOn(taxableOrdinary: number, y: OptimizerYear): number {
  let remaining = taxableOrdinary
  let tax = 0
  for (const seg of bracketSegments(y.pack, y.filingStatus)) {
    if (remaining <= 0) break
    const take = seg.width === null ? remaining : Math.min(remaining, seg.width)
    tax += take * seg.rate
    remaining -= take
  }
  return tax
}

/** State bracket PWL tax on taxable ordinary income (0 when the year is flat-only). */
function stateBracketTaxOn(taxableOrdinary: number, y: OptimizerYear): number {
  if (!y.stateBrackets || y.stateBrackets.length === 0) return 0
  let remaining = taxableOrdinary
  let tax = 0
  for (const seg of y.stateBrackets) {
    if (remaining <= 0) break
    const width = seg.width === null ? remaining : Math.min(remaining, seg.width)
    tax += width * seg.rate
    remaining -= width
  }
  return tax
}

function irmaaSurchargeFor(y: OptimizerYear, tier: number): number {
  if (tier <= 0) return 0
  return irmaaIncrements(y.pack)
    .slice(0, tier)
    .reduce((a, t) => a + t.surcharge, 0)
}
