## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` publishes the calendar-year attained age in the first ledger row whose published end-of-year investable total, discretely deflated to the projection start year, is greater than or equal to the upstream FI number; it publishes `null` if no row crosses or the ledger is empty.

## Justification

Walk ledger rows in their given order and compute `realInvestable_y=investableTotal_y/(1+inflationPct/100)^(y-startYear)`. The first inclusive crossing of the start-year-dollar `fiNumber` sets `fiYear=y` and `fiAge=y-birthYear`, where `birthYear` is the first person's ISO birth year or 1980 when absent. The published `investableTotal` must be used directly: it already comprises the stated physical balance rows and unassigned cash while excluding property, insurance cash value and TIPS-ladder principal. The valid domain requires a positive inflation base.

## Inputs

| Year | Published nominal end-of-year investable total | Deflated investable at 3% | Unit |
|---|---:|---:|---|
| 2026 | 900,000 | 900,000 | dollars |
| 2027 | 1,030,000 | 1,000,000 | dollars |
| 2028 | 1,166,990 | 1,100,000 | dollars |

Projection start year is 2026; the first person's date of birth is `1980-12-31`, so `birthYear=1980`; general inflation is 3%; and upstream `fiNumber=$1,000,000` in 2026 dollars. The final row is a later above-threshold sentinel (`$1,166,990/1.03^2=$1,100,000`) and does not replace the first crossing.

## Arithmetic

For 2026, `$900,000/1.03^0=$900,000<$1,000,000`. For 2027, `$1,030,000/1.03^1=$1,000,000`, which crosses inclusively. Thus `fiYear=2027` and `fiAge=2027-1980=47`; the December birthday does not postpone calendar-year attained age.

## Expected

FI year is exactly integer `2027` and FI age is exactly integer `47`. Equality at the threshold must count. A second case with an empty ledger expects exactly `fiYear=null` and `fiAge=null`.

## Wrong readings

- A strict `>` crossing skips 2027 even though equality qualifies.
- Computing age on the birthday would treat part of 2027 as age 46; the contract uses calendar-year attained age `year-birthYear`.
- Re-summing account categories instead of reading published `investableTotal` can omit equity compensation or unassigned cash or include excluded assets.
- Comparing nominal `$1,030,000` directly with a start-year-dollar target mixes bases.
- An empty or never-crossing ledger does not produce age zero, the last age, or an estimate; it produces `null`.

## Family

outputs: `projection-summary-fi-age`.

feeds: none. This quantity reads `projection-summary-fi-number` and `accounts-investable-total-annual` (its Inputs); it does not feed them.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract with the 2026-09-18 doc-comment contracts, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.

Revision: The Family section had listed under feeds the families this quantity reads; corrected on the pull-request review's finding (#720) so feeds names only the families this quantity feeds, and the families it reads stay in Inputs.
