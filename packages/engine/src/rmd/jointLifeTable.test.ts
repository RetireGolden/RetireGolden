import { describe, expect, it } from 'vitest'

import { jointLifeTableDivisor } from './jointLifeTable.js'
import { literalJointLifeTableDivisor, TABLE_II_LITERAL } from './jointLifeTable.literal.test-support.js'

/**
 * jointLifeTable.ts ships the Joint and Last Survivor Table delta-packed and
 * decodes it at module load. These prove the encoding lossless against the
 * literal extract it replaced (jointLifeTable.literal.test-support.ts, moved
 * there verbatim): the decoded table is the literal one, cell for cell by
 * Object.is, and the lookup agrees with the literal lookup on every age pair
 * it can be asked about, including ages outside the table, fractional ages and
 * non-finite ones.
 */

const OWNER_AGES = Array.from({ length: 49 }, (_, i) => 72 + i)
const SPOUSE_AGES = Array.from({ length: 121 }, (_, i) => i)

describe('jointLifeTable: the delta-packed table is the literal extract', () => {
  it('has the literal shape: owner ages 72-120, spouse ages 0-120', () => {
    expect(Object.keys(TABLE_II_LITERAL).map(Number)).toEqual(OWNER_AGES)
    for (const ownerAge of OWNER_AGES) expect(TABLE_II_LITERAL[ownerAge]).toHaveLength(121)
  })

  it('decodes to a table deep-equal to the literal one', () => {
    const decoded = Object.fromEntries(
      OWNER_AGES.map((ownerAge) => [ownerAge, SPOUSE_AGES.map((spouseAge) => jointLifeTableDivisor(ownerAge, spouseAge))]),
    )
    expect(decoded).toStrictEqual(TABLE_II_LITERAL)
  })

  it('matches every cell by Object.is, the same double and not merely equal', () => {
    let cells = 0
    for (const ownerAge of OWNER_AGES) {
      for (const spouseAge of SPOUSE_AGES) {
        const literal = TABLE_II_LITERAL[ownerAge]![spouseAge]!
        const decoded = jointLifeTableDivisor(ownerAge, spouseAge)
        if (!Object.is(decoded, literal)) {
          throw new Error(`owner ${ownerAge}, spouse ${spouseAge}: decoded ${decoded}, literal ${literal}`)
        }
        cells++
      }
    }
    expect(cells).toBe(49 * 121)
  })

  it('agrees with the literal lookup on every age pair it can see (67,081 pairs)', () => {
    // Whole and half ages from -2 through 125.5, plus NaN and both infinities:
    // below the table, inside it, clamped above it, and rejected.
    const ages: number[] = []
    for (let age = -2; age <= 125; age++) ages.push(age, age + 0.5)
    ages.push(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
    let pairs = 0
    let defined = 0
    for (const ownerAge of ages) {
      for (const spouseAge of ages) {
        const packed = jointLifeTableDivisor(ownerAge, spouseAge)
        const literal = literalJointLifeTableDivisor(ownerAge, spouseAge)
        if (!Object.is(packed, literal)) {
          throw new Error(`owner ${ownerAge}, spouse ${spouseAge}: packed ${packed}, literal ${literal}`)
        }
        pairs++
        if (literal !== undefined) defined++
      }
    }
    expect(pairs).toBe(67_081)
    expect(defined).toBe(27_216)
  })

  it('keeps the published rows the golden suites pin', () => {
    // Treas. Reg. 1.401(a)(9)-9(d) Table 3, as the rule record quotes it.
    expect(jointLifeTableDivisor(75, 64)).toBe(25.3)
    expect(jointLifeTableDivisor(73, 19)).toBe(66.1)
    expect(jointLifeTableDivisor(75, 60)).toBe(28.3)
  })
})
