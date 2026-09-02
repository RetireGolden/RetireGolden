/** @vitest-environment jsdom */
/**
 * Results year table (#483): the Contributions, Employer match, and Shortfall
 * cells print a formatted $0 at zero instead of going blank. Rendered DOM,
 * not a source pin: a zero row and a non-zero row side by side, with the
 * columns located by their header text.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'
import { singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'

import { YearByYearLedger } from './ResultsPage'

function yearOf(year: number, cells: { contributions: number; employerMatch: number; shortfall: number }): YearResult {
  return {
    year,
    people: [{ personId: 'p1', ageAttained: 61, alive: true }],
    filingStatus: 'single',
    incomes: {
      wages: 100_100,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 0,
      taxExemptInterest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      taxableYield: 0,
      total: 100_100,
    },
    expenses: {
      baseSpending: 90_000,
      healthcare: 0,
      propertyCosts: 0,
      debtService: 0,
      insurancePremiums: 0,
      careCost: 0,
      ltcBenefit: 0,
      oneTimeGoals: 0,
      requiredSpending: 90_000,
      targetSpending: 90_000,
      idealSpending: 0,
      excessSpending: 0,
      intendedSpending: 90_000,
      total: 90_000,
      guardrailFactor: 1,
    },
    contributions: cells.contributions,
    employerMatch: cells.employerMatch,
    rmd: 0,
    sepp: 0,
    inheritedDistribution: 0,
    inheritedTraditionalDistribution: 0,
    inheritedAccounts: [],
    qcd: 0,
    rothConversion: 0,
    tax: 0,
    amt: 0,
    penalties: 0,
    magi: 0,
    withdrawals: { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
    realizedGains: 0,
    capitalLossUsedAgainstGains: 0,
    capitalLossUsedAgainstOrdinary: 0,
    capitalLossCarryforwardRemaining: 0,
    ltcgZeroHeadroom: 0,
    shortfall: cells.shortfall,
    requiredShortfall: 0,
    targetShortfall: 0,
    idealShortfall: 0,
    excessShortfall: 0,
    guardrailAction: 'hold',
    flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
    balances: {},
    investableTotal: 400_000,
    insuranceCashValue: 0,
    ladderValue: 0,
    deathBenefit: 0,
    netWorth: 400_000,
  } as unknown as YearResult
}

function testPlan(): Plan {
  return validatePlan(singlePersonPlan({ dob: '1965-06-15', planningAge: 95, retirementAge: null }))
}

describe('Results year table zero cells (#483)', () => {
  let container: HTMLDivElement
  let root: Root

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('prints $0 for zero contributions, match, and shortfall, and real values otherwise', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const years = [
      yearOf(2030, { contributions: 0, employerMatch: 0, shortfall: 0 }),
      yearOf(2031, { contributions: 5_000, employerMatch: 1_500, shortfall: 2_000 }),
    ]
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/plan/p/results']}>
          <YearByYearLedger
            plan={testPlan()}
            years={years}
            adj={(_year, v) => v}
            dollars="nominal"
            dollarLabel="nominal $"
            hasLayeredSpending={false}
            hasAmt={false}
            hasCarryforward={false}
          />
        </MemoryRouter>,
      )
    })

    const table = container.querySelector('table.year-table')!
    expect(table).not.toBeNull()
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim())
    const col = (label: string) => {
      const index = headers.indexOf(label)
      expect(index, `column ${label} exists`).toBeGreaterThan(0)
      return index
    }
    const cellsOf = (year: number) => {
      const row = [...table.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('td')?.textContent === String(year))!
      expect(row, `row ${year}`).toBeDefined()
      const tds = [...row.querySelectorAll('td')]
      return {
        contributions: tds[col('Contrib.')]!.textContent,
        employerMatch: tds[col('Match')]!.textContent,
        shortfall: tds[col('Shortfall')]!.textContent,
      }
    }
    // Zero prints as a value, never as an empty cell (the old `> 0.005 ? … : ''`).
    expect(cellsOf(2030)).toEqual({ contributions: '$0', employerMatch: '$0', shortfall: '$0' })
    expect(cellsOf(2031)).toEqual({ contributions: '$5,000', employerMatch: '$1,500', shortfall: '$2,000' })
  })
})
