/**
 * Engine refusals and failures, in plain words with a next step, for the
 * pages that run the engine in a worker or show a preview (PR #754): the
 * Insights card preview, the Roth & Tax Optimizer and the relocation compare.
 * A typed refusal (../workers/refusal.ts) is said in the page's own words and
 * never in the engine's; an error nothing recognises gets a plain sentence
 * that keeps the error's own text as a labelled detail, so a crash can still
 * be reported. A runtime with no Web Worker (../workers/spawn.ts) gets its own
 * reason alone: "run it again" cannot help there.
 */

import { engineRefusalOf, type ComparandRole } from '../workers/refusal'
import { WORKER_UNAVAILABLE_MESSAGE, WorkerUnavailableError } from '../workers/spawn'

function unknownDetail(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.trim() === '' ? '' : ` If it fails again, this detail helps us fix it: ${text}`
}

/**
 * Whether a failure well may offer "Run again", from the detail text it shows
 * (the pages keep a failure as the string they print). Not when this runtime
 * has no Web Worker: running again cannot help there, so the well shows the
 * reason alone.
 */
export function canRunAgain(detail: string): boolean {
  return detail !== WORKER_UNAVAILABLE_MESSAGE
}

/** The Insights card's preview: what to show when the preview could not be worked out. */
export function insightPreviewErrorSentence(error: unknown): string {
  if (error instanceof WorkerUnavailableError) return error.message
  const refusal = engineRefusalOf(error)
  if (refusal?.kind === 'insight-preview-unavailable') return refusal.message
  if (refusal?.kind === 'monte-carlo-runs') {
    const differ =
      refusal.reason === 'path-counts-differ'
        ? 'came from different numbers of simulated markets'
        : 'came from simulations that start in different years'
    return `The Monte Carlo line isn't shown: your plan's success rate and the preview's ${differ}. Preview again to run both on the same markets.`
  }
  if (refusal?.kind === 'non-finite-figure') {
    const what: Record<ComparandRole, string> = {
      baseline: "one of your plan's figures could not be computed. Check your plan's Results page",
      proposal: "one of the previewed plan's figures could not be computed. Check your plan's inputs",
      difference: "the change between your plan and the preview could not be computed. Check your plan's Results page",
    }
    return `No preview is shown for this insight: ${what[refusal.role]}, then preview again.`
  }
  return "No preview is shown for this insight: it could not be worked out for your plan. Preview it again; if it still fails, check your plan's Results page."
}

/** The Roth & Tax Optimizer's failure well. */
export function optimizeErrorSentence(error: unknown): string {
  if (error instanceof WorkerUnavailableError) return error.message
  const refusal = engineRefusalOf(error)
  if (refusal?.kind === 'non-finite-figure') {
    return "The optimizer couldn't finish this run: one of the figures it compares could not be computed. Check your plan's inputs and its Results page, then run the optimizer again."
  }
  if (refusal !== null) {
    return "The optimizer couldn't finish this run: part of the comparison it needs could not be made. Run the optimizer again."
  }
  return `The optimizer couldn't finish this run. Run it again.${unknownDetail(error)}`
}

/** The relocation compare's error line. */
export function relocationErrorSentence(error: unknown): string {
  if (error instanceof WorkerUnavailableError) return error.message
  const refusal = engineRefusalOf(error)
  if (refusal?.kind === 'non-finite-figure') {
    const what: Record<ComparandRole, string> = {
      baseline: "one of your plan's figures could not be computed. Check your plan's Results page",
      proposal: "one of a candidate state's figures could not be computed. Check that state's details",
      difference: "the difference between a state and your plan could not be computed. Check the states' details",
    }
    return `The states couldn't be compared: ${what[refusal.role]}, then compare again.`
  }
  if (refusal !== null) {
    return "The states couldn't be compared: part of the comparison could not be made. Compare again."
  }
  return `The states couldn't be compared. Compare again.${unknownDetail(error)}`
}
