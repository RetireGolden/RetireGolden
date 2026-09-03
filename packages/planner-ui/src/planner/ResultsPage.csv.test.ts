import { describe, expect, it } from 'vitest'

import { csvCell } from '../csvCell'
import { inheritedCsvColumnHeaders } from './inheritedCsv'

describe('ResultsPage inherited CSV escaping', () => {
  it('quotes hostile account ids in inherited column headers', () => {
    const hostileId = 'evil,"quoted\nid'
    const headers = inheritedCsvColumnHeaders([hostileId])
    expect(headers[0]).toBe(`"inherited_evil,""quoted\nid_requiredAmount"`)
    expect(headers.join(',')).not.toMatch(/,evil,"quoted/)
  })

  it('doubles embedded quotes in escaped cells', () => {
    expect(csvCell('say "hello", world')).toBe('"say ""hello"", world"')
  })
})
