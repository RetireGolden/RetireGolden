const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const

const SHA256_ROUND = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const

function rotateRight(value: number, places: number): number {
  return (value >>> places) | (value << (32 - places))
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = []
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index)
    if (
      codePoint >= 0xd800 &&
      codePoint <= 0xdbff &&
      index + 1 < value.length
    ) {
      const low = value.charCodeAt(index + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x1_0000 + ((codePoint - 0xd800) << 10) + low - 0xdc00
        index += 1
      }
    }
    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f))
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      )
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      )
    }
  }
  return Uint8Array.from(bytes)
}

function sha256(value: string): string {
  const message = utf8Bytes(value)
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(message)
  padded[message.length] = 0x80
  const bitLength = message.length * 8
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const hash: number[] = [...SHA256_INITIAL]
  const words = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }
    for (let index = 16; index < 64; index += 1) {
      const before15 = words[index - 15]!
      const before2 = words[index - 2]!
      const sigma0 = rotateRight(before15, 7) ^
        rotateRight(before15, 18) ^
        (before15 >>> 3)
      const sigma1 = rotateRight(before2, 17) ^
        rotateRight(before2, 19) ^
        (before2 >>> 10)
      words[index] = (
        words[index - 16]! + sigma0 + words[index - 7]! + sigma1
      ) >>> 0
    }

    let a = hash[0]!
    let b = hash[1]!
    let c = hash[2]!
    let d = hash[3]!
    let e = hash[4]!
    let f = hash[5]!
    let g = hash[6]!
    let h = hash[7]!
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temporary1 = (
        h + sum1 + choose + SHA256_ROUND[index]! + words[index]!
      ) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    hash[0] = (hash[0]! + a) >>> 0
    hash[1] = (hash[1]! + b) >>> 0
    hash[2] = (hash[2]! + c) >>> 0
    hash[3] = (hash[3]! + d) >>> 0
    hash[4] = (hash[4]! + e) >>> 0
    hash[5] = (hash[5]! + f) >>> 0
    hash[6] = (hash[6]! + g) >>> 0
    hash[7] = (hash[7]! + h) >>> 0
  }
  return hash.map((word) => word.toString(16).padStart(8, '0')).join('')
}

/**
 * Longest canonical payload this module will keep a digest for, in UTF-16
 * code units, and the most entries it will hold.
 *
 * The cache below is a pure memo — same canonical string, same digest — so
 * these two numbers change nothing but memory and speed. They exist because
 * the engine runs inside a long-lived worker: an unbounded map keyed by
 * caller-shaped strings would grow for the life of the process. Bounding the
 * entry count alone would not bound the memory, because the keys are the
 * payloads themselves and a payload has no fixed size, so the length cap
 * bounds each entry and the entry cap bounds their number. Together they hold
 * the cache under roughly 8 MB in the worst case and a fraction of a megabyte
 * in practice, where the repeated payloads are the short per-year identity
 * ones (tens of bytes each).
 *
 * A payload longer than the cap is hashed and not retained: long payloads are
 * the one-off aggregate records, which are hashed once and never repeat, so
 * caching them would spend the whole budget on entries that never hit.
 */
const DIGEST_CACHE_MAX_PAYLOAD_LENGTH = 512
const DIGEST_CACHE_MAX_ENTRIES = 8192

const digestCache = new Map<string, string>()

/** @internal The two bounds above, so a test can assert against them. */
export const DIGEST_CACHE_BOUNDS = Object.freeze({
  maxPayloadLength: DIGEST_CACHE_MAX_PAYLOAD_LENGTH,
  maxEntries: DIGEST_CACHE_MAX_ENTRIES,
})

/** @internal How many digests the memo is holding right now. */
export function digestCacheSize(): number {
  return digestCache.size
}

/**
 * @internal Empties the memo, so a test can derive the same ID both cold and
 * warm and compare. Callers get the same ID either way, so nothing outside a
 * test has a reason to call this.
 */
export function clearDigestCache(): void {
  digestCache.clear()
}

function cachedSha256(canonical: string): string {
  if (canonical.length > DIGEST_CACHE_MAX_PAYLOAD_LENGTH) {
    return sha256(canonical)
  }
  const cached = digestCache.get(canonical)
  if (cached !== undefined) return cached
  const digest = sha256(canonical)
  // Clear rather than evict one entry: the working set here is a small,
  // stable group of per-year identity payloads, so a full clear costs one
  // rebuild of that group and needs no recency bookkeeping on the hot path.
  if (digestCache.size >= DIGEST_CACHE_MAX_ENTRIES) digestCache.clear()
  digestCache.set(canonical, digest)
  return digest
}

const STRUCTURAL_PARTS_ERROR =
  'Structural ID parts must be JSON-serializable'

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue }

function invalidStructuralParts(): never {
  throw new TypeError(STRUCTURAL_PARTS_ERROR)
}

function canonicalJsonValue(
  value: unknown,
  ancestors: Set<object>,
): CanonicalJsonValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      return invalidStructuralParts()
    }
    return value
  }
  if (typeof value !== 'object') return invalidStructuralParts()
  if (ancestors.has(value)) return invalidStructuralParts()

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        return invalidStructuralParts()
      }
      const keys = Reflect.ownKeys(value)
      if (
        keys.length !== value.length + 1 ||
        keys.some((key) => typeof key !== 'string')
      ) {
        return invalidStructuralParts()
      }
      const canonical = new Array<CanonicalJsonValue>(value.length)
      Object.setPrototypeOf(canonical, null)
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index)
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, 'value')
        ) {
          return invalidStructuralParts()
        }
        canonical[index] = canonicalJsonValue(descriptor.value, ancestors)
      }
      if (!keys.includes('length')) return invalidStructuralParts()
      return canonical
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidStructuralParts()
    }
    const canonical = Object.create(null) as {
      [key: string]: CanonicalJsonValue
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') return invalidStructuralParts()
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) {
        return invalidStructuralParts()
      }
      Object.defineProperty(canonical, key, {
        configurable: true,
        enumerable: true,
        value: canonicalJsonValue(descriptor.value, ancestors),
        writable: true,
      })
    }
    return canonical
  } finally {
    ancestors.delete(value)
  }
}

/**
 * Package-internal structural identity for freshly rebuilt, trusted canonical
 * data trees. JavaScript has no browser-safe way to distinguish a `Proxy` from
 * its target, so this is deliberately not a hostile-object validation boundary
 * and must not be exposed as a general caller-object hasher. The recursive
 * checks below prevent lossy JSON semantics for in-contract plain data. This
 * synchronous implementation remains browser-safe.
 *
 * Every payload is canonicalized on every call; only the digest of an
 * already-seen canonical string is reused, from the bounded memo above. The
 * validation therefore still runs against the caller's actual object graph
 * each time, and the memo can only ever return the digest the same canonical
 * string would have produced.
 *
 * @internal
 */
export function deriveActionStructuralId(
  prefix: string,
  parts: readonly unknown[],
): string {
  if (prefix.trim().length === 0 || prefix.includes(':')) {
    throw new TypeError('Structural ID prefix must be nonblank and contain no colon')
  }
  let canonical: string | undefined
  try {
    canonical = JSON.stringify(canonicalJsonValue(parts, new Set()))
  } catch {
    throw new TypeError(STRUCTURAL_PARTS_ERROR)
  }
  if (canonical === undefined) {
    throw new TypeError(STRUCTURAL_PARTS_ERROR)
  }
  return `${prefix}:${cachedSha256(canonical)}`
}

/** @internal Compare strings by raw UTF-16 code units, independent of locale. */
export function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
