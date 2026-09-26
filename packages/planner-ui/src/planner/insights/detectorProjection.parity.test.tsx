/** @vitest-environment jsdom */
/**
 * B2-P1 slice 1 parity: the Insights page builds its detector context with
 * the engine's `detectorProjection(result, summary)`, whose `deflate` divides
 * by the run's own published inflation factor, instead of the planner's
 * retired `inflationView` closure.
 *
 * On every example plan the cards are the ones the retired closure produced:
 * the same cards in the same order, every string equal, every number equal
 * to within a relative 1e-12 (exactly equal for the widows-penalty card,
 * which reads no today's-dollar figure). And the page renders exactly the
 * cards `detectorProjection` produces.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { runScreen } from '@retiregolden/engine/insights/runInsights'
import type { InsightCard } from '@retiregolden/engine/insights/types'
import { packForYear } from '@retiregolden/engine/params'
import { projectPlan } from '../../projection'
import { EXAMPLE_PLANS, getExampleById } from '../examples/registry'
import { PlanCtx } from '../planContextCore'
import { InsightsPage } from './InsightsPage'

const START_YEAR = 2026

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

function cardsBoth(plan: Plan): { engine: InsightCard[]; retired: InsightCard[] } {
  const view = projectPlan(plan, START_YEAR)
  const params = packForYear(START_YEAR).pack
  const engine = runScreen({ plan, projection: detectorProjection(view.result, view.summary), params })
  const rate = 1 + plan.assumptions.inflationPct / 100
  const retired = runScreen({
    plan,
    projection: {
      result: view.result,
      summary: view.summary,
      startYear: START_YEAR,
      // The retired planner closure (projection.ts inflationView before slice 1).
      deflate: (year, amount) => amount / Math.pow(rate, year - START_YEAR),
    },
    params,
  })
  return { engine, retired }
}

/** Paths where two card trees differ: strings and shapes exactly, numbers within `tolerance` relative. */
function differences(a: unknown, b: unknown, tolerance: number, path = ''): string[] {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b || (Number.isNaN(a) && Number.isNaN(b))) return []
    const gap = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))
    return gap <= tolerance ? [] : [`${path}: ${a} vs ${b}`]
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [`${path}: length ${a.length} vs ${b.length}`]
    return a.flatMap((item, i) => differences(item, b[i], tolerance, `${path}[${i}]`))
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    return keys.flatMap((key) =>
      differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], tolerance, `${path}.${key}`),
    )
  }
  return Object.is(a, b) ? [] : [`${path}: ${String(a)} vs ${String(b)}`]
}

describe('detectorProjection gives the cards the retired closure gave', () => {
  it.each(EXAMPLE_PLANS.map((example) => [example.id, example] as const))('%s', (_id, example) => {
    const { engine, retired } = cardsBoth(example.build())
    expect(engine.map((card) => card.id)).toEqual(retired.map((card) => card.id))
    engine.forEach((card, i) => {
      const tolerance = card.id === 'widows-penalty-roth' ? 0 : 1e-12
      expect(differences(card, retired[i], tolerance, card.id)).toEqual([])
    })
  })
})

describe('the Insights page renders the detectorProjection cards', () => {
  it('example-couple', async () => {
    localStorage.clear()
    const plan = getExampleById('example-couple')!.build()
    const { engine } = cardsBoth(plan)
    expect(engine.length).toBeGreaterThan(0)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(
          <MemoryRouter>
            <PlanCtx.Provider
              value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
            >
              <InsightsPage />
            </PlanCtx.Provider>
          </MemoryRouter>,
        )
      })
      const rendered = [...container.querySelectorAll('.insight-card')].map((card) => ({
        title: card.querySelector('.insight-card-title')?.textContent ?? '',
        rationale: card.querySelector('.insight-rationale')?.textContent ?? '',
      }))
      const sortKey = (card: { title: string }) => card.title
      expect([...rendered].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))).toEqual(
        engine
          .map((card) => ({ title: card.title, rationale: card.rationale }))
          .sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
      )
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})
