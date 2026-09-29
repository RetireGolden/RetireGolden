/**
 * The optimizer's in-solve state tax (optimizePlan.ts#stateBracketSegmentsFor).
 * The LP lays a state's brackets over its own taxable ordinary income, which is
 * already net of the federal deduction. Washington's deduction, larger than the
 * federal one, becomes a zero-rate band; a smaller state deduction and the
 * state's exemptions are not reflected (the registered approximation pinned on
 * Virginia below).
 */
import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { indexFederalTaxPack, packForYear } from '../params/index.js'
import { stateBracketSegmentsFor } from './optimizePlan.js'

/** The PWL's tax on an amount of the LP's taxable ordinary income. */
function lpStateTax(segments: readonly { width: number | null; rate: number }[], taxable: number): number {
  let remaining = taxable
  let tax = 0
  for (const segment of segments) {
    if (remaining <= 0) break
    const take = segment.width === null ? remaining : Math.min(remaining, segment.width)
    tax += take * segment.rate
    remaining -= take
  }
  return tax
}

describe('Washington in the optimizer from 2028', () => {
  // At 2.5% a year from the 2026 pack, 2028's factor is 1.050625. The LP's
  // federal deduction is the indexed basic amount; Washington's is $1,000,000
  // (indexed from 2029 on its own schedule), so the band below 9.9% is the
  // difference.
  const scale = 1.025 ** 2
  const federal = indexFederalTaxPack(packForYear(2028).pack, scale).federalTax.standardDeduction.single
  const segments = stateBracketSegmentsFor('WA', 2028, 'single', { federalDeduction: federal, packYear: 2026, inflationScale: scale })!

  it('puts the deduction above the federal one in a zero-rate band ahead of the 9.9%', () => {
    expect(segments).toEqual([{ width: 1_000_000 - federal, rate: 0 }, { width: null, rate: 0.099 }])
    // A household with $400,000 of LP taxable income owes Washington nothing.
    expect(lpStateTax(segments, 400_000)).toBe(0)
    // $1,500,000 of ordinary income is 1,500,000 - federal of LP taxable income:
    // the 9.9% reaches only the $500,000 above the Washington deduction.
    expect(lpStateTax(segments, 1_500_000 - federal)).toBeCloseTo(500_000 * 0.099, 6)
  })

  it('leaves 2027, before the tax, without brackets, and a state with a smaller deduction unchanged', () => {
    expect(stateBracketSegmentsFor('WA', 2027, 'single', { federalDeduction: federal, packYear: 2026, inflationScale: 1.025 })).toBeUndefined()
    const va = stateBracketSegmentsFor('VA', 2026, 'single', { federalDeduction: 16_100, packYear: 2026, inflationScale: 1 })
    expect(va).toEqual(stateBracketSegmentsFor('VA', 2026, 'single'))
  })
})

// Virginia 2026, single, $60,000 of ordinary income. The LP's taxable ordinary
// income is 60,000 - 16,100 (the federal deduction) = 43,900; Virginia taxes
// 60,000 - 8,750 (its deduction) - 930 (one exemption) = 50,320. On the
// 2 / 3 / 5 / 5.75% schedule (to 3,000, 5,000, 17,000):
//   LP     60 + 60 + 600 + 26,900 x 5.75% = 2,266.75
//   law    60 + 60 + 600 + 33,320 x 5.75% = 2,635.90
// The LP understates Virginia's tax by 369.15, the 6,420 of income between the
// two deductions at 5.75%.
describeRule('va-code-58-1-322-03-optimizer-state-base-uses-federal-deduction', {
  note: 'the LP prices Virginia on federal taxable income',
  readings: {
    stateDeductionAndExemption: 60 + 60 + 600 + (60_000 - 8_750 - 930 - 17_000) * 0.0575,
    federalDeductionInTheLp: 60 + 60 + 600 + (60_000 - 16_100 - 17_000) * 0.0575,
  },
  accepted: 'stateDeductionAndExemption',
  produced: 'federalDeductionInTheLp',
}, ({ accepted, produced }) => {
  it('lays Virginia’s brackets over the LP’s federal taxable income', () => {
    const segments = stateBracketSegmentsFor('VA', 2026, 'single', { federalDeduction: 16_100, packYear: 2026, inflationScale: 1 })!
    expect(accepted).toBeCloseTo(2_635.9, 6)
    expect(produced).toBeCloseTo(2_266.75, 6)
    expect(lpStateTax(segments, 60_000 - 16_100)).toBeCloseTo(produced, 6)
    expect(lpStateTax(segments, 60_000 - 16_100)).not.toBeCloseTo(accepted, 6)
  })
})
