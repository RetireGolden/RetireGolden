## Claim

Kind: formula. `projection/internal/annualSocialSecurity.ts#annualSocialSecurityPayableMonths` returns 0 before the claim year, 12 after it, and `max(0, 12 - claimAge.months)` when `ageAttained` equals `claimAge.years`; there is no calendar payment lag.

## Justification

The comment defines an annual-ledger approximation in age-year coordinates. The claim-age month is excluded, so a claim at 65 years 4 months pays eight modeled months in the age-65 year.

## Inputs

| Case | Age attained | Claim age | Unit |
|---|---:|---:|---|
| Before claim year | 64 | 65y4m | years/months |
| Claim year | 65 | 65y4m | years/months |
| After claim year | 66 | 65y4m | years/months |

The three branches and no-lag convention are stated in the symbol comment.

## Arithmetic

Before: `64 < 65`, so `0`.

Claim year: `max(0, 12 - 4) = 8`.

After: `66 > 65`, so `12`.

## Expected

Exact derived payable months: before `0`, claim year `8`, after `12`. Fixture tolerance: exact integer equality, because the output counts modeled months.

## Wrong readings

- Including the claim month produces 9 months in the claim year.
- Treating the claim as an anniversary-year fraction produces 7 or 8 months depending on a birth month that this helper does not accept.
- Adding an administrative payment lag produces fewer than 8 months, contrary to the explicit no-lag convention.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.
