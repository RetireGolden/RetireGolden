/**
 * The bracket rates a fill-to-target Roth conversion may aim at (#508, #495
 * decision D6).
 *
 * The engine refuses a target that is not one of the rates the parameter pack
 * publishes for the window's first year (`plan.ts`, "a bracket target must be
 * one of the published … rates"), because `strategies/rothConversion.ts` can
 * only turn a published rate into a ceiling. So the control offers exactly
 * those rates rather than a free number box that silently accepts 37.5 %.
 *
 * The rates are read from the same published pack the engine reads — no list
 * is written down here (DOCS/standards.md: parameters are data, not code).
 */

import { packForYear } from '@retiregolden/engine/params'

/** The published ordinary rate-bracket percentages for `year`, ascending. */
export function publishedBracketRatesPct(year: number): number[] {
  const { brackets } = packForYear(year).pack.federalTax
  const rates = new Set<number>()
  for (const table of [brackets.single, brackets.marriedFilingJointly]) {
    for (const bracket of table) rates.add(bracket.ratePct)
  }
  return [...rates].sort((a, b) => a - b)
}

export interface BracketOption {
  value: string
  label: string
}

/**
 * The select's options for `year`. A plan that already holds a rate the pack
 * does not publish (an older plan, or a hand-edited import) keeps its value
 * visible as its own option, marked, so the field shows what is stored and the
 * engine's message beside it says why it is refused — rather than the control
 * appearing blank with no explanation of what it lost.
 */
export function bracketOptions(year: number, current: number | null): BracketOption[] {
  const rates = publishedBracketRatesPct(year)
  const options = rates.map((rate) => ({ value: String(rate), label: `${rate}%` }))
  if (current !== null && !rates.includes(current)) {
    options.push({ value: String(current), label: `${current}% (not a published rate)` })
  }
  return options
}
