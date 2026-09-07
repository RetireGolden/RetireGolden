import { describe, expect, it } from 'vitest'

import { asUsdCents } from '@retiregolden/engine/actions/money'
import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'
import {
  ownedNonRothIraAnnualFilingSourceRecord,
  traditionalAccount,
} from '@retiregolden/engine/testing/planFixtures'
import { MAX_BACKUP_JSON_CHARS, parseV2Backup, serializeV2Backup } from './v2Backup'

let counter = 0
const testIds = () => `bk-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

const POPULATED_ANNUAL_FEDERAL_TAX_FACTS = {
  foreignIncomeAdjustments: [
    {
      year: 2040,
      foreignExclusionAddback: {
        state: 'known' as const,
        amount: 600.125,
        provenance: {
          sourceKind: 'foreignExclusionAggregateWorkpaper' as const,
          acquisition: 'import' as const,
          sourceLabel: 'PRIVATE-3D-A',
        },
      },
      niitSection911A1NetAddback: {
        state: 'known' as const,
        amount: 250.25,
        provenance: {
          sourceKind: 'form8960Line13AllocationWorksheet' as const,
          acquisition: 'import' as const,
          sourceLabel: ' PRIVATE-3D-B ',
        },
      },
    },
    {
      year: 2027,
      foreignExclusionAddback: {
        state: 'known' as const,
        amount: 0,
        provenance: {
          sourceKind: 'planningEstimate' as const,
          acquisition: 'manual' as const,
          sourceLabel: 'PRIVATE-3D-C',
        },
      },
      niitSection911A1NetAddback: {
        state: 'notApplicable' as const,
        amount: null,
        provenance: {
          sourceKind: 'taxProfessionalWorkpaper' as const,
          acquisition: 'import' as const,
          sourceLabel: 'PRIVATE-3D-D',
        },
      },
    },
    {
      year: 2026,
      foreignExclusionAddback: {
        state: 'notApplicable' as const,
        amount: null,
        provenance: {
          sourceKind: 'userAttestation' as const,
          acquisition: 'manual' as const,
          sourceLabel: 'PRIVATE-3D-E',
        },
      },
      niitSection911A1NetAddback: {
        state: 'unknown' as const,
        amount: null,
        provenance: {
          sourceKind: 'unresolvedSource' as const,
          acquisition: 'manual' as const,
          sourceLabel: 'PRIVATE-3D-F <b>"source"</b>',
        },
      },
    },
  ],
}

describe('v2 backup envelope', () => {
  it('round-trips plans through serialize/parse', () => {
    const a = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Plan A' })
    const b = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Plan B' })
    const json = serializeV2Backup([a, b], fixedNow)

    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toEqual([a, b])
      expect(result.warnings).toHaveLength(0)
    }
  })

  it('round-trips current-Plan retirement-action eligibility facts', () => {
    const plan = createEmptyPlan({
      newId: testIds,
      now: fixedNow,
      name: 'Eligibility evidence',
    })
    const personId = plan.household.people[0]!.id
    plan.accounts = [
      {
        type: 'traditional',
        id: 'ira-1',
        name: 'IRA',
        ownerPersonId: personId,
        annualReturnPct: null,
        kind: 'ira',
        balance: 10_000,
        annualContribution: 0,
      },
    ]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [
        {
          evidenceId: 'classification-1',
          provenance: { source: 'manual' },
          sourceAccountId: 'ira-1',
          subtype: 'traditional',
        },
      ],
      sepSimpleActivities: [],
      deductibleIraContributions: [
        {
          evidenceId: 'contribution-1',
          provenance: { source: 'manual' },
          donorPersonId: personId,
          taxYear: 2041,
          amountCents: asUsdCents(500_000),
        },
      ],
    }

    const result = parseV2Backup(serializeV2Backup([plan], fixedNow))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plans).toEqual([plan])
  })

  it('round-trips authoritative annual tax facts when Plan identity is preserved', () => {
    const plan = createEmptyPlan({
      newId: testIds,
      now: fixedNow,
      name: 'Annual filing evidence',
    })
    const ownerPersonId = plan.household.people[0]!.id
    plan.accounts = [traditionalAccount('ira-1', 10_000, ownerPersonId)]
    plan.annualFederalTaxFacts = structuredClone(POPULATED_ANNUAL_FEDERAL_TAX_FACTS)
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [
        ownedNonRothIraAnnualFilingSourceRecord(
          plan,
          ownerPersonId,
          ['ira-1'],
        ),
      ],
    }
    const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)
    const iraSnapshot = structuredClone(plan.retirementActionAnnualTaxFacts)
    const inputSnapshot = structuredClone(plan)
    const parsedInput = parsePlan(plan)
    if (!parsedInput.ok) throw new Error(parsedInput.issues.join('; '))
    expect(parsedInput.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(parsedInput.plan.retirementActionAnnualTaxFacts).toEqual(iraSnapshot)

    const result = parseV2Backup(serializeV2Backup([parsedInput.plan], fixedNow))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toHaveLength(1)
      expect(result.plans[0]!.id).toBe(parsedInput.plan.id)
      expect(result.plans[0]!.annualFederalTaxFacts).toEqual(inputSnapshot.annualFederalTaxFacts)
      expect(result.plans[0]!.retirementActionAnnualTaxFacts).toEqual(
        inputSnapshot.retirementActionAnnualTaxFacts,
      )
      expect(result.warnings).toHaveLength(0)
    }
    expect(plan).toEqual(inputSnapshot)
  })

  it('accepts the legacy retirecalc.v2.backup kind from before the rebrand', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Legacy' })
    const json = JSON.stringify({
      kind: 'retirecalc.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [plan],
    })
    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plans).toHaveLength(1)
  })

  it('accepts RetireMint backups for migration to RetireGolden', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'RetireMint plan' })
    const json = JSON.stringify({
      kind: 'retiremint.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [plan],
    })
    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plans).toEqual([plan])
  })

  it('rejects oversized payloads', () => {
    const result = parseV2Backup('x'.repeat(MAX_BACKUP_JSON_CHARS + 1))
    expect(result).toEqual({ ok: false, reason: 'too_large' })
  })

  it('rejects non-JSON and foreign files', () => {
    expect(parseV2Backup('not json {')).toEqual({ ok: false, reason: 'not_json' })
    expect(parseV2Backup('{"some":"other file"}')).toEqual({ ok: false, reason: 'wrong_kind' })
    expect(parseV2Backup('"just a string"')).toEqual({ ok: false, reason: 'wrong_kind' })
  })

  it('rejects unsupported envelope versions', () => {
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 99,
      exportedAtIso: 'x',
      plans: [],
    })
    expect(parseV2Backup(json)).toEqual({ ok: false, reason: 'unsupported_version' })
  })

  it('skips corrupt plans with warnings but keeps valid ones', () => {
    const good = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Good' })
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [good, { schemaVersion: 1, corrupt: true }],
    })
    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toHaveLength(1)
      expect(result.warnings).toHaveLength(1)
    }
  })

  it('skips plans from a newer app schema while keeping current valid plans', () => {
    const good = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Current' })
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [{ ...good, schemaVersion: 999 }, good],
    })

    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toEqual([good])
      expect(result.warnings).toEqual(['plan 1: skipped (newer_than_app)'])
    }
  })

  it('preserves malicious-looking strings as inert data during import', () => {
    const plan = createEmptyPlan({
      newId: testIds,
      now: fixedNow,
      name: '<img src=x onerror=alert(1)> Retirement',
    })
    plan.scenarios = [
      {
        id: 'scenario-xss',
        name: '<script>alert("scenario")</script>',
        patch: { expenses: { baseAnnual: 42_000 }, note: '<svg onload=alert(1) />' },
      },
    ]

    const result = parseV2Backup(serializeV2Backup([plan], fixedNow))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans[0]!.name).toBe('<img src=x onerror=alert(1)> Retirement')
      expect(result.plans[0]!.scenarios[0]!.name).toBe('<script>alert("scenario")</script>')
      expect(result.plans[0]!.scenarios[0]!.patch).toEqual({
        expenses: { baseAnnual: 42_000 },
        note: '<svg onload=alert(1) />',
      })
    }
  })

  it('rejects plausible-looking envelopes with the wrong kind or non-array plans', () => {
    expect(
      parseV2Backup(
        JSON.stringify({
          kind: 'retiregolden.v2.backup.evil',
          backupVersion: 1,
          exportedAtIso: 'x',
          plans: [createEmptyPlan({ newId: testIds, now: fixedNow })],
        }),
      ),
    ).toEqual({ ok: false, reason: 'wrong_kind' })

    expect(
      parseV2Backup(
        JSON.stringify({
          kind: 'retiregolden.v2.backup',
          backupVersion: 1,
          exportedAtIso: 'x',
          plans: { 0: createEmptyPlan({ newId: testIds, now: fixedNow }) },
        }),
      ),
    ).toEqual({ ok: false, reason: 'wrong_kind' })
  })

  it('fails when no plan in the envelope is valid', () => {
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [{ schemaVersion: 1 }],
    })
    expect(parseV2Backup(json)).toEqual({ ok: false, reason: 'no_valid_plans' })
  })
})
