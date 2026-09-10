import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)

/**
 * Playwright against the PRODUCTION build: `vite preview` serving `dist/`.
 *
 * The default config (playwright.config.ts) runs against Vite's dev server,
 * which serves unbundled source modules. That cannot see anything the
 * Rolldown chunk graph does at build time — chunk evaluation order, `const`
 * lowered to `var`, a coordinator chunk in a static import cycle with the
 * engine core reading an imported constant as `undefined`. Production
 * shipped exactly that while unit tests and the dev-server specs stayed
 * green. The specs under e2e-dist/ are the pin: they need an existing build
 * (`pnpm build` first) and run in the `build` CI job, after the bundle
 * budget gate, with `pnpm test:e2e:dist`.
 */
export default defineConfig({
  testDir: './e2e-dist',
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
