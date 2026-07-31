import type { YearResult } from '@retiregolden/engine/projection/types'

type CarryforwardYear = Pick<YearResult, 'capitalLossCarryforwardRemaining'>

/** Shared visibility rule for the interactive results and printable report. */
export function hasCapitalLossCarryforward(
  openingCarryforward: number,
  years: readonly CarryforwardYear[],
): boolean {
  return (
    openingCarryforward > 0 ||
    years.some((year) => year.capitalLossCarryforwardRemaining > 0)
  )
}
