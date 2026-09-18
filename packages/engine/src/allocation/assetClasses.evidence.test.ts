import { expect, it } from 'vitest'
import {
  ASSET_CLASS_IDS,
  createEmptyPlan,
  type AllocationWeights,
  type AssetAllocationPolicy,
  type AssetClassParamOverrides,
} from '../model/plan.js'
import { annualPostSolveAccountGrowth } from '../projection/internal/annualPostSolveAccountGrowth.js'
import {
  describeCalculation,
  withinTolerance,
  type CalculationTolerance,
} from '../rules/describeCalculation.js'
import {
  blendedReturnPct,
  blendedTaxableYield,
  DEFAULT_ASSET_CLASS_PARAMS,
  DEFAULT_QUALIFIED_DIVIDEND_RATIO,
  driftWeights,
  expectedAccountReturnPct,
  nonCashWeight,
  rebalanceTurnoverFraction,
  resolveAssetClassParams,
  targetWeightsAt,
  weightsToVector,
  type AssetClassParams,
} from './assetClasses.js'

/** A weights record in the schema's percent unit, in ASSET_CLASS_IDS order. */
function weightsPct(usStocks: number, intlStocks: number, bonds: number, cash: number): AllocationWeights {
  return { usStocks, intlStocks, bonds, cash }
}

/** Every component of `actual` within the fixture tolerance of the worksheet's vector. */
function expectVector(
  label: string,
  actual: readonly number[],
  expected: readonly number[],
  tolerance: CalculationTolerance,
): void {
  expect(actual, `${label} has ${actual.length} components, the worksheet ${expected.length}`).toHaveLength(expected.length)
  expected.forEach((value, index) => {
    expect(
      withinTolerance(actual[index]!, value, tolerance),
      `${label}[${index}] ${actual[index]} is not within ${JSON.stringify(tolerance)} of the worksheet's ${value}`,
    ).toBe(true)
  })
}

/**
 * The ledger's growth of one allocated account at zero shock, in percent.
 * annualPostSolveAccountGrowth forms the class blend inline rather than
 * calling blendedReturnPct (the DUPLICATION limit on both expected-return
 * records); driving the real phase with the worksheet's inputs pins the copy
 * to the pinned function. marketClosingBalance = balance x (1 + blend/100)
 * with no distributed yield, so the growth read back is the blend itself.
 */
function ledgerGrowthPct(
  account: { readonly type: 'taxable'; readonly annualReturnPct: number | null },
  weights: readonly number[],
  classParams: Record<(typeof ASSET_CLASS_IDS)[number], AssetClassParams>,
  defaultReturnPct: number,
): number {
  const balance = 100
  const growth = annualPostSolveAccountGrowth({
    states: [{ account, balance }],
    allocationTrack: new Map([['0', { weights: [...weights] }]]),
    distributedYieldByBalanceIndex: new Map(),
    classParams,
    defaultReturnPct,
    shockPct: 0,
    year: 2026,
    classShockAt: () => 0,
  })
  const row = growth.rows[0]!
  expect(row.kind).toBe('allocated')
  return (row.marketClosingBalance / balance - 1) * 100
}

describeCalculation(
  'asset-class-parameter-overrides',
  {
    example: {
      inputs: {
        overrides: { bonds: { returnPct: 5.0 } },
        defaultBonds: { returnPct: 4.0, volatilityPct: 7.7 },
        defaultUsStocksReturnPct: 7.0,
      },
      expected: { bondsReturnPct: 5.0, bondsVolatilityPct: 7.7, usStocksReturnPct: 7.0 },
      // The worksheet asks for exactness at the supplied one-decimal
      // precision. The helper's 'exact' keyword is reserved for integers, so
      // the same predicate is written as an absolute bound of 0: an override
      // and a default pass through as the very doubles they were entered as.
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/asset-class-parameter-overrides.md',
    mutation: 'DOCS/calculations/accounts-and-growth/asset-class-parameter-overrides.mutation.md',
  },
  ({ example }) => {
    const overrides = example.inputs.overrides as AssetClassParamOverrides
    const defaultBonds = example.inputs.defaultBonds as { returnPct: number; volatilityPct: number }
    const resolved = resolveAssetClassParams(overrides)

    it('reads the sourced defaults the worksheet states: bonds 4.0/7.7 and US stocks 7.0', () => {
      expect(DEFAULT_ASSET_CLASS_PARAMS.bonds.returnPct).toBe(defaultBonds.returnPct)
      expect(DEFAULT_ASSET_CLASS_PARAMS.bonds.volatilityPct).toBe(defaultBonds.volatilityPct)
      expect(DEFAULT_ASSET_CLASS_PARAMS.usStocks.returnPct).toBe(example.inputs.defaultUsStocksReturnPct)
    })

    it('takes the bonds return from the override and keeps its volatility at the 7.7 default', () => {
      const expectedReturn = example.expected.bondsReturnPct as number
      const expectedVolatility = example.expected.bondsVolatilityPct as number
      expect(
        withinTolerance(resolved.bonds.returnPct, expectedReturn, example.tolerance),
        `bonds.returnPct ${resolved.bonds.returnPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedReturn}`,
      ).toBe(true)
      expect(
        withinTolerance(resolved.bonds.volatilityPct, expectedVolatility, example.tolerance),
        `bonds.volatilityPct ${resolved.bonds.volatilityPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedVolatility}`,
      ).toBe(true)
    })

    it('leaves US stocks at the 7.0 default because no override names that class', () => {
      const expected = example.expected.usStocksReturnPct as number
      expect(
        withinTolerance(resolved.usStocks.returnPct, expected, example.tolerance),
        `usStocks.returnPct ${resolved.usStocks.returnPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('preserves every other bonds field and the label: the override is laid over the record, not swapped for it', () => {
      expect(resolved.bonds).toEqual({ ...DEFAULT_ASSET_CLASS_PARAMS.bonds, returnPct: 5 })
    })

    it('resolves to the sourced defaults for every class when no overrides are supplied', () => {
      expect(resolveAssetClassParams(undefined)).toEqual(DEFAULT_ASSET_CLASS_PARAMS)
    })
  },
)

describeCalculation(
  'allocation-weight-normalization',
  {
    example: {
      inputs: { weightsPct: { usStocks: 60, intlStocks: 20, bonds: 20, cash: 0 } },
      expected: { vector: [0.6, 0.2, 0.2, 0], sum: 1 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-weight-normalization.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-weight-normalization.mutation.md',
  },
  ({ example }) => {
    const weights = example.inputs.weightsPct as AllocationWeights
    const expectedVector = example.expected.vector as number[]
    const vector = weightsToVector(weights)

    it('normalizes 60/20/20/0 to [0.6, 0.2, 0.2, 0] in ASSET_CLASS_IDS order', () => {
      expectVector('vector', vector, expectedVector, example.tolerance)
    })

    it('the components sum to 1', () => {
      const sum = vector.reduce((a, b) => a + b, 0)
      const expected = example.expected.sum as number
      expect(
        withinTolerance(sum, expected, example.tolerance),
        `sum ${sum} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('keeps class order positional: a 20/0/60/20 record puts the 60 at the bonds index, never sorted by magnitude', () => {
      // The worksheet's second wrong reading; its own fixture has two equal
      // weights, so this record discriminates the order instead.
      expect(ASSET_CLASS_IDS).toEqual(['usStocks', 'intlStocks', 'bonds', 'cash'])
      expectVector('vector(20/0/60/20)', weightsToVector(weightsPct(20, 0, 60, 20)), [0.2, 0, 0.6, 0.2], example.tolerance)
    })

    it('a zero total returns the all-cash vector [0, 0, 0, 1]', () => {
      // Endpoint outside the worksheet's positive-total domain, stated by the
      // record because the production function has that branch.
      expect(weightsToVector(weightsPct(0, 0, 0, 0))).toEqual([0, 0, 0, 1])
    })
  },
)

describeCalculation(
  'allocation-glidepath-interpolation',
  {
    example: {
      inputs: {
        fromPct: { usStocks: 80, bonds: 20 },
        toPct: { usStocks: 60, bonds: 40 },
        startYear: 2020,
        endYear: 2030,
        probes: { interior: 2025, before: 2015, after: 2035 },
      },
      expected: {
        at2025: [0.7, 0, 0.3, 0],
        at2015: [0.8, 0, 0.2, 0],
        at2035: [0.6, 0, 0.4, 0],
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-glidepath-interpolation.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-glidepath-interpolation.mutation.md',
  },
  ({ example }) => {
    // The worksheet's two-class endpoints in the schema's four-class percent
    // record: international and cash at 0.
    const from = weightsPct(80, 0, 20, 0)
    const to = weightsPct(60, 0, 40, 0)
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const probes = example.inputs.probes as { interior: number; before: number; after: number }
    const linear: AssetAllocationPolicy = { mode: 'linear', rebalancing: 'annual', from, to, startYear, endYear }

    it('interpolates [0.7, 0.3] halfway through the 2020-2030 glidepath at 2025', () => {
      const at2025 = targetWeightsAt(linear, probes.interior)
      expect(at2025).toHaveLength(ASSET_CLASS_IDS.length)
      expectVector('at2025', at2025, example.expected.at2025 as number[], example.tolerance)
    })

    it('clamps flat to the from vector at 2015 and the to vector at 2035', () => {
      expectVector('at2015', targetWeightsAt(linear, probes.before), example.expected.at2015 as number[], example.tolerance)
      expectVector('at2035', targetWeightsAt(linear, probes.after), example.expected.at2035 as number[], example.tolerance)
    })

    it('returns the endpoint vectors at the 2020 and 2030 knots', () => {
      expectVector('at2020', targetWeightsAt(linear, startYear), example.expected.at2015 as number[], example.tolerance)
      expectVector('at2030', targetWeightsAt(linear, endYear), example.expected.at2035 as number[], example.tolerance)
    })

    it('a staged policy holds each stage from its year as a step: 2025 still reads the 2020 stage', () => {
      // The claim's step-function branch, and the worksheet's first wrong
      // reading applied to the mode where it is right.
      const staged: AssetAllocationPolicy = {
        mode: 'staged',
        rebalancing: 'annual',
        stages: [
          { fromYear: startYear, weights: from },
          { fromYear: endYear, weights: to },
        ],
      }
      expectVector('staged 2025', targetWeightsAt(staged, probes.interior), example.expected.at2015 as number[], example.tolerance)
      expectVector('staged 2030', targetWeightsAt(staged, endYear), example.expected.at2035 as number[], example.tolerance)
    })

    it('a custom policy with the same two targets interpolates identically at 2025', () => {
      const custom: AssetAllocationPolicy = {
        mode: 'custom',
        rebalancing: 'annual',
        targets: [
          { year: startYear, weights: from },
          { year: endYear, weights: to },
        ],
      }
      expectVector('custom 2025', targetWeightsAt(custom, probes.interior), example.expected.at2025 as number[], example.tolerance)
    })
  },
)

describeCalculation(
  'allocation-blended-expected-return',
  {
    example: {
      inputs: { weights: [0.6, 0, 0.4, 0], classReturnsPct: { usStocks: 7, bonds: 4 } },
      expected: { blendedReturnPct: 5.8 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-blended-expected-return.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-blended-expected-return.mutation.md',
  },
  ({ example }) => {
    const weights = example.inputs.weights as number[]
    const classReturns = example.inputs.classReturnsPct as { usStocks: number; bonds: number }
    // The worksheet's 7% and 4% are the sourced defaults; no override is needed.
    const params = resolveAssetClassParams(undefined)

    it('reads the 7% US-stock and 4% bond class returns the worksheet states', () => {
      expect(params.usStocks.returnPct).toBe(classReturns.usStocks)
      expect(params.bonds.returnPct).toBe(classReturns.bonds)
    })

    it('blends 0.6 x 7% + 0.4 x 4% to 5.8%', () => {
      const blended = blendedReturnPct(weights, params)
      const expected = example.expected.blendedReturnPct as number
      expect(
        withinTolerance(blended, expected, example.tolerance),
        `blendedReturnPct ${blended} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('the ledger\'s inline copy grows an allocated account by the same 5.8% at zero shock', () => {
      const ledger = ledgerGrowthPct({ type: 'taxable', annualReturnPct: null }, weights, params, 0)
      const pinned = blendedReturnPct(weights, params)
      expect(
        withinTolerance(ledger, pinned, example.tolerance),
        `ledger growth ${ledger} is not within ${JSON.stringify(example.tolerance)} of blendedReturnPct ${pinned}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'allocation-account-expected-return',
  {
    example: {
      inputs: {
        allocationPct: { usStocks: 60, bonds: 40 },
        accountScalarReturnPct: 9,
        planDefaultReturnPct: 5,
        classReturnsPct: { usStocks: 7, bonds: 4 },
      },
      expected: { withAllocationPct: 5.8, withoutAllocationPct: 9, withNullScalarPct: 5 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-account-expected-return.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-account-expected-return.mutation.md',
  },
  ({ example }) => {
    const scalar = example.inputs.accountScalarReturnPct as number
    const planDefault = example.inputs.planDefaultReturnPct as number
    const plan = createEmptyPlan({ newId: () => 'id', now: () => new Date('2026-01-01') })
    const assumptions = { ...plan.assumptions, defaultReturnPct: planDefault, assetClassParams: undefined }
    const allocation: AssetAllocationPolicy = { mode: 'static', rebalancing: 'annual', weights: weightsPct(60, 0, 40, 0) }
    const account = {
      type: 'taxable' as const,
      id: 'a',
      name: 'a',
      ownerPersonId: null,
      annualReturnPct: scalar,
      balance: 100,
      costBasis: 100,
      annualContribution: 0,
      allocation,
    }

    it('uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation', () => {
      const rate = expectedAccountReturnPct(account, assumptions, 2026)
      const expected = example.expected.withAllocationPct as number
      expect(
        withinTolerance(rate, expected, example.tolerance),
        `withAllocationPct ${rate} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('falls back to the 9% account scalar without an allocation', () => {
      expect(expectedAccountReturnPct({ ...account, allocation: undefined }, assumptions, 2026)).toBe(
        example.expected.withoutAllocationPct,
      )
    })

    it('falls back to the 5% plan default when the scalar is null', () => {
      expect(
        expectedAccountReturnPct({ ...account, allocation: undefined, annualReturnPct: null }, assumptions, 2026),
      ).toBe(example.expected.withNullScalarPct)
    })

    it('the ledger\'s growth phase also ignores the 9% scalar for an allocated account: 5.8% at zero shock', () => {
      const ledger = ledgerGrowthPct(
        { type: 'taxable', annualReturnPct: scalar },
        targetWeightsAt(allocation, 2026),
        resolveAssetClassParams(assumptions.assetClassParams),
        planDefault,
      )
      const expected = example.expected.withAllocationPct as number
      expect(
        withinTolerance(ledger, expected, example.tolerance),
        `ledger growth ${ledger} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'allocation-blended-taxable-yield',
  {
    example: {
      inputs: {
        weights: [0.6, 0, 0.4, 0],
        classYields: {
          usStocks: { interestYieldPct: 0, dividendYieldPct: 1.5, qualifiedRatioPct: 95 },
          bonds: { interestYieldPct: 4, dividendYieldPct: 0, qualifiedRatioPct: 0 },
        },
      },
      expected: { interestYieldPct: 1.6, dividendYieldPct: 0.9, qualifiedRatio: 0.95 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-blended-taxable-yield.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-blended-taxable-yield.mutation.md',
  },
  ({ example }) => {
    const weights = example.inputs.weights as number[]
    const classYields = example.inputs.classYields as Record<
      'usStocks' | 'bonds',
      { interestYieldPct: number; dividendYieldPct: number; qualifiedRatioPct: number }
    >
    // The worksheet's class yields are the sourced defaults.
    const params = resolveAssetClassParams(undefined)
    const blend = blendedTaxableYield(weights, params)

    it('reads the sourced class yields the worksheet states', () => {
      for (const id of ['usStocks', 'bonds'] as const) {
        expect(params[id].interestYieldPct).toBe(classYields[id].interestYieldPct)
        expect(params[id].dividendYieldPct).toBe(classYields[id].dividendYieldPct)
        expect(params[id].qualifiedRatioPct).toBe(classYields[id].qualifiedRatioPct)
      }
    })

    it('blends 60/40 to 1.6% interest, 0.9% dividends and a 0.95 dividend-weighted qualified share', () => {
      for (const field of ['interestYieldPct', 'dividendYieldPct', 'qualifiedRatio'] as const) {
        const expected = example.expected[field] as number
        expect(
          withinTolerance(blend[field], expected, example.tolerance),
          `${field} ${blend[field]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
        ).toBe(true)
      }
    })

    it('falls back to the 0.85 qualified share when the blend has no dividends', () => {
      // The claim's fallback branch: an all-bond vector yields interest only.
      const bondsOnly = blendedTaxableYield([0, 0, 1, 0], params)
      expect(bondsOnly.dividendYieldPct).toBe(0)
      expect(bondsOnly.qualifiedRatio).toBe(DEFAULT_QUALIFIED_DIVIDEND_RATIO)
      expect(bondsOnly.qualifiedRatio).toBe(0.85)
    })
  },
)

describeCalculation(
  'allocation-total-return-drift',
  {
    example: {
      inputs: { weights: [0.6, 0, 0.4, 0], ratesPct: [10, 0, -5, 0] },
      expected: { driftedWeights: [33 / 52, 0, 19 / 52, 0], sum: 1 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-total-return-drift.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-total-return-drift.mutation.md',
  },
  ({ example }) => {
    const drifted = driftWeights(example.inputs.weights as number[], example.inputs.ratesPct as number[])

    it('drifts 60/40 to [33/52, 19/52] after +10% on stocks and -5% on bonds', () => {
      expectVector('driftedWeights', drifted, example.expected.driftedWeights as number[], example.tolerance)
    })

    it('the drifted weights are renormalized to sum 1', () => {
      const sum = drifted.reduce((a, b) => a + b, 0)
      const expected = example.expected.sum as number
      expect(
        withinTolerance(sum, expected, example.tolerance),
        `sum ${sum} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'allocation-rebalance-turnover',
  {
    example: {
      inputs: { current: [0.7, 0, 0.3, 0], target: [0.6, 0, 0.4, 0] },
      expected: { turnoverFraction: 0.1 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/allocation-rebalance-turnover.md',
    mutation: 'DOCS/calculations/accounts-and-growth/allocation-rebalance-turnover.mutation.md',
  },
  ({ example }) => {
    const current = example.inputs.current as number[]
    const target = example.inputs.target as number[]

    it('sells 0.1 of the account to move 70/30 to 60/40', () => {
      const turnover = rebalanceTurnoverFraction(current, target)
      const expected = example.expected.turnoverFraction as number
      expect(
        withinTolerance(turnover, expected, example.tolerance),
        `turnoverFraction ${turnover} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('is zero when the weights already sit at the target', () => {
      expect(rebalanceTurnoverFraction(target, target)).toBe(0)
    })

    it('counts each dollar moved once: the reverse move also sells 0.1, not 0.2', () => {
      // The worksheet's first wrong reading (absolute differences) would give 0.2.
      const reverse = rebalanceTurnoverFraction(target, current)
      const expected = example.expected.turnoverFraction as number
      expect(
        withinTolerance(reverse, expected, example.tolerance),
        `reverse turnover ${reverse} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
