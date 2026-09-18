import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createRng, derivePathSeed } from './rng.js'

describeCalculation(
  'rng-derived-path-seed',
  {
    example: {
      inputs: {
        cases: [
          { baseSeed: 42, pathIndex: 7 },
          { baseSeed: 42, pathIndex: 8 },
          { baseSeed: 1, pathIndex: 0 },
        ],
      },
      expected: { pathSeeds: [1351098177, 2450979136, 3950124170] },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/rng-derived-path-seed.md',
    mutation: 'DOCS/calculations/monte-carlo/rng-derived-path-seed.mutation.md',
  },
  ({ example }) => {
    const cases = example.inputs.cases as readonly { baseSeed: number; pathIndex: number }[]
    const expected = example.expected.pathSeeds as number[]

    it('hashes (42, 7) to 1351098177', () => {
      expect(derivePathSeed(cases[0]!.baseSeed, cases[0]!.pathIndex)).toBe(expected[0])
    })

    it('hashes (42, 8) to 2450979136', () => {
      expect(derivePathSeed(cases[1]!.baseSeed, cases[1]!.pathIndex)).toBe(expected[1])
    })

    it('hashes (1, 0) to 3950124170', () => {
      expect(derivePathSeed(cases[2]!.baseSeed, cases[2]!.pathIndex)).toBe(expected[2])
    })

    it('(42, 7) and (42, 8) differ', () => {
      expect(expected[0]).not.toBe(expected[1])
      expect(derivePathSeed(cases[0]!.baseSeed, cases[0]!.pathIndex)).not.toBe(
        derivePathSeed(cases[1]!.baseSeed, cases[1]!.pathIndex),
      )
    })
  },
)

describeCalculation(
  'rng-mulberry32-reference-stream',
  {
    example: {
      inputs: { seed: 1, requestedUniformDraws: 5 },
      expected: {
        words: [2693262067, 11749833, 2265367787, 4213581821, 4159151403],
        uniforms: [
          0.6270739405881613,
          0.002735721180215478,
          0.5274470399599522,
          0.9810509674716741,
          0.9683778982143849,
        ],
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/rng-mulberry32-reference-stream.md',
    mutation: 'DOCS/calculations/monte-carlo/rng-mulberry32-reference-stream.mutation.md',
  },
  ({ example }) => {
    it('seed 1 yields the worksheet\'s first five Mulberry32 words', () => {
      const rng = createRng(example.inputs.seed as number)
      const expectedWords = example.expected.words as number[]
      const expectedUniforms = example.expected.uniforms as number[]
      expect(expectedWords).toHaveLength(example.inputs.requestedUniformDraws as number)
      expectedWords.forEach((word, index) => {
        const draw = rng.next()
        const observedWord = Math.round(draw * 2 ** 32)
        expect(
          withinTolerance(observedWord, word, example.tolerance),
          `word[${index}] ${observedWord} is not the worksheet's ${word}`,
        ).toBe(true)
        expect(
          withinTolerance(draw, expectedUniforms[index]!, { rel: 1e-15 }),
          `uniform[${index}] ${draw} is not within {"rel":1e-15} of the worksheet's ${expectedUniforms[index]}`,
        ).toBe(true)
      })
    })
  },
)
