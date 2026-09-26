## Claim

Kind: formula. `allocation/assetClasses.ts#choleskyDecompose` returns a lower-triangular factor `L` with `LL^T` equal to the correlation matrix. The matrix must be positive definite: when a diagonal pivot `A_ii - sum_{k<i} L_ik^2` is not a positive number, no factor with a positive diagonal exists (the pivot is 0, as for a perfectly correlated pair, or negative, as for an indefinite matrix), and the matrix is refused with a RangeError (it used to be raised to `1e-12` without a word, which returned the factor of a different matrix). A positive-definite matrix whose pivot is positive but below `1e-12` is now factored exactly instead of having that pivot raised to `1e-12`: for `[[1, r], [r, 1]]` with `r = 1 - 1e-13`, the pivot is `2.000621890374532e-13` and `L22 = 4.4728311955343587e-7`, where the earlier code gave `1e-6`.

## Justification

For a 2x2 correlation matrix `[[1,r],[r,1]]`, triangular multiplication gives `L11=1`, `L21=r`, and `L22=sqrt(1-r^2)`. Domain: a symmetric positive-definite matrix; for the 2x2 case that is `|r| < 1`. At `|r| = 1` the second pivot `1 - r^2` is 0 and the matrix is refused.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Correlation matrix | `[[1,0.5],[0.5,1]]` | correlation |

## Arithmetic

`L11=1`; `L21=0.5`; `L22=sqrt(1-0.25)=sqrt(3)/2=0.866025403784439`. Multiplication gives off-diagonal `0.5` and second diagonal `0.25+0.75=1`.

## Expected

`[[1,0],[0.5,0.866025403784439]]`, absolute tolerance `1e-12`.

## Wrong readings

- Using `1-r=0.5` under the square root gives `0.7071067812`.
- Returning a symmetric matrix instead of lower triangular leaves upper-right `0.5` rather than `0`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
