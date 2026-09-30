import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { candidateTrailingEstateAmount, tournamentEstateBenchmark, type TrailingEstateTournament } from './candidateTrailingEstate.js'

function tournament(
  candidateDeltas: readonly number[],
  winnerDelta: number | null,
  withheldDelta: number | null = null,
): TrailingEstateTournament {
  return {
    candidates: candidateDeltas.map((afterTaxEstateDelta) => ({ afterTaxEstateDelta })),
    winnerValidation: winnerDelta === null ? null : { afterTaxEstateDelta: winnerDelta },
    retirementActionReadinessVeto: withheldDelta === null ? null : { vetoedValidation: { afterTaxEstateDelta: withheldDelta } },
  }
}

function gaps(t: TrailingEstateTournament): (number | null)[] {
  return t.candidates.map((candidate) => candidateTrailingEstateAmount(t, candidate))
}

describeCalculation(
  'optimizer-candidate-trailing-estate-gap',
  {
    example: {
      inputs: {
        caseA: { candidates: [48_700, 42_500, 10_000], winnerValidation: 48_000, withheld: null },
        caseB: { candidates: [25_000, 12_000], winnerValidation: null, withheld: 30_000 },
        caseC: { candidates: [900, 600, -200], winnerValidation: null, withheld: null },
        caseD: { candidates: [-200, -50], winnerValidation: null, withheld: null },
        caseE: { candidates: [0.1], winnerValidation: 0.3, withheld: null },
      },
      expected: {
        caseA: { benchmark: 48_000, gaps: [null, 5_500, 38_000], wrongBestCandidate: 6_200 },
        caseB: { benchmark: 30_000, gaps: [5_000, 18_000], wrongIgnoringWithheld: [null, 13_000] },
        caseC: { benchmark: 900, gaps: [null, 300, 1_100] },
        caseD: { benchmark: 0, gaps: [200, 50] },
        caseE: { gap: 0.19999999999999998 },
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/optimizer-candidate-trailing-estate-amount.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/optimizer-candidate-trailing-estate-amount.mutation.md',
  },
  ({ example }) => {
    type Case = { candidates: number[]; winnerValidation: number | null; withheld: number | null }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, Record<string, unknown>>
    const of = (c: Case) => tournament(c.candidates, c.winnerValidation, c.withheld)

    it('case A: candidates trail the validated winner (48,000) by 5,500 and 38,000; one above it does not trail', () => {
      const t = of(inputs.caseA!)
      expect(tournamentEstateBenchmark(t)).toBe(expected.caseA!.benchmark)
      expect(gaps(t)).toEqual(expected.caseA!.gaps)
      expect(gaps(t)[1]).not.toBe(expected.caseA!.wrongBestCandidate)
    })

    it('case B: with the winner withheld pending account allocation, candidates trail that winner (30,000)', () => {
      const t = of(inputs.caseB!)
      expect(tournamentEstateBenchmark(t)).toBe(expected.caseB!.benchmark)
      expect(gaps(t)).toEqual(expected.caseB!.gaps)
      expect(gaps(t)).not.toEqual(expected.caseB!.wrongIgnoringWithheld)
    })

    it('case C: with no validated winner, candidates trail the best candidate (900) by 300 and 1,100', () => {
      const t = of(inputs.caseC!)
      expect(tournamentEstateBenchmark(t)).toBe(expected.caseC!.benchmark)
      expect(gaps(t)).toEqual(expected.caseC!.gaps)
    })

    it('case D: when no candidate improves the estate the benchmark is 0, never a loss', () => {
      const t = of(inputs.caseD!)
      expect(tournamentEstateBenchmark(t)).toBe(expected.caseD!.benchmark)
      expect(gaps(t)).toEqual(expected.caseD!.gaps)
    })

    it('case E: the gap is the benchmark minus the candidate\'s improvement, 0.3 minus 0.1', () => {
      const t = of(inputs.caseE!)
      expect(candidateTrailingEstateAmount(t, t.candidates[0]!)).toBe(expected.caseE!.gap)
    })
  },
)
