## Claim

Kind: model. `spending/shapePresets.ts#spendingShapePhases` compiles named flat, smile, front-loaded, and smirk policies to visible editable phase rows; the smirk delegates to a `-1%/year` real five-year-step compilation and flat emits no phases.

## Justification

Preset compilation freezes a research-inspired policy into plan data so future constant changes do not mutate saved plans. It models a spending shape, not a household forecast.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Shape | smirk | category |
| Retirement age | 65 | years |
| Smirk annual delta | -1 | percent/year real |

## Arithmetic

First phase at 70: `0.99^5=0.9509900499`, rounded to `0.95`. Second at 75: `0.99^10=0.904382075008805`, rounded to `0.90`.

## Expected

Smirk begins with age/multiplier rows `(70,0.95)` and `(75,0.90)`; flat yields an empty list. Values are exact after two-decimal rounding.

## Wrong readings

- Using nominal rather than real decline and subtracting inflation again creates a steeper path.
- Live-linking the preset would retroactively change saved plans when the constant changes.

## Family

`spending-shape-delta-vs-flat`, `spending-base-annual` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../accounts-and-growth/REVIEW-2026-09-18.md.
