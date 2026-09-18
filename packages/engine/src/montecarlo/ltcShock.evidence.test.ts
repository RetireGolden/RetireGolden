import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { DEFAULT_LTC_SHOCK, sampleCareEvents } from './ltcShock.js'
import type { Rng } from './rng.js'

function uniformsRng(draws: readonly number[]): Rng {
  let index = 0
  return {
    next: () => {
      const draw = draws[index]
      if (draw === undefined) throw new RangeError(`uniform ${index} was not scripted`)
      index += 1
      return draw
    },
    nextNormal: () => {
      throw new RangeError('nextNormal is not part of the incidence draw')
    },
    nextInt: () => {
      throw new RangeError('nextInt is not reached when the incidence draw misses')
    },
  }
}

describeCalculation(
  'long-term-care-shock-sampling',
  {
    example: {
      inputs: { people: 1, incidence: 0.5, firstUniform: 0.75, annualCost: 75_000 },
      expected: { eventCount: 0 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/long-term-care-shock-sampling.md',
    mutation: 'DOCS/calculations/monte-carlo/long-term-care-shock-sampling.mutation.md',
  },
  ({ example }) => {
    it('U = 0.75 >= incidence 0.5 emits the empty care-event list', () => {
      const events = sampleCareEvents(
        uniformsRng([example.inputs.firstUniform as number]),
        [{ id: 'p1', dob: '1960-01-01' }],
        2026,
        { ...DEFAULT_LTC_SHOCK, incidence: example.inputs.incidence as number, annualCost: example.inputs.annualCost as number },
      )
      expect(events).toHaveLength(example.expected.eventCount as number)
    })
  },
)
