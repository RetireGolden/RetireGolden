import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createRng, derivePathSeed } from './rng.js'

describeCalculation(
  'rng-derived-path-seed',
  {
    example: {
      inputs: { baseSeed: 42, pathIndex: 7 },
      // The worksheet extract could not name a number. The record pins the
      // SplitMix32-style recurrence; 1351098177 is that recurrence on (42, 7),
      // computed independently from the pinned 32-bit steps, and 49 is the
      // worksheet's first wrong reading seed+pathIndex.
      expected: { pathSeed: 1351098177, notSeedPlusIndex: 49 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/rng-derived-path-seed.md',
    mutation: 'DOCS/calculations/monte-carlo/rng-derived-path-seed.mutation.md',
  },
  ({ example }) => {
    const baseSeed = example.inputs.baseSeed as number
    const pathIndex = example.inputs.pathIndex as number

    it('hashes (42, 7) to the unsigned word 1351098177', () => {
      expect(derivePathSeed(baseSeed, pathIndex)).toBe(example.expected.pathSeed)
    })

    it('the same (42, 7) seed under one-worker and split-worker scheduling', () => {
      // Pure hash of the pair: calling it twice, or after hashing path 0, is
      // the one-worker vs split-worker comparison the worksheet asks for.
      const oneWorker = derivePathSeed(baseSeed, pathIndex)
      const afterOtherPath = derivePathSeed(baseSeed, 0)
      const splitWorker = derivePathSeed(baseSeed, pathIndex)
      expect(oneWorker).toBe(splitWorker)
      expect(afterOtherPath).not.toBe(oneWorker)
    })

    it('is not seed + pathIndex = 49', () => {
      expect(derivePathSeed(baseSeed, pathIndex)).not.toBe(example.expected.notSeedPlusIndex)
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
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/rng-mulberry32-reference-stream.md',
    mutation: 'DOCS/calculations/monte-carlo/rng-mulberry32-reference-stream.mutation.md',
  },
  ({ example }) => {
    it('seed 1 yields the worksheet\'s first five Mulberry32 words', () => {
      const rng = createRng(example.inputs.seed as number)
      const expectedWords = example.expected.words as number[]
      const expectedUniforms = [
        0.6270739405881613,
        0.002735721180215478,
        0.5274470399599522,
        0.9810509674716741,
        0.9683778982143849,
      ]
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
