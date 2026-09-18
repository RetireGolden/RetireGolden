## Claim

Kind: model. `spending/abw.ts#abwExpectedRealReturnPct` selects an annual expected real return in percent: a fixed input, the bond real yield alone for TIPS, or the convention implied by the comment for CAPE, `w(100/CAPE) + (1-w)b`, where `w` is the equity share as a fraction and `b` is the bond real yield percent; no output rounding is stated.

## Justification

The CAPE branch treats `100/CAPE` as a cyclically adjusted earnings yield and forms a weighted arithmetic blend with the bond real yield. This is a planning assumption, not a forecast or a claim that earnings yield equals realized stock return. Domain: finite CAPE greater than zero, equity share from 0% to 100%, and finite percentage returns.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| CAPE | 25 | ratio |
| Equity share | 60 | percent |
| Bond real yield | 2 | percent/year real |

## Arithmetic

`w = 60/100 = 3/5`. Equity yield `= 100/25 = 4%`. Blend `= (3/5)(4%) + (2/5)(2%) = 12/5% + 4/5% = 16/5% = 3.2%`.

## Expected

Expected CAPE-blended return: `3.2` percent/year real, absolute tolerance `1e-12`, sufficient for these exactly representable decimal inputs and a short floating-point expression.

## Wrong readings

- Using CAPE yield without bonds gives `4.0%`.
- Treating 60 as a fraction instead of 60% gives `60(4%) + (1-60)(2%) = 122%`.

## Family

none yet — the census has no ABW expected-return output family; this value feeds the spending path upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../accounts-and-growth/REVIEW-2026-09-18.md.
