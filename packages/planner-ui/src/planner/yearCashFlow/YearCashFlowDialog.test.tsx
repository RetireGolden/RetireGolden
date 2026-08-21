/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import type {
  YearCashFlow,
  YearCashFlowReconciliation,
  YearCashFlowSourceLine,
  YearCashFlowUseLine,
  YearResult,
} from '@retiregolden/engine/projection/types'
import {
  cashAccount,
  couplePlan,
  traditionalAccount,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'

import { buildYearCashFlowSankey, type YearCashFlowSankeyModel } from './buildYearCashFlow'
import { serializeYearCashFlowDetailCsv } from './detailCsv'
import { YearCashFlowDialog, type YearCashFlowDialogProps } from './YearCashFlowDialog'

const personId = (id: string): PersonId => id as PersonId
const accountId = (id: string): AccountId => id as AccountId

function reconciled(overrides: Partial<YearCashFlowReconciliation> = {}): YearCashFlowReconciliation {
  return {
    status: 'reconciled',
    tolerancePlanDollars: 1e-6,
    cash: {
      spendableSourcesPlanDollars: 99_800,
      portfolioFundingPlanDollars: 400,
      loanProceedsPlanDollars: 0,
      sourceTotalPlanDollars: 100_200,
      fundedHouseholdUsesPlanDollars: 90_100,
      settledTaxPlanDollars: 0,
      penaltiesPlanDollars: 0,
      contributionsPlanDollars: 0,
      surplusInvestmentPlanDollars: 10_100,
      destinationTotalPlanDollars: 100_200,
      differencePlanDollars: 0,
    },
    uses: {
      requestedUsesPlanDollars: 112_200,
      fundedUsesPlanDollars: 100_200,
      unfundedUsesPlanDollars: 12_000,
      dispositionTotalPlanDollars: 112_200,
      differencePlanDollars: 0,
    },
    transfers: { debitsPlanDollars: 10_100, creditsPlanDollars: 10_100, differencePlanDollars: 0 },
    reasonCodes: [],
    diagnostics: [],
    ...overrides,
  }
}

function collapsePlan(): Plan {
  const plan = couplePlan({ p1PlanningAge: 95, p2PlanningAge: 95 })
  plan.accounts = [
    { ...traditionalAccount('ira-pat', 400_000, 'p1', 'ira'), name: 'Rollover IRA' },
    { ...traditionalAccount('tiny-a', 1_000, 'p1', 'ira'), name: 'Tiny A' },
    { ...traditionalAccount('tiny-b', 1_000, 'p1', 'ira'), name: 'Tiny B' },
    { ...traditionalAccount('tiny-c', 1_000, 'p1', 'ira'), name: 'Tiny C' },
    { ...traditionalAccount('tiny-robin', 1_000, 'p2', 'ira'), name: 'Spouse IRA' },
    cashAccount('cash', 20_000),
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: 'w-pat',
      personId: 'p1',
      annualGross: 99_700,
      endAge: null,
      realGrowthPct: 0,
    },
    {
      type: 'recurring',
      id: 'side-job',
      label: 'Side job',
      annualAmount: 100,
      startYear: null,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    },
  ]
  return validatePlan(plan)
}

function withdrawal(id: string, acct: string, owner: string, amount: number): YearCashFlowSourceLine {
  return {
    id,
    kind: 'needBasedPortfolioWithdrawal',
    role: 'portfolioFunding',
    amountPlanDollars: amount,
    identities: [
      { entityKind: 'account', accountId: accountId(acct) },
      { entityKind: 'person', personId: personId(owner) },
    ],
  }
}

function collapseCashFlow(): YearCashFlow {
  const lifestyle: YearCashFlowUseLine = {
    id: 'use:requiredLifestyle:household',
    kind: 'requiredLifestyle',
    requestedPlanDollars: 102_100,
    fundedPlanDollars: 90_100,
    unfundedPlanDollars: 12_000,
    identities: [],
  }
  const surplus: YearCashFlowUseLine = {
    id: 'use:surplusInvestment:account:cash',
    kind: 'surplusInvestment',
    requestedPlanDollars: 10_100,
    fundedPlanDollars: 10_100,
    unfundedPlanDollars: 0,
    identities: [{ entityKind: 'account', accountId: accountId('cash') }],
  }
  return {
    sourceLines: [
      {
        id: 'source:wages:w-pat',
        kind: 'wages',
        role: 'spendableSource',
        amountPlanDollars: 99_700,
        identities: [
          { entityKind: 'incomeStream', incomeStreamId: 'w-pat' },
          { entityKind: 'person', personId: personId('p1') },
        ],
      },
      {
        id: 'source:recurringIncome:side-job',
        kind: 'recurringIncome',
        role: 'spendableSource',
        amountPlanDollars: 100,
        identities: [{ entityKind: 'incomeStream', incomeStreamId: 'side-job' }],
      },
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-a', 'tiny-a', 'p1', 100),
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-b', 'tiny-b', 'p1', 100),
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-c', 'tiny-c', 'p1', 100),
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-robin', 'tiny-robin', 'p2', 100),
    ],
    useLines: [lifestyle, surplus],
    transferLines: [
      {
        id: 'transfer:surplusInvestment:account:cash',
        kind: 'surplusInvestment',
        source: { entityKind: 'householdCash' },
        destination: { entityKind: 'account', accountId: accountId('cash') },
        debitPlanDollars: 10_100,
        creditPlanDollars: 10_100,
        identities: [{ entityKind: 'account', accountId: accountId('cash') }],
      },
    ],
    taxCharacterMetadata: [
      {
        id: 'tax:tipsPhantomOidIncome:ladder-1',
        taxCharacter: { kind: 'tipsPhantomOidIncome', amountPlanDollars: 250 },
        identities: [],
      },
    ],
    reconciliation: reconciled(),
  }
}

const plan = collapsePlan()
const yearResult = { year: 2030, cashFlow: collapseCashFlow() } as YearResult

function readyModel(showAll = false) {
  const model = buildYearCashFlowSankey(plan, yearResult, { showAll })
  if (model.kind !== 'ready') throw new Error(`expected ready, got ${model.kind}`)
  return model
}

const identity: YearCashFlowDialogProps['displayAmount'] = (_year, amount) => amount

function dialogProps(model: YearCashFlowSankeyModel, extras: Partial<YearCashFlowDialogProps> = {}): YearCashFlowDialogProps {
  return {
    model,
    displayAmount: identity,
    dollarMode: 'nominal',
    onClose: () => {},
    year: 2030,
    ...extras,
  }
}

function withRouter(node: ReactNode) {
  return <MemoryRouter initialEntries={['/plan/test/results']}>{node}</MemoryRouter>
}

function dialogHtml(model: YearCashFlowSankeyModel, extras: Partial<YearCashFlowDialogProps> = {}): string {
  return renderToStaticMarkup(withRouter(<YearCashFlowDialog {...dialogProps(model, extras)} />))
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function render(node: ReactNode) {
  await act(async () => {
    root.render(withRouter(node))
  })
}

async function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  await act(async () => {
    ;(el as HTMLElement).click()
  })
}

function buttonByLabel(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label)
}

describe('YearCashFlowDialog', () => {
  it('renders the compact summary from selector totals', () => {
    const html = dialogHtml(readyModel())
    expect(html).toContain('Source total')
    expect(html).toContain('Funded uses')
    expect(html).toContain('Surplus')
    expect(html).toContain('$100,200')
    expect(html).toContain('$10,100')
    expect(html).toContain('$12,000')
  })

  it('renders a contextual learn link to the year cash-flow article', () => {
    const html = dialogHtml(readyModel())
    expect(html).toContain('href="/learn/where-the-money-comes-from-and-goes"')
    expect(html).toContain('Learn where the money comes from and goes')
    expect(html).toContain('learn-link')

    const unavailable: YearCashFlowSankeyModel = {
      kind: 'unavailable',
      year: 2030,
      unavailableReason: 'notReconciled',
      reasonCodes: ['cashIdentityMismatch'],
      diagnostics: [],
    }
    const refusal = dialogHtml(unavailable)
    expect(refusal).toContain('href="/learn/where-the-money-comes-from-and-goes"')
  })

  it('marks the shortfall with a text badge, not color alone', () => {
    const html = dialogHtml(readyModel())
    expect(html).toContain('year-cash-flow-summary-item--shortfall')
    expect(html).toContain('year-cash-flow-shortfall-badge')
    expect(html).toMatch(/<span[^>]*year-cash-flow-shortfall-badge[^>]*>Shortfall<\/span>/)
  })

  it('renders a zero shortfall as a neutral summary tile', () => {
    const base = readyModel()
    const model = {
      ...base,
      reconciliation: {
        ...base.reconciliation,
        uses: { ...base.reconciliation.uses, unfundedUsesPlanDollars: 0 },
      },
    }
    const html = dialogHtml(model)
    expect(html).toContain('Shortfall')
    expect(html).not.toContain('year-cash-flow-summary-item--shortfall')
    expect(html).not.toContain('year-cash-flow-shortfall-badge')
  })

  it('toggles between cash flow and transfers views', async () => {
    await render(<YearCashFlowDialog {...dialogProps(readyModel())} />)
    const cash = buttonByLabel('Cash flow')!
    const transfers = buttonByLabel('Transfers')!
    expect(cash.getAttribute('aria-pressed')).toBe('true')
    expect(transfers.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('.year-cash-flow-sankey')?.getAttribute('data-view')).toBe('cashFlow')

    await click(transfers)
    expect(buttonByLabel('Cash flow')!.getAttribute('aria-pressed')).toBe('false')
    expect(buttonByLabel('Transfers')!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.year-cash-flow-sankey')?.getAttribute('data-view')).toBe('transfers')
    expect(container.querySelector('.year-cash-flow-sankey')?.getAttribute('aria-label')).toMatch(/Transfers for 2030/)
  })

  it('expands collapsed lines when Show all is clicked', async () => {
    function Harness() {
      const [showAll, setShowAll] = useState(false)
      return (
        <YearCashFlowDialog
          {...dialogProps(readyModel(showAll), { onShowAll: () => setShowAll(true) })}
        />
      )
    }
    await render(<Harness />)
    const chart = container.querySelector('.year-cash-flow-sankey')!
    expect(chart.getAttribute('data-node-ids')).toContain('other:')
    expect(chart.getAttribute('data-node-ids')).not.toContain('source:needBasedPortfolioWithdrawal:tiny-a')
    expect(buttonByLabel('Show all')).toBeTruthy()

    await click(buttonByLabel('Show all'))
    const expanded = container.querySelector('.year-cash-flow-sankey')!
    expect(expanded.getAttribute('data-node-ids')).not.toContain('other:')
    expect(expanded.getAttribute('data-node-ids')).toContain('source:needBasedPortfolioWithdrawal:tiny-a')
    expect(expanded.getAttribute('data-node-ids')).toContain('source:needBasedPortfolioWithdrawal:tiny-b')
    expect(expanded.getAttribute('data-node-ids')).toContain('source:needBasedPortfolioWithdrawal:tiny-c')
    expect(buttonByLabel('Show all')).toBeUndefined()
  })

  it('shows Show all only on the cash-flow view when that view has collapsed nodes', async () => {
    await render(<YearCashFlowDialog {...dialogProps(readyModel())} />)
    expect(buttonByLabel('Show all')).toBeTruthy()

    await click(buttonByLabel('Transfers'))
    expect(buttonByLabel('Show all')).toBeUndefined()

    await click(buttonByLabel('Cash flow'))
    expect(buttonByLabel('Show all')).toBeTruthy()
  })

  it('surfaces an unresolved identity in the table label and marker', () => {
    const plan = collapsePlan()
    const base = collapseCashFlow()
    const cashFlow: YearCashFlow = {
      ...base,
      sourceLines: [
        ...base.sourceLines,
        {
          id: 'source:needBasedPortfolioWithdrawal:ira-pat',
          kind: 'needBasedPortfolioWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars: 100,
          identities: [
            { entityKind: 'account', accountId: accountId('ira-pat') },
            { entityKind: 'person', personId: personId('ghost') },
          ],
        },
      ],
    }
    const model = buildYearCashFlowSankey(plan, { year: 2030, cashFlow } as YearResult)
    if (model.kind !== 'ready') throw new Error('expected ready')
    const html = dialogHtml(model)
    expect(html).toContain('Unknown source (ID ghost)')
    expect(html).toContain('year-cash-flow-unresolved-marker')
    expect(html).toContain('Unresolved')
  })

  it('lists every underlying line in the accessible table', () => {
    const model = readyModel()
    const html = dialogHtml(model)
    expect(html).toContain('<caption>')
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
    expect(html).toContain('Entities')
    expect(html).toContain('From')
    expect(html).toContain('To')
    expect(html).toContain('Penalty')
    expect(html).toContain('Tax character')
    expect(html).toContain('Lineage')
    for (const row of model.table) {
      expect(html).toContain(`data-line-id="${row.id}"`)
      expect(html).toContain(row.label)
    }
    const surplus = model.table.find((row) => row.id === 'transfer:surplusInvestment:account:cash')
    expect(html).toContain('Household cash')
    expect(html).toContain(surplus!.targetLabel)
    expect(html).toContain('tipsPhantomOidIncome')
    expect(html).toContain('$250')
  })

  it('downloads the Stage A detail CSV through a mockable object URL', async () => {
    const model = readyModel()
    const blobs: Blob[] = []
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return 'blob:year-cash-flow-test'
    })
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await render(<YearCashFlowDialog {...dialogProps(model)} />)
    await click(buttonByLabel('Download detail CSV'))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(blobs).toHaveLength(1)
    expect(await blobs[0]!.text()).toBe(serializeYearCashFlowDetailCsv(model))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:year-cash-flow-test')
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
  })

  it('renders a textual refusal with reason codes and no chart', () => {
    const model: YearCashFlowSankeyModel = {
      kind: 'unavailable',
      year: 2030,
      unavailableReason: 'notReconciled',
      reasonCodes: ['cashIdentityMismatch', 'duplicateLineId'],
      diagnostics: [],
    }
    const html = dialogHtml(model)
    expect(html).toContain('cashIdentityMismatch')
    expect(html).toContain('duplicateLineId')
    expect(html).toContain('did not reconcile')
    expect(html).not.toContain('year-cash-flow-sankey')
    expect(html).not.toContain('recharts')
  })

  it('omits the chart svg in the refusal state', async () => {
    const model: YearCashFlowSankeyModel = {
      kind: 'unavailable',
      year: 2030,
      unavailableReason: 'notReconciled',
      reasonCodes: ['cashIdentityMismatch'],
      diagnostics: [],
    }
    await render(<YearCashFlowDialog {...dialogProps(model)} />)
    expect(container.querySelector('.year-cash-flow-dialog svg')).toBeNull()
    expect(container.textContent).toContain('cashIdentityMismatch')
  })

  it('moves focus into the dialog and restores it to the opener on close', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
            Open year
          </button>
          {open ? <YearCashFlowDialog {...dialogProps(readyModel(), { onClose: () => setOpen(false) })} /> : null}
        </div>
      )
    }

    await render(<Harness />)
    const opener = container.querySelector<HTMLButtonElement>('[data-testid="opener"]')!
    opener.focus()
    expect(document.activeElement).toBe(opener)

    await click(opener)
    const panel = document.querySelector('.modal-panel')
    expect(panel).not.toBeNull()
    expect(panel?.contains(document.activeElement) || document.activeElement === panel).toBe(true)

    await click(document.querySelector('.modal-close'))
    expect(document.querySelector('.modal-panel')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
