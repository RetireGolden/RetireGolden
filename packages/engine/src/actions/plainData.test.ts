import { describe, expect, it } from 'vitest'

import { asUnknownRecord, exactKeys, INVALID_SNAPSHOT, plainDataSnapshot } from './plainData.js'

describe('plainDataSnapshot', () => {
  it('copies acyclic plain data and detaches it from the caller', () => {
    const input = { id: 'a', rows: [{ cents: 1 }, { cents: 2 }], flag: true, missing: null }
    const copy = plainDataSnapshot(input) as Record<string, unknown>

    expect(copy).not.toBe(input)
    expect(copy).toEqual(input)
    expect(Array.isArray(copy.rows)).toBe(true)
    expect((copy.rows as unknown[])[0]).not.toBe(input.rows[0])
    expect(Object.getPrototypeOf(copy)).toBeNull()
  })

  it('rejects non-finite numbers and negative zero', () => {
    // The HSA family rejected these; the beneficiary family had dropped the
    // check. Neither survives a JSON round trip as itself.
    expect(plainDataSnapshot({ amount: Number.NaN })).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot({ amount: Number.POSITIVE_INFINITY })).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot({ amount: Number.NEGATIVE_INFINITY })).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot({ amount: -0 })).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot({ amount: 0 })).toEqual({ amount: 0 })
  })

  it('rejects a cycle but accepts a sub-object shared down two branches', () => {
    // The HSA family never removed from its `seen` set, so a legitimately
    // shared non-cyclic sub-object came back INVALID. `ancestors` is a path,
    // cleared in a finally, so only a true cycle is refused.
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(plainDataSnapshot(cyclic)).toBe(INVALID_SNAPSHOT)

    const shared = { cents: 5 }
    const diamond = { left: { shared }, right: { shared } }
    const copy = plainDataSnapshot(diamond) as Record<string, Record<string, unknown>>
    expect(copy.left.shared).toEqual({ cents: 5 })
    expect(copy.right.shared).toEqual({ cents: 5 })
    expect(copy.left.shared).not.toBe(copy.right.shared)
  })

  it('reads array length off the descriptor, never through a get trap', () => {
    // Reading `.length` on a Proxy runs the caller's get trap inside the very
    // boundary that exists to keep caller code out. This array's trap lies
    // about its length; the walk never consults it, so the copy comes from the
    // honest descriptors. The HSA copies did `keys.length !== value.length + 1`
    // and would have run the trap, read 99, and rejected valid data on the
    // caller's say-so.
    let getTrapCalls = 0
    const trapped = new Proxy([1, 2], {
      get(target, key, receiver) {
        getTrapCalls += 1
        if (key === 'length') return 99
        return Reflect.get(target, key, receiver)
      },
    })
    expect(plainDataSnapshot(trapped)).toEqual([1, 2])
    expect(getTrapCalls).toBe(0)

    // A length whose own descriptor is inconsistent is still rejected, on the
    // descriptor's evidence rather than the trap's.
    const lying = Object.defineProperty([1, 2], 'length', { writable: true, value: 2 })
    Object.defineProperty(lying, 'extra', { enumerable: true, configurable: true, value: 3 })
    expect(plainDataSnapshot(lying)).toBe(INVALID_SNAPSHOT)
  })

  it('rejects an array carrying an extra key or a hole', () => {
    const extra: unknown[] & { note?: string } = [1]
    extra.note = 'smuggled'
    expect(plainDataSnapshot(extra)).toBe(INVALID_SNAPSHOT)

    const holed = [1, 2]
    delete holed[0]
    expect(plainDataSnapshot(holed)).toBe(INVALID_SNAPSHOT)
  })

  it('rejects accessor properties without invoking them', () => {
    let getterCalls = 0
    const withGetter = Object.defineProperty({}, 'amount', {
      enumerable: true,
      configurable: true,
      get() { getterCalls += 1; return 1 },
    })
    expect(plainDataSnapshot(withGetter)).toBe(INVALID_SNAPSHOT)
    expect(getterCalls).toBe(0)
  })

  it('rejects non-enumerable data properties, symbol keys, and non-plain prototypes', () => {
    const hidden = Object.defineProperty({ shown: 1 }, 'hidden', {
      enumerable: false,
      value: 2,
    })
    expect(plainDataSnapshot(hidden)).toBe(INVALID_SNAPSHOT)

    expect(plainDataSnapshot({ [Symbol('key')]: 1 })).toBe(INVALID_SNAPSHOT)

    class Holder { amount = 1 }
    expect(plainDataSnapshot(new Holder())).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot(new Map())).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot(new Date(0))).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot(() => 1)).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot(1n)).toBe(INVALID_SNAPSHOT)
    expect(plainDataSnapshot(undefined)).toBe(INVALID_SNAPSHOT)
  })

  it('accepts a null-prototype object and passes primitives through', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { amount: 1 })
    expect(plainDataSnapshot(bare)).toEqual({ amount: 1 })
    expect(plainDataSnapshot('text')).toBe('text')
    expect(plainDataSnapshot(true)).toBe(true)
    expect(plainDataSnapshot(null)).toBeNull()
  })

  it('leaves the ancestor path empty after a rejected branch', () => {
    // A shared `ancestors` set is threaded through recursion; a branch that
    // bails out must not leave its own entry behind for the next branch.
    const ancestors = new Set<object>()
    expect(plainDataSnapshot({ bad: Number.NaN }, ancestors)).toBe(INVALID_SNAPSHOT)
    expect(ancestors.size).toBe(0)
  })
})

describe('exactKeys', () => {
  it('accepts exactly the expected key set', () => {
    expect(exactKeys({ a: 1, b: 2 }, ['a', 'b'])).toBe(true)
    expect(exactKeys({ b: 2, a: 1 }, ['a', 'b'])).toBe(true)
    expect(exactKeys({ a: 1 }, ['a', 'b'])).toBe(false)
    expect(exactKeys({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toBe(false)
    expect(exactKeys({ a: 1, c: 3 }, ['a', 'b'])).toBe(false)
  })

  it('rejects a duplicated expectation rather than counting it twice', () => {
    // The one-directional copies would have accepted {a} against ['a','a'] or
    // rejected {a,b} against it, depending on which direction they checked.
    expect(exactKeys({ a: 1 }, ['a', 'a'])).toBe(false)
  })

  it('rejects null, arrays, and non-objects', () => {
    expect(exactKeys(null, [])).toBe(false)
    expect(exactKeys([], [])).toBe(false)
    expect(exactKeys('a', [])).toBe(false)
    expect(exactKeys(undefined, [])).toBe(false)
  })
})

describe('asUnknownRecord', () => {
  it('narrows non-array objects and rejects everything else', () => {
    const value = { a: 1 }
    expect(asUnknownRecord(value)).toBe(value)
    expect(asUnknownRecord(Object.create(null))).not.toBeNull()
    expect(asUnknownRecord([])).toBeNull()
    expect(asUnknownRecord(null)).toBeNull()
    expect(asUnknownRecord('a')).toBeNull()
    expect(asUnknownRecord(undefined)).toBeNull()
  })
})
