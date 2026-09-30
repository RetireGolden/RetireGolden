/**
 * Railroad Retirement Act annuities in every state, and Rhode Island's
 * military service pension modification.
 *
 * 45 U.S.C. 231m(a): notwithstanding any law of any State, "no annuity or
 * supplemental annuity shall be assignable or be subject to any tax". An
 * annuity under the Act is computed from a tier I amount (231b(a)) and a tier
 * II amount (231b(b)), with the vested dual benefit (231b(h)); the supplemental
 * annuity is 231a(b). A pension whose source is `railroadTier1`,
 * `railroadTier2` or `railroadRetirementAct` is one of them, so a state that
 * starts from federal adjusted gross income subtracts whatever of it the
 * federal return included. Subsection (b)(1) keeps only the supplemental
 * annuity in federal income; it does not reach a state.
 *
 * A pension a railroad employer pays from its own plan is not an annuity under
 * the Act; it is tagged as a private pension and is not subtracted here.
 * Railroad unemployment and sickness benefits (45 U.S.C. 352(e)) have no
 * income type in the plan, so they never reach these helpers.
 */

import {
  isMilitarySource,
  isRailroadSource,
  type StateRetirementDistributionFact,
  type StateRetirementSourceKind,
} from './stateRetirementFacts.js'

const ALL_RAILROAD_RETIREMENT_ACT_KINDS: readonly StateRetirementSourceKind[] = [
  'railroadTier1',
  'railroadTier2',
  'railroadRetirementAct',
]

/**
 * Railroad sources a state's own branch of `characterizedRetirementDelta`
 * already subtracts in full under the state's own law, each pinned by that
 * state's record: Arkansas, Colorado, Iowa, Kansas, Louisiana, Massachusetts,
 * Missouri, Utah and Vermont all three; Virginia (Va. Code 58.1-322.02(3)) and
 * West Virginia tier I only. The federal rule takes the rest, so every state
 * subtracts each railroad source exactly once.
 */
export const RAILROAD_SOURCES_SUBTRACTED_UNDER_STATE_LAW: Readonly<Record<string, readonly StateRetirementSourceKind[]>> = Object.freeze({
  AR: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  CO: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  IA: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  KS: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  LA: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  MA: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  MO: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  UT: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  VT: ALL_RAILROAD_RETIREMENT_ACT_KINDS,
  VA: ['railroadTier1'],
  WV: ['railroadTier1'],
})

/**
 * The railroad sources the federal bar subtracts for a state, before any of
 * the state's own rules: all three, less those its own law already subtracts.
 * Every state with an income tax on wages or pensions takes it; a state with
 * none never reaches `characterizedRetirementDelta`. Each state's other
 * retirement pools leave the railroad sources out, so nothing is counted in a
 * pool and subtracted too.
 */
export function federalRailroadRetirementActKinds(stateCode: string): readonly StateRetirementSourceKind[] {
  const own = RAILROAD_SOURCES_SUBTRACTED_UNDER_STATE_LAW[stateCode] ?? []
  return ALL_RAILROAD_RETIREMENT_ACT_KINDS.filter((kind) => !own.includes(kind))
}

/**
 * The federally included amount of Railroad Retirement Act annuities among
 * `facts`, limited to `kinds` (all three by default).
 */
export function railroadRetirementActSubtraction(
  facts: readonly StateRetirementDistributionFact[],
  kinds: readonly StateRetirementSourceKind[] = ALL_RAILROAD_RETIREMENT_ACT_KINDS,
): number {
  let total = 0
  for (const fact of facts) {
    if (isRailroadSource(fact.sourceKind) && kinds.includes(fact.sourceKind)) {
      total += Math.max(0, fact.federallyIncludedAmount)
    }
  }
  return total
}

/**
 * R.I. Gen. Laws 44-30-12(c)(11): from tax year 2023 a taxpayer subtracts the
 * military service pension benefits included in federal adjusted gross income.
 * The Division of Taxation's Publication 2026-01 says there are no income or
 * age requirements and that a surviving spouse receiving the pension is also
 * eligible, so both military sources count in full. The same income cannot
 * also take the (c)(9) pension modification; the caller keeps these facts out
 * of that pool.
 */
export function rhodeIslandMilitaryServicePensionModification(
  facts: readonly StateRetirementDistributionFact[],
): number {
  let total = 0
  for (const fact of facts) {
    if (isMilitarySource(fact.sourceKind)) total += Math.max(0, fact.federallyIncludedAmount)
  }
  return total
}
