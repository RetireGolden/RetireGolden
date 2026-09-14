## Claim

Kind: model. `montecarlo/survival.ts#hazardForExpectancyMultiplier` selects by bisection a bounded positive hazard power `h` whose half-year-plus-survival-sum expectancy equals multiplier `m` times the SSA baseline; the identity input `m=1` implies `h=1` up to bisection tolerance.

## Justification

Adjusted annual survival is `p^h`; increasing `h` lowers every nontrivial survival factor and therefore remaining expectancy monotonically, permitting bisection. This calibrates a proportional-hazards model to a questionnaire multiplier; it does not validate the questionnaire factor or an individual's lifespan.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Age | 65 | years |
| Sex | male | category |
| Remaining-years multiplier `m` | 1 | ratio |
| SSA baseline | 17.48 | years |

## Arithmetic

At `h=1`, every adjusted survival is `p^1=p`. Rebuilding `E(1)=0.5+sum S(t)` from the derived `q(x)` values matches the baseline `17.48` within the `1e-6` absolute expectancy tolerance, rather than exactly, because the embedded SSA `e(x)` rows are rounded to two decimals. Consequently, the solver returns a root near `h=1` within the `1e-6` absolute hazard tolerance. The root would be exactly `h=1` only for an internally consistent table.

## Expected

Hazard power approximately `1`, absolute tolerance `1e-6`; adjusted expectancy approximately `17.48` years, absolute tolerance `1e-6`. These tolerances cover both finite bisection and reconstruction from rounded `e(x)` rows.

## Wrong readings

- Treating `m` itself as hazard happens to pass this identity case but for `m=0.8` would use `h=0.8`, which improves rather than worsens survival.
- Inverting the meaning (`h<1` is worse health) also passes identity but reverses every nonidentity case.

## Family

`longevity-survival-percentile-age` upstream.

## Revision

2026-09-14: Clarified that rounded SSA `e(x)` rows make the rebuilt identity and the `h=1` root approximate within the stated tolerances, not exact.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
