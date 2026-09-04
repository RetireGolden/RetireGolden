/**
 * The annual pass's assumed-character resolver, its Form 8606 consequential
 * observer, and the pro-rata split wrapper that joins them.
 *
 * One pass of `simulatePlan` may re-enter the annual ledger several times (T0,
 * staging, the committed settlement), and each entry starts from the settlement
 * effects that entry was handed. So this is built per pass, not per year, and
 * it owns no live ledger state of its own beyond the observation map it
 * returns.
 *
 * What it decides, and what it deliberately does not. `resolveAssumedCharacter`
 * answers only "did the settlement price THIS transaction, under the assumed
 * basis, with exactly these facts?" — every field of the effect has to match,
 * and an unrepresentable Plan-dollar amount, a mismatched owner, scope,
 * account, gross, or a basis return larger than the state still holds, all
 * answer null. `splitWithAssumedCharacter` then falls back to the caller's
 * ordinary pro-rata split, which is the registered legacy tax path, and
 * publishes no assumed-basis verdict for it: the settlement never priced that
 * transaction over the assumption.
 *
 * Extracted from `simulatePlan` as a move: the expressions, the match
 * conditions, the fallback and the channel choice are the caller's, unchanged.
 */
import { deriveOwnedNonRothIraReplayAllocationIdentity } from
  '../../internal/ownedNonRothIraReplayIdentity.js'
import type { OwnedNonRothIraAnnualSettlementEffect } from
  '../../internal/ownedNonRothIraAnnualAttemptSettlement.js'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '../../actions/index.js'
import type { IraProRataYear } from '../../strategies/iraBasis.js'

/** The channels an assumed-basis consequential verdict is reported over. */
export type Form8606ConsequentialChannel =
  | 'distributions'
  | 'conversions'
  | 'annuityPayments'

export interface AnnualAssumedCharacterResolveInput {
  ownerPersonId: string
  calculationScope:
    'form8606Line7Distributions' | 'form8606Line8NetConversions'
  occurrenceKind:
    | 'ownedIraRmd'
    | 'annuityContractDistribution'
    | 'automaticSeppDistribution'
    | 'legacyNeedBasedWithdrawal'
    | 'legacyQcd'
    | 'legacyRothConversion'
    | 'namedRothConversion'
  producerOccurrenceKey: string
  sourceAccountId: string
  mutationOrdinal: number
  grossAmountPlanDollars: number
  remainingBasisPlanDollars?: number
}

/** The caller's own pro-rata split, used whenever no assumed effect matches. */
export type AnnualProRataSplit = (
  readState: IraProRataYear,
  amount: number,
) => { nontaxable: number; taxable: number; next: IraProRataYear }

export interface AnnualAssumedCharacterPhaseInput {
  readonly planId: string
  readonly year: number
  /** Settlement effects for this attempt; only this tax year's are indexed. */
  readonly assumedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  /** Only these owners can produce an assumed-basis consequential verdict. */
  readonly ownersWithOmittedNondeductibleBasis: ReadonlySet<string>
  readonly splitAnnualIraDistribution: AnnualProRataSplit
}

export interface AnnualAssumedCharacterPhaseResult {
  readonly resolveAssumedCharacter: (
    input: AnnualAssumedCharacterResolveInput,
  ) => { basisReturn: number; ordinaryIncome: number } | null
  readonly noteForm8606Taxable: (
    ownerPersonId: string,
    taxable: number,
    channel: Form8606ConsequentialChannel,
  ) => void
  readonly splitWithAssumedCharacter: (
    state: IraProRataYear,
    amount: number,
    input: Omit<
      AnnualAssumedCharacterResolveInput,
      'grossAmountPlanDollars' | 'remainingBasisPlanDollars'
    >,
  ) => { nontaxable: number; taxable: number; next: IraProRataYear }
  /**
   * Observation-only: per-channel Form 8606 taxable ordinary income produced
   * this pass for owners with omitted `nondeductibleBasis`. Live and mutable —
   * the caller hands this very map to the funding-close phase, which publishes
   * it through `publishedEntityFacts`.
   */
  readonly form8606ConsequentialByOwner: Map<string, {
    distributions: number
    conversions: number
    annuityPayments: number
  }>
}

export function annualAssumedCharacterPhase(
  input: AnnualAssumedCharacterPhaseInput,
): AnnualAssumedCharacterPhaseResult {
  const { planId, year, ownersWithOmittedNondeductibleBasis } = input
  const assumedEffectByIdentity = new Map(
    input.assumedEffects
      .filter((effect) => effect.taxYear === year)
      .map((effect) => [
        JSON.stringify([effect.actionId, effect.allocationId]),
        effect,
      ]),
  )
  const resolveAssumedCharacter = (
    resolveInput: AnnualAssumedCharacterResolveInput,
  ): { basisReturn: number; ordinaryIncome: number } | null => {
    let grossAmount: ReturnType<typeof planDollarsToLedgerCents>
    let remainingBasis:
      ReturnType<typeof planDollarsToLedgerCents> | null = null
    try {
      grossAmount = planDollarsToLedgerCents(resolveInput.grossAmountPlanDollars)
      if (resolveInput.remainingBasisPlanDollars !== undefined) {
        remainingBasis = planDollarsToLedgerCents(
          resolveInput.remainingBasisPlanDollars,
        )
      }
    } catch {
      return null
    }
    const identity = deriveOwnedNonRothIraReplayAllocationIdentity({
      planId,
      taxYear: year,
      producerOccurrenceKey: resolveInput.producerOccurrenceKey,
      occurrenceKind: resolveInput.occurrenceKind,
      sourceAccountId: resolveInput.sourceAccountId,
      mutationOrdinal: resolveInput.mutationOrdinal,
    })
    const effect = assumedEffectByIdentity.get(JSON.stringify([
      identity.actionId,
      identity.allocationId,
    ]))
    if (effect === undefined ||
        effect.ownerPersonId !== resolveInput.ownerPersonId ||
        effect.calculationScope !== resolveInput.calculationScope ||
        effect.actionId !== identity.actionId ||
        effect.allocationId !== identity.allocationId ||
        effect.sourceAccountId !== resolveInput.sourceAccountId ||
        effect.grossAmount !== grossAmount ||
        (remainingBasis !== null && effect.basisReturnAmount > remainingBasis)) {
      return null
    }
    return {
      basisReturn: ledgerCentsToPlanDollars(effect.basisReturnAmount),
      ordinaryIncome: ledgerCentsToPlanDollars(effect.ordinaryIncomeAmount),
    }
  }
  /**
   * Observation-only: per-channel Form 8606 taxable ordinary income produced
   * this year for owners with omitted `nondeductibleBasis`. Per-attempt;
   * drives the assumed-basis consequential verdict. Each channel accumulates
   * only the taxable character that channel's binding transaction produced
   * under the assumption — never the year's full gross for that channel.
   */
  const form8606ConsequentialByOwner = new Map<string, {
    distributions: number
    conversions: number
    annuityPayments: number
  }>()
  const noteForm8606Taxable = (
    ownerPersonId: string,
    taxable: number,
    channel: Form8606ConsequentialChannel,
  ): void => {
    if (taxable <= 0 || !ownersWithOmittedNondeductibleBasis.has(ownerPersonId)) return
    const entry = form8606ConsequentialByOwner.get(ownerPersonId) ?? {
      distributions: 0,
      conversions: 0,
      annuityPayments: 0,
    }
    entry[channel] += taxable
    form8606ConsequentialByOwner.set(ownerPersonId, entry)
  }
  const splitWithAssumedCharacter = (
    state: IraProRataYear,
    amount: number,
    splitInput: Omit<
      AnnualAssumedCharacterResolveInput,
      'grossAmountPlanDollars' | 'remainingBasisPlanDollars'
    >,
  ) => {
    const assumed = resolveAssumedCharacter({
      ...splitInput,
      grossAmountPlanDollars: amount,
      remainingBasisPlanDollars: state.basis,
    })
    // Fallback path: settlement published no matching assumed effect, so this
    // draw is priced with the pre-distribution pro-rata state (or full ordinary
    // when that state cannot answer). That is the registered legacy tax path —
    // not an executed character under assumed-zero basis. Do not publish an
    // assumed-basis verdict here (same silence as the annuity refused-settlement
    // site): the settlement never priced this transaction over the assumption.
    if (assumed === null) {
      return input.splitAnnualIraDistribution(state, amount)
    }
    const split = {
      nontaxable: assumed.basisReturn,
      taxable: assumed.ordinaryIncome,
      next: {
        basis: Math.max(0, state.basis - assumed.basisReturn),
        nontaxableFraction: state.nontaxableFraction,
      },
    }
    const channel: Form8606ConsequentialChannel =
      splitInput.calculationScope === 'form8606Line8NetConversions'
        ? 'conversions'
        : 'distributions'
    noteForm8606Taxable(splitInput.ownerPersonId, split.taxable, channel)
    return split
  }

  return {
    resolveAssumedCharacter,
    noteForm8606Taxable,
    splitWithAssumedCharacter,
    form8606ConsequentialByOwner,
  }
}
