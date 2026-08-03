import { describe, expect, it } from 'vitest'
import {
  annualCharitableDeductionParameters,
  deriveAnnualCharitableDeductionParametersEvidenceId,
  type AnnualCharitableDeductionParameters2026,
} from './annualCharitableDeductionParameters.js'

describe('annualCharitableDeductionParameters', () => {
  it('exposes the exact 2026 rates and the single floor quantization', () => {
    const parameters = annualCharitableDeductionParameters(2026)

    expect(parameters.itemizerContributionFloorRate).toEqual({
      numerator: 1n,
      denominator: 200n,
    })
    expect(parameters.itemizerContributionFloorQuantization).toBe('nearestCentHalfUp')
    expect(parameters.cashContributionPercentageLimitRate).toEqual({
      numerator: 3n,
      denominator: 5n,
    })
    expect(parameters.section68LimitationRate).toEqual({
      numerator: 2n,
      denominator: 37n,
    })
    expect(parameters.section68IntermediateArithmetic).toBe('bigintRational')
    expect(parameters.section68Quantization).toBe('nearestCentHalfUp')
  })

  it('exposes exact section 170(p) caps in engine cents for every filing status', () => {
    expect(
      annualCharitableDeductionParameters(2026)
        .nonitemizerDeductionCapByFilingStatusCents,
    ).toEqual({
      single: 100_000,
      headOfHousehold: 100_000,
      marriedFilingJointly: 200_000,
      marriedFilingSeparately: 100_000,
      qualifyingSurvivingSpouse: 100_000,
    })
  })

  it('exposes exact section 68 thresholds in engine cents for every status', () => {
    expect(
      annualCharitableDeductionParameters(2026)
        .section68ThresholdByFilingStatusCents,
    ).toEqual({
      single: 64_060_000,
      headOfHousehold: 64_060_000,
      marriedFilingJointly: 76_870_000,
      marriedFilingSeparately: 38_435_000,
      qualifyingSurvivingSpouse: 76_870_000,
    })
  })

  it('carries stable statutory and implementation provenance', () => {
    expect(annualCharitableDeductionParameters(2026).provenance).toEqual({
      statuteSourceId: '26-usc-68-and-170-2026',
      section68Url: 'https://www.govinfo.gov/link/uscode/26/68',
      section170Url: 'https://www.govinfo.gov/link/uscode/26/170',
      amendingLawSourceId: 'pub-l-119-21',
      amendingLawUrl: 'https://www.govinfo.gov/link/plaw/119/public/21',
      implementationSourceId: 'irs-publication-505-2026',
      implementationUrl: 'https://www.irs.gov/publications/p505',
    })
  })

  it('fails closed instead of carrying the 2026 law into another year', () => {
    expect(() => annualCharitableDeductionParameters(2027)).toThrow(
      'Charitable deduction parameters unavailable for tax year 2027',
    )
    expect(() => annualCharitableDeductionParameters(2025)).toThrow(RangeError)
  })

  it('deep-freezes the canonical evidence', () => {
    const parameters = annualCharitableDeductionParameters(2026)

    expect(Object.isFrozen(parameters)).toBe(true)
    expect(Object.isFrozen(parameters.itemizerContributionFloorRate)).toBe(true)
    expect(Object.isFrozen(parameters.nonitemizerDeductionCapByFilingStatusCents)).toBe(true)
    expect(Object.isFrozen(parameters.section68ThresholdByFilingStatusCents)).toBe(true)
    expect(Object.isFrozen(parameters.provenance)).toBe(true)
    expect(annualCharitableDeductionParameters(2026)).toBe(parameters)
  })

  it('binds the structural evidence ID to its domain and every canonical fact', () => {
    const parameters = annualCharitableDeductionParameters(2026)
    const changed = {
      ...parameters,
      nonitemizerDeductionCapByFilingStatusCents: {
        ...parameters.nonitemizerDeductionCapByFilingStatusCents,
        single: 100_001,
      },
    } as unknown as Omit<AnnualCharitableDeductionParameters2026, 'evidenceId'>

    expect(parameters.evidenceId).toMatch(
      /^annual-charitable-deduction-parameters:[a-f0-9]{64}$/,
    )
    expect(deriveAnnualCharitableDeductionParametersEvidenceId(parameters)).toBe(
      parameters.evidenceId,
    )
    expect(deriveAnnualCharitableDeductionParametersEvidenceId(changed)).not.toBe(
      parameters.evidenceId,
    )
  })
})
