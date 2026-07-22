/**
 * `@retiregolden/engine/version` — the running engine's package version, as a
 * plain string constant with no dependencies of any kind.
 *
 * Consumers use it as **provenance**: a document stamped with the engine that
 * produced it lets the reader notice that defaults or modeling semantics may
 * have moved since. The MCP's `build_plan` takes exactly this value back as its
 * `engineVersion` argument and raises a caveat on a mismatch.
 *
 * The value is generated (never hand-edited) from package.json — see
 * `./version.generated.ts` and `scripts/generate-version.mjs`. A runtime read of
 * package.json is deliberately not used: the engine ships into browser bundles,
 * where `createRequire`/`fs` do not exist.
 */
export { ENGINE_VERSION } from './version.generated.js'
