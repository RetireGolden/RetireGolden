/**
 * The encoder and differ behind `scripts/equivalence.mjs` — the differential
 * equivalence dump that gates every `simulate.ts` phase extraction.
 *
 * WHY A COMMITTED TEST FOR A DEV SCRIPT. The dump's whole value is that it can
 * say "not one bit moved". Every earlier phase rebuilt an ad-hoc encoder in a
 * scratch directory, and an encoder that quietly loses a distinction turns the
 * check into a rubber stamp: `JSON.stringify` alone renders `-0` as `0`,
 * `NaN`/`±Infinity` as `null`, drops a key whose value is `undefined`, and says
 * nothing at all when object key order changes — and key order IS published
 * output here, because `YearResult.balances` is an `Object.fromEntries` over an
 * ordered entry list and `ProjectionResult.warnings` is a Set spread in phase
 * order. Each case below is one of those losses, pinned.
 *
 * WHAT THIS FILE DOES NOT COVER, said plainly: it tests the ENCODER, not the
 * engine and not the corpus. A green run here says a difference would be
 * *representable*, never that any particular corpus would *reach* the code that
 * produced it. Reach is `equivalence.mjs reach`, and object identity is a
 * delegation test's `toBe` — no encoding can see it, since a field-for-field
 * rebuild of a payload encodes exactly like the original.
 *
 * Imported through `scripts/equivalence/encode.d.mts`, the same shape
 * `coverageReport.freshness.test.ts` uses for `scripts/rules-coverage.mjs`, so
 * `scripts/` stays out of the compiled package surface.
 */
import { describe, expect, it } from 'vitest'
import { diffEncoded, encode, encodeToText } from '../../scripts/equivalence/encode.mjs'

/** Round trip through the dump's own text form, as `compare` sees it. */
const viaDump = (value: unknown): unknown => JSON.parse(encodeToText(value))

const differs = (base: unknown, head: unknown): ReturnType<typeof diffEncoded> =>
  diffEncoded(viaDump(base), viaDump(head))

describe('equivalence encoder: distinctions JSON.stringify loses', () => {
  it('separates -0 from 0', () => {
    expect(JSON.stringify({ x: -0 })).toBe(JSON.stringify({ x: 0 }))
    expect(encodeToText({ x: -0 })).not.toBe(encodeToText({ x: 0 }))
    expect(differs({ x: -0 }, { x: 0 })).toEqual([{ path: '$.x', base: '"#-0"', head: '0' }])
  })

  it('separates NaN, +Infinity and -Infinity from null and from each other', () => {
    expect(JSON.stringify([NaN, Infinity, -Infinity])).toBe('[null,null,null]')
    expect(viaDump([NaN, Infinity, -Infinity])).toEqual(['a', '#NaN', '#Inf', '#-Inf'])
    expect(differs([NaN], [null])).toHaveLength(1)
    expect(differs([Infinity], [-Infinity])).toHaveLength(1)
  })

  it('separates a present-but-undefined value from an absent key', () => {
    expect(JSON.stringify({ a: 1, b: undefined })).toBe(JSON.stringify({ a: 1 }))
    const mismatches = differs({ a: 1, b: undefined }, { a: 1 })
    expect(mismatches.length).toBeGreaterThan(0)
  })

  it('separates a reordered object from the original', () => {
    // `year.balances` is built by Object.fromEntries over an ordered list, so
    // its key order is published output, not an implementation detail.
    const forwards = { alpha: 1, beta: 2 }
    const backwards = { beta: 2, alpha: 1 }
    expect(differs(forwards, backwards)).toEqual([
      { path: '$<key#0>', base: '"alpha"', head: '"beta"' },
      { path: '$<key#1>', base: '"beta"', head: '"alpha"' },
    ])
  })

  it('separates a reordered Set from the original', () => {
    // `ProjectionResult.warnings` is a Set spread: insertion order is phase
    // order, so a phase that moved is visible here and nowhere else.
    expect(differs(new Set(['a', 'b']), new Set(['b', 'a']))).toHaveLength(2)
  })

  it('encodes bigint as a tagged decimal, which JSON.stringify cannot serialize', () => {
    // Counterfactual liability is an exact rational in minor units. Pin the
    // encoder helper, not a product result: the engine does not publish bigint
    // on ProjectionResult, and inventing one there would not discriminate the
    // arm. Dropping `if (t === 'bigint')` would throw inside Object.keys
    // (bigint is not coercible to an object) or, if "fixed" by skipping, lose
    // the channel JSON.stringify cannot represent at all.
    expect(() => JSON.stringify(1n)).toThrow(/BigInt/u)
    expect(viaDump(1n)).toEqual(['b', '1'])
    expect(viaDump(-2n)).toEqual(['b', '-2'])
    expect(differs(1n, 2n)).toHaveLength(1)
  })

  it('separates Map insertion order and Map keys', () => {
    expect(differs(new Map([['a', 1], ['b', 2]]), new Map([['b', 2], ['a', 1]]))).toHaveLength(2)
    expect(differs(new Map([['a', 1]]), new Map([['a', 2]]))).toEqual([
      { path: '$.a', base: '1', head: '2' },
    ])
  })

  it('separates a string that looks like a sentinel from the sentinel itself', () => {
    // Without the doubling rule a plan could name an account "#NaN" and become
    // indistinguishable from an actual NaN.
    expect(viaDump('#NaN')).toBe('##NaN')
    expect(differs('#NaN', NaN)).toHaveLength(1)
  })

  it('separates a shorter array from a longer one, and reports the length', () => {
    expect(differs([1, 2], [1, 2, 3])).toContainEqual({ path: '$<length>', base: '2', head: '3' })
  })

  it('separates a sparse hole from an explicit undefined only by value, not by shape', () => {
    // A hole reads as `undefined`, and that is exactly what the encoder emits —
    // stated as the deliberate choice it is rather than left to be discovered.
    const sparse: unknown[] = []
    sparse[1] = 'x'
    expect(viaDump(sparse)).toEqual(['a', '#undef', 'x'])
  })
})

describe('equivalence encoder: the last-bit case the dump exists for', () => {
  it('separates two doubles that toBeCloseTo cannot', () => {
    // Measured on this repository: re-associating `annualGross * raise * infl`
    // as `annualGross * (raise * infl)` moved a curated example's wage income
    // from 72449.5240625 to 72449.52406249999 and nothing else. Every existing
    // wages test uses toBeCloseTo and passes either way.
    const base = 72449.5240625
    const head = 72449.52406249999
    expect(head).toBeCloseTo(base, 6)
    expect(differs({ wages: base }, { wages: head })).toEqual([
      { path: '$.wages', base: String(base), head: String(head) },
    ])
  })

  it('reports nothing when two trees are leaf-for-leaf identical', () => {
    const tree = { years: [{ balances: { a: 1.5, b: -0 }, warnings: ['w'] }] }
    expect(differs(tree, structuredClone(tree))).toEqual([])
  })

  it('is stable: the same value always encodes to the same text', () => {
    const tree = { m: new Map([['k', new Set([1, 2])]]), d: new Date('2026-01-02T03:04:05.000Z') }
    expect(encodeToText(tree)).toBe(encodeToText(tree))
  })
})

describe('equivalence encoder: fails loudly rather than flattening', () => {
  it('throws on a function', () => {
    expect(() => encode({ f: () => 1 })).toThrow(/unencodable function at \$\.f/u)
  })

  it('throws on a symbol', () => {
    expect(() => encode({ s: Symbol('x') })).toThrow(/unencodable symbol/u)
  })

  it('throws on a symbol-keyed own property instead of dropping it', () => {
    const hidden = { [Symbol('channel')]: 1, visible: 2 }
    expect(JSON.stringify(hidden)).toBe('{"visible":2}')
    expect(() => encode(hidden)).toThrow(/symbol-keyed own property at \$/u)
  })

  it('throws on a non-enumerable own property instead of dropping it', () => {
    const hidden: Record<string, unknown> = { visible: 1 }
    Object.defineProperty(hidden, 'dropped', { value: 2, enumerable: false })
    expect(JSON.stringify(hidden)).toBe('{"visible":1}')
    expect(() => encode(hidden)).toThrow(/non-enumerable own property "dropped" at \$/u)
  })

  it('throws on a cycle instead of recursing forever', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => encode(cyclic)).toThrow(/cycle at \$\.self/u)
  })

  it('does not treat a repeated (but acyclic) reference as a cycle', () => {
    const shared = { v: 1 }
    expect(() => encode({ a: shared, b: shared })).not.toThrow()
  })
})

describe('equivalence differ: stops early without changing the verdict', () => {
  it('honours the mismatch limit while still reporting a difference', () => {
    const base = Array.from({ length: 50 }, (_, i) => i)
    const head = Array.from({ length: 50 }, (_, i) => i + 1)
    expect(diffEncoded(encode(base), encode(head), 3)).toHaveLength(3)
    // The limit is a REPORTING cap. `compare` decides identical/different from
    // the per-entry hashes, never from the length of this list, so a truncated
    // report can never read as a pass.
    expect(diffEncoded(encode(base), encode(head), 3).length).toBeGreaterThan(0)
  })
})
