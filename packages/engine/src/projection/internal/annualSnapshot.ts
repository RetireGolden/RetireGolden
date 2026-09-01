/**
 * Materialize the end-of-pass balance snapshot published by `simulatePlan`.
 *
 * This is deliberately a small, pure boundary around the former inline
 * snapshot block. It does not calculate net worth: the caller's later formula
 * also includes the independently-computed TIPS ladder value, so that fold
 * remains at the publication site.
 *
 * ORDER IS PART OF THE CONTRACT. The balance record is assembled from
 * logical published balances, then property values, then ordinary debts, then
 * permanent-life cash values. `Object.fromEntries` therefore preserves the
 * original later-channel overwrite behavior (without treating `__proto__`
 * specially), while each economic total still counts every physical row in
 * its own source. Each `+=` is also intentionally left in its original loop:
 * regrouping these floating-point additions can change a result.
 *
 * HECM debt has two distinct views. `hecmLoanTotal` is the full outstanding
 * loan amount published to the ledger. `hecmEffectiveDebt` is used only by the
 * caller's net-worth formula and honors the non-recourse limit by capping each
 * line at the matching property value.
 */

/** The structural slice of a simulator balance needed by the snapshot. */
export interface AnnualSnapshotBalance {
  readonly account: {
    readonly id: string
  }
  readonly balance: number
}

/** The structural slice of an open HECM line needed by the snapshot. */
export interface AnnualSnapshotHecmLine {
  readonly loanBalance: number
}

/** The year-scoped state read by the snapshot phase. */
export interface AnnualSnapshotInput {
  /** Investable accounts in simulator balance order. */
  readonly balances: readonly AnnualSnapshotBalance[]
  /** One aggregate publication row per logical account ID. Defaults to balances. */
  readonly publishedBalances?: readonly AnnualSnapshotBalance[]
  /** Cash not assigned to a modeled account. This opens the investable fold. */
  readonly unassignedCash: number
  /** Property values in insertion order. */
  readonly propertyValues: ReadonlyMap<string, number>
  /** Ordinary debt balances in insertion order. */
  readonly debtBalances: ReadonlyMap<string, number>
  /** Open HECM lines in insertion order. */
  readonly hecmStates: ReadonlyMap<string, AnnualSnapshotHecmLine>
  /** Permanent-life cash values in insertion order. */
  readonly insuranceCashValues: ReadonlyMap<string, number>
}

/** The values formerly produced by the inline snapshot block. */
export interface AnnualSnapshot {
  /** Fresh every call; one aggregate value per logical investable ID. */
  readonly balanceRecord: Record<string, number>
  readonly investableTotal: number
  readonly propertyTotal: number
  readonly debtTotal: number
  /** Full HECM loan balance, before the non-recourse net-worth cap. */
  readonly hecmLoanTotal: number
  /** HECM debt capped line-by-line at the matching property value. */
  readonly hecmEffectiveDebt: number
  readonly insuranceCashValueTotal: number
}

/** Build one eager, fresh annual snapshot without mutating any input. */
export function annualSnapshot(input: AnnualSnapshotInput): AnnualSnapshot {
  const {
    balances,
    publishedBalances = balances,
    unassignedCash,
    propertyValues,
    debtBalances,
    hecmStates,
    insuranceCashValues,
  } = input

  const balanceEntries: [string, number][] = []
  let investableTotal = unassignedCash
  for (const state of publishedBalances) {
    balanceEntries.push([state.account.id, state.balance])
  }
  for (const state of balances) {
    investableTotal += state.balance
  }
  let propertyTotal = 0
  for (const [id, value] of propertyValues) {
    balanceEntries.push([id, value])
    propertyTotal += value
  }
  let debtTotal = 0
  for (const [id, value] of debtBalances) {
    balanceEntries.push([id, value])
    debtTotal += value
  }
  let hecmLoanTotal = 0
  let hecmEffectiveDebt = 0
  for (const [id, line] of hecmStates) {
    hecmLoanTotal += line.loanBalance
    hecmEffectiveDebt += Math.min(line.loanBalance, propertyValues.get(id) ?? 0)
  }
  let insuranceCashValueTotal = 0
  for (const [id, value] of insuranceCashValues) {
    balanceEntries.push([id, value])
    insuranceCashValueTotal += value
  }

  return {
    balanceRecord: Object.fromEntries(balanceEntries),
    investableTotal,
    propertyTotal,
    debtTotal,
    hecmLoanTotal,
    hecmEffectiveDebt,
    insuranceCashValueTotal,
  }
}
