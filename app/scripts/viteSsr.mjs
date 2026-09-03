/**
 * Shared Vite SSR bootstrap for the app's build and maintenance scripts.
 *
 * generate-sitemap.mjs, cases.mjs, and owl-parity.mjs all need to read the
 * TypeScript sources as the single source of truth (route/article registries,
 * the case runner, the Owl parity harness) without a separate build step, so
 * each one opened a middleware-mode Vite server and called `ssrLoadModule`.
 * Three hand-rolled copies meant three chances to drift on the details that
 * matter — the app's own vite.config.ts must be the config, the HMR port has
 * to be per-process so two concurrent script runs don't fight over one socket,
 * and the server must be closed on every path or the process hangs.
 */
import { createServer } from 'vite'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The `app/` package root — these scripts live in `app/scripts/`. */
export const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Open a middleware-mode Vite server, SSR-load the named modules, hand them to
 * `use`, and always close the server — including when loading or `use` throws.
 *
 * @param {Record<string, string>} specifiers module specifiers keyed by the
 *   name they should get in the object passed to `use`.
 * @param {(modules: Record<string, unknown>) => unknown} use receives the
 *   loaded modules; its resolved value is returned.
 */
export async function withSsrModules(specifiers, use) {
  const server = await createServer({
    root: appDir,
    configFile: join(appDir, 'vite.config.ts'),
    appType: 'custom',
    logLevel: 'error',
    // Middleware mode still opens an HMR socket. Derive the port from the pid
    // so two of these scripts (or two CI jobs on one runner) can run at once.
    server: { middlewareMode: true, hmr: { port: 30_000 + (process.pid % 20_000) } },
  })
  try {
    const modules = {}
    for (const [name, specifier] of Object.entries(specifiers)) {
      modules[name] = await server.ssrLoadModule(specifier)
    }
    return await use(modules)
  } finally {
    await server.close()
  }
}
