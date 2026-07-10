import { describe, expect, it } from 'vitest'
import { PARAMETER_PROVENANCE } from './provenance'

describe('parameter provenance', () => {
  it('has entries', () => {
    expect(PARAMETER_PROVENANCE.length).toBeGreaterThan(0)
  })

  it('every entry is complete with an https source', () => {
    for (const s of PARAMETER_PROVENANCE) {
      expect(s.id, 'id').toBeTruthy()
      expect(s.label, `${s.id} label`).toBeTruthy()
      expect(s.figures, `${s.id} figures`).toBeTruthy()
      expect(s.publisher, `${s.id} publisher`).toBeTruthy()
      expect(s.url, `${s.id} url`).toMatch(/^https:\/\//)
    }
  })

  it('has unique ids', () => {
    const ids = PARAMETER_PROVENANCE.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers the major assumption groups', () => {
    const ids = new Set(PARAMETER_PROVENANCE.map((s) => s.id))
    for (const expected of [
      'federal-brackets',
      'contribution-limits',
      'rmd-qcd',
      'medicare-irmaa',
      'social-security',
      'state-income-tax',
    ]) {
      expect(ids.has(expected), `missing ${expected}`).toBe(true)
    }
  })
})
