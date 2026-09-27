import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { PARAMETER_PROVENANCE } from './provenance.js'

describeCalculation('parameter-provenance-catalog', {
  example: {
    inputs: { entries: 16, ids: ['federal-brackets', 'senior-deduction', 'capital-gains-niit', 'section-121-exclusion', 'ss-benefit-taxation', 'contribution-limits', 'rmd-qcd', 'annuity-purchase', 'hecm-plf', 'medicare-irmaa', 'social-security', 'federal-poverty-line', 'aca-ptc', 'aca-ptc-2027', 'real-yield-curve', 'state-income-tax'] },
    expected: { records: 16, duplicates: 0 },
    tolerance: 'exact',
  },
  worksheet: 'DOCS/calculations/taxes/parameter-provenance-catalog.md',
  mutation: 'DOCS/calculations/taxes/parameter-provenance-catalog.mutation.md',
}, ({ example }) => {
  it('preserves the ordered sixteen catalog IDs with zero duplicates', () => {
    const ids = PARAMETER_PROVENANCE.map((entry) => entry.id)
    expect(ids.length).toBe(example.expected.records)
    expect(ids.length - new Set(ids).size).toBe(example.expected.duplicates)
    ids.forEach((id, index) => expect(id).toBe((example.inputs.ids as string[])[index]))
  })
})
