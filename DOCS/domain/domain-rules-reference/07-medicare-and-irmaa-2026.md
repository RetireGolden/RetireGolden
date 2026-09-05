## 7. Medicare and IRMAA (2026)

- Standard Part B premium: **$202.90/mo**.
- IRMAA based on **MAGI from 2 years prior** (2026 premiums ← 2024 MAGI). Cliff brackets (single / MFJ MAGI): $109k/$218k, then ~$137k, ~$171k, ~$205k single tiers, top tier $500k/$750k. 2026 Part B totals range $284.10–$689.90/mo; Part D surcharges $14.50–$91.00/mo.
- **Top-tier freeze.** 42 USC 1395r(i)(5)(C) freezes the **top** threshold ($500,000 individual / $750,000 joint)
  through premium year **2027**, then resumes indexing it off an August **2026** base; the four tiers beneath it
  index without interruption under (i)(5)(A). The exact-ledger helper `irmaaTierThreshold` implements exactly
  that (`usc-42-1395r-i-5-C-top-irmaa-threshold-frozen`): premium years through 2027 return the pack figure
  unscaled, and later years scale the 2026 base by the general inflation factor read one year early and round
  to the nearest $1,000. A future pack whose year is not 2026 raises rather than silently mis-basing the
  resumption. The optimizer LP is a local approximation of those same amounts: `buildOptimizerModel` multiplies
  every pack MAGI floor, including the frozen top row, by the premium year's `inflationScale`
  (`usc-42-1395r-i-5-optimizer-uniform-threshold-indexing`).
- **Optimizer beneficiary-month exposure.** 1839(a)(2), 1839(i)(3)(A), and 1860D-13(a)(7) price Part B and
  Part D IRMAA per enrolled individual per month. The LP annualizes one household coefficient of 12 months of
  the planning combined increment and applies it once per premium year
  (`usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure`). That coefficient uses the planning
  first-tier combined surcharge ($95.66) rather than CMS's published $95.70, the same 4¢ residual named on
  the standard-premium sibling; prices are not re-derived here. Both optimizer gaps are the local LP Medicare
  surcharge at held planning prices, not recommendation quality or a complete household premium.
- **IRMAA MAGI feed (exact ledger residual).** The lookback feed adds tax-exempt interest but omits the
  §135/§911/§931/§933 without-regard addback (`usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback`);
  the optimizer inherits that omission. The in-solve provisional-income scalar affects taxable SS, not the IRMAA
  MAGI base directly.
- Engine notes: (a) two-year lookback means conversions at 63+ hit Medicare pricing; (b) brackets are cliffs — $1 over costs hundreds; (c) store full bracket tables per year in parameter data; (d) IRMAA's filing categories differ from the income-tax tables — SSA groups **qualifying surviving spouses with single/HOH filers** on the individual threshold table ([POMS HI 01101.020](https://secure.ssa.gov/poms.nsf/lnx/0601101020)), so QSS years price premiums at single thresholds even though their income tax uses the joint tables.
- **SSA-44 redetermination (opt-in, `expenses.healthcare.ssa44`):** after a qualifying life-changing event —
  death of spouse, and optionally each person's work stoppage (retirement year) — the beneficiary can ask SSA
  to price IRMAA on the current year's estimated MAGI instead of the two-year lookback (Form SSA-44; 8
  qualifying events in law, these two modeled). Planning-grade treatment: in the two years after an event
  (the premium years whose lookback still references pre-event income), IRMAA MAGI =
  **min(lookback MAGI, prior-year MAGI)** — the prior year stands in for the current-year estimate
  (current-year MAGI is circular with withdrawals), and the min encodes
  that a redetermination is only filed when it helps. The optimizer prices it in-solve by shifting the flagged
  premium year's IRMAA-binary source from year (t−2) to (t−1) — a single-source stand-in for the min that can
  only overstate the surcharge; the exact-ledger tournament refines. Two documented under-modelings follow
  from the stand-in (modeled relief is a floor, never a ceiling): the event year itself stays on the plain
  lookback (a real filing can re-price it, but the prior-year estimate there is pre-event income), and
  first-year relief is understated when income runs high through the event year (the estimate references
  it). Events only register when they happen — a person who dies before their retirement age has no
  work-stoppage event. The form itself is the user's task (model the effect, never the filing).
- Sources: [CMS 2026 Medicare Parts B premiums and deductibles](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles), [Medicare.gov 2026 costs](https://www.medicare.gov/basics/costs/medicare-costs), [The Finance Buff IRMAA brackets](https://thefinancebuff.com/medicare-irmaa-income-brackets.html), [SSA: request to lower IRMAA](https://www.ssa.gov/medicare/lower-irmaa), [Form SSA-44](https://www.ssa.gov/forms/ssa-44.pdf).
- **Part B late-enrollment penalty** (`usc-42-1395r-b-part-b-late-enrollment-penalty`, outOfScope): the 10%-per-12-month uncovered-period premium increase is not modeled; the engine prices only the standard Part B premium scaled by IRMAA from age 65.
- **Enrollment periods** (`usc-42-1395p-enrollment-periods`, outOfScope): initial, general, and special Part B enrollment windows are not modeled; Medicare months derive from attained age only.
- **Part D IRA cost-sharing** (`usc-42-1395w-113-b-pl-117-169-part-d-penalty-and-cost-sharing`, outOfScope): Part D late-enrollment penalty, annual out-of-pocket threshold, and insulin copayment ceiling are not modeled.
- **IRMAA redetermination evidence** (`cfr-20-418-1205-1230-irmaa-life-change-redetermination`, outOfScope): the regulation's life-changing-event evidence and redetermination request mechanics are not modeled beyond the planning-grade SSA-44 election surface.
