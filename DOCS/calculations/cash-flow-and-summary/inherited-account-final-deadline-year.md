## Claim

Kind: data. `strategies/inheritedIra.ts#classifyInheritedRegime` and `#InheritedRegimeClassification.finalDeadlineYear` publish the fixed final emptying year when a regime has one: death year + 10 for a non-eligible designated beneficiary and a spouse's ten-year election, and birth year + 21 + 10 for an eligible designated minor child; a single-life regime has no fixed deadline. The minor-child formula is derived explicitly from the comment's stated `minorMajorityYear = birthYear + 21` and “majority+10” convention.

## Justification

The extract identifies ten-year rows as `deathYear+10`, identifies the minor child's deadline as majority plus ten years, defines majority year as birth year plus 21, and makes `finalDeadlineYear` optional when no deadline is fixed.

## Inputs

| Regime case | Owner death year | Beneficiary birth year | Convention | Unit |
|---|---:|---:|---|---|
| Non-eligible designated beneficiary | 2026 | not applicable | death year + 10 | calendar year |
| Minor-child eligible designated beneficiary | 2026 | 2010 | birth year + 21 + 10 | calendar year |
| Spouse ten-year election | 2026 | not applicable | death year + 10 | calendar year |
| Single-life regime | 2026 | not needed | no fixed deadline | calendar year or absent |

## Arithmetic

- Non-eligible designated beneficiary: `2026 + 10 = 2036`.
- Minor child: majority year `2010 + 21 = 2031`; deadline `2031 + 10 = 2041`.
- Spouse ten-year election: `2026 + 10 = 2036`.
- Single-life regime: no deadline calculation; `finalDeadlineYear` is absent.

## Expected

Exact published values: non-eligible designated beneficiary `2036`; minor-child eligible beneficiary `2041`; spouse ten-year election `2036`; single-life regime `finalDeadlineYear` absent. Fixture tolerance: exact, because these are integer calendar-year additions or absence.

## Wrong readings

- Applying death year + 10 to the minor child produces `2026 + 10 = 2036`, five years too early instead of `2041`.
- Adding only ten years to the minor's birth year produces `2020`, rather than first reaching majority in `2031` and then adding ten years.
- Giving the single-life regime a death-year-plus-ten deadline produces `2036`; the field is absent for that regime.

## Family

outputs: `inherited-account-final-deadline-year`.

feeds: `inherited-distribution-required-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the follow-up review section).
