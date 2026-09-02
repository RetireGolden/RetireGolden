import type { Account } from '../../model/plan.js'
import {
  hsaNonQualifiedPenaltyRate,
  traditionalWithdrawalPenaltyRate,
} from '../../strategies/accountEligibility.js'
import {
  splitRothWithdrawal,
  type RothBasisState,
  type RothWithdrawalSplit,
} from '../../strategies/rothBasis.js'

type TraditionalAccount = Extract<Account, { type: 'traditional' }>

export type AnnualFundingWithdrawalEffectAccount =
  | Readonly<{
      kind: 'traditional'
      sourceAccountId: string
      account: TraditionalAccount
      ownerAgeAttained: number
      ownerRetirementAge: number | null
      treatAsOwnEffective: boolean
    }>
  | Readonly<{
      kind: 'roth'
      sourceAccountId: string
      /** Null keeps inherited Roth outside the owned/employer Roth basis pools. */
      poolKey: string | null
      ownerAgeAttained: number
    }>
  | Readonly<{
      kind: 'hsa'
      sourceAccountId: string
      withdrawalTreatment:
        | 'capByMedicalExpenses'
        | 'assumeAllQualified'
        | undefined
      ownerAgeAttained: number
    }>

export type AnnualHsaWithdrawalEffectAccount = Extract<
  AnnualFundingWithdrawalEffectAccount,
  { kind: 'hsa' }
>

export interface AnnualFundingWithdrawalEffectsInput {
  /** One logical candidate-withdrawal row per account, in annual balance order. */
  readonly accounts: readonly AnnualFundingWithdrawalEffectAccount[]
  readonly withdrawalsByAccountId: ReadonlyMap<string, number>
  /** Form 8606 taxable share for owned-IRA rows; absent rows remain fully taxable. */
  readonly traditionalTaxableByAccountId: ReadonlyMap<string, number>
  readonly rothBasisByPool: ReadonlyMap<string, RothBasisState>
  readonly year: number
  readonly hsaQualifiedCap: number
}

export interface AnnualTraditionalWithdrawalPenaltyRow {
  readonly sourceAccountId: string
  readonly amount: number
}

export interface AnnualHsaWithdrawalEffectRow {
  readonly sourceAccountId: string
  readonly taken: number
  readonly qualified: number
  readonly nonQualified: number
  readonly taxableOrdinary: number
  readonly penalty: number
  /** Qualified dollars measured against the modeled medical-expense cap. */
  readonly capConsumed: number
}

export interface AnnualHsaWithdrawalEffectsResult {
  readonly rows: readonly AnnualHsaWithdrawalEffectRow[]
  readonly taxableOrdinary: number
  readonly penalty: number
  readonly qualified: number
  readonly nonQualified: number
  readonly capConsumed: number
}

export interface AnnualHsaWithdrawalEffectsInput {
  readonly accounts: readonly AnnualHsaWithdrawalEffectAccount[]
  readonly withdrawalsByAccountId: ReadonlyMap<string, number>
  readonly hsaQualifiedCap: number
}

export interface AnnualRothPoolWithdrawalEffectRow {
  readonly poolKey: string
  readonly taken: number
  readonly ownerAgeAttained: number
  /** Null when the caller has no tracked basis pool for this key. */
  readonly split: RothWithdrawalSplit | null
}

export interface AnnualFundingWithdrawalEffectsResult {
  readonly traditional: Readonly<{
    rows: readonly AnnualTraditionalWithdrawalPenaltyRow[]
    penalty: number
  }>
  readonly hsa: Readonly<AnnualHsaWithdrawalEffectsResult>
  readonly roth: Readonly<{
    rows: readonly AnnualRothPoolWithdrawalEffectRow[]
    taxableOrdinary: number
    penalty: number
  }>
  readonly penaltyExcludingRmdShortfallExcise: number
}

/** Recompute only the HSA channel whose character changes with the medical cap. */
export function annualHsaWithdrawalEffects(
  input: AnnualHsaWithdrawalEffectsInput,
): AnnualHsaWithdrawalEffectsResult {
  const rows: AnnualHsaWithdrawalEffectRow[] = []
  let taxableOrdinary = 0
  let penaltyTotal = 0
  let qualifiedTotal = 0
  let nonQualifiedTotal = 0
  let capLeft = input.hsaQualifiedCap

  for (const row of input.accounts) {
    const taken = input.withdrawalsByAccountId.get(row.sourceAccountId) ?? 0
    if (taken <= 0) continue

    let qualified: number
    let nonQualified: number
    let capConsumed: number
    let penalty: number
    if (row.withdrawalTreatment === 'capByMedicalExpenses') {
      qualified = Math.min(taken, capLeft)
      capLeft -= qualified
      nonQualified = taken - qualified
      capConsumed = qualified
      penalty =
        nonQualified * hsaNonQualifiedPenaltyRate(row.ownerAgeAttained)
    } else if (row.withdrawalTreatment === 'assumeAllQualified') {
      qualified = taken
      nonQualified = 0
      capConsumed = 0
      penalty = 0
    } else {
      qualified = taken
      nonQualified = 0
      capConsumed = 0
      penalty = taken * hsaNonQualifiedPenaltyRate(row.ownerAgeAttained)
    }
    qualifiedTotal += qualified
    nonQualifiedTotal += nonQualified
    taxableOrdinary += nonQualified
    penaltyTotal += penalty
    rows.push({
      sourceAccountId: row.sourceAccountId,
      taken,
      qualified,
      nonQualified,
      taxableOrdinary: nonQualified,
      penalty,
      capConsumed,
    })
  }

  return {
    rows,
    taxableOrdinary,
    penalty: penaltyTotal,
    qualified: qualifiedTotal,
    nonQualified: nonQualifiedTotal,
    capConsumed: input.hsaQualifiedCap - capLeft,
  }
}

/**
 * Refresh the cap-dependent HSA channel while preserving the already-computed
 * traditional and Roth characterization objects by identity.
 */
export function recharacterizeAnnualFundingWithdrawalHsaCap(
  previous: AnnualFundingWithdrawalEffectsResult,
  input: AnnualHsaWithdrawalEffectsInput,
): AnnualFundingWithdrawalEffectsResult {
  const hsa = annualHsaWithdrawalEffects(input)
  return {
    traditional: previous.traditional,
    hsa,
    roth: previous.roth,
    penaltyExcludingRmdShortfallExcise:
      previous.traditional.penalty + previous.roth.penalty + hsa.penalty,
  }
}

/**
 * Characterize one candidate voluntary-withdrawal plan without mutating basis,
 * account, warning, cash-flow, or annual-ledger state.
 *
 * The caller supplies year-scoped account identity (including S2 treat-as-own
 * and inherited-Roth pool exclusion) plus the already-resolved Form 8606
 * taxable amounts. This coordinator owns only the ordered penalty, HSA, and
 * Roth-basis effects used by both fixed-point probes and the accepted commit.
 */
export function annualFundingWithdrawalEffects(
  input: AnnualFundingWithdrawalEffectsInput,
): AnnualFundingWithdrawalEffectsResult {
  const traditionalRows: AnnualTraditionalWithdrawalPenaltyRow[] = []
  let traditionalPenalty = 0
  const hsaAccounts: AnnualHsaWithdrawalEffectAccount[] = []

  const rothPools = new Map<string, {
    taken: number
    ownerAgeAttained: number
  }>()

  for (const row of input.accounts) {
    const taken = input.withdrawalsByAccountId.get(row.sourceAccountId) ?? 0
    if (taken <= 0) continue

    if (row.kind === 'traditional') {
      const penalizable =
        input.traditionalTaxableByAccountId.get(row.sourceAccountId) ?? taken
      const penaltyAccount = row.treatAsOwnEffective
        ? { ...row.account, inherited: undefined }
        : row.account
      const amount =
        penalizable *
        traditionalWithdrawalPenaltyRate(penaltyAccount, {
          ownerAgeAttained: row.ownerAgeAttained,
          ownerRetirementAge: row.ownerRetirementAge,
        })
      traditionalPenalty += amount
      if (amount > 0) {
        traditionalRows.push({ sourceAccountId: row.sourceAccountId, amount })
      }
      continue
    }

    if (row.kind === 'hsa') {
      hsaAccounts.push(row)
      continue
    }

    if (row.poolKey === null) continue
    const pool = rothPools.get(row.poolKey)
    if (pool) {
      pool.taken += taken
    } else {
      rothPools.set(row.poolKey, {
        taken,
        ownerAgeAttained: row.ownerAgeAttained,
      })
    }
  }

  const rothRows: AnnualRothPoolWithdrawalEffectRow[] = []
  let rothTaxableOrdinary = 0
  let rothPenalty = 0
  for (const [poolKey, { taken, ownerAgeAttained }] of rothPools) {
    const basis = input.rothBasisByPool.get(poolKey)
    const split = basis === undefined
      ? null
      : splitRothWithdrawal(
          basis,
          taken,
          input.year,
          ownerAgeAttained,
        )
    if (split !== null) {
      rothPenalty += split.penalty
      rothTaxableOrdinary += split.taxableOrdinary
    }
    rothRows.push({ poolKey, taken, ownerAgeAttained, split })
  }

  const hsa = annualHsaWithdrawalEffects({
    accounts: hsaAccounts,
    withdrawalsByAccountId: input.withdrawalsByAccountId,
    hsaQualifiedCap: input.hsaQualifiedCap,
  })

  return {
    traditional: { rows: traditionalRows, penalty: traditionalPenalty },
    hsa,
    roth: {
      rows: rothRows,
      taxableOrdinary: rothTaxableOrdinary,
      penalty: rothPenalty,
    },
    penaltyExcludingRmdShortfallExcise:
      traditionalPenalty + rothPenalty + hsa.penalty,
  }
}
