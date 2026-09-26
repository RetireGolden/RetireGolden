## Claim

Kind: model. `projection/yearFigures.ts#taxFreeGainsRoom(year)` publishes the largest additional long-term capital gain `g` the household could realize in the year without raising the year's federal income tax, where the tax is recomputed by the engine's own federal calculator with the extra gain netted through the capital-loss carryforward first:

```
R = max { g ≥ 0 : F(h) ≤ F(0) for every h in [0, g] }
F(g) = computeFederalTax({ ...I, capitalGains: N(g), realizedCapitalGainsBeforeCarryforward: G + g }).totalTax
N(g) = applyCapitalLossCarryforward(P, I.ordinaryIncome, G + g, L).netCapitalGain
```

with `I` the year's published advisory tax input (`YearResult.advisoryFederalTax.input`), `G` its signed realized gain before netting, `L` the year's loss offset limit ($3,000), and `P` the opening carryforward pool rebuilt from the published netting: `P = capitalLossCarryforwardRemaining + capitalLossUsedAgainstOrdinary + capitalLossUsedAgainstGains − max(0, −G)` (from `usedG = min(P, G⁺)`, `avail = P − usedG + G⁻`, `usedO = min(avail, L)`, `remaining = avail − usedO`). It returns null when the row carries no advisory input. `premiumTaxCreditYear(year)` marks the years with a modeled ACA premium credit, which the room does not price.

Search: `F(0)` first; an upper bound doubles from $1 until `F` exceeds `F(0) + $0.000001`; bisection on `F(m) ≤ F(0) + $0.000001` until the bracket is $0.01 wide; the lower end is published. The `$0.000001` absorbs binary rounding in `taxableIncome − preferentialIncome` (about `1e-11`); it can carry the result past the true root by at most `1e-6` divided by the marginal rate just past it, under $0.00002 in every case below.

This replaces the page's "0% bracket headroom plus the remaining carryforward", which owner decision R2 (fix, 2026-09-25) found is not the $0-tax room the column claims.

## Justification

**The carryforward.** Under IRC 1211(b) and 1212(b), as `applyCapitalLossCarryforward` models them, the opening pool first absorbs the year's gains, and only the net loss that remains, up to $3,000, is deducted against other income. An extra gain passes three segments:

1. `0 < g ≤ r0` (`r0` the remaining carryforward): the pool absorbs it without touching the $3,000 deduction. Every tax input is unchanged, so `F(g) = F(0)` exactly.
2. `r0 < g ≤ r0 + u0` (`u0` the offset used against ordinary income): each gain dollar removes a dollar of the deduction, and AGI rises as ordinary income does. Tax is unchanged only while ordinary taxable income stays at zero.
3. `g > r0 + u0`: a net capital gain, taxed at 0% while taxable income stays at or under the 15% threshold `T` (IRC 1(h)(1)(B)), and reached at no extra tax only if segment 2 was.

**Social Security.** Under IRC 86 an extra gain raises provisional income; past the base amount each gain dollar makes 50 or 85 cents of benefits taxable, which is ordinary income and raises tax as soon as ordinary taxable income is positive, even while the gain itself sits in the 0% band. The 0% band room counts those benefits in taxable income but not as a cost.

**Other effects the recomputation carries:** the senior deduction's phase-out above $75,000/$150,000 of MAGI (IRC 151(d)(5)(C)(iii)), not indexed while the 0% band is, so it can start inside the band from 2027; the net investment income tax (IRC 1411) above an unindexed $200,000/$250,000 of MAGI; and the AMT (IRC 55).

**Closed form without Social Security** (deduction `D` constant, no NIIT or AMT in range, qualified dividends `q` and any net gain `n0⁺` under `T`): with `s = max(0, D + u0 − O)`, `R = r0 + min(u0, s) + (s ≥ u0 ? max(0, T + D − O − q − n0⁺) : 0)`, `O` the ordinary income before the loss deduction. With no carryforward it reduces to `max(0, T + D − O − q − n0⁺)`, the 0% band room.

## Inputs

2026, single filer: standard deduction $16,100 (plus $2,050 at 65, plus the $6,000 senior deduction below $75,000 of MAGI), 15% threshold $49,450, brackets 10% to $12,400 and 12% to $50,400, benefit base amounts $25,000 and $34,000, offset limit $3,000. Households A to E each have one uninflated recurring pension, no other income, a zero-return 1,000 cash account, and the carryforward entering 2026; each is 63 in 2026 except D.

| Case | Ordinary income `O` | Carryforward `P` | Year's own gain `G` | Social Security | Age / year |
|---|---:|---:|---:|---:|---|
| A | 40,000 | 10,000 | 0 | 0 | 63 / 2026 |
| B | 17,600 | 10,000 | 0 | 0 | 63 / 2026 |
| C | 10,000 | 10,000 | 0 | 0 | 63 / 2026 |
| D | 10,000 | 0 | 0 | 30,000 | 67 / 2026 |
| E | 40,000 | 0 | 0 | 0 | 63 / 2026 |
| G (input level) | 40,000 | 10,000 | 4,000 | 0 | 63 / 2026 |
| H (input level) | 40,000 | 10,000 | −2,000 | 0 | 63 / 2026 |
| NIIT (input level) | 0 | 0 | 0 | 0 | 65+ / 2060, thresholds indexed ×3 |
| Senior phase-out (input level) | 20,500 | 0 | 11,241.03 | 0 | 65+ / 2027, thresholds indexed ×1.025 |

D is born 1959-06-15 with a PIA of $2,500 claimed at 66 years 10 months (full retirement age for 1959). The engine times a claim by attained age in the calendar year, so the claim falls in 2025 and the ledger books 12 months of benefits in 2026: $30,000. The NIIT case is a single filer with no income at all in 2060; the senior case is the 2027 advisory input of the `under-saved-single` example plan (ordinary income 20,500 and its own 11,241.03 gain).

## Arithmetic

**A.** Netting: `usedG = 0`, `u0 = 3,000`, `r0 = 7,000`, net `−3,000`. AGI `37,000`, taxable `20,900`, tax `1,240 + 0.12 × 8,500 = 2,260`. Segment 1 ends at 7,000. `s = max(0, 16,100 + 3,000 − 40,000) = 0`, so the first dollar past 7,000 is ordinary at 12%. **R = 7,000.** The retired figure was headroom `49,450 − 20,900 = 28,550` plus `7,000` = `35,550`; realizing it gives net gain `25,550`, AGI `65,550`, taxable `49,450`, ordinary taxable `23,900` (tax `2,620`), gains all at 0%: **$360** of extra tax, the $3,000 deduction lost at 12%.

**B.** `u0 = 3,000`, `r0 = 7,000`; AGI `14,600`, taxable `0`. `s = 16,100 + 3,000 − 17,600 = 1,500 < 3,000`: `F(8,500) = 0`, `F(8,501) = 0.10`. **R = 8,500.** The retired figure was `49,449.99 + 7,000 = 56,449.99` before the 0% band fix (D-ZERO-RATE-HEADROOM) and `50,950 + 7,000 = 57,950` after it; realizing either costs **$150**.

**C.** `u0 = 3,000`, `r0 = 7,000`; AGI `7,000`, tax `0`. `s = 9,100 ≥ 3,000`, so segment 2 is free and segment 3 runs to `T + D − O = 55,550` of net gain: **R = 7,000 + 3,000 + 55,550 = 65,550**; `F(65,551) = 0.15`. The retired figure after the band fix was `58,550 + 7,000 = 65,550`: equal.

**D.** No carryforward. Deduction `16,100 + 2,050 + 6,000 = 24,150`. Provisional income `10,000 + g + 15,000`. Taxable benefits: `0.5 g` for `g ≤ 9,000`; `4,500 + 0.85 (g − 9,000)` above. Tax stays 0 while pension plus taxable benefits stay at or under the deduction: `10,000 + 4,500 + 0.85 (g − 9,000) = 24,150` gives `g = 9,000 + 9,650 / 0.85 = 20,352.941176…`; there MAGI is `44,502.94`, so the senior deduction is whole. **R = 20,352.94**; past it each gain dollar costs `0.85 × 10% = 8.5` cents. The retired figure was the 0% band room: benefits reach the 25,500 cap at `g = 33,705.88`, and `10,000 + 25,500 + g − 24,150 = 49,450` gives `38,100`. Realizing 38,100 leaves ordinary taxable income `35,500 − 24,150 = 11,350`: **$1,135** of tax on a column that said $0.

**E.** No carryforward, no benefits: taxable `23,900`, tax `2,620`; `R = T − taxable = 25,550`, the 0% band room.

**G.** `usedG = 4,000`, `u0 = 3,000`, `r0 = 3,000`, net `−3,000`; rebuilt `P = 3,000 + 3,000 + 4,000 − 0 = 10,000`. `s = 0`: **R = 3,000**. Retired `28,550 + 3,000 = 31,550`; extra tax at it `$360`.

**H.** `usedG = 0`, available `12,000`, `u0 = 3,000`, `r0 = 9,000`; `P = 9,000 + 3,000 + 0 − 2,000 = 10,000`. **R = 9,000**. Retired `37,550`; extra tax at it `$360`.

**NIIT (2060).** Thresholds indexed ×3: 0% band to taxable `148,350`, deduction `(16,100 + 2,050) × 3 = 54,450` (the senior deduction ended after 2028), so the 0% band reaches `g = 202,800`. The NIIT threshold is not indexed: from MAGI above $200,000, 3.8% of the excess. **R = 200,000.** The 0% band room is 202,800 and realizing it costs `0.038 × 2,800 = $106.40`.

**Senior phase-out (2027).** Thresholds ×1.025: 0% band to `50,686.25`, deduction `16,502.50 + 2,101.25 + senior`, senior `6,000 − 0.06 × max(0, MAGI − 75,000)` (not indexed). Taxable income is all preferential. Without the phase-out the band room is `50,686.25 − (31,741.03 − 24,603.75) = 43,548.97`, which puts MAGI at 75,290. With it, above MAGI 75,000: taxable `= 1.06 g + 4,541.7418`, which reaches `50,686.25` at **g = 43,532.5549…**. Realizing the band room costs `0.15 × 0.06 × 290 = $2.61`.

## Expected

The published value lies in `[R − 0.01, R + 0.0001]`.

| Case | R (exact) | Retired figure | Extra federal tax at the retired figure |
|---|---:|---:|---:|
| A | 7,000 | 35,550 | 360 |
| B | 8,500 | 56,449.99, 57,950 after the band fix | 150 |
| C | 65,550 | 56,449.99, 65,550 after the band fix | 0 |
| D | 20,352.941176… | 38,100 | 1,135 |
| E | 25,550 | 25,550 | 0 |
| G | 3,000 | 31,550 | 360 |
| H | 9,000 | 37,550 | 360 |
| NIIT | 200,000 | 202,800 (band room) | 106.40 |
| Senior phase-out | 43,532.5549… | 43,548.97 (band room) | 2.61 |

Segment checks: `F(r0) = F(0)` exactly for A, B and C; `F(R + 1) − F(0)` is `0.12` (A), `0.10` (B), `0.15` (C, E) and `0.085` (D), each within `1e-9`. A row without an advisory input, or whose input omits the gain before netting in a year with a carryforward, publishes null. `premiumTaxCreditYear` is false with no ACA result or a credit of 0 or null, true with a credit of 1,200.

## Wrong readings

- The retired sum, band room plus remaining carryforward: A `35,550` (costs $360), D `38,100` (costs $1,135).
- The band room alone (`ltcgZeroHeadroom`): A `28,550`, D `38,100`. It answers "how much gain stays in the 0% band", not "how much gain costs no tax".
- `remaining + max(0, min(3,000, deduction − ordinary))`: B `7,000` (true 8,500; it uses ordinary income before the loss deduction), C `10,000` (true 65,550; it drops the 0% band that becomes free once the whole deduction is displaced at zero taxable income).
- The remaining carryforward alone: C `7,000`. The opening carryforward: `10,000` for A, B, C, G, H.
- Adding the extra gain to the already-netted gain instead of netting it through the pool: the first dollar shrinks the $3,000 deduction, so A would read 0.

## Observed on the example library (engine-computed, not hand-derived)

The deriver ran the 29 example plans (start year 2026, 1,210 plan-years) and compared the room with the page's figure after the band fix. The room is lower by more than $0.50 in **370 plan-years**, never higher; none has a carryforward remaining (the two $12,000-carryforward examples use it up in 2026). 363 of the 370 have Social Security benefits. By mechanism: 314 benefit taxation (including the largest, 216,148 lower in 2078 of `all-401k-no-bridge` and `brokerage-bridge-401k`, where realizing the old figure costs $11,599.64), 51 the unindexed NIIT threshold (2053 to 2085), 5 the senior-deduction phase-out. In 150 of the 370 the room is $0. 319 of the 370 end the year with no taxable-account balance to realize a gain from, and 83 fall in or after a depletion year; in the 51 that end the year with a taxable-account balance, the largest change is 59,276 lower (`salary-growth-escalation` 2070) and the largest cost at the old figure $2,628.59 (`aggressive-saver` 2063). (The independent check counted 317 and 53 with a different reading of when the balance is measured; the implementer's recount on the year-end balance gives 319 and 51, with the same largest change and cost.) None of these is an expected value of the evidence.

## Family

outputs: `display-tax-free-gains-room-annual`.

feeds: none. Reads `tax-loss-carryforward-remaining-annual`, `tax-loss-carryforward-used-against-gains-annual`, `tax-loss-carryforward-used-against-ordinary-annual` and the advisory tax input; it no longer reads `year-result-ltcg-zero-headroom`, which stays published as the 0% band room. Registry rules: `irc-1-h-1-0-15-20-preferential-rate-schedule`, `irc-1-h-capital-gain-stacked-on-ordinary`, `irc-1211-b-capital-loss-ordinary-offset`, `irc-1212-b-capital-loss-carryforward`, `irc-1212-b-2-zero-income-section-1211-allowance-preserves-carryforward`, `irc-86-a-taxable-social-security-two-tier`, `irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out`, `irc-1411-a-net-investment-income-tax`, `irc-55-a-amt-is-the-excess-over-regular-tax`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the statute and the engine's netting and tax functions as read at RetireGolden `aeb2861a`; households A to H by hand and by the deriver's own statute script, which imports nothing from the engine. Checked by a second claude agent that did not derive it, with its own statute script; it confirmed every value, added the NIIT and senior phase-out cases, and noted that D's 12 months of 2026 benefits come from the engine's attained-age claim timing. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
