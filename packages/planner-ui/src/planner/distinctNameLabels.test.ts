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

  it('never generates a label another item already holds as its name (r1-2)', () => {
    const items = [
      { id: 'a', name: 'Sam IRA' },
      { id: 'b', name: 'Sam IRA' },
      { id: 'c', name: 'Sam IRA (1 of 2)' },
    ]
    const labels = distinctNameLabels(items, 'Unnamed IRA')
    expect(labels.get('a')).toBe('Sam IRA (1 of 2) (2)')
    expect(labels.get('b')).toBe('Sam IRA (2 of 2)')
    expect(labels.get('c')).toBe('Sam IRA (1 of 2)')
  })

  it('gives every item its own label, whatever names it is handed (r1-2)', () => {
    // Names built to collide with each other's generated suffixes, in both
    // orders, with case and space variants.
    const names = ['A', 'a ', 'A (1 of 2)', 'a (1 of 2)', 'A (2 of 2)', 'A (1 of 2) (2)', '', 'Unnamed', 'unnamed (1 of 2)']
    for (const order of [names, [...names].reverse()]) {
      const items = order.map((name, i) => ({ id: `id${i}`, name }))
      const labels = [...distinctNameLabels(items, 'Unnamed').values()]
      expect(labels).toHaveLength(items.length)
      expect(new Set(labels.map((l) => l.toLowerCase())).size).toBe(items.length)
    }
  })

  it('groups names the same way under any runtime locale (r1-6)', () => {
    // Turkish casing lowercases "I" to a dotless "ı", so a locale-sensitive
    // fold would leave "IRA" and "ira" apart on a Turkish-locale browser.
    expect('IRA'.toLocaleLowerCase('tr')).not.toBe('ira')
    const original = String.prototype.toLocaleLowerCase
    String.prototype.toLocaleLowerCase = function (this: string) {
      return original.call(this, 'tr')
    }
    try {
      const labels = distinctNameLabels(
        [
          { id: 'x', name: 'IRA' },
          { id: 'y', name: 'ira' },
        ],
        'Unnamed IRA',
      )
      expect([labels.get('x'), labels.get('y')]).toEqual(['IRA (1 of 2)', 'ira (2 of 2)'])
    } finally {
      String.prototype.toLocaleLowerCase = original
    }
  })
})
