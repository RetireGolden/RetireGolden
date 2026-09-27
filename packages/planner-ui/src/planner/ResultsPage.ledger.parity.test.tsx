/** @vitest-environment jsdom */
/**
 * B2-P1 slice 1 parity, rendered: the Results year-by-year table prints the
 * engine's display figures (projection/yearFigures) through the engine's
 * dollar basis, in both dollar modes.
 *
 * - Tax is `taxAndPenalties(row)`.
 * - Upside is `upsideSpending(row)`, shown above $0.50.
 * - Tax-free gains room is `taxFreeGainsRoom(row)` (owner decision R2: the
 *   extra long-term gain that raises the year's federal income tax by $0),
 *   rounded down to the whole dollar in the page's dollars (never more room
 *   than the engine computed) and shown when that is at least $1, with a
 *   marker in a year that has an ACA premium credit (owner answer Q2).
 * - Layer miss shows when the required, target or upside shortfall
 *   (`upsideShortfall(row)`) is above $0.50, each part on its own gate.
 *
 * Every expected cell is computed here from an independent projection of the
 * same plan from 2026 and the engine functions. The retired gains-room sum
 * (`ltcgZeroHeadroom + capitalLossCarryforwardRemaining`) is kept as a
 * reference to show what the fix changed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { nominalForDisplay, type DollarMode } from '@retiregolden/engine/projection/dollarBasis'
import type { YearResult } from '@retiregolden/engine/projection/types'
import {
  premiumTaxCreditOnProjectedIncomeTax,
  premiumTaxCreditYear,
  taxAndPenalties,
  taxFreeGainsRoom,
  upsideShortfall,
  upsideSpending,
} from '@retiregolden/engine/projection/yearFigures'
import {
  cashAccount,
  recurringOrdinaryIncome,
  singlePersonPlan,
  socialSecurityIncome,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'
import { projectPlan } from '../projection'
import { chooseDollars, mountPlanPage, yearTable } from '../testSupport/resultsPageMount'
import { getExampleById } from './examples/registry'
import { fmtMoney } from './format'
import { ResultsPage, YearByYearLedger } from './ResultsPage'

vi.mock('./useMcSuccessRate', () => ({
  useMcSuccessRateState: () => ({ rate: null, status: 'running', pathCount: 1_000 }),
}))

const START_YEAR = 2026
const MODES: readonly DollarMode[] = ['today', 'nominal']

const ACA_MARKER_TEXT =
  'This year has an ACA premium credit. Realizing gains this year can also shrink the credit; if it was paid in advance, the part you lose is paid back as federal tax when you file. The room does not include that.'

const ACA_MARKER_TEXT_2027 =
  ACA_MARKER_TEXT +
  ' The 2027 credit uses the published 2027 Marketplace figures; your 2027 income uses projected 2027 tax brackets, because the 2027 brackets are not published yet.'

const GAINS_ROOM_COPY =
  "Extra long-term gains you could realize this year without raising this year's federal income tax. Your remaining loss carryforward absorbs gains first. After that, gains count only while they add no federal tax: they stay in the 0% bracket and do not make more of your Social Security taxable, use up a loss deduction your other income was using, shrink a deduction, or reach the 3.8% net investment income tax or the AMT. State tax, the ACA premium credit, and Medicare premiums are not included. The figure is rounded down to the dollar."

beforeAll(() => {
  // The page projects from the calendar year; pin it so the table starts in 2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

/** The retired gains-room cell (ResultsPage before slice 1), kept only as the reference. */
function retiredGainsRoomText(y: YearResult, adj: (year: number, v: number) => number): string {
  const sum = y.ltcgZeroHeadroom + y.capitalLossCarryforwardRemaining
  return sum > 0.5 ? fmtMoney(adj(y.year, sum)) : ''
}

/** The engine's room as the cell prints it: rounded down to the whole dollar in the page's dollars, blank under $1. */
function roomText(room: number | null, year: number, adj: (year: number, v: number) => number): string {
  if (room === null) return ''
  const shown = Math.floor(adj(year, room))
  return shown >= 1 ? fmtMoney(shown) : ''
}

/** The gains-room cell's figure, without the ACA marker that may follow it. */
function gainsRoomFigure(cell: HTMLTableCellElement): string {
  const text = cell.textContent ?? ''
  const marker = cell.querySelector('.gains-room-aca-marker')?.textContent ?? ''
  return text.slice(0, text.length - marker.length)
}

async function checkLedgerCells(plan: Plan): Promise<string[]> {
  const view = projectPlan(plan, START_YEAR)
  const page = await mountPlanPage(plan, <ResultsPage />)
  const mismatches: string[] = []
  try {
    for (const mode of MODES) {
      await chooseDollars(page.container, mode)
      const table = yearTable(page.container)
      const adj = (year: number, v: number) => nominalForDisplay(view.basis, mode, year, v)
      const layered = table.headers.includes('Layer miss')
      expect(table.years).toEqual(view.result.years.map((y) => y.year))
      for (const y of view.result.years) {
        const at = `${mode} ${y.year}`
        const tax = fmtMoney(adj(y.year, taxAndPenalties(y)))
        if (table.cell(y.year, 'Tax').textContent !== tax) mismatches.push(`${at} Tax ${table.cell(y.year, 'Tax').textContent} vs ${tax}`)

        const expectedRoom = roomText(taxFreeGainsRoom(y), y.year, adj)
        const roomCell = table.cell(y.year, 'Tax-free gains room')
        if (gainsRoomFigure(roomCell) !== expectedRoom) mismatches.push(`${at} room ${gainsRoomFigure(roomCell)} vs ${expectedRoom}`)
        const hasMarker = roomCell.querySelector('.gains-room-aca-marker') !== null
        if (hasMarker !== premiumTaxCreditYear(y)) mismatches.push(`${at} ACA marker ${hasMarker}`)

        if (layered) {
          const upside = upsideSpending(y)
          const upsideText = upside > 0.5 ? fmtMoney(adj(y.year, upside)) : ''
          if (table.cell(y.year, 'Upside').textContent !== upsideText) mismatches.push(`${at} Upside`)
          const miss = upsideShortfall(y)
          const missText =
            y.requiredShortfall > 0.5 || y.targetShortfall > 0.5 || miss > 0.5
              ? `${y.requiredShortfall > 0.5 ? `Req ${fmtMoney(adj(y.year, y.requiredShortfall))} ` : ''}${
                  y.targetShortfall > 0.5 ? `Target ${fmtMoney(adj(y.year, y.targetShortfall))} ` : ''
                }${miss > 0.5 ? `Upside ${fmtMoney(adj(y.year, miss))}` : ''}`
              : ''
          if (table.cell(y.year, 'Layer miss').textContent !== missText) mismatches.push(`${at} Layer miss`)
        }
      }
    }
  } finally {
    await page.unmount()
  }
  return mismatches
}

describe('Results table cells are the engine figures, both dollar modes', () => {
  it.each(['all-401k-no-bridge', 'guardrails-flex-goals', 'example-couple', 'glidepath-allocation'])(
    '%s',
    async (id) => {
      const plan = getExampleById(id)!.build()
      expect(await checkLedgerCells(plan)).toEqual([])
    },
    60_000,
  )

  it('guardrails-flex-goals carries the layered columns, so Upside and Layer miss are exercised', async () => {
    const plan = getExampleById('guardrails-flex-goals')!.build()
    const view = projectPlan(plan, START_YEAR)
    expect(view.result.years.some((y) => upsideSpending(y) > 0.5)).toBe(true)
    expect(view.result.years.some((y) => upsideShortfall(y) > 0.5)).toBe(true)
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      expect(yearTable(page.container).headers).toEqual(expect.arrayContaining(['Upside', 'Layer miss']))
    } finally {
      await page.unmount()
    }
  })

  it('all-401k-no-bridge: the column now prints the exact room where the retired sum overstated it', async () => {
    const plan = getExampleById('all-401k-no-bridge')!.build()
    const view = projectPlan(plan, START_YEAR)
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      await chooseDollars(page.container, 'nominal')
      const table = yearTable(page.container)
      const identity = (_year: number, v: number) => v
      const changed = view.result.years.filter(
        (y) => gainsRoomFigure(table.cell(y.year, 'Tax-free gains room')) !== retiredGainsRoomText(y, identity),
      )
      // The largest change in the example library (README of the slice): the
      // Social Security taxation the 0% band room does not price.
      expect(changed.length).toBeGreaterThan(0)
      const y2078 = view.result.years.find((y) => y.year === 2078)!
      // 87,619.53, rounded down to the dollar.
      expect(gainsRoomFigure(table.cell(2078, 'Tax-free gains room'))).toBe('$87,619')
      expect(retiredGainsRoomText(y2078, identity)).toBe('$303,767')
    } finally {
      await page.unmount()
    }
  }, 60_000)
})

/**
 * The single-filer households of the engine's gains-room evidence: one
 * person, a zero-return $1,000 cash account, one uninflated recurring
 * ordinary income ("pension"), and the carryforward entering 2026.
 */
function household(opts: { dob: string; pension: number; carryforward?: number; socialSecurity?: boolean }): Plan {
  const plan = singlePersonPlan({ dob: opts.dob, planningAge: 95 })
  plan.accounts = [cashAccount('cash', 1_000)]
  plan.incomes = [recurringOrdinaryIncome('pension', opts.pension)]
  if (opts.socialSecurity === true) {
    // PIA $2,500 a month, claimed at full retirement age, 66 years 10 months.
    const benefit = socialSecurityIncome('ss', 2_500, 66)
    if (benefit.type === 'socialSecurity') benefit.claimAge = { years: 66, months: 10 }
    plan.incomes.push(benefit)
  }
  if (opts.carryforward !== undefined) plan.household.capitalLossCarryforward = opts.carryforward
  return validatePlan(plan)
}

describe('constructed households: the 2026 gains-room cell (engine evidence A, D, E)', () => {
  const cases = [
    // A: the carryforward's first $7,000 is free; past it each dollar removes a
    // dollar of the $3,000 loss deduction at 12%. The retired sum read $35,550.
    { name: 'A', plan: () => household({ dob: '1963-01-01', pension: 40_000, carryforward: 10_000 }), shown: '$7,000', retired: '$35,550' },
    // D: $10,000 of pension and $30,000 of Social Security; past $20,352.94 each
    // gain dollar makes 85 cents of benefits taxable, so the cell rounds down
    // to $20,352 (rounding to $20,353 would show room that costs tax). The
    // retired sum read $38,100.
    { name: 'D', plan: () => household({ dob: '1959-06-15', pension: 10_000, socialSecurity: true }), shown: '$20,352', retired: '$38,100' },
    // E: no carryforward, no benefits: the room is the 0% band room either way.
    { name: 'E', plan: () => household({ dob: '1963-01-01', pension: 40_000 }), shown: '$25,550', retired: '$25,550' },
  ]

  it.each(cases)('household $name shows $shown (retired sum $retired), both modes', async ({ plan: build, shown, retired }) => {
    const plan = build()
    const view = projectPlan(plan, START_YEAR)
    const row = view.result.years[0]!
    expect(row.year).toBe(2026)
    expect(roomText(taxFreeGainsRoom(row), row.year, (_year, v) => v)).toBe(shown)
    expect(retiredGainsRoomText(row, (_year, v) => v)).toBe(retired)
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      for (const mode of MODES) {
        await chooseDollars(page.container, mode)
        // 2026 is the start year: its factor is exactly 1 in both modes.
        expect(gainsRoomFigure(yearTable(page.container).cell(2026, 'Tax-free gains room'))).toBe(shown)
      }
    } finally {
      await page.unmount()
    }
  })

  it('the engine room for D is the exact root 9,000 + 9,650 / 0.85 to the cent', () => {
    const row = projectPlan(household({ dob: '1959-06-15', pension: 10_000, socialSecurity: true }), START_YEAR).result.years[0]!
    const exact = 9_000 + 9_650 / 0.85
    const room = taxFreeGainsRoom(row)!
    expect(room).toBeGreaterThanOrEqual(exact - 0.01)
    expect(room).toBeLessThanOrEqual(exact + 1e-4)
  })
})

describe('the gains room is rounded down, never up', () => {
  it('prints $7,000 for 7,000.99 and nothing for 0.99 of room', async () => {
    const plan = validatePlan(singlePersonPlan({ dob: '1956-01-01', planningAge: 95 }))
    const view = projectPlan(household({ dob: '1963-01-01', pension: 40_000, carryforward: 10_000 }), START_YEAR)
    const year = view.result.years[0]!
    const years = [year, { ...year, year: 2027 }]
    const figures = years.map((y, index) => ({
      year: y.year,
      taxAndPenalties: taxAndPenalties(y),
      spendingWithTaxAndPenalties: 0,
      netCareCost: 0,
      upsideSpending: 0,
      upsideShortfall: 0,
      capitalLossCarryforwardUsed: 0,
      taxFreeGainsRoom: index === 0 ? 7_000.99 : 0.99,
      premiumTaxCreditYear: false,
      premiumTaxCreditOnProjectedIncomeTax: false,
      balancesByCategory: { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 },
      unassignedCash: 0,
    }))
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={['/plan/p/results']}>
            <YearByYearLedger
              plan={plan}
              years={years}
              adj={(_year, v) => v}
              dollars="nominal"
              dollarLabel="nominal $"
              hasLayeredSpending={false}
              hasAmt={false}
              hasCarryforward={false}
              figures={figures}
            />
          </MemoryRouter>,
        )
      })
      const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent?.trim())
      const column = headers.indexOf('Tax-free gains room')
      const cellOf = (index: number) => container.querySelectorAll('tbody tr')[index]!.querySelectorAll('td')[column]!.textContent
      // fmtMoney alone would print $7,001: more room than the engine found.
      expect(fmtMoney(7_000.99)).toBe('$7,001')
      expect(cellOf(0)).toBe('$7,000')
      expect(cellOf(1)).toBe('')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})

describe('Layer miss gates on each engine figure, not on the sum of four shortfalls', () => {
  function syntheticYear(year: number, shortfalls: { required: number; target: number; ideal: number; excess: number }): YearResult {
    return {
      year,
      people: [{ personId: 'p1', ageAttained: 70, alive: true }],
      filingStatus: 'single',
      incomes: {
        wages: 0, socialSecurity: 0, pension: 0, annuity: 0, tipsLadder: 0, recurring: 0, oneTime: 0,
        taxableInterest: 0, taxExemptInterest: 0, ordinaryDividends: 0, qualifiedDividends: 0, taxableYield: 0, total: 0,
      },
      expenses: {
        baseSpending: 40_000, healthcare: 0, propertyCosts: 0, debtService: 0, insurancePremiums: 0, careCost: 0,
        ltcBenefit: 0, oneTimeGoals: 0, requiredSpending: 30_000, targetSpending: 40_000, idealSpending: 0,
        excessSpending: 0, intendedSpending: 40_000, total: 40_000, guardrailFactor: 1,
      },
      contributions: 0, employerMatch: 0, rmd: 0, sepp: 0, inheritedDistribution: 0, inheritedTraditionalDistribution: 0,
      inheritedAccounts: [], qcd: 0, rothConversion: 0, tax: 0, amt: 0, penalties: 0, magi: 0,
      withdrawals: { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
      realizedGains: 0, capitalLossUsedAgainstGains: 0, capitalLossUsedAgainstOrdinary: 0,
      capitalLossCarryforwardRemaining: 0, ltcgZeroHeadroom: 0,
      shortfall: shortfalls.required + shortfalls.target + shortfalls.ideal + shortfalls.excess,
      requiredShortfall: shortfalls.required,
      targetShortfall: shortfalls.target,
      idealShortfall: shortfalls.ideal,
      excessShortfall: shortfalls.excess,
      guardrailAction: 'hold',
      flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
      balances: {}, investableTotal: 100_000, insuranceCashValue: 0, ladderValue: 0, deathBenefit: 0, netWorth: 100_000,
    } as unknown as YearResult // Only the fields the table reads.
  }

  it('required 0.30, ideal 0.20, excess 0.25 renders an empty cell; ideal 0.30 plus excess 0.30 renders Upside $1', async () => {
    const plan = validatePlan(singlePersonPlan({ dob: '1956-01-01', planningAge: 95 }))
    const years = [
      syntheticYear(2030, { required: 0.3, target: 0, ideal: 0.2, excess: 0.25 }),
      syntheticYear(2031, { required: 0, target: 0, ideal: 0.3, excess: 0.3 }),
    ]
    // The retired gate summed all four (0.75 > 0.5) and then printed nothing;
    // every part is under its own gate, so the engine gates print nothing too.
    expect(upsideShortfall(years[0]!)).toBe(0.45)
    expect(upsideShortfall(years[1]!)).toBe(0.6)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={['/plan/p/results']}>
            <YearByYearLedger
              plan={plan}
              years={years}
              adj={(_year, v) => v}
              dollars="nominal"
              dollarLabel="nominal $"
              hasLayeredSpending={true}
              hasAmt={false}
              hasCarryforward={false}
            />
          </MemoryRouter>,
        )
      })
      const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent?.trim())
      const column = headers.indexOf('Layer miss')
      const cellOf = (year: number) =>
        [...container.querySelectorAll('tbody tr')]
          .find((tr) => tr.querySelector('td')?.textContent === String(year))!
          .querySelectorAll('td')[column]!.textContent
      expect(cellOf(2030)).toBe('')
      expect(cellOf(2031)).toBe('Upside $1')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})

describe('the ACA premium credit marker and the column copy', () => {
  it('early-retiree-aca: the 2026 and 2027 credit years carry the marker, 2027 says its income uses projected brackets, and the explainer says what it means', async () => {
    // 2027 is priced on Rev. Proc. 2026-26 and the HHS 2026 guidelines while
    // the 2027 income-tax figures are a stand-in (decision D-ACA-2027-TABLE),
    // so its marker carries the engine's income-tax-parameters-projected note.
    const plan = getExampleById('early-retiree-aca')!.build()
    const view = projectPlan(plan, START_YEAR)
    const creditYears = view.result.years.filter((y) => premiumTaxCreditYear(y)).map((y) => y.year)
    expect(creditYears).toEqual([2026, 2027])
    const projectedYears = view.result.years
      .filter((y) => premiumTaxCreditOnProjectedIncomeTax(y))
      .map((y) => y.year)
    expect(projectedYears).toEqual([2027])
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      const table = yearTable(page.container)
      for (const y of view.result.years) {
        const marker = table.cell(y.year, 'Tax-free gains room').querySelector<HTMLElement>('.gains-room-aca-marker')
        if (y.year === 2026 || y.year === 2027) {
          const text = y.year === 2026 ? ACA_MARKER_TEXT : ACA_MARKER_TEXT_2027
          expect(marker, `${y.year} marker`).not.toBeNull()
          expect(marker!.getAttribute('title')).toBe(text)
          expect(marker!.querySelector('[aria-hidden="true"]')?.textContent).toBe('†')
          expect(marker!.querySelector('.sr-only')?.textContent).toBe(text)
        } else {
          expect(marker, `${y.year} marker`).toBeNull()
        }
      }
      const explainer = [...page.container.querySelectorAll('#year-table .ss-explainer li')].map((li) => li.textContent ?? '')
      expect(explainer).toContain(
        "† beside the gains room marks a year with an ACA premium credit. Realizing gains that year can also shrink the credit; if it was paid in advance, the part you lose is paid back as federal tax when you file. The room does not include that. In 2027 the credit uses that year's published Marketplace figures, while the income it is measured on uses projected tax brackets.",
      )
    } finally {
      await page.unmount()
    }
  })

  it('example-couple: no credit year, so no marker and no explainer line', async () => {
    const plan = getExampleById('example-couple')!.build()
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      expect(page.container.querySelector('.gains-room-aca-marker')).toBeNull()
      const explainer = [...page.container.querySelectorAll('#year-table .ss-explainer li')].map((li) => li.textContent ?? '')
      expect(explainer.some((line) => line.startsWith('†'))).toBe(false)
    } finally {
      await page.unmount()
    }
  })

  it('the header tooltip and the explainer say what the room is, and how it differs from the 0% bracket room', async () => {
    const plan = getExampleById('example-couple')!.build()
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      const header = [...page.container.querySelectorAll('#year-table thead th')].find(
        (th) => th.textContent === 'Tax-free gains room',
      )
      expect(header?.getAttribute('title')).toBe(GAINS_ROOM_COPY)
      const line = [...page.container.querySelectorAll('#year-table .ss-explainer li')]
        .map((li) => li.textContent ?? '')
        .find((text) => text.startsWith('Tax-free gains room'))
      expect(line).toBe(
        `Tax-free gains room: ${GAINS_ROOM_COPY} The room left in the 0% long-term bracket can be larger than this figure, because gains in that bracket can still raise tax in the ways above; this column is the room at no extra federal tax.`,
      )
      for (const text of [GAINS_ROOM_COPY, ACA_MARKER_TEXT, line!]) {
        expect(text).not.toMatch(/[—–]/)
        expect(text.toLowerCase()).not.toMatch(/\byou should\b/)
      }
    } finally {
      await page.unmount()
    }
  })
})
