import { describe, expect, it } from 'vitest'

import { deepFreeze } from './freeze.js'

describe('deepFreeze', () => {
  it('freezes nested objects and arrays and returns the same reference', () => {
    const value = { outer: { inner: [{ leaf: 1 }] } }
    const frozen = deepFreeze(value)
    expect(frozen).toBe(value)
    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.outer)).toBe(true)
    expect(Object.isFrozen(value.outer.inner)).toBe(true)
    expect(Object.isFrozen(value.outer.inner[0])).toBe(true)
  })

  it('terminates on a cyclic graph instead of overflowing the stack', () => {
    // The pre-consolidation majority implementation recursed with no visited
    // set; the only thing stopping it was the Object.isFrozen short circuit,
    // which does not fire until the frozen-on-the-way-out pass reaches back.
    const self: Record<string, unknown> = { name: 'self' }
    self.loop = self
    const left: Record<string, unknown> = {}
    const right: Record<string, unknown> = { left }
    left.right = right

    expect(() => deepFreeze(self)).not.toThrow()
    expect(Object.isFrozen(self)).toBe(true)
    expect(() => deepFreeze(left)).not.toThrow()
    expect(Object.isFrozen(left)).toBe(true)
    expect(Object.isFrozen(right)).toBe(true)
  })

  it('freezes the children of a parent that is already frozen', () => {
    // The short-circuiting copies returned early here, leaving `child` mutable
    // and reachable through a frozen root — a shallow freeze wearing a deep
    // freeze's name.
    const child = { mutable: 1 }
    const parent = Object.freeze({ child })
    expect(Object.isFrozen(parent)).toBe(true)
    expect(Object.isFrozen(child)).toBe(false)

    deepFreeze(parent)

    expect(Object.isFrozen(child)).toBe(true)
  })

  it('visits a shared non-cyclic sub-object reached through two parents', () => {
    const shared = { value: 1 }
    const root = { first: { shared }, second: { shared } }
    deepFreeze(root)
    expect(Object.isFrozen(shared)).toBe(true)
    expect(Object.isFrozen(root.first)).toBe(true)
    expect(Object.isFrozen(root.second)).toBe(true)
  })

  it('returns primitives and null untouched', () => {
    expect(deepFreeze(null)).toBeNull()
    expect(deepFreeze(undefined)).toBeUndefined()
    expect(deepFreeze(7)).toBe(7)
    expect(deepFreeze('text')).toBe('text')
  })
})
