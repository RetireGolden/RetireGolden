## Claim

Kind: composition. `socialSecurity/piaFromEarnings.ts#resolveStreamPiaMonthly` resolves a Social Security stream's monthly PIA once, for the ledger (`projection/simulate.ts#simulatePlan`), the claim-milestone insight and the planner's Social Security pages: the entered PIA as entered; or the PIA the earnings history gives (`computePiaFromEarnings`, with the stream's earnings projection defaulting to the person's retirement age, `#streamPiaFromEarningsInput`) raised by every cost-of-living increase from the eligibility year through the year before the projection starts (`pia-cost-of-living-since-eligibility`); or no PIA, with the reason (no PIA and no earnings history, or the history's error). The couple primer on the Social Security analysis page prints each spouse's resolved PIA × 12 as the full-retirement-age benefit, "$X/yr".

New 2026-09-27 (B2-P1 slice 4). The resolution existed three times, in the ledger, the insight and planner-ui's `ssAnalysis.ts#resolvePia`, which agreed; the primer's label called PIA × 12 "the higher benefit", although a claim at 70 pays 124% of it.

## Justification

The primary insurance amount is the monthly benefit at full retirement age, 42 U.S.C. 415(a) and 20 CFR 404.409 ("the age at which you may receive unreduced old-age ... benefits"); what a person is paid depends on the claim age. 42 U.S.C. 415(i)(2)(A)(iii) raises the PIA of a person eligible in a year with an increase "by the amount of that increase and subsequent applicable increases", whatever the time of entitlement. The × 12 is a unit conversion the page keeps.

## Inputs

| Case | Stream | Person | Start |
|---|---|---|---:|
| E | entered PIA 2,500 | any | 2026 |
| H | earnings $50,000 each year 1982-2021, no projection | born 1960-05-01, retirement age none | 2026 |
| N | no PIA, no earnings history | any | 2026 |
| R | no PIA; earnings $30,000 in 1970 | born 1915-03-01 | 2026 |

## Arithmetic

**H.** The history gives an AIME of 8,022 and a PIA of 2,846.40 for 2022, the year he turns 62. The increases of 2022 to 2025 (8.7, 3.2, 2.5 and 2.8 percent), each floored to the dime: 2,846.40 × 1.087 = 3,094.03 → 3,094.00; × 1.032 = 3,193.01 → 3,193.00; × 1.025 = 3,272.83 → 3,272.80; × 1.028 = 3,364.44 → 3,364.40.

**R.** Eligibility in 1977, before the formula this engine computes: the earnings computation refuses it (eligibility before 1979), so the stream has no PIA and the ledger skips it with a warning.

## Expected

| Case | Status | PIA |
|---|---|---:|
| E | entered | 2,500 |
| H | from earnings | 3,364.4 |
| H eligibility-year PIA | from earnings | 2,846.4 |
| N | no PIA and no earnings | |
| R | earnings error | |

Tolerance: exact to the dime. With no cost-of-living increase after the start (inflation 0), the ledger's Social Security for case H claiming at 67 in 2027 is 12 × 3,364.40 = 40,372.80, the resolved PIA, and the couple primer prints the resolved PIAs of the seven example couples unchanged (for example $35k and $23k for the example-couple plan).

## Wrong readings

- The eligibility-year PIA without the increases since: H 2,846.40.
- The claimed benefit as the primer's figure: the example-couple plan's higher earner claims at 70, so 43,152 a year ($43k), not the PIA's $35k.

## Family

outputs: `social-security-pia-annualized`.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-pia-annualized.md`; independently checked (C9, and its finding P12, the increases since eligibility, fixed in the Social Security law change this slice sits on). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
