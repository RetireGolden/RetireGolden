# Review, 2026-09-29 (codex-4-monte-carlo-optimizer: the Monte Carlo, optimizer and comparison records)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 13 records below, derived by claude, so the reviewer is of a different agent family from the deriver (catalog gate 7): `market-model-garch-variance`, `market-model-reversed-history`, `market-model-student-t-draw`, `monte-carlo-default-seed`, `monte-carlo-fan-chart-ranges`, `monte-carlo-histogram-bin-centres`, `monte-carlo-people-draw-order`, `risk-based-guardrail-threshold-solver`, `claim-age-co-optimization`, `claim-change-estate-gain`, `plan-headline-longevity-comparison`, `plan-headline-money-comparison`, `relocation-row-comparison`. Verdicts: 8 approve, 5 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/codex-4-monte-carlo-optimizer/` (recompute.py), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Verbatim output follows.

---

# Independent calculation-record review

- Reviewer: Codex (GPT-6-Sol, high reasoning), headless, read-only
- Date: 2026-09-29 (America/New_York)
- Repository commit: `6f668e06` (copy supplied without Git metadata)
- Scope: the thirteen requested Monte Carlo and optimizer/comparison records, their stated worksheets, cited primary material and named evidence tests. No engine function, test or project script was run; no implementation body listed in `implementedByFunctions` was read. Independent arithmetic is in [`DOCS/calculations/reviews/scripts/codex-4-monte-carlo-optimizer/recompute.py`](scripts/codex-4-monte-carlo-optimizer/recompute.py), which imports no project module. Historical observations were read as data, not imported or executed.

The values called *run-pinned* or *example-library measurements* lack complete external input/output snapshots in these worksheets. I do not treat those historical measurements as independent numeric oracles; where a record's main numeric output depends on one, this affects the verdict. Source links below identify the actual material inspected. The 1996 Engle–Mezrich article itself was not available to inspect; a later primary Federal Reserve methodology confirms its stated variance-target equation.

## 1. `market-model-garch-variance`

### Recomputed

With `sigma²=.0144`, `omega=.0144(1-.1-.85)=.00072`, successive `(v, shock)` pairs are `(.0144,12), (.0144,6), (.01332,-23.082460874005616), (.01737,0)`; inflation is four zeros. At volatility 100, `alpha=.1,beta=.8`, the pairs are `(1,100),(1,50),(.925,-192.35384061671346)`; at `alpha=beta=0`, shocks are `12,-24,6`. The Gaussian stationary kurtosis is `3.7741935484`, and squared-shock lag-one correlation is `.1790697674`. The pooled stationary second-moment standard error for 2,000 paths × 30 years, using the stated lag correlation, is `.0142835780`; the mean standard error is `1/sqrt(60000)=.00408248`. The sheet's seeded observations `1.01805,.00445,.14338` are inside its bands, but their exact seeded values cannot be reconstructed from the worksheet's unspecified `nextNormal` cache/draw contract without inspecting implementation or running code.

### Match

All deterministic shocks, variances and model moments match to displayed precision. The purported five-standard-error second-moment band does **not**: five times `.0142835780` is `.07141789`, not `.07`; even the worksheet's rounded `.01428` times five is `.0714`.

### Tolerance

`1e-12` is ample for the few double operations. The `.07` seeded band is still about 4.9 standard errors and could be defended as such, but its stated five-standard-error derivation and “upper bound .01428” are false. The `.0205` mean band is just over five standard errors.

### Wrong readings checked

Percent feedback yields `12,189.82202190473055,-12025.791842535777`; fixed `omega=1e-5` yields `12,5.850213671311502,-21.898630094140593`; updating once before draw one yields `11.384199576606164,5.707889277132135,-22.02089916420308`. The earlier recursion, starting at `.0001` and using the old `.6` scale, gives `.5848076606885378,.29112368505499514,-1.1440477402626168,0`. All differ beyond `1e-12`.

### Sources

The [Bollerslev 1986 author/institution abstract](https://scholars.duke.edu/publication/651658) says current conditional variance includes past conditional variances; the [Federal Reserve's published model specification, equations C9 and its variance-target sentence](https://www.federalreserve.gov/supervisionreg/files/gms-model.pdf) gives the same `omega = unconditional variance × (1-alpha-beta)` identity. I found the [Engle–Mezrich 1996 article listing](https://web-static.stern.nyu.edu/rengle/research/publications.html), but not its operative article text; the worksheet's direct-source check remains incomplete. The parameters `.1,.85` are choices, not empirical estimates.

### Record consistency

The recursion and stated limits match the worksheet, including Gaussian innovations, common class variance and potentially sub-−100% additive returns. The statement inherits the tolerance explanation's false five-standard-error claim only through the worksheet, not its formula.

### Evidence binding

`marketModels.evidence.test.ts` asserts the four shocks, the 100%-volatility case, iid case and refusals; it checks seeded moments by bands, not the printed seed statistics. This supports the deterministic headline but does not cure the source or tolerance explanation.

### Verdict

**Reject.** Obtain the cited Engle–Mezrich operative text or cite the accessible primary methodology instead, and correct the second-moment band explanation to `.07142` for five stationary standard errors (or describe `.07` as about 4.9).

## 2. `market-model-reversed-history`

### Recomputed

I summed the 96 published stored observations at 60% equity: `857.9800000000002/96=8.937291666666669`. `start=72,L=5` selects years `2004,2003,2002`; their blends `8.22,17.2,-7.16` minus that mean give `-0.7172916666666698,8.26270833333333,-16.097291666666667`, with inflation `3.3,1.9,2.4`. Seven years wrap to `2004,2003,2002,2001,2000,2004,2003`. At `L=10`, first years `2009,2008,2007` give shocks `2.1627083333333292,-22.85729166666667,-1.5572916666666687` and inflation `2.7,.1,4.1`.

### Match

All stated replay years, shocks, inflation and `nextInt(96-5+1)=nextInt(92)` match.

### Tolerance

Year indices/refusals are exact; `1e-12` covers decimal-to-binary blending and subtraction.

### Wrong readings checked

Forward replay is `2000,2001,2002`, with first shocks `-7.657291666666668,-13.837291666666669,-16.097291666666667`; it differs at years one and two. `nextInt(96)` permits start 95, which makes a five-row window extend to index 99. Clamping requested 3 or 97 gives an output where the required result is a refusal.

### Sources

The [Damodaran published annual stock/bond/inflation table](https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histret.html) has operative 2002–2004 entries that round to the worksheet's stored rows; the table's source values carry more decimal places. Reversal and minimum length are declared stress/product conventions, not historical claims.

### Record consistency

The statement, index formula, feeds and limits reflect the worksheet; it calls the series a stress transformation and discloses repetition.

### Evidence binding

`marketModels.evidence.test.ts` asserts the three main shocks/inflations, the ten-year case, wrap and invalid-window refusals.

### Verdict

**Approve.**

## 3. `market-model-student-t-draw`

### Recomputed

At `df=5`, `d=13/6`, `c=.22645540682891913`, private `x=sqrt(2 ln 2)=1.1774100225154747`, `v=2.0321239789552172`, `V=8.805870575472607`, `m=.5836795510996967` and shock `7.004154613196361` (the operation order in the sheet gives `...360`). Squeeze bound `.9363880209572302` accepts uniform `.5`. B2 first `s=-.0866521376236622`, so it consumes two uniforms then returns the B1 shock after five; B3's `.999` fails both tests and `.95` passes the exact test on retry, six uniforms; B4 yields `V=5.13838077203784`, shock `-7.486573660049821`. Inflation with `rho=-.2`, volatility `1.5`, `z2=.5` is `.5597430575050444`. Ideal Student-t(5) two-sided three-sigma tail by independent numerical integration is `.01172481100395464`; the sheet's normal comparator and the stated threshold tail orders also match.

### Match

All finite scripted draws match within `1e-12`. The record's **unqualified exact distribution and correlation claims do not hold over its permitted inputs**: when `returnVolPct=0` or `inflationVolPct=0`, `Corr(shock,inflation)` is undefined, not `rho`. Flooring the private Box–Muller first uniform at `1e-12` also changes the exact gamma/t distribution, however tiny the effect at ordinary settings.

### Tolerance

`1e-12` justifies the scripted floating-point examples. The five-standard-error seeded bands are reasonable for the ideal df-5 model; exact seeded statistics were not independently reproduced because the worksheet does not pin the full generator/normal-cache contract. The explicit floor is a distribution approximation, not a rounding tolerance.

### Wrong readings checked

Unscaled t gives `9.042324723723786`; substituting Gamma for chi-square gives `9.905370446940372`; shape `df` gives `5.296324532431464`; the sine branch gives `9.984603532054125`; the old normal mixture gives `12`. Inflation driven by `Z` gives `.4348469228349534`, distinct from `.5597430575050444`.

### Sources

A readable [copy of the Marsaglia–Tsang paper's abstract](https://www.mendeley.com/catalogue/86fe67db-8144-3c61-ab9b-1f1bacb73b9d/) states `d=a−1/3`, `v=(1+x/sqrt(9d))³`, the logarithmic acceptance test and `.0331x⁴` squeeze; the [publisher DOI](https://doi.org/10.1145/358407.358414) did not yield its full text here. That ideal algorithm assumes a genuine normal variate. The capped private normal is a finite-computer adaptation and should be described as such.

### Record consistency

The record does mention the uniform floor in `limits`, but simultaneously states exact t variance, exact return/inflation correlation and a multivariate t class vector without restricting those claims to positive volatilities and the ideal sampler. Correct form: for **positive** return and inflation volatilities and an ideal chi-square draw, the correlation is `rho`; with the floor, the implemented relation is approximate.

### Evidence binding

`marketModels.evidence.test.ts` pins B1–B4, draw counts, inflation, refusals and broad seeded bands. It does not test zero-volatility correlation, which is mathematically undefined.

### Verdict

**Reject.** Qualify the exact moment/correlation and multivariate-t claims for the uniform floor and positive volatilities; the deterministic expected shock stays `7.00415461319636`.

## 4. `monte-carlo-default-seed`

### Recomputed

`0x5eeded=6,221,293`. Independent unsigned 32-bit XOR, multiply and shift calculations yield path-0 seed `2,931,854,348` and path-1 seed `3,741,805,609`; the headline literal is 1,000 paths, 12% return volatility and the supplied 2026 start/2.5% inflation.

### Match

All worksheet integer values and the stated headline option values match.

### Tolerance

Exact uint32 arithmetic; no floating tolerance needed for these values.

### Wrong readings checked

FNV-1a on `example:all-401k-no-bridge` gives `1,339,074,469`; decimal 5,000,000 differs from `0x5eeded`; `seed+1=6,221,294` differs from path-1's mixed seed.

### Sources

This is a product seed choice, not a statute or market table. The [local Monte Carlo domain rule](../../domain/domain-rules-reference/12-monte-carlo-methodology-notes.md) states the shared default; the independent bit operations are specified by the [path-seed worksheet](../monte-carlo/rng-derived-path-seed.md).

### Record consistency

Statement, formula, feeds and sampling caveats match. A common seed pairs default runs but does not remove Monte Carlo sampling error.

### Evidence binding

`headline.evidence.test.ts` asserts both seeds and the headline options and compares cloned-plan paths.

### Verdict

**Approve.**

## 5. `monte-carlo-fan-chart-ranges`

### Recomputed

For eleven sorted balances, interpolation indices `1,2.5,5,7.5,9` give `p10=400,000,p25=600,000,p50=800,000,p75=1,000,000,p90=1,300,000`. Hence outer `[400000,1300000]`, inner `[600000,1000000]`, median `800000`. Fractional row outer `[12345.67,98765.43]` formats `$12,346 to $98,765` under the sheet's whole-dollar formatter.

### Match

Both ranges and all three tooltip values for the first row match; the fractional example matches.

### Tolerance

The bands copy source numbers exactly; percentile interpolation here averages equal adjacent values, so the first row is exact. Formatting deliberately rounds dollars.

### Wrong readings checked

Width readings are `900,000` and `400,000`, different from upper percentile levels. `Number([400000,1300000])` is NaN. The outer midpoint `850,000` differs from median `800,000`, so a symmetric median band misstates this sample.

### Sources

R14 and the fan-percentile contract are internal presentation decisions, with no legal primary source. The worksheet names the source percentiles; the rendered-chart evidence is the operative Recharts integration check.

### Record consistency

The record accurately says the UI selects `[p10,p90]` and `[p25,p75]` and identifies the legacy family name `display-fan-band-widths` as a range mapping; limits disclose where the UI mapping actually lives.

### Evidence binding

`run.fanRanges.evidence.test.ts` asserts the 11-path percentiles. `MonteCarloPage.fan.test.tsx` pins both data-key pairs, tooltip strings and range-area behavior without requiring the engine test to implement UI arithmetic.

### Verdict

**Approve.**

## 6. `monte-carlo-histogram-bin-centres`

### Recomputed

A has width `50,000`, centres `125,000,175,000,225,000,…,1,575,000`. B has width `100,000`, counts at indices `0:2,2:1,12:1,29:1` and occupied centres `50,000,250,000,1,250,000,2,950,000`. C and D have placeholder width 1 and all thirty centres 0; C's first count is 4, D has no counts. E has width 25, counts `[2,1,0,2]`, centres `[12.5,37.5,62.5,87.5]`.

### Match

Cases A–E match exactly. The **record's empirical limit does not match its worksheet**: it says five of 29 example plans are degenerate “at the page's defaults”; the worksheet's final default-seed remeasurement says **three** (`inherited-ira-beneficiary`, `survivor-years`, `ltc-shock`). Five was the prior plan-id-seed count.

### Tolerance

Exact for these halves and whole-dollar inputs. A general floating-point centre should be checked at the documented arithmetic association, not against an algebraically reordered expression.

### Wrong readings checked

Case A's left edge is `$100k`, not `$125k`. The degenerate placeholder yields `.5,1.5,…,29.5`, displayed `$1…$30`, whereas its sole observed value is `$0`. Dividing the span by `bins-1` makes A's last centre exceed its max by half a new width.

### Sources

The midpoint follows interval arithmetic; no external statute or table applies. The worksheet documents the default-seed change and its remeasurement as the basis for the empirical count.

### Record consistency

Formula and centre limits are correct. Replace the record limit's “5 of 29” with “3 of 29 on the current default seed,” or remove the empirical count if it cannot be kept current.

### Evidence binding

`run.binCenters.evidence.test.ts` asserts A–E and all three published histogram fields. `MonteCarloPage.fan.test.tsx` asserts the single `$0` bar. Neither pins the record's stale default-seed count.

### Verdict

**Reject.** The record's current-default example count is five; the worksheet's corrected count is three.

## 7. `monte-carlo-people-draw-order`

### Recomputed

ISO date order gives A `Ray,Lee`; equal dates with explicit female-before-male gives B `z,a`; equal dates/sex and ordinal UTF-16 `B=66 < a=97` gives C `B,a`.

### Match

All three exact orders match.

### Tolerance

Exact string/code-unit comparison.

### Wrong readings checked

List order gives `Lee,Ray` in A; alphabetical sex order starts `average` rather than `female`; locale id collation can place lowercase `a` before uppercase `B`. Each differs on a supplied fixture.

### Sources

The canonical tie-break order is an internal D-PEOPLE-ORDER convention; it makes sampling insensitive to list order. No external mortality table establishes this order, and the record does not claim one does.

### Record consistency

Statement/formula/feeds match; limits explain that a tie on date and sex can still move a path after an id rename.

### Evidence binding

`peopleDrawOrder.evidence.test.ts` reads the worksheet expected rows, asserts all three orders in both list orders, and compares longevity/care path outputs for A.

### Verdict

**Approve.**

## 8. `risk-based-guardrail-threshold-solver`

### Recomputed

`h=3.98/1024=.00388671875`. Crossings at `f*=1.4,1.9` lead to `k=356,484`, `f=1.403671875,1.901171875`, persisted percents `140.37,190.12`; current success `.5`. Cut lattice `m=.3+201(.7/256)=.849609375`, giving `$6,015.625/year`, `$501.3020833333333/month`, success `.8260689655172412`. Raise lattice `m=1+38/256=1.1484375`, giving `$5,937.50/year`, `$494.7916666666667/month`, success `.8277210884353741`. Distinct cached balance calls are 20, spending calls 20, total 40; the declared progress total 41 counts potential cache-free calls. Constant `.99` is above both edges, while `min(1,f/10)` cannot reach either at `f=4`.

### Match

Every computed edge, adjustment, money amount, call count and degenerate classification matches. The current published solver outputs `balancePct`, not the older `balanceDollars` discussed in the arithmetic history.

### Tolerance

Fractions/multipliers are within `1e-12`; `$1e-6` exceeds only floating-point association error. Persisted two-decimal percentages are exact decimal displays of a floating-point round.

### Wrong readings checked

Returning `lo` gives `1.39978515625` and `1.89728515625`, both below the target. `4/1024` rather than `3.98/1024` gives first point `.02390625` instead of `.02388671875`. Treating continuous crossings `1.4,1.9` as outputs misses the lattice. With an edge near 4, the returned index can be `1024`, not at most `1023`.

### Sources

The solver seam and fixed-target curve are product/model definitions; bisection follows elementary interval arithmetic. No external financial authority is claimed for the selected 200 paths or success band.

### Record consistency

Statement, formula, feeds and limits reflect the worksheet and disclose assumed monotonicity, finite lattice and default lognormal solve. The stated rounding tie exceptions are limits rather than silently hidden precision.

### Evidence binding

`riskBasedGuardrails.evidence.test.ts` asserts the lattice indices, both multipliers and monthly amounts, call sequence/count, degenerate results and invalid-probe refusals.

### Verdict

**Approve.**

## 9. `claim-age-co-optimization`

### Recomputed

Open 1966 fixture: future canonical ages 62 and 67 plus the current 70 give `3` combinations. January-1 1956 uses the **1955** FRA row `66y2m`; both 62 and FRA were before 2026, so `1` current combination. January-1 1960 uses the **1959** FRA row `66y10m`, hence two labels (`66y10m` and 70). Partly-claimed Pat's 2025 claim is held; Sam contributes two candidates, total `3`. The already-claimed, unpriced and no-stream cases each evaluate `1`; the unpriced 2028 reason and no-winner outcomes follow the stated gates. For the planning-age-95 fixture born 1966, the last projection year is `1966+95=2061`. Under the worksheet's own whole-year claim convention, the claim years 2036, 2033 and 2028 **through 2061 inclusive** contain `26,29,34` benefit years. Weighted by its factors, these are `32.24,29,23.8` PIA-years, not `31,28,23.1`. The winner conclusion remains age 70 in that simplified benefit comparison.

### Match

Candidate counts, labels and outcome classifications match. The worksheet's PIA-year arithmetic is one year short for each candidate. Its two headline estate outputs are declared *run-pinned* and have no worksheet dollar value to independently recompute; the evidence test's `$1,130,409.20` comes from an optimizer execution, not the cited SSA rule or an independent ledger worksheet.

### Tolerance

Counts, dates and age labels are exact. `$0.005` could cover a separately derived floating-point estate amount but cannot validate a value sourced solely from the engine run under review.

### Wrong readings checked

Including current age gives `4` in the open case; omitting the current evaluation gives `2`, and zero for no stream. Keeping past 62/FRA gives `3` in the past-ages case. Using calendar 1960 for January 1 gives FRA 67 and loses the `66y10m` candidate. Refusing the partly-claimed couple gives `1`, not `3`. The worksheet never constructs a candidate exactly `$1,000` ahead, so strict versus inclusive margin remains untested.

### Sources

The [SSA normal-retirement-age table and January-1 note](https://www.ssa.gov/OACT/ProgData/nra.html) support the FRA values; the [SSA early/delayed benefit table](https://www.ssa.gov/oact/ProgData/ar_drc.html) supports `0.70,1.00,1.24` for the 1960-or-later row. [42 U.S.C. §402(a)](https://uscode.house.gov/view.xhtml?req=%28title%3A42+section%3A402+edition%3Aprelim%29) requires application for entitlement, and [20 CFR 404.621(a)(2)–(3)](https://www.ssa.gov/OP_Home/cfr20/404/404-0621.htm) limits retroactivity. [IRS PTC guidance](https://www.irs.gov/affordable-care-act/individuals-and-families/questions-and-answers-on-the-premium-tax-credit) confirms non-taxable Social Security enters household MAGI. These support the guards, not the run-pinned estate dollars.

### Record consistency

The record candidly calls the estate values run-pinned, so it does not falsely say they were independently derived. The worksheet nevertheless presents the wrong PIA-year derivation for its null-winner example; the formula's estate outputs lack an independent numeric oracle.

### Evidence binding

`optimizePlan.evidence.test.ts` pins candidate counts/labels/gates and `jointExactEstate===currentClaimExactEstate`; both `$1,130,409.20` expected estates are self-described run pins. No independent `$1,000` boundary fixture is present.

### Verdict

**Reject.** Correct the PIA-years to `32.24,29,23.8` and derive the headline estate expected value from an external ledger worksheet/oracle rather than a prior engine execution.

## 10. `claim-change-estate-gain`

### Recomputed

R: `1,118,000−1,000,000=118,000`; T: IEEE-754 subtraction `2,109,001.02−2,103,456.78=5,544.2400000002235` (`40b5a83d70a3d800`); S: equal estates give positive zero and end year 2026. W's year `1964+95=2059`. The earlier five example-library gains are explicitly historical, superseded by the later ACA refusal; no current winner amount is claimed for W.

### Match

The R, S, T numerical composition and W year/property match. The historical example-library figures lack independently supplied per-plan estates and are not used as a current oracle.

### Tolerance

Exact IEEE-754 subtraction at the given operands; whole-dollar page/report formatting is separate. The explicit operation order justifies the T bit pattern.

### Wrong readings checked

Current minus joint gives `−118,000` in R and `−5,544.2400000002235` in T; either contradicts “more.” A same-year nominal gain cannot be relabelled as today's dollars without an inflation factor.

### Sources

This is composition of two already-priced projection outputs and an internal strict switch margin, not a statute-derived benefit value. The worksheet correctly distinguishes nominal estate-year dollars from present/start-year dollars.

### Record consistency

Statement/formula/limits match the worksheet. It does not claim the historical example-library winners remain current. For W it claims only a strict-gain property, not an independently known dollar amount.

### Evidence binding

`optimizePlan.claimGain.evidence.test.ts` pins R/T arithmetic and S zero/year; W checks the published gain against the two estates and the margin, but does not pin an independent W amount. This is adequate for this **composition** record, not independent validation of the optimizer's estates.

### Verdict

**Approve**, limited to the gain composition; the optimizer's two estate levels need their own independent oracle.

## 11. `plan-headline-longevity-comparison`

### Recomputed

Last funded `L=D−1` or `E`: A `2045,2049`, delta `+4`, lower bound; B `2045,2042`, `−3`, ages `84,81` but different people so age delta null; C/D both full, delta null even when D's horizon gap is `+3`; E `2050,2055`, `+5` upper bound and success `−100`; F `2029,2025`, `−4`, ages `70,66`, age delta `−4`; G refuses missing birth date; H `2049,2049`, bound `≥ same`, age 90 on baseline; I uses Alex born 1962 on both sides, ages `84,81`, delta `−3`. Deterministic success deltas are `+100,0,0,0,−100,0,+100` for A–F,H respectively.

### Match

All A–I expected exact values, nulls, bounds and person selection match. The 812 example-pair parity measurement is a historical integration observation, not an independently reconstructible oracle in this worksheet.

### Tolerance

Integer calendar years, percentage-point values and nulls require exact checks.

### Wrong readings checked

Case I's first-listed Sam would give age `82` and a misleading `−1` versus Alex's 81. Mixing lasts-through with last-funded makes A `+5`, not `+4`. For D, `0` falsely claims equal longevity and `+3` is only the horizon gap. Case B's raw ages differ by `−3`, but the people differ, so that number must be withheld.

### Sources

R15 and canonical people order are internal presentation conventions. The worksheet explains why a full plan gives a bound or unknown difference; no legal or external mortality table is invoked.

### Record consistency

Statement/formula/limits name the older person's calendar-year age, person identity guard and deterministic 0/100 reading without presenting it as a probability.

### Evidence binding

`planHeadlines.evidence.test.ts` asserts A–I core values and wrong readings. The named UI parity test covers display conventions; no engine test was run here.

### Verdict

**Approve.**

## 12. `plan-headline-money-comparison`

### Recomputed

H nominal estate delta `1,250,000−1,000,000=250,000`. I factors by recurrence: `f(2050)=1.8087259495825871`, `f(2060)=2.315322132747548`; today's estates `995,175.6375339222` and `863,810.6860865355`, delta `−131,364.95144738676` instead of nominal `+200,000`. J: `(4500+500)+5100/1.02=10,000`, and `3000+3060/1.02+3121.2/1.0404=9,000`, delta `−1,000`; nominal delta `9181.2−10100=−918.8`. K retains nominal estate `+100,000` and lifetime tax `−10`. L/M are refusal cases.

### Match

Cases H–M match. The worksheet's 812-pair table **does not match its own final revision**: its example-couple / hsa-stealth-retirement old nominal estate delta still says `+$330k` and today's ending net-worth delta `−$331k`; the revision states the current figures after the 2027 HSA parameter update are `+$329k` and `−$332k` respectively. These cells are not identified as obsolete in the table.

### Tolerance

The evidence's exact double comparison is appropriate only with the same recurrence and operation order; the I numbers reproduce under that order. Compact UI figures round independently, so their visual subtraction need not match the unrounded delta.

### Wrong readings checked

I's nominal subtraction is `+200,000`; dividing both by the baseline factor gives `+110,575.07`, both opposite the corrected negative result. J's end-factor treatment gives approximately `−1,077.28`, not `−1,000`. Deflating only on differing inflation would miss I and unnecessarily change K.

### Sources

R13 and `projectionDollarBasis` are internal dollar-basis conventions. The rationale is unit consistency: compare same-year nominal amounts directly, different-year ending amounts in each plan's start-year dollars; deflate annual tax in its own year. No tax law supplies these comparison rules.

### Record consistency

The record itself states the corrected formula and mixed-inflation limitations accurately. Its worksheet's stale example cells undermine the promised exact parity at the final parameter head; update those two table entries or mark the table as an older snapshot at its point of use.

### Evidence binding

`planHeadlines.evidence.test.ts` pins H–M and wrong-reading contrasts; the later parity tests reportedly pin the corrected 2027 HSA figures. The worksheet still shows the earlier two cells.

### Verdict

**Reject.** Replace `+$330k` with `+$329k` and `−$331k` with `−$332k` in the current example-pair table, consistent with its own final revision.

## 13. `relocation-row-comparison`

### Recomputed

N: `363,292.60−433,212.40=−69,919.80000000005` (`c0f111fcccccccd0`), printed `−$69,920`; O has null delta for baseline/failed row; P recurrence `1.025^33=2.2588508612171205` by repeated multiplication and `4,058,000/f=1,796,488.6791213197` (`413b6988addae512`), printed `$1,796,489`; Q equal operands give positive zero.

### Match

All N–Q values and null cases match. The 116-row example-library parity count is an historical measurement with no independent row-summary snapshot in this worksheet; it is not needed to derive the published row formula.

### Tolerance

The exact bit tolerance is justified for the one subtraction and one division when the published factor and operation order are fixed. Printed whole-dollar figures are rounded separately.

### Wrong readings checked

Baseline minus row makes N `+$69,920`; deflating P one fewer year makes it larger; deflating N's lifetime sum by an end-year factor falsely treats each annual tax as paid in that last year.

### Sources

The same-year nominal-sum difference and ledger inflation factor are internal comparison contracts, not legal estimates; the worksheet states both units and notes why a relocation patch preserves the horizon and inflation assumption.

### Record consistency

Statement/formula/limits match the derivation, including that unrounded delta `−$69,920` can differ by $1 from the visible level-cell gap `363,293−433,212=−69,919`.

### Evidence binding

`relocation.comparison.evidence.test.ts` asserts N and P to exact bit patterns, O null/error, and Q positive zero; the page parity test checks the displayed fields and baseline label.

### Verdict

**Approve.**
