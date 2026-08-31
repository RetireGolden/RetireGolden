/**
 * Operator-input failures for `equivalence.mjs`. Kept off `equivalence.mjs`
 * itself so the UsageError path can be tested without importing the CLI
 * (which loads the Node 24 engine-tree hook on startup).
 */
import { selectModes } from './modes.mjs'

export class UsageError extends Error {}

export const REACH_SPEC_SCHEMA = 'retiregolden.equivalence-reach-spec/1'

/** Operator `--modes` typos must hit the UsageError path, not a raw stack. */
export function modesFromFlag(flag) {
  try {
    return selectModes(flag.split(',').map((id) => id.trim()).filter((id) => id !== ''))
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }
}

/** @param {{ schema?: unknown }} spec @param {string} path */
export function assertReachSpecSchema(spec, path) {
  if (spec.schema !== REACH_SPEC_SCHEMA) {
    throw new UsageError(`${path} is not a ${REACH_SPEC_SCHEMA} spec (found "${spec.schema}")`)
  }
}
