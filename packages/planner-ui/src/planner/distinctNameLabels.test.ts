import { describe, expect, it } from 'vitest'
import { distinctNameLabels } from './distinctNameLabels'

describe('distinctNameLabels (#777)', () => {
  it('shows a unique name as it is, with no id', () => {
    const labels = distinctNameLabels(
      [
        { id: 'example-couple--sam-ira', name: 'Sam IRA' },
        { id: 'example-couple--alex-ira', name: 'Alex IRA' },
      ],
      'Unnamed IRA',
    )
    expect(labels.get('example-couple--sam-ira')).toBe('Sam IRA')
    expect(labels.get('example-couple--alex-ira')).toBe('Alex IRA')
  })

  it('suffixes only the names that collide, by place in list order', () => {
    const labels = distinctNameLabels(
      [
        { id: 'a', name: 'Sam IRA' },
        { id: 'b', name: 'Alex IRA' },
        { id: 'c', name: 'sam ira ' },
      ],
      'Unnamed IRA',
    )
    expect(labels.get('a')).toBe('Sam IRA (1 of 2)')
    expect(labels.get('b')).toBe('Alex IRA')
    expect(labels.get('c')).toBe('sam ira (2 of 2)')
    for (const label of labels.values()) expect(label).not.toMatch(/\bID\b|\ba\)|\bc\)/)
  })

  it('names a blank entry with the fallback, still told apart from another blank', () => {
    const labels = distinctNameLabels(
      [
        { id: 'x', name: '' },
        { id: 'y', name: '  ' },
      ],
      'Unnamed IRA',
    )
    expect([labels.get('x'), labels.get('y')]).toEqual(['Unnamed IRA (1 of 2)', 'Unnamed IRA (2 of 2)'])
  })
})
