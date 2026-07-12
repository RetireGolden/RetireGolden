/**
 * Decision-support boundary language guard.
 *
 * RetireGolden is user-directed decision-support software (see
 * RetireGolden-Docs `product/posture/decision-support-boundary.md`): it
 * calculates, optimizes, ranks, and compares modeled outcomes under
 * user-selected objectives, but it never presents itself as determining what
 * is suitable for a household or prescribing a securities-related action.
 *
 * This test scans the user-facing copy sources (insight detectors, decision
 * candidate labels, planner pages, Learning Center content, and report
 * builders) for sentence-level phrasing that would attribute prescriptive
 * advice to RetireGolden. Internal identifiers such as `recommendationState`
 * are deliberately out of scope — the patterns target user-readable claims.
 */
import { describe, expect, it } from 'vitest'

// Vite's import-glob transform requires inline object-literal options.
const sources = {
  ...import.meta.glob('../../packages/engine/src/insights/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../packages/engine/src/decisions/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../packages/planner-ui/src/planner/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../packages/planner-ui/src/learn/content/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../packages/planner-ui/src/report/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>

/**
 * Phrases that read as RetireGolden adopting or prescribing advice. Keep the
 * list high-precision: optimization, ranking, and objective-qualified "best"
 * claims are allowed product behavior and must not be flagged here.
 */
const BANNED: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  {
    pattern: /RetireGolden recommends/i,
    why: 'attributes a recommendation to RetireGolden itself',
  },
  {
    pattern: /\bwe recommend\b/i,
    why: 'attributes a recommendation to RetireGolden itself',
  },
  {
    pattern: /\bsuitable for you(?:r household)?\b/i,
    why: 'suitability determinations belong to the user or their professional',
  },
  {
    pattern: /\bright (?:strategy|choice|portfolio|allocation) for you\b/i,
    why: 'presents a modeled result as a personal suitability determination',
  },
  {
    // Lookbehind spares explicit disclaimers ("nothing here says you should move").
    pattern: /(?<!says )\byou should (?:buy|sell|convert|claim|move|roll over|rollover|reallocate|liquidate|annuitize)\b/i,
    why: 'turns a modeled result into an imperative instruction',
  },
  {
    pattern: /\bpersonalized recommendations?\b/i,
    why: 'frames output as personalized advice rather than modeled findings',
  },
]

describe('decision-support boundary language', () => {
  it('scans a meaningful set of user-facing source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
  })

  it('user-facing copy never attributes prescriptive advice to RetireGolden', () => {
    const violations: string[] = []
    for (const [path, content] of Object.entries(sources)) {
      if (path.includes('.test.')) continue
      for (const { pattern, why } of BANNED) {
        const match = content.match(pattern)
        if (match) violations.push(`${path}: "${match[0]}" (${why})`)
      }
    }
    expect(
      violations,
      'Reword these to modeled/compare framing per product/posture/decision-support-boundary.md (RetireGolden-Docs)',
    ).toEqual([])
  })
})
