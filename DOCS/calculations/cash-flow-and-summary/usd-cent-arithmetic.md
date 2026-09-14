## Claim

Kind: formula. `actions/money.ts#addUsdCents`, `subtractUsdCents`, and `sumUsdCents` perform exact arithmetic on validated nonnegative integer US cents, with subtraction valid only when the result remains in that domain.

## Justification

Currency minor units form nonnegative integers: addition and finite summation are closed, while subtraction requires minuend at least subtrahend. The schema excludes fractional cents, negative zero, negatives, and integers above JavaScript's safe range.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Left/minuend | 125 | cents |
| Right/subtrahend | 25 | cents |
| Sum vector | [125, 25, 50] | cents |

## Arithmetic

Addition `125+25=150`; subtraction `125-25=100`; sum `125+25+50=200`.

## Expected

`150`, `100`, and `200` cents respectively, exact integers.

## Wrong readings

- Treating inputs as dollars produces `$150` rather than `$1.50` for the addition.
- Reversing subtraction produces `-100` cents, outside `UsdCents`.

## Family

none yet — these are exact-money primitives used before displayed annual outputs.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
