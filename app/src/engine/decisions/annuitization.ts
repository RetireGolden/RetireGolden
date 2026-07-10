/**
 * Annuitization sweep solver (annuity-pension-and-home-equity decisions,
 * step 2): how much of the portfolio to trade for a SPIA?
 *
 * Sweeps a bounded grid of allocation percentages through the shared-path
 * Monte Carlo primitive: each point adds a life-only SPIA purchase (funded
 * from the largest liquid account, priced at the sourced default payout rate
 * or a user-entered quote) and reports success-rate / estate metrics against
 * the 0% point — a success-vs-legacy frontier on identical market paths.
 *
 * Kitces attribution: much of a SPIA's measured benefit is the implicit
 * rising-equity glidepath — the bond-like premium leaves the portfolio, so
 * the remaining dollars run at a higher equity share. To isolate it, each
 * point (when the funding account carries a static allocation with enough
 * bonds) also evaluates a control variant that shifts the same premium from
 * bonds to US stocks WITHOUT buying the annuity: control − baseline is the
 * glidepath share of the benefit, point − control is what annuitization adds
 * beyond it (mortality credits and payout floor, net of lost liquidity).
 * Everything is priced on the exact ledger inside the Monte Carlo runner —
 * the sweep never decides, it measures.
 */

import type { Account, Plan } from '../model/plan'
import { comparePlansOnSharedMarketPaths, type SharedPathComparisonOptions, type SharedPathPlan } from '../montecarlo/sharedPaths'
import { MAX_FRONTIER_POINTS } from '../montecarlo/frontiers'
import { spiaPayoutRate } from './spiaQuotes'

export interface AnnuitizationPointMetrics {
  successRate: number
  requiredFloorSuccessRate: number
  targetLifestyleSuccessRate: number
  p10EndingAfterTaxEstate: number
  medianEndingAfterTaxEstate: number
  expectedShortfallDollars: number
}

export interface AnnuitizationSweepPoint {
  /** Requested grid percent of total investable assets (unique point key). */
  allocationPct: number
  /**
   * Share of total investable assets the premium actually represents
   * (premium ÷ investable). Lower than `allocationPct` when the funding
   * account caps the purchase — retirement-heavy plans can request 30% but
   * only fund what the largest liquid account holds. Charts plot this.
   */
  effectiveAllocationPct: number
  /** SPIA premium this point trades away (nominal, at the start year). */
  premium: number
  /** Annual annuity income the premium buys at the quoted rate. */
  annualIncome: number
  metrics: AnnuitizationPointMetrics
  /** Allocation-matched control (glidepath without the annuity); absent when not constructible. */
  glidepathControl?: AnnuitizationPointMetrics
}

export interface AnnuitizationSweep {
  points: AnnuitizationSweepPoint[]
  /** Age payments start (max(current age, 65)) and the payout rate used. */
  startAge: number
  payoutRatePct: number
  /** 'default-table' or 'user-quote' — where the payout rate came from. */
  rateSource: 'default-table' | 'user-quote'
  /**
   * True when the glidepath controls could be built (static-allocation funding
   * account with bond weight to shift); the Kitces attribution columns are
   * only meaningful then.
   */
  attributionAvailable: boolean
  /** Why the sweep is empty or attribution is missing, for the UI. */
  notes: string[]
}

export interface AnnuitizationSweepConfig {
  /** Allocation grid (percent of investable). Bounded by MAX_FRONTIER_POINTS budget. */
  allocationPcts?: readonly number[]
  /** User-entered annual payout rate (percent of premium) overriding the default table. */
  quotedPayoutRatePct?: number
}

const DEFAULT_GRID = [0, 5, 10, 15, 20, 25, 30] as const

function dobYear(dob: string): number {
  return Number(dob.slice(0, 4))
}

function accountBalance(account: Account): number {
  return 'balance' in account ? account.balance : 0
}

function metricsFromRow(row: { summary: { successRate: number; requiredFloorSuccessRate: number; targetLifestyleSuccessRate: number; endingAfterTaxEstate: { percentiles: { p10: number; p50: number } }; downsideRisk: { expectedShortfallDollars: number } } }): AnnuitizationPointMetrics {
  return {
    successRate: row.summary.successRate,
    requiredFloorSuccessRate: row.summary.requiredFloorSuccessRate,
    targetLifestyleSuccessRate: row.summary.targetLifestyleSuccessRate,
    p10EndingAfterTaxEstate: row.summary.endingAfterTaxEstate.percentiles.p10,
    medianEndingAfterTaxEstate: row.summary.endingAfterTaxEstate.percentiles.p50,
    expectedShortfallDollars: row.summary.downsideRisk.expectedShortfallDollars,
  }
}

/** Sum of liquid + retirement balances the sweep sizes premiums against. */
function investableTotal(plan: Plan): number {
  let total = 0
  for (const account of plan.accounts) {
    if (
      account.type === 'cash' ||
      account.type === 'taxable' ||
      account.type === 'equityComp' ||
      account.type === 'traditional' ||
      account.type === 'roth' ||
      account.type === 'hsa'
    ) {
      total += accountBalance(account)
    }
  }
  return total
}

export function buildAnnuitizationSweep(
  plan: Plan,
  opts: SharedPathComparisonOptions,
  config: AnnuitizationSweepConfig = {},
): AnnuitizationSweep {
  const notes: string[] = []
  const grid = [...(config.allocationPcts ?? DEFAULT_GRID)].sort((a, b) => a - b)
  const primary = plan.household.people[0]
  const funding = plan.accounts
    .filter((a) => a.type === 'cash' || a.type === 'taxable')
    .sort((a, b) => accountBalance(b) - accountBalance(a))[0]
  const total = investableTotal(plan)
  if (!primary || !funding || total <= 0) {
    return {
      points: [],
      startAge: 65,
      payoutRatePct: 0,
      rateSource: 'default-table',
      attributionAvailable: false,
      notes: ['The sweep needs a household member and a cash or taxable account to fund purchases from.'],
    }
  }

  const currentAge = opts.startYear - dobYear(primary.dob)
  const startAge = Math.min(95, Math.max(currentAge, 65))
  const rateSource: AnnuitizationSweep['rateSource'] = config.quotedPayoutRatePct !== undefined ? 'user-quote' : 'default-table'
  const payoutRate = config.quotedPayoutRatePct !== undefined ? config.quotedPayoutRatePct / 100 : spiaPayoutRate(startAge)

  // Premiums cap at what the funding account can actually pay (leaving 5% so
  // the purchase never zeroes the household's most liquid account).
  const fundingCap = accountBalance(funding) * 0.95
  const nonZeroPcts = grid.filter((pct) => pct > 0)

  // Attribution controls need a static allocation on the funding account so
  // "sell bonds for the SPIA" has a concrete meaning.
  const fundingAllocation = 'allocation' in funding ? funding.allocation : undefined
  const staticWeights = fundingAllocation?.mode === 'static' ? fundingAllocation.weights : undefined
  if (!staticWeights) {
    notes.push(
      'Glidepath attribution needs a static asset allocation on the funding account (so shifting the premium out of bonds is well-defined); controls were skipped.',
    )
  }

  // Budget: 1 baseline + a SPIA variant and (when constructible) a control per
  // non-zero point, inside the shared-path frontier cap.
  const budgetPerPoint = staticWeights ? 2 : 1
  const maxPoints = Math.floor((MAX_FRONTIER_POINTS - 1) / budgetPerPoint)
  const pcts = nonZeroPcts.slice(0, maxPoints)
  if (pcts.length < nonZeroPcts.length) {
    notes.push(`The allocation grid was truncated to ${pcts.length} points to stay inside the bounded sweep budget.`)
  }

  const variants: SharedPathPlan[] = [{ id: 'annuitize-0', label: '0% (no annuity)', plan }]
  const pointMeta: Array<{ pct: number; premium: number; annualIncome: number; controlId?: string }> = []

  for (const pct of pcts) {
    const premium = Math.min((pct / 100) * total, fundingCap)
    if (premium < 5_000) continue
    const annualIncome = premium * payoutRate
    const spia: Account = {
      id: `annuitize-sweep-${opts.startYear}-${funding.id}-${pct}`,
      type: 'annuity',
      name: `SPIA sweep ${pct}%`,
      ownerPersonId: primary.id,
      annualReturnPct: null,
      startAge,
      monthlyAmount: annualIncome / 12,
      colaPct: 0,
      taxablePct: 100,
      purchase: { year: opts.startYear, premium, fundingAccountId: funding.id, taxQualification: 'nonQualified' },
    }
    variants.push({
      id: `annuitize-${pct}`,
      label: `${pct}% annuitized`,
      plan: { ...plan, accounts: [...plan.accounts, spia] },
    })
    let controlId: string | undefined
    if (staticWeights) {
      // Shift the premium's dollars from bonds to US stocks inside the funding
      // account — the rising-equity glidepath a bond-funded SPIA buyer gets,
      // without the annuity. Clamped to the bonds actually there.
      const balance = accountBalance(funding)
      const shiftPct = balance > 0 ? Math.min((premium / balance) * 100, staticWeights.bonds) : 0
      if (shiftPct > 0.5) {
        controlId = `glidepath-${pct}`
        const shiftedFunding = {
          ...funding,
          allocation: {
            ...fundingAllocation!,
            weights: {
              ...staticWeights,
              bonds: staticWeights.bonds - shiftPct,
              usStocks: Math.min(100, staticWeights.usStocks + shiftPct),
            },
          },
        } as Account
        variants.push({
          id: controlId,
          label: `${pct}% glidepath control`,
          plan: { ...plan, accounts: plan.accounts.map((a) => (a.id === funding.id ? shiftedFunding : a)) },
        })
      }
    }
    pointMeta.push({ pct, premium, annualIncome, controlId })
  }

  const comparison = comparePlansOnSharedMarketPaths(variants, opts)
  const rowById = new Map(comparison.rows.map((row) => [row.id, row]))
  const baselineRow = rowById.get('annuitize-0')
  if (!baselineRow) return { points: [], startAge, payoutRatePct: payoutRate * 100, rateSource, attributionAvailable: false, notes }

  const points: AnnuitizationSweepPoint[] = [
    { allocationPct: 0, effectiveAllocationPct: 0, premium: 0, annualIncome: 0, metrics: metricsFromRow(baselineRow) },
  ]
  let anyControl = false
  let anyCapped = false
  for (const meta of pointMeta) {
    const row = rowById.get(`annuitize-${meta.pct}`)
    if (!row) continue
    const controlRow = meta.controlId ? rowById.get(meta.controlId) : undefined
    if (controlRow) anyControl = true
    const effectiveAllocationPct = total > 0 ? (meta.premium / total) * 100 : 0
    if (effectiveAllocationPct < meta.pct - 0.05) anyCapped = true
    points.push({
      allocationPct: meta.pct,
      effectiveAllocationPct,
      premium: meta.premium,
      annualIncome: meta.annualIncome,
      metrics: metricsFromRow(row),
      glidepathControl: controlRow ? metricsFromRow(controlRow) : undefined,
    })
  }
  if (anyCapped) {
    notes.push(
      'Some grid points were capped by the funding account (the largest cash/taxable balance): the reported share is the premium actually funded ÷ investable assets, not the requested grid value.',
    )
  }

  return { points, startAge, payoutRatePct: payoutRate * 100, rateSource, attributionAvailable: anyControl, notes }
}
