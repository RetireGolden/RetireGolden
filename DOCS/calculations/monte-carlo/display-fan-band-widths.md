## Claim

Kind: composition (presentation after the fix). Owner decision R14 (fix): the Monte Carlo "Range of outcomes" chart draws its two bands as range areas read directly from the engine's fan percentiles, `[p10, p90]` and `[p25, p75]` of `MonteCarloSummary.fan` (`engine/src/montecarlo/run.ts`), and its tooltip prints each band as its two percentile levels. The band widths `p90 − p10` and `p75 − p25` stop being computed, stacked, or printed as if they were dollar levels. No engine change.

## What the UI computes today

`planner-ui/src/planner/MonteCarloPage.tsx` at `a7f62f1e` (unchanged by #747):

```tsx
<Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} contentStyle={chartTooltipStyle} />                          // :938
<Area dataKey="p10" stackId="outer" stroke="none" fill="transparent" name="p10" />                                      // :939
<Area dataKey={(d: { p10: number; p90: number }) => d.p90 - d.p10} stackId="outer" ... name="10–90%" />                 // :940
<Area dataKey="p25" stackId="inner" stroke="none" fill="transparent" name="p25" legendType="none" />                   // :941
<Area dataKey={(d: { p25: number; p75: number }) => d.p75 - d.p25} stackId="inner" ... name="25–75%" />                 // :942
<Line dataKey="p50" ... name="Median" />                                                                               // :943
```

Recharts stacks each width on a transparent base so the band is drawn from p10 to p90. The tooltip formats every series, so hovering a year prints five rows: "p10", the width labelled "10–90%", "p25", the width labelled "25–75%", and "Median". Inputs: `summary.fan` (`run.ts:421-427`, one `YearPercentiles` row per year: nominal investable percentiles across paths).

## The fix

```tsx
<Tooltip formatter={(v: unknown) => (Array.isArray(v) ? `${fmtMoney(Number(v[0]))} to ${fmtMoney(Number(v[1]))}` : fmtMoney(Number(v)))} ... />
<Area dataKey={(d: YearPercentiles) => [d.p10, d.p90]} stroke="none" fill="var(--chart-1)" fillOpacity={0.18} name="10th to 90th percentile" />
<Area dataKey={(d: YearPercentiles) => [d.p25, d.p75]} stroke="none" fill="var(--chart-1)" fillOpacity={0.3} name="25th to 75th percentile" />
<Line dataKey="p50" ... name="Median" />
```

- No `stackId`, no transparent base series. Recharts 3.10.1 (the pinned `^3.10.1`, installed 3.10.1) draws a range area whenever an `Area`'s value is a two-element array: `lib/cartesian/Area.js:559-571` sets `isRange` and uses `value[0]` as the baseline (`:612-626`). The tooltip entry's value is `getValueByDataKey(payload, dataKey)` (`lib/state/selectors/combiners/combineTooltipPayload.js:150-165`), which is the array, so the formatter must handle it (`fmtMoney(Number([a, b]))` is `fmtMoney(NaN)`, which prints "—").
- The formatter only formats; the two numbers are engine values, selected unchanged.
- Labels are the implementer's (and the copywriter's) call; the ones above say what the band is.

Old reading versus corrected, worked: the row below prints today "p10 $400,000; 10–90% $900,000; p25 $600,000; 25–75% $400,000; Median $800,000". A reader takes "$900,000" for a dollar level at the 10th to 90th percentile; it is a width. After the fix: "10th to 90th percentile $400,000 to $1,300,000; 25th to 75th percentile $600,000 to $1,000,000; Median $800,000".

## Justification

The fan percentiles are the engine's published family `monte-carlo-investable-fan-percentiles` (the record of the same id, `rules/calculations/monteCarlo.ts:847` at `a7f62f1e`). A band's width is not a quantity the chart's reader is told about; printing it with a percentile-range label misleads (Rule 2: the code changes when its behaviour would mislead). Drawing the range from the two levels removes the arithmetic and the misleading rows together.

## Inputs

One fan row: year 2050, p10 400,000, p25 600,000, p50 800,000, p75 1,000,000, p90 1,300,000. A second with fractional levels: p10 12,345.67, p90 98,765.43.

## Arithmetic

Row 1: the outer band spans 400,000 to 1,300,000 and the inner 600,000 to 1,000,000; the retired widths were `1,300,000 − 400,000 = 900,000` and `1,000,000 − 600,000 = 400,000`. Row 2: the band spans 12,345.67 to 98,765.43, printed "$12,346 to $98,765"; the retired width `86,419.76` printed "$86,420" (here the stacked top `12,345.67 + 86,419.76` happens to return `98,765.43` exactly in binary; the range area's top is the engine's p90 by construction, with no subtraction and re-addition to rely on).

## Expected

For row 1 the tooltip rows are exactly `["10th to 90th percentile", "$400,000 to $1,300,000"]`, `["25th to 75th percentile", "$600,000 to $1,000,000"]`, `["Median", "$800,000"]`; the outer area's values are `[400000, 1300000]` and the inner `[600000, 1000000]` (Object.is against `summary.fan`). No tooltip row carries "p10", "p25" or a width. Row 2's outer value is `[12345.67, 98765.43]`.

## Wrong readings

- The width as a level: "$900,000" at the 10–90% label (today).
- The transparent bases as data: "p10 $400,000" and "p25 $600,000" listed as separate series beside the bands (today).
- Passing the array to `fmtMoney(Number(v))`: "—" for every band.
- A band built from the median plus or minus half the width: not what the percentiles say when the distribution is skewed (row 1's median 800,000 is not the midpoint 850,000 of 400,000 and 1,300,000).

## Parity test for the switch-over

`planner-ui/src/planner/MonteCarloPage.fan.test.tsx` (jsdom; the formatter and data keys exported or tested through the rendered chart): the two `Area` data keys map each `summary.fan` row to `[p10, p90]` and `[p25, p75]` unchanged; the tooltip formatter prints the two strings above for row 1 and "$12,346 to $98,765" for row 2; no series is named "p10" or "p25". Every example's fan changes form, none changes its levels. Acceptance grep: no `d.p90 - d.p10`, no `d.p75 - d.p25`, no `stackId="outer"` in `MonteCarloPage.tsx`.

## Proposed calculation record

None new: the chart shows engine values unchanged, which the fan-percentile record already covers. Add `display-fan-band-widths` to the `outputs` of the record `monte-carlo-investable-fan-percentiles` (`rules/calculations/monteCarlo.ts:847`), since the family's number is now the fan percentiles themselves; or, if the orchestrator prefers the census to lose the family, retire it (see the README's open question; the recommendation is the former).

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `display-fan-band-widths`: `relocation: { status: 'done', target: 'engine/src/montecarlo/run.ts#MonteCarloSummary.fan' }`; `uiSources` unchanged (`MonteCarloPage.tsx#MonteCarloPage`, the reader); notes "Computed in planner-ui/src/planner/MonteCarloPage.tsx#MonteCarloPage (p90 − p10 and p75 − p25, stacked on transparent bases and printed as dollar levels) until B2-P1 slice 2; now the engine's fan percentiles, drawn as ranges (R14)."; title "Fan chart percentile ranges"; meaning "The 10th to 90th and 25th to 75th percentile ranges of investable assets drawn and printed on the Range of outcomes chart, read from the engine's fan percentiles."; transformations "None after R14: each band is the pair [p10, p90] or [p25, p75] of summary.fan; the tooltip prints the pair."; surfaces unchanged.
- Field coverage: the planner-ui rows `MonteCarloPage.p10/p90/p25/p75` (today → `display-fan-band-widths`) stay, pointing at the same family.
- The recon's and the plan's "presentation only after an owner decision" is met: after the fix the family carries no UI arithmetic.

## Family

outputs: `display-fan-band-widths`.

feeds: none. Reads `monte-carlo-investable-fan-percentiles`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; tooltip strings by `scripts/independent.mjs`; Recharts behaviour read from the installed 3.10.1 source. Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

Implemented as derived: two range areas keyed `[d.p10, d.p90]` and `[d.p25, d.p75]`, labelled "10th to 90th percentile" and "25th to 75th percentile", and the tooltip formatter `fmtMoneyOrRange` (kept in the shared `format.ts`, so no new page module) prints an array as "$low to $high". The family has its own record, `monte-carlo-fan-chart-ranges` (unreviewed), rather than being added to the reviewed fan-percentile record's outputs, so no reviewed record claims the new mapping; the census retitles the family "Fan chart percentile ranges". Its evidence reproduces row 1 from eleven paths whose balances that year are 0, 400,000, 600,000, 600,000, 700,000, 800,000, 900,000, 1,000,000, 1,000,000, 1,300,000 and 2,000,000: at the interpolation index (p/100)(n − 1) = 1, 2.5, 5, 7.5 and 9 the levels are 400,000, (600,000 + 600,000)/2, 800,000, (1,000,000 + 1,000,000)/2 and 1,300,000.

After the review of #752 the parity test is the rendered chart the section above asked for. The chart's two data keys and its tooltip formatter are named functions in the shared `format.ts`: `fanOuterBand` and `fanInnerBand` return a row's `[p10, p90]` and `[p25, p75]` unchanged, and `fmtMoneyOrRange` prints a pair as "$low to $high", one amount as itself, and any other array as "—". `planner-ui/src/planner/MonteCarloPage.fan.test.tsx` (jsdom) renders the page itself at a fixed chart size on a run whose fan is rows 1 and 2, hovers each year, and reads the tooltip rows exactly: row 1's three rows above, and row 2's "10th to 90th percentile $12,346 to $98,765"; each band's lower edge follows its low level from year to year, so it is a range area and not an area on the axis. Replacing the formatter with `fmtMoney(Number(v))`, a band's key with the width `d.p90 − d.p10`, or a band with a single level each fails that test. The census names the three functions and the page as the family's `uiSources`.
