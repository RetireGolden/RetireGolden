/**
 * The stability contract of the `@retiregolden/planner-ui/plan-format`
 * subpath: the exports-map entry resolves to this module, and the envelope
 * tolerances hosts rely on (unknown extension fields, legacy kinds) hold.
 * Behavioral coverage of serialize/parse lives in v2Backup.test.ts and the
 * round-trip suite; this file pins what the promise adds.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import { createSamplePlan } from '../testSupport/samplePlan'
import {
  MAX_BACKUP_JSON_CHARS,
  V2_BACKUP_KIND,
  V2_BACKUP_VERSION,
  parseV2Backup,
  serializeV2Backup,
} from './planFormat'

describe('plan-format subpath', () => {
  it('is published by the exports map as ./plan-format → this module', () => {
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { exports: Record<string, string> }
    expect(packageJson.exports['./plan-format']).toBe('./src/data/planFormat.ts')
  })

  it('ignores unknown envelope fields, so host-extended backups stay importable', () => {
    // The Pro library backup is the v2 envelope plus an extension field; the
    // parser must keep tolerating top-level keys it doesn't know.
    const plan = createSamplePlan()
    const extended = {
      ...(JSON.parse(serializeV2Backup([plan])) as Record<string, unknown>),
      clients: [{ id: 'c1', name: 'Household A', planIds: [plan.id] }],
      someFutureField: { nested: true },
    }
    const parsed = parseV2Backup(JSON.stringify(extended))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.plans).toHaveLength(1)
      expect(parsed.plans[0]!.id).toBe(plan.id)
      expect(parsed.warnings).toEqual([])
    }
  })

  it('round-trips a serialize→parse cycle through the stable exports', () => {
    const plan = createSamplePlan()
    const parsed = parseV2Backup(serializeV2Backup([plan], () => new Date('2026-07-11T00:00:00.000Z')))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.plans[0]).toEqual(plan)
  })

  it('pins the published envelope constants', () => {
    expect(V2_BACKUP_KIND).toBe('retiregolden.v2.backup')
    expect(V2_BACKUP_VERSION).toBe(1)
    expect(MAX_BACKUP_JSON_CHARS).toBe(10_000_000)
  })
})
