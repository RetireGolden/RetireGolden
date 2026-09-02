/**
 * The field ranges are the engine's, and stay that way (review r3-2, r3-3).
 *
 * `schemaFieldBounds.generated.ts` exists so a control can know what the
 * engine allows without the app bundle carrying the 190 KB Plan JSON Schema.
 * That is a copy, so this recomputes it from the schema and fails on any
 * drift — a changed bound in the engine, or a newly wired field with no entry.
 */
import { describe, expect, it } from 'vitest'

import { planJsonSchema } from '@retiregolden/engine/schema/current'

import { wiredFieldPaths } from '../testSupport/wiredFieldPaths'
import { boundsForPath, boundsKey } from './schemaBounds'
import { SCHEMA_FIELD_BOUNDS, type SchemaBounds } from './schemaFieldBounds.generated'

type Node = Record<string, unknown>

/** The subschema at a dot path, following list items and discriminated unions. */
function nodeAt(node: unknown, path: readonly string[]): Node | null {
  if (node === null || typeof node !== 'object') return null
  const here = node as Node
  if (path.length === 0) return here
  const [head, ...rest] = path
  if (/^\d+$/.test(head!)) return nodeAt(here.items, rest)
  const properties = here.properties as Node | undefined
  if (properties && head! in properties) return nodeAt(properties[head!], rest)
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    for (const sub of (here[key] as unknown[] | undefined) ?? []) {
      const hit = nodeAt(sub, path)
      if (hit) return hit
    }
  }
  return null
}

function boundsFromSchema(path: string): SchemaBounds | null {
  const node = nodeAt(planJsonSchema, path.split('.'))
  if (!node || (node.type !== 'number' && node.type !== 'integer')) return null
  const bounds: SchemaBounds = {}
  if (typeof node.minimum === 'number') bounds.min = node.minimum
  if (typeof node.maximum === 'number') bounds.max = node.maximum
  if (typeof node.exclusiveMinimum === 'number') bounds.exclusiveMin = node.exclusiveMinimum
  if (typeof node.exclusiveMaximum === 'number') bounds.exclusiveMax = node.exclusiveMaximum
  return Object.keys(bounds).length > 0 ? bounds : null
}

describe('schema field bounds', () => {
  const paths = wiredFieldPaths()

  it('every numeric wired path has the engine schema’s own range, and no other entry exists', () => {
    const expected = new Map<string, SchemaBounds>()
    for (const path of paths) {
      const bounds = boundsFromSchema(path)
      if (bounds) expected.set(boundsKey(path), bounds)
    }
    // Both directions: a bound that drifted from the schema, and an entry for a
    // field no longer wired (or one newly wired with no entry).
    expect(Object.fromEntries([...expected].sort(([a], [b]) => a.localeCompare(b)))).toEqual(
      Object.fromEntries(Object.entries(SCHEMA_FIELD_BOUNDS).sort(([a], [b]) => a.localeCompare(b))),
    )
    expect(expected.size).toBeGreaterThan(60)
  })

  it('reads a bound for a path whatever index it carries, and nothing for an unwired one', () => {
    expect(boundsKey('accounts.12.balance')).toBe('accounts.N.balance')
    expect(boundsForPath('accounts.12.balance')).toEqual({ min: 0 })
    expect(boundsForPath('household.people.1.longevity.planningAge')).toEqual({ min: 60, max: 120 })
    // The engine states this one exclusively (> 0), which is what lets a
    // safe-withdrawal rate of 0.05 through where a hand-written min of 0.1
    // refused it (r3-3).
    expect(boundsForPath('assumptions.safeWithdrawalRatePct')).toEqual({ exclusiveMin: 0, exclusiveMax: 1000 })
    expect(boundsForPath('household.people.0.name')).toBeNull()
    expect(boundsForPath(undefined)).toBeNull()
  })

  it('states a bound in the unit the card shows, not the unit the plan stores', () => {
    // The brokerage qualified share is a 0–1 ratio in the plan and a percent on
    // the card, so its range is scaled the same way its advice is (r2-4).
    expect(SCHEMA_FIELD_BOUNDS['accounts.N.qualifiedRatio']).toEqual({ min: 0, max: 1 })
    expect(boundsForPath('accounts.1.qualifiedRatio')).toEqual({ min: 0, max: 100, exclusiveMin: undefined, exclusiveMax: undefined })
    // The asset-class share is already a percent in the plan; it is not scaled.
    expect(boundsForPath('assumptions.assetClassParams.usStocks.qualifiedRatioPct')).toEqual({ min: 0, max: 100 })
  })
})
