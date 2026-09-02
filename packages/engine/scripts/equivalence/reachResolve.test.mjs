/**
 * Discriminating unit tests for content-located reach-range resolution.
 * Injected `readSource` keeps these off the CLI module (and its Node 24 hook).
 */
import { describe, expect, it } from 'vitest'
import {
  UsageError,
  assertReachEntryAnchors,
  resolveReachSpecEntries,
} from './usage.mjs'

const baseEntry = {
  id: 'phase',
  file: 'phase.ts',
  lines: /** @type {[number, number]} */ ([2, 4]),
  anchors: [
    { line: 2, text: 'const phase = () => {' },
    { line: 3, text: 'return 1' },
    { line: 4, text: '}' },
  ],
}

function sourceFromRows(rows) {
  return rows.join('\n')
}

describe('resolveReachSpecEntries', () => {
  it('resolves an unchanged file at delta zero', () => {
    const source = sourceFromRows(['header', 'const phase = () => {', 'return 1', '}'])
    const [resolved] = resolveReachSpecEntries([baseEntry], 'spec.json', () => source)
    expect(resolved.lines).toEqual([2, 4])
    expect(resolved.anchors).toEqual(baseEntry.anchors)
    expect(() => assertReachEntryAnchors([resolved], 'spec.json', () => source)).not.toThrow()
  })

  it('applies a uniform positive shift when lines are inserted above the block', () => {
    const source = sourceFromRows([
      'inserted',
      'header',
      'const phase = () => {',
      'return 1',
      '}',
    ])
    const [resolved] = resolveReachSpecEntries([baseEntry], 'spec.json', () => source)
    expect(resolved.lines).toEqual([3, 5])
    expect(resolved.anchors).toEqual([
      { line: 3, text: 'const phase = () => {' },
      { line: 4, text: 'return 1' },
      { line: 5, text: '}' },
    ])
  })

  it('applies a uniform negative shift when lines are deleted above the block', () => {
    const source = sourceFromRows(['const phase = () => {', 'return 1', '}'])
    const [resolved] = resolveReachSpecEntries([baseEntry], 'spec.json', () => source)
    expect(resolved.lines).toEqual([1, 3])
    expect(resolved.anchors).toEqual([
      { line: 1, text: 'const phase = () => {' },
      { line: 2, text: 'return 1' },
      { line: 3, text: '}' },
    ])
  })

  it('fails closed when the first-anchor text is absent', () => {
    const source = sourceFromRows(['header', 'const other = () => {', 'return 1', '}'])
    expect(() => resolveReachSpecEntries([baseEntry], 'spec.json', () => source)).toThrow(UsageError)
    expect(() => resolveReachSpecEntries([baseEntry], 'spec.json', () => source)).toThrow(
      /spec\.json entry "phase" has 0 content-anchor matches in phase\.ts/u,
    )
  })

  it('fails closed when duplicate anchor sets make the delta ambiguous', () => {
    const source = sourceFromRows([
      'one',
      'two',
      'three',
      'four',
      'five',
      'const phase = () => {',
      'return 1',
      '}',
      'const phase = () => {',
      'return 1',
      '}',
    ])
    expect(() => resolveReachSpecEntries([baseEntry], 'spec.json', () => source)).toThrow(UsageError)
    expect(() => resolveReachSpecEntries([baseEntry], 'spec.json', () => source)).toThrow(
      /spec\.json entry "phase" has 2 ambiguous content-anchor matches/u,
    )
  })

  it('prefers a valid recorded location over a duplicate elsewhere', () => {
    const source = sourceFromRows([
      'header',
      'const phase = () => {',
      'return 1',
      '}',
      'const phase = () => {',
      'return 1',
      '}',
    ])
    const [resolved] = resolveReachSpecEntries([baseEntry], 'spec.json', () => source)
    expect(resolved.lines).toEqual([2, 4])
  })

  it('fails closed when relative anchor spacing changed inside the block', () => {
    const source = sourceFromRows([
      'header',
      'const phase = () => {',
      'noop()',
      'return 1',
      '}',
    ])
    expect(() => resolveReachSpecEntries([baseEntry], 'spec.json', () => source)).toThrow(UsageError)
    expect(() => resolveReachSpecEntries([baseEntry], 'spec.json', () => source)).toThrow(
      /spec\.json entry "phase" has inconsistent relative anchor layout in phase\.ts/u,
    )
  })

  it('fails closed when a text-matched delta would yield an invalid shifted range', () => {
    const entry = {
      id: 'phase',
      file: 'phase.ts',
      lines: /** @type {[number, number]} */ ([1, 4]),
      anchors: [
        { line: 1, text: 'const phase = () => {' },
        { line: 2, text: 'return 1' },
      ],
    }
    // Anchors match at delta 0, but the recorded end line 4 is past EOF.
    const source = sourceFromRows(['const phase = () => {', 'return 1', '}'])
    expect(() => resolveReachSpecEntries([entry], 'spec.json', () => source)).toThrow(UsageError)
    expect(() => resolveReachSpecEntries([entry], 'spec.json', () => source)).toThrow(
      /spec\.json entry "phase" content-anchor match yields an invalid shifted range/u,
    )
  })

  it('fails closed on a recorded invalid range before searching', () => {
    const entry = {
      ...baseEntry,
      lines: /** @type {[number, number]} */ ([4, 2]),
    }
    expect(() => resolveReachSpecEntries([entry], 'spec.json', () => 'x')).toThrow(UsageError)
    expect(() => resolveReachSpecEntries([entry], 'spec.json', () => 'x')).toThrow(
      /spec\.json entry "phase" has an invalid source range/u,
    )
  })

  it('fails closed when anchors are missing or malformed', () => {
    expect(() => resolveReachSpecEntries(
      [{ id: 'phase', file: 'phase.ts', lines: [2, 4] }],
      'spec.json',
      () => 'x',
    )).toThrow(/spec\.json entry "phase" must anchor its positional source range/u)

    expect(() => resolveReachSpecEntries(
      [{
        id: 'phase',
        file: 'phase.ts',
        lines: [2, 4],
        anchors: [{ line: 2.5, text: 'const phase = () => {' }],
      }],
      'spec.json',
      () => 'x',
    )).toThrow(/spec\.json entry "phase" has an invalid content anchor/u)
  })
})
