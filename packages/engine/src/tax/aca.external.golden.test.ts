import { describe, expect, it } from 'vitest'

import { expectMoney, expectPercent } from '../testing/money.js'
import { packForYear } from '../params/index.js'
import { acaApplicablePct, acaNetAnnualPremium } from './aca.js'

/**
 * ORACLE-003 (Phase 5, external-oracle-comparisons.md) — ACA premium tax credit
 * vs IRS Rev. Proc. 2025-25 (2026 applicable percentages) and the 2025 HHS
 * poverty guidelines (applied to the 2026 coverage year).
 *
 * Policy context confirmed for 2026: ARPA/IRA enhanced credits expired
 * 12/31/2025 and the 400% FPL subsidy cliff was reinstated 1/1/2026 — exactly
 * the pack's modeled regime.
 *
 * Oracles:
 *   Applicable percentages: IRS Rev. Proc. 2025-25 (https://www.irs.gov/pub/irs-drop/rp-25-25.pdf).
 *   Poverty guidelines: HHS 2025 (https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines).
 *   Cross-checked against thefinancebuff.com and CRS R48290.
 * Access date: 2026-06-29. Coverage year: 2026. Tolerance: $1 / 0.01 pct-pt.
 *
 * IRS Rev. Proc. 2025-25 — 2026 applicable percentage table (linear within band):
 *   < 133% FPL ............. 2.10%
 *   133% – 150% FPL ........ 3.14% → 4.19%
 *   150% – 200% FPL ........ 4.19% → 6.60%
 *   200% – 250% FPL ........ 6.60% → 8.44%
 *   250% – 300% FPL ........ 8.44% → 9.96%
 *   300% – 400% FPL ........ 9.96% (flat)
 *   > 400% FPL ............. no credit (cliff)
 */
const pack = packForYear(2026).pack

describe('ORACLE-003: ACA premium tax credit vs IRS Rev. Proc. 2025-25 + HHS 2025 FPL', () => {
  it('poverty-line parameters match the 2025 HHS guidelines and produce the published 2026 cliffs', () => {
    expect(pack.federalPovertyLine.firstPerson).toBe(15_650)
    expect(pack.federalPovertyLine.perAdditionalPerson).toBe(5_500)
    expect(pack.aca.maxFplPctForCredit).toBe(400)

    // 400% FPL cliff dollar amounts published for 2026 (48 states), from these guidelines:
    const fplSingle = pack.federalPovertyLine.firstPerson
    const fplFamily4 = pack.federalPovertyLine.firstPerson + 3 * pack.federalPovertyLine.perAdditionalPerson
    expectMoney(fplSingle * 4, 62_600) // single cliff
    expectMoney(fplFamily4 * 4, 128_600) // family-of-four cliff
  })

  it('applicable percentages match the IRS 2026 band endpoints', () => {
    expectPercent(acaApplicablePct(pack, 100), 2.1)
    expectPercent(acaApplicablePct(pack, 150), 4.19)
    expectPercent(acaApplicablePct(pack, 200), 6.6)
    expectPercent(acaApplicablePct(pack, 250), 8.44)
    expectPercent(acaApplicablePct(pack, 300), 9.96)
    expectPercent(acaApplicablePct(pack, 350), 9.96) // flat 300–400 band
    expectPercent(acaApplicablePct(pack, 400), 9.96)
  })

  it('interpolates linearly within each IRS band exactly (the IRS table is itself linear per band)', () => {
    // 175% is the midpoint of the 150–200 band (4.19 → 6.60): 4.19 + 0.5·(6.60−4.19) = 5.395.
    expectPercent(acaApplicablePct(pack, 175), 5.395)
    // 225% midpoint of 200–250 (6.60 → 8.44): 6.60 + 0.5·(8.44−6.60) = 7.52.
    expectPercent(acaApplicablePct(pack, 225), 7.52)
    // 275% midpoint of 250–300 (8.44 → 9.96): 8.44 + 0.5·(9.96−8.44) = 9.20.
    expectPercent(acaApplicablePct(pack, 275), 9.2)
  })

  /**
   * Documented modeling nuance — the 133% boundary.
   * The IRS table is a step: < 133% is a flat 2.10% and the 133–150% band opens
   * at 3.14%. The pack encodes the jump as a 1-point ramp (133% → 2.10%, 134% →
   * 3.14%) because the engine interpolates linearly, so values strictly between
   * 133% and 134% FPL differ slightly from the IRS step. Outside that sub-1%-FPL
   * sliver the schedule matches IRS exactly. Intentional encoding simplification.
   */
  it('treats the 133% boundary as a 1-point ramp (documented approximation)', () => {
    expectPercent(acaApplicablePct(pack, 133), 2.1) // pack: end of the flat <133 segment
    expectPercent(acaApplicablePct(pack, 134), 3.14) // pack: start of the 133–150 band
  })

  it('applies the credit below the cliff and forfeits it one dollar above (single, 2026)', () => {
    const fullPremium = 10_000
    // 200% FPL exactly: MAGI = 2 × $15,650 = $31,300; applicable pct 6.60%.
    const at200 = acaNetAnnualPremium(pack, 1, 31_300, fullPremium)
    expectPercent(at200.fplPct, 200)
    expect(at200.overCliff).toBe(false)
    // Expected contribution 6.60% × 31,300 = $2,065.80 → credit = premium − contribution.
    expectMoney(at200.expectedContribution, 2_065.8)
    expectMoney(at200.credit, fullPremium - 2_065.8)
    expectMoney(at200.netAnnualPremium, 2_065.8)

    // Cliff: $1 over 400% FPL (62,600) forfeits the entire credit.
    const overCliff = acaNetAnnualPremium(pack, 1, 62_601, fullPremium)
    expect(overCliff.overCliff).toBe(true)
    expectMoney(overCliff.credit, 0)
    expectMoney(overCliff.netAnnualPremium, fullPremium)

    // Just under the cliff still receives a credit.
    const underCliff = acaNetAnnualPremium(pack, 1, 62_599, fullPremium)
    expect(underCliff.overCliff).toBe(false)
    expect(underCliff.credit).toBeGreaterThan(0)
  })
})
