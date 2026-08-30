/**
 * Deprecated location. The flat-rate tax double moved to
 * `@retiregolden/engine/testing/flatTax`; this module re-exports it so the
 * published `@retiregolden/engine/projection/flatTax` subpath keeps resolving
 * for consumers pinned to it.
 *
 * Do not add the internal-only JSDoc tag to this file, and do not name that
 * tag here even inside backticks: `stripInternal` is on in
 * tsconfig.build.json, and TypeScript's JSDoc parser treats the bare token as
 * a real tag wherever it appears in a comment attached to this export. Either
 * way the declaration is deleted from `dist/projection/flatTax.d.ts` while
 * `dist/projection/flatTax.js` keeps working — a silent type-only break of the
 * exact subpath this file exists to preserve. `scripts/pack-smoke.mjs` reads
 * the packed declaration file and fails if this export stops appearing in it.
 */

/**
 * @deprecated Import `createFlatTaxCalculator` from
 * `@retiregolden/engine/testing/flatTax` instead. Kept so the published
 * `projection/flatTax` subpath stays compatible; removal is deferred to a
 * future major version and is not scheduled.
 */
export { createFlatTaxCalculator } from '../testing/flatTax.js'
