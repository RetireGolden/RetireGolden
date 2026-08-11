import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  applyConversionPrincipalDebt,
  assumedSeedConsequentialSpill,
  emptyRothBasis,
  freeRothCoverCapacity,
  ROTH_QUALIFIED_AGE,
  splitRothWithdrawal,
  type RothBasisState,
} from './rothBasis.js'

describe('splitRothWithdrawal — ordering', () => {
  const state: RothBasisState = {
    contributionBasis: 20_000,
    conversionLayers: [
      { year: 2020, amount: 30_000, taxableAmount: 30_000 }, // seasoned by 2026
      { year: 2024, amount: 15_000, taxableAmount: 15_000 }, // unseasoned in 2026
    ],
  }

  it('takes contributions first — free at any age', () => {
    const r = splitRothWithdrawal(state, 12_000, 2026, 45)
    expect(r.contributions).toBe(12_000)
    expect(r.conversions).toBe(0)
    expect(r.earnings).toBe(0)
    expect(r.penalty).toBe(0)
    expect(r.taxableOrdinary).toBe(0)
    expect(r.next.contributionBasis).toBe(8_000)
  })

  it('moves to conversions (oldest first) after contributions are exhausted', () => {
    // 20k contributions + 25k more → all 20k basis, then 25k from the 2020 layer.
    const r = splitRothWithdrawal(state, 45_000, 2026, 45)
    expect(r.contributions).toBe(20_000)
    expect(r.conversions).toBe(25_000)
    expect(r.penalty).toBe(0) // the 2020 layer is seasoned (>5y)
    expect(r.next.contributionBasis).toBe(0)
    expect(r.next.conversionLayers).toEqual([
      { year: 2020, amount: 5_000, taxableAmount: 5_000 },
      { year: 2024, amount: 15_000, taxableAmount: 15_000 },
    ])
  })
})

describe('splitRothWithdrawal — 5-year conversion recapture', () => {
  it('penalizes an unseasoned conversion tapped before 59½', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 10_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2026, 50) // 2 years < 5, age < 60
    expect(r.conversions).toBe(10_000)
    expect(r.taxableOrdinary).toBe(0) // never income-taxed again
    expect(r.penalty).toBeCloseTo(1_000, 6) // 10% recapture
  })

  it('does not penalize the same conversion once 5 years pass', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 10_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2029, 50) // 5 years elapsed
    expect(r.penalty).toBe(0)
  })

  it('does not penalize an unseasoned conversion once 59½ (age 60) is reached', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 10_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2026, 60)
    expect(r.penalty).toBe(0)
  })

  it('recaptures only the taxable share of a conversion that carried IRA basis', () => {
    // A $10k conversion that was half nondeductible basis: the full $10k returns
    // tax-free (never treated as earnings), but only the $5k taxable share is
    // penalized when tapped unseasoned before 59½ (IRS Pub 590-B).
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 5_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2026, 50)
    expect(r.conversions).toBe(10_000)
    expect(r.earnings).toBe(0) // the basis share is principal, not earnings
    expect(r.taxableOrdinary).toBe(0)
    expect(r.penalty).toBeCloseTo(500, 6) // 10% of the $5k taxable share only
  })

  it('recaptures the taxable share proportionally on a partial tap', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 4_000 }]
    const r = splitRothWithdrawal(state, 5_000, 2026, 50) // taps half the layer
    expect(r.conversions).toBe(5_000)
    expect(r.penalty).toBeCloseTo(200, 6) // 10% of half the $4k taxable share
    expect(r.next.conversionLayers).toEqual([{ year: 2024, amount: 5_000, taxableAmount: 2_000 }])
  })
})

describe('splitRothWithdrawal — earnings', () => {
  const withEarnings: RothBasisState = { contributionBasis: 5_000, conversionLayers: [] }

  it('taxes and penalizes earnings withdrawn before 59½', () => {
    const r = splitRothWithdrawal(withEarnings, 9_000, 2026, 45) // 5k basis, 4k earnings
    expect(r.contributions).toBe(5_000)
    expect(r.earnings).toBe(4_000)
    expect(r.taxableOrdinary).toBe(4_000)
    expect(r.penalty).toBeCloseTo(400, 6)
  })

  it('treats earnings as fully qualified at 60+', () => {
    const r = splitRothWithdrawal(withEarnings, 9_000, 2026, 62)
    expect(r.earnings).toBe(4_000)
    expect(r.taxableOrdinary).toBe(0)
    expect(r.penalty).toBe(0)
  })
})

describeRule('irc-408A-d-3-F-roth-conversion-recapture', {
  // A $10,000 conversion of which only $4,000 was includible in gross income,
  // tapped in full two years later at age 50. 408A(d)(3)(F)(i) applies 72(t) to
  // the portion allocable to the conversion; (F)(ii) caps that at the includible
  // amount. Reading (F)(i) alone recaptures the whole principal.
  readings: { statuteIncludiblePortionOnly: 400, rejectedWholeConversionPrincipal: 1_000 },
  accepted: 'statuteIncludiblePortionOnly',
}, ({ accepted, readings }) => {
  const partlyBasisConversion = (): RothBasisState => ({
    contributionBasis: 0,
    conversionLayers: [{ year: 2024, amount: 10_000, taxableAmount: 4_000 }],
  })

  it('recaptures only so much of the conversion as was includible at the time', () => {
    const split = splitRothWithdrawal(partlyBasisConversion(), 10_000, 2026, 50)
    expect(split.penalty).toBeCloseTo(accepted, 6)
    expect(split.penalty).not.toBeCloseTo(readings.rejectedWholeConversionPrincipal, 6)
  })

  it('applies 72(t) without taxing the conversion principal a second time', () => {
    const split = splitRothWithdrawal(partlyBasisConversion(), 10_000, 2026, 50)
    expect(split.conversions).toBe(10_000)
    expect(split.earnings).toBe(0)
    expect(split.taxableOrdinary).toBe(0)
  })

  it('runs the five-taxable-year period from the year of that conversion', () => {
    // The period beginning with 2024 covers 2024 through 2028, so a 2028 tap
    // still recaptures and a 2029 tap does not.
    expect(splitRothWithdrawal(partlyBasisConversion(), 10_000, 2028, 50).penalty)
      .toBeCloseTo(accepted, 6)
    expect(splitRothWithdrawal(partlyBasisConversion(), 10_000, 2029, 50).penalty).toBe(0)
  })
})

describe('freeRothCoverCapacity — FIFO prefix', () => {
  it('sums seasoned and wholly nontaxable unseasoned layers when they lead the queue', () => {
    const state: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2020, amount: 30_000, taxableAmount: 30_000 }, // seasoned by 2026
        { year: 2025, amount: 10_000, taxableAmount: 0 }, // nontaxable unseasoned
      ],
    }
    expect(freeRothCoverCapacity(state, 2026, 55)).toBe(40_000)
  })

  it('stops at the first unseasoned taxable layer (deeper free layers are not free cover)', () => {
    // §408A(d)(4)(B)(ii)(I): conversions out FIFO. A later nontaxable unseasoned
    // layer cannot cover a draw without first tapping the blocking taxable layer
    // (which recaptures under §72(t) when pre-59½).
    const state: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2026, amount: 10_000, taxableAmount: 10_000 }, // unseasoned taxable — blocks
        { year: 2027, amount: 10_000, taxableAmount: 0 }, // nontaxable, but behind the block
      ],
    }
    // Age 55, year 2028: both layers unseasoned; free cover is 0, not 10k.
    expect(freeRothCoverCapacity(state, 2028, 55)).toBe(0)
    // Removing assumed seed and drawing $10k reaches the 2026 layer → $1,000 §72(t).
    const split = splitRothWithdrawal(state, 10_000, 2028, 55)
    expect(split.penalty).toBeCloseTo(1_000, 6)
  })

  it('includes unseasoned taxable layers once the owner is qualified (age 60+)', () => {
    const state: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2026, amount: 10_000, taxableAmount: 10_000 },
        { year: 2027, amount: 10_000, taxableAmount: 0 },
      ],
    }
    expect(freeRothCoverCapacity(state, 2028, 60)).toBe(20_000)
  })
})

describe('assumedSeedConsequentialSpill — FIFO residual walk', () => {
  it('bounds spill by the partial taxable remainder, then absorbs free layers behind it', () => {
    // Live draw partially consumed a $50 unseasoned taxable blocker (residual
    // $30) with $200 nontaxable free cover behind it. Prefix free cover is 0,
    // but only the $30 remainder is consequential for a $100 assumed seed.
    const residual: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2026, amount: 30, taxableAmount: 30 },
        { year: 2027, amount: 200, taxableAmount: 0 },
      ],
    }
    expect(freeRothCoverCapacity(residual, 2028, 55)).toBe(0)
    const walked = assumedSeedConsequentialSpill(residual, 100, 2028, 55)
    expect(walked.consequentialSpill).toBeCloseTo(30, 6)
    // Taxable $30 + free-behind $70 = $100 conversion principal consumed.
    expect(walked.conversionPrincipalConsumed).toBeCloseTo(100, 6)
  })

  it('reports zero spill when the live draw already exhausted the taxable blocker', () => {
    const residual: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2027, amount: 200, taxableAmount: 0 },
      ],
    }
    const walked = assumedSeedConsequentialSpill(residual, 100, 2028, 55)
    expect(walked.consequentialSpill).toBeCloseTo(0, 6)
    expect(walked.conversionPrincipalConsumed).toBeCloseTo(100, 6)
  })

  it('prorates consequential spill on a mixed unseasoned layer ($100 seed / $10 taxable)', () => {
    // Full $100 seed lands on a $100 residual layer with only $10 taxable —
    // splitRothWithdrawal recaptures take * (taxable / amount) = $10, not $100.
    const residual: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [{ year: 2026, amount: 100, taxableAmount: 10 }],
    }
    expect(freeRothCoverCapacity(residual, 2028, 55)).toBe(0)
    const walked = assumedSeedConsequentialSpill(residual, 100, 2028, 55)
    expect(walked.consequentialSpill).toBeCloseTo(10, 6)
    expect(walked.conversionPrincipalConsumed).toBeCloseTo(100, 6)
    // Live penalty on the same residual would be 10% of that taxable share.
    expect(splitRothWithdrawal(residual, 100, 2028, 55).penalty).toBeCloseTo(1, 6)
  })

  it('prorates on a partially-consumed mixed residual (remaining balances)', () => {
    // Live draw already took half of a $100 / $10 mixed layer → residual
    // amount=50, taxableAmount=5. A $50 seed take * (5/50) = $5 consequential;
    // a $100 seed finishes the residual ($5) then spills $50 into earnings.
    const residual: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [{ year: 2026, amount: 50, taxableAmount: 5 }],
    }
    const half = assumedSeedConsequentialSpill(residual, 50, 2028, 55)
    expect(half.consequentialSpill).toBeCloseTo(5, 6)
    expect(half.conversionPrincipalConsumed).toBeCloseTo(50, 6)
    expect(splitRothWithdrawal(residual, 50, 2028, 55).penalty).toBeCloseTo(0.5, 6)

    const over = assumedSeedConsequentialSpill(residual, 100, 2028, 55)
    expect(over.consequentialSpill).toBeCloseTo(5 + 50, 6) // residual taxable + earnings
    // Only $50 of conversion principal available; the rest is earnings.
    expect(over.conversionPrincipalConsumed).toBeCloseTo(50, 6)
  })

  it('tracks $100 seed into a pure $100 taxable layer as conversion principal debt', () => {
    const residual: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [{ year: 2026, amount: 100, taxableAmount: 100 }],
    }
    const walked = assumedSeedConsequentialSpill(residual, 100, 2028, 55)
    expect(walked.consequentialSpill).toBeCloseTo(100, 6)
    expect(walked.conversionPrincipalConsumed).toBeCloseTo(100, 6)
  })

  it('reports zero earningsSpill when the owner is age-qualified (mirror splitRothWithdrawal)', () => {
    // Residual past conversion layers is earnings. At ROTH_QUALIFIED_AGE those
    // earnings are tax/penalty-free in splitRothWithdrawal, so assumed-seed
    // spill past free conversion cover must not mark earnings as consequential
    // (published assumed-basis verdict is silent for qualified owners).
    const residual: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [{ year: 2020, amount: 40, taxableAmount: 40 }], // seasoned free
    }
    const walked = assumedSeedConsequentialSpill(residual, 100, 2028, ROTH_QUALIFIED_AGE)
    expect(walked.unseasonedTaxableSpill).toBe(0)
    expect(walked.earningsSpill).toBe(0)
    expect(walked.consequentialSpill).toBe(0)
    // Conversion principal still absorbs the free layer; remainder is free earnings.
    expect(walked.conversionPrincipalConsumed).toBeCloseTo(40, 6)
    expect(splitRothWithdrawal(residual, 100, 2028, ROTH_QUALIFIED_AGE).taxableOrdinary).toBe(0)
  })

  it('dual ordered walks silence the $50-seed/$25-seasoned free-prefix-on-CF-head false positive', () => {
    // Live layers: $25 seasoned free, $100 unseasoned 50% taxable, $100 nontaxable.
    // Prior $25 seed debt removes the free head in CF. A subsequent draw takes
    // $25 remaining seed + $175 conversion live. Both worlds incur $50
    // penalty-sensitive principal — character-wise CF-extra is 0.
    // Walking live free-prefix length ($25) from the CF head would hit the mixed
    // layer and report a false $12.50 unseasoned spill.
    const liveLayers = [
      { year: 2020, amount: 25, taxableAmount: 25 }, // seasoned free
      { year: 2026, amount: 100, taxableAmount: 50 }, // unseasoned 50% taxable
      { year: 2027, amount: 100, taxableAmount: 0 }, // nontaxable free-behind
    ]
    const liveState: RothBasisState = { contributionBasis: 0, conversionLayers: liveLayers }
    const cfState: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [...applyConversionPrincipalDebt(liveLayers, 25)],
    }
    const fromAssumed = 25
    const conversions = 175
    const liveWalk = assumedSeedConsequentialSpill(liveState, conversions, 2028, 55)
    const cfWalk = assumedSeedConsequentialSpill(
      cfState,
      conversions + fromAssumed,
      2028,
      55,
    )
    // Same unseasoned taxable ($50) both sides; no CF-extra earnings.
    expect(liveWalk.unseasonedTaxableSpill).toBeCloseTo(50, 6)
    expect(cfWalk.unseasonedTaxableSpill).toBeCloseTo(50, 6)
    expect(liveWalk.earningsSpill).toBeCloseTo(0, 6)
    expect(cfWalk.earningsSpill).toBeCloseTo(0, 6)
    // Both-direction character gaps are zero when walks agree.
    const cfOverLive =
      Math.max(0, cfWalk.earningsSpill - liveWalk.earningsSpill) +
      Math.max(0, cfWalk.unseasonedTaxableSpill - liveWalk.unseasonedTaxableSpill)
    const liveOverCf =
      Math.max(0, liveWalk.earningsSpill - cfWalk.earningsSpill) +
      Math.max(0, liveWalk.unseasonedTaxableSpill - cfWalk.unseasonedTaxableSpill)
    expect(Math.max(cfOverLive, liveOverCf)).toBeCloseTo(0, 6)
    // Buggy free-prefix-on-CF-head walk would report $12.50.
    const freePrefixOnCfHead = assumedSeedConsequentialSpill(cfState, 25, 2028, 55)
    expect(freePrefixOnCfHead.unseasonedTaxableSpill).toBeCloseTo(12.5, 6)
  })

  it('pins character-wise gaps both ways (CF-more and live-more unseasoned)', () => {
    // Verdict magnitude = max(CF-over-live, live-over-CF) character gaps.
    const characterVerdict = (
      cf: { earningsSpill: number; unseasonedTaxableSpill: number },
      live: { earningsSpill: number; unseasonedTaxableSpill: number },
    ) => {
      const cfOverLive =
        Math.max(0, cf.earningsSpill - live.earningsSpill) +
        Math.max(0, cf.unseasonedTaxableSpill - live.unseasonedTaxableSpill)
      const liveOverCf =
        Math.max(0, live.earningsSpill - cf.earningsSpill) +
        Math.max(0, live.unseasonedTaxableSpill - cf.unseasonedTaxableSpill)
      return Math.max(cfOverLive, liveOverCf)
    }

    // Direction CF > live: prior debt removed free head; CF conversion walk
    // hits more unseasoned taxable than the live free-first walk.
    const cfMoreLayers = [
      { year: 2020, amount: 50, taxableAmount: 50 }, // seasoned free
      { year: 2026, amount: 100, taxableAmount: 100 }, // unseasoned full taxable
    ]
    const liveCfMore = assumedSeedConsequentialSpill(
      { contributionBasis: 0, conversionLayers: cfMoreLayers },
      100, // live conversion
      2028,
      55,
    )
    const cfCfMore = assumedSeedConsequentialSpill(
      {
        contributionBasis: 0,
        conversionLayers: [...applyConversionPrincipalDebt(cfMoreLayers, 50)],
      },
      100, // same conversion (no new seed this draw)
      2028,
      55,
    )
    // Live: $50 free + $50 unseasoned. CF (free gone): $100 unseasoned.
    expect(liveCfMore.unseasonedTaxableSpill).toBeCloseTo(50, 6)
    expect(cfCfMore.unseasonedTaxableSpill).toBeCloseTo(100, 6)
    expect(characterVerdict(cfCfMore, liveCfMore)).toBeCloseTo(50, 6)

    // Direction live > CF: prior debt already consumed the unseasoned layer in
    // CF; live still walks it. One-way Math.max(0, CF − live) clamps to 0.
    const liveMoreLayers = [
      { year: 2026, amount: 50, taxableAmount: 50 }, // unseasoned taxable
      { year: 2027, amount: 50, taxableAmount: 0 }, // nontaxable free-behind
    ]
    const liveLiveMore = assumedSeedConsequentialSpill(
      { contributionBasis: 0, conversionLayers: liveMoreLayers },
      50,
      2028,
      55,
    )
    const cfLiveMore = assumedSeedConsequentialSpill(
      {
        contributionBasis: 0,
        conversionLayers: [...applyConversionPrincipalDebt(liveMoreLayers, 50)],
      },
      50,
      2028,
      55,
    )
    // Live: $50 unseasoned. CF (unseasoned already debt-consumed): $50 free.
    expect(liveLiveMore.unseasonedTaxableSpill).toBeCloseTo(50, 6)
    expect(cfLiveMore.unseasonedTaxableSpill).toBeCloseTo(0, 6)
    expect(liveLiveMore.earningsSpill).toBeCloseTo(0, 6)
    expect(cfLiveMore.earningsSpill).toBeCloseTo(0, 6)
    const clampedOneWay =
      Math.max(0, cfLiveMore.earningsSpill - liveLiveMore.earningsSpill) +
      Math.max(
        0,
        cfLiveMore.unseasonedTaxableSpill - liveLiveMore.unseasonedTaxableSpill,
      )
    expect(clampedOneWay).toBe(0)
    expect(characterVerdict(cfLiveMore, liveLiveMore)).toBeCloseTo(50, 6)
  })
})
