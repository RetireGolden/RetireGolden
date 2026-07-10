/**
 * Assumptions card / copy-export guarantees (trust-and-transparency-layer,
 * step 1): every card row carries a provenance tag, the text export contains
 * every row, and the JSON export round-trips the plan's live assumption values
 * exactly — the property that lets a user replicate the run in another tool.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../engine/model/plan'
import { PARAMETER_PROVENANCE } from '../engine/params'
import {
  assumptionsExportJson,
  assumptionsExportText,
  buildAssumptionsSnapshot,
  type AssumptionsSnapshot,
} from './assumptionsExport'

let counter = 0
const nextId = () => `ax-${++counter}`

function fixturePlan(): Plan {
  const plan = createEmptyPlan({ newId: nextId, now: () => new Date('2026-06-11T00:00:00.000Z') })
  plan.name = 'Export fixture'
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 92, source: 'manual' },
  }
  plan.assumptions.inflationPct = 3.1 // user-set (default 2.5)
  plan.assumptions.recentAnnualMagi = 120_000
  plan.accounts = [
    { type: 'traditional', id: nextId(), name: '401k', ownerPersonId: 'p1', annualReturnPct: 6, kind: 'employer', balance: 500_000, annualContribution: 0 },
    {
      type: 'roth',
      id: nextId(),
      name: 'Roth IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 100_000,
      annualContribution: 0,
      allocation: { mode: 'static', rebalancing: 'annual', weights: { usStocks: 60, intlStocks: 0, bonds: 40, cash: 0 } },
    },
    { type: 'cash', id: nextId(), name: 'Checking', ownerPersonId: null, annualReturnPct: null, balance: 20_000, annualContribution: 0 },
  ]
  plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 25_000 }] }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function snapshot(): AssumptionsSnapshot {
  return buildAssumptionsSnapshot(fixturePlan(), 2026)
}

describe('buildAssumptionsSnapshot', () => {
  it('tags user-set values differently from untouched defaults', () => {
    const economy = snapshot().groups.find((g) => g.id === 'economy')!
    const byId = new Map(economy.rows.map((r) => [r.id, r]))
    expect(byId.get('inflation')!.provenance).toBe('user-set')
    expect(byId.get('inflation')!.value).toContain('3.1%')
    expect(byId.get('default-return')!.provenance).toBe('app-default')
    expect(byId.get('swr')!.provenance).toBe('app-default')
  })

  it('enumerates every investable account with its return model', () => {
    const accounts = snapshot().groups.find((g) => g.id === 'accounts')!
    expect(accounts.rows).toHaveLength(3)
    const roth = accounts.rows.find((r) => r.label.startsWith('Roth IRA'))!
    expect(roth.value).toContain('static 60% us stocks / 40% bonds')
    expect(roth.provenance).toBe('user-set')
    const checking = accounts.rows.find((r) => r.label.startsWith('Checking'))!
    expect(checking.value).toContain('plan default')
    expect(checking.provenance).toBe('app-default')
  })

  it('shows the asset-class table once any account opts into allocation', () => {
    const classes = snapshot().groups.find((g) => g.id === 'asset-classes')
    expect(classes).toBeDefined()
    expect(classes!.rows.every((r) => r.provenance === 'published-source')).toBe(true)
  })

  it('includes every tax-parameter provenance group with its source id', () => {
    const tax = snapshot().groups.find((g) => g.id === 'tax-parameters')!
    expect(tax.rows.map((r) => r.sourceId)).toEqual(PARAMETER_PROVENANCE.map((s) => s.id))
  })

  it('covers longevity and law toggles', () => {
    const s = snapshot()
    const longevity = s.groups.find((g) => g.id === 'longevity')!
    expect(longevity.rows.some((r) => r.value.includes('age 92'))).toBe(true)
    const law = s.groups.find((g) => g.id === 'law-toggles')!
    expect(law.rows.find((r) => r.id === 'recent-magi')!.provenance).toBe('user-set')
    expect(law.rows.find((r) => r.id === 'ss-haircut')!.value).toContain('not modeled')
  })
})

describe('assumptionsExportText', () => {
  it('contains every row of every group, with a provenance tag', () => {
    const s = snapshot()
    const text = assumptionsExportText(s)
    for (const group of s.groups) {
      expect(text).toContain(`## ${group.label}`)
      for (const row of group.rows) {
        expect(text).toContain(`${row.label}: ${row.value}`)
      }
    }
    expect(text).toContain('(you set this)')
    expect(text).toContain('(app default)')
    expect(text).toContain('(published source)')
  })

  it('cites the publisher and URL for sourced parameters', () => {
    const text = assumptionsExportText(snapshot())
    for (const source of PARAMETER_PROVENANCE) {
      expect(text).toContain(source.url)
    }
  })
})

describe('assumptionsExportJson', () => {
  it('round-trips the live assumption values exactly', () => {
    const plan = fixturePlan()
    const s = buildAssumptionsSnapshot(plan, 2026)
    const parsed = JSON.parse(assumptionsExportJson(s)) as AssumptionsSnapshot
    expect(parsed.machine.assumptions).toEqual(plan.assumptions)
    expect(parsed.machine.strategies).toEqual(plan.strategies)
    expect(parsed.machine.household.people[0]).toEqual({
      name: 'Pat',
      dob: '1960-06-15',
      retirementAge: 65,
      planningAge: 92,
      longevitySource: 'manual',
    })
    expect(parsed.machine.accounts.map((a) => a.name)).toEqual(['401k', 'Roth IRA', 'Checking'])
    expect(parsed.groups).toEqual(s.groups)
  })
})
