import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS, ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from './moneyTolerance.js'

describeCalculation('projection-money-tolerance-thresholds', {
  example: {
    inputs: { annualResidual: 0.0049, conversionCandidate: 0.0075, annualTolerance: 0.005, conversionEpsilon: 0.01 },
    expected: { annualAcceptance: true, conversionMateriality: false, thresholdRatio: 2 },
    tolerance: 'exact',
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-money-tolerance-thresholds.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/projection-money-tolerance-thresholds.mutation.md',
}, ({ example }) => {
  it('accepts a 0.0049 annual residual but rejects 0.0075 as a material conversion', () => {
    expect((example.inputs.annualResidual as number) <= ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS).toBe(example.expected.annualAcceptance)
    expect((example.inputs.conversionCandidate as number) > AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS).toBe(example.expected.conversionMateriality)
    expect(withinTolerance(ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS, example.inputs.annualTolerance as number, example.tolerance)).toBe(true)
    expect(withinTolerance(AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS, example.inputs.conversionEpsilon as number, example.tolerance)).toBe(true)
    expect(withinTolerance(AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS / ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS, example.expected.thresholdRatio as number, example.tolerance)).toBe(true)
  })
})
