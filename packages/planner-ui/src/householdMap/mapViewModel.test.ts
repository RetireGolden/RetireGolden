import { describe, expect, it } from 'vitest'

import { buildHouseholdGraph } from '@retiregolden/engine/household/householdGraph'
import { buildExampleCouple } from '../planner/examples/buildExampleCouple'
import { buildMapViewModel } from './mapViewModel'

describe('buildMapViewModel', () => {
  it('formats stored amounts with their unit captions', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()))
    const withAmounts = vm.nodes.filter((n) => n.amountText !== null)
    expect(withAmounts.length).toBeGreaterThan(0)
    // Every formatted amount is a dollar string; monthly figures carry /mo.
    for (const n of withAmounts) expect(n.amountText).toMatch(/^\$/)
    expect(vm.totals).not.toBeNull()
  })

  it('privacy-hide: the sanitized model contains no dollar strings at all', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()), { hideAmounts: true })
    expect(vm.amountsHidden).toBe(true)
    expect(vm.totals).toBeNull()
    expect(JSON.stringify(vm)).not.toContain('$')
  })

  it('deep links map edit surfaces to planner routes', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()))
    const routes = new Set(vm.nodes.map((n) => n.to))
    expect(routes.has('household')).toBe(true)
    expect(routes.has('accounts')).toBe(true)
    for (const to of routes) expect(to).toMatch(/^[a-z-]+$/)
  })

  it('person focus keeps only the person and their connected items', () => {
    const graph = buildHouseholdGraph(buildExampleCouple())
    const personId = buildExampleCouple().household.people[0]!.id
    const vm = buildMapViewModel(graph, { focusPersonId: personId })
    expect(vm.nodes.some((n) => n.id === `person:${personId}`)).toBe(true)
    expect(vm.nodes.length).toBeLessThan(graph.nodes.length)
    // Every remaining edge still connects two visible nodes.
    const ids = new Set(vm.nodes.map((n) => n.id))
    for (const e of vm.edges) {
      expect(ids.has(e.from)).toBe(true)
      expect(ids.has(e.to)).toBe(true)
    }
  })

  it('column filters drop groups but always keep people', () => {
    const graph = buildHouseholdGraph(buildExampleCouple())
    const vm = buildMapViewModel(graph, { visibleColumns: [] })
    expect(vm.nodes.length).toBeGreaterThan(0)
    expect(vm.nodes.every((n) => n.kind === 'person' || n.kind === 'formerSpouse')).toBe(true)
  })

  it('positions and edge paths are finite and inside the canvas', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()))
    for (const n of vm.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.x + n.w).toBeLessThanOrEqual(vm.width)
      expect(n.y + n.h).toBeLessThanOrEqual(vm.height)
    }
    for (const e of vm.edges) expect(e.path).toMatch(/^M [\d.-]+ [\d.-]+ C /)
  })

  it('aria labels carry the full name (long names are truncated only visually)', () => {
    const plan = buildExampleCouple()
    const longName = 'Extremely Long Brokerage Account Name That Will Not Fit On A Card'
    plan.accounts[0]!.name = longName
    const vm = buildMapViewModel(buildHouseholdGraph(plan))
    const node = vm.nodes.find((n) => n.label === longName)!
    expect(node.ariaLabel).toContain(longName)
  })

  it('hidden amounts are announced, not silently dropped', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()), { hideAmounts: true })
    const moneyNode = vm.nodes.find((n) => n.id.startsWith('acct:'))!
    expect(moneyNode.ariaLabel).toContain('amount hidden')
  })
})
