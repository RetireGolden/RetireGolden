import { describe, expect, it } from 'vitest'

import { digestSource } from './sourceHash'

describe('digestSource', () => {
  it('matches the published SHA-256 test vector for "abc"', async () => {
    // NIST FIPS 180-4 example; an independent expected value, not our own output.
    const { sha256, bytes } = await digestSource('abc')
    expect(sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(bytes).toBe(3)
  })

  it('hashes the empty string to the known digest', async () => {
    const { sha256, bytes } = await digestSource('')
    expect(sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(bytes).toBe(0)
  })

  it('counts multi-byte UTF-8 by encoded length, not code-point count', async () => {
    // "é" is 2 UTF-8 bytes; "😀" is 4. String length would say 1 each.
    expect((await digestSource('é')).bytes).toBe(2)
    expect((await digestSource('😀')).bytes).toBe(4)
  })
})
