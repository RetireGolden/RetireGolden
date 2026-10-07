/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 parity for conversion schedule totals: every total the
 * Optimize page, the promotion note, the Strategy callout and the assumptions
 * export print is the engine's one sum (strategies/conversionScheduleTotal.ts,
 * published as OptimizedSchedule.conversionTotal and
 * ExactLedgerTournament.winnerConversionTotal), and on the example library it
 * is the retired left-to-right reduce (kept here) bit for bit.
 *
 * What changes on the page, asserted as a change:
 * - P2: on bridge-early-retirement and trump-account-head-start the
 *   execution-mismatch sentence printed "Cleaned executable schedule: $0" (the
 *   empty displayed list); it prints the cleaned schedule's own total.
 * - Correction 8: the same heroes no longer claim "only $X of $X could
 *   actually be converted"; they name the unpriced credit years as the cause.
 * - P3: a timed-out solve says so instead of "No beneficial conversions found",
 *   and the incumbent card no longer says a solver schedule was compared when
 *   the timed-out solve found none (review F8).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { conversionScheduleTotal } from '@retiregolden/engine/strategies/conversionScheduleTotal'
import type { OptimizeResult } from '../optimize/messages'
import { runOptimizeRequest } from '../optimize/runOptimize'
import { appExamplePlanById, appExamplePlans } from '../testSupport/appExamples'
import { buildAssumptionsSnapshot } from './assumptionsExport'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { fmtMoney } from './format'
import { displayedCleanedConversions } from './optimizePageChart'
import { PlanCtx, type PlanContextValue } from './planContextCore'

vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))

import { runOptimize } from '../optimize/runner'
import { OptimizePage } from './OptimizePage'

const mockedRunOptimize = vi.mocked(runOptimize)

/** Every copy the planner kept until B2-P1 slice 3 (seven of them) was this reduce. */
function retiredTotal(conversions: readonly { amount: number }[]): number {
  return conversions.reduce((sum, conversion) => sum + conversion.amount, 0)
}

const results = new Map<string, OptimizeResult>()
async function optimized(id: string): Promise<OptimizeResult> {
  const cached = results.get(id)
  if (cached !== undefined) return cached
  const result = await runOptimizeRequest({ plan: appExamplePlanById(id), startYear: EXAMPLE_FIXED_YEAR })
  results.set(id, result)
  return result
}

describe('conversion schedule totals on the example library (B2-P1 slice 3)', () => {
  it('publishes the raw, cleaned, displayed and winner totals the retired reduces printed, on every example', async () => {
    let checked = 0
    for (const { id } of appExamplePlans()) {
      const result = await optimized(id)
      const { schedule, postProcessed, tournament } = result
      expect(Object.is(schedule.conversionTotal, retiredTotal(schedule.conversions)), `${id} raw`).toBe(true)
      expect(Object.is(tournament.winnerConversionTotal, retiredTotal(tournament.winnerConversions)), `${id} winner`).toBe(true)
      const displayed = displayedCleanedConversions(tournament, postProcessed)
      expect(Object.is(conversionScheduleTotal(displayed), retiredTotal(displayed)), `${id} displayed`).toBe(true)
      if (postProcessed !== null) {
        const cleaned = postProcessed.cleanedSchedule
        expect(Object.is(cleaned.conversionTotal, retiredTotal(cleaned.conversions)), `${id} cleaned`).toBe(true)
        // The engine's requested totals are the same sum.
        expect(Object.is(postProcessed.rawValidation.requestedConversionTotal, schedule.conversionTotal), `${id} requested`).toBe(true)
        expect(Object.is(postProcessed.cleanedValidation.requestedConversionTotal, cleaned.conversionTotal), `${id} cleaned requested`).toBe(true)
      } else {
        // No raw conversion reaches a solve that did not post-process.
        expect(schedule.conversionTotal, `${id} raw without post-processing`).toBe(0)
      }
      checked += 1
    }
    expect(checked).toBe(appExamplePlans().length)
  }, 600_000)

  it('prints the Strategy callout and the assumptions export totals through the one sum', () => {
    const plan = appExamplePlanById('example-couple')
    const conversions = [
      { year: 2027, amount: 0.1 },
      { year: 2028, amount: 0.2 },
      { year: 2029, amount: 0.3 },
      { year: 2030, amount: 48_123.46 },
    ]
    const withSchedule: Plan = {
      ...plan,
      strategies: { ...plan.strategies, rothConversion: { mode: 'optimized', conversions, optimizedAtIso: '2026-06-29T12:00:00.000Z' } },
    }
    const snapshot = buildAssumptionsSnapshot(withSchedule, EXAMPLE_FIXED_YEAR)
    const row = snapshot.groups.flatMap((group) => group.rows).find((r) => r.id === 'roth-conversion')!
    expect(row.value).toBe(`optimized schedule (4 years, ${fmtMoney(retiredTotal(conversions))} total)`)
  })
})

describe('the Optimize page reads the published totals (B2-P1 slice 3)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  function contextFor(plan: Plan): PlanContextValue {
    return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  }

  async function mount(plan: Plan, result: OptimizeResult) {
    mockedRunOptimize.mockResolvedValue(result)
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <OptimizePage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    // Past the 300 ms auto-run debounce.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
  }

  for (const [id, cleanedPrinted] of [
    ['bridge-early-retirement', '$1,135,975'],
    // Was $4,053,361 before engine 0.4.1. The example is in Michigan and its
    // owner, born 2004, converts before 59 and a half; Michigan now counts a
    // conversion toward its retirement deduction only from 59 and a half
    // (mi-treasury-roth-conversion-at-59-and-a-half), so 2027's conversion
    // executes $13,180.74 where it executed $16,465.61. Nothing else moves.
    ['trump-account-head-start', '$4,050,076'],
  ] as const) {
    it(`${id}: the mismatch sentence prints the cleaned schedule's total, and the hero names the unpriced credit`, async () => {
      const plan = appExamplePlanById(id)
      const result = await optimized(id)
      await mount(plan, result)
      const text = container.textContent ?? ''
      // The retired sentence read the (empty) displayed list.
      const displayed = displayedCleanedConversions(result.tournament, result.postProcessed)
      expect(fmtMoney(retiredTotal(displayed))).toBe('$0')
      expect(text).toContain(`Cleaned executable schedule: ${cleanedPrinted}.`)
      expect(text).not.toContain('Cleaned executable schedule: $0.')
      expect(fmtMoney(result.postProcessed!.cleanedSchedule.conversionTotal)).toBe(cleanedPrinted)
      // Requested equals executed and no year fell short: the hero must not claim a shortfall.
      expect(result.postProcessed!.cleanedValidation.firstMateriallyUnexecutedYear).toBeNull()
      expect(text).not.toMatch(/only \$[\d,]+ could actually be converted/)
      expect(text).toContain('This conversion schedule is shown as a diagnostic.')
      expect(text).toContain("isn't priced in some of the plan's years, and conversion income changes that credit")
    }, 120_000)
  }

  it('a timed-out solve with no schedule says so instead of "No beneficial conversions found"', async () => {
    const plan = appExamplePlanById('rmd-irmaa')
    const base = await optimized('bracket-fill-roth')
    const timedOut = {
      ...base,
      schedule: { ...base.schedule, status: 'timeout', conversions: [], conversionTotal: 0, schedule: [] },
      postProcessed: null,
      tournament: {
        ...base.tournament,
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerConversionTotal: 0,
        winnerValidation: null,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: null,
        retirementActionPromotion: null,
      },
      claimAge: null,
    } as OptimizeResult
    await mount(plan, timedOut)
    const text = container.textContent ?? ''
    expect(text).toContain('The optimizer ran out of time')
    expect(text).toContain('does not show that no conversion helps: only the simple strategies were compared on your full projection.')
    expect(text).not.toContain('No beneficial conversions found')
  }, 120_000)

  it('an incumbent that holds after a timed-out solve with no schedule names only the simple strategies (review F8)', async () => {
    const plan = appExamplePlanById('example-couple')
    const base = await optimized('example-couple')
    expect(base.tournament.winnerSource).toBe('incumbent')
    const timedOut = {
      ...base,
      schedule: { ...base.schedule, status: 'timeout', conversions: [], conversionTotal: 0, schedule: [] },
      postProcessed: null,
    } as OptimizeResult
    await mount(plan, timedOut)
    const text = container.textContent ?? ''
    expect(text).toContain(`RetireGolden compared ${base.tournament.candidates.length} simple candidate strategies against your current plan`)
    expect(text).not.toContain('fresh solver schedule')
    expect(text).toContain('only the simple strategies were compared on your full projection.')

    // Without the timeout, the solver's schedule was compared and the card says so.
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount(plan, base)
    expect(container.textContent ?? '').toContain(
      `RetireGolden compared ${base.tournament.candidates.length} simple candidate strategies and a fresh solver schedule against your current plan`,
    )
  }, 120_000)
})
