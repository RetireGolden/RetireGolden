/**
 * Lets the rule tooling keep importing engine sources straight from `src/`.
 *
 * Node 24 strips TypeScript types natively, which is what `verify-quotes.mjs`
 * and the `rules:*` publishers rely on to read the registry without a prior
 * `pnpm run build`. What Node does not do is map a relative `./x.js` specifier
 * onto the `./x.ts` file that emitted it — and NodeNext TypeScript requires the
 * `.js` form, so the moment a source file imports a sibling source file, those
 * scripts stop resolving.
 *
 * This registers an in-thread resolve hook that closes exactly that gap: for a
 * relative specifier written inside a TypeScript file, where the JavaScript
 * file does not exist but the TypeScript one does, resolve to the TypeScript
 * file. Anything else falls through to Node's own resolution untouched, so a
 * genuinely missing module still fails the way it always did.
 *
 * Importing this module registers the hook. The rule tooling picks it up
 * through `rule-tooling-shared.mjs`; `verify-quotes.mjs` imports it directly.
 */
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const TYPESCRIPT_PARENT = /\.(?:ts|mts|cts|tsx)$/u
/** Maps an emitted extension back to the source extensions that produce it. */
const SOURCE_EXTENSIONS = new Map([
  ['.js', ['.ts', '.tsx']],
  ['.mjs', ['.mts']],
  ['.cjs', ['.cts']],
])

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parentURL = context.parentURL
    if (
      parentURL !== undefined &&
      TYPESCRIPT_PARENT.test(parentURL) &&
      (specifier.startsWith('./') || specifier.startsWith('../'))
    ) {
      const emitted = specifier.slice(specifier.lastIndexOf('.'))
      const candidates = SOURCE_EXTENSIONS.get(emitted)
      if (candidates !== undefined) {
        const stem = specifier.slice(0, -emitted.length)
        const asWritten = new URL(specifier, parentURL)
        if (!existsSync(fileURLToPath(asWritten))) {
          for (const extension of candidates) {
            const source = new URL(stem + extension, parentURL)
            if (existsSync(fileURLToPath(source))) {
              return { url: source.href, shortCircuit: true }
            }
          }
        }
      }
    }
    return nextResolve(specifier, context)
  },
})
