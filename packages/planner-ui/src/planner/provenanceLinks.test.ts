import { describe, expect, it } from 'vitest'

import { citationHref, citationSource, provenanceSource } from './provenanceLinks'

describe('citationHref', () => {
  it('maps Treas. Reg. citations to the eCFR section page', () => {
    expect(citationHref('Treas. Reg. §1.401(a)(9)-5(d)(1)(i)–(ii)')).toBe(
      'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
    )
    expect(citationHref('Treas. Reg. §1.408-8(c)(2)')).toBe(
      'https://www.ecfr.gov/current/title-26/section-1.408-8',
    )
    expect(citationHref('Treas. Reg. §1.408A-6, A-14(b)')).toBe(
      'https://www.ecfr.gov/current/title-26/section-1.408A-6',
    )
  })

  it('leaves IRC, notices, and internal references unmapped', () => {
    expect(citationHref('IRC §401(a)(9)(B)(i)')).toBeNull()
    expect(citationHref('Notices 2022-53/2023-54/2024-35')).toBeNull()
    expect(citationHref('SECURE Act §401(b)(1)')).toBeNull()
    expect(citationHref('DOCS/domain/inherited-ira-regime-matrix.md §2')).toBeNull()
  })
})

describe('citationSource', () => {
  it('returns a SourceLink only when a URL is known', () => {
    expect(citationSource('Treas. Reg. §1.401(a)(9)-4(e)')).toEqual({
      label: 'Treas. Reg. §1.401(a)(9)-4(e)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-4',
    })
    expect(citationSource('IRC §401(a)(9)(H)(i)')).toBeNull()
  })
})

describe('provenanceSource', () => {
  it('resolves a known parameter provenance id', () => {
    const source = provenanceSource('rmd-qcd')
    expect(source.url).toMatch(/^https?:\/\//)
    expect(source.label.length).toBeGreaterThan(0)
  })
})
