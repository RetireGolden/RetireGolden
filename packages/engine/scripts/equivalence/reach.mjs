/**
 * Line-range REACH over a corpus, from V8 precise coverage.
 *
 * WHY THIS IS PART OF THE TOOL. A differential dump's PASS condition is
 * "nothing moved". A corpus that never executes a branch produces a PASS for
 * that branch no matter what happens to it, and no amount of hashing exposes
 * the difference. So before a baseline is trusted, the corpus has to be shown
 * to REACH the code under change — per branch, not per file.
 *
 * WHY NOT INSTRUMENTATION. Editing `simulate.ts` to count hits would mean
 * capturing a baseline from a tree that is not the tree being shipped, and
 * would leave a revert to get wrong. V8's own precise coverage counts execution
 * of the UNMODIFIED source, so the tree stays byte-clean throughout.
 *
 * TWO READINGS, because one of them is not enough.
 *
 *   LINE COUNTS answer "did this line ever run". A line's count is the count of
 *   the smallest V8 range containing that line's FIRST NON-WHITESPACE
 *   character. Anchoring on the first character rather than on any character in
 *   the line matters: a zero-count range that begins mid-line — the untaken
 *   right operand of a `??`, the `continue` of a one-line guard — must not make
 *   the whole line look unexecuted. That mistake was made and measured here
 *   before this note existed: line 1994 of `simulate.ts` reported cold on a
 *   corpus that ran it thousands of times, because `?? null` was never taken.
 *
 *   COLD REGIONS answer the question line counts CANNOT: which sub-line
 *   branches were never taken. This is where a one-line `if (...) continue`
 *   whose `continue` never fires shows up — and it is the only place it can.
 *
 * COLD REGIONS ARE ACCUMULATED PER BYTE, NOT PER RANGE, and that is not a
 * style choice. V8 reports only the ranges whose count differs from their
 * parent and merges adjacent equal-count spans, so the SAME structural branch
 * comes back with DIFFERENT offsets from one delta to the next — measured on
 * this corpus: the rebalance sale block was `[87787,87987)=0` in one member's
 * delta and absorbed into a wider non-zero range in another's. Summing by
 * range offsets therefore reports a branch as never taken when another member
 * took it thousands of times. Every byte in a spec range instead carries its
 * own running total, and a cold region is a maximal run of bytes whose total is
 * zero across every member.
 *
 * WHAT IS STILL NOT MEASURED: V8 emits a block range for a branch, not for
 * every operand. Where two branches share one range, this reports one. Do not
 * read "no cold regions" as "every sub-expression was exercised".
 *
 * OFFSETS ARE VERIFIED, NOT ASSUMED. Coverage offsets index the source V8
 * compiled, which for a `.ts` file is Node's type-stripped form — a different
 * string from the file on disk (`import type { … } from …` comes back as a run
 * of spaces, and Node appends a `//# sourceURL=` footer). This tool fetches
 * that exact string through the Debugger domain and checks the one property
 * every offset here depends on: that each of the file's lines has the SAME
 * LENGTH in both. Measured on `simulate.ts`: 11,421 lines, zero length
 * mismatches, and the only extra content is the 141-character footer past the
 * end of the file. If that check ever fails, `equivalence.mjs reach` refuses to
 * report rather than printing line numbers that have quietly drifted.
 */
import { readFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** @typedef {{ id: string, label: string, file: string, lines: [number, number], anchors?: readonly {line: number, text: string}[] }} SpecEntry */

/** Labels wrapped in parentheses are bookkeeping, not corpus members. */
const isMemberLabel = (label) => !label.startsWith('(')

export class ReachRecorder {
  /**
   * @param {readonly SpecEntry[]} spec entries, with `file` already absolute
   */
  constructor(spec) {
    this.spec = spec
    /** url -> { text, lineStarts, anchors: {line, offset}[] sorted by offset } */
    this.sources = new Map()
    for (const entry of spec) {
      const url = pathToFileURL(entry.file).href
      if (this.sources.has(url)) continue
      const text = readFileSync(entry.file, 'utf8')
      const lineStarts = [0]
      for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1)
      this.sources.set(url, { text, lineStarts, spans: [] })
    }
    for (const entry of spec) {
      const source = this.sources.get(pathToFileURL(entry.file).href)
      source.spans.push([
        source.lineStarts[entry.lines[0] - 1] ?? 0,
        source.lineStarts[entry.lines[1]] ?? source.text.length,
      ])
    }
    for (const source of this.sources.values()) {
      // Every byte inside any spec range is tracked individually.
      const offsets = new Set()
      for (const [from, to] of source.spans) for (let i = from; i < to; i++) offsets.add(i)
      source.offsets = Int32Array.from([...offsets].sort((a, b) => a - b))
      source.indexOfOffset = new Map()
      for (let index = 0; index < source.offsets.length; index++) {
        source.indexOfOffset.set(source.offsets[index], index)
      }
      source.totals = new Int32Array(source.offsets.length)
      // Per-line anchor: the line's first non-whitespace character.
      const rows = source.text.split('\n')
      source.anchorIndex = new Map()
      for (let line = 1; line <= rows.length; line++) {
        const start = source.lineStarts[line - 1]
        if (!source.indexOfOffset.has(start)) continue
        const indent = rows[line - 1].length - rows[line - 1].trimStart().length
        const anchor = source.indexOfOffset.get(start + indent) ?? source.indexOfOffset.get(start)
        source.anchorIndex.set(line, anchor)
      }
    }
    /** label -> url -> Map<line, count> */
    this.byLabel = new Map()
    this.offsetsVerified = new Map()
    this.scriptIds = new Map()
    this.armed = false
    this.session = new Session()
    this.session.connect()
    // The Debugger domain is on ONLY while the engine loads, purely so
    // `scriptParsed` names the script whose source the offset check reads. It
    // is disabled again before the corpus runs, so the counts below are taken
    // from an engine that is not held un-optimized by a live debugger.
    this.session.on('Debugger.scriptParsed', (message) => {
      if (this.sources.has(message.params.url)) this.scriptIds.set(message.params.url, message.params.scriptId)
    })
  }

  /**
   * Turn the Debugger domain on and wait for the inspector to ack. Must
   * complete BEFORE `loadEngine()` so `scriptParsed` names every compiled
   * script. `node:inspector` Session.post with a callback does not wait and
   * does not return a Promise; this uses `node:inspector/promises` so a late
   * result cannot be read as empty coverage.
   */
  async enable() {
    await this.post('Debugger.enable')
  }

  /**
   * Verify offsets against the source V8 actually compiled, then start
   * counting. Call AFTER the engine has been imported (that is when
   * `scriptParsed` fires) and BEFORE the first corpus member runs.
   */
  async arm() {
    for (const [url, source] of this.sources) {
      const scriptId = this.scriptIds.get(url)
      if (scriptId === undefined) {
        this.offsetsVerified.set(url, { ok: false, why: 'the file was never loaded by the engine' })
        continue
      }
      const payload = await this.post('Debugger.getScriptSource', { scriptId })
      if (payload == null || typeof payload.scriptSource !== 'string') {
        throw new Error(`equivalence reach: Debugger.getScriptSource returned no source for ${url}`)
      }
      const { scriptSource } = payload
      const fileRows = source.text.split('\n')
      const v8Rows = scriptSource.split('\n')
      let mismatched = 0
      let firstMismatch = -1
      for (let i = 0; i < fileRows.length; i++) {
        if ((v8Rows[i] ?? '').length !== fileRows[i].length) {
          mismatched++
          if (firstMismatch < 0) firstMismatch = i + 1
        }
      }
      this.offsetsVerified.set(url, {
        ok: mismatched === 0,
        fileLines: fileRows.length,
        compiledLines: v8Rows.length,
        linesWithDifferentLength: mismatched,
        firstMismatchLine: firstMismatch,
        trailingBytesPastFile: scriptSource.length - source.text.length,
      })
    }
    await this.post('Debugger.disable')
    await this.post('Profiler.enable')
    await this.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
    this.armed = true
  }

  /**
   * Wait for the inspector result. Never return on the same tick as the
   * dispatch: a null/partial payload would look like "no hits" and a green
   * REACHED built from that is worse than a throw.
   * @param {string} method
   * @param {object} [params]
   */
  async post(method, params) {
    return this.session.post(method, params)
  }

  /**
   * Attribute everything executed since the previous call to `label`.
   * `takePreciseCoverage` resets V8's counters, so each take is a delta.
   * @param {string} label
   */
  async take(label) {
    const payload = await this.post('Profiler.takePreciseCoverage')
    if (payload == null || !Array.isArray(payload.result)) {
      throw new Error('equivalence reach: Profiler.takePreciseCoverage returned no result')
    }
    const { result } = payload
    for (const script of result) {
      const source = this.sources.get(script.url)
      if (source === undefined) continue
      const ranges = []
      for (const fn of script.functions) for (const range of fn.ranges) ranges.push(range)
      // Widest first, so a tighter (inner) range overwrites the enclosing one.
      ranges.sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset))
      const counts = new Int32Array(source.offsets.length)
      for (const range of ranges) {
        let index = lowerBound(source.offsets, range.startOffset)
        for (; index < source.offsets.length && source.offsets[index] < range.endOffset; index++) {
          counts[index] = range.count
        }
      }
      for (let i = 0; i < counts.length; i++) source.totals[i] += counts[i]
      const forLabel = this.byLabel.get(label) ?? new Map()
      const merged = forLabel.get(script.url) ?? new Map()
      for (const [line, index] of source.anchorIndex) {
        if (counts[index] !== 0) merged.set(line, (merged.get(line) ?? 0) + counts[index])
      }
      forLabel.set(script.url, merged)
      this.byLabel.set(label, forLabel)
    }
  }

  async close() {
    try {
      if (this.armed) {
        await this.post('Profiler.stopPreciseCoverage')
        await this.post('Profiler.disable')
      }
    } finally {
      this.session.disconnect()
    }
  }

  /** @returns {object} the report */
  report() {
    const labels = [...this.byLabel.keys()].filter(isMemberLabel)
    const entries = this.spec.map((entry) => {
      const url = pathToFileURL(entry.file).href
      const source = this.sources.get(url)
      const [from, to] = entry.lines
      const perLabel = []
      const totals = new Map()
      for (const label of labels) {
        const lines = this.byLabel.get(label)?.get(url) ?? new Map()
        let hits = 0
        for (let line = from; line <= to; line++) {
          const count = lines.get(line) ?? 0
          if (count > hits) hits = count
          totals.set(line, (totals.get(line) ?? 0) + count)
        }
        perLabel.push({ label, hits })
      }
      const rows = source.text.split('\n')
      const coldLines = []
      for (let line = from; line <= to; line++) {
        if ((totals.get(line) ?? 0) === 0) coldLines.push({ line, text: (rows[line - 1] ?? '').trim() })
      }
      // Untaken sub-line branches: maximal runs of bytes inside this entry
      // whose running total is zero across every member. Runs that are nothing
      // but whitespace are dropped — a gap between two hot spans is not a
      // branch.
      const startOffset = source.lineStarts[from - 1] ?? 0
      const endOffset = source.lineStarts[to] ?? source.text.length
      const coldRegions = []
      let runStart = -1
      const flush = (endIndex) => {
        if (runStart < 0) return
        const start = source.offsets[runStart]
        const end = source.offsets[endIndex - 1] + 1
        runStart = -1
        const body = source.text.slice(start, end)
        if (body.trim() === '') return
        coldRegions.push({
          start,
          end,
          line: lineAtOffset(source.lineStarts, start),
          bytes: end - start,
          text: body.slice(0, 140).replace(/\s+/gu, ' ').trim(),
        })
      }
      for (let index = 0; index < source.offsets.length; index++) {
        const offset = source.offsets[index]
        const inside = offset >= startOffset && offset < endOffset
        if (inside && source.totals[index] === 0) {
          if (runStart < 0) runStart = index
        } else {
          flush(index)
        }
      }
      flush(source.offsets.length)
      return {
        id: entry.id,
        label: entry.label,
        ...(entry.note === undefined ? {} : { note: entry.note }),
        file: entry.file,
        lines: entry.lines,
        labelsThatReach: perLabel.filter((row) => row.hits > 0).length,
        labelsTotal: labels.length,
        totalHits: perLabel.reduce((sum, row) => sum + row.hits, 0),
        perLabel: perLabel.filter((row) => row.hits > 0).sort((a, b) => b.hits - a.hits || (a.label < b.label ? -1 : 1)),
        coldLines,
        coldRegions,
      }
    })
    return {
      offsetsVerified: Object.fromEntries(
        [...this.offsetsVerified].map(([url, detail]) => [fileURLToPath(url).split('\\').join('/'), detail]),
      ),
      labels,
      entries,
    }
  }
}

/** First index whose value is >= `target`. @param {readonly number[]} sorted @param {number} target */
function lowerBound(sorted, target) {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (sorted[mid] < target) low = mid + 1
    else high = mid
  }
  return low
}

/** @param {readonly number[]} lineStarts @param {number} offset @returns {number} 1-based line */
function lineAtOffset(lineStarts, offset) {
  let low = 0
  let high = lineStarts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (lineStarts[mid] <= offset) low = mid
    else high = mid - 1
  }
  return low + 1
}
