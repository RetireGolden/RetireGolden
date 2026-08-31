/**
 * Fixed-asset dispositions — the once-per-year annual phase (step 6), lifted
 * out of `simulatePlan` as a pure function ("extract the domain you touch",
 * DOCS/standards.md). The domain, as it was documented at the call site:
 *
 * > With a cost basis on a property account, this year's planned sale is
 * > priced exactly — selling costs, §121 primary-residence exclusion, and
 * > depreciation recapture — and its gains join the year's tax base up
 * > front. Net proceeds enter the cash flow (so the sale can fund its own
 * > tax), and the property-events block below zeroes the value without the
 * > legacy tax-free deposit. Without a cost basis the legacy
 * > expectedNetProceeds path is untouched.
 *
 * WHAT IT TAKES: the plan's account list plus the year-scoped state the phase
 * reads — the projected calendar year, this year's property values, the year's
 * filing status and parameter pack, the open HECM lines, and the caller's pure
 * inflation-rate lookup.
 *
 * WHAT IT PRODUCES: one row per property account that actually sells this
 * year, in `accounts` order. The pricing itself is not new here and does not
 * live in this module: it is `tax/propertySale.ts#propertySaleTax`, an already
 * extracted, already tested and already attested pure calculator, which this
 * module calls. What this module owns is the ORCHESTRATION — which accounts
 * sell, what the sale is priced against, how a HECM on the sold home is
 * repaid, and what each sale hands back to the year.
 *
 * WHAT IT REFUSES: it will not sum across rows. The caller's `ordinaryIncome`
 * and `oneTimeGains` are both already non-zero when this phase runs (wages,
 * taxable yield, recurring, one-time, annuity and pension income and the TIPS
 * ladder have landed in the first; a one-time capital-gain stream can seed the
 * second), and IEEE-754 addition is not associative, so
 * `ordinaryIncome += g1; ordinaryIncome += g2` is not in general equal to
 * `ordinaryIncome += (g1 + g2)`. Returning rows and letting the caller fold
 * them one at a time keeps every floating-point operation identical and
 * identically ordered to the inlined phase this replaces. It also refuses to
 * own the year's running total `propertySaleProceedsTotal`: that is read far
 * downstream inside the re-entrant annual pass and stays in `simulatePlan`'s
 * year scope.
 *
 * It mutates nothing — not the accounts (which ARE the caller's `Plan` objects
 * by reference), not the property values (the property-events block zeroes
 * those later, and a write here would double-count against it), not the HECM
 * line map — and holds no module-scope state, so it is safe under the
 * optimizer's and Monte Carlo's repeated re-entry into `simulatePlan` against
 * the same `Plan` object.
 *
 * THE DELETE-AS-YOU-GO RULE. The inlined phase closed a HECM line with
 * `hecmStates.delete(id)` INSIDE the loop, so a later iteration reading the
 * same id saw no line. Account ids are not globally unique in a valid `Plan`:
 * `model/plan.ts` raises `duplicate account id` only when a retirement action
 * references the id, so two property accounts may legally share one. This
 * module therefore tracks the ids it has already closed and reports a line as
 * absent for the second row, rather than handing the caller a set of deletes
 * to apply afterwards — a post-hoc delete would give the second row a payoff
 * the inlined phase never gave it. The caller still performs the deletion; it
 * is told which id to close, and when.
 */
import type { Account } from '../../model/plan.js'
import type { FilingStatus, ParameterPack } from '../../params/types.js'
import { propertySaleTax } from '../../tax/propertySale.js'
import type { RecordedPropertySale } from '../annualCashFlowYearSites.js'

/**
 * The year-scoped state this phase reads. Every field is `readonly`, and the
 * two maps are `ReadonlyMap`, so the non-mutation claim above is checked by
 * the compiler rather than asserted in prose.
 */
export interface FixedAssetDispositionYearInput {
  /**
   * `plan.accounts`. Iteration order is load-bearing: it fixes the order the
   * caller folds the gain legs in, and IEEE-754 addition is not associative.
   */
  readonly accounts: readonly Readonly<Account>[]
  /** The projected calendar year. */
  readonly year: number
  /** This year's property values, before the sale year's inflation growth. */
  readonly propertyValues: ReadonlyMap<string, number>
  /**
   * The caller's per-year general-inflation lookup (pure, read-only). Passed
   * as a FUNCTION and called per row, exactly as the inlined phase did: it
   * closes over the Monte Carlo inflation path, so substituting the plan's
   * flat assumption would silently break every market-path run.
   */
  readonly inflRateAt: (year: number) => number
  /** The year's tax filing status. */
  readonly filingStatus: FilingStatus
  /** The year's parameter pack, by reference — never rebuilt here. */
  readonly pack: ParameterPack
  /** Open HECM lines by property account id. Read-only; see the delete-as-you-go rule. */
  readonly hecmStates: ReadonlyMap<string, { readonly loanBalance: number }>
}

/** One property account's disposition for one year. */
export interface FixedAssetDispositionRow {
  readonly propertyAccountId: string
  /** Gain taxed as ordinary income (depreciation recapture). */
  readonly ordinaryGain: number
  /** Gain taxed as long-term capital gain, after any §121 exclusion. */
  readonly capitalGain: number
  /** Cash the sale nets after repaying any HECM on the sold home. */
  readonly netProceedsAfterHecm: number
  /**
   * The account id whose HECM line this sale closes, or null when the sold
   * home carried no open line. Driven by the line EXISTING, not by the payoff
   * being positive: a line drawn to a zero balance still closes.
   */
  readonly closesHecmForAccountId: string | null
  /**
   * The ledger payload for this sale. Built from the same computed values as
   * the row's own scalars, never recomputed, and handed to the caller to
   * publish unrebuilt. That sharing is how this module is written; the unit
   * test compares the two by value, which cannot tell a shared local from a
   * re-evaluation of the same expression.
   */
  readonly record: RecordedPropertySale
}

/** One row per property account that sells this year, in `accounts` order. */
export function fixedAssetDispositions(
  input: FixedAssetDispositionYearInput,
): readonly FixedAssetDispositionRow[] {
  const { accounts, year, propertyValues, inflRateAt, filingStatus, pack, hecmStates } = input
  const rows: FixedAssetDispositionRow[] = []
  // Ids whose HECM line an earlier row in THIS year already closed. See the
  // delete-as-you-go rule in the module header.
  const closed = new Set<string>()
  for (const account of accounts) {
    if (account.type !== 'property' || account.plannedSaleYear !== year || account.costBasis === undefined) continue
    const value = propertyValues.get(account.id) ?? 0
    if (value <= 0) continue
    // Match the property-events block: the sale year's inflation growth
    // accrues before the sale.
    const sale = propertySaleTax({
      salePrice: value * (1 + inflRateAt(year)),
      costBasis: account.costBasis,
      sellingCostPct: account.sellingCostPct,
      primaryResidence: account.primaryResidence,
      depreciationRecapture: account.depreciationRecapture,
      filingStatus,
      pack,
    })
    // A HECM on the sold home is repaid from the proceeds, non-recourse:
    // the payoff never exceeds what the sale nets, and the line closes.
    // (Loan repayment does not change the taxable gain computed above.)
    // The `Math.max(0, ...)` floor inside that clamp is defensive and is not
    // reachable through a validated `Plan`: `model/plan.ts` caps
    // `sellingCostPct` at 25, so `propertySaleTax` never returns a negative
    // `netProceeds`. Removing the floor alone moves ZERO oracle entries and
    // fails no test; it is kept verbatim from the inlined phase rather than
    // tidied away. The `Math.min` around it is the load-bearing half.
    const hecmState = closed.has(account.id) ? undefined : hecmStates.get(account.id)
    let hecmPayoff = 0
    let closesHecmForAccountId: string | null = null
    if (hecmState) {
      hecmPayoff = Math.min(hecmState.loanBalance, Math.max(0, sale.netProceeds))
      closesHecmForAccountId = account.id
      closed.add(account.id)
    }
    const netProceedsAfterHecm = sale.netProceeds - hecmPayoff
    rows.push({
      propertyAccountId: account.id,
      ordinaryGain: sale.ordinaryGain,
      capitalGain: sale.capitalGain,
      netProceedsAfterHecm,
      closesHecmForAccountId,
      record: {
        propertyAccountId: account.id,
        netProceedsAfterHecm,
        ordinaryGain: sale.ordinaryGain,
        capitalGain: sale.capitalGain,
      },
    })
  }
  return rows
}
