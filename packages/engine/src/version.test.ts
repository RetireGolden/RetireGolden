/**
 * The freshness guard for the generated `ENGINE_VERSION`.
 *
 * This is not ceremony. Nothing in CI runs `npm run generate:version`, so the
 * checked-in constant is kept current by discipline alone — exactly the gap that
 * lets a release bump package.json and leave every document the browser stamps
 * claiming the previous engine. Reading package.json here INDEPENDENTLY (raw
 * text, not through the constant) is what makes the assertion mean something.
 */
import { describe, expect, it } from 'vitest'

import packageJson from '../package.json' with { type: 'json' }
import { ENGINE_VERSION } from './version.js'
import { ENGINE_VERSION as GENERATED } from './version.generated.js'

describe('ENGINE_VERSION', () => {
  it('matches the version in package.json', () => {
    // If this fails, run `npm run generate:version -w @retiregolden/engine`
    // and commit the regenerated src/version.generated.ts.
    expect(ENGINE_VERSION).toBe(packageJson.version)
  })

  it('is re-exported unchanged from the generated module', () => {
    expect(ENGINE_VERSION).toBe(GENERATED)
  })

  it('is a plain semver string, usable as provenance in an exported document', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  })
})
