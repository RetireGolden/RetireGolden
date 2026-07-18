import { describe, expect, it } from 'vitest'

import { buildHouseholdGraph } from './householdGraph'
import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { couplePlan, socialSecurityIncome, taxableAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
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

  it('privacy-hide keeps has-amount identity so placeholders land only on real amounts', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()), { hideAmounts: true })
    const person = vm.nodes.find((n) => n.kind === 'person')!
    const account = vm.nodes.find((n) => n.kind === 'account')!
    expect(person.hasAmount).toBe(false)
    expect(account.hasAmount).toBe(true)
    expect(person.amountText).toBeNull()
    expect(account.amountText).toBeNull()
  })

  it('phrases every relationship for the text list, including joint annotations', () => {
    const vm = buildMapViewModel(buildHouseholdGraph(buildExampleCouple()))
    const brokerage = vm.nodes.find((n) => n.label === 'Joint brokerage')!
    expect(brokerage.relations).toContain('Owned by Alex (joint)')
    expect(brokerage.relations).toContain('Owned by Sam (joint)')
    const alex = vm.nodes.find((n) => n.label === 'Alex')!
    expect(alex.relations.some((r) => r.startsWith('Owns Joint brokerage'))).toBe(true)
    expect(alex.relations.some((r) => r.startsWith('Receives Wages — Alex'))).toBe(true)
    expect(alex.relations.some((r) => r.startsWith('Covered by Alex whole life'))).toBe(true)
    // Every edge is phrased on both endpoints — topology never lives only in the SVG.
    for (const e of vm.edges) {
      const from = vm.nodes.find((n) => n.id === e.from)!
      const to = vm.nodes.find((n) => n.id === e.to)!
      expect(from.relations.length).toBeGreaterThan(0)
      expect(to.relations.length).toBeGreaterThan(0)
    }
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

  it('person focus never pulls in the other member’s own items through joint nodes', () => {
    const plan = buildExampleCouple()
    const alexId = plan.household.people[0]!.id
    const vm = buildMapViewModel(buildHouseholdGraph(plan), { focusPersonId: alexId })
    const labels = vm.nodes.map((n) => n.label)
    // Jointly held items stay visible…
    expect(labels).toContain('Joint brokerage')
    expect(labels).toContain('Home')
    // …but Sam and every individually-owned Sam item must be absent.
    for (const samOnly of ['Sam', 'Sam IRA', 'Wages — Sam', 'Social Security — Sam', 'Sam LTC']) {
      expect(labels).not.toContain(samOnly)
    }
  })

  it('focused output is independent of plan entry order (attachment fixpoint)', () => {
    const fundedAnnuityPlan = (annuityFirst: boolean): Plan => {
      const plan = couplePlan()
      const brokerage = { ...taxableAccount('brok', 300_000, 200_000), ownerPersonId: 'p1' }
      const annuity: Account = {
        type: 'annuity',
        id: 'spia',
        name: 'SPIA',
        ownerPersonId: 'p2',
        annualReturnPct: null,
        startAge: 70,
        monthlyAmount: 900,
        colaPct: 0,
        taxablePct: 60,
        payoutForm: { kind: 'jointSurvivor', survivorPct: 50 },
        purchase: { year: 2030, premium: 100_000, fundingAccountId: 'brok', taxQualification: 'nonQualified' },
      }
      plan.accounts = annuityFirst ? [annuity, brokerage] : [brokerage, annuity]
      plan.incomes = [socialSecurityIncome('ss1', 2_000, 67, 'p1'), socialSecurityIncome('ss2', 1_500, 67, 'p2')]
      return validatePlan(plan)
    }
    const focused = (annuityFirst: boolean) =>
      new Set(
        buildMapViewModel(buildHouseholdGraph(fundedAnnuityPlan(annuityFirst)), { focusPersonId: 'p1' }).nodes.map(
          (n) => n.id,
        ),
      )
    const a = focused(true)
    const b = focused(false)
    expect([...a].sort()).toEqual([...b].sort())
    // The annuity is reached via the funds edge, and ITS attachment (the
    // survivor destination) must be kept in both orders.
    expect(a.has('acct:spia')).toBe(true)
    expect(a.has('estate:spouse')).toBe(true)
    // The funded annuity's owner is still not pulled in.
    expect(a.has('person:p2')).toBe(false)
    expect(a.has('inc:ss2')).toBe(false)
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
