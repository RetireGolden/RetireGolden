## Claim

Kind: data. `socialSecurity/nra.ts#fraForBirthYear; #fraTotalMonths` assigns effective birth years after 2025 a normal retirement age of 67 years 0 months, or 804 total month slots.

## Justification

The extract explicitly states the endpoint convention: years after 2025 use 67+0 under current law. Total month slots are twelve times completed years plus extra months.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Effective birth year | 2026 | calendar year |
| FRA endpoint | 67 years, 0 months | age |

The endpoint is the dataset stated in the `fraForBirthYear` comment.

## Arithmetic

FRA total months: `67 × 12 + 0 = 804`.

## Expected

Exact derived and published FRA: `{years: 67, extraMonths: 0}` and `804` total months; fixture tolerance: exact integers.

## Wrong readings

- Using the survivor-FRA cap produces 66 years 8 months, or `800` months.
- Treating `extraMonths` as years produces an invalid interpretation even though this endpoint happens to use zero.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
