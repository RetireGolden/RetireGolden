/**
 * The "Money lasts" wording every surface prints for one fact, read off the
 * engine's published convention (projection/moneyLasts.ts, owner decision
 * R15): "through" always names the last fully funded year, "in" the first
 * short year. Presentation only: the years are the engine's.
 */
import type { MoneyLasts } from '@retiregolden/engine/projection/moneyLasts'

/**
 * The short value: "full plan" when the money never runs short, "through L"
 * otherwise, and "short from S" when the first plan year is already short (so
 * no surface names the year before the plan as the year the money lasts to).
 */
export function moneyLastsValue(lasts: Pick<MoneyLasts, 'depletionYear' | 'lastFundedYear'>, startYear: number): string {
  if (lasts.depletionYear === null) return 'full plan'
  if (lasts.lastFundedYear < startYear) return `short from ${startYear}`
  return `through ${lasts.lastFundedYear}`
}
