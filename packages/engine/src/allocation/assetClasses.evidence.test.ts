import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { choleskyDecompose } from './assetClasses.js'

describeCalculation(
  'allocation-cholesky-factor',
  {
    example: {
      inputs: { correlation: [[1, 0.5], [0.5, 1]] },
      expected: { L: [[1, 0], [0.5, 0.866025403784439]] },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/allocation-cholesky-factor.md',
    mutation: 'DOCS/calculations/monte-carlo/allocation-cholesky-factor.mutation.md',
  },
  ({ example }) => {
    const correlation = example.inputs.correlation as number[][]
    const expected = example.expected.L as number[][]

    it('factors [[1, 0.5], [0.5, 1]] as [[1, 0], [0.5, sqrt(3)/2]]', () => {
      const L = choleskyDecompose(correlation)
      expect(L).toHaveLength(expected.length)
      expected.forEach((row, i) => {
        expect(L[i]).toHaveLength(row.length)
        row.forEach((value, j) => {
          expect(
            withinTolerance(L[i]![j]!, value, example.tolerance),
            `L[${i}][${j}] ${L[i]![j]} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${value}`,
          ).toBe(true)
        })
      })
    })

    it('the factor reconstructs the off-diagonal 0.5 and the unit diagonal', () => {
      // The worksheet's multiplication check: LL^T = A for this 2×2.
      const L = choleskyDecompose(correlation)
      const off = L[1]![0]! * L[0]![0]! + L[1]![1]! * L[0]![1]!
      const secondDiag = L[1]![0]! * L[1]![0]! + L[1]![1]! * L[1]![1]!
      expect(
        withinTolerance(off, 0.5, example.tolerance),
        `LL^T off-diagonal ${off} is not within ${JSON.stringify(example.tolerance)} of 0.5`,
      ).toBe(true)
      expect(
        withinTolerance(secondDiag, 1, example.tolerance),
        `LL^T second diagonal ${secondDiag} is not within ${JSON.stringify(example.tolerance)} of 1`,
      ).toBe(true)
    })
  },
)
