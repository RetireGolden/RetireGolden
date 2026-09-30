## Claim

Kind: formula. `socialSecurity/disability.ts#ssdiFirstPayableMonthIndex` places the first month a disability benefit is payable: in the onset year (birth year plus `disability.onsetAge`), the sixth month after `disability.onsetMonth`, read as an onset after the 1st, or June for a blank month, read as January 1. `#ssdiSchedule` pairs it with the month the worker attains full retirement age (FRA) and returns no schedule when the first payable month is at or after that month. `#ssdiMonthsInYear` counts a year's disability months (first payable month to the month before FRA) and converted retirement months (FRA month on), and `projection/internal/annualSocialSecurity.ts#annualSocialSecurity` pays the PIA for both and publishes the disability months alone as `ssdiPaid`. With no schedule the stream is priced as a retirement claim at its claim age, and the projection warns.

New 2026-09-27 (decision D-APPROX-FACTS, revisited). Until then the engine paid twelve months from the onset-age year, with no waiting period, and switched the published source at the FRA year.

## Justification

42 U.S.C. 423(a)(1): a disabled worker is entitled "(i) for each month beginning with the first month after his waiting period (as defined in subsection (c)(2))", "and ending with the month preceding whichever of the following months is the earliest: the month in which he dies, the month in which he attains retirement age".

42 U.S.C. 423(c)(2): the waiting period is "the earliest period of five consecutive calendar months- (A) throughout which the individual with respect to whom such application is filed has been under a disability". SSA POMS DI 10105.070 (agency guidance) says when a month counts: "The NH has been under a disability for the entire month; i.e., the date of onset is on or before the first day of the month". So an onset after the 1st of month \(M\) makes \(M+1\) to \(M+5\) the waiting period and \(M+6\) the first payable month; an onset on the 1st makes \(M\) to \(M+4\) the waiting period and \(M+5\) the first payable month. January 1 is the earliest start an onset year allows, with June the first payable month.

20 CFR 404.316(b)(2): entitlement ends with "The month before the month you attain full retirement age as defined in § 404.409 (at full retirement age your disability benefits will be automatically changed to old-age benefits)"; 42 U.S.C. 402(a)(3) entitles to the old-age benefit a worker who "was entitled to disability insurance benefits for the month preceding the month in which he attained retirement age". A person attains an age on the day before the birthday (20 CFR 404.409). When the first payable month would be the FRA month or later, entitlement never begins and the worker's ordinary retirement claim governs.

With month indexes \(12\,\text{year}+(\text{month}-1)\), birth year \(b\), onset age \(a\), onset month \(m\), first payable month \(E\) and FRA month \(F\):

\(E = 12(b+a) + (m-1) + 6\), or \(12(b+a) + 5\) for a blank month; no schedule when \(E \ge F\);

\(\text{disability}(Y) = \max(0, \min(F, 12Y+12) - \max(E, 12Y))\), \(\text{retirement}(Y) = \max(0, 12Y+12 - \max(F, 12Y))\).

## Inputs

| Case | Worker | Onset | Claim age | Projection |
|---|---|---|---|---|
| Onset table | single, born 1970-06-15 (FRA 67, attained June 2037), PIA 2,000 a month, no COLA (inflation 0) | onsetAge 60 (2030), months below, after the 1st | 62 (ignored on the disability path) | starts 2026 |
| FRA edge, November | as above | onsetAge 66 (2036), November | 70 | starts 2026 |
| FRA edge, December | as above | onsetAge 66 (2036), December | 70 | starts 2026 |
| FRA-year split | as above | onsetAge 60, March | 62 | starts 2026 |

## Arithmetic

Onset table, \(b + a = 2030\), \(F = \) June 2037:

| Onset month | Waiting months | First paid | 2030 | 2031 |
|---|---|---|---:|---:|
| Blank (January 1) | Jan to May 2030 | Jun 2030 | 7 × 2,000 = 14,000 | 24,000 |
| January | Feb to Jun 2030 | Jul 2030 | 6 × 2,000 = 12,000 | 24,000 |
| March | Apr to Aug 2030 | Sep 2030 | 4 × 2,000 = 8,000 | 24,000 |
| June | Jul to Nov 2030 | Dec 2030 | 1 × 2,000 = 2,000 | 24,000 |
| July | Aug to Dec 2030 | Jan 2031 | 0 | 24,000 |
| October | Nov 2030 to Mar 2031 | Apr 2031 | 0 | 9 × 2,000 = 18,000 |
| December | Jan to May 2031 | Jun 2031 | 0 | 7 × 2,000 = 14,000 |

The engine before 2026-09-27 paid 24,000 in both years for every row: 5 to 17 months more than the statute allows.

FRA edge, November 2036: waiting December 2036 to April 2037, May 2037 is the one disability month, and from June the converted benefit: 2037 pays \(8 \times 2{,}000 = 16{,}000\), of which 2,000 is SSDI.

FRA edge, December 2036: the first payable month would be June 2037, the FRA month itself, so there is no disability benefit and the claim at 70 governs: nothing in 2037 to 2039. In 2040 the engine's claim-year convention (social-security-payable-months) pays 12 months at the delayed-credit factor 1.24: \(12 \times 2{,}000 \times 1.24 = 29{,}760\). By statute the worker attains 70 on June 14, 2040 and is paid June to December: \(7 \times 2{,}480 = 17{,}360\). 29,760 is the engine's modeled value, not the statute's. An onset on December 1, 2036 would have had December as its first waiting month, May 2037 as its one disability month and 16,000 in 2037 (the month-only limit at the FRA edge).

FRA-year split, March 2030 onset: 2037 pays January to May as disability (\(5 \times 2{,}000 = 10{,}000\) of `ssdiPaid`) and June to December as the converted benefit, 24,000 in all; 2038 pays 24,000 with no SSDI.

## Expected

| Case | Before (engine to 2026-09-26) | After |
|---|---:|---:|
| Blank, 2030 | 24,000 | **14,000** |
| January, 2030 | 24,000 | **12,000** |
| March, 2030 | 24,000 | **8,000** |
| June, 2030 | 24,000 | **2,000** |
| July, 2030 | 24,000 | **0** |
| October, 2031 | 24,000 | **18,000** |
| December, 2031 | 24,000 | **14,000** |
| November 2036 onset, 2037 | 24,000 | **16,000** |
| November 2036 onset, 2037 SSDI | 24,000 | **2,000** |
| December 2036 onset, 2037 | 24,000 | **0** |
| December 2036 onset, 2040 (engine claim-year convention) | 24,000 | **29,760** |
| March onset, 2037 SSDI | 24,000 | **10,000** |
| March onset, 2038 SSDI | 24,000 | **0** |

`YearResult.incomes.socialSecurity` for the years named, and `YearResult.ssdiPaid` for the SSDI rows. Fixture tolerance: absolute $0.005.

## Wrong readings

- No waiting period (the engine before 2026-09-27): 24,000 in the onset year for every month.
- The month read as an onset on the 1st: first payable \(M+5\), so March pays 10,000 in 2030 and a December 2036 onset pays 16,000 in 2037; exact only for an onset on the 1st.
- A blank month read as a full year (the derivation's first specification): 24,000 in 2030, more than any onset date allows.
- Disability to the end of the FRA year: `ssdiPaid` of 24,000 in 2037 and after, where the months from June are the old-age benefit.
- The statute's 17,360 for 2040 where the engine pays 29,760: the claim-year convention, recorded as the social-security-payable-months limit, not this record's.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

The design and the worked cases are the D-APPROX-FACTS derivation's (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/approx-facts-derivation.md`, section 4), and every cell of the onset table, both FRA edges and the 29,760 label were confirmed by its independent check (`evidence/approx-facts-check.md`, S1 to S5 and S8) from a month-by-month enumeration of 423 written by the checker; the check's correction 5 (29,760 is the engine's convention, 17,360 the statute's) and correction 7 (split the FRA year in `ssdiPaid`) are applied here. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
