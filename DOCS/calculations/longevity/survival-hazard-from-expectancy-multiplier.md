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

At `h=1`, every adjusted survival is `p^1=p`, so `0.5+sum S(t)` is unchanged and equals the same baseline `17.48`. Thus the root of `E_h-1(17.48)` is `h=1`.

## Expected

Hazard power approximately `1`, absolute tolerance `1e-6` to allow the unspecified finite bisection stopping rule; adjusted expectancy should match `17.48` within the corresponding solver tolerance.

## Wrong readings

- Treating `m` itself as hazard happens to pass this identity case but for `m=0.8` would use `h=0.8`, which improves rather than worsens survival.
- Inverting the meaning (`h<1` is worse health) also passes identity but reverses every nonidentity case.

## Family

`longevity-survival-percentile-age` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
