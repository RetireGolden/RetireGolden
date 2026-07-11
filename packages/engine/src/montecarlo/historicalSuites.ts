/**
 * Deterministic historical stress suites.
 *
 * These are not random Monte Carlo runs. They replay every rolling historical
 * window, plus optional reversed windows, through the same projection ledger.
 */

import { ASSET_CLASS_IDS, type AssetClassId, type Plan } from '../model/plan.js'
import { summarizeProjection, type ProjectionSummary } from '../projection/compare.js'
import { simulatePlan, type SimulateOptions } from '../projection/simulate.js'
import type { MarketSeries, ProjectionResult } from '../projection/types.js'
import { HISTORICAL_YEARS, meanPortfolioReturnPct, portfolioReturnPct } from './historicalReturns.js'

export type HistoricalStressSuiteKind = 'rolling' | 'reversed'

export interface HistoricalStressWindow {
  suite: HistoricalStressSuiteKind
  label: string
  startHistoricalYear: number
  endHistoricalYear: number
  reversed: boolean
  marketYears: number[]
  projection: ProjectionResult
  summary: ProjectionSummary
  success: boolean
  totalShortfall: number
  totalRequiredShortfall: number
  totalTargetShortfall: number
}

export interface HistoricalStressSuite {
  kind: HistoricalStressSuiteKind
  name: string
  windowLengthYears: number
  windows: HistoricalStressWindow[]
  worstByEndingAfterTaxEstate: HistoricalStressWindow[]
  worstByTotalShortfall: HistoricalStressWindow[]
}

export interface HistoricalStressSuiteResult {
  windowLengthYears: number
  suites: HistoricalStressSuite[]
}

export interface HistoricalStressSuiteOptions extends SimulateOptions {
  equityWeightPct?: number
  windowLengthYears?: number
  suites?: readonly HistoricalStressSuiteKind[]
  classShocks?: boolean
  worstWindowCount?: number
}

function historicalReplaySeries(args: {
  startIndex: number
  windowLength: number
  projectionYears: number
  equityWeightPct: number
  reversed: boolean
  classShocks: boolean
}): { market: MarketSeries; marketYears: number[] } {
  const mean = meanPortfolioReturnPct(args.equityWeightPct)
  const meanStocks = meanPortfolioReturnPct(100)
  const meanBonds = meanPortfolioReturnPct(0)
  const returnShockPct: number[] = new Array(args.projectionYears)
  const inflationPct: number[] = new Array(args.projectionYears)
  const classSeries = args.classShocks
    ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(args.projectionYears)])) as Record<AssetClassId, number[]>)
    : null
  const marketYears: number[] = []

  for (let i = 0; i < args.projectionYears; i++) {
    const offset = i % args.windowLength
    const historicalIndex = args.reversed
      ? args.startIndex + args.windowLength - 1 - offset
      : args.startIndex + offset
    const sample = HISTORICAL_YEARS[historicalIndex]!
    marketYears.push(sample.year)
    returnShockPct[i] = portfolioReturnPct(sample, args.equityWeightPct) - mean
    inflationPct[i] = sample.inflationPct
    if (classSeries) {
      const stockShock = sample.stocksPct - meanStocks
      classSeries.usStocks[i] = stockShock
      classSeries.intlStocks[i] = stockShock
      classSeries.bonds[i] = sample.bondsPct - meanBonds
      classSeries.cash[i] = 0
    }
  }

  return {
    market: classSeries ? { returnShockPct, inflationPct, classReturnShockPct: classSeries } : { returnShockPct, inflationPct },
    marketYears,
  }
}

function total(result: ProjectionResult, pick: (year: ProjectionResult['years'][number]) => number): number {
  return result.years.reduce((sum, year) => sum + pick(year), 0)
}

function suiteName(kind: HistoricalStressSuiteKind, windowLength: number): string {
  return kind === 'rolling' ? `Rolling ${windowLength}-year historical windows` : `Reversed ${windowLength}-year historical windows`
}

export function runHistoricalStressSuites(plan: Plan, opts: HistoricalStressSuiteOptions): HistoricalStressSuiteResult {
  const baseline = simulatePlan(plan, { startYear: opts.startYear, taxCalculator: opts.taxCalculator })
  const projectionYears = baseline.years.length
  const windowLength = Math.max(
    1,
    Math.min(opts.windowLengthYears ?? projectionYears, HISTORICAL_YEARS.length),
  )
  const kinds = opts.suites ?? (['rolling', 'reversed'] as const)
  const lastStart = HISTORICAL_YEARS.length - windowLength
  const worstWindowCount = Math.max(1, opts.worstWindowCount ?? 5)
  const suites: HistoricalStressSuite[] = []

  for (const kind of kinds) {
    const reversed = kind === 'reversed'
    const windows: HistoricalStressWindow[] = []
    for (let startIndex = 0; startIndex <= lastStart; startIndex++) {
      const first = HISTORICAL_YEARS[startIndex]!
      const last = HISTORICAL_YEARS[startIndex + windowLength - 1]!
      const { market, marketYears } = historicalReplaySeries({
        startIndex,
        windowLength,
        projectionYears,
        equityWeightPct: opts.equityWeightPct ?? 60,
        reversed,
        classShocks: opts.classShocks ?? false,
      })
      const projection = simulatePlan(plan, { startYear: opts.startYear, taxCalculator: opts.taxCalculator, market })
      const summary = summarizeProjection(plan, projection)
      windows.push({
        suite: kind,
        label: reversed ? `${first.year}-${last.year} reversed` : `${first.year}-${last.year}`,
        startHistoricalYear: first.year,
        endHistoricalYear: last.year,
        reversed,
        marketYears,
        projection,
        summary,
        success: projection.depletionYear === null,
        totalShortfall: total(projection, (year) => year.shortfall),
        totalRequiredShortfall: total(projection, (year) => year.requiredShortfall),
        totalTargetShortfall: total(projection, (year) => year.targetShortfall),
      })
    }
    suites.push({
      kind,
      name: suiteName(kind, windowLength),
      windowLengthYears: windowLength,
      windows,
      worstByEndingAfterTaxEstate: [...windows]
        .sort((a, b) => a.summary.endingAfterTaxEstate - b.summary.endingAfterTaxEstate)
        .slice(0, worstWindowCount),
      worstByTotalShortfall: [...windows]
        .sort((a, b) => b.totalShortfall - a.totalShortfall || a.summary.endingAfterTaxEstate - b.summary.endingAfterTaxEstate)
        .slice(0, worstWindowCount),
    })
  }

  return { windowLengthYears: windowLength, suites }
}
