## Claim

Kind: composition. `socialSecurity/piaFromEarnings.ts#zeroYearReplacementGain` re-runs `computePiaFromEarnings` on the same input with one base year's earnings replaced by a sample amount, the window, projection and indexing year unchanged, and publishes the replaced year, the amount, the PIA before and after (each floored to the dime, as the PIA is) and their difference. The replaced year is the latest base year whose earnings, reported or projected, are $0; there is no gain to show when no averaged year is $0 or the amount is not positive. `#zeroYearSampleEarnings` gives the sample the explainer uses: the projection's assumed earnings for its first projected year, or else the latest reported year's amount. Given the projection's first year, it also gives the gain in that year's dollars (`startYearGainMonthly`): each PIA raised by the cost-of-living increases from the eligibility year through the year before the start, as the resolved PIA the step shows is (`pia-cost-of-living-since-eligibility`), and the difference rounded to the dime. The Social Security step prints that gain: "Replacing your $0 year in YEAR with about $X of earnings would add $Y/mo." for a year from the start year on, and, for a year already past, "Had you earned about $X in YEAR, one of your $0 years, your benefit would be $Y/mo higher in START dollars."

Restated 2026-09-27 (the slice's independent review, F7): for a worker 62 or older every base year has passed, so the latest $0 year is a past one, and the gain was printed in eligibility-year dollars beside a PIA shown in the start year's; case O is the review's.

New 2026-09-27 (B2-P1 slice 4, owner decision R9: "recompute through the engine's benefit formula"). Until then planner-ui's `socialSecurity/explain.ts#replaceZeroYearGain` took the raw sample, uncapped and unindexed, over 12 × the computation years, at the bend rate of the current AIME, "a rough estimate at the current bend rate".

## Justification

42 U.S.C. 415(a)(1)(A): the PIA is 90, 32 and 15 percent of the AIME across the bend points, "rounded, if not a multiple of $0.10, to the next lower multiple of $0.10"; 415(b)(1)-(3): the AIME divides the indexed earnings of the benefit computation years by their months, each year's earnings first limited by the contribution and benefit base and indexed by the average wage index of the second year before eligibility, "the national average wage index ... for the computation base year" in the denominator, later years entering unindexed. `computePiaFromEarnings` implements these with its registered limits (`aime-covered-earnings-cap`, `pia-from-aime-bend-points`), so re-running it is the exact gain. The latest $0 year is replaced because an earlier one would be wage-indexed, describing earnings the worker cannot now go back and earn.

## Inputs

A worker born 1966-07-20: eligibility year 2028, base years 1988-2027, indexing year 2026 (a stand-in: the latest published average wage index, 69,846.57 for 2024), bend points for 2028 (a stand-in: 2026's 1,286 and 7,749).

| Case | History | Sample |
|---|---|---:|
| A | $60,000 each year 1995-2024 | 60,000 |
| B | as A | 300,000 |
| C | $300,000 each year 1995-2024 | 300,000 |
| N | $60,000 each year 1988-2024 | 60,000 |

Case O: a worker born 1958-06-15 (68 in 2026) with $50,000 each year 1985-2015, the sample 50,000 (the latest reported year), the projection starting in 2026: eligibility year 2020, base years 1980-2019, indexing year 2018.

## Arithmetic

**A.** 5 of the 35 averaged years are $0. AIME = floor(Σ indexed / 420) = 7,487; PIA = 0.9 × 1,286 + 0.32 × (7,487 − 1,286) = 3,141.72, floored to 3,141.70. The latest $0 year is 2027, after the indexing year, so unindexed; capped at the latest base, 184,500: AIME' = floor((Σ + 60,000)/420) = 7,630, PIA' = 1,157.40 + 0.32 × 6,344 = 3,187.48, floored to 3,187.40. Gain 45.70 (the retired estimate 60,000/420 × 0.32 = 45.71; both print $46).

**B.** The sample is capped at 184,500: AIME' = 7,926, across the second bend point: 1,157.40 + 0.32 × 6,463 + 0.15 × 177 = 3,252.11, floored to 3,252.10. Gain 110.40 (the retired estimate 300,000/420 × 0.32 = 228.57).

**C.** AIME 12,252, PIA 3,901.00; 2027 at 184,500: AIME' = 12,692, PIA' = 3,901.00 + 0.15 × 440 = 3,967.00. Gain 66.00 (the retired estimate 107.14).

**N.** No averaged year is $0 (the three $0 base years are dropped): no gain.

In A, B and C the eligibility year, 2028, is after the start year, so no increase applies and the gain in 2026 dollars is the gain.

**O.** The base years 1980-2019 hold 31 years of $50,000 and nine of $0; the latest $0 year is 2019, already past in 2026. Replacing it gives a PIA of 2,538.20 for 2020 against 2,520.30: 17.90. The increases of 2020 to 2025 (1.3, 5.9, 8.7, 3.2, 2.5 and 2.8 percent, each floored to the dime) raise 2,520.30 to 3,195.60, the PIA the step shows, and 2,538.20 to 3,218.10: 22.50 in 2026 dollars (17.90 × 3,195.60/2,520.30 = 22.70 would scale the gain rather than floor each PIA).

## Expected

| Case | Replaced year | piaBefore | piaAfter | gainMonthly | startYearGainMonthly (2026) |
|---|---:|---:|---:|---:|---:|
| A | 2027 | 3,141.7 | 3,187.4 | 45.7 | 45.7 |
| B | 2027 | 3,141.7 | 3,252.1 | 110.4 | 110.4 |
| C | 2027 | 3,901 | 3,967 | 66 | 66 |
| O | 2019 | 2,520.3 | 2,538.2 | 17.9 | 22.5 |

Tolerance: exact to the dime (1e−9 absolute). Case N has no gain, and neither does a sample of 0.

## Wrong readings

- The raw sample at the current tier (the retired estimate): B 228.57, C 107.14.
- Capping but not flooring: B 0.32 × 262 + 0.15 × 177.29 = 110.43.
- Indexing a year after the indexing year: none is indexed (415(b)(3)(B)).
- Replacing the earliest $0 year (1988): the sample would be capped at 1988's base of $45,000 and indexed by 69,846.57/19,334.04 to $162,568.
- The eligibility-year gain beside a start-year PIA (the slice's figure before the review): O 17.90 against 22.50.

## Family

outputs: `social-security-zero-year-replacement-gain`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-zero-year-replacement-gain.md` (by hand from the AIME and bend points; engine cross-check afterwards); independently checked (C8: 45.70, 110.40 and 66.00; its open question 6 kept the latest $0 year, named in the copy). Case N is new here, and case O is the slice review's (F7), by hand above and by the review's independent model (`ssmodel.py`, which imports nothing from the engine). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
