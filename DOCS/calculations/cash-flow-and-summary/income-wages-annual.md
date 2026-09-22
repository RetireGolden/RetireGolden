## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.incomes.wages`, produced by `projection/internal/wageIncomeStreams.ts#wageIncomeStreams`, publishes wages for a living owner before the stream's stop age as `annualGross × (1 + realGrowthPct/100)^(year-startYear) × inflFactor`; this formula is derived from the extract's stated operand order and real-growth-plus-inflation convention.

## Justification

The stop age is `endAge` when present, otherwise the person's retirement age; both may be null. The row is skipped when the owner is dead or has attained the stop age. Wages precede Social Security because its earnings test reads the per-person wage total.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2028 | year |
| Current year | 2030 | year |
| Annual gross at start | 80,000 | today/start-year dollars/year |
| Annual real growth | 2 | percent/year |
| Cumulative inflation factor | 1.08 | nominal/start-year ratio |
| Owner age / alive | 64 / true | years / Boolean |
| Stream stop age | 65 | attained age |

## Arithmetic

Elapsed years `= 2030 - 2028 = 2`. Real raise factor `= (1 + 2/100)^2 = 1.0404`. Nominal wages `= 80,000 × 1.0404 × 1.08 = $89,890.56`. Age 64 is before stop age 65, so the row pays.

## Expected

Exact value: `$89,890.56`. Fixture tolerance: absolute `$0.005`, because the products use binary floating point.

## Wrong readings

- Applying only inflation produces `$86,400`.
- Treating age 64 as already stopped produces `$0`.
- Re-bracketing or pre-summing multiple wage rows can change the last binary digit; the annual phase preserves plan order.

## Family

outputs: `income-wages-annual`.

feeds: `income-total-annual`; `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
