/**
 * HUD-validated HECM line state: observed servicer baseline vs modeled draw debt.
 *
 * Servicer-ledger balances replace only `observedServicingBaseline`. Coordinated
 * and backstop draws increment `modeledDebt` via `applyHudModeledDraw` at the
 * funding commit sites (and via capture inference when legacy callers only
 * mutate `loanBalance`). `loanBalance` is always baseline + modeled.
 */
import type { HecmLineState } from './hecmLineOpenings.js'

export type HecmCalculationMode = 'legacyQuoteEstimate' | 'hudValidated'

/**
 * A modeled draw has no dated servicing event in the plan. Applying the
 * annual growth multiplier therefore remains a disclosed planning estimate,
 * even when the observed servicer ledger itself is complete.
 */
export const HECM_MODELED_DEBT_TIMING_ISSUE =
  'Modeled HECM draw debt uses an annual planning estimate because draw/accrual timing evidence is unavailable.'

/** Live HECM line state including optional HUD debt components. */
export type HecmLineStateWithComponents = HecmLineState

export interface HudHecmYearEndComponents {
  readonly observedServicingBaseline: number
  readonly modeledDebt: number
  readonly loanBalance: number
}

export function isHudValidatedHecmLine(
  line: Readonly<HecmLineStateWithComponents>,
): boolean {
  return line.calculationMode === 'hudValidated'
}

/** Initialize HUD split state at opening; closing advance is already in baseline. */
export function initializeHudObservedBaseline(
  line: HecmLineStateWithComponents,
  openingLoanBalance: number,
): void {
  line.observedServicingBaseline = openingLoanBalance
  line.modeledDebt = 0
  line.loanBalance = openingLoanBalance
}

/** Reconcile modeled debt from total minus observed before servicing updates. */
export function captureHudModeledDebtFromLoanBalance(
  line: HecmLineStateWithComponents,
): void {
  if (!isHudValidatedHecmLine(line)) return
  const baseline = line.observedServicingBaseline ?? line.loanBalance
  line.observedServicingBaseline = baseline
  line.modeledDebt = Math.max(0, line.loanBalance - baseline)
  syncHudLoanBalance(line)
}

/** Increment modeled draw debt once; use when the caller can route draws here. */
export function applyHudModeledDraw(
  line: HecmLineStateWithComponents,
  amount: number,
): void {
  if (!isHudValidatedHecmLine(line) || amount <= 0) {
    line.loanBalance += amount
    return
  }
  if (line.observedServicingBaseline === undefined) {
    initializeHudObservedBaseline(line, line.loanBalance)
  }
  line.modeledDebt = (line.modeledDebt ?? 0) + amount
  syncHudLoanBalance(line)
}

export function compoundHudModeledDebt(
  line: HecmLineStateWithComponents,
  growthMultiplier: number,
): void {
  if (!isHudValidatedHecmLine(line)) return
  line.modeledDebt = (line.modeledDebt ?? 0) * growthMultiplier
  syncHudLoanBalance(line)
}

export function applyHudObservedServicingBaseline(
  line: HecmLineStateWithComponents,
  newBaseline: number,
): void {
  if (!isHudValidatedHecmLine(line)) return
  line.observedServicingBaseline = newBaseline
  syncHudLoanBalance(line)
}

/** Documented note+MIP estimate when the servicer ledger is incomplete. */
export function estimateHudObservedBaselineGrowth(
  line: HecmLineStateWithComponents,
  growthMultiplier: number,
): void {
  if (!isHudValidatedHecmLine(line)) return
  const baseline = line.observedServicingBaseline ?? line.loanBalance
  line.observedServicingBaseline = baseline * growthMultiplier
  syncHudLoanBalance(line)
}

export function syncHudLoanBalance(line: HecmLineStateWithComponents): void {
  if (!isHudValidatedHecmLine(line)) return
  if (line.observedServicingBaseline === undefined) return
  line.loanBalance = line.observedServicingBaseline + (line.modeledDebt ?? 0)
}

/** Copy computed year-end HUD components onto a live line (no recompute). */
export function commitHudYearEndFromComputed(
  line: HecmLineStateWithComponents,
  growthMultiplier: number | null,
  ending: Readonly<HudHecmYearEndComponents>,
): void {
  if (growthMultiplier !== null) {
    line.principalLimit *= growthMultiplier
  }
  line.observedServicingBaseline = ending.observedServicingBaseline
  line.modeledDebt = ending.modeledDebt
  line.loanBalance = ending.loanBalance
}

/** Apply a HUD year-end close on shadow line state during row production. */
export function applyHudYearEndComponents(
  line: HecmLineStateWithComponents,
  growthMultiplier: number,
  observedBaselineEnding: number,
  modeledDebtEnding: number,
): HudHecmYearEndComponents {
  if (!isHudValidatedHecmLine(line)) {
    line.principalLimit *= growthMultiplier
    line.loanBalance *= growthMultiplier
    return {
      observedServicingBaseline: line.loanBalance,
      modeledDebt: 0,
      loanBalance: line.loanBalance,
    }
  }
  captureHudModeledDebtFromLoanBalance(line)
  line.principalLimit *= growthMultiplier
  line.observedServicingBaseline = observedBaselineEnding
  line.modeledDebt = modeledDebtEnding
  syncHudLoanBalance(line)
  return {
    observedServicingBaseline: line.observedServicingBaseline,
    modeledDebt: line.modeledDebt ?? 0,
    loanBalance: line.loanBalance,
  }
}

export function computeHudYearEndFromServicing(
  line: Readonly<HecmLineStateWithComponents>,
  growthMultiplier: number,
  mip:
    | { readonly status: 'complete'; readonly endingLoanBalance: number; readonly totalMipAccrued: number }
    | { readonly status: 'timingEvidenceIncomplete' },
): HudHecmYearEndComponents & {
  readonly totalMipAccrued: number | null
  readonly incompleteReason: string | null
} {
  // The servicer ledger can replace only the observed baseline. Modeled debt
  // has no draw/accrual dates, so its annual multiplier is always a disclosed
  // planning estimate; the close publishes HECM incomplete whenever it is
  // nonzero, including when `mip.status` is complete.
  const baselineStart = line.observedServicingBaseline ?? line.loanBalance
  const modeledStart = Math.max(0, line.loanBalance - baselineStart)
  const modeledEnding = modeledStart * growthMultiplier
  if (mip.status === 'complete') {
    return {
      observedServicingBaseline: mip.endingLoanBalance,
      modeledDebt: modeledEnding,
      loanBalance: mip.endingLoanBalance + modeledEnding,
      totalMipAccrued: mip.totalMipAccrued,
      incompleteReason: null,
    }
  }
  const estimatedBaseline = baselineStart * growthMultiplier
  return {
    observedServicingBaseline: estimatedBaseline,
    modeledDebt: modeledEnding,
    loanBalance: estimatedBaseline + modeledEnding,
    totalMipAccrued: null,
    incompleteReason: 'timingEvidenceIncomplete',
  }
}

/** Rollback-safe clone including HUD component fields when present. */
export function cloneHecmLineStateForRollback(
  value: Readonly<HecmLineStateWithComponents>,
): HecmLineStateWithComponents {
  return {
    principalLimit: value.principalLimit,
    loanBalance: value.loanBalance,
    ...(value.calculationMode !== undefined ? { calculationMode: value.calculationMode } : {}),
    ...(value.observedServicingBaseline !== undefined
      ? { observedServicingBaseline: value.observedServicingBaseline }
      : {}),
    ...(value.modeledDebt !== undefined ? { modeledDebt: value.modeledDebt } : {}),
    ...(value.annualMipRate !== undefined ? { annualMipRate: value.annualMipRate } : {}),
    ...(value.maximumClaimAmount !== undefined
      ? { maximumClaimAmount: value.maximumClaimAmount }
      : {}),
    ...(value.initialMip !== undefined ? { initialMip: value.initialMip } : {}),
    ...(value.otherClosingCosts !== undefined
      ? { otherClosingCosts: value.otherClosingCosts }
      : {}),
    ...(value.caseParameterYear !== undefined
      ? { caseParameterYear: value.caseParameterYear }
      : {}),
    ...(value.principalLimitFactorProvenance !== undefined
      ? { principalLimitFactorProvenance: value.principalLimitFactorProvenance }
      : {}),
  }
}
