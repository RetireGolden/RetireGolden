## Claim

Kind: data. `montecarlo/run.ts#runMonteCarloPaths` draws each path's death ages (stochastic longevity) and then its care events (care shocks) person by person in the canonical order of `model/peopleOrder.ts#canonicalPeopleOrder`: date of birth ascending (the older first), then sex in the written order female, male, average (`CANONICAL_SEX_ORDER`), then id by ordinal comparison. The sampled care events join the plan's in that order (decision D-PEOPLE-ORDER, rule R5).

## Justification

A path's people take their random numbers from one stream, one after another, and a care event takes a variable number of draws. Whichever person draws first changes every later number, so listing the same household the other way round drew a different path: measured at 1,000 paths on the library's couples, up to 1.5 points of success rate with longevity on and 346 to 984 paths changed. Each order is an equally valid sample, so the only requirement is that the order is fixed and does not come from the list. A birth date decides almost every household; the sex order is written out rather than taken from a locale's collation, and the id is left as the last tie-break, so renaming ids can move a path only when two people share a birth date and a sex.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Household A, as listed | Lee (1966-04-10, female), Ray (1959-09-02, male) | people |
| Household B, as listed | a (1960-01-01, male), z (1960-01-01, female) | people |
| Household C, as listed | a (1960-01-01, male), B (1960-01-01, male) | people |

## Arithmetic

A: 1959-09-02 is before 1966-04-10, so Ray draws first, then Lee.

B: the birth dates are equal; female is first in [female, male, average], so z draws first, then a.

C: birth dates and sexes are equal; by UTF-16 code unit "B" (66) is before "a" (97), so B draws first, then a. A locale comparison would put a first.

## Expected

| Quantity | Value |
|---|---:|
| Household A draw order | Ray, Lee |
| Household B draw order | z, a |
| Household C draw order | B, a |

Exact.

## Wrong readings

- Drawing in list order: Lee before Ray, and reversing the list changes the path.
- Comparing sex with `localeCompare`: average, female, male, which the written order is not.
- Comparing ids with a locale: a before B.

## Family

outputs: none.

feeds: `monte-carlo-success-rate`; `monte-carlo-investable-fan-percentiles`; `monte-carlo-ending-investable-histogram`; `monte-carlo-ending-after-tax-estate-percentiles`; `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from decision D-PEOPLE-ORDER (decisions-2026-09-25.md) and the independent check's rule R5 (evidence/people-order-check.md). Implemented by the same session. Reviewed by: unreviewed.
