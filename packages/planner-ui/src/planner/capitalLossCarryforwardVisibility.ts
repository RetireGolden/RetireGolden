import type { YearResult } from '@retiregolden/engine/projection/types'

type CarryforwardYear = Pick<
  YearResult,
  | 'capitalLossCarryforwardRemaining'
  | 'capitalLossUsedAgainstGains'
  | 'capitalLossUsedAgainstOrdinary'
>

const ACTIVITY_THRESHOLD = 0.5

function hasCarryforwardActivity(year: CarryforwardYear): boolean {
  return (
    year.capitalLossUsedAgainstGains > ACTIVITY_THRESHOLD ||
    year.capitalLossUsedAgainstOrdinary > ACTIVITY_THRESHOLD ||
    year.capitalLossCarryforwardRemaining > ACTIVITY_THRESHOLD
  )
}

/** Shared visibility rule for the interactive results and printable report. */
export function hasCapitalLossCarryforward(
  openingCarryforward: number,
  years: readonly CarryforwardYear[],
): boolean {
  return openingCarryforward > 0 || years.some(hasCarryforwardActivity)
}

/** First modeled activity; opening pools retain the historical first-year fallback. */
export function capitalLossCarryforwardHighlight<T extends CarryforwardYear>(
  openingCarryforward: number,
  years: readonly T[],
): T | undefined {
  return (
    years.find(hasCarryforwardActivity) ??
    (openingCarryforward > 0 ? years[0] : undefined)
  )
}
