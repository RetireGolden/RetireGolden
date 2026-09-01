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

/**
 * Refuse positional reach ranges whose checked source text has drifted. Specs
 * must carry multiple exact, trimmed line anchors per entry so insertions above
 * a range and edits inside it fail before coverage is collected.
 *
 * @param {readonly object[]} entries resolved reach entries
 * @param {string} path operator-facing spec path
 * @param {(file: string) => string} readSource injected for CLI tests
 */
export function assertReachEntryAnchors(entries, path, readSource) {
  for (const entry of entries) {
    if (!Array.isArray(entry.anchors) || entry.anchors.length === 0) {
      throw new UsageError(
        `${path} entry "${entry.id}" must anchor its positional source range`,
      )
    }
    const rows = readSource(entry.file).split('\n')
    for (const anchor of entry.anchors) {
      const line = anchor?.line
      const text = anchor?.text
      if (!Number.isInteger(line) || typeof text !== 'string' || text.trim() === '') {
        throw new UsageError(`${path} entry "${entry.id}" has an invalid content anchor`)
      }
      if (line < entry.lines[0] || line > entry.lines[1]) {
        throw new UsageError(
          `${path} entry "${entry.id}" anchor line ${line} is outside ` +
          `its ${entry.lines[0]}-${entry.lines[1]} range`,
        )
      }
      const actual = rows[line - 1]?.trim()
      if (actual !== text) {
        throw new UsageError(
          `${path} entry "${entry.id}" is stale at ${entry.file}:${line}: ` +
          `expected ${JSON.stringify(text)}, found ${JSON.stringify(actual ?? '(missing line)')}`,
        )
      }
    }
  }
}
