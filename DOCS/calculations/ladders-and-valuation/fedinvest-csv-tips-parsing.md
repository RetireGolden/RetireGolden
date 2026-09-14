## Claim

Kind: data. `ladder/fedInvest.ts#parseFedInvestCsv` parses no-header FedInvest CSV rows, retains TIPS, converts the rate decimal fraction to percent, converts `MM/DD/YYYY` to canonical ISO, and reads end-of-day price per `$100` face.

## Justification

Primary source: TreasuryDirect FedInvest security-price CSV, retrieval recorded 2026-09-14. The CSV columns are CUSIP, type, rate, maturity, call, buy, sell, end-of-day; the extract states FedInvest omits the TIPS inflation index ratio, so prices are reference checks only. Rights note: federal endpoint facts and a synthetic row are used; source reuse terms were not established.

## Inputs

| Synthetic CSV field | Value | Unit |
|---|---:|---|
| CUSIP/type | `912TEST01`, `TIPS` | text |
| Rate | 0.00125 | decimal fraction/year |
| Maturity | 01/15/2030 | civil date |
| End-of-day | 99.50 | dollars per $100 face |

## Arithmetic

Rate percent `=0.00125(100)=0.125%`. Date reorders month/day/year to `2030-01-15`. Price remains `99.50` per `$100`.

## Expected

One TIPS record with rate `0.125`, maturity `2030-01-15`, price `99.5`; exact strings and absolute float tolerance `1e-12`.

## Wrong readings

- Leaving rate as `0.00125` understates the displayed percent by 100x.
- Parsing the date as day/month yields invalid `2030-15-01`.

## Family

none yet — FedInvest reference prices are not an output family in the provisional census.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
