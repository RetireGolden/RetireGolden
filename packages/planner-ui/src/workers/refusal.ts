/**
 * Typed engine refusals, carried across the worker boundary (PR #754).
 *
 * The engine refuses some inputs with typed errors that say what went wrong:
 * a figure that is not a finite number (`NonFiniteComparisonError`, with the
 * operand's role), a pair of plans the Compare page cannot compare
 * (`PlanHeadlineRefusal`, with the reason and side), two Monte Carlo runs that
 * do not share their paths (`MonteCarloComparisonRefusal`, with the reason),
 * and a detector that found nothing to preview (`InsightPreviewUnavailable`,
 * with a message written for the reader). An error's class does not survive
 * `postMessage`, so the worker posts the refusal as plain data beside the
 * message, and the runner rebuilds a `WorkerRefusalError` carrying it. Pages
 * read either kind through `engineRefusalOf` and say it in plain words.
 *
 * A leaf module: the errors are recognised by the `name` each engine class
 * sets and the fields it carries, so importing this pulls no engine code into
 * a page's chunk.
 */

export type ComparandRole = 'baseline' | 'proposal' | 'difference'

export type EngineRefusal =
  | { kind: 'non-finite-figure'; role: ComparandRole }
  | { kind: 'plan-headline'; reason: 'start-years-differ' | 'birth-date-missing'; side: 'baseline' | 'proposal' | null }
  | { kind: 'monte-carlo-runs'; reason: 'path-counts-differ' | 'start-years-differ' }
  | { kind: 'insight-preview-unavailable'; message: string }

/** An error rebuilt on the page's thread from a worker error that carried a typed refusal. */
export class WorkerRefusalError extends Error {
  readonly refusal: EngineRefusal

  constructor(message: string, refusal: EngineRefusal) {
    super(message)
    this.name = 'WorkerRefusalError'
    this.refusal = refusal
  }
}

const ROLES: readonly string[] = ['baseline', 'proposal', 'difference']

function field(error: Error, key: string): unknown {
  return (error as unknown as Record<string, unknown>)[key]
}

/** The typed engine refusal an error carries, thrown on this thread or rebuilt from a worker message; null otherwise. */
export function engineRefusalOf(error: unknown): EngineRefusal | null {
  if (error instanceof WorkerRefusalError) return error.refusal
  if (!(error instanceof Error)) return null
  switch (error.name) {
    case 'NonFiniteComparisonError': {
      const role = field(error, 'role')
      return typeof role === 'string' && ROLES.includes(role) ? { kind: 'non-finite-figure', role: role as ComparandRole } : null
    }
    case 'PlanHeadlineRefusal': {
      const reason = field(error, 'reason')
      const side = field(error, 'side')
      if (reason !== 'start-years-differ' && reason !== 'birth-date-missing') return null
      if (side !== null && side !== 'baseline' && side !== 'proposal') return null
      return { kind: 'plan-headline', reason, side }
    }
    case 'MonteCarloComparisonRefusal': {
      const reason = field(error, 'reason')
      return reason === 'path-counts-differ' || reason === 'start-years-differ' ? { kind: 'monte-carlo-runs', reason } : null
    }
    case 'InsightPreviewUnavailable':
      return { kind: 'insight-preview-unavailable', message: error.message }
    default:
      return null
  }
}

/** The error message a worker posts: the message, and the typed refusal when the error carries one. */
export function workerErrorMessage(error: unknown): { type: 'error'; message: string; refusal?: EngineRefusal } {
  const message = error instanceof Error ? error.message : String(error)
  const refusal = engineRefusalOf(error)
  return refusal === null ? { type: 'error', message } : { type: 'error', message, refusal }
}

/** The error a runner rejects with for a worker's error message. */
export function errorFromWorkerMessage(message: string, refusal: EngineRefusal | undefined): Error {
  return refusal === undefined ? new Error(message) : new WorkerRefusalError(message, refusal)
}
