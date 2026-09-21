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
} from './marketModels.js'
import type { Rng } from './rng.js'

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
        omega: 1,
        alpha: 0.1,
        beta: 0.8,
        returnVolScalePct: 100,
        inflationMeanPct: 0,
        inflationVolPct: 0,
        correlation: 0,
        normals: [1, 0, 0.5, 0],
        yearCount: 2,
      },
      expected: {
        returnShockPct: [500.019999600016, 518.4269476020705],
        inflationPct: [0, 0],
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-garch-variance.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-garch-variance.mutation.md',
  },
  ({ example }) => {
    it('two-year published shocks 500.019999600016 then 518.4269476020705 with inflation 0', () => {
      const path = seriesOf(
        createGarchModel({
          type: 'garch',
          omega: example.inputs.omega as number,
          alpha: example.inputs.alpha as number,
          beta: example.inputs.beta as number,
          returnVolScalePct: example.inputs.returnVolScalePct as number,
          inflationMeanPct: example.inputs.inflationMeanPct as number,
          inflationVolPct: example.inputs.inflationVolPct as number,
          correlation: example.inputs.correlation as number,
        }).generatePath(scriptedRng({ normals: example.inputs.normals as number[] }), example.inputs.yearCount as number),
      )
      const expectedShocks = example.expected.returnShockPct as number[]
      const expectedInflation = example.expected.inflationPct as number[]
      expectedShocks.forEach((value, index) => {
        const shock = path.returnShockPct[index]!
        expect(
          withinTolerance(shock, value, example.tolerance),
          `returnShockPct[${index}] ${shock} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
      })
      expectedInflation.forEach((value, index) => {
        const inflation = path.inflationPct[index]!
        expect(
          withinTolerance(inflation, value, example.tolerance),
          `inflationPct[${index}] ${inflation} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
        ).toBe(true)
      })
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
        windowLengthYears: 3,
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
    it('floors windowLengthYears 3 to 5 and replays 2004, 2003, 2002 with the worksheet shocks', () => {
      const model = createReversedHistoryModel({
        type: 'reversed-history',
        windowLengthYears: example.inputs.windowLengthYears as number,
        equityWeightPct: example.inputs.equityWeightPct as number,
      })
      const path = seriesOf(
        model.generatePath(scriptedRng({ ints: [example.inputs.startIndex as number] }), example.inputs.yearCount as number),
      )
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
      expect(expectedBlockLengths[1]).toBe(11)
    })
  },
)

describeCalculation(
  'market-model-student-t-draw',
  {
    example: {
      inputs: {
        returnVolScalePct: 12,
        inflationMeanPct: 0,
        inflationVolPct: 0,
        correlation: 0,
        cases: [
          { df: 5, z: 1, u: 0.5 },
          { df: 5, z: 1, u: 0.01 },
          { df: 3, z: 1, u: 0.01 },
        ],
      },
      expected: { returnShockPct: [12, 30, 42], inflationPct: [0, 0, 0] },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/market-model-student-t-draw.md',
    mutation: 'DOCS/calculations/monte-carlo/market-model-student-t-draw.mutation.md',
  },
  ({ example }) => {
    const cases = example.inputs.cases as readonly { df: number; z: number; u: number }[]
    const expectedShocks = example.expected.returnShockPct as number[]
    const expectedInflation = example.expected.inflationPct as number[]

    function pathOf(row: { df: number; z: number; u: number }) {
      // Draws per year come in the order nextNormal (return z), next (uniform u),
      // nextNormal (inflation z2). z2 is scripted 0; inflation vol is 0 so its
      // value is immaterial.
      const model = createStudentTModel({
        type: 'student-t',
        df: row.df,
        returnVolPct: example.inputs.returnVolScalePct as number,
        inflationMeanPct: example.inputs.inflationMeanPct as number,
        inflationVolPct: example.inputs.inflationVolPct as number,
        correlation: example.inputs.correlation as number,
      })
      return seriesOf(model.generatePath(scriptedRng({ normals: [row.z, 0], uniforms: [row.u] }), 1))
    }

    it('df 5, u 0.5, z 1: shock 12 and inflation 0', () => {
      const path = pathOf(cases[0]!)
      expect(
        withinTolerance(path.returnShockPct[0]!, expectedShocks[0]!, example.tolerance),
        `returnShockPct ${path.returnShockPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedShocks[0]}`,
      ).toBe(true)
      expect(
        withinTolerance(path.inflationPct[0]!, expectedInflation[0]!, example.tolerance),
        `inflationPct ${path.inflationPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation[0]}`,
      ).toBe(true)
    })

    it('df 5, u 0.01, z 1: shock 30 and inflation 0', () => {
      const path = pathOf(cases[1]!)
      expect(
        withinTolerance(path.returnShockPct[0]!, expectedShocks[1]!, example.tolerance),
        `returnShockPct ${path.returnShockPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedShocks[1]}`,
      ).toBe(true)
      expect(
        withinTolerance(path.inflationPct[0]!, expectedInflation[1]!, example.tolerance),
        `inflationPct ${path.inflationPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation[1]}`,
      ).toBe(true)
    })

    it('df 3, u 0.01, z 1: shock 42 and inflation 0', () => {
      const path = pathOf(cases[2]!)
      expect(
        withinTolerance(path.returnShockPct[0]!, expectedShocks[2]!, example.tolerance),
        `returnShockPct ${path.returnShockPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedShocks[2]}`,
      ).toBe(true)
      expect(
        withinTolerance(path.inflationPct[0]!, expectedInflation[2]!, example.tolerance),
        `inflationPct ${path.inflationPct[0]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInflation[2]}`,
      ).toBe(true)
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
