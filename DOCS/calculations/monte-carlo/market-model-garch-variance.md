## Claim

Kind: model. `montecarlo/marketModels.ts#createGarchModel` has fixed initial state `v_0 = 0.0001`, `e_0 = 0` and publishes the return shock and inflation, not its internal variance. Each year follows the documented recursion and scaling below. The next year's `e_t` is the scaled shock `s_t`, not the standardized innovation `sqrt(v_t) * Z1_t`, so the feedback already includes `returnVolScalePct / 100` and the fixed factor 5.

## Justification

The corrected contract states, verbatim:

`v_t = omega + alpha * e_{t-1}^2 + beta * v_{t-1}`

`sigma_t = sqrt(max(1e-9, v_t)) * (returnVolScalePct / 100) * 5`

`s_t = sigma_t * Z1_t`

`published return shock = s_t * 100` percent

`inflation_t = inflationMeanPct + inflationVolPct * (rho * Z1_t + sqrt(1 - rho^2) * Z2_t)`

`e_t = s_t`

The textbook one-step illustration `1 + 0.1(2^2) + 0.8(4) = 4.6` still demonstrates the GARCH recursion. It is not an observable of any call to this function because callers cannot supply prior shock 2 or prior variance 4, and variance is not published.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `omega, alpha, beta` | 1, 0.1, 0.8 | configured recursion values |
| `returnVolScalePct` | 100 | percent of tuned scale |
| `inflationMeanPct, inflationVolPct` | 0, 0 | percent / percentage points |
| `correlation` | 0 | correlation |
| Year 1 normal draws `Z1, Z2` | 1, 0 | standard-normal draws |
| Year 2 normal draws `Z1, Z2` | 0.5, 0 | standard-normal draws |

## Arithmetic

Year 1:

`v_1 = 1 + 0.1(0^2) + 0.8(0.0001) = 1.00008`.

`sigma_1 = sqrt(1.00008)(100/100)(5) = 5.00019999600016`; `s_1 = 5.00019999600016(1) = 5.00019999600016`; published shock `= 500.019999600016%`.

Year 2 feeds back `e_1 = s_1`:

`v_2 = 1 + 0.1(5.00019999600016^2) + 0.8(1.00008) = 4.300264`.

`sigma_2 = sqrt(4.300264)(100/100)(5) = 10.36853895204141`; `s_2 = 10.36853895204141(0.5) = 5.184269476020705`; published shock `= 518.4269476020705%`.

Because `inflationMeanPct = inflationVolPct = 0`, inflation is exactly `0%` in both years.

## Expected

Published return shocks are `[500.019999600016, 518.4269476020705]` percent with absolute tolerance `1e-9`. Published inflation is exactly `[0, 0]` percent. The intermediate variances `1.00008` and `4.300264` explain the result but are not model outputs.

## Wrong readings

- Feeding back `sqrt(v_1)Z1_1 = 1.000039999200032` instead of `s_1` gives `v_2 = 1.900072` and a year-2 published shock of `344.6077480266513%`, not `518.4269476020705%`.
- Starting from `v_0 = 0` gives `v_1 = 1`, contradicting the fixed initial state.
- Omitting the fixed factor 5 gives a year-1 published shock of `100.0039999200032%`, not `500.019999600016%`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision: the first derivation asserted caller-supplied prior state and an internal variance result that no call can provide or observe.
