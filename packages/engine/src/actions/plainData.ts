/**
 * The hostile-input plain-data boundary shared by the action modules.
 *
 * Action entry points take caller-supplied objects and must not let caller
 * code run, or caller state alias engine state, once the value is inside. Each
 * module used to carry its own copy of this walk under one of several names
 * (`plainSnapshot`, `plainDataSnapshot`, `snapshot`) with two sentinel names
 * (`INVALID`, `INVALID_SNAPSHOT`), and the copies had drifted to two hardening
 * levels. This module is the union of what those copies checked.
 */

export type UnknownRecord = Record<string, unknown>

/** The single sentinel for "this value is not detachable plain data". */
export const INVALID_SNAPSHOT: unique symbol = Symbol('invalidSnapshot')

/**
 * Returns a detached, prototype-free deep copy of `value`, or
 * `INVALID_SNAPSHOT` if it is anything other than acyclic JSON-shaped plain
 * data. The copy shares no object identity with the input, so nothing the
 * caller still holds can be observed changing afterwards.
 *
 * What is rejected, and why each check is here:
 *
 * - **Non-finite numbers and `-0`.** `NaN`, `±Infinity`, and `-0` do not
 *   survive a JSON round trip intact and are never valid money, counts, or
 *   years; letting one through would put a value into the ledger that cannot
 *   be serialized back to itself.
 * - **Cycles.** `ancestors` holds the current path only and is cleared in a
 *   `finally`, so a graph that revisits an ancestor is rejected while one that
 *   legitimately shares a sub-object down two branches is copied twice rather
 *   than refused.
 * - **Non-plain prototypes.** Class instances, `Map`/`Set`/`Date`, and arrays
 *   with a swapped prototype are rejected; only `Object.prototype`,
 *   a null prototype, and `Array.prototype` pass.
 * - **Symbol keys**, and any property that is not an own enumerable **data**
 *   descriptor. A getter or a Proxy trap is caller code, and running it is
 *   exactly what this boundary exists to prevent.
 * - **Inconsistent arrays.** The length is read off its own property
 *   descriptor rather than through `.length`, because a Proxy array answers
 *   `.length` through its get trap. The descriptor must be a non-enumerable
 *   safe-integer data property, and the key set must be exactly the indices
 *   `0..length-1` plus `length` — so no extra keys, no holes, no
 *   length disagreeing with the indices.
 */
export function plainDataSnapshot(
  value: unknown,
  ancestors: Set<object> = new Set<object>(),
): unknown | typeof INVALID_SNAPSHOT {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    return Number.isFinite(value) && !Object.is(value, -0) ? value : INVALID_SNAPSHOT
  }
  if (typeof value !== 'object' || ancestors.has(value)) return INVALID_SNAPSHOT
  try {
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) return INVALID_SNAPSHOT
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID_SNAPSHOT
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')
      const size = length?.value
      if (
        length === undefined ||
        length.enumerable ||
        !Object.hasOwn(length, 'value') ||
        typeof size !== 'number' ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        keys.length !== size + 1 ||
        !keys.includes('length') ||
        Array.from({ length: size }, (_, index) => String(index))
          .some((key) => !keys.includes(key))
      ) return INVALID_SNAPSHOT
    }
    const output: unknown[] | UnknownRecord = array ? [] : Object.create(null) as UnknownRecord
    ancestors.add(value)
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) return INVALID_SNAPSHOT
      const child = plainDataSnapshot(descriptor.value, ancestors)
      if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: child,
      })
    }
    return output
  } catch {
    return INVALID_SNAPSHOT
  } finally {
    ancestors.delete(value)
  }
}

/**
 * True when `value` is a non-array object whose own enumerable keys are
 * exactly `expected`.
 *
 * Both directions are checked — every actual key is expected, and every
 * expected key is present — so the result does not depend on `expected` being
 * duplicate-free, which the per-module copies silently assumed.
 *
 * The guard intersects rather than replaces: narrowing an `unknown` yields a
 * record, and narrowing an already-typed value keeps its declared shape, which
 * is what the copies returning a bare `boolean` gave their callers.
 */
export function exactKeys<T>(value: T, expected: readonly string[]): value is T & UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length &&
    keys.every((key) => expected.includes(key)) &&
    expected.every((key) => Object.hasOwn(value, key))
}

/** True for a string carrying at least one non-whitespace character. */
export function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Returns `value` when it is a nonblank string, and throws otherwise. The
 * throwing counterpart of `nonblank`, for the identifier reads whose callers
 * treat a blank as a programming error rather than a blocked result.
 */
export function requireNonblankId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonblank stable identifier`)
  }
  return value
}

/** Narrows to a non-array object, or null. Shape only; says nothing about keys. */
export function asUnknownRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}
