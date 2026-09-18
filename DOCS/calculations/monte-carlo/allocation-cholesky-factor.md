## Claim

Kind: formula. `allocation/assetClasses.ts#choleskyDecompose` returns a lower-triangular factor `L` with `LL^T` equal to the correlation matrix when positive definite, clamping a nonpositive diagonal radicand to `1e-12` defensively.

## Justification

For a 2x2 correlation matrix `[[1,r],[r,1]]`, triangular multiplication gives `L11=1`, `L21=r`, and `L22=sqrt(1-r^2)`. Domain for exact factorization: symmetric positive-definite matrix.

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
