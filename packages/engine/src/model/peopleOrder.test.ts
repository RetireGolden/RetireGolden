import { describe, expect, it } from 'vitest'

import { CANONICAL_SEX_ORDER, canonicalPeopleOrder, compareCanonicalPeople } from './peopleOrder.js'

const person = (id: string, dob: string, sex: (typeof CANONICAL_SEX_ORDER)[number]) => ({ id, dob, sex })

describe('canonicalPeopleOrder (D-PEOPLE-ORDER)', () => {
  it('puts the older person first, whatever the list order', () => {
    const older = person('b', '1958-03-01', 'male')
    const younger = person('a', '1962-11-30', 'female')
    expect(canonicalPeopleOrder([younger, older])).toEqual([older, younger])
    expect(canonicalPeopleOrder([older, younger])).toEqual([older, younger])
  })

  it('breaks a birth-date tie by the written sex order, then by id ordinally', () => {
    const f = person('z', '1960-01-01', 'female')
    const m = person('a', '1960-01-01', 'male')
    const avg = person('m', '1960-01-01', 'average')
    expect(CANONICAL_SEX_ORDER).toEqual(['female', 'male', 'average'])
    expect(canonicalPeopleOrder([avg, m, f])).toEqual([f, m, avg])
    // Ordinal, not locale: an upper-case id sorts before a lower-case one.
    const upper = person('B', '1960-01-01', 'male')
    const lower = person('a', '1960-01-01', 'male')
    expect(canonicalPeopleOrder([lower, upper])).toEqual([upper, lower])
    expect(compareCanonicalPeople(lower, lower)).toBe(0)
  })

  it('does not change the input array', () => {
    const people = [person('a', '1970-01-01', 'male'), person('b', '1960-01-01', 'male')]
    const copy = [...people]
    canonicalPeopleOrder(people)
    expect(people).toEqual(copy)
  })
})
