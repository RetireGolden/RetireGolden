import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import { buildCoverageReport } from './coverageReport.js'
import {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_RECORD_MODULES,
  TAX_RULE_REGISTRY,
  taxRuleDueOn,
  taxRulesDueForVerification,
} from './taxRuleRegistry.js'
import { buildDispatchPrompt } from '../../scripts/rules-dispatch.mjs'

const testSources = import.meta.glob('../**/*.test.{ts,mts,cts,tsx}', { query: '?raw', import: 'default', eager: true })

const report = buildCoverageReport({
  registry: TAX_RULE_REGISTRY,
  attestations: COVERAGE_ATTESTATIONS,
  baselineUnswept: BASELINE_UNSWEPT,
  testSources,
  quoteFidelityLedger: null,
  dueOnFor: taxRuleDueOn,
  // Dispatch prompts never publish deep-link lines; a constant keeps this
  // suite free of the AST resolver the freshness suite exercises for real.
  symbolLineFor: () => 1,
  recordModules: TAX_RULE_RECORD_MODULES,
})

const PINNED_RULE_ID = 'usc-42-430-b-contribution-and-benefit-base'

/**
 * The single checklist line carrying the conflict lock. The assertions below
 * are scoped to it rather than to the whole prompt: the prompt also *mentions*
 * ledger paths in prose ("commit the refreshed ..."), and a whole-document
 * `not.toContain` would read those as lock entries.
 */
function conflictLockLine(markdown: string): string {
  const line = markdown.split('\n').find((candidate) => candidate.includes('require zero hits for any of '))
  if (line === undefined) throw new Error('dispatch prompt has no conflict-lock line')
  return line
}

describe('dispatch tooling', () => {
  describe('taxRuleDueOn', () => {
    it('pins dueOn for the OASDI contribution and benefit base (updates when verifiedOn changes)', () => {
      expect(
        taxRuleDueOn(PINNED_RULE_ID, DEFAULT_REVERIFICATION_INTERVAL_DAYS),
      ).toBe('2026-12-01')
    })

    it('agrees taxRulesDueForVerification boundary with taxRuleDueOn for the pinned rule', () => {
      const dueOn = taxRuleDueOn(PINNED_RULE_ID, DEFAULT_REVERIFICATION_INTERVAL_DAYS)
      expect(taxRulesDueForVerification(dueOn)).toContain(PINNED_RULE_ID)
      const dayBefore = new Date(dueOn + 'T00:00:00Z')
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
      const notYetDue = dayBefore.toISOString().slice(0, 10)
      expect(taxRulesDueForVerification(notYetDue)).not.toContain(PINNED_RULE_ID)
    })

    it('rejects a fractional re-verification interval from both helpers', () => {
      const fractional = { ...DEFAULT_REVERIFICATION_INTERVAL_DAYS, annuallyIndexed: 1.5 }
      expect(() => taxRuleDueOn(PINNED_RULE_ID, fractional)).toThrow(RangeError)
      expect(() => taxRulesDueForVerification('2026-12-01', fractional)).toThrow(RangeError)
    })
  })

  describe('buildDispatchPrompt', () => {
    it('renders title, statement, and per-id verify line for a known rule', () => {
      const ruleId = 'irc-4974-rmd-shortfall-excise-tax'
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
      })
      const rule = TAX_RULE_REGISTRY[ruleId]
      expect(markdown).toContain('## ' + ruleId)
      expect(markdown).toContain('**Title:** ' + rule.title)
      expect(markdown).toContain('**Statement:** ' + rule.statement)
      expect(markdown).toContain(
        'Quote-fidelity re-check for ' + ruleId + ': `pnpm verify:quotes -- --filter ' + ruleId + ' --refresh`',
      )
    })

    it('locks the conflict check to the dispatched record modules, not the rules directory', () => {
      // The lock exists because two agents editing the SAME record collide. It
      // must not also stop two agents editing different domains: since the
      // split, `records/rothAccounts.ts` and `records/statesWest.ts` merge
      // cleanly, and the tooling files under `rules/` hold no records at all.
      const ruleId = 'irc-4974-rmd-shortfall-excise-tax'
      const modulePath = 'packages/engine/src/rules/records/requiredMinimumDistributions.ts'
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
        recordModuleOf: new Map([[ruleId, modulePath]]),
      })
      expect(markdown).toContain('**Record module:** ' + modulePath)
      const lock = conflictLockLine(markdown)
      expect(lock).toContain('`' + modulePath + '`')
      expect(lock).toContain('`packages/engine/src/rules/taxRuleRegistry.ts`')
      // The markdown summary's due-date table is cross-cutting, so it still
      // collides between dispatches whose record modules never touch.
      expect(lock).toContain('`DOCS/operations/rule-coverage.md`')
      // The JSON ledger no longer does: this dispatch locks the shard for the
      // module it edits, and nothing wider — not the index, not the directory.
      expect(lock).toContain('`DOCS/operations/rule-coverage/requiredMinimumDistributions.json`')
      expect(lock).not.toContain('`DOCS/operations/rule-coverage.json`')
      expect(lock).not.toContain('`DOCS/operations/rule-coverage/`')
      expect(markdown).not.toContain('zero hits under `packages/engine/src/rules/`')
    })

    it('locks no other module\'s coverage shard', () => {
      // The regression this pins: a dispatch for an RMD rule must not make a
      // concurrent western-state re-verification look like a conflict. Before
      // the split both dispatches rewrote one 30k-line ledger, so every pair
      // collided.
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: ['irc-4974-rmd-shortfall-excise-tax'],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
        recordModuleOf: new Map([[
          'irc-4974-rmd-shortfall-excise-tax',
          'packages/engine/src/rules/records/requiredMinimumDistributions.ts',
        ]]),
      })
      const lock = conflictLockLine(markdown)
      for (const [moduleName] of TAX_RULE_RECORD_MODULES) {
        if (moduleName === 'requiredMinimumDistributions') continue
        expect(lock, moduleName).not.toContain('DOCS/operations/rule-coverage/' + moduleName + '.json')
        expect(lock, moduleName).not.toContain('records/' + moduleName + '.ts`')
      }
    })

    it('falls back to the whole records and shard directories when the module map is empty', () => {
      // The fallback must stay too broad rather than too narrow: with no map,
      // the dispatch cannot know which shard it will rewrite.
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: ['irc-4974-rmd-shortfall-excise-tax'],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
      })
      const lock = conflictLockLine(markdown)
      expect(lock).toContain('`packages/engine/src/rules/records/`')
      expect(lock).toContain('`DOCS/operations/rule-coverage/`')
    })

    it('throws on an unknown id', () => {
      expect(() =>
        buildDispatchPrompt({
          asOf: '2026-12-01',
          ruleIds: ['not-a-real-rule-id'],
          registry: TAX_RULE_REGISTRY,
          manifestRules: report.rules,
        }),
      ).toThrow(/Unknown rule id/)
    })

    it('renders the outOfScope typed-refusal fixture note', () => {
      const ruleId = 'irc-223-f-4-B-hsa-death-exception'
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
      })
      expect(markdown).toContain(
        'No discriminating fixtures: this rule is outOfScope and is enforced as a typed refusal',
      )
    })

    it('escapes backticks in quotedText', () => {
      const ruleId = 'fixture-backtick-escape'
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: {
          [ruleId]: {
            title: 'Backtick fixture',
            statement: 'Statement with no backticks.',
            classification: 'settled',
            contraryReading: null,
            errorDirection: null,
            conventionRationale: null,
            jurisdiction: 'federal',
            volatility: 'staticStatute',
            verifiedOn: '2026-08-03',
            effectiveFrom: 2026,
            effectiveThrough: null,
            authority: [{
              kind: 'statute',
              citation: 'Fixture',
              url: 'https://example.test/fixture',
              quotedText: 'Use the `quoted` term exactly.',
            }],
          },
        },
        manifestRules: [{
          id: ruleId,
          dueOn: '2027-08-03',
          implementedBy: [],
          fixtureFiles: [],
        }],
      })
      expect(markdown).toContain('Use the \\`quoted\\` term exactly.')
    })
  })
})
