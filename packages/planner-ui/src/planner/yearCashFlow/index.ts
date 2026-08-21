/**
 * Year cash-flow drill-down — planner-ui selector layer.
 *
 * Pure functions over `YearResult.cashFlow` and the current Plan. No React,
 * no Recharts, no display rounding. Components consume the Sankey + table
 * model and apply a dollar transform at render time.
 *
 * @see DOCS/features/year-cash-flow.md (engine reporting contract)
 * @see ./buildYearCashFlow.ts (two-view Sankey + accessible table)
 * @see ./grouping.ts (Other(n) collapse policy)
 * @see ./detailCsv.ts (selected-year detail CSV, not the compact ledger)
 */

export {
  HOUSEHOLD_CASH_NODE_ID,
  UNFUNDED_ORIGIN_NODE_ID,
  buildYearCashFlowSankey,
  type BuildYearCashFlowSankeyOptions,
  type YearCashFlowSankeyFlag,
  type YearCashFlowSankeyLink,
  type YearCashFlowSankeyModel,
  type YearCashFlowSankeyNode,
  type YearCashFlowSankeyNodeRole,
  type YearCashFlowSankeyReady,
  type YearCashFlowSankeySide,
  type YearCashFlowSankeyUnavailable,
  type YearCashFlowSankeyView,
  type YearCashFlowSankeyViewId,
  type YearCashFlowTableRow,
  type YearCashFlowTableView,
  type YearCashFlowUnavailableReason,
} from './buildYearCashFlow'

export {
  YEAR_CASH_FLOW_COLLAPSE_THRESHOLD_SHARE,
  applyYearCashFlowGrouping,
  type YearCashFlowGroupingOptions,
} from './grouping'

export {
  YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS,
  serializeYearCashFlowDetailCsv,
  type YearCashFlowDetailCsvColumn,
} from './detailCsv'
