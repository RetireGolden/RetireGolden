/**
 * Reconciliation: the HouseholdGraph's per-node amounts and entered-value
 * totals must agree exactly with the report model's accounts block (the
 * existing plan selector for stored account figures), and every income
 * stream must appear in the graph exactly once — across the whole example
 * library, so every schema feature the examples exercise is covered.
 */

import { describe, expect, it } from 'vitest'

import { accountNodeId, buildHouseholdGraph, incomeNodeId } from '@retiregolden/engine/household/householdGraph'
import { EXAMPLE_PLANS } from '../planner/examples/registry'
import { projectPlan } from '../planner/useProjection'
import { buildReportModel } from '../report/reportModel'

const INVESTABLE = new Set(['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'])

describe('household graph ⇄ report model reconciliation', () => {
  for (const example of EXAMPLE_PLANS) {
    it(`${example.id}: graph amounts and totals match the report accounts block`, () => {
      const plan = example.build()
      const graph = buildHouseholdGraph(plan)
      const { result, summary, startYear } = projectPlan(plan, 2026)
      const report = buildReportModel({ plan, result, summary, startYear, generatedAtIso: '2026-01-01T00:00:00.000Z' })
      const rows = report.blocks.accounts.rows

      // Every plan account appears in both, once, under the same id.
      expect(rows).toHaveLength(plan.accounts.length)
      for (const row of rows) {
        const node = graph.nodes.find((n) => n.id === accountNodeId(row.id))
        expect(node, `graph node for account ${row.id}`).toBeDefined()
        // The report's balance figure (balance / property value; 0 for
        // pension/annuity) must equal the graph's stored amount for the same
        // kinds. Pension/annuity carry their monthly benefit instead, which
        // the report model deliberately reports as 0 — assert that split.
        if (row.type === 'pension' || row.type === 'annuity') {
          expect(row.balance).toBe(0)
          expect(node!.amountKind).toBe('monthlyBenefit')
        } else {
          expect(node!.amount).toBe(row.balance)
        }
      }

      // Totals reconcile exactly: investable + property = the report's
      // non-debt, non-pension/annuity balances; liabilities = its debt rows.
      const reportAssets = rows
        .filter((r) => INVESTABLE.has(r.type) || r.type === 'property')
        .reduce((sum, r) => sum + r.balance, 0)
      const reportInvestable = rows.filter((r) => INVESTABLE.has(r.type)).reduce((sum, r) => sum + r.balance, 0)
      const reportLiabilities = rows.filter((r) => r.type === 'debt').reduce((sum, r) => sum + r.balance, 0)
      expect(graph.totals.assets).toBe(reportAssets)
      expect(graph.totals.investable).toBe(reportInvestable)
      expect(graph.totals.property).toBe(reportAssets - reportInvestable)
      expect(graph.totals.liabilities).toBe(reportLiabilities)
      expect(graph.totals.netWorth).toBe(reportAssets - reportLiabilities)
    })

    it(`${example.id}: every income stream appears in the graph exactly once`, () => {
      const plan = example.build()
      const graph = buildHouseholdGraph(plan)
      const incomeNodeIds = graph.nodes.filter((n) => n.kind === 'income').map((n) => n.id)
      expect(incomeNodeIds.sort()).toEqual(plan.incomes.map((s) => incomeNodeId(s.id)).sort())
      // And each is reachable from a person (or household-level with 2 edges).
      for (const id of incomeNodeIds) {
        expect(graph.edges.some((e) => e.kind === 'receives' && e.to === id)).toBe(true)
      }
    })
  }
})
