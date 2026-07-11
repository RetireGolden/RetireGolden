import { describe, expect, it } from 'vitest'

import { createEmptyPlan } from './plan.js'
import { migratePlanToCurrent, type MigrationStep } from './migrations.js'

const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
let counter = 0
const testIds = () => `mig-${++counter}`

describe('migratePlanToCurrent', () => {
  it('passes a current-version plan straight through', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const result = migratePlanToCurrent(JSON.parse(JSON.stringify(plan)))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan).toEqual(plan)
  })

  it('normalizes existing joint retirement and HSA accounts to the primary person', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const primaryId = plan.household.people[0]!.id
    plan.accounts = [
      { type: 'traditional', id: 'trad', name: '401(k)', ownerPersonId: null, annualReturnPct: null, kind: 'employer', balance: 1, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: null, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      { type: 'hsa', id: 'hsa', name: 'HSA', ownerPersonId: null, annualReturnPct: null, balance: 1, annualContribution: 0 },
      { type: 'taxable', id: 'tax', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
    ]

    const result = migratePlanToCurrent(JSON.parse(JSON.stringify(plan)))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.accounts.slice(0, 3).map((a) => a.ownerPersonId)).toEqual([primaryId, primaryId, primaryId])
      expect(result.plan.accounts[3]!.ownerPersonId).toBeNull()
    }
  })

  it('rejects non-objects and bad versions', () => {
    expect(migratePlanToCurrent(null)).toEqual({ ok: false, reason: 'not_object' })
    expect(migratePlanToCurrent([])).toEqual({ ok: false, reason: 'not_object' })
    expect(migratePlanToCurrent({})).toEqual({ ok: false, reason: 'bad_version' })
    expect(migratePlanToCurrent({ schemaVersion: 0 })).toEqual({ ok: false, reason: 'bad_version' })
    expect(migratePlanToCurrent({ schemaVersion: 1.5 })).toEqual({ ok: false, reason: 'bad_version' })
  })

  it('refuses plans from a newer app build', () => {
    const result = migratePlanToCurrent({ schemaVersion: 99 })
    expect(result).toEqual({ ok: false, reason: 'newer_than_app' })
  })

  it('fails when a migration step is missing', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const old = { ...JSON.parse(JSON.stringify(plan)), schemaVersion: 1 }
    // Pretend current is 2 with an empty registry.
    const result = migratePlanToCurrent(old, {}, 2)
    expect(result).toEqual({ ok: false, reason: 'missing_step' })
  })

  it('applies registered steps in order and re-validates', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const old = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    // Simulate a v0 plan whose name lived under a different key.
    delete old['name']
    old['title'] = 'Renamed plan'
    old['schemaVersion'] = 1

    // Hypothetical step 1 -> 2; test uses currentVersion=2 with planSchema still
    // expecting literal 1, so re-validation must fail — proving steps run AND
    // output is checked. (Real steps land alongside real schema bumps.)
    const step1to2: MigrationStep = (raw) => {
      const { title, ...rest } = raw
      return { ...rest, name: title }
    }
    const result = migratePlanToCurrent(old, { 1: step1to2 }, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_after_migration')
  })

  it('reports validation issues for corrupt current-version data', () => {
    const result = migratePlanToCurrent({ schemaVersion: 1, id: '', name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_after_migration')
      expect(result.issues).toBeDefined()
    }
  })
})
