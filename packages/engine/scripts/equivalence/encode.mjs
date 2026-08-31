/**
 * Lossless deterministic encoder for an engine result tree, plus a structural
 * differ over two encoded trees.
 *
 * `JSON.stringify` is NOT sufficient for an equivalence check: it renders `-0`
 * as `0`, `NaN`/`±Infinity` as `null`, drops keys whose value is `undefined`,
 * and gives no signal when object key order changes — and key order IS
 * published output here (`YearResult.balances` is built by `Object.fromEntries`
 * over an ordered entry list, and `ProjectionResult.warnings` is a Set spread
 * whose order is first-insertion, i.e. phase order).
 *
 * Encoding (every form is plain JSON, so a dump is diffable and hashable):
 *   finite number          -> the number (JSON's shortest round-trip form
 *                             uniquely identifies a double)
 *   -0                     -> "#-0"
 *   NaN / Inf / -Inf       -> "#NaN" / "#Inf" / "#-Inf"
 *   undefined (present)    -> "#undef"   (never collapses into key-absent)
 *   string                 -> itself, with a leading '#' doubled so no string
 *                             can ever collide with a sentinel
 *   boolean / null         -> themselves
 *   bigint                 -> ["b", decimal string]
 *   array                  -> ["a", ...encoded elements]      (length + order)
 *   object                 -> ["o", [k, v], [k, v], ...]      (keys emitted
 *                             explicitly in Object.keys insertion order, so a
 *                             reordering is a textual diff)
 *   Map / Set              -> ["m", ...] / ["s", ...] in insertion order
 *   Date                   -> ["d", iso]
 * Anything else throws, so an unexpected value type fails loudly instead of
 * being silently flattened.
 *
 * NOT observable through this encoder, stated so nobody claims otherwise:
 * object IDENTITY. Two structurally equal objects encode identically, so a
 * dump can never tell "the caller published the helper's own object" from "the
 * caller published a field-for-field rebuild of it". That is what a delegation
 * test's `toBe` is for.
 *
 * `packages/engine/src/projection/equivalenceEncode.test.ts` pins the cases
 * above, importing this module through `encode.d.mts`.
 */

/** @typedef {unknown} Encoded */

/**
 * @param {unknown} value
 * @param {string} [path]
 * @param {Set<object>} [seen]
 * @returns {Encoded}
 */
export function encode(value, path = '$', seen = new Set()) {
  if (value === undefined) return '#undef'
  if (value === null) return null
  const t = typeof value
  if (t === 'number') {
    if (Object.is(value, -0)) return '#-0'
    if (Number.isNaN(value)) return '#NaN'
    if (value === Infinity) return '#Inf'
    if (value === -Infinity) return '#-Inf'
    return value
  }
  if (t === 'string') return value.startsWith('#') ? `#${value}` : value
  if (t === 'boolean') return value
  if (t === 'bigint') return ['b', value.toString()]
  if (t === 'function' || t === 'symbol') {
    throw new Error(`equivalence encoder: unencodable ${t} at ${path}`)
  }
  const obj = /** @type {object} */ (value)
  if (seen.has(obj)) throw new Error(`equivalence encoder: cycle at ${path}`)
  seen.add(obj)
  try {
    if (Array.isArray(obj)) {
      const out = ['a']
      for (let i = 0; i < obj.length; i++) {
        // A hole in a sparse array encodes as "#undef" too, which is exactly
        // what a read of that index yields.
        out.push(encode(obj[i], `${path}[${i}]`, seen))
      }
      return out
    }
    if (obj instanceof Date) return ['d', obj.toISOString()]
    if (obj instanceof Map) {
      const out = ['m']
      for (const [k, v] of obj) {
        out.push([encode(k, `${path}<key>`, seen), encode(v, `${path}.${String(k)}`, seen)])
      }
      return out
    }
    if (obj instanceof Set) {
      const out = ['s']
      let i = 0
      for (const v of obj) out.push(encode(v, `${path}{${i++}}`, seen))
      return out
    }
    const out = ['o']
    for (const key of Object.keys(obj)) {
      out.push([key, encode(obj[key], `${path}.${key}`, seen)])
    }
    return out
  } finally {
    seen.delete(obj)
  }
}

/**
 * Canonical text form of an encoded tree. Deterministic by construction.
 * @param {unknown} value
 * @returns {string}
 */
export function encodeToText(value) {
  return JSON.stringify(encode(value))
}

// ---------------------------------------------------------------------------
// Structural comparison
// ---------------------------------------------------------------------------

/** @typedef {{ path: string, base: string, head: string }} Mismatch */

/** @param {unknown} v @returns {string} */
function show(v) {
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return `<${String(v[0])} len=${v.length - 1}>`
  return String(v)
}

/**
 * Recursive walk over two ENCODED trees, comparing every leaf with `Object.is`.
 * Walking the encoded (rather than decoded) trees is strictly stronger: `-0`,
 * `NaN`, `±Infinity` and present-but-undefined are already distinct string
 * sentinels, so `Object.is` on the encoded leaves separates every case the raw
 * doubles would have collapsed, with no decode step that could itself be buggy.
 *
 * @param {Encoded} base
 * @param {Encoded} head
 * @param {number} [limit] stop after this many mismatches (report, not verdict)
 * @param {string} [path]
 * @param {Mismatch[]} [out]
 * @returns {Mismatch[]}
 */
export function diffEncoded(base, head, limit = 40, path = '$', out = []) {
  if (out.length >= limit) return out
  const bArr = Array.isArray(base)
  const hArr = Array.isArray(head)
  if (bArr !== hArr) {
    out.push({ path, base: show(base), head: show(head) })
    return out
  }
  if (!bArr) {
    if (!Object.is(base, head)) out.push({ path, base: show(base), head: show(head) })
    return out
  }
  const b = /** @type {unknown[]} */ (base)
  const h = /** @type {unknown[]} */ (head)
  if (!Object.is(b[0], h[0])) {
    out.push({ path: `${path}<tag>`, base: show(b[0]), head: show(h[0]) })
    return out
  }
  if (b.length !== h.length) {
    out.push({ path: `${path}<length>`, base: String(b.length - 1), head: String(h.length - 1) })
  }
  const n = Math.min(b.length, h.length)
  const tag = b[0]
  if (tag === 'o' || tag === 'm') {
    for (let i = 1; i < n && out.length < limit; i++) {
      const bp = /** @type {[unknown, unknown]} */ (b[i])
      const hp = /** @type {[unknown, unknown]} */ (h[i])
      if (!Object.is(bp[0], hp[0])) {
        out.push({ path: `${path}<key#${i - 1}>`, base: show(bp[0]), head: show(hp[0]) })
        continue
      }
      diffEncoded(bp[1], hp[1], limit, `${path}.${String(bp[0])}`, out)
    }
    return out
  }
  for (let i = 1; i < n && out.length < limit; i++) {
    diffEncoded(b[i], h[i], limit, `${path}[${i - 1}]`, out)
  }
  return out
}
