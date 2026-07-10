/** Fixed clock and deterministic entity ids so example golden tests stay stable. */

export const EXAMPLE_FIXED_NOW_ISO = '2026-06-29T12:00:00.000Z'

export function exampleFixedNow(): Date {
  return new Date(EXAMPLE_FIXED_NOW_ISO)
}

export const EXAMPLE_FIXED_YEAR = 2026

/** Stable ids within an example plan (not the IndexedDB plan id). */
export function exampleEntityId(exampleId: string, suffix: string): string {
  return `${exampleId}--${suffix}`
}

/** Deterministic `newId` for createEmptyPlan — resets on each build() call. */
export function exampleIdFactory(exampleId: string): () => string {
  let index = 0
  return () => exampleEntityId(exampleId, `seq-${index++}`)
}
