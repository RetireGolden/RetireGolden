import { describe, expect, it } from 'vitest'

import { applyIrc408d8AContributionOffset } from './qcdDeductibleContributionOffset.js'

/**
 * Pub. 590-B (2025), "Offset of QCDs by amounts contributed after age 70½",
 * Jim's illustrated QCD Adjustment Worksheets.
 *
 * Jim became 70½ in 2023 and deducted $5,000 in 2024 and $5,000 in 2025
 * ($10,000 aggregate §219). No contribution for 2026. QCD of $6,000 for 2025
 * and $6,500 for 2026.
 *
 * 2025 worksheet: line 3 $10,000, line 4 $6,000, line 5 ($4,000) → no
 * excludable QCD; $4,000 leftover to the next worksheet.
 * 2026 worksheet: line 1 $4,000, line 4 $6,500, line 5 $2,500.
 *
 * https://www.irs.gov/publications/p590b
 */
const JIM_SECTION_219 = 10_000
const JIM_2025_QCD = 6_000
const JIM_2026_QCD = 6_500

describe('applyIrc408d8AContributionOffset', () => {
  it('reproduces Jim’s 2025 worksheet: $10,000 of §219 vs $6,000 QCD → $0 excluded', () => {
    const first = applyIrc408d8AContributionOffset({
      candidateExclusion: JIM_2025_QCD,
      deductibleSection219Total: JIM_SECTION_219,
      reductionsAlreadyTaken: 0,
    })

    expect(first.excludableAmount).toBe(0)
    expect(first.offsetApplied).toBe(JIM_2025_QCD)
    expect(first.reductionsAfter).toBe(JIM_2025_QCD)
  })

  it('reproduces Jim’s 2026 worksheet: $4,000 leftover vs $6,500 QCD → $2,500 excluded', () => {
    const first = applyIrc408d8AContributionOffset({
      candidateExclusion: JIM_2025_QCD,
      deductibleSection219Total: JIM_SECTION_219,
      reductionsAlreadyTaken: 0,
    })
    const second = applyIrc408d8AContributionOffset({
      candidateExclusion: JIM_2026_QCD,
      deductibleSection219Total: JIM_SECTION_219,
      reductionsAlreadyTaken: first.reductionsAfter,
    })

    expect(second.excludableAmount).toBe(2_500)
    expect(second.offsetApplied).toBe(4_000)
    expect(second.reductionsAfter).toBe(JIM_SECTION_219)
  })

  it('does not reduce below zero when the gift exceeds the unused §219 total', () => {
    const result = applyIrc408d8AContributionOffset({
      candidateExclusion: 4_000,
      deductibleSection219Total: 8_600,
      reductionsAlreadyTaken: 0,
    })

    expect(result.excludableAmount).toBe(0)
    expect(result.offsetApplied).toBe(4_000)
  })

  it('leaves the exclusion untouched when no §219 deduction exists', () => {
    const result = applyIrc408d8AContributionOffset({
      candidateExclusion: 4_000,
      deductibleSection219Total: 0,
      reductionsAlreadyTaken: 0,
    })

    expect(result.excludableAmount).toBe(4_000)
    expect(result.offsetApplied).toBe(0)
  })
})
