import { describe, expect, it } from 'vitest'

import { expectMoney, expectPercent } from '../testing/money.js'
import { acaParametersForCoverageYear, packForYear } from '../params/index.js'
import { acaApplicablePct, acaEconomicPremiumByMonth, acaFederalPovertyLine, acaNetAnnualPremium } from './aca.js'

/**
 * ORACLE-003 (DOCS/external-oracles.md) — ACA premium tax credit
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
 * Access date: 2026-06-29. Coverage year: 2026. Tolerance: $1, or 0.01 percentage point.
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
    expect(pack.federalPovertyLine.contiguous).toEqual({
      firstPerson: 15_650,
      perAdditionalPerson: 5_500,
    })
    expect(pack.federalPovertyLine.alaska).toEqual({
      firstPerson: 19_550,
      perAdditionalPerson: 6_880,
    })
    expect(pack.federalPovertyLine.hawaii).toEqual({
      firstPerson: 17_990,
      perAdditionalPerson: 6_330,
    })
    expect(pack.aca.maxFplPctForCredit).toBe(400)

    // 400% FPL cliff dollar amounts published for 2026 (48 states), from these guidelines:
    const fplSingle = pack.federalPovertyLine.contiguous.firstPerson
    const fplFamily4 =
      pack.federalPovertyLine.contiguous.firstPerson +
      3 * pack.federalPovertyLine.contiguous.perAdditionalPerson
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
    // 175% is the midpoint of the 150–200 band (4.19 → 6.60): 4.19 + 0.5·(6.60−4.19) = 5.395,
    // rounded half up to the nearest hundredth (26 CFR 1.36B-3(g)(1)): 5.40.
    expectPercent(acaApplicablePct(pack, 175), 5.4)
    // 225% midpoint of 200–250 (6.60 → 8.44): 6.60 + 0.5·(8.44−6.60) = 7.52.
    expectPercent(acaApplicablePct(pack, 225), 7.52)
    // 275% midpoint of 250–300 (8.44 → 9.96): 8.44 + 0.5·(9.96−8.44) = 9.20.
    expectPercent(acaApplicablePct(pack, 275), 9.2)
  })

  it('matches the real applicable-percentage step at exactly 133% FPL', () => {
    expectPercent(acaApplicablePct(pack, 132.999), 2.1)
    expectPercent(acaApplicablePct(pack, 133), 3.14)
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

/**
 * ORACLE-018 (DOCS/external-oracles.md): the 2027 coverage year, from
 * Rev. Proc. 2026-26 section 3.01 (https://www.irs.gov/pub/irs-drop/rp-26-26.pdf)
 * and the HHS 2026 poverty guidelines, 91 FR 1797 (Jan. 15, 2026), which
 * 26 U.S.C. 36B(d)(3)(B) and 26 CFR 1.36B-1(h) make the 2027 coverage year's
 * because 2027 open enrollment begins in 2026 (45 CFR 155.410(e)(5)).
 * Access date: 2026-09-26. Tolerance: $0.01, or 0.0001 percentage point.
 *
 * Rev. Proc. 2026-26, the 2027 applicable percentage table (linear within band):
 *   < 133% FPL ............. 2.15%
 *   133% – 150% FPL ........ 3.23% → 4.30%
 *   150% – 200% FPL ........ 4.30% → 6.78%
 *   200% – 250% FPL ........ 6.78% → 8.66%
 *   250% – 300% FPL ........ 8.66% → 10.22%
 *   300% – 400% FPL ........ 10.22% (flat)
 *   > 400% FPL ............. no credit (cliff)
 */
describe('ORACLE-018: ACA premium tax credit for 2027 vs Rev. Proc. 2026-26 + HHS 2026 guidelines', () => {
  const block2027 = acaParametersForCoverageYear(2027).params

  it('carries the three HHS 2026 tables and produces the 2027 cliffs', () => {
    expect(block2027.federalPovertyLine.contiguous).toEqual({ firstPerson: 15_960, perAdditionalPerson: 5_680 })
    expect(block2027.federalPovertyLine.alaska).toEqual({ firstPerson: 19_950, perAdditionalPerson: 7_100 })
    expect(block2027.federalPovertyLine.hawaii).toEqual({ firstPerson: 18_360, perAdditionalPerson: 6_530 })
    expect(block2027.aca.maxFplPctForCredit).toBe(400)
    expectMoney(acaFederalPovertyLine(block2027, 1) * 4, 63_840) // single cliff
    expectMoney(acaFederalPovertyLine(block2027, 4) * 4, 132_000) // family-of-four cliff
  })

  it('matches the 2027 band endpoints, the step at exactly 133%, and the flat top band', () => {
    expectPercent(acaApplicablePct(block2027, 132.999), 2.15)
    expectPercent(acaApplicablePct(block2027, 133), 3.23)
    expectPercent(acaApplicablePct(block2027, 150), 4.3)
    expectPercent(acaApplicablePct(block2027, 200), 6.78)
    expectPercent(acaApplicablePct(block2027, 250), 8.66)
    expectPercent(acaApplicablePct(block2027, 300), 10.22)
    expectPercent(acaApplicablePct(block2027, 350), 10.22)
    expectPercent(acaApplicablePct(block2027, 400), 10.22)
  })

  it('interpolates linearly within each 2027 band, rounded half up to 0.01', () => {
    // 141.5: 3.23 + 0.5 x (4.30 - 3.23) = 3.765 -> 3.77; 175: 4.30 + 0.5 x 2.48 = 5.54;
    // 225: 6.78 + 0.5 x 1.88 = 7.72; 275: 8.66 + 0.5 x 1.56 = 9.44.
    expectPercent(acaApplicablePct(block2027, 141.5), 3.77)
    expectPercent(acaApplicablePct(block2027, 175), 5.54)
    expectPercent(acaApplicablePct(block2027, 225), 7.72)
    expectPercent(acaApplicablePct(block2027, 275), 9.44)
  })

  it('prices the early-retiree-aca and hsa-property-depth 2027 households by hand', () => {
    // early-retiree-aca: single, MAGI 29,212.49 (consulting 18,450 plus a
    // conversion filling the 10% bracket), benchmark = enrollment = 1,055 a
    // month. 29,212.49 / 15,960 = 183.0357%, read at 183 (Form 8962
    // instructions, Worksheet 2, line 4); r = 4.30 + 33 / 50 x 2.48 = 5.9368%,
    // rounded to 5.94% (26 CFR 1.36B-3(g)(1)); contribution 1,735.22; credit
    // 12,660 - 1,735.22 = 10,924.78. (Unrounded it would be 10,925.20.)
    const early = acaEconomicPremiumByMonth(
      block2027,
      1,
      29_212.49,
      new Array<number>(12).fill(1_055),
      new Array<number>(12).fill(1_055),
    )
    expect(Math.trunc(early.fplPct)).toBe(183)
    expectMoney(early.expectedContribution, 1_735.22)
    expectMoney(early.modeledAllowablePtc, 10_924.78)
    expectMoney(early.economicNetPremium, 1_735.22)

    // hsa-property-depth: single, MAGI 53,750.51, gross = benchmark = 8,776.80
    // (731.40 a month). 336.78% is in the flat band, so neither the truncation
    // nor the rounding moves it: 10.22% x 53,750.51 = 5,493.30; credit
    // 8,776.80 - 5,493.30 = 3,283.50.
    const hsa = acaEconomicPremiumByMonth(
      block2027,
      1,
      53_750.51,
      new Array<number>(12).fill(731.4),
      new Array<number>(12).fill(731.4),
    )
    expectMoney(hsa.expectedContribution, 5_493.3)
    expectMoney(hsa.modeledAllowablePtc, 3_283.5)
    expectMoney(hsa.economicNetPremium, 5_493.3)
  })
})
