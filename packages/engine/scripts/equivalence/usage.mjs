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
 * Locate each positional reach range by a unique content-anchor delta so an
 * insertion/deletion above a block, or a verbatim move to another file path,
 * does not require rewriting committed line numbers. Edits that change the
 * relative spacing of the recorded anchors still fail closed.
 *
 * @param {readonly object[]} entries path-resolved reach entries
 * @param {string} path operator-facing spec path
 * @param {(file: string) => string} readSource injected for CLI tests
 * @returns {object[]} entries whose `lines` and every anchor `line` are shifted
 *   by the unique matching delta
 */
export function resolveReachSpecEntries(entries, path, readSource) {
  const candidates = entries.map((entry) =>
    resolveReachSpecEntryCandidates(entry, path, readSource),
  )
  const candidatesByFile = Map.groupBy(candidates, (candidate) => candidate.entry.file)

  return candidates.map((candidate) => {
    if (candidate.validMatches.length === 1) {
      return applyReachSpecMatch(candidate.entry, candidate.validMatches[0])
    }

    const fileCandidates = candidatesByFile.get(candidate.entry.file) ?? []
    const sharedDeltas = candidate.validMatches
      .map((match) => match.delta)
      .filter((delta) => fileCandidates.every((peer) =>
        peer.validMatches.some((match) => match.delta === delta),
      ))
    if (sharedDeltas.length === 1) {
      const sharedMatch = candidate.validMatches.find(
        (match) => match.delta === sharedDeltas[0],
      )
      return applyReachSpecMatch(candidate.entry, sharedMatch)
    }

    const deltas = [...new Set(candidate.validMatches.map((match) => match.delta))]
    throw new UsageError(
      `${path} entry "${candidate.entry.id}" has ${candidate.validMatches.length} ` +
      `ambiguous content-anchor matches in ${candidate.entry.file} ` +
      `(deltas ${deltas.join(', ')})`,
    )
  })
}

/**
 * Refuse resolved reach ranges whose checked source text has drifted. Specs
 * must carry exact, trimmed line anchors so a resolved entry still names the
 * measured source text before coverage is collected.
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
    assertReachRangeIsValid(entry, path, rows.length)
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

/**
 * @param {object} entry
 * @param {string} path
 * @param {(file: string) => string} readSource
 */
function resolveReachSpecEntryCandidates(entry, path, readSource) {
  if (!Array.isArray(entry.anchors) || entry.anchors.length === 0) {
    throw new UsageError(
      `${path} entry "${entry.id}" must anchor its positional source range`,
    )
  }

  const recordedAnchors = []
  for (const anchor of entry.anchors) {
    const line = anchor?.line
    const text = typeof anchor?.text === 'string' ? anchor.text.trim() : ''
    if (!Number.isInteger(line) || text === '') {
      throw new UsageError(`${path} entry "${entry.id}" has an invalid content anchor`)
    }
    recordedAnchors.push({ line, text })
  }

  const [rangeStart, rangeEnd] = entry.lines ?? []
  if (
    !Number.isInteger(rangeStart) ||
    !Number.isInteger(rangeEnd) ||
    rangeStart < 1 ||
    rangeEnd < rangeStart
  ) {
    throw new UsageError(`${path} entry "${entry.id}" has an invalid source range`)
  }

  for (const anchor of recordedAnchors) {
    if (anchor.line < rangeStart || anchor.line > rangeEnd) {
      throw new UsageError(
        `${path} entry "${entry.id}" anchor line ${anchor.line} is outside ` +
        `its ${rangeStart}-${rangeEnd} range`,
      )
    }
  }

  const rows = readSource(entry.file).split('\n')
  const first = recordedAnchors[0]
  const candidateLines = []
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].trim() === first.text) candidateLines.push(index + 1)
  }

  if (candidateLines.length === 0) {
    throw new UsageError(
      `${path} entry "${entry.id}" has 0 content-anchor matches in ${entry.file}`,
    )
  }

  /** @type {number[]} */
  const textMatchedDeltas = []
  /** @type {{ delta: number, lines: [number, number], anchors: {line: number, text: string}[] }[]} */
  const validMatches = []

  for (const candidateLine of candidateLines) {
    const delta = candidateLine - first.line
    let anchorsMatch = true
    for (const anchor of recordedAnchors) {
      const shiftedLine = anchor.line + delta
      if (rows[shiftedLine - 1]?.trim() !== anchor.text) {
        anchorsMatch = false
        break
      }
    }
    if (!anchorsMatch) continue
    textMatchedDeltas.push(delta)

    const shiftedLines = /** @type {[number, number]} */ ([rangeStart + delta, rangeEnd + delta])
    const shiftedAnchors = recordedAnchors.map((anchor) => ({
      line: anchor.line + delta,
      text: anchor.text,
    }))
    if (!isValidShiftedReachRange(shiftedLines, shiftedAnchors, rows.length)) continue
    validMatches.push({ delta, lines: shiftedLines, anchors: shiftedAnchors })
  }

  if (validMatches.length > 0) return { entry, validMatches }

  if (textMatchedDeltas.length > 0) {
    throw new UsageError(
      `${path} entry "${entry.id}" content-anchor match yields an invalid shifted ` +
      `range in ${entry.file}`,
    )
  }

  throw new UsageError(
    `${path} entry "${entry.id}" has inconsistent relative anchor layout in ${entry.file}`,
  )
}

/** @param {object} entry @param {{lines: [number, number], anchors: object[]}} match */
function applyReachSpecMatch(entry, match) {
  return {
    ...entry,
    lines: match.lines,
    anchors: match.anchors,
  }
}

/**
 * @param {object} entry
 * @param {string} path
 * @param {number} rowCount
 */
function assertReachRangeIsValid(entry, path, rowCount) {
  const [rangeStart, rangeEnd] = entry.lines ?? []
  if (
    !Number.isInteger(rangeStart) ||
    !Number.isInteger(rangeEnd) ||
    rangeStart < 1 ||
    rangeEnd < rangeStart ||
    rangeEnd > rowCount
  ) {
    throw new UsageError(`${path} entry "${entry.id}" has an invalid source range`)
  }
}

/**
 * @param {[number, number]} lines
 * @param {readonly {line: number, text: string}[]} anchors
 * @param {number} rowCount
 */
function isValidShiftedReachRange(lines, anchors, rowCount) {
  const [rangeStart, rangeEnd] = lines
  if (
    !Number.isInteger(rangeStart) ||
    !Number.isInteger(rangeEnd) ||
    rangeStart < 1 ||
    rangeEnd < rangeStart ||
    rangeEnd > rowCount
  ) {
    return false
  }
  for (const anchor of anchors) {
    if (anchor.line < rangeStart || anchor.line > rangeEnd) return false
  }
  return true
}
