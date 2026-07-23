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

  it('hashes raw bytes as-is, so the digest matches the file on disk', async () => {
    // "abc" preceded by a UTF-8 BOM: text decoding would strip the BOM and
    // produce the plain-"abc" hash; the byte digest must not.
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x62, 0x63])
    const { sha256, bytes } = await digestSource(bom.buffer as ArrayBuffer)
    expect(bytes).toBe(6)
    expect(sha256).not.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('degrades to an empty hash — never a wrong one — without SubtleCrypto', async () => {
    const subtle = Object.getOwnPropertyDescriptor(crypto, 'subtle')
    Object.defineProperty(crypto, 'subtle', { value: undefined, configurable: true })
    try {
      const { sha256, bytes } = await digestSource('abc')
      expect(sha256).toBe('')
      expect(bytes).toBe(3)
    } finally {
      if (subtle) Object.defineProperty(crypto, 'subtle', subtle)
    }
  })
})
