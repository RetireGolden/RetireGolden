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
    // The only production caller is optimizePlan.ts#blendedGrowth, the
    // balance-weighted rate the conversion optimizer discounts with. The
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
      'DUPLICATION: the ledger does not call this function. annualPostSolveAccountGrowth.ts applies the same precedence inline (the class blend over the account\'s tracked weights when a track exists, else state.account.annualReturnPct ?? defaultReturnPct); the only production caller is optimizePlan.ts#blendedGrowth. The evidence drives the ledger phase with the worksheet\'s allocated account and requires it to ignore the 9% scalar the same way',
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
  'allocation-non-cash-share': {
    title: 'Non-cash share of a weight vector',
    purpose: 'The fraction of an allocation exposed to a single-factor market shock: everything but cash.',
    kind: 'formula',
    // No production module calls this helper (limit below). The families named
    // are the ones its own comment says it serves, the single-factor shock
    // behind the Monte Carlo success rate and investable fan: the design intent
    // the worksheet records, not a traced call.
    outputs: [],
    feeds: ['monte-carlo-success-rate', 'monte-carlo-investable-fan-percentiles'],
    statement:
      'share = max(0, 1 - w_cash), where w_cash is the component at ASSET_CLASS_IDS.indexOf("cash") (index 3) and a missing component reads as 0. Units: fraction. Rounding: none. For a normalized vector this equals the sum of the three non-cash weights.',
    formula: {
      expression: 'share = max(0, 1 - w_cash) = w_usStocks + w_intlStocks + w_bonds for a normalized vector',
      variables: [
        { symbol: 'w_cash', meaning: 'Cash weight, the fourth component', unit: '1', domain: '0 <= w_cash <= 1' },
        { symbol: 'share', meaning: 'Market-shocked (non-cash) share', unit: '1', domain: '0 <= share <= 1' },
      ],
      timing: 'time-invariant',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/accounts-and-growth/allocation-non-cash-share.md',
    },
    limits: [
      'Reads only the cash component, so an unnormalized vector returns 1 - w_cash rather than the actual non-cash sum',
      'Floored at 0: a cash weight above 1 returns 0 rather than a negative share',
      'No production module calls nonCashWeight as of 2026-09-17: the Monte Carlo class-shock models hold cash unshocked per class (classSeries.cash = 0 in marketModels.ts) and the single-return shock in annualPostSolveAccountGrowth.ts skips cash by account type, so the market-shocked share is never computed through this helper. The families named under feeds are the ones the helper\'s own comment says it serves; the worksheet also names the per-account balance and investable-total families, which no call reaches either',
    ],
    implementedBy: ['packages/engine/src/allocation/assetClasses.ts'],
    implementedByFunctions: ['packages/engine/src/allocation/assetClasses.ts#nonCashWeight'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
