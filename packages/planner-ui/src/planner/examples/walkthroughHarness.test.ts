import { describe, expect, it } from 'vitest'

import { RMD_IRMAA_WALKTHROUGH } from './walkthroughs/rmdIrmaa.walkthrough'
import { runWalkthrough, walkthroughRowProblem, type Walkthrough, type WalkthroughRowResult } from './walkthroughs/walkthrough'

/**
 * The walkthrough harness's comparison rule, row by row, and the one
 * distinction the runner must keep: a selector's null is a published absence
 * (the engine publishes the field as null), its undefined is a missing
 * figure, and only the first can meet a null hand value. This file sits
 * outside the walkthroughs directory on purpose: every test file there is a
 * walkthrough the engine's census publishes.
 */

function row(overrides: Partial<WalkthroughRowResult>): WalkthroughRowResult {
  return {
    key: 'figure',
    label: 'A figure',
    hand: 100,
    engine: 100,
    tolerance: 0.005,
    unit: 'dollars',
    derivation: 'by hand',
    contract: 'a contract',
    ...overrides,
  }
}

describe('walkthroughRowProblem', () => {
  it('holds a published null exactly: a null passes, a missing figure and a number do not', () => {
    expect(walkthroughRowProblem(row({ hand: null, engine: null }), '2027 credit')).toBeNull()
    expect(walkthroughRowProblem(row({ hand: null, engine: undefined }), '2027 credit')).toBe(
      '2027 credit: engine published undefined, not the null the contract promises',
    )
    expect(walkthroughRowProblem(row({ hand: null, engine: 0 }), '2027 credit')).toBe(
      '2027 credit: engine published 0, not the null the contract promises',
    )
    expect(walkthroughRowProblem(row({ hand: null, engine: 'null' }), '2027 credit')).toBe(
      '2027 credit: engine published null, not the null the contract promises',
    )
  })

  it('refuses a published null where the hand table states a figure', () => {
    expect(walkthroughRowProblem(row({ hand: 100, engine: null }), 'x')).toBe('x: engine published null, not a number')
    expect(walkthroughRowProblem(row({ hand: 'single', engine: null, unit: 'text' }), 'x')).toBe(
      'x: engine null is not the hand value single',
    )
  })

  it('holds numbers to the two-sided band, and to the one-sided band when the row says so', () => {
    expect(walkthroughRowProblem(row({ hand: 100, engine: 100.005 }), 'x')).toBeNull()
    expect(walkthroughRowProblem(row({ hand: 100, engine: 99.995 }), 'x')).toBeNull()
    expect(walkthroughRowProblem(row({ hand: 100, engine: 100.0051 }), 'x')).toMatch(/more than 0\.005/u)
    const below = { hand: 100, tolerance: 0.01, bound: 'below' as const }
    expect(walkthroughRowProblem(row({ ...below, engine: 100 }), 'x')).toBeNull()
    expect(walkthroughRowProblem(row({ ...below, engine: 99.9901 }), 'x')).toBeNull()
    expect(walkthroughRowProblem(row({ ...below, engine: 100.0001 }), 'x')).toMatch(/not within/u)
    expect(walkthroughRowProblem(row({ ...below, engine: 99.99 }), 'x')).toMatch(/not within/u)
  })
})

describe('runWalkthrough', () => {
  it('keeps a selector null distinct from a selector undefined, and a null row keeps its stated unit', () => {
    const probe: Walkthrough = {
      ...RMD_IRMAA_WALKTHROUGH,
      tables: [
        {
          year: 2026,
          why: 'a probe of the runner',
          rows: [
            { key: 'published-null', label: 'A published null', hand: null, unit: 'percent', derivation: 'd', contract: 'c', select: () => null },
            { key: 'missing', label: 'A missing figure', hand: null, derivation: 'd', contract: 'c', select: () => undefined },
          ],
        },
      ],
    }
    const [table] = runWalkthrough(probe).tables
    const [published, missing] = table!.rows
    expect(published!.engine).toBeNull()
    expect(published!.unit).toBe('percent')
    expect(walkthroughRowProblem(published!, 'published-null')).toBeNull()
    expect(missing!.engine).toBeUndefined()
    expect(missing!.unit).toBe('dollars')
    expect(walkthroughRowProblem(missing!, 'missing')).toBe('missing: engine published undefined, not the null the contract promises')
  })
})
