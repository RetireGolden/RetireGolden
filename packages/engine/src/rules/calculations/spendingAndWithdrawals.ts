/**
 * Spending-and-withdrawals calculation records.
 *
 * One slice of the calculation registry. `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const spendingAndWithdrawalsRecords = {
  'abw-annuity-due-payment': {
    title: 'Amortization-based withdrawal, growing annuity-due payment',
    purpose: 'This year\'s ABW payment from a start-of-year balance over the remaining horizon.',
    kind: 'formula',
    // Under the ABW spending policy, annualLifestyleLayers supplies this
    // payment as baseAnnualNominal and annualExpenseSummary publishes it as
    // YearResult.expenses.baseSpending. It is not the solver's independent
    // sustainable-spending result, nor the broader targetSpending total that
    // also includes system costs and goals.
    outputs: ['spending-base-annual'],
    statement:
      'Given a start-of-year balance B, an expected return r and a planned payment growth g (both in percent per year, as abwAnnualPayment takes them, so the worksheet\'s 10% is passed as 10) and a remaining horizon in years including the current year, the function first truncates that horizon to whole years, n = floor(remainingYears), so a fractional horizon such as 4.5 years is amortized over 4. The beginning-of-period payment is P = B(1−x)/(1−x^n) where x = (1 + g/100)/(1 + r/100). P = B/n instead under either guard the code tests: `!Number.isFinite(x) || x <= 0` (x is not finite or not positive; r > −100 and g > −100 keep it finite and positive) and `Math.abs(x - 1) < 1e-9` (x = 1 within that tolerance). Payments are withdrawn before growth. Under the ABW spending policy P is the year\'s base spending before guardrail adjustments: annualLifestyleLayers writes it as baseAnnualNominal, which annualExpenseSummary publishes as YearResult.expenses.baseSpending. Domain: finite B > 0 (a non-finite or non-positive balance pays 0) and n ≥ 1; n ≤ 1 spends the whole balance. Rounding: the horizon is floored on input; the payment itself is not rounded (the production function returns a binary float).',
    formula: {
      expression: 'n = floor(remainingYears); x = (1 + g/100)/(1 + r/100); P = B(1-x)/(1-x^n), or P = B/n when x is not finite, x <= 0, or |x - 1| < 1e-9',
      variables: [
        { symbol: 'P', meaning: 'This year\'s beginning-of-period payment', unit: 'usd', domain: 'P ≥ 0' },
        { symbol: 'B', meaning: 'Start-of-year portfolio balance', unit: 'usd', domain: 'B > 0 and finite (otherwise the payment is 0)' },
        { symbol: 'r', meaning: 'Expected return over the period, in percent (10% is 10)', unit: 'percent', domain: 'r > -100, so that 1 + r/100 > 0 and x is finite and positive' },
        { symbol: 'g', meaning: 'Planned payment growth over the period, in percent (0% is 0)', unit: 'percent', domain: 'g > -100, so that 1 + g/100 > 0 and x is positive' },
        { symbol: 'n', meaning: 'Remaining periods including the current one, n = floor(remainingYears): a fractional horizon is truncated to its whole years before amortizing', unit: 'count', domain: 'integer n ≥ 1 (the floored value); n ≤ 1 pays the whole balance' },
        { symbol: 'x', meaning: 'Payment-growth ratio (1 + g/100)/(1 + r/100)', unit: '1', domain: 'finite x > 0 with |x − 1| ≥ 1e-9 for the closed form; otherwise P = B/n' },
      ],
      timing: 'beginning of period, annual',
      rounding: 'none on the payment, a binary float; the horizon is truncated to whole years on input, n = floor(remainingYears)',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md',
    },
    limits: [
      'The chosen expected return is an assumption, not proven by the identity',
      'The payment is the ABW policy\'s base spending before guardrail adjustments, written by annualLifestyleLayers as baseAnnualNominal; under other spending policies baseSpending is not this formula',
    ],
    implementedBy: [
      'packages/engine/src/spending/abw.ts',
      'packages/engine/src/projection/internal/annualLifestyleLayers.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/spending/abw.ts#abwAnnualPayment',
      'packages/engine/src/projection/internal/annualLifestyleLayers.ts#annualLifestyleLayers',
    ],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'claude-orchestrator', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'abw-expected-real-return': {
    title: 'ABW expected real return: fixed, TIPS yield, or CAPE-blended',
    purpose: 'The expected real return an amortization-based withdrawal policy amortizes at, by return source.',
    kind: 'model',
    // "none yet" in the worksheet: no census family carries the expected
    // return. simulate.ts resolves it once per simulation and
    // annualLifestyleLayers.ts amortizes every year's payment at it through
    // abwAnnualPayment (abw-annuity-due-payment), whose payment is the year's
    // base spending, so that family is the nearest one this value feeds.
    outputs: [],
    feeds: ['spending-base-annual'],
    statement:
      'For an ABW policy, or undefined: source = policy.returnSource ?? "fixed"; b = policy.bondRealYieldPct ?? 2.0. "tips" returns b. "cape" returns (100/CAPE) x s + b x (1 - s), with CAPE = policy.startingCape ?? 25 and s = (policy.equitySharePct ?? 60)/100. "fixed" returns policy.fixedRealReturnPct ?? 3.8. Units: percent per year, real. Rounding: none.',
    formula: {
      expression: 'r = b (tips); r = s (100/CAPE) + (1 - s) b (cape); r = fixedRealReturnPct (fixed); defaults b = 2.0, CAPE = 25, s = 0.6, fixed = 3.8',
      variables: [
        { symbol: 'CAPE', meaning: 'Starting cyclically adjusted price-earnings ratio', unit: 'ratio', domain: 'schema 5..60' },
        { symbol: 's', meaning: 'Equity share of the portfolio', unit: '1', domain: '0 <= s <= 1 (schema: percent 0..100)' },
        { symbol: 'b', meaning: 'Real bond or TIPS yield', unit: 'percent/year', domain: 'schema -2..8' },
        { symbol: 'r', meaning: 'Expected real return the payment is amortized at', unit: 'percent/year', domain: 'finite' },
      ],
      timing: 'resolved once per simulation; every year amortizes at the same r',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-expected-real-return.md',
    },
    limits: [
      'The CAPE branch treats the cyclically adjusted earnings yield as the equity real return, an ERN/TPAW-style planning convention rather than a forecast',
      'Defaults come from ABW_DEFAULTS; an undefined policy resolves to the fixed 3.8% (the VPW global 60/40 rate)',
      'The schema bounds CAPE, the equity share and the bond yield before the function runs; the function itself does not validate',
      'The worksheet says none yet: no census family carries the expected return. The traced consumer is the ledger, which resolves it once (simulate.ts) and amortizes every year\'s payment at it (annualLifestyleLayers.ts, abwAnnualPayment), so spending-base-annual is named as the nearest fed family',
    ],
    implementedBy: ['packages/engine/src/spending/abw.ts'],
    implementedByFunctions: [
      'packages/engine/src/spending/abw.ts#abwExpectedRealReturnPct',
      'packages/engine/src/spending/abw.ts#ABW_DEFAULTS',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'withdrawal-rate-guardrail-step': {
    title: 'Withdrawal-rate guardrail: one year\'s cut, raise or hold of the discretionary multiplier',
    purpose: 'The Guyton-Klinger-style decision that rations discretionary spending when the withdrawal rate leaves its band.',
    kind: 'model',
    // annualGuardrailFunding.ts writes decision.multiplier as the year's
    // discretionaryMultiplier, which annualExpenseSummary publishes unchanged
    // as YearResult.expenses.guardrailFactor. The Monte Carlo counts each
    // year's action and takes 1 - guardrailFactor as the year's cut depth
    // (montecarlo/run.ts), so both aggregates are fed by this decision.
    outputs: ['spending-guardrail-factor-annual'],
    feeds: ['monte-carlo-guardrail-action-counts', 'monte-carlo-max-cut-depth-percentiles'],
    statement:
      'upper = (upperGuardrailPct ?? 120)/100; lower = (lowerGuardrailPct ?? 80)/100; adj = (adjustmentPct ?? 10)/100; prev = clamp(prevMultiplier) into [0, max(0, maxMultiplier)] with maxMultiplier defaulting to 1 and a non-finite prev read as min(1, that ceiling). When startingRate is not > 0, or currentRate is not finite or is negative: hold at prev. Otherwise ratio = currentRate/startingRate. ratio > upper: multiplier = clamp(prev - adj), action "cut" when it fell by more than 1e-9, else "hold". ratio < lower: multiplier = clamp(prev + adj), action "raise" when it rose by more than 1e-9, else "hold". Otherwise hold. Units: the multiplier is a fraction of the discretionary layer; the rates are ratios of target spending to the start-of-year portfolio whose units cancel. Rounding: none.',
    formula: {
      expression: 'ratio = current/starting; m = clamp(prev - adj) if ratio > upper; m = clamp(prev + adj) if ratio < lower; m = prev otherwise; clamp into [0, maxMultiplier]',
      variables: [
        { symbol: 'prev', meaning: 'Last year\'s discretionary multiplier', unit: '1', domain: 'clamped into [0, maxMultiplier]' },
        { symbol: 'current, starting', meaning: 'This year\'s and the first year\'s withdrawal rate', unit: '1', domain: 'starting > 0, current >= 0 and finite' },
        { symbol: 'upper, lower', meaning: 'Band edges as fractions of the starting rate', unit: '1', domain: 'defaults 1.2 and 0.8' },
        { symbol: 'adj', meaning: 'Step size as a fraction of the full discretionary layer', unit: '1', domain: 'default 0.1' },
        { symbol: 'm', meaning: 'This year\'s discretionary multiplier', unit: '1', domain: '0 <= m <= maxMultiplier' },
      ],
      timing: 'once per projection year, before the funding fixed point',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/withdrawal-rate-guardrail-step.md',
    },
    limits: [
      'The signal is gross recurring target spending over the start-of-year portfolio, not the net portfolio draw: a documented simplification that keeps the rule non-circular with the spending it decides',
      'The step is a fixed adjustmentPct of the full discretionary layer, not a percentage of the previous multiplier',
      'A cut or raise the clamp absorbs is reported as hold, so downstream counts reflect real moves only',
      'clampRange is module-private; the evidence reaches it through nextGuardrailMultiplier',
      'The Monte Carlo counts each year\'s action (run.ts) and takes 1 - guardrailFactor as the year\'s cut depth, so both aggregates are fed by this decision',
    ],
    implementedBy: ['packages/engine/src/spending/guardrails.ts'],
    implementedByFunctions: [
      'packages/engine/src/spending/guardrails.ts#nextGuardrailMultiplier',
      'packages/engine/src/spending/guardrails.ts#clampRange',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'balance-risk-guardrail-step': {
    title: 'Risk-based guardrail: one year\'s cut, raise or hold against real-balance thresholds',
    purpose: 'The decision that rations discretionary spending when the deflated portfolio leaves its solved balance band.',
    kind: 'model',
    // Same publication as the withdrawal-rate step: the multiplier is the
    // year's guardrailFactor and the action feeds the Monte Carlo aggregates.
    // The dollar thresholds the pages print are this step's threshold terms,
    // published by guardrailThresholdDollars since B2-P1 slice 2.
    outputs: ['spending-guardrail-factor-annual'],
    feeds: [
      'monte-carlo-guardrail-action-counts',
      'monte-carlo-max-cut-depth-percentiles',
      'display-guardrail-balance-thresholds',
    ],
    statement:
      'adj = (adjustmentPct ?? 10)/100; prev = clamp(prevMultiplier) into [0, max(0, maxMultiplier)]. When startingBalance is not > 0, or currentRealBalance is not finite or is negative: hold at prev. lower = (lowerBalanceThresholdPct/100) x startingBalance when that percent is supplied and > 0, else null; upper likewise from upperBalanceThresholdPct. When both are set and lower >= upper: hold. currentRealBalance < lower: multiplier = clamp(prev - adj), action "cut" when it fell by more than 1e-9, else "hold". currentRealBalance > upper: multiplier = clamp(prev + adj), action "raise" when it rose by more than 1e-9, else "hold". Otherwise hold. Units: balances in real (deflated) dollars; thresholds as percent of the starting real portfolio; the multiplier a fraction. Rounding: none. annualGuardrailFunding.ts deflates the start-of-year portfolio by the year\'s inflation factor and anchors startingBalance at the first solvent year\'s real portfolio.',
    formula: {
      expression: 'L = l/100 x S, U = u/100 x S; m = clamp(prev - adj) if B < L; m = clamp(prev + adj) if B > U; m = prev otherwise, and always when L or U is unset or L >= U',
      variables: [
        { symbol: 'B', meaning: 'This year\'s real start-of-year portfolio', unit: 'usd, real', domain: 'B >= 0 and finite' },
        { symbol: 'S', meaning: 'The starting real portfolio the thresholds are scaled from', unit: 'usd, real', domain: 'S > 0' },
        { symbol: 'l, u', meaning: 'Lower and upper thresholds as percent of S', unit: 'percent', domain: 'each > 0 when set; l < u' },
        { symbol: 'adj', meaning: 'Step size as a fraction of the full discretionary layer', unit: '1', domain: 'default 0.1' },
        { symbol: 'm', meaning: 'This year\'s discretionary multiplier', unit: '1', domain: '0 <= m <= maxMultiplier' },
      ],
      timing: 'once per projection year, before the funding fixed point',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/balance-risk-guardrail-step.md',
    },
    limits: [
      'Thresholds come from the shared-path solver (montecarlo/riskBasedGuardrails.ts); a policy whose thresholds are absent, zero or inverted holds, so the mode never acts on unsolved numbers',
      'The dollar thresholds the pages print (display-guardrail-balance-thresholds) are this step\'s L and U on the first-year anchor, published by montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars (the record guardrail-threshold-dollars); at a zero starting balance the anchor is the first year the portfolio has a balance, which only a simulation knows',
      'Same fixed step and clamp semantics as the withdrawal-rate step; clampRange is module-private and reached through nextBalanceGuardrailMultiplier',
      'The Monte Carlo action counts and cut-depth percentiles aggregate this decision\'s action and multiplier exactly as they do for the withdrawal-rate mode',
    ],
    implementedBy: ['packages/engine/src/spending/guardrails.ts'],
    implementedByFunctions: [
      'packages/engine/src/spending/guardrails.ts#nextBalanceGuardrailMultiplier',
      'packages/engine/src/spending/guardrails.ts#clampRange',
    ],
    verifiedOn: '2026-09-27',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'spending-shape-annual-delta-phases': {
    title: 'Annual real spending drift compiled to five-year phase rows',
    purpose: 'Turns a steady %/yr real spending change into the editable phase multipliers a plan stores.',
    kind: 'model',
    // No engine module calls this function: the planner-ui SpendingSection
    // writes its rows into expenses.phases (which scale base spending) and the
    // solver page runs the sustainable-spending solver per shape on them, so
    // the named families are fed through the plan data the UI writes.
    outputs: [],
    feeds: [
      'spending-base-annual',
      'spending-shape-delta-vs-flat',
      'sustainable-spending-result-max-base-annual',
      'sustainable-spending-result-spending-slack-dollars',
    ],
    statement:
      'deltaPct = 0 returns no phases. startAge = min(max(round(retirementAge), 40), 105). For age = startAge + 5, startAge + 10, ... while age <= 100: multiplier = (1 + deltaPct/100)^(age - startAge), rounded to two decimals as Math.round(x x 100)/100 and clamped into [0, 3]; each row is { fromAge: age, multiplier }. Units: fromAge in years of the person the phases follow (expenses.phasesAgeOf; spending-phase-person); multiplier a factor on baseAnnual. Rounding: two decimals per row, as stated.',
    formula: {
      expression: 'm(age) = clamp(round2((1 + d/100)^(age - a0)), 0, 3) for age = a0 + 5k <= 100, k >= 1, a0 = clamp(round(retirementAge), 40, 105)',
      variables: [
        { symbol: 'd', meaning: 'Annual real spending change', unit: 'percent/year', domain: 'finite; 0 emits no rows' },
        { symbol: 'a0', meaning: 'Rounded, clamped retirement age the steps count from', unit: 'years', domain: '40 <= a0 <= 105' },
        { symbol: 'age', meaning: 'A phase row\'s fromAge', unit: 'years', domain: 'a0 + 5, a0 + 10, ... <= 100' },
        { symbol: 'm(age)', meaning: 'Multiplier on baseAnnual from that age', unit: '1', domain: '0 <= m <= 3, two decimals' },
      ],
      timing: 'compiled once when the shape is chosen; the rows then hold flat between step ages',
      rounding: 'two decimals per multiplier (Math.round(x x 100)/100)',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shape-annual-delta-phases.md',
    },
    limits: [
      'On the amortization-based-withdrawal path the compiled phases do not reach spending-base-annual: annualLifestyleLayers scales the base by the phase multiplier and then, when ABW is active, replaces it with abwAnnualPayment and zeroes the other lifestyle layers. The feed holds on the ordinary lifestyle path, for spending-shape-delta-vs-flat and for the sustainable-spending solver, which run shapes as plan data.',
      'Five-year steps hold the fully compounded multiplier flat between step ages, an editable approximation to annual drift',
      'The first row is one step after retirement, never at retirement age itself',
      'Retirement age is rounded and clamped into [40, 105] so every row satisfies the phase schema (fromAge 40..110, multiplier 0..3)',
      'The rows are plan data: the planner-ui SpendingSection writes them into expenses.phases and the solver page runs the sustainable-spending solver per shape; no engine module calls this function, so the named families are fed through the plan the UI writes',
    ],
    implementedBy: ['packages/engine/src/spending/shapePresets.ts'],
    implementedByFunctions: ['packages/engine/src/spending/shapePresets.ts#annualDeltaPhases'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'spending-shape-preset-compilation': {
    title: 'Named spending shapes compiled to phase rows',
    purpose: 'What phase rows the flat, smile, front-loaded and smirk presets write into a plan.',
    kind: 'model',
    // Same publication path as the delta compilation: the UI writes the rows
    // into expenses.phases (base spending) and the solver page evaluates each
    // shape against flat.
    outputs: [],
    feeds: ['spending-shape-delta-vs-flat', 'spending-base-annual'],
    statement:
      '"flat" returns no phases. "smile" returns [{ fromAge: 75, multiplier: 0.9 }, { fromAge: 85, multiplier: 0.8 }] independent of retirement age. "smirk" returns annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_PCT = -1, retirementAge). "frontLoaded": boostFrom = min(max(retirementAge, 40), 100); boostFrom >= 75 returns no phases, else [{ fromAge: boostFrom, multiplier: 1.1 }, { fromAge: 75, multiplier: 1 }]. Units: fromAge in years; multiplier a factor on baseAnnual. Rounding: none here; the smirk rows carry annualDeltaPhases\'s two-decimal rounding.',
    formula: {
      expression: 'flat: []; smile: [(75, 0.9), (85, 0.8)]; smirk: annualDeltaPhases(-1, retirementAge); frontLoaded: [(clamp(retirementAge, 40, 100), 1.1), (75, 1)] when that age < 75, else []',
      variables: [
        { symbol: 'shape', meaning: 'The preset id', unit: 'enum', domain: 'flat | smile | frontLoaded | smirk' },
        { symbol: 'retirementAge', meaning: 'The retirement age of the person the phases follow (expenses.phasesAgeOf)', unit: 'years', domain: 'finite' },
        { symbol: 'rows', meaning: 'The phase rows written into expenses.phases', unit: 'rows', domain: 'each within the phase schema' },
      ],
      timing: 'compiled once when the preset is chosen; never re-evaluated for a saved plan',
      rounding: 'none (smirk inherits the two-decimal rows)',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shape-preset-compilation.md',
    },
    limits: [
      'On the amortization-based-withdrawal path the compiled phases do not reach spending-base-annual: annualLifestyleLayers scales the base by the phase multiplier and then, when ABW is active, replaces it with abwAnnualPayment and zeroes the other lifestyle layers. The feed holds on the ordinary lifestyle path, for spending-shape-delta-vs-flat and for the sustainable-spending solver, which run shapes as plan data.',
      'Presets compile to visible phase rows at creation time and never live-link a saved plan to the research constants; changing SMIRK_ANNUAL_REAL_DELTA_PCT changes only newly compiled plans',
      'The smile calibration is a two-step approximation of Blanchett\'s average path without an explicit late-life step-up',
      'frontLoaded passes the retirement age through unrounded (clamped into [40, 100]) while the smirk path rounds it',
      'No engine module calls this function; the UI writes the rows into expenses.phases and the solver page evaluates each shape, so the named families are fed through plan data',
    ],
    implementedBy: ['packages/engine/src/spending/shapePresets.ts'],
    implementedByFunctions: [
      'packages/engine/src/spending/shapePresets.ts#spendingShapePhases',
      'packages/engine/src/spending/shapePresets.ts#SMIRK_ANNUAL_REAL_DELTA_PCT',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'sepp-active-annual-rule': {
    title: 'SEPP active in an attained-age year',
    purpose: 'Decide whether a 72(t) series is still running in a given attained-age year.',
    kind: 'model',
    outputs: [],
    feeds: ['sepp-distribution-annual'],
    statement:
      'strategies/sepp.ts#seppActive treats a SEPP as active in an attained-age year at or after the start age only while EITHER the age-60 boundary or the five-year duration is still unsatisfied, implementing the statutory "longer of five years or until 59.5" at annual granularity with age 60 as the engine\'s stated approximation of 59.5; projection/internal/annualSeppDistributions.ts#annualSeppDistributions consults it before distributing. Units: a boolean per owner-year. Rounding: none; whole attained ages.',
    formula: {
      expression: 'active(startAge, age) = age >= startAge and (age < 60 or age - startAge < 5)',
      variables: [
        { symbol: 'startAge', meaning: 'Attained age at which the series began', unit: 'years', domain: 'integer' },
        { symbol: 'age', meaning: 'Attained age in the evaluated year', unit: 'years', domain: 'integer' },
      ],
      timing: 'once per owner-year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/sepp-active-annual-rule.md',
    },
    limits: [
      'Age 60 is an explicit annual approximation of 59.5: the annual model carries no half-year ages, so a series statute would end midyear ends at the year boundary here',
      'Busting the series is not modeled: the engine assumes the schedule is honored and charges no retroactive penalties',
      'The rule decides whether the series runs, not how much it pays; the two method records carry the amounts',
    ],
    implementedBy: [
      'packages/engine/src/strategies/sepp.ts',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/strategies/sepp.ts#seppActive',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts#annualSeppDistributions',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'sepp-amortization-method': {
    title: 'SEPP amortization-method annual amount',
    purpose: 'Fix the annual 72(t) payment from the first-year balance as an ordinary annuity over the Single Life term.',
    kind: 'model',
    outputs: ['sepp-distribution-annual'],
    feeds: [],
    statement:
      'strategies/sepp.ts#seppAnnualAmount fixes the amortization-method annual SEPP from the first-year balance as an ordinary-annuity payment over the Single Life Table term at the selected annual rate, with the module\'s default 5% carried by SEPP_AMORTIZATION_RATE_PCT to satisfy the Notice 2022-6 section 3.02(c) greater-of-5%-or-120%-mid-term ceiling in every rate environment. A zero rate degenerates to balance divided by the term. Units: nominal USD per year. Rounding: none; the result is a binary float compared to cents.',
    formula: {
      expression: 'A = B r / (1 - (1 + r)^(-n)), and B / n when r = 0',
      variables: [
        { symbol: 'B', meaning: 'First SEPP year balance', unit: 'usd', domain: 'positive; a nonpositive balance pays 0' },
        { symbol: 'r', meaning: 'Annual rate as a fraction, ratePct / 100', unit: '1', domain: 'r >= 0' },
        { symbol: 'n', meaning: 'Single Life Table term for the start age, year2026.rmd.singleLifeTable', unit: 'years', domain: 'positive' },
      ],
      timing: 'fixed once at the first SEPP year and held for the series',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/sepp-amortization-method.md',
    },
    limits: [
      'The payment is FIXED at the first year: recomputing it from a later balance would make a supposedly fixed amortization payment vary',
      'Single Life is the engine\'s stated convention among the three tables Notice 2022-6 permits, and it is the shortest at every age, so this sizes the largest payment any permitted table would allow rather than the smallest; no beneficiary-specific table election is claimed',
      'The 5% rate is the module default and clears the statutory ceiling; a caller may pass a different permitted rate',
    ],
    implementedBy: ['packages/engine/src/strategies/sepp.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/sepp.ts#seppAnnualAmount',
      'packages/engine/src/strategies/sepp.ts#SEPP_AMORTIZATION_RATE_PCT',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'orchestrator' },
  },
  'sepp-rmd-method': {
    title: 'SEPP RMD-method annual amount',
    purpose: 'Recompute the annual 72(t) payment each year from the current balance and the Single Life divisor.',
    kind: 'composition',
    outputs: ['sepp-distribution-annual'],
    feeds: [],
    statement:
      'strategies/sepp.ts#seppAnnualAmount computes the SEPP RMD-method annual payment as the current start-of-year balance divided by the Single Life Table entry for the attained age, recomputed every year. Because both the balance and the age are reread, the payment is not fixed. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'A = B / d, where d = singleLifeTable[floor(age)]',
      variables: [
        { symbol: 'B', meaning: 'Current start-of-year balance', unit: 'usd', domain: 'positive; a nonpositive balance pays 0' },
        { symbol: 'd', meaning: 'Single Life Table divisor for the attained age', unit: 'years', domain: 'positive' },
      ],
      timing: 'once per SEPP year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/sepp-rmd-method.md',
    },
    limits: [
      'The Uniform Lifetime Table is not an alternative here: the published parameters carry no age-55 entry for it, and the module adopts Single Life for both supported methods',
      'The published entry is taken as published; a fractional age is floored to the table\'s whole age rather than interpolated',
      'Unlike the amortization method this payment varies year to year, so a test that holds it constant is asserting the wrong method',
    ],
    implementedBy: ['packages/engine/src/strategies/sepp.ts'],
    implementedByFunctions: ['packages/engine/src/strategies/sepp.ts#seppAnnualAmount'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'spending-total-annual': {
    title: 'Annual net expense total',
    purpose: 'The year\'s actual net outflow, and which expense members compose it.',
    kind: 'composition',
    outputs: ['spending-total-annual'],
    feeds: ['portfolio-need-annual', 'display-total-spending-annual'],
    statement:
      'projection/internal/annualExpenseSummary.ts#annualExpenseSummary publishes projection/internal/types/yearLedger.ts#YearExpenses.total as baseSpending + oneTimeGoals + debtService + propertyCosts + healthcare + insurancePremiums + careCost - ltcBenefit, kept in that left-to-right association because regrouping the LTC pair can move the last bit. careCost is gross and ltcBenefit offsets it. guardrailFactor is descriptive: the cut is already inside baseSpending and is never multiplied in again. requiredSpending, targetSpending, idealSpending, excessSpending and intendedSpending are overlapping layer summaries, not additional members, and intendedSpending is the no-cut request and need not equal this total. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'total = baseSpending + oneTimeGoals + debtService + propertyCosts + healthcare + insurancePremiums + careCost - ltcBenefit',
      variables: [
        { symbol: 'baseSpending', meaning: 'Recurring lifestyle spending already net of the guardrail cut', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'oneTimeGoals', meaning: 'One-time goals funded this year', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'careCost, ltcBenefit', meaning: 'Gross care-episode cost and the policy benefit offsetting it', unit: 'usd/year', domain: 'nonnegative; the benefit is subtracted' },
        { symbol: 'guardrailFactor', meaning: 'Discretionary multiplier already applied inside baseSpending', unit: '1', domain: 'descriptive only' },
      ],
      timing: 'once per projection year, at the expense summary',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-total-annual.md',
    },
    limits: [
      'Asserted at the annualExpenseSummary seam with the worksheet\'s eight member amounts, because the worksheet states them as published year-row components: a single real plan cannot present a chosen base spending, one-time goal, debt service, property cost, healthcare charge, insurance premium, gross care cost and LTC benefit at those exact values simultaneously',
      'Cross-checked on a real simulatePlan run: the published total of that year row equals the same row\'s own eight published members in the same association',
      'The guardrail factor and intended spending are asserted NOT to enter: the test drives the seam with a factor of 0.90 and an intended request of $100,000 and shows neither changes the total',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualExpenseSummary.ts',
      'packages/engine/src/projection/internal/types/yearLedger.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualExpenseSummary.ts#annualExpenseSummary',
      'packages/engine/src/projection/internal/types/yearLedger.ts#YearExpenses.total',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'spending-phase-person': {
    title: 'Whose age the spending phases follow',
    purpose: 'The phase multiplier follows the person the plan names, never whoever is listed first.',
    kind: 'model',
    outputs: [],
    feeds: ['spending-base-annual'],
    statement:
      'projection/internal/annualLifestyleLayers.ts#annualLifestyleLayers multiplies the base lifestyle by the multiplier of the last phase, phases stably sorted by fromAge, whose fromAge is at or below the attained age of the person expenses.phasesAgeOf names (annualExpenseAssemblyPhase passes phasesPersonId = phasesAgeOf, else the only person); the phases keep that person\'s age after that person dies (decision D-PEOPLE-ORDER, rule R1). No law says whose age a household\'s spending shape follows, so the household names the person and the Spending page shows the name; schema v7 requires it in a two-person plan with phases, and plans saved earlier are given the person then listed first, whose age their phases already followed, so no stored figure moves. Units: a factor on baseAnnual. Rounding: none.',
    formula: {
      expression: 'multiplier = phases sorted by fromAge; last p with age(phasesAgeOf) >= p.fromAge; else 1',
      variables: [
        { symbol: 'age(phasesAgeOf)', meaning: 'Attained age of the named person this year', unit: 'years', domain: 'integer' },
      ],
      timing: 'once per projection year, in the expense assembly',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-phase-person.md',
    },
    limits: [
      'A convention the household chooses, stated on the Spending page; the presets (spending-shape-preset-compilation, spending-shape-comparison) start at the named person\'s retirement age',
      'A JSON file whose people were reordered by another tool before it was ever loaded at v7 is read by position that one time: its intent was never stored',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualLifestyleLayers.ts',
      'packages/engine/src/projection/internal/annualExpenseAssemblyPhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualLifestyleLayers.ts#annualLifestyleLayers',
      'packages/engine/src/projection/internal/annualExpenseAssemblyPhase.ts#annualExpenseAssemblyPhase',
    ],
    verifiedOn: '2026-09-28',
    provenance: { derivedBy: 'claude', implementedBy: 'claude', reviewedBy: 'unreviewed' },
  },
  'spending-base-annual': {
    title: 'Annual base spending after the guardrail cut',
    purpose: 'Recurring lifestyle spending actually intended once the guardrail has rationed the target layer.',
    kind: 'composition',
    outputs: ['spending-base-annual'],
    feeds: ['spending-total-annual'],
    statement:
      'projection/internal/annualGuardrailFunding.ts#annualGuardrailFundingPlan computes targetLifestyleFunded as targetLifestyle x min(1, discretionaryMultiplier) while guardrails are active, and the full targetLifestyle otherwise; projection/internal/annualExpenseSummary.ts#annualExpenseSummary then publishes projection/internal/types/yearLedger.ts#YearExpenses.baseSpending as requiredLifestyle + targetLifestyleFunded + idealLifestyleFunded + excessLifestyleFunded. The cap keeps a multiplier above one from inflating the target layer; upside instead reaches the separately funded ideal and excess layers. One-time goals and the system-computed costs are excluded; expenses.total adds them. The same multiplier is published unchanged as expenses.guardrailFactor. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'baseSpending = requiredLifestyle + targetLifestyle * min(1, guardrailFactor) + idealLifestyleFunded + excessLifestyleFunded',
      variables: [
        { symbol: 'requiredLifestyle', meaning: 'Required-floor lifestyle layer, never cut', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'targetLifestyle', meaning: 'Full target lifestyle layer before the cut', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'guardrailFactor', meaning: 'This year\'s discretionary multiplier', unit: '1', domain: 'nonnegative; capped at 1 for this term' },
        { symbol: 'idealLifestyleFunded, excessLifestyleFunded', meaning: 'Upside layers funded this year', unit: 'usd/year', domain: 'nonnegative' },
      ],
      timing: 'once per projection year, after the guardrail decision and before the funding fixed point',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-base-annual.md',
    },
    limits: [
      'The same published field is also the output of abw-annuity-due-payment, which computes it under the ABW spending policy; this record is the guardrail-policy composition of the same field, so the family carries two records rather than one',
      'The worksheet\'s two cases are states annualGuardrailFundingPlan produces, and the evidence runs the real phase for a live household: a cutting year holding an incoming 0.75 (its withdrawal rate at its starting rate, so the policy holds, as in any year after a cut), where the phase funds the target layer at the factor and no upside because the upside budget is max(0, multiplier - 1) x the guardrail step basis; and a year with no policy active, where the full target layer and both upside layers fund. The first derivation paired a 0.75 cut with $4,000 of funded ideal and $1,500 of funded excess, which the YearExpenses.baseSpending comment rules out; it was re-derived on 2026-09-22 and re-approved by the reviewer, and the min(1, factor) cap is also asserted at a held multiplier of 1.4',
      'The $8,000 one-time goal is passed to annualExpenseSummary beside the phase\'s funded layers and asserted to be absent from baseSpending while present in expenses.total, which is the worksheet\'s second wrong reading',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualExpenseSummary.ts',
      'packages/engine/src/projection/internal/annualGuardrailFunding.ts',
      'packages/engine/src/projection/internal/types/yearLedger.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualExpenseSummary.ts#annualExpenseSummary',
      'packages/engine/src/projection/internal/annualGuardrailFunding.ts#annualGuardrailFundingPlan',
      'packages/engine/src/projection/internal/types/yearLedger.ts#YearExpenses.baseSpending',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'withdrawals-total-annual': {
    title: 'Annual withdrawal total',
    purpose: 'The single figure for everything drawn from the portfolio this year.',
    kind: 'composition',
    outputs: ['withdrawals-total-annual'],
    statement:
      'projection/internal/types/yearLedger.ts#YearWithdrawals.total is cash + taxable + traditional + roth + hsa for the published year row. projection/internal/annualWithdrawalPlanning.ts#annualWithdrawalPlan folds the planned categories into byCategory.total in that operand order, and projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase publishes the reported total as that planned total plus the forced amounts each category also carries: the RMD and SEPP totals, the inherited distributions and the retirement-action proceeds. Each forced inherited dollar is in exactly one category, traditional for a traditional account and roth for a Roth account, the taxable earnings of a non-qualified inherited Roth distribution included (decision D-INHERITED-ROTH-SLICE, 2026-09-25; before it those earnings were also added to traditional, and the categories exceeded the total by them). Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'total = cash + taxable + traditional + roth + hsa',
      variables: [
        { symbol: 'cash, taxable, traditional, roth, hsa', meaning: 'Published withdrawal totals by source-account category', unit: 'usd/year', domain: 'nonnegative' },
      ],
      timing: 'once per projection year, at the funding-and-close phase',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/withdrawals-total-annual.md',
    },
    limits: [
      'Asserted on a real simulatePlan run whose five accounts hold exactly the worksheet\'s five category amounts and whose spending exceeds their sum, so sequential ordering drains every one of them and the published categories are the worksheet\'s. Plan assumptions beyond the worksheet\'s inputs: a single 76-year-old filing single in KY with a zero state rate, zero inflation, zero account return, no taxable yield, cost basis equal to balance, sequential withdrawal order, and a base lifestyle far above the portfolio, so the year also publishes a shortfall',
      'The year\'s traditional draw includes an RMD, so the test also asserts that the published total is the five categories and not the five categories with the RMD added again',
      'Roth dollars are a member like any other; subtracting them as a tax offset is the worksheet\'s second wrong reading',
      'The worksheet\'s plan carries no inherited account. The identity in a year with a non-qualified inherited Roth distribution (two 100 Roth draws with 140 of taxable earnings beside a 100 traditional draw: traditional 100, roth 200, total 300) is held by a projection test that checks the five categories add to the total in that year (projection/simulate.inheritedRegimeExecution.test.ts), added with decision D-INHERITED-ROTH-SLICE on 2026-09-25, when traditional stopped carrying the Roth earnings',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/yearLedger.ts',
      'packages/engine/src/projection/internal/annualWithdrawalPlanning.ts',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/yearLedger.ts#YearWithdrawals.total',
      'packages/engine/src/projection/internal/annualWithdrawalPlanning.ts#annualWithdrawalPlan',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'withdrawals-by-category-annual': {
    title: 'Annual withdrawals partitioned by source-account category',
    purpose: 'Which bucket each withdrawn dollar is reported in, and which named amounts are subsets rather than extra categories.',
    kind: 'composition',
    outputs: ['withdrawals-by-category-annual'],
    feeds: ['withdrawals-total-annual'],
    statement:
      'projection/internal/types/yearLedger.ts#YearWithdrawals partitions the year\'s draws by SOURCE ACCOUNT category in the sequential order cash, taxable, traditional, roth, hsa. projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase assembles the reported vector: traditional carries the planned traditional draw plus the owner RMD total, the SEPP total and the forced dollars executed from inherited traditional accounts; roth carries the planned Roth draw plus forced inherited Roth dollars, taxable earnings included; cash and taxable carry the retirement-action cash, equity-compensation and taxable proceeds. The separately published rmd, sepp and inheritedDistribution are SUBSETS of those categories, not extra categories and not amounts to add again; inheritedTraditionalDistribution is the ordinary income from inherited accounts, whose traditional rows are inside traditional and whose non-qualified Roth earnings, if any, are inside roth (decision D-INHERITED-ROTH-SLICE, 2026-09-25). Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'traditional = plannedTraditional + rmdTotal + seppTotal + inheritedTraditionalForced; roth = plannedRoth + inheritedRothForced; hsa = plannedHsa; cash and taxable add the retirement-action proceeds',
      variables: [
        { symbol: 'plannedX', meaning: 'The withdrawal planner\'s draw from category X', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'rmdTotal, seppTotal', meaning: 'Forced owner distributions, reported inside traditional', unit: 'usd/year', domain: 'nonnegative subsets' },
        { symbol: 'inheritedTraditionalForced, inheritedRothForced', meaning: 'Forced inherited dollars, split by the type of the inherited account they are withdrawn from', unit: 'usd/year', domain: 'nonnegative subsets' },
      ],
      timing: 'once per projection year, at the funding-and-close phase',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/withdrawals-by-category-annual.md',
    },
    limits: [
      'Asserted on a real simulatePlan run whose five accounts hold exactly the worksheet\'s five category amounts and whose spending exceeds their sum, so each account drains and its category equals its own opening balance. Plan assumptions beyond the worksheet\'s inputs: a single 76-year-old filing single in KY with a zero state rate, zero inflation, zero account return, no taxable yield, cost basis equal to balance, sequential withdrawal order, and a base lifestyle far above the portfolio',
      'The worksheet\'s stated subset split ($8,000 of RMD, $3,000 of SEPP, $2,000 of forced inherited traditional inside $18,000 of traditional, and $1,000 of forced inherited Roth inside $7,000 of Roth) is NOT constructed. Those four amounts are each determined by the engine from age, balance and beneficiary facts, and no plan sets them to chosen values inside a traditional draw that must also equal $18,000. The run\'s own RMD is asserted instead to be a nonzero subset of the published traditional category, which is the claim the worksheet\'s first wrong reading denies',
      'HSA is a withdrawal category like the other four, not a sixth non-withdrawal bucket',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/yearLedger.ts',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/yearLedger.ts#YearWithdrawals',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'portfolio-need-annual': {
    title: 'Annual net portfolio need',
    purpose: 'What the portfolio has to supply this year, floored so a surplus is never reported as a need.',
    kind: 'composition',
    outputs: ['portfolio-need-annual'],
    feeds: ['spending-shortfall-annual'],
    statement:
      'projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly publishes projection/internal/types/result.ts#YearResult.netPortfolioNeed as Math.max(0, expenses.total + tax + penalties - incomes.total), computed from the committed ledger totals and the settled tax and penalty scalars at the end of the annual pass. It is what the year REQUIRED, not what the portfolio managed to supply: a year that cannot fund it still publishes the need and records the gap in shortfall. A year whose incomes cover every outflow publishes exactly 0. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'netPortfolioNeed = max(0, expenses.total + tax + penalties - incomes.total)',
      variables: [
        { symbol: 'expenses.total', meaning: 'The year\'s net outflow', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'tax, penalties', meaning: 'Settled tax and the penalty scalar, which is not inside tax', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'incomes.total', meaning: 'The year\'s cash income', unit: 'usd/year', domain: 'nonnegative' },
      ],
      timing: 'once per projection year, published last in the year-result assembly',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/portfolio-need-annual.md',
    },
    limits: [
      'Asserted at annualYearResultAssembly, the function that computes the field, with the worksheet\'s four year-row components, and separately on a real simulatePlan run where the published need equals its own row\'s published expenses, tax, penalties and incomes',
      'The floor case the worksheet names (the same outflows against $120,000 of income) is asserted at the same function, because the published need must be exactly 0 rather than the negative surplus',
      'Penalties are a separate term from tax and are not inside it; omitting them is the worksheet\'s first wrong reading',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualYearResultAssembly.ts',
      'packages/engine/src/projection/internal/types/result.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.netPortfolioNeed',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'spending-shortfall-annual': {
    title: 'Annual funding shortfall after the HECM backstop',
    purpose: 'What the year could not fund once every withdrawal and any reverse-mortgage draw had been applied.',
    kind: 'composition',
    outputs: ['spending-shortfall-annual'],
    statement:
      'projection/internal/annualHecmBackstop.ts#annualHecmBackstopPlan publishes shortfallAfterHecm = Math.max(0, portfolioShortfall - draw), the value the year publishes as projection/internal/types/result.ts#YearResult.shortfall: the funding gap that remains after every withdrawal AND any HECM backstop draw. projection/internal/types/result.ts#ProjectionResult.depletionYear is the first year this exceeds projection/moneyTolerance.ts#ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS, the ledger\'s own half-cent residual budget; a residual at or below that budget is not depletion. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'shortfall = max(0, needAfterWithdrawals - hecmDraw); depletionYear = first year with shortfall > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS',
      variables: [
        { symbol: 'needAfterWithdrawals', meaning: 'Funding gap left after every withdrawal', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'hecmDraw', meaning: 'Tax-free HECM line-of-credit proceeds drawn as a backstop', unit: 'usd/year', domain: 'nonnegative; 0 without a HECM' },
        { symbol: 'ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS', meaning: 'The ledger\'s accepted annual residual', unit: 'usd', domain: 'half a cent' },
      ],
      timing: 'once per projection year, after the funding fixed point and the HECM backstop',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shortfall-annual.md',
    },
    limits: [
      'Asserted on a real simulatePlan run that realizes the worksheet\'s four inputs: a $10,000 cash account, a $12,000 lifestyle need, and a last-resort HECM whose principal limit is exactly $1,500, leaving the worksheet\'s $500. Plan assumptions beyond the worksheet\'s inputs: a single 64-year-old filing single in KY with a zero state rate, zero inflation, zero account and property return, a zero pre-65 premium so healthcare charges nothing, a primary residence worth $30,000 carrying the HECM at the schema\'s minimum 5 percent principal limit with a zero growth rate, and no earlier projection year, so the worksheet\'s "earlier-year shortfalls 0" holds by construction',
      'The worksheet declines to state the depletion tolerance numerically, so the test imports ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS from production, confirms the $500 exceeds it, and only then asserts the run\'s depletionYear',
      'The year\'s pre-HECM gap is asserted separately from the published figure, because publishing the pre-HECM gap is the worksheet\'s first wrong reading',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualHecmBackstop.ts',
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/moneyTolerance.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualHecmBackstop.ts#annualHecmBackstopPlan',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.shortfall',
      'packages/engine/src/projection/moneyTolerance.ts#ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'display-total-spending-annual': {
    title: 'Total spending with tax and penalties',
    purpose: 'Everything the year paid out, as the spending line of the balance chart and the report chart show it.',
    kind: 'composition',
    outputs: ['display-total-spending-annual'],
    feeds: [

    ],
    statement: 'projection/yearFigures.ts#spendingWithTaxAndPenalties publishes expenses.total + tax + penalties for the year, summed left to right: (expenses.total + tax) + penalties, the same composite the FI number\'s spending base uses. Units: nominal USD of the year. Rounding: none.',
    formula: {
      expression: 'spending = (expenses.total + tax) + penalties',
      variables: [
        { symbol: 'expenses.total', meaning: 'Funded spending after guardrail cuts, net of the LTC benefit', unit: 'usd per year', domain: 'nonnegative' },
        { symbol: 'tax', meaning: 'Settled tax of the year', unit: 'usd per year', domain: 'finite' },
        { symbol: 'penalties', meaning: 'Early-withdrawal penalty plus IRC 4974 excise', unit: 'usd per year', domain: 'nonnegative' },
      ],
      timing: 'annual',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/display-total-spending-annual.md',
    },
    limits: [
      'Gross of incomes: it is what the year paid out, not what the portfolio had to supply (portfolio-need-annual)',
      'The association is part of the figure: expenses.total + (tax + penalties) differs in the last binary digit on some inputs (40,477.35, 18,353.95 and 539.21 give 59,370.51 left to right and 59,370.509999999995 grouped the other way)',
    ],
    implementedBy: [
      'packages/engine/src/projection/yearFigures.ts',
      'packages/engine/src/projection/compare.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/yearFigures.ts#spendingWithTaxAndPenalties',
      'packages/engine/src/projection/compare.ts#summarizeProjection',
    ],
    verifiedOn: '2026-09-26',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'display-upside-spending-annual': {
    title: 'Upside spending: intended spending above the target layer',
    purpose: 'The ideal and excess spending a layered plan intended in the year, as the Upside column shows it.',
    kind: 'composition',
    outputs: ['display-upside-spending-annual'],
    feeds: [

    ],
    statement: 'projection/yearFigures.ts#upsideSpending publishes expenses.idealSpending + expenses.excessSpending for the year: intended spending above the target layer. Units: nominal USD of the year. Rounding: none.',
    formula: {
      expression: 'upsideSpending = idealSpending + excessSpending',
      variables: [
        { symbol: 'idealSpending', meaning: 'Ideal layer intended above target', unit: 'usd per year', domain: 'nonnegative' },
        { symbol: 'excessSpending', meaning: 'Excess layer intended above ideal', unit: 'usd per year', domain: 'nonnegative' },
      ],
      timing: 'annual',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/display-upside-spending-annual.md',
    },
    limits: [
      'Intended, not funded: a guardrail cut or a portfolio shortfall does not reduce it; the unfunded part is display-upside-shortfall-annual',
    ],
    implementedBy: [
      'packages/engine/src/projection/yearFigures.ts',
      'packages/engine/src/projection/internal/types/yearLedger.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/yearFigures.ts#upsideSpending',
      'packages/engine/src/projection/internal/types/yearLedger.ts#YearExpenses.idealSpending',
      'packages/engine/src/projection/internal/types/yearLedger.ts#YearExpenses.excessSpending',
    ],
    verifiedOn: '2026-09-26',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'display-upside-shortfall-annual': {
    title: 'Upside miss: upside spending not funded',
    purpose: 'The ideal and excess spending the year did not fund, as the Upside part of the Layer miss column shows it.',
    kind: 'composition',
    outputs: ['display-upside-shortfall-annual'],
    feeds: [

    ],
    statement: 'projection/yearFigures.ts#upsideShortfall publishes idealShortfall + excessShortfall for the year. Units: nominal USD of the year. Rounding: none.',
    formula: {
      expression: 'upsideShortfall = idealShortfall + excessShortfall',
      variables: [
        { symbol: 'idealShortfall', meaning: 'Ideal spending not funded', unit: 'usd per year', domain: 'nonnegative' },
        { symbol: 'excessShortfall', meaning: 'Excess spending not funded', unit: 'usd per year', domain: 'nonnegative' },
      ],
      timing: 'annual',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/display-upside-shortfall-annual.md',
    },
    limits: [
      'None beyond the layer attribution\'s own (spending-layer-shortfall-attribution); the page\'s show-or-blank test for the Layer miss cell reads the three engine figures separately rather than adding the four shortfalls, which renders the same cell in every case',
    ],
    implementedBy: [
      'packages/engine/src/projection/yearFigures.ts',
      'packages/engine/src/projection/internal/types/result.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/yearFigures.ts#upsideShortfall',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.idealShortfall',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.excessShortfall',
    ],
    verifiedOn: '2026-09-26',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'solved-spending-rounding': {
    title: 'Sustainable spending rounded down to the hundred',
    purpose: 'The one amount every surface shows, applies and measures slack from once the spending solver has found the highest level that passed.',
    kind: 'formula',
    outputs: ['solved-spending-rounded-to-hundred', 'sustainable-spending-result-max-base-annual'],
    feeds: [
      'sustainable-spending-result-spending-slack-dollars',
      'solved-initial-withdrawal-rate-pct',
      'spending-shape-delta-vs-flat',
    ],
    statement:
      'decisions/spendingSolver.ts#roundSolvedSpending floors a nonnegative amount to a whole multiple of SOLVED_SPENDING_STEP_DOLLARS (100): floor(x / 100) × 100, refusing an amount that is negative or not finite. The solver publishes feasibleBaseAnnual, the highest level that passed (a whole number of dollars), and maxBaseAnnual, that level rounded down to $100, and measures spendingSlackDollars as maxBaseAnnual minus the current base (owner decision R4: one slack everywhere, from the amount shown). Under fixed-target spending the rounded amount is published without a run of its own, on the decision\'s assumption that a lower base does not fail where a higher one passed (measured, not proven; see the limits). Under withdrawal-rate or risk-based guardrails a lower base can fail, so the rounded amount is published only on a run at it that passed: the search\'s own probe at that level when it made one, else one more run after the search; otherwise the solver publishes feasibleBaseAnnual itself, sets maxBaseAnnualRounding to none and adds a sentence to its diagnostics saying why. A rounded amount below the plan\'s required spending is never published. Whether today\'s spending is sustained is sustainsCurrentBase, the verdict of the first probe (today\'s base rounded to a whole dollar, or the required floor rounded up when that is higher), never the sign of the slack. When the rounded amount is published, bestEvaluation and the unpriced premium-credit years still describe the run at feasibleBaseAnnual. For the worksheet\'s case A (levels up to $62,850 pass, current base $40,000) the probes end at $62,813, the published amount is $62,800 and the slack $22,800; under guardrails, with the rounded amount failing, it is $62,813 and $22,813. Units: today\'s dollars per year. Rounding: down to a whole $100.',
    formula: {
      expression: 'M = floor(F / 100) · 100 when that level is known to pass, else M = F; slack = M − current',
      variables: [
        { symbol: 'F', meaning: 'feasibleBaseAnnual, the highest level that passed', unit: 'today USD per year', domain: 'nonnegative whole number' },
        { symbol: 'M', meaning: 'maxBaseAnnual, the published answer', unit: 'today USD per year', domain: 'nonnegative; a multiple of 100 unless published as F' },
        { symbol: 'current', meaning: 'The base spending the solve started from, after any base patch', unit: 'today USD per year', domain: 'nonnegative' },
      ],
      timing: 'once per solve, after the search',
      rounding: 'down to a whole $100; the page prints whole dollars',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/solved-spending-rounded-to-hundred.md',
    },
    limits: [
      'Under fixed-target spending the rounded amount is not run on its own. That it passes is the decision\'s assumption, measured and not proven: every one of the 109 published amounts of the example plans and their shape solves re-simulates feasible, as do 210 fixed-target balance variants (0.70 to 1.30 times) of ten Marketplace-heavy or early-retirement examples, and a scan of every $10 level in the $3,000 below the answer on six Marketplace examples found none that fails. The mechanism it does not exclude is a lower spend dropping the household\'s income below 100 percent of the poverty line, where the premium tax credit is lost and the full premium is budgeted.',
      'When the rounded amount is published, the evidence figures on the spending page and the unpriced premium-credit years describe the run at feasibleBaseAnnual, not a run at the published amount (under guardrails that run also passed, but its own evidence is not published).',
      'Under guardrails a check of the rounded amount that the search did not already make is one more simulation after the search, outside maxSimulations, and it is counted in simulationCount.',
      'A published amount under the current base by less than $100 can belong to a plan that sustains its own spending (the current base passed and is the answer, rounded down); the spending page judges that on feasibleBaseAnnual, and so should any other reader of the slack.',
      'The search resolves to about $500, so answers less than $100 apart can publish the same amount, and a comparison of two plans can tie there.',
    ],
    implementedBy: ['packages/engine/src/decisions/spendingSolver.ts'],
    implementedByFunctions: [
      'packages/engine/src/decisions/spendingSolver.ts#roundSolvedSpending',
      'packages/engine/src/decisions/spendingSolver.ts#solveMaxSustainableSpending',
    ],
    verifiedOn: '2026-09-27',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'solved-initial-withdrawal-rate': {
    title: 'Solved spending as an initial withdrawal rate',
    purpose: 'The solver\'s published answer as a percent of today\'s investable balances, the base the published withdrawal rules apply their rates to.',
    kind: 'formula',
    outputs: ['solved-initial-withdrawal-rate-pct'],
    statement:
      'decisions/spendingSolver.ts#initialWithdrawalRatePct returns (annualSpend / startingInvestable) × 100 in that association, or null when startingInvestable is not positive, and refuses an argument that is not finite or a negative spend. The solver publishes initialWithdrawalRatePct for its published answer maxBaseAnnual over startingInvestableOf of the plan it solved (any base patch applied), so the rate never mixes one plan\'s answer with another plan\'s balances. $62,800 over $1,500,000 is 4.186666666666667 percent (printed 4.19); $41,200 over $800,000 is 5.1499999999999995 (printed 5.15); a zero balance gives no rate. Units: percent. Rounding: none; the page prints two decimals.',
    formula: {
      expression: 'rate = (M / B) · 100',
      variables: [
        { symbol: 'M', meaning: 'The solver\'s published answer (maxBaseAnnual)', unit: 'today USD per year', domain: 'nonnegative' },
        { symbol: 'B', meaning: 'Starting investable balances of the solved plan (startingInvestableOf)', unit: 'today USD', domain: 'B > 0; null rate otherwise' },
      ],
      timing: 'once per solve',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/solved-initial-withdrawal-rate-pct.md',
    },
    limits: [
      'The solved amount is base spending under the plan\'s own phases, taxes and horizon, while the published rules\' rates are constant-real spending over the same base, so the row compares a plan-specific answer with rules of thumb, as the page says.',
      'The other association, (M · 100) / B, differs in the last binary digit on some inputs (4.1866666666666665 against 4.186666666666667 at $62,800 over $1,500,000); the printed two decimals agree.',
    ],
    implementedBy: ['packages/engine/src/decisions/spendingSolver.ts'],
    implementedByFunctions: [
      'packages/engine/src/decisions/spendingSolver.ts#initialWithdrawalRatePct',
      'packages/engine/src/decisions/spendingSolver.ts#solveMaxSustainableSpending',
    ],
    verifiedOn: '2026-09-27',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'spending-shape-comparison': {
    title: 'Spending shapes compared with constant-real spending',
    purpose: 'Each spending shape\'s sustainable amount and its difference from the constant-real shape, as the spending page\'s shape table shows them.',
    kind: 'composition',
    outputs: ['spending-shape-delta-vs-flat'],
    statement:
      'decisions/spendingShapes.ts#planWithSpendingShape builds the plan solved for each shape in SPENDING_SHAPE_COMPARISON (flat, smile, smirk): the plan\'s own phases replaced by the shape\'s rows on the retirement age of the person the phases follow (expenses.phasesAgeOf, the person listed first when a two-person plan names none, which the plan then names; 65 when unset), and amortized (ABW) spending removed; every other field, a guardrail policy included, is unchanged. spendingShapeRows publishes, for each shape, the solver\'s published maxBaseAnnual and deltaVsFlatDollars, that amount minus the flat shape\'s, null on the flat row and when either amount is null (owner decision R5), so the difference is always the gap between the two amounts shown. It refuses an input without exactly one flat row, a shape listed twice, and any amount that is not a published answer (a rounded amount that is not a whole multiple of $100, or an amount without its rounding). With passing levels of $50,050 (flat) and $50,149 (smile) the published amounts are $50,000 and $50,100 and the difference is +$100, where subtracting the passing levels printed +$99. Units: today\'s dollars per year. Rounding: none beyond the published amounts.',
    formula: {
      expression: 'delta_s = M_s − M_flat',
      variables: [
        { symbol: 'M_s', meaning: 'The published answer of the solve for shape s', unit: 'today USD per year', domain: 'nonnegative' },
        { symbol: 'M_flat', meaning: 'The published answer of the constant-real (flat) solve', unit: 'today USD per year', domain: 'nonnegative' },
      ],
      timing: 'once per comparison',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shape-delta-vs-flat.md',
    },
    limits: [
      'Each shape is a separate solve that resolves to about $500, so a difference smaller than that is not meaningful.',
      'Shapes use the retirement age of the person the phases follow (65 when unset); a plan with amortized spending is compared as fixed-target versions of itself.',
      'Under guardrail spending a row can publish the exact amount that passed rather than the rounded one (see solved-spending-rounding); its difference is still taken between the amounts shown.',
    ],
    implementedBy: ['packages/engine/src/decisions/spendingShapes.ts'],
    implementedByFunctions: [
      'packages/engine/src/decisions/spendingShapes.ts#spendingShapeRows',
      'packages/engine/src/decisions/spendingShapes.ts#planWithSpendingShape',
    ],
    verifiedOn: '2026-09-27',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'guardrail-threshold-dollars': {
    title: 'Risk-based guardrail thresholds in dollars',
    purpose: 'The portfolio levels at which a risk-based guardrail policy cuts or raises spending, in today\'s dollars on the base the ledger acts on.',
    kind: 'composition',
    outputs: ['display-guardrail-balance-thresholds'],
    statement:
      'montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars publishes, for a risk-based guardrail policy with persisted percents p_L and p_U, (p_L / 100) × B and (p_U / 100) × B in that association, with B = startingInvestableOf(plan), the ledger\'s first-year real portfolio (the same rows added in the same order, at an inflation factor of exactly 1). With no persisted percent the status is unsolved; with B = 0 the status is no-starting-portfolio and only the percents are published, because the ledger then anchors on the first year the portfolio has a balance; acts is false when both thresholds exist and the cut threshold is not below the raise threshold, where the ledger holds spending every year. The solver persists its fraction as balancePct = balanceThresholdPct(fraction) = round(fraction × 10,000) / 100 (BALANCE_THRESHOLD_PCT_DECIMALS is 2). For the solver\'s worked edges 1.403671875 and 1.901171875 on a $500,000 portfolio the percents are 140.37 and 190.12 and the thresholds $701,850 and $950,600. Units: today\'s dollars; percent. Rounding: the percents carry two decimals; the dollars none.',
    formula: {
      expression: 'lower = (p_L / 100) · B; upper = (p_U / 100) · B; p = round(f · 10000) / 100',
      variables: [
        { symbol: 'p_L, p_U', meaning: 'Persisted cut and raise thresholds', unit: 'percent of the starting portfolio', domain: '> 0, two decimals' },
        { symbol: 'B', meaning: 'Today\'s investable balances (startingInvestableOf), the ledger\'s first-year real portfolio', unit: 'today USD', domain: '>= 0' },
        { symbol: 'f', meaning: 'The solver\'s balance fraction at a band edge', unit: '1', domain: '0.02 to 4' },
      ],
      timing: 'from the plan; the same in every year of every path, because the anchor is fixed in the first year',
      rounding: 'the percents to 0.01 by balanceThresholdPct; the dollars none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/display-guardrail-balance-thresholds.md',
    },
    limits: [
      'The published base equals the ledger\'s anchor only because the ledger\'s first year has an inflation factor of exactly 1 and adds the same rows in the same order; an evidence case pins the ledger\'s first-year action on either side of B (a cut at 100.01 percent, a hold at 99.99).',
      'At a zero starting balance the anchor is known only by simulating (and varies by path in Monte Carlo), so no dollars are published.',
      'The percents were solved for the balances at the time of the solve; after a balance edit they still act, as percents of the new balance, until the thresholds are solved again.',
      'The rounding is floating point: at three of the solver\'s 1,024 lattice points the product lands just below a half and rounds down (76.62 where the exact 76.625 rounds half up to 76.63), at most 0.01 percent of the balance, about a fortieth of the solver\'s own step.',
    ],
    implementedBy: ['packages/engine/src/montecarlo/riskBasedGuardrails.ts'],
    implementedByFunctions: [
      'packages/engine/src/montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars',
      'packages/engine/src/montecarlo/riskBasedGuardrails.ts#balanceThresholdPct',
    ],
    verifiedOn: '2026-09-27',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
} satisfies Record<string, CalculationRecord>
