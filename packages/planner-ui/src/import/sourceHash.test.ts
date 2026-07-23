import { describe, expect, it } from 'vitest'

import { sha256Hex, utf8ByteLength } from './sourceHash'

describe('sha256Hex', () => {
  it('matches the published SHA-256 test vector for "abc"', async () => {
    // NIST FIPS 180-4 example; an independent expected value, not our own output.
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('hashes the empty string to the known digest', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})

describe('utf8ByteLength', () => {
  it('counts ASCII as one byte each', () => {
    expect(utf8ByteLength('abc')).toBe(3)
  })

  it('counts multi-byte UTF-8 by encoded length, not code-point count', () => {
    // "é" is 2 UTF-8 bytes; "😀" is 4. String length would say 1 each.
    expect(utf8ByteLength('é')).toBe(2)
    expect(utf8ByteLength('😀')).toBe(4)
  })
})
