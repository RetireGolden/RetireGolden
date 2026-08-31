/**
 * TIPS income-floor ladder — the once-per-year annual cash-flow phase, lifted
 * out of `simulatePlan` as a pure function ("extract the domain you touch",
 * DOCS/standards.md). The domain, as it was documented at the call site:
 *
 * > Coupons + maturing principal are cash income; the taxable amount is the
 * > coupons plus this year's inflation accretion on the outstanding face
 * > (the phantom-income OID a taxable TIPS holder reports) — maturing
 * > principal itself is a tax-free return of already-taxed dollars. Federal
 * > ordinary income (incl. NIIT); state-exempt as U.S. government interest.
 *
 * WHAT IT TAKES: the simulator's ladder-state list plus the year-scoped
 * scalars the arithmetic reads (`year`, `startYear`, `anyAlive`, `inflFactor`,
 * `ladderLastAliveYear`) and the caller's pure inflation-factor lookup.
 *
 * WHAT IT PRODUCES: one row per ladder, in `ladderStates` order, describing
 * that ladder's contribution for the year. Deciding that the taxable amount is
 * federal ordinary income and state-exempt U.S. government interest stays with
 * the caller; this module only says how much there is.
 *
 * WHAT IT REFUSES: it will not sum across ladders. The caller's
 * `ordinaryIncome` is already non-zero when this phase runs (wages, taxable
 * yield, recurring and one-time income, Social Security, pensions and
 * annuities have all landed in it), and IEEE-754 addition is not associative,
 * so `ordinaryIncome += t1; ordinaryIncome += t2` is not in general equal to
 * `ordinaryIncome += (t1 + t2)`. Returning rows and letting the caller fold
 * them in one at a time keeps every floating-point operation identical and
 * identically ordered to the inlined phase this replaces. It also refuses to
 * own the year's running totals (`ladderTaxableInterest`, `ladderValueTotal`):
 * those are read far downstream inside the re-entrant annual pass and stay in
 * `simulatePlan`'s year scope.
 *
 * It mutates nothing — not the ladder states (`scale` is written only by the
 * purchase-funding block), not the plan, not any cross-year map — and holds no
 * module-scope state, so it is safe under the optimizer's and Monte Carlo's
 * repeated re-entry into `simulatePlan` against the same `Plan` object.
 */
import { ladderRealFlowsAtOffset, ladderRemainingFace, type LadderRung } from '../../ladder/ladderMath.js'
import type { RecordedTipsLadderCash } from '../annualCashFlowYearSites.js'

/**
 * One entry of the simulator's ladder-state list. `scale` is < 1 when a
 * purchase-year funding account could not cover the full quoted cost; it is
 * written by the purchase-funding block and only read here, but stays mutable
 * because the simulator owns these objects.
 */
export interface TipsLadderState {
  id: string
  anchorYear: number
  rungs: LadderRung[]
  costReal: number
  purchase: { year: number; fundingAccountId: string } | undefined
  scale: number
}

export interface TipsLadderYearInput {
  readonly ladderStates: readonly TipsLadderState[]
  /** The projected calendar year. */
  readonly year: number
  readonly startYear: number
  /** False once no one in the household is alive. */
  readonly anyAlive: boolean
  /** `inflFactorFrom(startYear, year)`, already computed by the caller. */
  readonly inflFactor: number
  /** The caller's cumulative general-inflation lookup (pure, read-only). */
  readonly inflFactorFrom: (fromYear: number, toYear: number) => number
  /** Last calendar year anyone is alive. */
  readonly ladderLastAliveYear: number
}

/**
 * A ladder's contribution for one year. `none` is "contributes nothing at
 * all", kept distinct from contributing zero so the caller never has to lean
 * on `+= 0` being a no-op.
 */
export type TipsLadderYearRow =
  | { readonly kind: 'none' }
  | { readonly kind: 'preFlow'; readonly ladderValue: number }
  | { readonly kind: 'frozen'; readonly ladderValue: number }
  | {
      readonly kind: 'flow'
      readonly cash: number
      readonly taxable: number
      readonly ladderValue: number
      readonly record: RecordedTipsLadderCash
    }

/** One row per ladder, in `ladderStates` order. Never summed across ladders. */
export function tipsLadderAnnualCashFlows(input: TipsLadderYearInput): readonly TipsLadderYearRow[] {
  const { ladderStates, year, startYear, anyAlive, inflFactor, inflFactorFrom, ladderLastAliveYear } = input
  const rows: TipsLadderYearRow[] = []
  for (const ls of ladderStates) {
    const offset = year - ls.anchorYear
    if (offset < 1) {
      // Purchase year (offset 0): the rungs are owned — no flows yet, but
      // their full face rides in net worth so the transfer is value-neutral.
      if (ls.purchase && year >= ls.purchase.year) {
        rows.push({ kind: 'preFlow', ladderValue: ladderRemainingFace(ls.rungs, 0) * ls.scale * inflFactor })
      } else {
        rows.push({ kind: 'none' })
      }
      continue
    }
    if (anyAlive) {
      const flows = ladderRealFlowsAtOffset(ls.rungs, offset)
      const cash = (flows.coupons + flows.maturingPrincipal) * ls.scale * inflFactor
      const prevInflFactor = inflFactorFrom(startYear, year - 1)
      const accretion = flows.outstandingFace * ls.scale * Math.max(0, inflFactor - prevInflFactor)
      const taxable = flows.coupons * ls.scale * inflFactor + accretion
      rows.push({
        kind: 'flow',
        cash,
        taxable,
        ladderValue: ladderRemainingFace(ls.rungs, offset) * ls.scale * inflFactor,
        record: {
          ladderId: ls.id,
          cash,
          coupons: flows.coupons * ls.scale * inflFactor,
          maturingPrincipal: flows.maturingPrincipal * ls.scale * inflFactor,
          accretion,
        },
      })
    } else {
      // No one alive: rungs stop maturing — freeze the remaining face as of
      // the last living year (the rung maturing that year already paid cash)
      // so unmatured principal rides in the estate at its inflation-indexed
      // book value instead of shrinking as offset-space maturities pass.
      const lastAliveOffset = Math.max(0, ladderLastAliveYear - ls.anchorYear)
      rows.push({ kind: 'frozen', ladderValue: ladderRemainingFace(ls.rungs, lastAliveOffset) * ls.scale * inflFactor })
    }
  }
  return rows
}
