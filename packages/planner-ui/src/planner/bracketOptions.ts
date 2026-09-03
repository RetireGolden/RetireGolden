/**
 * The bracket rates a fill-to-target Roth conversion may aim at (#508, #495
 * decision D6, and Nathan's 2026-09-02 answer to the question it left open).
 *
 * "Fill to the top of this bracket" needs a bracket ABOVE the chosen one to
 * supply the ceiling, so the fillable rates are the published ones except the
 * highest — the top bracket is open-ended and has no threshold to reach. The
 * engine refuses anything else at `strategies.rothConversion.targetValue`
 * ("a bracket target must be one of the published rates below the top
 * bracket"), so the control offers exactly what parses rather than a free
 * number box that used to accept 37.5 %.
 *
 * The rates are read from the same published pack the engine reads, and the
 * top one is whatever that pack's ascending ladder ends with — no rate is
 * written down here (DOCS/standards.md: parameters are data, not code).
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

/** Those of them a conversion can fill to: every rate with a bracket above it. */
export function fillableBracketRatesPct(year: number): number[] {
  return publishedBracketRatesPct(year).slice(0, -1)
}

export interface BracketOption {
  value: string
  label: string
}

/**
 * The select's options for `year`: the fillable rates, plus — only when the
 * plan already holds something else — that value as its own marked option.
 *
 * A stored plan can still carry a rate the list does not offer: one saved
 * before this rule, or a hand-edited import. The engine refuses it, so the
 * field shows the message; the option exists so the control also shows WHAT it
 * is refusing instead of appearing blank with no account of what it lost. The
 * marker says which of the two reasons applies, since "the top bracket" and
 * "not a published rate at all" are different mistakes to correct.
 */
export function bracketOptions(year: number, current: number | null): BracketOption[] {
  const fillable = fillableBracketRatesPct(year)
  const options = fillable.map((rate) => ({ value: String(rate), label: `${rate}%` }))
  if (current !== null && !fillable.includes(current)) {
    const isTopBracket = publishedBracketRatesPct(year).includes(current)
    options.push({
      value: String(current),
      label: isTopBracket
        ? `${current}% (top bracket — nothing above it to fill)`
        : `${current}% (not a published rate)`,
    })
  }
  return options
}
