/**
 * Plan B − Plan A delta cell text for the Compare plans table (#499). Every
 * figure is the engine's (scenarios/planHeadlines.ts#comparePlanHeadlines,
 * B2-P1 slice 3); this module only formats a published difference.
 */

import { fmtMoneyCompact } from './format'

export type DeltaUnit = 'money' | 'years' | 'pp'

function signed(value: number, text: string): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}`
}

/** The delta cell text; a zero non-money delta says so instead of hiding behind a dash. */
export function formatDelta(value: number, unit: DeltaUnit): string {
  if (unit === 'money') return `${value > 0 ? '+' : ''}${fmtMoneyCompact(value)}`
  const magnitude = Math.abs(Math.round(value))
  if (unit === 'pp') return signed(value, `${magnitude} pp`)
  if (magnitude === 0) return 'same'
  return signed(value, `${magnitude} ${magnitude === 1 ? 'yr' : 'yrs'}`)
}
