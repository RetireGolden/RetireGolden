import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import { buildCoverageReport, coverageShardPath } from './coverageReport.js'
import {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_RECORD_MODULES,
  TAX_RULE_REGISTRY,
  taxRuleDueOn,
  taxRuleIds,
  taxRulesDueForVerification,
} from './taxRuleRegistry.js'
import { buildDispatchPrompt, coverageShardOf } from '../../scripts/rules-dispatch.mjs'

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
      // Both generated ledger files stay in the lock. The markdown's due-date
      // table is cross-cutting; the index is usually untouched but moves when a
      // dispatch shifts a classification, a jurisdiction, or the quote-fidelity
      // summary, and the lock's rule is to be too broad rather than too narrow.
      expect(lock).toContain('`DOCS/operations/rule-coverage.md`')
      expect(lock).toContain('`DOCS/operations/rule-coverage.json`')
      // What the split narrowed is the per-rule payload: this dispatch locks
      // the shard for the module it edits, not the whole shard directory.
      expect(lock).toContain('`DOCS/operations/rule-coverage/requiredMinimumDistributions.json`')
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

    it('derives shard paths identically to the coverage generator, for every record module', () => {
      // The lock names shard paths; `pnpm rules:coverage` writes them. Two
      // spellings of one layout is exactly the shape that rots: rename the
      // directory in coverageReport.ts and the lock would keep guarding a path
      // nothing writes, so concurrent dispatches would stop colliding while
      // still overwriting each other. Pinned per module, not on one sample.
      for (const [moduleName] of TAX_RULE_RECORD_MODULES) {
        const recordModulePath = 'packages/engine/src/rules/records/' + moduleName + '.ts'
        expect(coverageShardOf(recordModulePath), moduleName)
          .toBe('DOCS/operations/' + coverageShardPath(moduleName))
      }
    })

    it('maps every rule id to the record module that actually registers it', () => {
      // The dispatch used to attribute a rule to the last records file whose
      // exports happened to contain the id. This binds the prompt's mapping to
      // TAX_RULE_RECORD_MODULES for EVERY id, so a rule cannot be attributed to
      // a module that does not hold it — which would lock the wrong shard and
      // let a real collision through.
      const expected = new Map<string, string>()
      for (const [moduleName, records] of TAX_RULE_RECORD_MODULES) {
        for (const ruleId of Object.keys(records)) {
          expected.set(ruleId, 'packages/engine/src/rules/records/' + moduleName + '.ts')
        }
      }
      expect(expected.size).toBe(taxRuleIds.length)
      for (const ruleId of taxRuleIds) {
        const modulePath = expected.get(ruleId)
        expect(modulePath, ruleId).toBeDefined()
        const markdown = buildDispatchPrompt({
          asOf: '2026-12-01',
          ruleIds: [ruleId],
          registry: TAX_RULE_REGISTRY,
          manifestRules: report.rules,
          recordModuleOf: expected,
        })
        expect(markdown, ruleId).toContain('**Record module:** ' + modulePath)
        expect(conflictLockLine(markdown), ruleId).toContain('`' + coverageShardOf(modulePath!) + '`')
      }
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

    it('renders missingInputFacts for an outOfScope inexpressibleInput rule, not a refusal note', () => {
      const ruleId = 'irc-223-f-4-B-hsa-death-exception'
      const rule = TAX_RULE_REGISTRY[ruleId]
      if (rule.classification !== 'outOfScope' || rule.outOfScope.shape !== 'inexpressibleInput') {
        throw new Error(ruleId + ' must stay outOfScope/inexpressibleInput for this test to mean anything')
      }
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
      })
      expect(markdown).toContain(
        '- No fixture: this rule is outOfScope with shape `inexpressibleInput`',
      )
      for (const fact of rule.outOfScope.missingInputFacts) {
        expect(markdown).toContain('  - ' + fact)
      }
      expect(markdown).not.toContain('enforced as a typed refusal')
    })

    it('points a typedRefusal rule with no fixture at the backlog, not a discriminating-fixture message', () => {
      // Still in REFUSAL_FIXTURE_BACKLOG as of this PR: shaped typedRefusal,
      // but the engine has not been changed to actually refuse yet.
      const ruleId = 'irc-199A-a-qualified-business-income-deduction-not-modeled'
      const rule = TAX_RULE_REGISTRY[ruleId]
      if (rule.classification !== 'outOfScope' || rule.outOfScope.shape !== 'typedRefusal') {
        throw new Error(ruleId + ' must stay outOfScope/typedRefusal for this test to mean anything')
      }
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
      })
      expect(markdown).toContain('REFUSAL_FIXTURE_BACKLOG')
      expect(markdown).not.toContain('inexpressibleInput')
      expect(markdown).not.toContain('No discriminating fixtures')
    })

    it('lists the describeRefusal fixture files for a typedRefusal rule that has one', () => {
      const ruleId = 'irc-408-d-3-C-i-inherited-ira-rollover-bar'
      const rule = TAX_RULE_REGISTRY[ruleId]
      if (rule.classification !== 'outOfScope' || rule.outOfScope.shape !== 'typedRefusal') {
        throw new Error(ruleId + ' must stay outOfScope/typedRefusal for this test to mean anything')
      }
      const manifestRule = report.rules.find((candidate) => candidate.id === ruleId)
      if (manifestRule === undefined) throw new Error(ruleId + ' missing from the coverage report')
      expect(manifestRule.refusalFixtureFiles.length).toBeGreaterThan(0)
      const markdown = buildDispatchPrompt({
        asOf: '2026-12-01',
        ruleIds: [ruleId],
        registry: TAX_RULE_REGISTRY,
        manifestRules: report.rules,
      })
      expect(markdown).toContain('Covered by `describeRefusal`, not `describeRule`')
      for (const path of manifestRule.refusalFixtureFiles) {
        expect(markdown).toContain('  - ' + path)
      }
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
