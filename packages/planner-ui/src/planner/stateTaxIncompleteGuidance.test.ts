import { describe, expect, it } from 'vitest'
import { stateTaxIncompleteGuidance } from './stateTaxIncompleteGuidanceModel'

describe('incomplete computation guidance', () => {
  it('does not render without incomplete years', () => {
    expect(stateTaxIncompleteGuidance([])).toBeNull()
  })

  it('keeps candidate-only missing details unknown without reprojecting a baseline', () => {
    const guidance = stateTaxIncompleteGuidance([2027, 2026, 2027])
    expect(guidance?.years).toEqual([2026, 2027])
    expect(guidance?.summary).toContain('Tax or reverse-mortgage (HECM)')
    expect(guidance?.summary).toContain('Issue details are unavailable')
    expect(guidance?.worksheetLinkLabel).toBeNull()
    expect(guidance?.accountsLinkLabel).toBeNull()
  })

  it('does not send HECM-only incompleteness to a tax worksheet', () => {
    const guidance = stateTaxIncompleteGuidance([2026], [{ year: 2026, hecmIssues: ['Monthly servicing evidence is incomplete.'] }])
    expect(guidance?.summary).toContain('incomplete reverse-mortgage (HECM)')
    expect(guidance?.summary).not.toContain('state income tax')
    expect(guidance?.details).toEqual(['Monthly servicing evidence is incomplete.'])
    expect(guidance?.worksheetLinkLabel).toBeNull()
    expect(guidance?.accountsLinkLabel).toBeNull()
  })

  it('does not mislabel non-state tax issues or infer pension gaps from unrelated accounts', () => {
    const guidance = stateTaxIncompleteGuidance([2026], [{ year: 2026, taxIssues: [{ code: 'missing-ira-basis', message: 'IRA basis is unknown.' }] }])
    expect(guidance?.summary).toContain('other tax calculations')
    expect(guidance?.worksheetLinkLabel).toBeNull()
    expect(guidance?.accountsLinkLabel).toBeNull()
  })

  it('links explicit state pension evidence to worksheet and Accounts', () => {
    const guidance = stateTaxIncompleteGuidance([2026], [{ year: 2026, taxIssues: [{ code: 'unknown-retirement-source-or-eligibility', state: 'MA', message: 'Pension source is unconfirmed.' }] }])
    expect(guidance?.summary).toContain('state income tax')
    expect(guidance?.worksheetLinkLabel).toContain('worksheet facts')
    expect(guidance?.accountsLinkLabel).toContain('Accounts')
  })

  it('does not treat another year as evidence for an unavailable candidate', () => {
    const guidance = stateTaxIncompleteGuidance([2027], [{ year: 2026, taxIssues: [{ code: 'incomplete-state-facts', state: 'IL', message: 'Counts missing.' }] }])
    expect(guidance?.details).toEqual([])
    expect(guidance?.worksheetLinkLabel).toBeNull()
    expect(guidance?.summary).toContain('unavailable')
  })
})
