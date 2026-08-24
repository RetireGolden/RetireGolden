/** @vitest-environment jsdom */
/**
 * WS3 Stage C — Results year-table cash-flow drill-down.
 * Mounts YearByYearLedger with synthetic YearResult rows (no live projection).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import { CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS } from '@retiregolden/engine/projection/annualCashFlowCapture'
import type {
  YearCashFlow,
  YearCashFlowReconciliation,
  YearResult,
} from '@retiregolden/engine/projection/types'
import { singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'

import { fmtMoney } from './format'
import { YearByYearLedger } from './ResultsPage'
import { useProjection } from './useProjection'

const personId = (id: string): PersonId => id as PersonId
const accountId = (id: string): AccountId => id as AccountId

function reconciled(): YearCashFlowReconciliation {
  return {
    status: 'reconciled',
    tolerancePlanDollars: 1e-6,
    cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
    cash: {
      spendableSourcesPlanDollars: 99_700,
      portfolioFundingPlanDollars: 400,
      loanProceedsPlanDollars: 0,
      sourceTotalPlanDollars: 100_100,
      fundedHouseholdUsesPlanDollars: 90_000,
      settledTaxPlanDollars: 0,
      penaltiesPlanDollars: 0,
      contributionsPlanDollars: 0,
      surplusInvestmentPlanDollars: 10_100,
      destinationTotalPlanDollars: 100_100,
      differencePlanDollars: 0,
    },
    uses: {
      requestedUsesPlanDollars: 112_100,
      fundedUsesPlanDollars: 100_100,
      unfundedUsesPlanDollars: 12_000,
      dispositionTotalPlanDollars: 112_100,
      differencePlanDollars: 0,
    },
    transfers: { debitsPlanDollars: 10_100, creditsPlanDollars: 10_100, differencePlanDollars: 0 },
    reasonCodes: [],
    diagnostics: [],
  }
}

function yearCashFlow(): YearCashFlow {
  return {
    sourceLines: [
      {
        id: 'source:wages:w-1',
        kind: 'wages',
        role: 'spendableSource',
        amountPlanDollars: 100_100,
        identities: [{ entityKind: 'person', personId: personId('p1') }],
      },
    ],
    useLines: [
      {
        id: 'use:requiredLifestyle:household',
        kind: 'requiredLifestyle',
        requestedPlanDollars: 112_100,
        fundedPlanDollars: 100_100,
        unfundedPlanDollars: 12_000,
        identities: [],
      },
    ],
    transferLines: [
      {
        id: 'transfer:surplusInvestment:account:cash',
        kind: 'surplusInvestment',
        source: { entityKind: 'householdCash' },
        destination: { entityKind: 'account', accountId: accountId('cash') },
        debitPlanDollars: 10_100,
        creditPlanDollars: 10_100,
        identities: [],
      },
    ],
    taxCharacterMetadata: [],
    reconciliation: reconciled(),
  }
}

function yearOf(year: number, cashFlow?: YearCashFlow): YearResult {
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
    contributions: 0,
    employerMatch: 0,
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
    shortfall: 0,
    requiredShortfall: 0,
    targetShortfall: 0,
    idealShortfall: 0,
    excessShortfall: 0,
    guardrailAction: 'hold',
    flexibleGoals: {
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    },
    balances: {},
    investableTotal: 400_000,
    insuranceCashValue: 0,
    ladderValue: 0,
    deathBenefit: 0,
    netWorth: 400_000,
    ...(cashFlow ? { cashFlow } : {}),
  } as unknown as YearResult
}

function testPlan(): Plan {
  return validatePlan(singlePersonPlan({ dob: '1965-06-15', planningAge: 95, retirementAge: null }))
}

const years = [yearOf(2030, yearCashFlow()), yearOf(2031, yearCashFlow())]
const identityAdj = (_year: number, value: number) => value
const deflateAdj = (_year: number, value: number) => value / 2

function SearchProbe({ onSearch }: { onSearch: (search: string) => void }) {
  const location = useLocation()
  useEffect(() => {
    onSearch(location.search)
  }, [location.search, onSearch])
  return null
}

function HistoryApi({
  onReady,
}: {
  onReady: (api: { back: () => void; forward: () => void }) => void
}) {
  const navigate = useNavigate()
  useEffect(() => {
    onReady({
      back: () => {
        void navigate(-1)
      },
      forward: () => {
        void navigate(1)
      },
    })
  }, [navigate, onReady])
  return null
}

let container: HTMLDivElement
let root: Root
let latestSearch = ''
let historyApi = { back: () => {}, forward: () => {} }

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  latestSearch = ''
  historyApi = { back: () => {}, forward: () => {} }
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderLedger(
  initialEntry: string,
  extras: {
    adj?: (year: number, value: number) => number
    dollars?: 'nominal' | 'today'
  } = {},
) {
  const node = (
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchProbe onSearch={(search) => { latestSearch = search }} />
      <HistoryApi onReady={(api) => { historyApi = api }} />
      <YearByYearLedger
        plan={testPlan()}
        years={years}
        adj={extras.adj ?? identityAdj}
        dollars={extras.dollars ?? 'nominal'}
        dollarLabel={extras.dollars === 'today' ? "today's $" : 'nominal $'}
        hasLayeredSpending={false}
        hasAmt={false}
        hasCarryforward={false}
      />
    </MemoryRouter>
  )
  await act(async () => {
    root.render(node)
  })
}

async function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  await act(async () => {
    ;(el as HTMLElement).click()
  })
}

function flowButton(year: number): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.getAttribute('aria-label') === `View cash flow for ${year}`,
  )
}

function buttonByLabel(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find((button) => button.textContent === label)
}

function searchParams(): URLSearchParams {
  return new URLSearchParams(latestSearch.startsWith('?') ? latestSearch.slice(1) : latestSearch)
}

describe('Results year cash-flow drill-down', () => {
  it('opens from the row button, sets flowYear, and shows the dialog', async () => {
    await renderLedger('/plan/p1/results')
    const opener = flowButton(2030)
    expect(opener?.textContent).toBe('View flow')
    expect(document.querySelector('.year-cash-flow-dialog')).toBeNull()

    await click(opener)
    expect(searchParams().get('flowYear')).toBe('2030')
    expect(searchParams().get('flowView')).toBe('cash')
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('2030 cash flow')
    expect(document.querySelector('.year-cash-flow-dialog')).not.toBeNull()
  })

  it('opens directly from a flowYear deep link', async () => {
    await renderLedger('/plan/p1/results?flowYear=2031')
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('2031 cash flow')
    expect(searchParams().get('flowYear')).toBe('2031')
  })

  it('closes on back and reopens on forward', async () => {
    await renderLedger('/plan/p1/results')
    await click(flowButton(2030))
    expect(document.querySelector('.year-cash-flow-dialog')).not.toBeNull()

    await act(async () => {
      historyApi.back()
    })
    expect(document.querySelector('.year-cash-flow-dialog')).toBeNull()
    expect(searchParams().get('flowYear')).toBeNull()

    await act(async () => {
      historyApi.forward()
    })
    expect(document.querySelector('.year-cash-flow-dialog')).not.toBeNull()
    expect(searchParams().get('flowYear')).toBe('2030')
  })

  it('cleans an invalid or out-of-range flowYear without opening', async () => {
    await renderLedger('/plan/p1/results?flowYear=1999')
    expect(document.querySelector('.year-cash-flow-dialog')).toBeNull()
    expect(searchParams().get('flowYear')).toBeNull()
    expect(searchParams().get('flowView')).toBeNull()
  })

  it('replaces an invalid flowView with cash and keeps the year open', async () => {
    await renderLedger('/plan/p1/results?flowYear=2030&flowView=bogus')
    expect(document.querySelector('.year-cash-flow-dialog')).not.toBeNull()
    expect(searchParams().get('flowYear')).toBe('2030')
    expect(searchParams().get('flowView')).toBe('cash')
  })

  it('cleans an orphan flowView when flowYear is absent', async () => {
    await renderLedger('/plan/p1/results?flowView=transfers')
    expect(document.querySelector('.year-cash-flow-dialog')).toBeNull()
    expect(searchParams().get('flowView')).toBeNull()
    expect(searchParams().get('flowYear')).toBeNull()
  })

  it('keeps Year as the first column and places Flow last', async () => {
    await renderLedger('/plan/p1/results')
    const headers = Array.from(container.querySelectorAll('.year-table thead th')).map((th) => th.textContent)
    expect(headers[0]).toBe('Year')
    expect(headers[headers.length - 1]).toBe('Flow')
    expect(container.querySelector('.year-table tbody tr td:first-child')?.textContent).toBe('2030')
    expect(flowButton(2030)).toBeTruthy()
  })

  it('updates flowView with replace when the view is toggled', async () => {
    await renderLedger('/plan/p1/results')
    await click(flowButton(2030))
    expect(searchParams().get('flowView')).toBe('cash')

    await click(buttonByLabel('Transfers'))
    expect(searchParams().get('flowYear')).toBe('2030')
    expect(searchParams().get('flowView')).toBe('transfers')
    expect(document.querySelector('.year-cash-flow-sankey')?.getAttribute('data-view')).toBe('transfers')

    await act(async () => {
      historyApi.back()
    })
    // View switch used replace, so back leaves the drill-down rather than the cash view.
    expect(document.querySelector('.year-cash-flow-dialog')).toBeNull()
    expect(searchParams().get('flowYear')).toBeNull()
  })

  it('clears params on close and restores focus to the row button', async () => {
    await renderLedger('/plan/p1/results')
    const opener = flowButton(2030)!
    opener.focus()
    expect(document.activeElement).toBe(opener)

    await click(opener)
    expect(document.querySelector('.modal-panel')).not.toBeNull()

    await click(document.querySelector('.modal-close'))
    expect(document.querySelector('.year-cash-flow-dialog')).toBeNull()
    expect(searchParams().get('flowYear')).toBeNull()
    expect(searchParams().get('flowView')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('passes a today-dollar transform that actually deflates a published figure', async () => {
    await renderLedger('/plan/p1/results?flowYear=2030', { adj: deflateAdj, dollars: 'today' })
    const dialog = document.querySelector('.year-cash-flow-dialog')
    expect(dialog?.textContent).toContain("Amounts in today's dollars")
    const nominal = fmtMoney(100_100)
    const today = fmtMoney(50_050)
    expect(today).not.toBe(nominal)
    expect(dialog?.textContent).toContain(today)
    expect(dialog?.textContent).not.toContain(nominal)
  })
})

describe('useProjection capture opt-in', () => {
  it('forwards captureAnnualCashFlow and leaves the default path without cashFlow', async () => {
    const plan = testPlan()
    function Harness() {
      const off = useProjection(plan)
      const on = useProjection(plan, { captureAnnualCashFlow: true })
      return (
        <div
          data-off={String(off.result.years.some((year) => year.cashFlow !== undefined))}
          data-on={String(on.result.years.some((year) => year.cashFlow !== undefined))}
        />
      )
    }
    await act(async () => {
      root.render(<Harness />)
    })
    const node = container.querySelector('div')
    expect(node?.getAttribute('data-off')).toBe('false')
    expect(node?.getAttribute('data-on')).toBe('true')
  })
})
