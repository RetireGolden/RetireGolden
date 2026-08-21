/**
 * Selected-year cash-flow detail CSV.
 *
 * Distinct from the compact year-ledger CSV in ResultsPage: this serializer
 * emits one row per underlying cash-flow line (and never the per-year summary
 * columns). Amounts are the engine's nominal Plan dollars, unrounded.
 *
 * Reconciliation summary row convention
 * -------------------------------------
 * After the column header, the first data row is always a reconciliation
 * summary:
 *
 *   view              = reconciliation
 *   kind              = summary
 *   lineage           = reason codes joined with ';' (empty when reconciled
 *                       or when detail was not captured)
 *   reconciliationStatus = reconciled | notReconciled | notCaptured
 *
 * Endpoint columns
 * ----------------
 * `sourceRef` and `targetRef` are always flow endpoints: Plan identity keys
 * (`account:…`, `person:…`, `incomeStream:…`) or a transfer/hub endpoint id
 * (`householdCash`, `charity:cf-1`, `account:cash`). They are never the
 * engine line id. That id lives in `lineId` (empty on the summary row).
 *
 * Every subsequent line row repeats `reconciliationStatus` so a spreadsheet
 * filter keeps the year's verdict next to the dollars. An unavailable year
 * (no `cashFlow`, or `notReconciled`) emits the header plus this summary
 * row only — never a best-effort dump of an unsafe graph.
 *
 * Cells are `csvEscape`'d with the same quoting rules as `inheritedCsv.ts`.
 * Text cells that begin with `=`, `+`, `-`, or `@` are prefixed with an
 * apostrophe before that escape so spreadsheet hosts treat them as text.
 * Numeric cells are left as bare numbers.
 */

import { csvEscape } from '../inheritedCsv'
import type { YearCashFlowSankeyModel, YearCashFlowTableRow } from './buildYearCashFlow'

export const YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS = [
  'year',
  'view',
  'kind',
  'lineId',
  'sourceRef',
  'targetRef',
  'label',
  'nominalAmount',
  'requested',
  'funded',
  'unfunded',
  'debit',
  'credit',
  'penaltyClass',
  'taxCharacter',
  'lineage',
  'reconciliationStatus',
] as const

export type YearCashFlowDetailCsvColumn = (typeof YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS)[number]

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return csvEscape(String(value))
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value
  return csvEscape(neutralized)
}

function rowCells(values: readonly (string | number | null | undefined)[]): string {
  return values.map(cell).join(',')
}

function taxCharacterCell(row: Pick<YearCashFlowTableRow, 'taxCharacter'>): string {
  if (row.taxCharacter.length === 0) return ''
  return row.taxCharacter.map((item) => `${item.kind}:${item.amountPlanDollars}`).join(';')
}

function lineageCell(row: Pick<YearCashFlowTableRow, 'lineageNotes'>): string {
  if (row.lineageNotes.length === 0) return ''
  return row.lineageNotes.map((item) => `${item.relationship}>${item.lineId}`).join(';')
}

function summaryRow(
  year: number,
  status: string,
  lineage: string,
): string {
  const cells: Record<YearCashFlowDetailCsvColumn, string> = {
    year: String(year),
    view: 'reconciliation',
    kind: 'summary',
    lineId: '',
    sourceRef: '',
    targetRef: '',
    label: '',
    nominalAmount: '',
    requested: '',
    funded: '',
    unfunded: '',
    debit: '',
    credit: '',
    penaltyClass: '',
    taxCharacter: '',
    lineage,
    reconciliationStatus: status,
  }
  return rowCells(YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS.map((column) => cells[column]))
}

function lineRow(year: number, status: string, row: YearCashFlowTableRow): string {
  return rowCells([
    String(year),
    row.view,
    row.kind,
    row.id,
    row.sourceRef,
    row.targetRef,
    row.label,
    row.amountPlanDollars,
    row.requestedPlanDollars,
    row.fundedPlanDollars,
    row.unfundedPlanDollars,
    row.debitPlanDollars,
    row.creditPlanDollars,
    row.penaltyClass,
    taxCharacterCell(row),
    lineageCell(row),
    status,
  ])
}

/** Serialize one selected year of cash-flow detail, including the summary row. */
export function serializeYearCashFlowDetailCsv(model: YearCashFlowSankeyModel): string {
  const header = YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS.join(',')
  if (model.kind === 'unavailable') {
    const status = model.unavailableReason === 'notCaptured' ? 'notCaptured' : 'notReconciled'
    const lineage = model.reasonCodes.join(';')
    return `${header}\n${summaryRow(model.year, status, lineage)}\n`
  }
  const status = model.reconciliation.status
  const lines = [
    header,
    summaryRow(model.year, status, model.reconciliation.reasonCodes.join(';')),
    ...model.table.map((row) => lineRow(model.year, status, row)),
  ]
  return `${lines.join('\n')}\n`
}
