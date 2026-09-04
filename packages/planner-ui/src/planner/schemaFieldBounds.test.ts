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

import { WILDCARD, wiredFieldPaths } from '../testSupport/wiredFieldPaths'
import { boundsForPath, boundsKey } from './schemaBounds'
import { SCHEMA_FIELD_BOUNDS, type SchemaBounds } from './schemaFieldBounds.generated'

type Node = Record<string, unknown>

/** The subschema at a dot path, following list items and discriminated unions. */
function nodeAt(node: unknown, path: readonly string[]): Node | null {
  if (node === null || typeof node !== 'object') return null
  const here = node as Node
  if (path.length === 0) return here
  const [head, ...rest] = path
  if (/^\d+$/.test(head)) return nodeAt(here.items, rest)
  const properties = here.properties as Node | undefined
  if (properties && head in properties) return nodeAt(properties[head], rest)
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    for (const sub of (here[key] as unknown[] | undefined) ?? []) {
      const hit = nodeAt(sub, path)
      if (hit) return hit
    }
  }
  return null
}

/**
 * The numeric branch of a leaf: a nullable number is emitted as
 * `anyOf: [{ type: 'number', minimum: … }, { type: 'null' }]`, and its bounds
 * live on the number branch (r4-2).
 */
function numericLeaf(node: Node | null): Node | null {
  if (!node) return null
  if (node.type === 'number' || node.type === 'integer') return node
  for (const key of ['anyOf', 'oneOf']) {
    for (const sub of (node[key] as unknown[] | undefined) ?? []) {
      const hit = numericLeaf(sub as Node)
      if (hit) return hit
    }
  }
  return null
}

/** Every concrete path a wildcard path stands for: one per property the schema has at that segment. */
function expandWildcard(path: string): string[] {
  const segments = path.split('.')
  const at = segments.indexOf(WILDCARD)
  if (at < 0) return [path]
  const parent = nodeAt(planJsonSchema, segments.slice(0, at))
  const keys = Object.keys((parent?.properties as Node | undefined) ?? {})
  return keys.flatMap((key) => expandWildcard([...segments.slice(0, at), key, ...segments.slice(at + 1)].join('.')))
}

function boundsFromSchema(path: string): SchemaBounds | null {
  const node = numericLeaf(nodeAt(planJsonSchema, path.split('.')))
  if (!node) return null
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
    for (const wired of paths) {
      for (const path of expandWildcard(wired)) {
        const bounds = boundsFromSchema(path)
        if (bounds) expected.set(boundsKey(path), bounds)
      }
    }
    // Both directions: a bound that drifted from the schema, and an entry for a
    // field no longer wired (or one newly wired with no entry).
    expect(Object.fromEntries([...expected].sort(([a], [b]) => a.localeCompare(b)))).toEqual(
      Object.fromEntries(Object.entries(SCHEMA_FIELD_BOUNDS).sort(([a], [b]) => a.localeCompare(b))),
    )
    expect(expected.size).toBeGreaterThan(60)
  })

  it('covers every asset class the schema allows, not only the first one wired (r4-1)', () => {
    const classes = Object.keys((nodeAt(planJsonSchema, ['assumptions', 'assetClassParams'])?.properties as Node) ?? {})
    expect(classes).toEqual(expect.arrayContaining(['usStocks', 'intlStocks', 'bonds', 'cash']))
    for (const cls of classes) {
      expect(boundsForPath(`assumptions.assetClassParams.${cls}.returnPct`), cls).toEqual({ exclusiveMin: -100, exclusiveMax: 1000 })
      expect(boundsForPath(`assumptions.assetClassParams.${cls}.qualifiedRatioPct`), cls).toEqual({ min: 0, max: 100 })
    }
  })

  it('keeps the range of a nullable number, which the schema wraps in anyOf (r4-2)', () => {
    expect(boundsForPath('household.people.0.retirementAge')).toEqual({ min: 30, max: 80 })
    expect(boundsForPath('incomes.0.endAge')).toEqual({ min: 30, max: 80 })
    expect(boundsForPath('accounts.6.plannedSaleYear')).toEqual({ min: 1900, max: 2200 })
    expect(boundsForPath('accounts.7.payoffYear')).toEqual({ min: 1900, max: 2200 })
    expect(boundsForPath('incomes.4.startYear')).toEqual({ min: 1900, max: 2200 })
    expect(boundsForPath('incomes.2.piaMonthly')).toEqual({ min: 0 })
    // A nullable number the engine leaves unbounded has no entry, and that is right.
    expect(boundsForPath('strategies.rothConversion.targetValue')).toBeNull()
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
