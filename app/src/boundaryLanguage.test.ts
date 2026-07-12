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

// Vite's import-glob transform requires inline object-literal options, so
// each group's glob is written out; groups stay separate so a rename that
// silences one glob fails its own count assertion instead of hiding inside
// an aggregate total.
const sourceGroups: Record<string, { minFiles: number; files: Record<string, string> }> = {
  'engine insights': {
    minFiles: 10,
    files: import.meta.glob('../../packages/engine/src/insights/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  },
  'engine decisions': {
    minFiles: 10,
    files: import.meta.glob('../../packages/engine/src/decisions/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  },
  'planner pages': {
    minFiles: 50,
    files: import.meta.glob('../../packages/planner-ui/src/planner/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  },
  'learn content': {
    minFiles: 50,
    files: import.meta.glob('../../packages/planner-ui/src/learn/content/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  },
  'report builders': {
    minFiles: 3,
    files: import.meta.glob('../../packages/planner-ui/src/report/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  },
}

const sources: Record<string, string> = Object.assign({}, ...Object.values(sourceGroups).map((group) => group.files))

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
    pattern: /\bpersonalized (?:recommendations?|planning opportunit)/i,
    why: 'frames output as personalized advice rather than modeled findings',
  },
  {
    pattern: /Insights & Recommendations/,
    why: 'brands Insights output as RetireGolden recommendations',
  },
]

/**
 * User-facing string fields in the decision layer (insight card titles,
 * scenario names, tournament candidate labels) must be finding/compare/model
 * framing, not instructions — a tournament winner named "Buy a QLAC" reads as
 * a command. Objective labels ("Maximize after-tax estate") are the user's
 * own goal statements and are out of scope, as is prose (guarded above).
 */
const DECISION_LABEL_SOURCES: Record<string, string> = {
  ...import.meta.glob('../../packages/engine/src/insights/detectors/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  ...import.meta.glob('../../packages/engine/src/decisions/generators.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
}
const USER_FACING_FIELD = /(?:title|scenarioName|label):\s*(['"`])((?:\\.|(?!\1).)*)\1/g
const IMPERATIVE_INSTRUCTION_START = /^(?:Buy|Sell|Purchase|Open|Use|Fund|Improve|Avoid|Add)\b/

describe('decision-support boundary language', () => {
  it('scans every promised source area', () => {
    for (const [group, { minFiles, files }] of Object.entries(sourceGroups)) {
      expect(Object.keys(files).length, `"${group}" glob stopped matching — update the glob or this guard`).toBeGreaterThanOrEqual(minFiles)
    }
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

  it('insight titles, scenario names, and candidate labels are not imperative instructions', () => {
    const violations: string[] = []
    for (const [path, content] of Object.entries(DECISION_LABEL_SOURCES)) {
      if (path.includes('.test.')) continue
      for (const match of content.matchAll(USER_FACING_FIELD)) {
        const text = match[2]!
        if (IMPERATIVE_INSTRUCTION_START.test(text)) violations.push(`${path}: "${text}"`)
      }
    }
    expect(
      violations,
      'Name these as findings/comparisons ("Compare…", "Model…", noun phrases), not instructions',
    ).toEqual([])
  })
})
