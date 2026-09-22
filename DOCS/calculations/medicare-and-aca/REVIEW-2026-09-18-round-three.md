# Independent review, 2026-09-18 (derive round three, 25 worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r3.md built at beac7870 over the tax, Medicare, ACA, RMD, Social Security and SEPP modules and the 2026 parameter pack. Scope in this directory: aca-400-percent-cliff, aca-allowable-premium-tax-credit, aca-economic-net-premium, aca-expected-contribution, aca-household-magi-composition, medicare-base-part-b-premium, medicare-irmaa-first-tier-boundary, medicare-irmaa-two-year-lookback. The report covers all 25 worksheets of the round across five directories; the verbatim output follows, then the orchestrator note on the one rejection.

---

# Independent Worksheet Review Report

Branch `codex/b1-p4-worksheets-r3`, pack `year2026`, extract `b1-p4-signatures-r3.md`. All arithmetic recomputed by hand from Inputs and Justification only; Expected and Arithmetic sections not trusted.

---

## 1. `capital-loss-carryforward-netting`

**Recomputation**
- Used against gains: min(20,000, max(5,000, 0)) = **5,000**
- Pool after gains: 20,000 − 5,000 = **15,000**; current gain netted to **0**
- Used against ordinary (limit cap): min(15,000, 3,000) = **3,000**
- Reported net capital gain: **−3,000**; ordinary income unchanged: **50,000**
- Remaining pool: 15,000 − 3,000 = **12,000**

**Match:** yes

**Parameters:** `capitalLossOrdinaryOffsetLimit` = 3,000 matches pack.

**Tolerance:** exact whole dollars — justified.

**Wrong readings (2):** both recomputed correctly (direct ordinary subtraction → 47,000/0; skip gains-first → 5,000 gain, 17,000 remaining).

**Claim consistency:** matches `applyCapitalLossCarryforward` — gains first, then negative capital line up to limit, ordinary unchanged, remainder carried.

**Family:** outputs correct. **Issue:** `feeds: tax-realized-gains-annual` names an input family (signed capital result is consumed), not a downstream feed; only `tax-total-annual` is a legitimate feed.

**Verdict:** approve with a note (feeds list)

---

## 2. `federal-amt-screen`

**Recomputation**
- Exemption: max(0, 90,100 − 0.50×max(0, 200,000−500,000)) = **90,100**
- Taxable excess: 200,000 − 90,100 = **109,900** (all below 244,500 → 26% band only)
- Tentative minimum tax: 109,900 × 26/100 = **28,574**
- AMT: max(0, 28,574 − 20,000) = **8,574**

**Match:** yes

**Parameters:** exemption 90,100; phaseout start 500,000; phaseout rate 50%; 28% threshold 244,500; rates 26/28 — all match `year2026.federalTax.amt`.

**Tolerance:** exact — justified (whole-dollar products, no rounding stated).

**Wrong readings (2):** 28% on all excess → TMT 30,772, AMT 10,772 ✓; exemption-as-regular-deduction illustration ✓.

**Claim consistency:** matches pinned AMT screen functions and pack constants.

**Family:** outputs `tax-amt-annual`, feeds `tax-total-annual` — correct.

**Verdict:** approve

---

## 3. `federal-ltcg-stacking`

**Recomputation**
- 0% band space above ordinary base: 49,450 − 45,000 = **4,450**
- Remaining preferential at 15%: 10,000 − 4,450 = **5,550**
- Tax: 4,450×0 + 5,550×15/100 = **832.50** (nothing reaches 545,500)

**Match:** yes

**Parameters:** 15% threshold 49,450; 20% threshold 545,500 — match `year2026.capitalGains`.

**Tolerance:** absolute $0.005 — justified for cents from floating multiply.

**Wrong readings (2):** ignore stacking → 0 ✓; all at 15% → 1,500 ✓.

**Claim consistency:** stacking above ordinary taxable income matches `capitalGainsTaxStacked` signature.

**Family:** correct (feeds `tax-total-annual` only).

**Verdict:** approve

---

## 4. `federal-ordinary-bracket-tax`

**Recomputation**
- Layer 1: 12,400 × 10/100 = **1,240**
- Layer 2: (50,400 − 12,400) × 12/100 = 38,000 × 12/100 = **4,560**
- Layer 3: (60,000 − 50,400) × 22/100 = 9,600 × 22/100 = **2,112**
- Total: **7,912**

**Match:** yes

**Parameters:** all seven bracket starts and rates match `year2026.federalTax.brackets.single`.

**Tolerance:** exact — justified.

**Wrong readings (2):** 22% on all 60,000 → 13,200 ✓; wrong 12% top at 50,000 → 7,952 ✓.

**Claim consistency:** matches `bracketTax` partition logic.

**Family:** correct.

**Verdict:** approve

---

## 5. `federal-standard-deduction-age-65`

**Recomputation**
- Age addition: 1 × 2,050 = **2,050**
- Standard deduction: 16,100 + 2,050 = **18,150**

**Match:** yes

**Parameters:** basic 16,100; age-65 addition 2,050 — match pack.

**Tolerance:** exact — justified.

**Wrong readings (2):** omit addition → 16,100 ✓; OBBBA senior 6,000 → 22,100 ✓.

**Claim consistency:** matches `standardDeduction` + `age65StandardDeductionAddition`.

**Family:** correct.

**Verdict:** approve

---

## 6. `federal-taxable-social-security-tiers`

**Recomputation** (provisional income P = AGI excl. SS + ½×benefits; B = 20,000)

| Case | P | Formula | Result |
|---|---|---|---|
| Below base | 10,000 + 10,000 = 20,000 ≤ 25,000 | — | **0** |
| 50% tier | 30,000 | min(10,000, ½×(30,000−25,000)) = min(10,000, 2,500) | **2,500** |
| 85% tier | 40,000 | lower = min(10,000, ½×(34,000−25,000)) = 4,500; upper = 0.85×(40,000−34,000) = 5,100; min(17,000, 4,500+5,100) | **9,600** |

**Match:** yes (all three cases)

**Parameters:** tier starts 25,000 / 34,000 — match `year2026.ssBenefitTaxation`.

**Tolerance:** exact — justified.

**Wrong readings (2):** omit ½ benefits → 0, 0, 2,500 ✓; 85% of (P−first threshold) → 12,750 ✓.

**Claim consistency:** provisional-income definition and tier caps match `taxableSocialSecurity` doc comment and pack thresholds.

**Family:** correct.

**Verdict:** approve

---

## 7. `aca-400-percent-cliff`

**Recomputation**
- FPL (2-person contiguous): 15,650 + 5,500 = **21,150**
- **At cliff** (MAGI 84,600): 84,600/21,150×100 = **400%**; overCliff = false
  - Rate at 400%: **9.96%**; contribution = 84,600 × 9.96/100 = **8,426.16**
  - Credit = min(10,000, 12,000 − 8,426.16) = **3,573.84**
- **Above cliff** (MAGI 84,601): 84,601/21,150×100 = **400.004728132388…%**; overCliff = true; credit **0**; net premium **10,000**

**Match:** yes

**Parameters:** FPL basis, maxFplPctForCredit = 400, 9.96% at 400% breakpoint — all match pack.

**Tolerance:** $0.005 / 1e-9 / exact booleans — justified.

**Wrong readings (2):** exclusive ceiling → $0 at cliff ✓; continue 9.96% above → credit ≈ 3,573.7404 ✓.

**Claim consistency:** `overCliff` true only **above** 400% matches `AcaResult` comment; restored cliff matches pack header.

**Family:** correct (feeds PTC, net premium, healthcare spend families).

**Verdict:** approve

---

## 8. `aca-allowable-premium-tax-credit`

**Recomputation**
- Preliminary: max(0, 12,000 − 2,791.80) = **9,208.20**
- Capped: min(10,000, 9,208.20) = **9,208.20**

**Match:** yes

**Parameters:** contribution 2,791.80 cross-validated in worksheet 9.

**Tolerance:** $0.005 — justified.

**Wrong readings (2):** subtract enrollment not SLCSP → 7,208.20 ✓; negative without floor ✓.

**Claim consistency:** P = min(E, max(0, S−C)) matches signature.

**Family:** correct.

**Verdict:** approve

---

## 9. `aca-economic-net-premium`

**Recomputation**
- max(0, 10,000 − 9,208.20) = **791.80**

**Match:** yes

**Parameters:** none quoted beyond cross-worksheet credit.

**Tolerance:** $0.005 — justified.

**Wrong readings (2):** subtract from SLCSP → 2,791.80 ✓; reversed subtraction floored → 0 ✓.

**Claim consistency:** max(0, E−P) matches module contract.

**Family:** correct.

**Verdict:** approve

---

## 10. `aca-expected-contribution`

**Recomputation**
- FPL: 15,650 + (2−1)×5,500 = **21,150**
- FPL%: 42,300/21,150×100 = **200%**
- Contribution: 42,300 × 6.60/100 = **2,791.80**

**Match:** yes

**Parameters:** FPL amounts and 200% breakpoint rate 6.60 — match pack.

**Tolerance:** exact FPL/FPL%; $0.005 on contribution — justified.

**Wrong readings (2):** first-person-only FPL → ~270.29% ✓; 6.60 as fraction → 279,180 ✓.

**Claim consistency:** piecewise schedule with 133% step noted in pack; this case lands exactly on 200% breakpoint.

**Family:** correct.

**Verdict:** approve

---

## 11. `aca-household-magi-composition`

**Recomputation**
- Nontaxable SS: 20,000 − 5,000 = **15,000**
- Required-filer dependent MAGI: **3,000** (4,000 excluded)
- MAGI: 50,000 + 15,000 + 1,000 + 2,000 + 3,000 = **71,000**

**Match:** yes

**Parameters:** none from pack (synthetic inputs).

**Tolerance:** exact — justified.

**Wrong readings (2):** gross SS without subtract → 76,000 ✓; include non-required → 75,000 ✓.

**Claim consistency:** component sum matches `buildAcaHouseholdMagi` interface; addbacks are ACA-only per comment.

**Family:** outputs `magi-annual`; feeds PTC/net-premium families — correct.

**Verdict:** approve

---

## 12. `medicare-base-part-b-premium`

**Recomputation**
- Part B annual: 202.90 × 12 = **2,434.80**
- Part D IRMAA surcharge: **0**; IRMAA surcharge: **0** (tier 0)

**Match:** yes

**Parameters:** `partBStandardMonthly` = 202.9 — matches pack (202.90).

**Tolerance:** $0.005 on Part B product; exact zeros — justified.

**Wrong readings (2):** monthly treated as annual → 202.90 ✓; add Part D OOP threshold 2,100 → 4,534.80 ✓.

**Claim consistency:** tier-0 annualization matches `medicareAnnualPremiumPerPerson`.

**Family:** correct.

**Verdict:** approve

---

## 13. `medicare-irmaa-first-tier-boundary`

**Recomputation**

| Lookback MAGI | Tier | Part B/mo | Part B annual | Part D annual | IRMAA surcharge annual |
|---|---:|---:|---:|---:|---:|
| 109,000 | 0 | 202.90 | 2,434.80 | 0 | 0 |
| 109,001 | 1 | 202.90×35/25 = 284.06 | 3,408.72 | 14.50×12 = 174.00 | (284.06−202.90)×12 + 174 = 1,147.92 |

**Match:** yes

**Parameters:** magiOver 109,000; applicablePct 35; Part D surcharge 14.50; standard 202.90 — all match first `irmaaTiers` entry.

**Tolerance:** $0.005; exact tiers — justified.

**Wrong readings (2):** `>=` at 109,000 → tier-1 totals ✓; 35% surcharge misread → 273.915/mo ✓.

**Claim consistency:** strict `>` boundary and Part B = standard×applicablePct/25 match `IrmaaTier` contract.

**Family:** correct.

**Verdict:** approve

---

## 14. `medicare-irmaa-two-year-lookback`

**Recomputation**
- Lookback year: 2026 − 2 = **2024**
- Selected MAGI: **109,001** (2025 and 2026 MAGI ignored)
- 109,001 > 109,000 → tier **1**

**Match:** yes

**Parameters:** first-tier magiOver.single = 109,000 — matches pack.

**Tolerance:** exact years/tier/whole-dollar MAGI — justified.

**Wrong readings (2):** 2025 MAGI 0 → tier 0 ✓; 2026 MAGI 0 → tier 0 ✓.

**Claim consistency:** `magiTwoYearsPrior` input and two-year comment match signature.

**Family:** feeds premium/surcharge families; no direct output — correct for a timing selector.

**Verdict:** approve

---

## 15. `rmd-applicable-age-attain-year`

**Recomputation**
- Cohort 1951–1958 → applicable age **73**
- Attain year: 1955 + 73 = **2028**
- RBD: April 1, **2029** (year after attain year)

**Match:** yes

**Parameters:** cohort rule matches `applicableAge.ts` header in extract.

**Tolerance:** exact — justified.

**Wrong readings (2):** age 72 → 2027 / 2028-04-01 ✓; age 75 → 2030 / 2031-04-01 ✓.

**Claim consistency:** attain-year and RBD rules match extract comments.

**Family:** feeds `rmd-required-annual` — correct.

**Verdict:** approve

---

## 16. `rmd-joint-life-divisor`

**Recomputation**
- Eligibility: 75 − 60 = 15 > 10 ✓
- Divisor: TABLE_II[75][60] = **28.3** (extract column index 60)
- RMD: 246,000 ÷ 28.3 = **8,692.57950530035…** → cents **8,692.58**

**Match:** yes

**Parameters:** divisor 28.3 confirmed in extract table.

**Tolerance:** $0.005 on cents — justified.

**Wrong readings (2):** Uniform 24.6 → 10,000 ✓; “at least ten” misread — qualitative ✓.

**Claim consistency:** more-than-ten-years-younger spouse rule matches module comment.

**Family:** outputs `rmd-required-annual` — correct.

**Verdict:** approve

---

## 17. `rmd-shortfall-excise-default`

**Recomputation**
- Shortfall: max(0, 10,000 − 4,000) = **6,000**
- Excise: 6,000 × 0.25 = **1,500**; reason `default25Percent`

**Match:** yes

**Parameters:** `RMD_SHORTFALL_DEFAULT_RATE` = 0.25 — matches extract.

**Tolerance:** exact — justified.

**Wrong readings (2):** 10% without correction → 600 ✓; 25% on full requirement → 2,500 ✓.

**Claim consistency:** matches `computeRmdShortfallExcise` pricing-only contract.

**Family:** feeds `tax-penalties-annual` — correct.

**Verdict:** approve

---

## 18. `rmd-uniform-lifetime-divisor`

**Recomputation**
- Divisor at age 75: **24.6**
- RMD: 246,000 ÷ 24.6 = **10,000** exactly

**Match:** yes

**Parameters:** `year2026.rmd.uniformLifetimeTable[75]` = 24.6 — matches pack.

**Tolerance:** exact — justified (exact multiple).

**Wrong readings (2):** age-74 divisor 25.5 → 9,647.058823… ✓; wrong balance 240,000 → 9,756.097561… ✓.

**Claim consistency:** prior-year-end balance ÷ uniform divisor matches signature.

**Family:** correct.

**Verdict:** approve

---

## 19. `delayed-retirement-credit-factor`

**Recomputation**
- Credited months: min(24, 36) = **24**
- Credit: 24 × 2/(3×100) = 48/300 = **4/25 = 16%**
- Factor: 1 + 4/25 = **29/25 = 1.16**

**Match:** yes

**Parameters:** 2/3 of 1% per month; cap through age 70 — match `delayedRetirementFactor` comment.

**Tolerance:** 1e-12 — justified for short rational chain.

**Wrong readings (2):** 2/3 as fraction → factor 17 ✓; early-claim rates → wrong ✓.

**Claim consistency:** matches signature and DRC convention.

**Family:** correct.

**Verdict:** approve

---

## 20. `early-claim-factor`

**Recomputation**
- First 36 months: 36 × 5/(9×100) = **1/5 = 20%**
- Additional 24 months: 24 × 5/(12×100) = **1/10 = 10%**
- Factor: 1 − 1/5 − 1/10 = **7/10 = 0.70**

**Match:** yes

**Parameters:** 5/9 and 5/12 of 1% per month — match comment.

**Tolerance:** 1e-12 — justified.

**Wrong readings (2):** 5/9 for all 60 → 2/3 ✓; 5.9%/mo → below zero ✓.

**Claim consistency:** two-band early reduction matches `earlyRetirementFactor`.

**Family:** correct.

**Verdict:** approve

---

## 21. `normal-retirement-age`

**Recomputation**
- Effective birth year 2026 (>2025) → FRA **67 years, 0 months**
- Total months: 67×12 + 0 = **804**

**Match:** yes

**Parameters:** endpoint convention matches `fraForBirthYear` comment.

**Tolerance:** exact — justified.

**Wrong readings (2):** survivor FRA cap → 800 months ✓; extraMonths-as-years — qualitative ✓.

**Claim consistency:** matches `fraForBirthYear` / `fraTotalMonths`.

**Family:** correct.

**Verdict:** approve

---

## 22. `survivor-benefit-rib-lim`

**Recomputation**
- RIB-LIM base: max(1,400, 0.825×2,000) = max(1,400, 1,650) = **1,650**
- At age 60 (720 mo): reduction factor = 1 − 0.285 = **0.715**
- Monthly benefit: 1,650 × 0.715 = **1,179.75**

**Match:** yes

**Parameters:** WIDOW_LIMIT 0.825, SURVIVOR_MAX_REDUCTION 0.285, earliest age 60 — match extract constants.

**Tolerance:** $0.005 — justified.

**Wrong readings (2):** skip RIB-LIM → 1,400×0.715 = 1,001.00 ✓; worker FRA 67 — qualitative ✓.

**Claim consistency:** RIB-LIM floor and 71.5% at age 60 match `survivorBenefitMonthly` / `survivorReductionFactor` comments.

**Family:** correct.

**Verdict:** approve

---

## 23. `sepp-active-annual-rule`

**Recomputation** (longer of 5 years or age-60 boundary; inactive once **both** satisfied)
- Age 59: elapsed 59−55 = 4 < 5; age < 60 → **active = true**
- Age 60: elapsed 5 ≥ 5; age ≥ 60 → **active = false**

**Match:** yes

**Parameters:** duration 5; penalty boundary 60 — match `seppActive` comment.

**Tolerance:** exact booleans — justified.

**Wrong readings (2):** count start year as completed → ends at 59 ✓; five years only from age 50 → ends at 55 ✓.

**Claim consistency:** annual granularity and age-60 approximation match extract.

**Family:** feeds `sepp-distribution-annual` — correct.

**Verdict:** approve

---

## 24. `sepp-amortization-method`

**Recomputation**
- r = 5/100 = 1/20; n = 31.6 (from `singleLifeTable[55]`)
- (1.05)^(−31.6) ≈ 0.214005597 → denominator ≈ 0.785994403
- Payment = 316,000 × 0.05 / 0.785994403 ≈ **20,102.178874**
- Published cents should be **20,102.18**, not 20,101.84

**Match:** **no** — worksheet claims 20,101.836318… / **20,101.84**; independent recomputation yields **~20,102.18** (Δ ≈ **$0.34** on published cents, far above $0.005 tolerance). Reverse-check: 20,101.836 × annuity factor ≠ 316,000 within cents; 20,102.179 does.

**Parameters:** rate 5 (`SEPP_AMORTIZATION_RATE_PCT`); term 31.6 — match pack.

**Tolerance:** $0.005 would be appropriate for float exponentiation, but the stated expected value is wrong.

**Wrong readings (2):** B/n = 10,000 ✓; varying later-year balance — qualitative ✓.

**Claim consistency:** formula matches `seppAnnualAmount` amortization contract and Single Life term.

**Family:** outputs `sepp-distribution-annual` — correct.

**Verdict:** **reject** — Expected unrounded and published cents both incorrect for the stated inputs and formula.

---

## 25. `sepp-rmd-method`

**Recomputation**
- Divisor at age 55: **31.6**
- Payment: 316,000 ÷ 31.6 = **10,000**

**Match:** yes

**Parameters:** `singleLifeTable[55]` = 31.6 — matches pack.

**Tolerance:** exact — justified.

**Wrong readings (2):** Uniform table (no age-55 entry) ✓; treat as fixed ✓.

**Claim consistency:** B/d with current balance matches RMD-method comment.

**Family:** correct.

**Verdict:** approve

---

## Summary Table

| id | match | verdict |
|---|---|---|
| capital-loss-carryforward-netting | yes | approve with a note |
| federal-amt-screen | yes | approve |
| federal-ltcg-stacking | yes | approve |
| federal-ordinary-bracket-tax | yes | approve |
| federal-standard-deduction-age-65 | yes | approve |
| federal-taxable-social-security-tiers | yes | approve |
| aca-400-percent-cliff | yes | approve |
| aca-allowable-premium-tax-credit | yes | approve |
| aca-economic-net-premium | yes | approve |
| aca-expected-contribution | yes | approve |
| aca-household-magi-composition | yes | approve |
| medicare-base-part-b-premium | yes | approve |
| medicare-irmaa-first-tier-boundary | yes | approve |
| medicare-irmaa-two-year-lookback | yes | approve |
| rmd-applicable-age-attain-year | yes | approve |
| rmd-joint-life-divisor | yes | approve |
| rmd-shortfall-excise-default | yes | approve |
| rmd-uniform-lifetime-divisor | yes | approve |
| delayed-retirement-credit-factor | yes | approve |
| early-claim-factor | yes | approve |
| normal-retirement-age | yes | approve |
| survivor-benefit-rib-lim | yes | approve |
| sepp-active-annual-rule | yes | approve |
| sepp-amortization-method | **no** | **reject** |
| sepp-rmd-method | yes | approve |

**24 of 25** worksheets match independent recomputation. **1 reject** (`sepp-amortization-method`: payment should be ~$20,102.18, not $20,101.84). **1 note** (`capital-loss-carryforward-netting`: `feeds` should not list `tax-realized-gains-annual`).

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Orchestrator note, 2026-09-18

The one rejection, sepp-amortization-method, was checked by script before being accepted or refused. The worksheet computes the amortization payment `316000 × 0.05 / (1 − 1.05^(−31.6))`. The reviewer's recomputation used `1.05^(−31.6) ≈ 0.214005597` and obtained `≈ 20,102.18`; the power is `0.214002156319...`, and the payment is `20,101.8363180299...`, which is the worksheet's figure to every stated digit. The reverse check the reviewer cited decides it the same way: `20101.836318 × (1 − 1.05^(−31.6)) / 0.05 = 316000.0000`, while the reviewer's `20102.178874` returns `316005.3850`. Command and output:

```
node -e "const B=316000,r=0.05,n=31.6;const A=B*r/(1-Math.pow(1+r,-n));console.log(A.toFixed(10),Math.pow(1+r,-n).toFixed(12),(20101.836318*(1-Math.pow(1+r,-n))/r).toFixed(4),(20102.178874*(1-Math.pow(1+r,-n))/r).toFixed(4))"
20101.8363180299 0.214002156319 316000.0000 316005.3850
```

The worksheet stands unchanged; its provenance says the recomputation was the orchestrator's by script, as the rng-derived-path-seed worksheet's does after the same kind of slip on 2026-09-18. The reviewer's parameter, tolerance, wrong-reading and family checks on that worksheet were right and are kept. The note on capital-loss-carryforward-netting (feeds named an input family) was applied: `tax-realized-gains-annual` is read, not fed, and was removed from feeds.
