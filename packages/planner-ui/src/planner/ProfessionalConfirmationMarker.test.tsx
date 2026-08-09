/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ProfessionalConfirmationMarker } from './ProfessionalConfirmationMarker'
import { needsProfessionalConfirmation } from './professionalConfirmation'

describe('needsProfessionalConfirmation', () => {
  it('is false for a clean settled row', () => {
    expect(
      needsProfessionalConfirmation({
        classification: 'settled',
        disclosures: [],
      }),
    ).toBe(false)
  })

  it('is true for unsettled, limitation, disclosure, refusal, or legacy schedule', () => {
    expect(needsProfessionalConfirmation({ classification: 'unsettled', disclosures: [] })).toBe(true)
    expect(needsProfessionalConfirmation({ limitation: 'pre-horizon-year-of-death-rmd-unresolved', disclosures: [] })).toBe(true)
    expect(needsProfessionalConfirmation({ disclosures: ['deemed-election-risk'] })).toBe(true)
    expect(needsProfessionalConfirmation({ refusalReason: 'estate not modeled', disclosures: [] })).toBe(true)
    expect(needsProfessionalConfirmation({ requirementKind: 'legacy', disclosures: [] })).toBe(true)
    expect(
      needsProfessionalConfirmation({ regime: 'legacy-planning-approximation', disclosures: [] }),
    ).toBe(true)
  })
})

describe('ProfessionalConfirmationMarker', () => {
  it('renders the shared confirm-with-a-tax-professional wording', () => {
    const html = renderToStaticMarkup(<ProfessionalConfirmationMarker />)
    expect(html).toContain('Confirm this schedule with a tax professional')
    expect(html).toContain('role="note"')
  })

  it('supports a compact form for tight report tables', () => {
    const html = renderToStaticMarkup(<ProfessionalConfirmationMarker compact />)
    expect(html).toContain('Confirm with a tax professional.')
  })
})
