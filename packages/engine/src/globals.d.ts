/**
 * The engine runs in browsers and in plain Node (≥20), both of which provide
 * the Web Crypto global. The package compiles against lib "ES2023" alone —
 * deliberately no DOM lib, so browser-only APIs can't creep in — which means
 * the one host global the engine uses must be declared here.
 */
declare const crypto: { randomUUID(): string }

/**
 * High-resolution timer, present in browsers and Node but absent from the
 * ES lib types. Declared as possibly-undefined so callers keep their
 * `globalThis.performance?.now?.()` guard for exotic hosts.
 */
// eslint-disable-next-line no-var
declare var performance: { now(): number } | undefined

/** Deep clone (browsers and Node ≥17); used by the co-located tests. */
declare function structuredClone<T>(value: T): T
