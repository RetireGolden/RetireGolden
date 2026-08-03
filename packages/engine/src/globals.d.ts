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

/**
 * WHATWG URL, present in browsers and in Node, used by the tax rule registry's
 * conformance test to read the host out of a citation URL. Declared with only
 * `hostname` for the same reason `crypto` is declared with only `randomUUID`:
 * the narrow shape is what the engine needs, and nothing wider becomes
 * reachable. This is a pure string parser and opens no IO — the `fetch` entry
 * in this package's `no-restricted-globals` list remains the thing standing
 * between the engine and the network.
 */
declare const URL: { new (url: string): { readonly hostname: string } }

/**
 * Vite's build-time source glob, provided by the Vitest transform. Used only by
 * the tax rule registry's conformance test, which scans test sources to prove
 * every registered rule is covered by a discriminating fixture. Declared here
 * rather than pulling in `vite/client` or `@types/node`, so the package stays
 * self-contained and no Node or DOM API becomes reachable from engine code.
 */
interface ImportMeta {
  glob(
    pattern: string,
    options: { readonly query: '?raw'; readonly import: 'default'; readonly eager: true },
  ): Record<string, string>
}
