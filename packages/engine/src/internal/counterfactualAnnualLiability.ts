import {
  mintAnnualLiabilityRunIdentity,
  type AnnualLiabilityRunIdentity,
  type AnnualLiabilityRunTaxInput,
} from '../actions/annualLiabilityRunIdentity.js'
import {
  reducedConversionTaxFundingExactCentAmount,
  type ConversionTaxFundingExactCentAmount,
} from '../actions/conversionTaxFundingEvidence.js'
import type { ActionId } from '../actions/identity.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import {
  beginSimulatorAnnualPassTransaction,
  type SimulatorAnnualPassStateBindings,
  type SimulatorAnnualPassTransaction,
} from '../projection/annualPassTransaction.js'

/**
 * The counterfactual annual pass: run one simulated year's post-contribution
 * pass again with a named set of retirement-action requests removed, read the
 * liability that run produced, and unconditionally undo it.
 *
 * `T0` — "the exact full-year federal/state tax-and-penalty liability from the
 * same annual request set with every conversion in this annual group and every
 * dedicated linked withdrawal omitted" — has never had a producer anywhere in
 * this engine. `conversionTaxFundingEvidence.ts` takes it as a caller-supplied
 * input and says in its own docblock that until the pass that computes it
 * exists, no caller can supply an honest pair. This module is that pass's
 * driver. It computes no tax itself: the annual pass is the only thing that can,
 * and a liability assembled from anything less than a whole pass would be the
 * marginal-rate estimate the contract explicitly forbids.
 *
 * Three properties are the whole of the design, and each is a refusal of an
 * easier shape.
 *
 * **The modification is an omission set, not a substituted Plan.** The pass
 * derives its request set from the Plan it closes over, and it also reads that
 * Plan for accounts, household, expenses, strategies and assumptions across
 * thousands of lines. Handing it a different Plan object to remove three
 * requests would silently change every one of those reads. So the caller passes
 * the set of action IDs to omit and the pass narrows only where the year's
 * requests are derived.
 *
 * **The counterfactual is a pre-pass, never a nested call.** The pass writes the
 * year's mutable simulator state directly, so re-entering it from inside itself
 * would corrupt the outer run before any checkpoint could tell the two apart.
 * The counterfactual therefore runs first, inside its own annual-pass
 * transaction, and is rolled back before the run that commits begins.
 *
 * **The rollback is unconditional and its failure is fatal to the reading.** The
 * occurrence recorder is a bare push with no dedupe, so nothing downstream
 * prevents a leaked counterfactual occurrence — it is caught, but as a
 * contiguity or coverage failure that disqualifies an owner and silently falls
 * back to legacy pro-rata economics. A reading is therefore returned only when
 * the restoration provably happened; a rollback that throws yields a refusal
 * even though the liability was read successfully, because a correct number
 * standing beside corrupted state is worse than no number.
 *
 * Nothing in the engine's product path calls this. `simulatePlan` reaches it
 * only through an opt-in option that no product caller sets, which exists so
 * these properties can be proved against the real annual pass over a real
 * multi-year projection instead of against a stand-in. The consumer is the group
 * executor slice (PR C): it will move this call inside the bounded attempt
 * driver's per-attempt scope, where the counterfactual and the run that commits
 * share one assumption vector, and hand the reading to
 * `buildConversionTaxFundingAnnualGroupEvidence` as its `baselineT0` half.
 */

/**
 * The three figures a counterfactual run reads off the annual pass's published
 * year, and nothing else.
 *
 * Named as its own type rather than taken as the whole `YearResult` so that
 * which figures `T0` is cannot drift. The contract's `T0` is a *tax-and-penalty*
 * total, so both halves are named; and `tax` is the year's final post-pass
 * liability — the figure the converged funding solve settled on and the year
 * publishes — never the advisory federal detail recomputed afterwards for
 * gain-harvesting headroom, and never a marginal-rate estimate.
 */
export interface CounterfactualAnnualPassLiabilityFigures {
  readonly year: number
  readonly tax: number
  readonly penalties: number
}

/** The annual pass, narrowed to what a counterfactual run needs from it. */
export type RunCounterfactualAnnualPass = (
  omittedRetirementActionIds: ReadonlySet<ActionId>,
) => { readonly yearResult: Readonly<CounterfactualAnnualPassLiabilityFigures> }

export interface CounterfactualAnnualLiabilityRequest {
  readonly planId: string
  readonly taxUnitId: string
  readonly taxYear: number
  /** Retirement-action IDs the counterfactual run omits. May be empty. */
  readonly omitActionIds: readonly ActionId[]
  /**
   * The run's inputs other than the omission itself, as the identity minter
   * spells them.
   *
   * Caller-supplied because the non-group income, deduction, credit and penalty
   * inputs are what `taxUnitEvidenceId` records, and the baseline and candidate
   * runs must agree about all of them. This module contributes exactly one input
   * of its own: the omission.
   */
  readonly nonGroupTaxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[]
}

export interface RunCounterfactualAnnualLiabilityInput {
  readonly state: SimulatorAnnualPassStateBindings
  readonly request: Readonly<CounterfactualAnnualLiabilityRequest>
  readonly runPass: RunCounterfactualAnnualPass
}

/**
 * The two plan-dollar figures the liability was read from, carried beside the
 * exact rational so a reader can see which fields of the pass's own year result
 * were named rather than having to trust that the right ones were.
 */
export interface CounterfactualAnnualLiabilityComponents {
  readonly source: 'annualPassYearResult'
  readonly taxPlanDollars: number
  readonly penaltiesPlanDollars: number
}

export interface CounterfactualAnnualLiabilityRead {
  readonly status: 'counterfactualAnnualLiabilityRead'
  readonly restoration: 'checkpointRestored'
  readonly taxYear: number
  /** Sorted and deduplicated, exactly as the omission the pass was given. */
  readonly omittedActionIds: readonly ActionId[]
  readonly liability: Readonly<ConversionTaxFundingExactCentAmount>
  readonly liabilityComponents: Readonly<CounterfactualAnnualLiabilityComponents>
  readonly identity: Readonly<AnnualLiabilityRunIdentity>
}

export type CounterfactualAnnualLiabilityRefusalKind =
  /** The natural key, the omission set, or the supplied tax inputs are unusable. */
  | 'requestInvalid'
  /** Opening the annual-pass checkpoint threw. Nothing ran. */
  | 'checkpointUnavailable'
  /** The pass itself threw. Its partial mutations were rolled back. */
  | 'annualPassThrew'
  /** The pass answered for another year, or its liability figures are unreadable. */
  | 'liabilityUnreadable'
  /** The `baselineT0` run identity could not be minted. */
  | 'runIdentityUnmintable'
  /** The rollback did not complete. No reading may be trusted after this. */
  | 'restorationFailed'

export interface CounterfactualAnnualLiabilityRefused {
  readonly status: 'counterfactualAnnualLiabilityRefused'
  readonly restoration: 'checkpointRestored' | 'notOpened' | 'failed'
  readonly reason: CounterfactualAnnualLiabilityRefusalKind
  readonly detail: string
}

export type CounterfactualAnnualLiabilityResult =
  | CounterfactualAnnualLiabilityRead
  | CounterfactualAnnualLiabilityRefused

/** The input ID under which a counterfactual run states what it removed. */
export const COUNTERFACTUAL_OMISSION_TAX_INPUT_ID =
  'counterfactualOmittedRetirementActionIds'

interface ExactCents {
  readonly numerator: bigint
  readonly denominator: bigint
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function refused(
  reason: CounterfactualAnnualLiabilityRefusalKind,
  restoration: CounterfactualAnnualLiabilityRefused['restoration'],
  detail: string,
): Readonly<CounterfactualAnnualLiabilityRefused> {
  return deepFreeze({
    status: 'counterfactualAnnualLiabilityRefused' as const,
    restoration,
    reason,
    detail,
  })
}

/**
 * The exact cents a simulator plan-dollar figure stands for, with nothing
 * rounded.
 *
 * The finite JavaScript number's own decimal spelling is authoritative, the same
 * convention `planBalanceAdapter.ts` states for balances. The difference is the
 * rounding: a balance becomes whole cents because the ledger it enters counts
 * whole cents, while a liability must not, because the contract subtracts two
 * liabilities before quantizing the single difference once. Rounding each
 * liability to a cent first would round twice, and two roundings can differ from
 * one by a cent that then propagates into every allocated share.
 */
function exactCentsFromPlanDollars(dollars: number): ExactCents | null {
  if (!Number.isFinite(dollars) || dollars < 0 || Object.is(dollars, -0)) {
    return null
  }
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(dollars))
  if (match === null) return null
  const fraction = match[2] ?? ''
  const coefficient = BigInt(`${match[1]}${fraction}`)
  const centScale = Number(match[3] ?? 0) + 2 - fraction.length
  return centScale >= 0
    ? { numerator: coefficient * 10n ** BigInt(centScale), denominator: 1n }
    : { numerator: coefficient, denominator: 10n ** BigInt(-centScale) }
}

function addExactCents(left: ExactCents, right: ExactCents): ExactCents {
  return {
    numerator: left.numerator * right.denominator +
      right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  }
}

/** The exact tax-and-penalty total, with each half converted before the sum. */
function liabilityFromYearResult(
  yearResult: Readonly<CounterfactualAnnualPassLiabilityFigures>,
): Readonly<ConversionTaxFundingExactCentAmount> | null {
  const tax = exactCentsFromPlanDollars(yearResult.tax)
  const penalties = exactCentsFromPlanDollars(yearResult.penalties)
  if (tax === null || penalties === null) return null
  const total = addExactCents(tax, penalties)
  return reducedConversionTaxFundingExactCentAmount(
    total.numerator,
    total.denominator,
  )
}

function nonBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function omittedActionIds(
  supplied: readonly ActionId[],
): ActionId[] | null {
  if (!Array.isArray(supplied)) return null
  if (!supplied.every(nonBlank)) return null
  const sorted = [...supplied].sort(compareUtf16CodeUnits)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1]) return null
  }
  return sorted
}

function taxInputs(
  request: Readonly<CounterfactualAnnualLiabilityRequest>,
  omitted: readonly ActionId[],
): Readonly<AnnualLiabilityRunTaxInput>[] | null {
  if (!Array.isArray(request.nonGroupTaxInputs)) return null
  if (
    request.nonGroupTaxInputs.some(
      (input) => input?.inputId === COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
    )
  ) {
    // The omission is this module's own claim about the run. A caller that could
    // also state it could state a different one, and the snapshot ID would then
    // describe a counterfactual that never happened.
    return null
  }
  return [
    ...request.nonGroupTaxInputs,
    {
      inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
      // A declared term, not an amount: the omission is a choice about which
      // requests were in the run, and an integer encoding of it would compare
      // equal to some unrelated figure. Stating it as an input at all is what
      // stops two runs over one filing unit and year, differing only in what
      // they removed, from claiming a single input snapshot -- the snapshot ID
      // names the inputs, and what a counterfactual was told to remove is one
      // of them. An empty omission spells `[]` and is stated just as loudly,
      // because "this run removed nothing" is a fact about the run rather than
      // the absence of one.
      value: {
        representation: 'declaredTerm' as const,
        term: JSON.stringify(omitted),
      },
    },
  ]
}

/**
 * Run one counterfactual annual pass and read its liability, restoring the
 * simulator's annual-pass state before returning either way.
 *
 * Non-throwing and total: every refusal is a typed status, because the caller
 * this is built for is inside a projection year that must fail closed rather
 * than abort the whole projection.
 */
export function runCounterfactualAnnualLiability(
  input: Readonly<RunCounterfactualAnnualLiabilityInput>,
): Readonly<CounterfactualAnnualLiabilityResult> {
  const { state, request, runPass } =
    (input ?? {}) as Partial<RunCounterfactualAnnualLiabilityInput>
  if (
    request === undefined || typeof request !== 'object' ||
    typeof runPass !== 'function' ||
    state === undefined || typeof state !== 'object' ||
    !nonBlank(request.planId) || !nonBlank(request.taxUnitId) ||
    !Number.isInteger(request.taxYear) || request.taxYear < 1 ||
    request.taxYear > 9999
  ) {
    return refused(
      'requestInvalid',
      'notOpened',
      'A counterfactual annual liability run requires its natural key, its state bindings, and a pass to run.',
    )
  }
  const omitted = omittedActionIds(request.omitActionIds)
  if (omitted === null) {
    return refused(
      'requestInvalid',
      'notOpened',
      'The omitted action IDs must be a set of distinct nonblank identifiers.',
    )
  }
  const inputs = taxInputs(request, omitted)
  if (inputs === null) {
    return refused(
      'requestInvalid',
      'notOpened',
      `The supplied tax inputs must not include "${COUNTERFACTUAL_OMISSION_TAX_INPUT_ID}".`,
    )
  }

  let transaction: SimulatorAnnualPassTransaction<never>
  try {
    transaction = beginSimulatorAnnualPassTransaction(state)
  } catch {
    return refused(
      'checkpointUnavailable',
      'notOpened',
      'The annual-pass checkpoint could not be opened, so no counterfactual ran.',
    )
  }

  let read: Readonly<CounterfactualAnnualLiabilityRead> | null = null
  let refusal: Readonly<CounterfactualAnnualLiabilityRefused> | null = null
  try {
    const { yearResult } = runPass(new Set(omitted))
    if (yearResult.year !== request.taxYear) {
      refusal = refused(
        'liabilityUnreadable',
        'checkpointRestored',
        'The counterfactual pass did not answer for the requested tax year.',
      )
    } else {
      const liability = liabilityFromYearResult(yearResult)
      if (liability === null) {
        refusal = refused(
          'liabilityUnreadable',
          'checkpointRestored',
          'The counterfactual pass produced a tax-and-penalty total with no exact cent spelling.',
        )
      } else {
        const minted = mintAnnualLiabilityRunIdentity({
          planId: request.planId,
          taxUnitId: request.taxUnitId,
          taxYear: request.taxYear,
          liabilityRun: {
            liabilityRunKind: 'baselineT0',
            candidateFundingVectorEvidenceId: null,
          },
          taxInputs: inputs,
        })
        if (minted.status !== 'annualLiabilityRunIdentityMinted') {
          refusal = refused(
            'runIdentityUnmintable',
            'checkpointRestored',
            minted.issues[0].detail,
          )
        } else {
          read = deepFreeze({
            status: 'counterfactualAnnualLiabilityRead' as const,
            restoration: 'checkpointRestored' as const,
            taxYear: request.taxYear,
            omittedActionIds: [...omitted],
            liability: { ...liability },
            liabilityComponents: {
              source: 'annualPassYearResult' as const,
              taxPlanDollars: yearResult.tax,
              penaltiesPlanDollars: yearResult.penalties,
            },
            identity: minted.identity,
          })
        }
      }
    }
  } catch {
    refusal = refused(
      'annualPassThrew',
      'checkpointRestored',
      'The counterfactual annual pass threw; its mutations were rolled back.',
    )
  } finally {
    try {
      transaction.rollback()
    } catch {
      // Restoration is the only thing standing between a counterfactual and a
      // leaked runtime occurrence, so its failure outranks a successful read.
      read = null
      refusal = refused(
        'restorationFailed',
        'failed',
        'The counterfactual annual pass could not be rolled back; no reading from it is usable.',
      )
    }
  }
  return read ?? refusal ?? refused(
    'liabilityUnreadable',
    'checkpointRestored',
    'The counterfactual annual pass produced no reading.',
  )
}
