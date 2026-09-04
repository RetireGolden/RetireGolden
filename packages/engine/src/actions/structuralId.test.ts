import { describe, expect, it } from 'vitest'

import {
  DIGEST_CACHE_BOUNDS,
  clearDigestCache,
  compareUtf16CodeUnits,
  deriveActionStructuralId,
  digestCacheSize,
} from './structuralId.js'

describe('action structural IDs', () => {
  it('matches SHA-256 and remains prefix-scoped and fixed-width', () => {
    const id = deriveActionStructuralId('example', ['abc'])
    expect(id).toBe(
      'example:02f393ea9358560882c1fe797bf99d600aa4643a68276d8e3d714d1c4f19aecc',
    )
    expect(id).toHaveLength('example:'.length + 64)
    expect(deriveActionStructuralId('other', ['abc'])).toBe(
      `other:${id.slice('example:'.length)}`,
    )
    expect(deriveActionStructuralId('multi', ['a'.repeat(100)])).toBe(
      'multi:5cdcc04f2907e10e11d8d09846cce9b6b8f9bb6b6f7874222e06035c789e51ef',
    )
    expect(deriveActionStructuralId('unicode', ['\u00e9', '\ud83d\ude00'])).toBe(
      'unicode:765bfe537fc3fff234e05d8e4d7b18cc0ca5aa6d9f67dc0d13c2714354bea92b',
    )
  })

  it('uses raw UTF-16 code-unit ordering rather than host collation', () => {
    expect(compareUtf16CodeUnits('A', 'a')).toBe(-1)
    expect(compareUtf16CodeUnits('z', '\u00e9')).toBe(-1)
    expect(compareUtf16CodeUnits('\u00e9', '\ud83d\ude00')).toBe(-1)
    expect(compareUtf16CodeUnits('a', 'A')).toBe(1)
    expect(compareUtf16CodeUnits('same', 'same')).toBe(0)
  })

  it('accepts only lossless canonical JSON trees', () => {
    const failure = new TypeError(
      'Structural ID parts must be JSON-serializable',
    )
    expect(() => deriveActionStructuralId('undefined', [undefined])).toThrow(
      failure,
    )
    expect(() => deriveActionStructuralId('nan', [Number.NaN])).toThrow(failure)
    expect(() => deriveActionStructuralId('infinity', [Infinity])).toThrow(
      failure,
    )
    expect(() => deriveActionStructuralId('negative-zero', [-0])).toThrow(
      failure,
    )
    expect(() => deriveActionStructuralId('function', [() => null])).toThrow(
      failure,
    )
    expect(() => deriveActionStructuralId('symbol-value', [Symbol('value')]))
      .toThrow(failure)
    expect(deriveActionStructuralId('null', [null])).not.toBe(
      deriveActionStructuralId('null', [0]),
    )

    const sparse = new Array(1)
    expect(() => deriveActionStructuralId('sparse', sparse)).toThrow(failure)
    const extraArray = [null] as (null | string)[] & { extra?: string }
    extraArray.extra = 'dropped by JSON.stringify'
    expect(() => deriveActionStructuralId('extra-array', extraArray)).toThrow(
      failure,
    )
    const symbolArray = [null]
    Object.defineProperty(symbolArray, Symbol('extra'), { value: 'hidden' })
    expect(() => deriveActionStructuralId('symbol-array', symbolArray)).toThrow(
      failure,
    )
    const customArray = [null]
    Object.setPrototypeOf(customArray, null)
    expect(() => deriveActionStructuralId('prototype-array', customArray))
      .toThrow(failure)
    expect(() => deriveActionStructuralId('dropped', [{ dropped: undefined }]))
      .toThrow(failure)

    let getterCalls = 0
    const accessor = Object.defineProperty({}, 'value', {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return 'hidden'
      },
    })
    expect(() => deriveActionStructuralId('accessor', [accessor])).toThrow(
      failure,
    )
    expect(getterCalls).toBe(0)
    expect(() => deriveActionStructuralId('to-json', [{
      value: 'visible',
      toJSON: () => null,
    }])).toThrow(failure)

    const cyclic: unknown[] = []
    cyclic.push(cyclic)
    expect(() => deriveActionStructuralId('cyclic', cyclic)).toThrow(
      failure,
    )
    expect(() => deriveActionStructuralId('bigint', [1n])).toThrow(
      failure,
    )

    const nonenumerable = Object.defineProperty({}, 'hidden', {
      value: 'hidden',
    })
    expect(() => deriveActionStructuralId('nonenumerable', [nonenumerable]))
      .toThrow(failure)
    expect(() => deriveActionStructuralId('symbol', [{
      [Symbol('hidden')]: 'hidden',
    }])).toThrow(failure)
    expect(() => deriveActionStructuralId('prototype', [
      Object.create({ inherited: true }),
    ])).toThrow(failure)
  })

  it('keeps distinct accepted structures distinct and permits shared references', () => {
    const nullPrototype = Object.create(null) as Record<string, unknown>
    nullPrototype.value = 'plain data'
    const structures: readonly unknown[][] = [
      [null],
      [0],
      ['0'],
      [[]],
      [[null]],
      [{ value: null }],
      [{ other: null }],
      [nullPrototype],
    ]
    const ids = structures.map((parts) =>
      deriveActionStructuralId('distinct', parts)
    )
    expect(new Set(ids).size).toBe(structures.length)

    const shared = { value: 'same' }
    expect(deriveActionStructuralId('shared', [shared, shared])).toBe(
      deriveActionStructuralId('shared', [
        { value: 'same' },
        { value: 'same' },
      ]),
    )
  })

  it('documents Proxy inputs as outside the trusted internal contract', () => {
    const traps: string[] = []
    const proxied = new Proxy({ value: 'plain data' }, {
      getOwnPropertyDescriptor: (target, property) => {
        traps.push(`getOwnPropertyDescriptor:${String(property)}`)
        return Reflect.getOwnPropertyDescriptor(target, property)
      },
      getPrototypeOf: (target) => {
        traps.push('getPrototypeOf')
        return Reflect.getPrototypeOf(target)
      },
      ownKeys: (target) => {
        traps.push('ownKeys')
        return Reflect.ownKeys(target)
      },
    })

    // There is no standard browser-safe Proxy detector. This internal helper
    // therefore requires trusted rebuilt inputs; the test makes the unsupported
    // boundary explicit instead of pretending these traps cannot execute.
    expect(deriveActionStructuralId('proxy-boundary', [proxied])).toBe(
      deriveActionStructuralId('proxy-boundary', [{ value: 'plain data' }]),
    )
    expect(traps).toEqual([
      'getPrototypeOf',
      'ownKeys',
      'getOwnPropertyDescriptor:value',
    ])
  })
})

describe('the structural-ID digest memo', () => {
  it('answers a warm derivation exactly as a cold one', () => {
    const parts = [2045, 'marriedFilingJointly', ['person-1', 'person-2']]

    clearDigestCache()
    const cold = deriveActionStructuralId('memo', parts)
    const warm = deriveActionStructuralId('memo', parts)
    clearDigestCache()
    const coldAgain = deriveActionStructuralId('memo', parts)

    expect(warm).toBe(cold)
    expect(coldAgain).toBe(cold)
    // Same payload, different prefix: the memo holds digests, not IDs.
    expect(deriveActionStructuralId('other', parts)).toBe(
      `other:${cold.slice('memo:'.length)}`,
    )
  })

  it('stays bounded and keeps answering correctly across a clear', () => {
    clearDigestCache()
    const first = deriveActionStructuralId('bounded', ['payload-0'])
    for (let index = 1; index <= DIGEST_CACHE_BOUNDS.maxEntries; index += 1) {
      deriveActionStructuralId('bounded', [`payload-${index}`])
    }

    expect(digestCacheSize()).toBeLessThanOrEqual(
      DIGEST_CACHE_BOUNDS.maxEntries,
    )
    expect(deriveActionStructuralId('bounded', ['payload-0'])).toBe(first)
  })

  it('hashes a payload past the length cap without retaining it', () => {
    clearDigestCache()
    const long = 'x'.repeat(DIGEST_CACHE_BOUNDS.maxPayloadLength + 1)
    const id = deriveActionStructuralId('long', [long])

    expect(digestCacheSize()).toBe(0)
    expect(deriveActionStructuralId('long', [long])).toBe(id)
  })
})
