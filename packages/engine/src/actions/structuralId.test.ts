import { describe, expect, it } from 'vitest'

import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
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

  it('normalizes failures for non-JSON-serializable structural parts', () => {
    const cyclic: unknown[] = []
    cyclic.push(cyclic)
    expect(() => deriveActionStructuralId('cyclic', cyclic)).toThrow(
      new TypeError('Structural ID parts must be JSON-serializable'),
    )
    expect(() => deriveActionStructuralId('bigint', [1n])).toThrow(
      new TypeError('Structural ID parts must be JSON-serializable'),
    )
  })
})
