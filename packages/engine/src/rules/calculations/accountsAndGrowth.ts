/**
 * Accounts-and-growth calculation records.
 *
 * One slice of the calculation registry: the asset-class parameter overlay,
 * the weight-vector helpers (normalization, glidepath compilation,
 * total-return drift, rebalance turnover, non-cash share) and the
 * expected-return and taxable-yield blends the ledger, the optimizer and the
 * Monte Carlo read from them. `../calculationRegistry.ts` composes every slice
 * into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const accountsAndGrowthRecords = {
  'asset-class-parameter-overrides': {
    title: 'Asset-class parameters: assumption overrides laid over the sourced defaults',
    purpose: 'The per-class return, volatility, yield and qualified-share figures every allocation blend reads.',
    kind: 'composition',
    // Parameter resolution publishes nothing itself. simulate.ts resolves the
    // params once and hands them to the growth phase (per-account balances)
    // and to the distributed-yield rows (taxable yield); marketModels.ts
    // resolves them for the class shocks behind the Monte Carlo fan.
    outputs: [],
    feeds: ['accounts-balance-per-account-annual', 'income-taxable-yield-annual', 'monte-carlo-investable-fan-percentiles'],
    statement:
      'For each class id in ASSET_CLASS_IDS order (usStocks, intlStocks, bonds, cash) the resolved record is { label: the default label; returnPct, volatilityPct, interestYieldPct, dividendYieldPct, qualifiedRatioPct: the override object\'s field when the overrides name that class and supply that field (o?.field ?? d.field), else the sourced default }. An absent overrides object, an absent class and an absent field each fall through to the default; the label cannot be overridden. Units: returnPct, volatilityPct, interestYieldPct and dividendYieldPct in percent per year; qualifiedRatioPct in percent. Rounding: none; every value passes through unchanged.',
    formula: {
      expression:
        'resolved[c].f = override[c]?.f ?? default[c].f for f in {returnPct, volatilityPct, interestYieldPct, dividendYieldPct, qualifiedRatioPct}; resolved[c].label = default[c].label',
      variables: [
        { symbol: 'c', meaning: 'Asset class id', unit: 'enum', domain: 'usStocks | intlStocks | bonds | cash' },
        { symbol: 'default[c]', meaning: 'Sourced planning default record for the class (DEFAULT_ASSET_CLASS_PARAMS)', unit: 'mixed', domain: 'fixed' },
        { symbol: 'override[c]', meaning: 'Optional per-class assumption overrides, each field optional', unit: 'mixed', domain: 'schema-bounded' },
        { symbol: 'resolved[c]', meaning: 'The record the blends read', unit: 'mixed', domain: 'every field present' },
      ],
      timing: 'resolved once per simulation and once per Monte Carlo run; time-invariant',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/asset-class-parameter-overrides.md',
    },
    limits: [
      'Overrides apply field by field: an override object cannot remove a class or blank a field, and the label is never overridable',
      'The sourced defaults (7/7/4/2.5 percent returns, 19.6/21/7.7/0.5 volatilities, the yields and qualified shares) are planning conventions from domain rules section 15, not forecasts; this record pins the overlay, not the defaults',
      'No validation here: the plan schema bounds each override field before it reaches the function',
      'The worksheet asks for exactness at one-decimal precision; the fixture compares with an absolute bound of 0 because the helper\'s exact keyword is reserved for integers, and pass-through doubles are equal bit for bit',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: [
      'packages/engine/src/allocation/assetClasses.ts#resolveAssetClassParams',
      'packages/engine/src/allocation/assetClasses.ts#DEFAULT_ASSET_CLASS_PARAMS',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-weight-normalization': {
    title: 'Allocation weights to a normalized fraction vector in class order',
    purpose: 'Turns a percent-weights record into the fraction vector every allocation calculation indexes by class.',
    kind: 'formula',
    // The worksheet says "bucket-lens-allocation upstream; no direct engine
    // weight-vector family yet". Every targetWeightsAt branch returns this
    // vector; simulate.ts seeds each allocated account's track with it and the
    // growth phase blends class returns by it, so the balance families are the
    // ones the vector actually enters. The bucket lens
    // (planner-ui/src/planner/bucketLens.ts) reads only the published
    // investable total, a path every growth record shares, so it is not listed.
    outputs: [],
    feeds: ['accounts-balance-per-account-annual', 'accounts-investable-total-annual'],
    statement:
      'For a weights record in percent, raw_i = max(0, w_i) in ASSET_CLASS_IDS order (usStocks, intlStocks, bonds, cash); W = sum of raw_i; the vector is raw_i/W. When W <= 0 (every weight zero or negative) the vector is all cash, [0, 0, 0, 1]. Units: fractions summing to 1. Rounding: none.',
    formula: {
      expression: 'f_i = max(0, w_i) / sum_j max(0, w_j); f = [0, 0, 0, 1] when the sum is not positive',
      variables: [
        { symbol: 'w_i', meaning: 'Weight of class i as entered', unit: 'percent', domain: 'schema: 0 <= w_i <= 100, total 100 +/- 0.5' },
        { symbol: 'W', meaning: 'Sum of the floored weights', unit: 'percent', domain: 'W >= 0' },
        { symbol: 'f_i', meaning: 'Normalized fraction of class i', unit: '1', domain: '0 <= f_i <= 1, sum 1' },
      ],
      timing: 'time-invariant',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-weight-normalization.md',
    },
    limits: [
      'Negative weights are floored at 0 before normalizing rather than rejected; the schema already bounds each weight to [0, 100] and the total to 100 +/- 0.5, so a near-100 total normalizes exactly to 1',
      'A zero total returns the all-cash vector instead of failing closed; the worksheet\'s domain is a positive total and its fixture does not reach that branch',
      'Class order is positional and fixed by ASSET_CLASS_IDS; every consumer indexes the vector by that order, never by magnitude',
      'The worksheet names bucket-lens-allocation upstream; the bucket lens reads only the published investable total, so the family is reached only through the balances every growth record feeds and is not listed here',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: ['packages/engine/src/allocation/assetClasses.ts#weightsToVector'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-glidepath-interpolation': {
    title: 'Glidepath compilation: linear interpolation with flat endpoints, staged as a step function',
    purpose: 'This year\'s target weight vector for an allocated account under any of the four policy modes.',
    kind: 'model',
    // simulate.ts seeds the allocation track with the start-year target and
    // annualRebalanceToTarget.ts retargets it each year; those tracked weights
    // blend class returns (growth, per-account balances) and class yields
    // (distributedTaxableYieldRows.ts, taxable yield). The worksheet's
    // bucket-lens-allocation is reached only through published balances and is
    // not listed (see allocation-weight-normalization).
    outputs: [],
    feeds: ['income-taxable-yield-annual', 'accounts-balance-per-account-annual'],
    statement:
      'static: weightsToVector(weights). linear: from = weightsToVector(policy.from), to = weightsToVector(policy.to); year <= startYear or endYear <= startYear returns from; year >= endYear returns to; otherwise lerp(from, to, t) with t = (year - startYear)/(endYear - startYear), where lerp mixes componentwise a_i + (b_i - a_i) t and renormalizes the mix to sum 1 when its sum is positive. staged: stages sorted by fromYear; the target is the last stage whose fromYear <= year, or the earliest stage when none has started. custom: targets sorted by year; a year at or before the first target returns its vector and at or after the last returns the last; otherwise the first bracketing pair lo, hi with lo.year <= year <= hi.year is lerped at t = (year - lo.year)/(hi.year - lo.year). Units: fractions in ASSET_CLASS_IDS order. Rounding: none.',
    formula: {
      expression:
        'w(y) = a + t (b - a), t = (y - y0)/(y1 - y0), renormalized to sum 1; w(y) = a for y <= y0; w(y) = b for y >= y1; staged: w(y) = weights of the last stage with fromYear <= y',
      variables: [
        { symbol: 'y', meaning: 'Calendar year being compiled', unit: 'year', domain: 'integer, schema 1900..2200' },
        { symbol: 'y0, y1', meaning: 'Glidepath start and end years (or a bracketing custom pair)', unit: 'year', domain: 'y0 < y1 for interpolation' },
        { symbol: 'a, b', meaning: 'Normalized endpoint vectors', unit: '1', domain: 'each sums to 1' },
        { symbol: 't', meaning: 'Interior fraction of the way from y0 to y1', unit: '1', domain: '0 < t < 1' },
        { symbol: 'w(y)', meaning: 'Target weight vector for the year', unit: '1', domain: 'sums to 1' },
      ],
      timing: 'annual; one target per calendar year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-glidepath-interpolation.md',
    },
    limits: [
      'Endpoints clamp flat; a linear or custom policy is never extrapolated',
      'Linear and custom mixes are renormalized after interpolation, a no-op when both endpoints already sum to 1',
      'A degenerate linear policy (endYear <= startYear) holds the from vector for every year',
      'A staged policy before its first stage year holds the earliest stage; a custom policy with one target holds it for every year',
      'lerpVectors is module-private; the evidence reaches it through targetWeightsAt',
      'The worksheet names bucket-lens-allocation upstream; the bucket lens reads only the published investable total and is not listed here',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: [
      'packages/engine/src/allocation/assetClasses.ts#targetWeightsAt',
      'packages/engine/src/allocation/assetClasses.ts#lerpVectors',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-blended-expected-return': {
    title: 'Blended expected nominal return of a weight vector',
    purpose: 'The one-period weighted mean of the class expected returns for a given allocation.',
    kind: 'formula',
    // The ledger never calls this function (see the DUPLICATION limit). Its
    // production callers are expectedAccountReturnPct, which the conversion
    // optimizer's blendedGrowth discounts with (optimizePlan.ts), and the
    // planner-ui AllocationPanel preview. The worksheet's balance families are
    // produced by the ledger's inline copy, pinned by parity in the evidence.
    outputs: [],
    feeds: ['optimizer-recommended-conversion-annual', 'optimizer-schedule-conversion-total'],
    statement:
      'For a weight vector w in ASSET_CLASS_IDS order and resolved class params, r = sum over i of w_i x returnPct_i, with a missing w_i read as 0. Units: percent per year, nominal; the class returns are percents and the weights fractions, so the result is in percent. Rounding: none.',
    formula: {
      expression: 'r = sum_i w_i r_i',
      variables: [
        { symbol: 'w_i', meaning: 'Fraction of the account in class i', unit: '1', domain: 'w_i >= 0, sum 1 for a normalized vector' },
        { symbol: 'r_i', meaning: 'Expected nominal total return of class i', unit: 'percent/year', domain: 'finite' },
        { symbol: 'r', meaning: 'Blended expected nominal return', unit: 'percent/year', domain: 'between min and max r_i for a normalized vector' },
      ],
      timing: 'one period (a year)',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-blended-expected-return.md',
    },
    limits: [
      'Weights are taken as given; the function neither normalizes nor validates them, so a vector not summing to 1 returns a scaled blend',
      'Arithmetic one-period blend, not geometric: the expected return of a mix over one year is the weighted mean of the class returns',
      'DUPLICATION: packages/engine/src/projection/internal/annualPostSolveAccountGrowth.ts forms the same sum of w_i r_i inline, with the year\'s class shock added to each r_i, to grow an allocated account; the ledger never calls blendedReturnPct, which reaches production only through expectedAccountReturnPct (the optimizer\'s balance-weighted growth rate in optimizePlan.ts#blendedGrowth) and the planner-ui AllocationPanel preview. The evidence drives annualPostSolveAccountGrowth at zero shock and requires its growth to equal blendedReturnPct on the worksheet\'s inputs',
      'The worksheet names the per-account balance and investable-total families upstream; the ledger\'s inline copy produces them, so this record feeds the optimizer schedule families its own callers reach and pins parity with the copy instead of claiming the balance families',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: ['packages/engine/src/allocation/assetClasses.ts#blendedReturnPct'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-account-expected-return': {
    title: 'Expected return for an account: allocation blend, else account rate, else plan default',
    purpose: 'Which expected nominal return applies to an account this year, by precedence.',
    kind: 'composition',
    // The engine's only production caller is optimizePlan.ts#blendedGrowth, the
    // balance-weighted rate the conversion optimizer discounts with; planner-ui
    // assumptionsExport.ts also calls it to format each account's return line. The
    // ledger applies the same precedence inline (DUPLICATION limit), so the
    // worksheet's balance families are not claimed here.
    outputs: [],
    feeds: ['optimizer-recommended-conversion-annual', 'optimizer-schedule-conversion-total'],
    statement:
      'For an account, the plan assumptions and a year: when the account is taxable, traditional, roth or hsa and carries an allocation policy (accountAllocation), the return is blendedReturnPct(targetWeightsAt(policy, year), resolveAssetClassParams(assumptions.assetClassParams)) and the account\'s own annualReturnPct is ignored; otherwise the account\'s annualReturnPct when the account type carries that field and it is not null; otherwise assumptions.defaultReturnPct. Units: percent per year, nominal. Rounding: none.',
    formula: {
      expression: 'r = blend(targetWeightsAt(policy, year), classParams) if the account has an allocation; else annualReturnPct if not null; else defaultReturnPct',
      variables: [
        { symbol: 'policy', meaning: 'The account\'s opt-in allocation policy, if any', unit: 'policy', domain: 'taxable, traditional, roth or hsa accounts only' },
        { symbol: 'annualReturnPct', meaning: 'The account\'s own scalar expected return', unit: 'percent/year', domain: 'number or null' },
        { symbol: 'defaultReturnPct', meaning: 'The plan-wide default expected return', unit: 'percent/year', domain: 'finite' },
        { symbol: 'r', meaning: 'The expected return selected for the account', unit: 'percent/year', domain: 'finite' },
      ],
      timing: 'annual; the blend uses the year\'s target weights',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-account-expected-return.md',
    },
    limits: [
      'Only taxable, traditional, Roth and HSA accounts can carry an allocation; every other type falls to the scalar precedence',
      'The blend uses the year\'s target weights, not the drifted weights the ledger holds under rebalancing "none"; the two coincide at the start year and under annual rebalancing',
      'DUPLICATION: the ledger does not call this function. annualPostSolveAccountGrowth.ts applies the same precedence inline (the class blend over the account\'s tracked weights when a track exists, else state.account.annualReturnPct ?? defaultReturnPct); the production callers are optimizePlan.ts#blendedGrowth in the engine and assumptionsExport.ts in planner-ui, which formats the Assumptions card and has no census family. The evidence drives the ledger phase with the worksheet\'s allocated account and requires it to ignore the 9% scalar the same way',
      'The worksheet names the per-account balance, investable-total and net-worth families upstream; the ledger\'s inline precedence produces them, so this record feeds the optimizer schedule families its caller reaches',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: [
      'packages/engine/src/allocation/assetClasses.ts#expectedAccountReturnPct',
      'packages/engine/src/allocation/assetClasses.ts#accountAllocation',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-blended-taxable-yield': {
    title: 'Blended taxable yields and dividend-weighted qualified share',
    purpose: 'The interest yield, dividend yield and qualified share a taxable account\'s allocation implies.',
    kind: 'formula',
    // distributedTaxableYieldRows.ts multiplies the two yields by the
    // start-of-year balance to publish the dollar rows and splits dividends by
    // the ratio, so the yields enter the four income families without being
    // their value.
    outputs: [],
    feeds: [
      'income-taxable-yield-annual',
      'income-taxable-interest-annual',
      'income-qualified-dividends-annual',
      'income-ordinary-dividends-annual',
    ],
    statement:
      'For weights w and class params: interestYieldPct = sum of w_i x interestYieldPct_i; dividendYieldPct = sum of w_i x dividendYieldPct_i; qualified = sum of w_i x dividendYieldPct_i x qualifiedRatioPct_i/100; qualifiedRatio = qualified/dividendYieldPct when dividendYieldPct > 0, else DEFAULT_QUALIFIED_DIVIDEND_RATIO = 0.85. Units: the two yields in percent of balance per year; the ratio a fraction in [0, 1]. Rounding: none. In the ledger an account-level interestYieldPct, dividendYieldPct or qualifiedRatio overrides the blend field by field, and the published rows are start-of-year balance x yield/100.',
    formula: {
      expression: 'I = sum_i w_i I_i; D = sum_i w_i D_i; Q = (sum_i w_i D_i q_i/100) / D when D > 0, else 0.85',
      variables: [
        { symbol: 'w_i', meaning: 'Fraction of the account in class i', unit: '1', domain: 'w_i >= 0' },
        { symbol: 'I_i, D_i', meaning: 'Interest and dividend yield of class i', unit: 'percent of balance/year', domain: '>= 0' },
        { symbol: 'q_i', meaning: 'Qualified share of class i\'s dividends', unit: 'percent', domain: '0 <= q_i <= 100' },
        { symbol: 'I, D', meaning: 'Blended interest and dividend yields', unit: 'percent of balance/year', domain: '>= 0' },
        { symbol: 'Q', meaning: 'Dividend-dollar-weighted qualified share', unit: '1', domain: '0 <= Q <= 1' },
      ],
      timing: 'annual; applied to the start-of-year balance',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-blended-taxable-yield.md',
    },
    limits: [
      'The qualified share is dividend-dollar-weighted, so a class with no dividends contributes nothing to the ratio however large its weight',
      'A blend with zero dividends returns the 0.85 fallback rather than 0 or NaN; the fallback is a convention for the unallocated case, not a sourced class parameter',
      'Weights are taken as given, not normalized',
      'The published income rows are balance x yield in the ledger (distributedTaxableYieldRows.ts), so this record feeds those families and is not their value',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: [
      'packages/engine/src/allocation/assetClasses.ts#blendedTaxableYield',
      'packages/engine/src/allocation/assetClasses.ts#DEFAULT_QUALIFIED_DIVIDEND_RATIO',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-total-return-drift': {
    title: 'Unrebalanced weights after one year of class returns',
    purpose: 'How an allocation drifts when each class grows at its own total return and nothing is rebalanced.',
    kind: 'formula',
    // annualPostSolveAccountGrowth.ts calls it after each year's growth with
    // the shocked class rates; the drifted vector is the next year's tracked
    // weights, which the next year's growth blends. The worksheet's
    // bucket-lens-allocation is reached only through published balances and
    // is not listed (see allocation-weight-normalization).
    outputs: [],
    feeds: ['accounts-balance-per-account-annual', 'accounts-investable-total-annual'],
    statement:
      'grown_i = w_i x max(0, 1 + r_i/100), with a missing r_i read as 0; total = sum of grown_i; the drifted vector is grown_i/total when total > 0, else the input weights unchanged. Units: fractions. Rounding: none. The ledger calls it after each year\'s growth with r_i = returnPct_i plus the year\'s class shock, and the result is the next year\'s tracked weights until a rebalance retargets them.',
    formula: {
      expression: 'w\'_i = w_i (1 + r_i/100) / sum_j w_j (1 + r_j/100), each factor floored at 0',
      variables: [
        { symbol: 'w_i', meaning: 'Beginning weight of class i', unit: '1', domain: 'w_i >= 0, sum 1' },
        { symbol: 'r_i', meaning: 'Total return of class i over the year', unit: 'percent', domain: 'r_i >= -100 for a positive factor' },
        { symbol: 'w\'_i', meaning: 'Ending weight of class i', unit: '1', domain: 'sum 1 when the total is positive' },
      ],
      timing: 'end of year, after growth',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-total-return-drift.md',
    },
    limits: [
      'Total-return convention: distributions are treated as reinvested pro rata, so a class\'s weight moves with its total return rather than its price return',
      'A class return at or below -100% is floored at zero ending value rather than going negative',
      'A zero total ending value returns the input weights unchanged instead of failing closed',
      'The worksheet names bucket-lens-allocation upstream; the bucket lens reads only the published investable total and is not listed here',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: ['packages/engine/src/allocation/assetClasses.ts#driftWeights'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'allocation-rebalance-turnover': {
    title: 'Rebalance turnover: the fraction sold to reach the target weights',
    purpose: 'How much of an account a rebalance sells, the sum of the overweight class differences.',
    kind: 'formula',
    // "none yet" in the worksheet: the census exposes no turnover family. The
    // traced consumer is annualRebalanceToTarget.ts, which sells
    // turnover x balance from a taxable account through aggregateBasisSale and
    // records the realized gain the ledger publishes as YearResult.realizedGains.
    outputs: [],
    feeds: ['tax-realized-gains-annual'],
    statement:
      'turnover = sum over the indices of current of max(0, current_i - target_i), with a missing target_i read as 0. Units: fraction of account value sold. Rounding: none. In the ledger a turnover above 1e-9 on a taxable account with a positive balance sells min(balance, turnover x balance) through the basis machinery; other account types retarget without a sale.',
    formula: {
      expression: 'turnover = sum_i max(0, c_i - t_i)',
      variables: [
        { symbol: 'c_i', meaning: 'Current weight of class i', unit: '1', domain: 'sum 1' },
        { symbol: 't_i', meaning: 'Target weight of class i', unit: '1', domain: 'sum 1' },
        { symbol: 'turnover', meaning: 'Fraction of the account sold', unit: '1', domain: '0 <= turnover <= 1 for normalized vectors' },
      ],
      timing: 'once per year at the rebalance',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-rebalance-turnover.md',
    },
    limits: [
      'Sells only: buys are the mirror image under conserved value, so summing the positive differences counts each dollar moved once',
      'No validation that the two vectors sum to one; an unnormalized pair returns an unnormalized fraction',
      'The worksheet says none yet: the census exposes no turnover family. The traced consumer is annualRebalanceToTarget.ts, whose taxable rebalancing sale realizes the gain published as YearResult.realizedGains, so tax-realized-gains-annual is named as the nearest fed family',
      'Only taxable accounts realize anything; on tax-advantaged accounts the ledger retargets the weights without a sale',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: ['packages/engine/src/allocation/assetClasses.ts#rebalanceTurnoverFraction'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'projection-summary-ending-after-tax-estate': {
    title: 'Projection summary ending after tax estate',
    purpose: 'Net the horizon estate of charity carve-outs and assumed heir income tax.',
    kind: 'composition',
    outputs: ['projection-summary-ending-after-tax-estate'],
    feeds: ['swr-rule-result-ending-after-tax-estate', 'scenario-comparison-cell', 'insight-spending-headroom-rough-annual'],
    statement: 'projection/compare.ts#summarizeProjection computes nominal ending after-tax estate as horizon net worth minus the amount passing to charity and minus the total assumed heir income tax on inherited pre-tax balances: endingAfterTaxEstate = endingNetWorth - endingEstateToCharity - endingEstateHeirTax.',
    formula: {
      expression: 'endingAfterTaxEstate = endingNetWorth - endingEstateToCharity - endingEstateHeirTax',
      variables: [
        { symbol: 'endingNetWorth', meaning: 'Horizon net worth', unit: 'nominal USD', domain: 'finite' },
        { symbol: 'endingEstateToCharity', meaning: 'Amount passing to charity, untaxed', unit: 'nominal USD', domain: 'nonnegative' },
        { symbol: 'endingEstateHeirTax', meaning: 'Assumed heir income tax on inherited pre-tax balances', unit: 'nominal USD', domain: 'nonnegative' },
      ],
      timing: 'projection horizon',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/projection-summary-ending-after-tax-estate.md',
    },
    limits: [
      'Charity carve-outs pass untaxed rather than remaining in the heirs\' estate, so they are subtracted here even though they are also reported separately in endingEstateToCharity; with no charity destination the identity collapses to net worth minus heir tax. Ignoring charity, adding heir tax instead of subtracting it, or subtracting charity a second time through the heir tax each name a different quantity. The figure is assumed terminal exposure at the horizon, not a death-year return.',
    ],
    implementedBy: ['packages/engine/src/projection/compare.ts'],
    implementedByFunctions: ['packages/engine/src/projection/compare.ts#summarizeProjection'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'accounts-investable-total-annual': {
    title: 'Annual investable total',
    purpose: 'The year-end balance a plan can actually spend from, and what is deliberately left out.',
    kind: 'composition',
    outputs: ['accounts-investable-total-annual'],
    feeds: ['accounts-net-worth-annual', 'projection-result-ending-investable'],
    statement:
      'projection/internal/annualSnapshot.ts#annualSnapshot opens the investable fold at unassignedCash and adds every investable balance in simulator order — cash, taxable, equity-compensation, traditional, Roth and HSA accounts — publishing the sum as projection/internal/types/result.ts#YearResult.investableTotal. Property values, ordinary debts, HECM loans and permanent-life cash values are folded into their own separate totals and are not members; the TIPS ladder value is computed outside the snapshot and is likewise not a member. netWorth adds those channels. Units: nominal USD at year end. Rounding: none; the additions are left in their original loop order because regrouping binary floats can move the last bit.',
    formula: {
      expression: 'investableTotal = unassignedCash + sum over investable balances of balance',
      variables: [
        { symbol: 'unassignedCash', meaning: 'Cash with no modeled account to land in; opens the fold', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'balance', meaning: 'One investable account\'s year-end balance', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'insuranceCashValueTotal, propertyTotal, debtTotal, ladderValue', meaning: 'Separate channels, excluded here', unit: 'usd', domain: 'nonnegative; members of netWorth only' },
      ],
      timing: 'once per projection year, at the end-of-pass snapshot',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/accounts-investable-total-annual.md',
    },
    limits: [
      'The worksheet\'s case is asserted at annualSnapshot, the function that computes the field, because unassigned cash and a cash or taxable account cannot coexist in a real plan: simulatePlan only tracks cash as unassigned when there is no cash or taxable account for surplus to land in, so the worksheet\'s $2,000 of unassigned cash alongside $15,000 of cash accounts and $120,000 of taxable accounts is not a state a plan produces',
      'The member list is separately asserted on a real simulatePlan run carrying the worksheet\'s six account balances plus a permanent-life policy: the published investableTotal is the six balances and excludes the policy cash value and the property, both of which the same row publishes',
      'Equity compensation is a member whether or not it has vested; the vesting mode gates spending, not the balance total',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualSnapshot.ts',
      'packages/engine/src/projection/internal/types/result.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSnapshot.ts#annualSnapshot',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.investableTotal',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'accounts-net-worth-annual': {
    title: 'Annual net worth, with the non-recourse HECM cap',
    purpose: 'The year-end balance sheet, including the homes and the debts the investable total leaves out.',
    kind: 'composition',
    outputs: ['accounts-net-worth-annual'],
    feeds: ['projection-result-ending-net-worth'],
    statement:
      'projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly publishes projection/internal/types/result.ts#YearResult.netWorth as snapshot.investableTotal + snapshot.propertyTotal - snapshot.debtTotal + snapshot.insuranceCashValueTotal + ladderValue - snapshot.hecmEffectiveDebt, in that left-to-right association. projection/internal/annualSnapshot.ts#annualSnapshot supplies hecmEffectiveDebt as the sum over open HECM lines of min(loanBalance, the matching property value), the non-recourse limit; the uncapped loan total is published separately as hecmLoanBalance and is never the net-worth subtrahend. Units: nominal USD at year end. Rounding: none; the association is part of the contract.',
    formula: {
      expression: 'netWorth = investableTotal + propertyTotal - debtTotal + insuranceCashValueTotal + ladderValue - sum over HECM lines of min(loanBalance, propertyValue)',
      variables: [
        { symbol: 'propertyTotal', meaning: 'Sum of owned property values at year end', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'debtTotal', meaning: 'Sum of ordinary debt balances', unit: 'usd', domain: 'nonnegative; subtracted' },
        { symbol: 'insuranceCashValueTotal', meaning: 'Permanent-life cash values', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'ladderValue', meaning: 'Remaining TIPS-ladder principal at nominal book value', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'hecmEffectiveDebt', meaning: 'HECM loans capped line by line at the matching home value', unit: 'usd', domain: 'nonnegative; subtracted' },
      ],
      timing: 'once per projection year, at the year-result assembly',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/accounts-net-worth-annual.md',
    },
    limits: [
      'The worksheet\'s case is asserted at annualSnapshot and annualYearResultAssembly, the two functions that compute the cap and the composition, because the worksheet states HECM loan balances of $420,000 and $50,000 as year-end facts: a HECM balance is an accrual of draws, interest and mortgage-insurance premium that no plan can set directly, so those two figures are not a state a plan produces',
      'Only the cap is capped: a loan above its home\'s value is limited to that value, while a loan below it is subtracted in full, which is why the worksheet\'s two homes need two different branches of the same min',
      'Ordinary debt is subtracted, not added; adding it is the worksheet\'s third wrong reading and moves the answer by twice the debt',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualYearResultAssembly.ts',
      'packages/engine/src/projection/internal/annualSnapshot.ts',
      'packages/engine/src/projection/internal/types/result.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly',
      'packages/engine/src/projection/internal/annualSnapshot.ts#annualSnapshot',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.netWorth',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'accounts-ending-balance-by-category': {
    title: 'Ending balances by logical account category',
    purpose: 'How the last ledger year\'s account balances roll up into the five published categories.',
    kind: 'composition',
    outputs: ['accounts-ending-balance-by-category'],
    statement:
      'projection/compare.ts#summarizeProjection publishes endingByCategory as the sum of the LAST ledger year\'s published balances by the corresponding selected logical account type: cash, taxable, traditional, roth and hsa. Equity-compensation balances are not one of these five categories, and no property, debt, ladder or insurance value enters them. Units: nominal USD. Rounding: none.',
    formula: {
      expression: 'endingByCategory[c] = sum over selected accounts of type c of lastYear.balances[accountId]',
      variables: [
        { symbol: 'lastYear', meaning: 'Final row of the ledger', unit: 'year row', domain: 'empty ledger publishes five zeros' },
        { symbol: 'c', meaning: 'Published category', unit: 'enum', domain: 'cash | taxable | traditional | roth | hsa' },
      ],
      timing: 'once per projection, on the final ledger row',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/accounts-ending-balance-by-category.md',
    },
    limits: [
      'Asserted at summarizeProjection with the worksheet\'s six accounts, their plan types and their last-year balances verbatim, over a two-row ledger whose penultimate row carries a distinct sentinel balance on every account so a row mistake cannot pass. Plan assumptions beyond the worksheet\'s inputs: each account opens at a zero balance with zero returns, because the summary reads the ledger row rather than the plan; the owner-held accounts name the plan\'s single person',
      'The fixture also asserts that the published object has exactly the five category keys, which is how the worksheet\'s third wrong reading (adding property or insurance categories) is discriminated',
    ],
    implementedBy: ['packages/engine/src/projection/compare.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/compare.ts#summarizeProjection',
      'packages/engine/src/projection/compare.ts#ProjectionSummary.endingByCategory',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'estate-to-charity': {
    title: 'Ending estate passing to charity',
    purpose: 'How much of the ending estate is carved out to charity, before any heir tax.',
    kind: 'formula',
    outputs: ['estate-to-charity'],
    statement:
      'projection/compare.ts#summarizeProjection publishes endingEstateToCharity as the sum, over accounts whose resolved estate destination is charity, of gross ending balance x min(1, charityPct/100). Non-charity destinations contribute zero. The share is applied to the pre-carveout gross model value and passes untaxed; the remainder follows the non-spouse-heir treatment and does not change this field. Units: nominal USD. Rounding: none.',
    formula: {
      expression: 'endingEstateToCharity = sum over charity accounts of G x min(1, p/100)',
      variables: [
        { symbol: 'G', meaning: 'Gross ending balance of the account', unit: 'usd', domain: 'positive rows only' },
        { symbol: 'p', meaning: 'Charity share', unit: 'percent', domain: '0..100, capped at 1 after division' },
      ],
      timing: 'once per projection, on the final ledger row',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/estate-to-charity.md',
    },
    limits: [
      'Asserted at summarizeProjection with the worksheet\'s three accounts, their destinations, charity percents and gross ending balances verbatim, and at the per-account charity amounts as well as the total, so a compensating pair of errors cannot pass. Plan assumptions beyond the worksheet\'s inputs: each account opens at a zero balance with zero returns, because the summary reads the final ledger row rather than the plan, and the default heir tax rate applies to the non-charity remainder without entering this field',
      'The worksheet\'s third wrong reading (reading 25 as a decimal) is the reason the record states the min(1, p/100) cap rather than a bare multiplication',
    ],
    implementedBy: ['packages/engine/src/projection/compare.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/compare.ts#summarizeProjection',
      'packages/engine/src/projection/compare.ts#ProjectionSummary.endingEstateToCharity',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'hecm-draw-annual': {
    title: 'Annual HECM draw, including the last-resort backstop',
    purpose: 'What an open reverse-mortgage line actually lends the household this year.',
    kind: 'formula',
    outputs: ['hecm-draw-annual'],
    feeds: ['spending-shortfall-annual', 'accounts-net-worth-annual'],
    statement:
      'projection/internal/types/result.ts#YearResult.hecmDraw is the accepted coordinated draw plus any backstop draw planned by projection/internal/annualHecmBackstop.ts#annualHecmBackstopPlan against a true portfolio shortfall. With the coordinated draw zero, the backstop is min(true shortfall, available open line), where the available line is max(0, principalLimit - loanBalance); draw policy does not gate it, because every open line is a last backstop before the household is reported depleted. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'backstop = min(shortfall, max(0, principalLimit - loanBalance)); hecmDraw = coordinated + backstop; shortfallAfterHecm = max(0, shortfall - backstop)',
      variables: [
        { symbol: 'shortfall', meaning: 'True portfolio shortfall before the backstop', unit: 'usd', domain: 'above the annual funding tolerance' },
        { symbol: 'principalLimit', meaning: 'HECM line principal limit', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'loanBalance', meaning: 'Amount already drawn on the line', unit: 'usd', domain: 'nonnegative' },
      ],
      timing: 'once per projection year, after the accepted withdrawal plan',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/hecm-draw-annual.md',
    },
    limits: [
      'Asserted twice: at the exported backstop planner with the worksheet\'s open line, 40,000 shortfall and 25,000 available line verbatim, and as the published hecmDraw of a real simulatePlan year built from the same inputs — a last-resort line on a 500,000 primary residence at the schema\'s minimum 5-percent principal limit and a zero growth rate, so the available line is exactly 25,000, against a 40,000 lifestyle need with no portfolio at all. Plan assumptions beyond the worksheet\'s inputs for that ledger year: a 64-year-old filing single in KY at a zero state rate, so no Medicare or marketplace premium can change the need, and no coordinated draw is possible because the policy is lastResort',
      'The worksheet derives only the backstop case; the extract states no sizing formula for a coordinated draw, so this record makes no claim about one',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/internal/annualHecmBackstop.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.hecmDraw',
      'packages/engine/src/projection/internal/annualHecmBackstop.ts#annualHecmBackstopPlan',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'accounts-balance-per-account-annual': {
    title: 'Year-end balance map: one entry per id, written channel by channel',
    purpose: 'The per-account year-end balances the ledger publishes for every projection year.',
    kind: 'composition',
    outputs: ['accounts-balance-per-account-annual'],
    statement:
      'YearResult.balances, materialized by projection/internal/annualSnapshot.ts#annualSnapshot, is the year-end map written in exactly this order: logical investable balances, then property values, then ordinary debt balances, then permanent-life cash values. Object.fromEntries keeps the later-channel write, so when two channels share an id the LAST channel written wins. Each value is that channel\'s own full-year figure and no netting across channels happens: a debt appears as its positive outstanding balance, not as a negative asset. Units: nominal dollars per id. Rounding: none.',
    formula: {
      expression: 'balances = fromEntries([...investable, ...property, ...debt, ...insuranceCashValue]) ; last write wins per id',
      variables: [
        { symbol: 'investable', meaning: 'One published row per logical investable account id, at its year-end balance', unit: 'usd', domain: 'finite' },
        { symbol: 'property, debt', meaning: 'Year-end property values and ordinary debt balances, in insertion order', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'insuranceCashValue', meaning: 'Permanent-life cash values, written last', unit: 'usd', domain: 'nonnegative' },
      ],
      timing: 'once per projection year, at the end of the annual pass',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/accounts-balance-per-account-annual.md',
    },
    limits: [
      'Beyond the worksheet\'s inputs the evidence plan fixes: a single filer aged 51 in 2026 (no Medicare month, no required distribution), the plan\'s inflationPct at 3 (the property grows at general inflation, see below), zero return on the investable account, wage and recurring income sized to fund the stated contribution and the $4,000 debt service, no spending other than that debt service and the $15,000 withdrawal realized as a one-time goal, a single-year horizon, and an interest-free debt whose scheduled payment is exactly the $4,000 of principal the worksheet amortizes',
      'The withdrawal is realized as an uninflated one-time goal, which is what makes the investable close opening + contributions - withdrawals at a zero return',
      'The worksheet names 3% as the PROPERTY\'s appreciation; internal/propertyEventsAndGrowth.ts grows a property at GENERAL inflation and ignores the property account\'s own annualReturnPct, so the evidence sets the plan\'s inflationPct to 3 instead. In the start year every cumulative factor is still 1, so nothing else in the row moves',
      'The collision case is asserted by calling annualSnapshot directly with four channels on one id, because a real plan cannot give a property, a debt and an investable account the same id (the plan schema rejects it) — the overwrite order is a property of the snapshot, not of any plan',
      'The map holds no HECM line: HECM debt is published separately and only enters net worth under its non-recourse cap',
      'Until decision D-CASH-PROPERTY-ALIAS (2026-09-25) the plan checks accepted one cross-channel pair on a single id, a cash account and a property, and the property\'s value then overwrote the cash balance in this map and in every figure read from it (a $300,000 home published as cash). The checks now refuse that pair, and a stored plan that has one gets a new id for the property when it is loaded, so no plan reaches the snapshot with it',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualSnapshot.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSnapshot.ts#annualSnapshot',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'pension-election-annuity-present-value': {
    title: 'Pension annuity present value at the curve-anchored discount rate',
    purpose: 'What the pension\'s lifetime payments are worth today, the number a lump-sum offer has to beat.',
    kind: 'model',
    outputs: ['pension-election-annuity-present-value'],
    statement:
      'decisions/pensionElection.ts#analyzePensionElections publishes curveRatePct = curveNominalDiscountRatePct(max(5, planning age - current age), plan inflation): the embedded TIPS real-yield curve linearly interpolated at that horizon (flat outside the 5-to-30-year anchors) plus the plan\'s inflation percentage. presentValueAtCurveRate is pensionAnnuityPresentValue at that rate: for each owner age from max(start age, current age) through the horizon age, the annual benefit (monthly x 12) grown by COLA from the start age, paid in full while the owner lives and at survivorPct while a survivor lives (only if the owner reached the start age), discounted by (1 + rate/100)^(owner age - current age). Units: percent per year; valuation-year dollars. Rounding: none.',
    formula: {
      expression: 'PV = sum_t paid_t / (1 + r/100)^t, t = owner age - current age; r = realYield(max(5, planningAge - currentAge)) + inflation',
      variables: [
        { symbol: 'r', meaning: 'Curve-anchored nominal discount rate', unit: 'percent/year', domain: 'finite' },
        { symbol: 'paid_t', meaning: 'Benefit paid at offset t: full while the owner lives, survivorPct of it while a survivor does', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'horizon age', meaning: 'max(owner death age, current age + the survivor\'s remaining years)', unit: 'years', domain: 'integer' },
      ],
      timing: 'once per pension carrying a lump-sum offer, valued at the projection start year',
      rounding: 'none; the sensitivity table rounds its rate columns to 0.1 percentage points, the published curve rate is not rounded',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/pension-election-annuity-present-value.md',
    },
    limits: [
      'One number drives both horizons: analyzePensionElections passes ownerDeathAge = the owner\'s planning age, so planning age 70 against current age 64 gives the 3.95% rate AND the six payments the published presentValueAtCurveRate discounts, $63,008.166010097986. The first derivation valued the published field over three payments to a death age of 67 while taking its rate from planning age 70, which reports the helper\'s figure in the field\'s place; it was corrected on 2026-09-18, and that mismatch is now the worksheet\'s first wrong reading, asserted as not matching',
      'The three-payment stream is a SECOND case, taken explicitly at the helper pensionAnnuityPresentValue with ownerDeathAge 67 at the same 3.95% rate, and is $33,332.7193407416; the helper accepts any death age, so that case says nothing about the field\'s payment count',
      'Beyond the worksheet\'s inputs the evidence plan fixes: a single household (so no survivor extends the horizon), a 1962-born owner so the 2026 current age is 64, a pension with a lump-sum offer in the start year (the analysis skips pensions without one), zero return, and inflationPct 2 as the rate\'s inflation term',
      'The curve is the embedded 2026 TIPS real-yield snapshot; the rate is a planning anchor, not a quote, and a corporate-spread view is left to the user',
      'The stream is discounted at annual offsets from the valuation year with no mid-year convention, and COLA compounds from the start age rather than the valuation year',
    ],
    implementedBy: ['packages/engine/src/decisions/pensionElection.ts'],
    implementedByFunctions: [
      'packages/engine/src/decisions/pensionElection.ts#analyzePensionElections',
      'packages/engine/src/decisions/pensionElection.ts#pensionAnnuityPresentValue',
      'packages/engine/src/decisions/pensionElection.ts#curveNominalDiscountRatePct',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
