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

  it('reach refuses a positional range when an exact content anchor drifts', () => {
    const entries = [{
      id: 'phase',
      file: 'phase.ts',
      lines: [2, 4] as [number, number],
      anchors: [
        { line: 2, text: 'const phase = () => {' },
        { line: 3, text: 'return 1' },
      ],
    }]
    expect(() => assertReachEntryAnchors(
      entries,
      'spec.json',
      () => ['header', 'const phase = () => {', 'return 1', '}'].join('\n'),
    )).not.toThrow()
    expect(() => assertReachEntryAnchors(
      entries,
      'spec.json',
      () => ['inserted', 'header', 'const phase = () => {', 'return 1', '}'].join('\n'),
    )).toThrow(/spec\.json entry "phase" is stale at phase\.ts:2/u)
  })
})
