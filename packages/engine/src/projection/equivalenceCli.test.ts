/**
 * Operator-facing failures of the equivalence tool that must stay on the
 * UsageError path (usage text, exit 2) rather than a raw stack. Tested via
 * `usage.mjs` so this file does not import the CLI — that module loads the
 * Node 24 engine-tree hook on startup.
 */
import { describe, expect, it } from 'vitest'
import {
  UsageError,
  assertReachEntryAnchors,
  assertReachSpecSchema,
  modesFromFlag,
  resolveReachSpecEntries,
} from '../../scripts/equivalence/usage.mjs'

describe('equivalence CLI: operator-input failures', () => {
  it('unknown --modes is a UsageError, not a generic Error', () => {
    expect(() => modesFromFlag('cashflow')).toThrow(UsageError)
    expect(() => modesFromFlag('cashflow')).toThrow(/unknown mode "cashflow"/u)
    expect(() => modesFromFlag('default,cashFlow')).not.toThrow()
  })

  it('reach refuses an unknown spec schema', () => {
    expect(() => assertReachSpecSchema({ schema: 'retiregolden.equivalence-reach-spec/0' }, 'spec.json')).toThrow(
      UsageError,
    )
    expect(() => assertReachSpecSchema({ schema: 'retiregolden.equivalence-reach-spec/0' }, 'spec.json')).toThrow(
      /spec\.json is not a retiregolden\.equivalence-reach-spec\/1 spec/u,
    )
    expect(() =>
      assertReachSpecSchema({ schema: 'retiregolden.equivalence-reach-spec/1' }, 'spec.json'),
    ).not.toThrow()
  })

  it('reach content-locates a positional range, then refuses when an anchor drifts', () => {
    const entries = [
      {
        id: 'context',
        file: 'phase.ts',
        lines: [1, 1] as [number, number],
        anchors: [{ line: 1, text: 'header' }],
      },
      {
        id: 'phase',
        file: 'phase.ts',
        lines: [2, 4] as [number, number],
        anchors: [
          { line: 2, text: 'const phase = () => {' },
          { line: 3, text: 'return 1' },
        ],
      },
    ]
    const unchanged = ['header', 'const phase = () => {', 'return 1', '}'].join('\n')
    const resolved = resolveReachSpecEntries(entries, 'spec.json', () => unchanged)
    expect(resolved[1].lines).toEqual([2, 4])
    expect(() => assertReachEntryAnchors(resolved, 'spec.json', () => unchanged)).not.toThrow()

    const inserted = ['inserted', 'header', 'const phase = () => {', 'return 1', '}'].join('\n')
    const shifted = resolveReachSpecEntries(entries, 'spec.json', () => inserted)
    expect(shifted[1].lines).toEqual([3, 5])
    expect(() => assertReachEntryAnchors(shifted, 'spec.json', () => inserted)).not.toThrow()

    expect(() => resolveReachSpecEntries(
      entries,
      'spec.json',
      () => ['header', 'const phase = () => {', 'return 2', '}'].join('\n'),
    )).toThrow(/spec\.json entry "phase" has inconsistent relative anchor layout/u)
  })

  it('reach refuses every unanchored positional source range', () => {
    expect(() => resolveReachSpecEntries(
      [{ id: 'phase', file: 'phase.ts', lines: [2, 4] }],
      'spec.json',
      () => ['header', 'const phase = () => {', 'return 1', '}'].join('\n'),
    )).toThrow(/spec\.json entry "phase" must anchor its positional source range/u)
  })
})
