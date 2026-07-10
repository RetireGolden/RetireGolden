import { describe, expect, it } from 'vitest'

import { parsePlan } from '../../engine/model/plan'
import { EXAMPLE_PLANS } from './registry'

describe('example registry', () => {
  it('every build() output passes parsePlan', () => {
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      const parsed = parsePlan(plan)
      expect(parsed.ok, example.id).toBe(true)
    }
  })

  it('build() is deterministic', () => {
    for (const example of EXAMPLE_PLANS) {
      const a = example.build()
      const b = example.build()
      expect(a, example.id).toEqual(b)
    }
  })

  it('every learnSlug is unique', () => {
    const slugs = EXAMPLE_PLANS.map((e) => e.learnSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
