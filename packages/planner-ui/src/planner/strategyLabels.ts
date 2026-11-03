/**
 * Plain-language labels for the plan's strategy settings (#766). One module
 * so the printable report page, the downloadable HTML report, and the
 * assumptions card describe a strategy in the same words, and none of them
 * prints a schema value such as `topOfBracket` or `bracketTargeted`.
 *
 * Every mode of every strategy union has a branch here; the `never` checks
 * make a new mode a compile error until it gets a label. The target value is
 * the user's own setting (a bracket rate, an IRMAA tier number, or a MAGI
 * ceiling) shown as entered: nothing here computes a dollar figure.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { fmtMoney } from './format'

type RothConversion = Plan['strategies']['rothConversion']
type FillTarget = Extract<RothConversion, { mode: 'fillToTarget' }>
type WithdrawalOrder = Plan['strategies']['withdrawalOrder']

/**
 * What a fill-to-target conversion fills to, as a lower-case phrase that
 * follows "Fill to": "top of 22% bracket", "just under IRMAA tier 2",
 * "just under the ACA 400% FPL cliff", "a MAGI of $150,000". A target whose
 * value is not set yet says so instead of printing a blank.
 */
export function rothConversionTargetPhrase(target: FillTarget['target'], targetValue: number | null): string {
  switch (target) {
    case 'topOfBracket':
      return targetValue === null ? 'top of a tax bracket (none chosen)' : `top of ${targetValue}% bracket`
    case 'irmaaTier':
      return targetValue === null ? 'just under an IRMAA tier (none chosen)' : `just under IRMAA tier ${targetValue}`
    case 'acaCliff':
      return 'just under the ACA 400% FPL cliff'
    case 'fixedMagi':
      return targetValue === null ? 'a fixed MAGI (none set)' : `a MAGI of ${fmtMoney(targetValue)}`
    default: {
      const unhandled: never = target
      return unhandled
    }
  }
}

function yearCount(n: number): string {
  return `${n} year${n === 1 ? '' : 's'}`
}

/**
 * One-line summary of the Roth conversion strategy for report tables:
 * "None", "Manual, 3 years", "Optimized, 4 years", or
 * "Fill to top of 22% bracket, 2028–2036".
 */
export function rothConversionSummary(rc: RothConversion): string {
  switch (rc.mode) {
    case 'none':
      return 'None'
    case 'manual':
      return `Manual, ${yearCount(rc.conversions.length)}`
    case 'optimized':
      return `Optimized, ${yearCount(rc.conversions.length)}`
    case 'fillToTarget':
      return `Fill to ${rothConversionTargetPhrase(rc.target, rc.targetValue)}, ${rc.startYear}–${rc.endYear}`
    default: {
      const unhandled: never = rc
      return unhandled
    }
  }
}

/**
 * One-line summary of the withdrawal order. The sequential order is the
 * engine's (`SEQUENTIAL_ORDER` in
 * projection/internal/annualWithdrawalPlanning.ts: cash, taxable, vested equity
 * comp, traditional, Roth, then HSA).
 */
export function withdrawalOrderSummary(w: WithdrawalOrder): string {
  switch (w.mode) {
    case 'sequential':
      return 'Sequential: cash, taxable, equity comp, traditional, Roth, HSA'
    case 'proportional':
      return 'Proportional across accounts'
    case 'bracketTargeted':
      return `Bracket-targeted to ${w.bracketPct}%`
    default: {
      const unhandled: never = w
      return unhandled
    }
  }
}
