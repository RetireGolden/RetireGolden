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
 * The select's options for `year`.
 *
 * Two options carry a marker instead of a bare percentage, so what the choice
 * does is visible at the point of choosing:
 *
 * - The HIGHEST published rate is open-ended — there is no bracket above it, so
 *   there is no threshold to fill up to. `ceilingFor` returns no ceiling for it
 *   (`strategies/rothConversion.ts`: "unknown rate or open-ended top bracket"),
 *   the projection makes no conversion, and Results carries the modeling note
 *   "The Roth-conversion target is invalid for this plan (unknown bracket or
 *   tier); no conversion made." The #495 D6 decision was that a bracket target
 *   must be one of the published rates, and the top rate is one, so it stays
 *   selectable and parse-valid — it is labelled rather than removed (review
 *   r1-2, r1-4).
 * - A rate the pack does not publish at all can still arrive in a stored plan
 *   (an older plan, or a hand-edited import). It keeps its value visible as its
 *   own marked option, so the field shows what is stored with the engine's
 *   message beside it, rather than appearing blank with no account of what it
 *   lost.
 */
export function bracketOptions(year: number, current: number | null): BracketOption[] {
  const rates = publishedBracketRatesPct(year)
  const top = rates[rates.length - 1]
  const options = rates.map((rate) => ({
    value: String(rate),
    label: rate === top ? `${rate}% (top bracket — nothing above it to fill)` : `${rate}%`,
  }))
  if (current !== null && !rates.includes(current)) {
    options.push({ value: String(current), label: `${current}% (not a published rate)` })
  }
  return options
}
