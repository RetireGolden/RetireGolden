## Claim

Kind: model. `montecarlo/riskBasedGuardrails.ts#solveRiskBasedGuardrails` uses common seeded paths and bisection over 2%–400% of starting investable dollars to locate balance levels where fixed-target Monte Carlo success crosses lower/upper probability bands, then bisects spending multipliers toward the band midpoint.

## Justification

Common random paths reduce comparison noise so threshold changes reflect the balance/spending probe. The result is conditional on model, seed, path count, bracket, and assumed monotonicity; it is neither an unseeded confidence guarantee nor advice.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Starting investable | 500,000 | today's dollars |
| Lower/upper band | 70 / 95 | percent success |
| Independent monotone success rule | `S(f)=min(1,f/2)` | probability |

## Arithmetic

Lower edge solves `f/2=0.70`, so `f=1.40` and dollars `=500,000(1.40)=$700,000`. Upper solves `f/2=0.95`, so `f=1.90` and dollars `$950,000`. Both lie inside `[0.02,4]`.

## Expected

Thresholds `(1.4,$700,000,0.70)` and `(1.9,$950,000,0.95)`, subject in the real finite solver to its 10-iteration balance resolution; this analytic oracle should be matched within `4/2^10=0.00390625` in balance fraction.

## Wrong readings

- Treating 70 as probability rather than 70% seeks `f=140`, outside the bracket.
- Scaling from total net worth rather than `$500,000` investable changes the dollar thresholds.

## Family

`display-guardrail-balance-thresholds`, `monte-carlo-success-rate`, `monte-carlo-required-floor-success-rate`, `monte-carlo-target-lifestyle-success-rate`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
