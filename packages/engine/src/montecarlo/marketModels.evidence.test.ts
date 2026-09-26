import { expect, it } from 'vitest'
import type { MarketSeries } from '../projection/types.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { HISTORICAL_YEARS, meanPortfolioReturnPct } from './historicalReturns.js'
import {
  createAR1Model,
  createCapeConditionedModel,
  createEmpiricalModel,
  createGarchModel,
  createGaussianModel,
  createHistoricalModel,
  createInflationRegimeModel,
  createLognormalModel,
  createRegimeSwitchModel,
  createReversedHistoryModel,
  createStationaryBootstrapModel,
  createStudentTModel,
  createUserShockModel,
  sampleChiSquare,
} from './marketModels.js'
import { createRng, derivePathSeed, type Rng } from './rng.js'

function seriesOf(path: MarketSeries): { returnShockPct: number[]; inflationPct: number[] } {
  const { returnShockPct, inflationPct } = path
  if (returnShockPct === undefined || inflationPct === undefined) {
    throw new RangeError('generatePath omitted returnShockPct or inflationPct')
  }
  return { returnShockPct, inflationPct }
}

function scriptedRng(script: { uniforms?: number[]; normals?: number[]; ints?: number[] }): Rng {
  let u = 0
  let n = 0
  let i = 0
  return {
    next: () => {
      const draw = script.uniforms?.[u]
      if (draw === undefined) throw new RangeError(`uniform ${u} was not scripted`)
      u += 1
      return draw
    },
    nextNormal: () => {
      const draw = script.normals?.[n]
      if (draw === undefined) throw new RangeError(`normal ${n} was not scripted`)
      n += 1
      return draw
    },
    nextInt: () => {
      const draw = script.ints?.[i]
      if (draw === undefined) throw new RangeError(`int ${i} was not scripted`)
      i += 1
      return draw
    },
  }
}

describeCalculation(
  'market-model-ar1-shock',
  {
    example: {
      inputs: { priorShockPct: 10, phi: 0.2, innovation: 0 },
      expected: { nextShocksPct: [2, 0.4] },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-ar1-shock.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-ar1-shock.mutation.md',
  },
  ({ example }) => {
    const phi = example.inputs.phi as number
    const prior = example.inputs.priorShockPct as number
    const expected = example.expected.nextShocksPct as number[]

    it('after a 10-point shock, two zero-innovation years are 2 then 0.4', () => {
      // Production starts prev at 0. Year 1 uses returnVolPct = prior so that
      // eps = 1 produces the worksheet's prior of 10; years 2–3 are the
      // worksheet's next two shocks with innovation 0.
      const model = createAR1Model({
        type: 'ar1',
        phi,
        returnVolPct: prior,
        inflationMeanPct: 0,
        inflationVolPct: 0,
      })
      const path = seriesOf(
        model.generatePath(
          scriptedRng({ normals: [1, 0, example.inputs.innovation as number, 0, example.inputs.innovation as number, 0] }),
          3,
        ),
      )
      expected.forEach((value, index) => {
        const shock = path.returnShockPct[index + 1]!
        expect(
          withinTolerance(shock, value, example.tolerance),
          `nextShocksPct[${index}] ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
      })
    })
  },
)

describeCalculation(
  'market-model-cape-conditioned',
  {
    example: {
      inputs: { startingCape: 25, sensitivity: 0.15, volatilityPct: 0 },
      expected: { returnShockPct: -0.75 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-cape-conditioned.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-cape-conditioned.mutation.md',
  },
  ({ example }) => {
    it('CAPE 25 at sensitivity 0.15 and zero vol shifts the shock by −0.75', () => {
      const model = createCapeConditionedModel({
        type: 'cape-conditioned',
        startingCape: example.inputs.startingCape as number,
        capeSensitivity: example.inputs.sensitivity as number,
        returnVolPct: example.inputs.volatilityPct as number,
        inflationMeanPct: 0,
        inflationVolPct: 0,
      })
      const path = seriesOf(model.generatePath(scriptedRng({ normals: [0, 0] }), 1))
      const shock = path.returnShockPct[0]!
      const expected = example.expected.returnShockPct as number
      expect(
        withinTolerance(shock, expected, example.tolerance),
        `returnShockPct ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'market-model-empirical-history',
  {
    example: {
      inputs: {
        type: 'empirical',
        centered: true,
        equityWeightPct: 60,
        firstIntegerDraw: 0,
        firstUniformCoin: 0.6,
        yearCount: 1,
      },
      expected: {
        datasetMeanPct: 8.937291666666669,
        centeredShockPct: 17.662708333333327,
        rawShockPct: 26.599999999999998,
        inflationPct: -1.2,
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-empirical-history.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-empirical-history.mutation.md',
  },
  ({ example }) => {
    const equityWeightPct = example.inputs.equityWeightPct as number
    const yearCount = example.inputs.yearCount as number

    it('dataset mean at 60% equity is 8.937291666666669', () => {
      const meanPct = meanPortfolioReturnPct(equityWeightPct)
      const expectedMean = example.expected.datasetMeanPct as number
      expect(
        withinTolerance(meanPct, expectedMean, example.tolerance),
        `datasetMeanPct ${meanPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedMean}`,
      ).toBe(true)
    })

    it('1928 at 60% equity: centered shock 17.662708333333327, raw 26.599999999999998, inflation −1.2%', () => {
      const keepFirst = scriptedRng({
        ints: [example.inputs.firstIntegerDraw as number],
        uniforms: [example.inputs.firstUniformCoin as number],
      })
      const keepFirstRaw = scriptedRng({
        ints: [example.inputs.firstIntegerDraw as number],
        uniforms: [example.inputs.firstUniformCoin as number],
      })
      const centered = seriesOf(
        createEmpiricalModel({
          type: 'empirical',
          centered: true,
          equityWeightPct,
        }).generatePath(keepFirst, yearCount),
      )
      const raw = seriesOf(
        createEmpiricalModel({
          type: 'empirical',
          centered: false,
          equityWeightPct,
        }).generatePath(keepFirstRaw, yearCount),
      )
      const expectedCentered = example.expected.centeredShockPct as number
      const expectedRaw = example.expected.rawShockPct as number
      const expectedInflation = example.expected.inflationPct as number
      expect(
        withinTolerance(centered.returnShockPct[0]!, expectedCentered, example.tolerance),
        `centeredShockPct ${centered.returnShockPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedCentered}`,
      ).toBe(true)
      expect(
        withinTolerance(raw.returnShockPct[0]!, expectedRaw, example.tolerance),
        `rawShockPct ${raw.returnShockPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedRaw}`,
      ).toBe(true)
      expect(
        withinTolerance(centered.inflationPct[0]!, expectedInflation, example.tolerance),
        `centered inflationPct ${centered.inflationPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation}`,
      ).toBe(true)
      expect(
        withinTolerance(raw.inflationPct[0]!, expectedInflation, example.tolerance),
        `raw inflationPct ${raw.inflationPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'market-model-garch-variance',
  {
    example: {
      inputs: {
        type: 'garch',
        returnVolPct: 12,
        alpha: 0.1,
        beta: 0.85,
        inflationMeanPct: 0,
        inflationVolPct: 0,
        correlation: 0,
        normals: [1, 0, 0.5, 0, -2, 0, 0, 0],
        yearCount: 4,
      },
      expected: {
        returnShockPct: [12, 6, -23.082460874005616, 0],
        inflationPct: [0, 0, 0, 0],
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-garch-variance.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-garch-variance.mutation.md',
  },
  ({ example }) => {
    const base = {
      type: 'garch' as const,
      inflationMeanPct: example.inputs.inflationMeanPct as number,
      inflationVolPct: example.inputs.inflationVolPct as number,
      correlation: example.inputs.correlation as number,
    }

    function expectShocks(path: { returnShockPct: number[] }, expected: readonly number[]): void {
      expected.forEach((value, index) => {
        const shock = path.returnShockPct[index]!
        expect(
          withinTolerance(shock, value, example.tolerance),
          `returnShockPct[${index}] ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
      })
    }

    it('defaults (12, 0.1, 0.85), Z1 = 1, 0.5, −2, 0: shocks 12, 6, −23.082460874005616, 0 with inflation 0', () => {
      const path = seriesOf(
        createGarchModel({
          ...base,
          returnVolPct: example.inputs.returnVolPct as number,
          alpha: example.inputs.alpha as number,
          beta: example.inputs.beta as number,
        }).generatePath(scriptedRng({ normals: example.inputs.normals as number[] }), example.inputs.yearCount as number),
      )
      expectShocks(path, example.expected.returnShockPct as number[])
      const expectedInflation = example.expected.inflationPct as number[]
      expectedInflation.forEach((value, index) => {
        const inflation = path.inflationPct[index]!
        expect(
          withinTolerance(inflation, value, example.tolerance),
          `inflationPct[${index}] ${inflation} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
      })
    })

    it('the same defaults are what an empty config runs: omega is 0.0144 · 0.05 and v_1 is 0.0144', () => {
      const path = seriesOf(createGarchModel(base).generatePath(scriptedRng({ normals: example.inputs.normals as number[] }), 4))
      expectShocks(path, example.expected.returnShockPct as number[])
    })

    it('returnVolPct 100, alpha 0.1, beta 0.8, Z1 = 1, 0.5, −2: variances 1, 1, 0.925 and shocks 100, 50, −192.35384061671346', () => {
      const path = seriesOf(
        createGarchModel({ ...base, returnVolPct: 100, alpha: 0.1, beta: 0.8 }).generatePath(
          scriptedRng({ normals: [1, 0, 0.5, 0, -2, 0] }),
          3,
        ),
      )
      expectShocks(path, [100, 50, -192.35384061671346])
    })

    it('alpha = beta = 0 is an iid normal with the configured standard deviation', () => {
      const path = seriesOf(
        createGarchModel({ ...base, alpha: 0, beta: 0 }).generatePath(scriptedRng({ normals: [1, 0, -2, 0, 0.5, 0] }), 3),
      )
      expectShocks(path, [12, -24, 6])
    })

    it('refuses a negative or non-finite volatility, negative or non-finite weights, and alpha + beta of 1 or more', () => {
      for (const returnVolPct of [-12, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => createGarchModel({ ...base, returnVolPct })).toThrow(
          new RangeError(`GARCH returnVolPct must be a finite number of at least 0; got ${returnVolPct}.`),
        )
      }
      expect(() => createGarchModel({ ...base, alpha: -0.1 })).toThrow(
        new RangeError('GARCH alpha and beta must be finite numbers of at least 0; got alpha -0.1, beta 0.85.'),
      )
      expect(() => createGarchModel({ ...base, beta: Number.NaN })).toThrow(
        new RangeError('GARCH alpha and beta must be finite numbers of at least 0; got alpha 0.1, beta NaN.'),
      )
      expect(() => createGarchModel({ ...base, alpha: 0.1, beta: 0.9 })).toThrow(
        new RangeError('GARCH alpha + beta must be below 1 for a finite long-run variance; got alpha 0.1 + beta 0.9 = 1.'),
      )
      expect(() => createGarchModel({ ...base, alpha: 0.2, beta: 0.85 })).toThrow(
        new RangeError('GARCH alpha + beta must be below 1 for a finite long-run variance; got alpha 0.2 + beta 0.85 = 1.05.'),
      )
      expect(() => createGarchModel({ ...base, returnVolPct: 0 })).not.toThrow()
    })

    it('refuses the retired keys omega and returnVolScalePct from an untyped caller, naming the replacement', () => {
      // A caller written against the earlier config would otherwise run the default 12 without a word.
      const untyped = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as unknown as Parameters<typeof createGarchModel>[0]
      expect(() => createGarchModel(untyped({ omega: 0.00001 }))).toThrow(
        new RangeError(
          'GARCH omega is no longer an input: it is derived as (returnVolPct / 100)^2 * (1 - alpha - beta), so the long-run standard deviation equals returnVolPct; remove omega (got 0.00001).',
        ),
      )
      expect(() => createGarchModel(untyped({ returnVolScalePct: 20 }))).toThrow(
        new RangeError(
          'GARCH returnVolScalePct was renamed returnVolPct, the long-run standard deviation of the return shock in percentage points; pass returnVolPct instead (got returnVolScalePct 20).',
        ),
      )
      // An explicit undefined is not a value, and the current key is accepted.
      expect(() => createGarchModel(untyped({ omega: undefined, returnVolScalePct: undefined, returnVolPct: 20 }))).not.toThrow()
    })

    it('2,000 seeded paths of 30 years: every year has the configured variance, mean 0, and squared shocks cluster', () => {
      // P = 2,000 paths seeded createRng(derivePathSeed(20260925, p)), Y = 30 years, r = shock / 12.
      // mean(r^2) is 1 in every year (E[v_t] = sigmaBar^2 by induction from v_1 = sigmaBar^2); the
      // tolerance 0.07 is five times an upper bound of 0.01428 on its standard error. mean(r) is 0
      // with standard error 1 / sqrt(60,000) = 0.00408; tolerance five of those, 0.0205. The
      // clustering statistic is the pooled Pearson correlation of (r_{t-1}^2, r_t^2) over all
      // 2,000 x 29 consecutive within-path pairs (separate x and y means): the GARCH value over 20
      // seeds has mean 0.151, standard deviation 0.0099 and minimum 0.131, while an iid model
      // (alpha = beta = 0) never exceeds 0.008. The bound 0.08 sits 7 standard deviations below the
      // GARCH mean and ten times above the largest iid value, so it separates the two on any seed.
      const paths = 2000
      const years = 30
      const statistics = (config: Parameters<typeof createGarchModel>[0]) => {
        const model = createGarchModel(config)
        let sum = 0
        let sumSquares = 0
        let count = 0
        let sx = 0
        let sy = 0
        let sxx = 0
        let syy = 0
        let sxy = 0
        let pairs = 0
        for (let p = 0; p < paths; p++) {
          const shocks = seriesOf(model.generatePath(createRng(derivePathSeed(20260925, p)), years)).returnShockPct
          for (let t = 0; t < years; t++) {
            const r = shocks[t]! / 12
            sum += r
            sumSquares += r * r
            count += 1
            if (t > 0) {
              const x = (shocks[t - 1]! / 12) ** 2
              const y = r * r
              sx += x
              sy += y
              sxx += x * x
              syy += y * y
              sxy += x * y
              pairs += 1
            }
          }
        }
        const mx = sx / pairs
        const my = sy / pairs
        const clustering = (sxy / pairs - mx * my) / Math.sqrt((sxx / pairs - mx * mx) * (syy / pairs - my * my))
        return { meanSquare: sumSquares / count, mean: sum / count, clustering }
      }
      const garch = statistics({ type: 'garch', inflationMeanPct: 2.5 })
      expect(Math.abs(garch.meanSquare - 1), `mean(r^2) ${garch.meanSquare}`).toBeLessThan(0.07)
      expect(Math.abs(garch.mean), `mean(r) ${garch.mean}`).toBeLessThan(0.0205)
      expect(garch.clustering, `clustering ${garch.clustering}`).toBeGreaterThan(0.08)
      // The same statistic on alpha = beta = 0 (an iid normal) stays far below the bound.
      const iid = statistics({ type: 'garch', inflationMeanPct: 2.5, alpha: 0, beta: 0 })
      expect(Math.abs(iid.meanSquare - 1)).toBeLessThan(0.07)
      expect(iid.clustering, `iid clustering ${iid.clustering}`).toBeLessThan(0.08)
    })
  },
)

describeCalculation(
  'market-model-gaussian-draw',
  {
    example: {
      inputs: { volatilityPct: 12, standardNormal: -2 },
      expected: { returnShockPct: -24 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-gaussian-draw.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-gaussian-draw.mutation.md',
  },
  ({ example }) => {
    it('volatility 12 times Z = −2 is shock −24', () => {
      const model = createGaussianModel({
        type: 'gaussian',
        returnVolPct: example.inputs.volatilityPct as number,
        inflationMeanPct: 0,
        inflationVolPct: 0,
      })
      const path = seriesOf(model.generatePath(scriptedRng({ normals: [example.inputs.standardNormal as number, 0] }), 1))
      expect(path.returnShockPct[0]).toBe(example.expected.returnShockPct)
    })
  },
)

describeCalculation(
  'market-model-historical-centered-bootstrap',
  {
    example: {
      inputs: {
        type: 'historical',
        mode: 'iid',
        equityWeightPct: 60,
        firstIntegerDraw: 0,
        yearCount: 1,
      },
      expected: { returnShockPct: 17.662708333333327, inflationPct: -1.2 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-historical-centered-bootstrap.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-historical-centered-bootstrap.mutation.md',
  },
  ({ example }) => {
    it('1928 at 60% equity is shock 17.662708333333327 and inflation −1.2%', () => {
      const model = createHistoricalModel({
        type: 'historical',
        mode: 'iid',
        equityWeightPct: example.inputs.equityWeightPct as number,
      })
      const path = seriesOf(
        model.generatePath(scriptedRng({ ints: [example.inputs.firstIntegerDraw as number] }), example.inputs.yearCount as number),
      )
      const shock = path.returnShockPct[0]!
      const inflation = path.inflationPct[0]!
      const expectedShock = example.expected.returnShockPct as number
      const expectedInflation = example.expected.inflationPct as number
      expect(
        withinTolerance(shock, expectedShock, example.tolerance),
        `returnShockPct ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedShock}`,
      ).toBe(true)
      expect(
        withinTolerance(inflation, expectedInflation, example.tolerance),
        `inflationPct ${inflation} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'market-model-inflation-regime',
  {
    example: {
      inputs: { highInflationProb: 0.2, regimeDraw: 0.1, highMeanPct: 8, baseMeanPct: 3, innovationVolPct: 0 },
      expected: { inflationPct: 8 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-inflation-regime.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-inflation-regime.mutation.md',
  },
  ({ example }) => {
    it('U = 0.10 < 0.20 selects the high regime at 8% with zero innovation', () => {
      const model = createInflationRegimeModel({
        type: 'inflation-regime',
        highInflationProb: example.inputs.highInflationProb as number,
        highInflationMean: example.inputs.highMeanPct as number,
        baseInflationMeanPct: example.inputs.baseMeanPct as number,
        returnVolPct: example.inputs.innovationVolPct as number,
      })
      const path = seriesOf(
        model.generatePath(scriptedRng({ uniforms: [example.inputs.regimeDraw as number], normals: [0, 0] }), 1),
      )
      expect(path.inflationPct[0]).toBe(example.expected.inflationPct)
    })
  },
)

describeCalculation(
  'market-model-lognormal-draw',
  {
    example: {
      inputs: { returnVolPct: 0, inflationMeanPct: 3, inflationVolPct: 0 },
      expected: { returnShockPct: 0, inflationPct: 3 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-lognormal-draw.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-lognormal-draw.mutation.md',
  },
  ({ example }) => {
    it('zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year', () => {
      const model = createLognormalModel({
        type: 'lognormal',
        returnVolPct: example.inputs.returnVolPct as number,
        inflationMeanPct: example.inputs.inflationMeanPct as number,
        inflationVolPct: example.inputs.inflationVolPct as number,
      })
      const path = seriesOf(model.generatePath(scriptedRng({ normals: [1.7, -0.4, -2, 0.5] }), 2))
      for (const shock of path.returnShockPct) expect(shock).toBe(example.expected.returnShockPct)
      for (const inflation of path.inflationPct) expect(inflation).toBe(example.expected.inflationPct)
    })
  },
)

describeCalculation(
  'market-model-regime-switch',
  {
    example: {
      inputs: {
        bullDeviationPct: 4,
        bearDeviationPct: -4,
        bullVolPct: 0,
        bearVolPct: 0,
        currentState: 'bull',
        switchDraw: 0.9,
        switchProb: 0.05,
      },
      expected: { state: 'bull', returnShockPct: 4 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-regime-switch.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-regime-switch.mutation.md',
  },
  ({ example }) => {
    it('bull start, U = 0.9 >= 0.05, zero vol: shock +4', () => {
      const model = createRegimeSwitchModel({
        type: 'regime-switch',
        bullMeanPct: example.inputs.bullDeviationPct as number,
        bearMeanPct: example.inputs.bearDeviationPct as number,
        bullVolPct: example.inputs.bullVolPct as number,
        bearVolPct: example.inputs.bearVolPct as number,
        switchProb: example.inputs.switchProb as number,
        inflationMeanPct: 0,
        inflationVolPct: 0,
      })
      // First uniform > 0.5 starts bull (the worksheet's current state);
      // the switch draw is 0.9.
      const path = seriesOf(
        model.generatePath(scriptedRng({ uniforms: [0.6, example.inputs.switchDraw as number], normals: [0, 0] }), 1),
      )
      expect(path.returnShockPct[0]).toBe(example.expected.returnShockPct)
    })
  },
)

describeCalculation(
  'market-model-reversed-history',
  {
    example: {
      inputs: {
        type: 'reversed-history',
        windowLengthYears: 5,
        equityWeightPct: 60,
        startIndex: 72,
        yearCount: 3,
      },
      expected: {
        reversedYears: [2004, 2003, 2002],
        returnShockPct: [-0.7172916666666698, 8.26270833333333, -16.097291666666667],
        inflationPct: [3.3, 1.9, 2.4],
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-reversed-history.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-reversed-history.mutation.md',
  },
  ({ example }) => {
    it('replays 2004, 2003, 2002 from a 5-year window with the worksheet shocks', () => {
      const model = createReversedHistoryModel({
        type: 'reversed-history',
        windowLengthYears: example.inputs.windowLengthYears as number,
        equityWeightPct: example.inputs.equityWeightPct as number,
      })
      let drawnBound: number | undefined
      const ints = scriptedRng({ ints: [example.inputs.startIndex as number] })
      const path = seriesOf(
        model.generatePath(
          {
            ...ints,
            nextInt: (bound: number) => {
              drawnBound = bound
              return ints.nextInt(bound)
            },
          },
          example.inputs.yearCount as number,
        ),
      )
      // The start is drawn from 0..n − L: nextInt(96 − 5 + 1) = nextInt(92).
      expect(drawnBound).toBe(HISTORICAL_YEARS.length - (example.inputs.windowLengthYears as number) + 1)
      const expectedYears = example.expected.reversedYears as number[]
      const expectedShocks = example.expected.returnShockPct as number[]
      const expectedInflation = example.expected.inflationPct as number[]
      expectedShocks.forEach((value, index) => {
        const shock = path.returnShockPct[index]!
        const inflation = path.inflationPct[index]!
        const year = expectedYears[index]!
        expect(
          withinTolerance(shock, value, example.tolerance),
          `returnShockPct[${index}] (year ${year}) ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
        expect(
          withinTolerance(inflation, expectedInflation[index]!, example.tolerance),
          `inflationPct[${index}] (year ${year}) ${inflation} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation[index]}`,
        ).toBe(true)
      })
    })

    it('a 7-year path wraps inside the 5-year window: 2004, 2003, 2002, 2001, 2000, 2004, 2003', () => {
      const model = createReversedHistoryModel({
        type: 'reversed-history',
        windowLengthYears: example.inputs.windowLengthYears as number,
        equityWeightPct: example.inputs.equityWeightPct as number,
      })
      const path = seriesOf(model.generatePath(scriptedRng({ ints: [example.inputs.startIndex as number] }), 7))
      const rowOf = (year: number) => HISTORICAL_YEARS.find((row) => row.year === year)!
      expect(path.inflationPct).toEqual([2004, 2003, 2002, 2001, 2000, 2004, 2003].map((year) => rowOf(year).inflationPct))
    })

    it('at the UI window of 10 and start 72 the first three years are 2009, 2008, 2007', () => {
      const path = seriesOf(
        createReversedHistoryModel({ type: 'reversed-history', windowLengthYears: 10, equityWeightPct: 60 }).generatePath(
          scriptedRng({ ints: [72] }),
          3,
        ),
      )
      const expected = [2.1627083333333292, -22.85729166666667, -1.5572916666666687]
      expected.forEach((value, index) => {
        expect(
          withinTolerance(path.returnShockPct[index]!, value, example.tolerance),
          `returnShockPct[${index}] ${path.returnShockPct[index]} is not within ${JSON.stringify(example.tolerance)} of ${value}`,
        ).toBe(true)
      })
      expect(path.inflationPct).toEqual([2.7, 0.1, 4.1])
    })

    it('refuses a window that is not a whole number from 5 to 96, instead of clamping it', () => {
      for (const windowLengthYears of [3, 4, 4.999, 5.5, 97, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => createReversedHistoryModel({ type: 'reversed-history', windowLengthYears })).toThrow(
          new RangeError(
            `Reversed-history windowLengthYears must be a whole number of years from 5 to 96 (the length of the historical series); got ${windowLengthYears}.`,
          ),
        )
      }
      for (const windowLengthYears of [undefined, 5, 10, 95, 96]) {
        expect(() => createReversedHistoryModel({ type: 'reversed-history', windowLengthYears })).not.toThrow()
      }
    })
  },
)

describeCalculation(
  'market-model-stationary-bootstrap',
  {
    example: {
      inputs: {
        type: 'stationary',
        meanBlockLength: 5,
        equityWeightPct: 60,
        ints: [72, 0],
        uniforms: [0.5, 0.9],
        yearCount: 5,
      },
      expected: {
        replayedYears: [2000, 2001, 2002, 1928, 1929],
        blockLengths: [3, 11],
        returnShockPct: [-7.657291666666668, -13.837291666666669, -16.097291666666667, 17.662708333333327, -12.23729166666667],
        inflationPct: [3.4, 1.6, 2.4, -1.2, 0.6],
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-stationary-bootstrap.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-stationary-bootstrap.mutation.md',
  },
  ({ example }) => {
    it('five years: inflation 3.4, 1.6, 2.4, −1.2, 0.6 identifying 2000, 2001, 2002, 1928, 1929', () => {
      const model = createStationaryBootstrapModel({
        type: 'stationary',
        meanBlockLength: example.inputs.meanBlockLength as number,
        equityWeightPct: example.inputs.equityWeightPct as number,
      })
      const path = seriesOf(
        model.generatePath(
          scriptedRng({
            ints: example.inputs.ints as number[],
            uniforms: example.inputs.uniforms as number[],
          }),
          example.inputs.yearCount as number,
        ),
      )
      const expectedInflation = example.expected.inflationPct as number[]
      const expectedShocks = example.expected.returnShockPct as number[]
      const expectedYears = example.expected.replayedYears as number[]
      const expectedBlockLengths = example.expected.blockLengths as number[]

      expectedInflation.forEach((value, index) => {
        expect(path.inflationPct[index]).toBe(value)
      })
      expectedShocks.forEach((value, index) => {
        const shock = path.returnShockPct[index]!
        expect(
          withinTolerance(shock, value, example.tolerance),
          `returnShockPct[${index}] ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
      })

      const identifiedYears: number[] = []
      path.inflationPct.forEach((inflation, index) => {
        const previous = identifiedYears[index - 1]
        if (previous !== undefined) {
          const prevIdx = HISTORICAL_YEARS.findIndex((row) => row.year === previous)
          const continued = HISTORICAL_YEARS[(prevIdx + 1) % HISTORICAL_YEARS.length]!
          if (continued.inflationPct === inflation) {
            identifiedYears.push(continued.year)
            return
          }
        }
        const matches = HISTORICAL_YEARS.filter((row) => row.inflationPct === inflation)
        const nextInflation = path.inflationPct[index + 1]
        const chosen =
          nextInflation === undefined
            ? matches
            : matches.filter((row) => {
                const startIdx = HISTORICAL_YEARS.findIndex((entry) => entry.year === row.year)
                return HISTORICAL_YEARS[(startIdx + 1) % HISTORICAL_YEARS.length]!.inflationPct === nextInflation
              })
        if (chosen.length !== 1) {
          throw new RangeError(`inflationPct[${index}] = ${inflation} does not identify one historical year`)
        }
        identifiedYears.push(chosen[0]!.year)
      })
      expect(identifiedYears).toEqual(expectedYears)

      const firstBlockLength = identifiedYears.findIndex(
        (year, index) => index > 0 && year !== identifiedYears[index - 1]! + 1,
      )
      expect(firstBlockLength).toBe(expectedBlockLengths[0])
      expect(identifiedYears.slice(0, firstBlockLength)).toEqual([2000, 2001, 2002])
      expect(identifiedYears.slice(firstBlockLength)).toEqual([1928, 1929])

      // The second block's drawn length (11 from U = 0.9) is not observable in the
      // worksheet's five-year path, which requests only two of its rows. The same
      // model, the same first two draws and a third block draw (row 72, U = 0.5)
      // replayed over sixteen years expose it: the second block must publish
      // exactly eleven rows, 1928 to 1938, before the third block restarts at 2000.
      const secondBlockLength = expectedBlockLengths[1]!
      const longPath = seriesOf(
        model.generatePath(
          scriptedRng({
            ints: [...(example.inputs.ints as number[]), 72],
            uniforms: [...(example.inputs.uniforms as number[]), 0.5],
          }),
          firstBlockLength + secondBlockLength + 2,
        ),
      )
      const rowOf = (year: number) => HISTORICAL_YEARS.find((row) => row.year === year)!
      expect(longPath.inflationPct.slice(0, example.inputs.yearCount as number)).toEqual(path.inflationPct)
      for (let offset = 0; offset < secondBlockLength; offset++) {
        expect(longPath.inflationPct[firstBlockLength + offset]).toBe(rowOf(1928 + offset).inflationPct)
      }
      const thirdBlockStart = firstBlockLength + secondBlockLength
      expect(rowOf(2000).inflationPct).not.toBe(rowOf(1928 + secondBlockLength).inflationPct)
      expect(longPath.inflationPct[thirdBlockStart]).toBe(rowOf(2000).inflationPct)
      expect(longPath.inflationPct[thirdBlockStart + 1]).toBe(rowOf(2001).inflationPct)
    })
  },
)

describeCalculation(
  'market-model-student-t-draw',
  {
    example: {
      inputs: {
        df: 5,
        returnVolPct: 12,
        inflationMeanPct: 0,
        inflationVolPct: 0,
        correlation: 0,
        normals: [1, 0],
        uniforms: [0.5, 0, 0.5],
        yearCount: 1,
      },
      expected: {
        chiSquare: 8.805870575472607,
        mixingScale: 0.5836795510996967,
        returnShockPct: 7.00415461319636,
        inflationPct: 0,
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-student-t-draw.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-student-t-draw.mutation.md',
  },
  ({ example }) => {
    const base = {
      type: 'student-t' as const,
      returnVolPct: example.inputs.returnVolPct as number,
      inflationMeanPct: example.inputs.inflationMeanPct as number,
      inflationVolPct: example.inputs.inflationVolPct as number,
      correlation: example.inputs.correlation as number,
    }

    /** One scripted Student-t year, counting the uniforms and normals the model reads. */
    function oneYear(df: number, z: number, uniforms: readonly number[]) {
      const inner = scriptedRng({ normals: [z, 0], uniforms: [...uniforms] })
      let uniformsRead = 0
      let normalsRead = 0
      const rng: Rng = {
        next: () => {
          uniformsRead += 1
          return inner.next()
        },
        nextNormal: () => {
          normalsRead += 1
          return inner.nextNormal()
        },
        nextInt: (bound: number) => inner.nextInt(bound),
      }
      const path = seriesOf(createStudentTModel({ ...base, df }).generatePath(rng, 1))
      return { path, uniformsRead, normalsRead, rng }
    }

    function expectShock(actual: number, expected: number): void {
      expect(
        withinTolerance(actual, expected, example.tolerance),
        `returnShockPct ${actual} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    }

    it('B1, df 5, Z 1, uniforms 0.5, 0, 0.5: V = 8.805870575472607, m = 0.5836795510996967, shock 7.00415461319636, inflation 0', () => {
      const uniforms = example.inputs.uniforms as number[]
      const chiSquare = sampleChiSquare(scriptedRng({ uniforms }), example.inputs.df as number)
      expect(
        withinTolerance(chiSquare, example.expected.chiSquare as number, example.tolerance),
        `V ${chiSquare} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${example.expected.chiSquare}`,
      ).toBe(true)
      const mixingScale = Math.sqrt(((example.inputs.df as number) - 2) / chiSquare)
      expect(
        withinTolerance(mixingScale, example.expected.mixingScale as number, example.tolerance),
        `m ${mixingScale} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${example.expected.mixingScale}`,
      ).toBe(true)
      const year = oneYear(example.inputs.df as number, (example.inputs.normals as number[])[0]!, uniforms)
      expectShock(year.path.returnShockPct[0]!, example.expected.returnShockPct as number)
      expect(year.path.inflationPct[0]).toBe(example.expected.inflationPct)
      // Draw order: Z (normal), three uniforms for V (squeeze accepts), z2 (normal).
      expect(year.uniformsRead).toBe(3)
      expect(year.normalsRead).toBe(2)
    })

    it('inflation reads t, not Z: B1 draws with rho −0.2, inflation vol 1.5 and z2 = 0.5 give 0.5597430575050444', () => {
      // inflation = 0 + 1.5 · (−0.2 · t + sqrt(1 − 0.04) · 0.5) with t = m · Z = 0.5836795510996967.
      // Reading Z = 1 in place of t would give 1.5 · (−0.2 + sqrt(0.96) · 0.5) = 0.4348469228349534.
      const path = seriesOf(
        createStudentTModel({ ...base, correlation: -0.2, inflationVolPct: 1.5, inflationMeanPct: 0, df: 5 }).generatePath(
          scriptedRng({ normals: [1, 0.5], uniforms: example.inputs.uniforms as number[] }),
          1,
        ),
      )
      expectShock(path.returnShockPct[0]!, example.expected.returnShockPct as number)
      expect(
        withinTolerance(path.inflationPct[0]!, 0.5597430575050444, example.tolerance),
        `inflationPct ${path.inflationPct[0]} is not within ${JSON.stringify(example.tolerance)} of 0.5597430575050444`,
      ).toBe(true)
      expect(withinTolerance(path.inflationPct[0]!, 0.4348469228349534, example.tolerance)).toBe(false)
    })

    it('B2, an attempt rejected at s <= 0 reads two uniforms and retries: shock 7.00415461319636 after 5 uniforms', () => {
      const year = oneYear(5, 1, [1e-5, 0.5, 0.5, 0, 0.5])
      expectShock(year.path.returnShockPct[0]!, example.expected.returnShockPct as number)
      expect(year.uniformsRead).toBe(5)
    })

    it('B3, the squeeze fails and the exact test rejects, then accepts: shock 7.00415461319636 after 6 uniforms', () => {
      const year = oneYear(5, 1, [0.5, 0, 0.999, 0.5, 0, 0.95])
      expectShock(year.path.returnShockPct[0]!, example.expected.returnShockPct as number)
      expect(year.uniformsRead).toBe(6)
      expect(() => year.rng.next()).toThrow(new RangeError('uniform 6 was not scripted'))
    })

    it('B4, non-integer df 2.5, Z −2, uniforms 0.5, 0, 0.5: shock −7.486573660049821', () => {
      const year = oneYear(2.5, -2, [0.5, 0, 0.5])
      expectShock(year.path.returnShockPct[0]!, -7.486573660049821)
    })

    it('refuses df of 2 or below and a non-finite df with the stated message; accepts 2.0000001, 2.5 and 3', () => {
      for (const df of [2, 1.5, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => createStudentTModel({ ...base, df })).toThrow(
          new RangeError(
            `Student-t degrees of freedom must be a finite number greater than 2 (at 2 or below the variance is infinite, so no volatility can be matched); got ${df}.`,
          ),
        )
      }
      for (const df of [2.0000001, 2.5, 3]) expect(() => createStudentTModel({ ...base, df })).not.toThrow()
    })

    it('one seeded path of 200,000 years at df 5: mean 0, variance 1 and tail share 0.0117248110 within five standard errors', () => {
      // r = shock / 12. Exact values: E[r] = 0, E[r^2] = 1, P(|r| > 3) = P(|T_5| > 3 / sqrt(0.6)) =
      // 0.011724811003954616 from the closed-form t_5 distribution function. Standard errors at N:
      // 1/sqrt(N) = 0.002236, sqrt((E[t^4] − 1)/N) = sqrt(8/N) = 0.006325 (E[t^4] = 9 at df 5), and
      // sqrt(p(1 − p)/N) = 0.0002407. The five-standard-error bands reject the old mixture (variance
      // 1.2625), an unscaled t (variance 5/3) and a plain normal (tail share 0.0027).
      const N = 200_000
      const shocks = seriesOf(
        createStudentTModel({ type: 'student-t', df: 5, returnVolPct: 12, inflationMeanPct: 2.5 }).generatePath(
          createRng(20260925),
          N,
        ),
      ).returnShockPct
      let sum = 0
      let sumSquares = 0
      let beyondThree = 0
      for (const shock of shocks) {
        const r = shock / 12
        sum += r
        sumSquares += r * r
        if (Math.abs(r) > 3) beyondThree += 1
      }
      const mean = sum / N
      const variance = sumSquares / N - mean * mean
      expect(Math.abs(mean), `mean ${mean}`).toBeLessThan(0.0112)
      expect(Math.abs(variance - 1), `variance ${variance}`).toBeLessThan(0.0317)
      expect(Math.abs(beyondThree / N - 0.011724811003954616), `tail share ${beyondThree / N}`).toBeLessThan(0.0012)
    })

    it('sampleChiSquare at df 5 has mean 5 within five standard errors over 200,000 seeded draws', () => {
      // Var(chi^2_5) = 10, so the standard error of the mean is sqrt(10 / N) = 0.00707.
      const rng = createRng(7)
      const N = 200_000
      let sum = 0
      for (let i = 0; i < N; i++) sum += sampleChiSquare(rng, 5)
      expect(Math.abs(sum / N - 5), `mean ${sum / N}`).toBeLessThan(0.0354)
    })
  },
)

describeCalculation(
  'market-model-user-shock',
  {
    example: {
      inputs: { shockYear: 2, shockPct: -20, baseVolPct: 0, yearCount: 3 },
      expected: { returnShockPct: [0, -20, 0] },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-user-shock.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-user-shock.mutation.md',
  },
  ({ example }) => {
    it('years 1 and 3 are 0 and year 2 is −20', () => {
      const model = createUserShockModel({
        type: 'user-shock',
        shockYear: example.inputs.shockYear as number,
        shockPct: example.inputs.shockPct as number,
        baseReturnVolPct: example.inputs.baseVolPct as number,
        inflationMeanPct: 0,
      })
      const path = seriesOf(
        model.generatePath(scriptedRng({ normals: [0, 0, 0, 0, 0, 0] }), example.inputs.yearCount as number),
      )
      expect(path.returnShockPct).toEqual(example.expected.returnShockPct)
    })
  },
)
