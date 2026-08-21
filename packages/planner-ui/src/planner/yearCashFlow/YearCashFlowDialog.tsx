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
  /** Controlled Sankey view. Uncontrolled (defaults to cash flow) when omitted. */
  readonly viewId?: YearCashFlowSankeyViewId
  readonly onViewChange?: (viewId: YearCashFlowSankeyViewId) => void
}

const TABLE_VIEW_LABEL: Record<YearCashFlowTableView, string> = {
  cashFlow: 'Cash flow',
  transfers: 'Transfers',
  postSolve: 'Post-solve',
  taxCharacter: 'Tax character',
}

const PENALTY_CLASS_LABEL: Record<NonNullable<YearCashFlowTableRow['penaltyClass']>, string> = {
  traditionalEarly: 'Traditional early',
  hsaNonMedical: 'HSA nonmedical',
  rothEarly: 'Roth early',
}

function taxCharacterSummary(
  year: number,
  displayAmount: YearCashFlowDisplayAmount,
  row: YearCashFlowTableRow,
): string {
  if (row.taxCharacter.length === 0) return ''
  return row.taxCharacter
    .map((item) => `${item.kind} ${fmtMoney(displayAmount(year, item.amountPlanDollars))}`)
    .join('; ')
}

function lineageSummary(row: YearCashFlowTableRow): string {
  if (row.lineageNotes.length === 0) return ''
  return row.lineageNotes.map((item) => `${item.relationship} → ${item.lineId}`).join('; ')
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
  const hasShortfall = shortfall > 0
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
      <div
        className={
          hasShortfall
            ? 'year-cash-flow-summary-item year-cash-flow-summary-item--shortfall'
            : 'year-cash-flow-summary-item'
        }
      >
        <div className="year-cash-flow-summary-label">
          Shortfall
          {hasShortfall ? <span className="type-chip year-cash-flow-shortfall-badge">Shortfall</span> : null}
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
            <th scope="col">Entities</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Amount</th>
            <th scope="col">Requested</th>
            <th scope="col">Funded</th>
            <th scope="col">Unfunded</th>
            <th scope="col">Debit</th>
            <th scope="col">Credit</th>
            <th scope="col">Penalty</th>
            <th scope="col">Tax character</th>
            <th scope="col">Lineage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-line-id={row.id} data-unresolved={row.unresolved ? 'true' : undefined}>
              <th scope="row">
                {row.label}
                {row.unresolved ? (
                  <span className="year-cash-flow-unresolved-marker">Unresolved</span>
                ) : null}
              </th>
              <td>{TABLE_VIEW_LABEL[row.view]}</td>
              <td>{row.kind}</td>
              <td>{row.entityLabels.join('; ')}</td>
              <td>{row.sourceLabel}</td>
              <td>{row.targetLabel}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.amountPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.requestedPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.fundedPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.unfundedPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.debitPlanDollars)}</td>
              <td className="year-cash-flow-num">{moneyCell(year, displayAmount, row.creditPlanDollars)}</td>
              <td>{row.penaltyClass ? PENALTY_CLASS_LABEL[row.penaltyClass] : ''}</td>
              <td>{taxCharacterSummary(year, displayAmount, row)}</td>
              <td>{lineageSummary(row)}</td>
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
  viewId: viewIdProp,
  onViewChange,
}: YearCashFlowDialogProps) {
  const [uncontrolledViewId, setUncontrolledViewId] = useState<YearCashFlowSankeyViewId>('cashFlow')
  const viewId = viewIdProp ?? uncontrolledViewId
  const selectView = (next: YearCashFlowSankeyViewId) => {
    onViewChange?.(next)
    if (viewIdProp === undefined) setUncontrolledViewId(next)
  }
  const modeLabel = dollarMode === 'today' ? "Amounts in today's dollars" : 'Amounts in nominal dollars'

  if (model.kind === 'unavailable') {
    return (
      <Modal title={`${year} cash flow`} onClose={onClose}>
        <div className="year-cash-flow-dialog">
          <p className="small year-cash-flow-mode">{modeLabel}</p>
          <RefusalState model={model} />
          <div className="year-cash-flow-actions">
            <button type="button" className="btn btn-secondary" onClick={() => downloadDetailCsv(model, year)}>
              Download detail CSV
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  const readyModel: YearCashFlowSankeyReady = model
  const sankeyView = readyModel.views[viewId]
  const showAllControl = !readyModel.showAll && hasCollapsedLines(readyModel)

  return (
    <Modal title={`${year} cash flow`} onClose={onClose}>
      <div className="year-cash-flow-dialog">
        <p className="small year-cash-flow-mode">{modeLabel}</p>
        <SummaryStrip model={readyModel} year={year} displayAmount={displayAmount} />
        <div className="year-cash-flow-toolbar">
          <div className="seg" role="group" aria-label="Cash-flow view">
            <button type="button" aria-pressed={viewId === 'cashFlow'} onClick={() => selectView('cashFlow')}>
              Cash flow
            </button>
            <button type="button" aria-pressed={viewId === 'transfers'} onClick={() => selectView('transfers')}>
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
          view={{ nodes: [...sankeyView.nodes], links: [...sankeyView.links] }}
          viewId={viewId}
          year={year}
          displayAmount={displayAmount}
          sourceTotalPlanDollars={readyModel.reconciliation.cash.sourceTotalPlanDollars}
          fundedUsesPlanDollars={readyModel.reconciliation.uses.fundedUsesPlanDollars}
          shortfallPlanDollars={readyModel.reconciliation.uses.unfundedUsesPlanDollars}
          transferDebitsPlanDollars={readyModel.reconciliation.transfers.debitsPlanDollars}
          transferCreditsPlanDollars={readyModel.reconciliation.transfers.creditsPlanDollars}
        />
        <DetailTable rows={readyModel.table} year={year} displayAmount={displayAmount} dollarMode={dollarMode} />
        <div className="year-cash-flow-actions">
          <button type="button" className="btn btn-secondary" onClick={() => downloadDetailCsv(model, year)}>
            Download detail CSV
          </button>
        </div>
      </div>
    </Modal>
  )
}
