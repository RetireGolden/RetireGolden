/**
 * Year cash-flow drill-down dialog — presentation only.
 *
 * Consumes the Stage A selector model. Dollar-mode conversion is a caller
 * display transform. The dialog never recomputes tax, funding, or shortfall.
 */

import { useState } from 'react'

import { Modal } from '../Modal'
import { fmtMoney } from '../format'
import type {
  YearCashFlowSankeyModel,
  YearCashFlowSankeyReady,
  YearCashFlowSankeyViewId,
  YearCashFlowTableRow,
  YearCashFlowTableView,
} from './buildYearCashFlow'
import { serializeYearCashFlowDetailCsv } from './detailCsv'
import {
  YearCashFlowSankey,
  type YearCashFlowDisplayAmount,
} from './YearCashFlowSankey'

export type YearCashFlowDollarMode = 'nominal' | 'today'

export interface YearCashFlowDialogProps {
  readonly model: YearCashFlowSankeyModel
  readonly displayAmount: YearCashFlowDisplayAmount
  readonly dollarMode: YearCashFlowDollarMode
  readonly onClose: () => void
  readonly year: number
  /** Rebuild the selector with grouping off. Shown only when lines were collapsed. */
  readonly onShowAll?: () => void
}

const TABLE_VIEW_LABEL: Record<YearCashFlowTableView, string> = {
  cashFlow: 'Cash flow',
  transfers: 'Transfers',
  postSolve: 'Post-solve',
  taxCharacter: 'Tax character',
}

function moneyCell(
  year: number,
  displayAmount: YearCashFlowDisplayAmount,
  value: number | null,
): string {
  if (value === null) return ''
  return fmtMoney(displayAmount(year, value))
}

function hasCollapsedLines(model: YearCashFlowSankeyReady): boolean {
  return (
    model.views.cashFlow.nodes.some((node) => node.collapsed) ||
    model.views.transfers.nodes.some((node) => node.collapsed)
  )
}

function downloadDetailCsv(model: YearCashFlowSankeyModel, year: number): void {
  const blob = new Blob([serializeYearCashFlowDetailCsv(model)], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${year}-cash-flow-detail.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function RefusalState({ model }: { model: Extract<YearCashFlowSankeyModel, { kind: 'unavailable' }> }) {
  const captured = model.unavailableReason === 'notCaptured'
  return (
    <div className="year-cash-flow-refusal">
      <p>
        Cash-flow detail is not available for this year, so the chart is omitted.{' '}
        {captured
          ? 'The projection did not capture a cash-flow ledger for this year.'
          : "This year's cash-flow ledger did not reconcile."}
      </p>
      {model.reasonCodes.length > 0 ? (
        <>
          <p>Reason codes:</p>
          <ul>
            {model.reasonCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function SummaryStrip({
  model,
  year,
  displayAmount,
}: {
  model: YearCashFlowSankeyReady
  year: number
  displayAmount: YearCashFlowDisplayAmount
}) {
  const sourceTotal = displayAmount(year, model.reconciliation.cash.sourceTotalPlanDollars)
  const fundedUses = displayAmount(year, model.reconciliation.uses.fundedUsesPlanDollars)
  const surplus = displayAmount(year, model.reconciliation.cash.surplusInvestmentPlanDollars)
  const shortfall = displayAmount(year, model.reconciliation.uses.unfundedUsesPlanDollars)
  return (
    <div className="year-cash-flow-summary">
      <div className="year-cash-flow-summary-item">
        <div className="year-cash-flow-summary-label">Source total</div>
        <div className="year-cash-flow-summary-value year-cash-flow-num">{fmtMoney(sourceTotal)}</div>
      </div>
      <div className="year-cash-flow-summary-item">
        <div className="year-cash-flow-summary-label">Funded uses</div>
        <div className="year-cash-flow-summary-value year-cash-flow-num">{fmtMoney(fundedUses)}</div>
      </div>
      <div className="year-cash-flow-summary-item">
        <div className="year-cash-flow-summary-label">Surplus</div>
        <div className="year-cash-flow-summary-value year-cash-flow-num">{fmtMoney(surplus)}</div>
      </div>
      <div className="year-cash-flow-summary-item year-cash-flow-summary-item--shortfall">
        <div className="year-cash-flow-summary-label">
          Shortfall
          <span className="type-chip year-cash-flow-shortfall-badge">Shortfall</span>
        </div>
        <div className="year-cash-flow-summary-value year-cash-flow-num">{fmtMoney(shortfall)}</div>
      </div>
    </div>
  )
}

function DetailTable({
  rows,
  year,
  displayAmount,
  dollarMode,
}: {
  rows: readonly YearCashFlowTableRow[]
  year: number
  displayAmount: YearCashFlowDisplayAmount
  dollarMode: YearCashFlowDollarMode
}) {
  const mode = dollarMode === 'today' ? "today's dollars" : 'nominal dollars'
  return (
    <div className="year-table-wrap year-cash-flow-table-wrap">
      <table className="year-table year-cash-flow-table">
        <caption>
          Cash-flow lines for {year} ({mode})
        </caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">View</th>
            <th scope="col">Kind</th>
            <th scope="col">Amount</th>
            <th scope="col">Requested</th>
            <th scope="col">Funded</th>
            <th scope="col">Unfunded</th>
            <th scope="col">Debit</th>
            <th scope="col">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-line-id={row.id}>
              <th scope="row">{row.label}</th>
              <td>{TABLE_VIEW_LABEL[row.view]}</td>
              <td>{row.kind}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.amountPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.requestedPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.fundedPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.unfundedPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.debitPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.creditPlanDollars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function YearCashFlowDialog({
  model,
  displayAmount,
  dollarMode,
  onClose,
  year,
  onShowAll,
}: YearCashFlowDialogProps) {
  const [viewId, setViewId] = useState<YearCashFlowSankeyViewId>('cashFlow')
  const ready = model.kind === 'ready' ? model : null
  const showAllControl = ready !== null && !ready.showAll && hasCollapsedLines(ready)
  const modeLabel = dollarMode === 'today' ? "Amounts in today's dollars" : 'Amounts in nominal dollars'

  return (
    <Modal title={`${year} cash flow`} onClose={onClose}>
      <div className="year-cash-flow-dialog">
        <p className="small year-cash-flow-mode">{modeLabel}</p>
        {ready === null ? (
          <RefusalState model={model} />
        ) : (
          <>
            <SummaryStrip model={ready} year={year} displayAmount={displayAmount} />
            <div className="year-cash-flow-toolbar">
              <div className="seg" role="group" aria-label="Cash-flow view">
                <button type="button" aria-pressed={viewId === 'cashFlow'} onClick={() => setViewId('cashFlow')}>
                  Cash flow
                </button>
                <button type="button" aria-pressed={viewId === 'transfers'} onClick={() => setViewId('transfers')}>
                  Transfers
                </button>
              </div>
              {showAllControl ? (
                <button type="button" className="btn btn-secondary" onClick={() => onShowAll?.()}>
                  Show all
                </button>
              ) : null}
            </div>
            <YearCashFlowSankey
              view={ready.views[viewId]}
              viewId={viewId}
              year={year}
              displayAmount={displayAmount}
              sourceTotalPlanDollars={ready.reconciliation.cash.sourceTotalPlanDollars}
              fundedUsesPlanDollars={ready.reconciliation.uses.fundedUsesPlanDollars}
              shortfallPlanDollars={ready.reconciliation.uses.unfundedUsesPlanDollars}
              transferDebitsPlanDollars={ready.reconciliation.transfers.debitsPlanDollars}
              transferCreditsPlanDollars={ready.reconciliation.transfers.creditsPlanDollars}
            />
            <DetailTable rows={ready.table} year={year} displayAmount={displayAmount} dollarMode={dollarMode} />
          </>
        )}
        <div className="year-cash-flow-actions">
          <button type="button" className="btn btn-secondary" onClick={() => downloadDetailCsv(model, year)}>
            Download detail CSV
          </button>
        </div>
      </div>
    </Modal>
  )
}
