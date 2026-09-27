/**
 * The one comparison convention (B2-P1 slice 3): a figure compared between a
 * baseline and a proposal is published as the two values and their
 * difference, proposal minus baseline, in the figure's own unit.
 *
 * - `delta = proposal − baseline`, one IEEE 754 subtraction, never reordered.
 * - A negative zero is published as 0 on every member, so a sign test on the
 *   delta never reads −0 as a loss.
 * - A non-finite operand or a non-finite difference is refused with a
 *   `RangeError`: a comparison that cannot be computed is not published as a
 *   number (rule 4 of the 2026-09-25 decision record).
 * - A null operand (a figure the side does not have) gives a null delta; it is
 *   never read as zero.
 *
 * A leaf module with no imports, so the surfaces that compare two figures
 * through it (the scenario comparison, the Compare page's headlines and
 * money-lasts comparison, the relocation rows, the claim-age gain, the Monte
 * Carlo success comparison and the stochastic deltas) use it without pulling
 * in the solver or the decision context. The candidate evaluation's deltas
 * (decisions/evaluateCandidate.ts) are plain subtractions and do not.
 *
 * @see DOCS/calculations/optimizer-and-comparisons/scenario-scalar-comparison.md
 * @see DOCS/calculations/optimizer-and-comparisons/scenario-nullable-scalar-comparison.md
 */

export interface ScalarComparison {
  baseline: number
  proposal: number
  /** Proposal minus baseline. */
  delta: number
}

export interface NullableScalarComparison {
  baseline: number | null
  proposal: number | null
  /** Proposal minus baseline; null when either side has no comparable value. */
  delta: number | null
}

function finiteComparand(value: number, role: 'baseline' | 'proposal' | 'difference'): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`A compared figure must be a finite number; the ${role} is ${String(value)}`)
  }
  return Object.is(value, -0) ? 0 : value
}

/** `{ baseline, proposal, delta: proposal − baseline }`; refuses a non-finite operand or difference. */
export function compareScalars(baseline: number, proposal: number): ScalarComparison {
  const left = finiteComparand(baseline, 'baseline')
  const right = finiteComparand(proposal, 'proposal')
  return { baseline: left, proposal: right, delta: finiteComparand(right - left, 'difference') }
}

/** As `compareScalars` when both sides have a value; otherwise the values as given and a null delta. */
export function compareNullableScalars(baseline: number | null, proposal: number | null): NullableScalarComparison {
  if (baseline === null || proposal === null) {
    return {
      baseline: baseline === null ? null : finiteComparand(baseline, 'baseline'),
      proposal: proposal === null ? null : finiteComparand(proposal, 'proposal'),
      delta: null,
    }
  }
  return compareScalars(baseline, proposal)
}
