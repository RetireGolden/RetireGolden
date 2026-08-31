/**
 * Deprecated location. The flat-rate tax double moved to
 * `@retiregolden/engine/testing/flatTax`; this module forwards to it so the
 * published `@retiregolden/engine/projection/flatTax` subpath keeps resolving
 * for consumers pinned to it.
 *
 * Two shapes below are load-bearing and must survive edits.
 *
 * 1. The export is a re-declared alias, not `export { x } from './y.js'`.
 *    TypeScript does not report a `@deprecated` tag attached to a bare
 *    re-export whose target is not itself deprecated, so that shape ships a
 *    marker no consumer ever sees — verified against this repo's TypeScript:
 *    the re-export form produces zero suggestion diagnostics, while the alias
 *    form reports `'createFlatTaxCalculator' is deprecated` at both the import
 *    and the call site. The alias forwards the identical function object, so
 *    the runtime is unchanged.
 *
 * 2. Do not write the internal-only JSDoc tag in this file's comments — not as
 *    a tag, not inside backticks, not embedded in a longer word. `stripInternal`
 *    is on in tsconfig.build.json, and TypeScript's declaration emitter deletes
 *    any export whose leading comment merely CONTAINS that substring: the check
 *    is a raw `comment.includes(...)` over the comment range, with no tag
 *    parsing and no word-boundary test. The declaration would vanish from
 *    `dist/projection/flatTax.d.ts` while `dist/projection/flatTax.js` kept
 *    working — a silent type-only break of the exact subpath this file exists
 *    to preserve.
 *
 * `scripts/pack-smoke.mjs` enforces both halves: it compiles a consumer that
 * imports this subpath by name, and reads the packed declaration file directly.
 */

import { createFlatTaxCalculator as flatTaxDouble } from '../testing/flatTax.js'

/**
 * @deprecated Import `createFlatTaxCalculator` from
 * `@retiregolden/engine/testing/flatTax` instead. Kept so the published
 * `projection/flatTax` subpath stays compatible; removal is deferred to a
 * future major version and is not scheduled.
 */
export const createFlatTaxCalculator = flatTaxDouble
