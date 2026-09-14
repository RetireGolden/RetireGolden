## Claim

Kind: formula. `allocation/assetClasses.ts#weightsToVector` converts class weights into normalized fractions in the fixed order US stocks, international stocks, bonds, cash; no rounding is stated.

## Justification

For nonnegative weights `w_i` with positive sum `W`, normalized fraction `f_i=w_i/W`; then `sum f_i=1`. Domain: one finite nonnegative weight per asset class and positive total.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| US / international / bonds / cash | 60 / 20 / 20 / 0 | relative weights |

## Arithmetic

`W=100`; vector `=[60/100,20/100,20/100,0/100]=[0.6,0.2,0.2,0]`; sum `=1`.

## Expected

`[0.6,0.2,0.2,0]`, absolute tolerance `1e-12` per component.

## Wrong readings

- Returning percentages gives `[60,20,20,0]` with sum 100.
- Sorting by magnitude rather than class order can silently move the 20% bond weight into another class.

## Family

`bucket-lens-allocation` upstream; no direct engine weight-vector family yet.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
