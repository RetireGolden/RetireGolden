/**
 * Annual rebalance to target (start-of-year trade) — the once-per-year annual
 * phase lifted out of `simulatePlan` as a pure function ("extract the domain
 * you touch", DOCS/standards.md). The domain, as it was labelled at the call
 * site:
 *
 * > Allocated accounts trade drifted weights back to this year's glidepath
 * > target. Taxable sells realize gains pro-rata through the same basis-ratio
 * > machinery as withdrawals (basis rises by the realized gain: sold basis
 * > leaves, the reinvested proceeds enter at market); traditional/Roth/HSA
 * > rebalances are tax-free. rebalancing: 'none' opts out — weights drift.
 *
 * WHAT IT TAKES: the year's balance states plus the allocation tracks they are
 * keyed against, and the two years that gate the phase — the projected year and
 * the projection's start year.
 *
 * WHAT IT PRODUCES: exactly ONE row per `states` entry, in `states` order,
 * including a `none` row for a state that has no track, opts out with
 * `rebalancing: 'none'`, or is being evaluated in the start year. Rows are not
 * filtered down to the contributing ones on purpose: `rows.length ===
 * states.length` turns silent UNDER-PRODUCTION into a length mismatch instead
 * of a quietly missing trade.
 *
 * WHAT IT REFUSES: it will not sum across rows, will not write
 * `allocationTrack`, will not write a `BalanceState`, and will not call a
 * recorder. The caller folds `rebalanceRealizedGains`, assigns
 * `state.costBasis` and `track.weights`, and publishes the ledger row, per row
 * in row order.
 *
 * WHAT THE FOLD GUARD DOWNSTREAM CAN AND CANNOT PROVE, said here rather than
 * left for a reader to assume. `rebalanceRealizedGains` is declared `0` one
 * line above the call site and this phase is its FIRST writer (the annuity- and
 * TIPS-purchase phases that also add to it run later in the same year). At a
 * zero base `0 + g1 + g2` IS `0 + (g1 + g2)`, so an exact match on the year's
 * published `realizedGains` CANNOT distinguish "the caller folded row by row"
 * from "the helper pre-summed left to right and the caller added once". It DOES
 * discriminate a different summation ORDER or GROUPING — rows reversed, grouped
 * by account type, right-associated. That is the whole of the claim.
 *
 * THE RETARGET-AS-YOU-GO RULE, and why an eager helper needs it. The inlined
 * phase wrote `track.weights = target` INSIDE its loop, and `allocationTrack`
 * is keyed by ACCOUNT ID. Account ids are not globally unique in a valid
 * `Plan`: `model/plan.ts` raises `duplicate account id` only when a retirement
 * action references the id, so two taxable accounts may legally share one, and
 * both `BalanceState`s then resolve to the SAME track object. The second one
 * therefore measured its turnover against weights the FIRST one had already
 * snapped to target — turnover 0, no sale. A helper that read every track
 * before the caller wrote any would hand that second account a sale the inlined
 * loop never gave it. So this module keeps a private map of the targets it has
 * already assigned during THIS call and measures turnover against
 * `retargeted.get(id) ?? track.weights`, exactly the shape
 * `internal/fixedAssetDispositions.ts` uses for its `closed` set. The caller
 * still performs the write; it is told what to write, and in what order.
 *
 * (MEASURED, on two identical allocated taxable accounts — 200k balance / 100k
 * basis, static 50/50, `rebalancing: 'annual'`, zero-tax, 2026 start. DISTINCT
 * ids: 2 rebalancing ledger lines and `years[1].realizedGains`
 * 1578.1990521326807. DUPLICATE ids: 1 ledger line and 1577.880080844382. The
 * duplicate figure is not half the distinct one because the PRIOR year's drift
 * also runs twice against the one shared track — that double-drift is outside
 * this phase and unchanged by this extraction, and is noted only so the two
 * numbers are not misread as this module's doing.)
 *
 * IT ALLOCATES MORE THAN THE INLINED PHASE DID, on the default path. The
 * `{ accountId, realizedCapitalGainOrLoss }` literal used to be built INSIDE
 * `yearSites?.recordRebalancingGain({ … })`, and optional chaining does not
 * evaluate a call's arguments when the receiver is nullish — so under default
 * options (every product projection, and every `simulatePlan` re-entry inside
 * Monte Carlo, the optimizer and the spending solver) it was never constructed.
 * Here the row owns it, and it is constructed for every SALE row whether or not
 * a sink will consume it. That sharing is what lets the delegation test assert
 * with `toBe` that the object reaching the ledger IS this one, which is the
 * only check that separates real delegation from a caller that invokes this
 * helper for effect and then records its own byte-identical rebuild. The row
 * objects and the array are new on the default path too, and no arrangement of
 * a pure helper avoids those. MEASURED on a 2-account 36-year linear-glidepath
 * plan (taxable 800k/400k + traditional 900k, production tax calculator): 35
 * nonzero-gain sales across the whole horizon, so at most 35 extra two-field
 * objects per projection, against the 72 row objects the helper allocates
 * anyway. No projection number moves. This is not a claim that the extraction
 * is allocation-neutral; it is not.
 *
 * The `Math.min`/`Math.max` clamp is load-bearing rather than defensive and is
 * lifted operand for operand: normalized weights can sum a few ulps above 1,
 * and `tax/aggregateBasisSale.ts` throws `RangeError` when proceeds exceed
 * opening fair market value.
 *
 * It mutates nothing — the `BalanceState`s and the track objects ARE the
 * caller's, by reference, and are `readonly` here so the compiler checks that
 * rather than the prose asserting it — and it holds no module-scope state, so
 * it is safe under the optimizer's and Monte Carlo's repeated re-entry into
 * `simulatePlan` against the same `Plan` object.
 */
import type { AssetAllocationPolicy } from '../../model/plan.js'
import { rebalanceTurnoverFraction, targetWeightsAt } from '../../allocation/assetClasses.js'
import { aggregateBasisSale } from '../../tax/aggregateBasisSale.js'
import type { RecordedRebalancingGain } from '../annualCashFlowYearSites.js'

/** One `allocationTrack` value, narrowed to what this phase reads. */
export interface AnnualRebalanceTrack {
  readonly policy: AssetAllocationPolicy
  readonly weights: readonly number[]
}

/**
 * One `balances` entry, narrowed to what this phase reads. Structural, so
 * `BalanceState[]` is assignable with no per-year mapping allocation, and
 * `readonly` throughout so the non-mutation claim is compiler-checked.
 */
export interface AnnualRebalanceAccountState {
  readonly account: { readonly id: string; readonly type: string }
  readonly balance: number
  readonly costBasis: number
}

/** The year-scoped state this phase reads. */
export interface AnnualRebalanceYearInput {
  /**
   * `balances`. Iteration order is load-bearing TWICE: it fixes the order the
   * caller folds `rebalanceRealizedGains` in, and it fixes the order of the
   * published `metadata:capitalGain:rebalancing:*` ledger lines.
   */
  readonly states: readonly AnnualRebalanceAccountState[]
  /** `allocationTrack`, by account id. See the retarget-as-you-go rule. */
  readonly allocationTrack: ReadonlyMap<string, AnnualRebalanceTrack>
  /** The projected calendar year. */
  readonly year: number
  /** The projection's first year: no rebalance happens in it. */
  readonly startYear: number
}

/**
 * What the caller must do for one `states` entry.
 *
 * `none` — do nothing at all. `retarget` — snap the track's weights, realizing
 * nothing (this is the traditional/Roth/HSA case, and the taxable case whose
 * turnover is at or below the 1e-9 gate or whose balance is not positive).
 * `sale` — fold the gain, publish `record`, set the account's closing cost
 * basis, then snap the weights.
 *
 * `targetWeights` is a FRESH array per row. `targetWeightsAt` allocates a new
 * vector on every call in all four policy modes, so no two rows ever share one
 * even when two accounts share a policy object, and nothing downstream reads
 * weight-array identity (`annualPassTransaction.cloneAllocationTrackState`
 * copies with a spread). No dependence on that exists today; keeping one fresh
 * array per row is what keeps it true.
 */
export type AnnualRebalanceRow =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'retarget'
      readonly accountId: string
      readonly targetWeights: number[]
    }
  | {
      readonly kind: 'sale'
      readonly accountId: string
      readonly targetWeights: number[]
      readonly realizedCapitalGainOrLoss: number
      /** `sale.remainingCostBasis + sellAmount`, operand for operand. */
      readonly closingCostBasis: number
      /**
       * The ledger payload, built from the same double as the row's own
       * `realizedCapitalGainOrLoss` and handed over UNREBUILT.
       */
      readonly record: RecordedRebalancingGain
    }

/** Exactly one row per `states` entry, in `states` order. Never sums across rows. */
export function annualRebalanceToTarget(
  input: AnnualRebalanceYearInput,
): readonly AnnualRebalanceRow[] {
  const { states, allocationTrack, year, startYear } = input
  const rows: AnnualRebalanceRow[] = []
  // Targets already assigned during THIS call, by account id. See the
  // retarget-as-you-go rule in the module header.
  const retargeted = new Map<string, number[]>()
  for (const state of states) {
    const track = allocationTrack.get(state.account.id)
    if (year <= startYear || !track || track.policy.rebalancing === 'none') {
      rows.push({ kind: 'none' })
      continue
    }
    const accountId = state.account.id
    const target = targetWeightsAt(track.policy, year)
    const current = retargeted.get(accountId) ?? track.weights
    const turnover = rebalanceTurnoverFraction(current, target)
    retargeted.set(accountId, target)
    if (turnover > 1e-9 && state.account.type === 'taxable' && state.balance > 0) {
      // Normalized floating-point weights can sum a few ulps above 1.
      // Keep the strict sale helper strict and contain that noise here.
      const sellAmount = Math.min(state.balance, Math.max(0, turnover * state.balance))
      const sale = aggregateBasisSale({
        openingFairMarketValue: state.balance,
        openingCostBasis: state.costBasis,
        saleProceeds: sellAmount,
      })
      rows.push({
        kind: 'sale',
        accountId,
        targetWeights: target,
        realizedCapitalGainOrLoss: sale.realizedCapitalGainOrLoss,
        closingCostBasis: sale.remainingCostBasis + sellAmount,
        record: {
          accountId,
          realizedCapitalGainOrLoss: sale.realizedCapitalGainOrLoss,
        },
      })
      continue
    }
    rows.push({ kind: 'retarget', accountId, targetWeights: target })
  }
  return rows
}
