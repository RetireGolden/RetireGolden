/**
 * ACA premium tax credit for pre-65 retirees (post-2025 law: enhanced credits
 * expired, 400% FPL cliff restored). The credit is computed against MAGI and
 * the household's poverty-line ratio; $1 over the cliff forfeits everything —
 * a first-class constraint on Roth conversions and gain harvesting.
 *
 * @see DOCS/domain/domain-rules-reference.md §8
 */

import type { ParameterPack } from '../params/types.js'

export interface AcaResult {
  /** MAGI as a percentage of the federal poverty line. */
  fplPct: number
  /** Expected annual contribution toward the benchmark premium. */
  expectedContribution: number
  credit: number
  netAnnualPremium: number
  /** True when income sits above the credit cutoff (the cliff). */
  overCliff: boolean
}

/** Piecewise-linear applicable percentage for a poverty-line ratio. */
export function acaApplicablePct(pack: ParameterPack, fplPct: number): number {
  const points = pack.aca.applicablePctBreakpoints
  if (fplPct <= points[0]!.fplPct) return points[0]!.applicablePct
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const next = points[i]!
    if (fplPct <= next.fplPct) {
      const t = (fplPct - prev.fplPct) / (next.fplPct - prev.fplPct)
      return prev.applicablePct + t * (next.applicablePct - prev.applicablePct)
    }
  }
  return points[points.length - 1]!.applicablePct
}

/**
 * Net marketplace premium after the credit.
 *
 * `fullAnnualPremium` is the household's unsubsidized premium, which v1 also
 * uses as the benchmark-plan proxy (separate benchmark entry is a later
 * refinement). `fplScale` indexes the poverty line for years past the pack.
 */
export function acaNetAnnualPremium(
  pack: ParameterPack,
  householdSize: number,
  magi: number,
  fullAnnualPremium: number,
  fplScale = 1,
): AcaResult {
  const fpl =
    (pack.federalPovertyLine.firstPerson + pack.federalPovertyLine.perAdditionalPerson * Math.max(0, householdSize - 1)) *
    fplScale
  const fplPct = fpl > 0 ? (magi / fpl) * 100 : Infinity
  const overCliff = fplPct > pack.aca.maxFplPctForCredit

  if (overCliff || fullAnnualPremium <= 0) {
    return { fplPct, expectedContribution: 0, credit: 0, netAnnualPremium: fullAnnualPremium, overCliff }
  }
  const expectedContribution = (acaApplicablePct(pack, fplPct) / 100) * magi
  const credit = Math.max(0, fullAnnualPremium - expectedContribution)
  return {
    fplPct,
    expectedContribution,
    credit,
    netAnnualPremium: fullAnnualPremium - credit,
    overCliff,
  }
}

/**
 * Net marketplace premium when coverage varies by month (the age-65 transition
 * year). The PTC is a monthly credit — each covered month gets
 * `max(0, premium_m − expectedContribution/12)` — so a member covered for five
 * months owes five-twelfths of the household expected contribution, not all of
 * it. With twelve equal covered months this matches `acaNetAnnualPremium`;
 * months with zero premium (no marketplace coverage) earn no credit.
 */
export function acaNetAnnualPremiumByMonth(
  pack: ParameterPack,
  householdSize: number,
  magi: number,
  /** Household marketplace premium per calendar month (length 12; 0 = not covered). */
  monthlyPremiums: readonly number[],
  fplScale = 1,
): AcaResult {
  const fullAnnualPremium = monthlyPremiums.reduce((sum, premium) => sum + premium, 0)
  const fpl =
    (pack.federalPovertyLine.firstPerson + pack.federalPovertyLine.perAdditionalPerson * Math.max(0, householdSize - 1)) *
    fplScale
  const fplPct = fpl > 0 ? (magi / fpl) * 100 : Infinity
  const overCliff = fplPct > pack.aca.maxFplPctForCredit

  if (overCliff || fullAnnualPremium <= 0) {
    return { fplPct, expectedContribution: 0, credit: 0, netAnnualPremium: fullAnnualPremium, overCliff }
  }
  const expectedContribution = (acaApplicablePct(pack, fplPct) / 100) * magi
  let credit = 0
  for (const premium of monthlyPremiums) {
    if (premium <= 0) continue
    credit += Math.max(0, premium - expectedContribution / 12)
  }
  return {
    fplPct,
    expectedContribution,
    credit,
    netAnnualPremium: fullAnnualPremium - credit,
    overCliff,
  }
}
