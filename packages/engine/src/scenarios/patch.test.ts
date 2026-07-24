import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { isScenarioPatchDocument, parseScenarioPatch, type ScenarioPatchMetadata } from './contract.js'
import {
  applyLegacyScenarioPatch,
  applyScenarioPatchDocument,
  canonicalScenarioJson,
  composeScenarioPatches,
  createScenarioPatch,
  detectScenarioConflicts,
  migrateLegacyScenarioPatch,
  rebindScenarioPatchesToPlan,
  revertScenarioPatch,
  scenarioPlanSnapshotHash,
} from './patch.js'
import { applyScenarioPatch } from './scenarios.js'

const metadata: ScenarioPatchMetadata = {
  title: 'Meeting proposal',
  rationale: 'Test the client-requested change.',
  createdAtIso: '2026-07-23T12:00:00.000Z',
  actor: { kind: 'advisor', id: 'advisor-1', displayName: 'Avery Advisor' },
}

function plan(): Plan {
  const value = createEmptyPlan({
    newId: () => 'generated-id',
    now: () => new Date('2026-07-23T00:00:00.000Z'),
  })
  value.id = 'plan-1'
  value.household.people[0]!.id = 'person-1'
  value.household.people[0]!.name = 'Pat'
  value.expenses.baseAnnual = 48_000
  value.accounts = [
    {
      type: 'taxable',
      id: 'brokerage-1',
      name: 'Brokerage',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 800_000,
      costBasis: 500_000,
      annualContribution: 0,
    },
  ]
  const parsed = parsePlan(value)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function clonePlan(value: Plan): Plan {
  return JSON.parse(JSON.stringify(value)) as Plan
}

function build(base: Plan, edited: Plan) {
  const result = createScenarioPatch(base, edited, metadata)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.patch
}

function apply(base: Plan, patch: ReturnType<typeof build>): Plan {
  const result = applyScenarioPatchDocument(base, patch)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

describe('canonical scenario patch documents', () => {
  it('round-trips a manually edited plan byte-for-byte after normalization and reverts it', () => {
    const base = plan()
    const edited = clonePlan(base)
    edited.assumptions.inflationPct = 3.25
    edited.expenses.baseAnnual = 62_500
    edited.accounts.push({
      type: 'cash',
      id: 'cash-1',
      name: 'Meeting reserve',
      ownerPersonId: null,
      annualReturnPct: 1,
      balance: 25_000,
      annualContribution: 0,
    })

    const patch = build(base, edited)
    expect(patch.operations.map((operation) => operation.path)).toEqual([
      '/accounts',
      '/assumptions/inflationPct',
      '/expenses/baseAnnual',
    ])
    const applied = applyScenarioPatchDocument(base, patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(canonicalScenarioJson(applied.plan)).toBe(canonicalScenarioJson(edited))
    expect(base.assumptions.inflationPct).toBe(2.5)
    const reverted = revertScenarioPatch(applied.plan, patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) expect(canonicalScenarioJson(reverted.plan)).toBe(canonicalScenarioJson(base))
  })

  it('holds apply/revert and empty-diff invariants across deterministic generated edits', () => {
    for (let index = 0; index < 40; index++) {
      const base = plan()
      const edited = clonePlan(base)
      edited.assumptions.inflationPct = -1 + index * 0.2
      edited.expenses.baseAnnual = index * 1_337
      edited.household.state = index % 2 === 0 ? 'KY' : 'FL'
      if (index % 3 === 0)
        edited.assumptions.ssHaircut = {
          fromYear: 2034 + index,
          cutPct: 10 + index,
        }
      const patch = build(base, edited)
      const applied = apply(base, patch)
      expect(canonicalScenarioJson(applied)).toBe(canonicalScenarioJson(edited))
      const reverted = revertScenarioPatch(applied, patch)
      expect(reverted.ok).toBe(true)
      if (reverted.ok) expect(canonicalScenarioJson(reverted.plan)).toBe(canonicalScenarioJson(base))
      expect(build(base, base).operations).toEqual([])
    }
  })

  it('canonicalizes JSON and operation ordering without locale-sensitive comparison', () => {
    expect(canonicalScenarioJson({ z: 1, nested: { b: 2, a: 1 }, a: 0 })).toBe('{"a":0,"nested":{"a":1,"b":2},"z":1}')
    const parsed = parseScenarioPatch({
      kind: 'retiregolden.scenario-patch',
      version: 1,
      base: {
        planId: 'p',
        planSchemaVersion: 1,
        snapshotHash: 'fnv1a64:0000000000000000',
      },
      title: 'Sorted',
      rationale: null,
      createdAtIso: '2026-07-23T00:00:00.000Z',
      actor: { kind: 'user' },
      operations: [
        {
          op: 'set',
          path: '/expenses/baseAnnual',
          before: { present: true, value: 1 },
          value: 2,
        },
        {
          op: 'set',
          path: '/assumptions/inflationPct',
          before: { present: true, value: 2 },
          value: 3,
        },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.patch.operations.map((operation) => operation.path)).toEqual([
        '/assumptions/inflationPct',
        '/expenses/baseAnnual',
      ])
    }
  })

  it('allows unrelated baseline drift but rejects a stale target atomically', () => {
    const base = plan()
    const edited = clonePlan(base)
    edited.assumptions.inflationPct = 4
    edited.expenses.baseAnnual = 60_000
    const patch = build(base, edited)

    const unrelated = clonePlan(base)
    unrelated.household.state = 'FL'
    const report = detectScenarioConflicts(unrelated, patch)
    expect(report.baseSnapshotMatches).toBe(false)
    expect(report.conflicts).toEqual([])
    expect(apply(unrelated, patch).household.state).toBe('FL')

    const stale = clonePlan(base)
    stale.assumptions.inflationPct = 9
    const before = canonicalScenarioJson(stale)
    const rejected = applyScenarioPatchDocument(stale, patch)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.conflicts.map((conflict) => conflict.path)).toEqual(['/assumptions/inflationPct'])
    expect(canonicalScenarioJson(stale)).toBe(before)
  })

  it('is idempotent in both directions', () => {
    const base = plan()
    const edited = clonePlan(base)
    edited.assumptions.inflationPct = 4
    const patch = build(base, edited)
    const first = apply(base, patch)
    const second = applyScenarioPatchDocument(first, patch)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(canonicalScenarioJson(second.plan)).toBe(canonicalScenarioJson(first))
    const reverted = revertScenarioPatch(first, patch)
    expect(reverted.ok).toBe(true)
    if (!reverted.ok) return
    const again = revertScenarioPatch(reverted.plan, patch)
    expect(again.ok).toBe(true)
    if (again.ok) expect(canonicalScenarioJson(again.plan)).toBe(canonicalScenarioJson(base))
  })

  it('holds generated conflict and composition invariants', () => {
    for (let index = 0; index < 25; index++) {
      const base = plan()
      const middle = clonePlan(base)
      middle.assumptions.inflationPct = 3 + index / 10
      const end = clonePlan(middle)
      end.expenses.baseAnnual = 50_000 + index * 100
      const first = build(base, middle)
      const second = build(middle, end)
      const composed = composeScenarioPatches(base, [first, second], {
        ...metadata,
        title: `Combined ${index}`,
      })
      expect(composed.ok).toBe(true)
      if (composed.ok) expect(canonicalScenarioJson(apply(base, composed.patch))).toBe(canonicalScenarioJson(end))

      const stale = clonePlan(base)
      stale.assumptions.inflationPct = 20 + index
      const conflict = detectScenarioConflicts(stale, first)
      expect(conflict.conflicts.map((item) => item.path)).toEqual(['/assumptions/inflationPct'])
    }
  })

  it('migrates legacy patches equivalently across generated values', () => {
    for (let index = 0; index < 25; index++) {
      const base = plan()
      const legacy = {
        assumptions: { inflationPct: index / 4 },
        expenses: { baseAnnual: index * 2_000 },
      }
      const oldApplied = applyLegacyScenarioPatch(base, legacy)
      expect(oldApplied.ok).toBe(true)
      const migrated = migrateLegacyScenarioPatch(base, legacy, {
        ...metadata,
        actor: { kind: 'legacy' },
      })
      expect(migrated.ok).toBe(true)
      if (oldApplied.ok && migrated.ok) {
        expect(canonicalScenarioJson(apply(base, migrated.patch))).toBe(canonicalScenarioJson(oldApplied.plan))
      }
    }
  })

  it('rejects protected-field differences and binds plan identity', () => {
    const base = plan()
    const edited = clonePlan(base)
    edited.updatedAtIso = '2026-07-24T00:00:00.000Z'
    const created = createScenarioPatch(base, edited, metadata)
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.issues).toContain('protected field "updatedAtIso" differs')
    const migrated = migrateLegacyScenarioPatch(base, { name: 'Renamed through legacy patch' }, metadata)
    expect(migrated.ok).toBe(false)

    const validEdit = clonePlan(base)
    validEdit.expenses.baseAnnual = 60_000
    const patch = build(base, validEdit)
    const other = clonePlan(base)
    other.id = 'other-plan'
    const applied = applyScenarioPatchDocument(other, patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) expect(applied.conflicts.map((conflict) => conflict.kind)).toContain('plan-id')
  })

  it('persists through the plan schema and excludes scenario history from the baseline fingerprint', () => {
    const base = plan()
    const edited = clonePlan(base)
    edited.expenses.baseAnnual = 60_000
    const patch = build(base, edited)
    expect(patch.base.snapshotHash).toBe(scenarioPlanSnapshotHash(base))
    const stored = clonePlan(base)
    stored.scenarios = [{ id: 'scenario-1', name: patch.title, patch }]
    stored.updatedAtIso = '2026-07-24T00:00:00.000Z'
    expect(scenarioPlanSnapshotHash(stored)).toBe(patch.base.snapshotHash)
    const reparsed = parsePlan(JSON.parse(JSON.stringify(stored)))
    expect(reparsed.ok).toBe(true)
    if (!reparsed.ok) return
    const applied = applyScenarioPatch(reparsed.plan, reparsed.plan.scenarios[0]!.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.expenses.baseAnnual).toBe(60_000)
  })

  it('rebinds canonical scenarios when their containing plan is re-keyed', () => {
    const base = plan()
    const edited = clonePlan(base)
    edited.expenses.baseAnnual = 60_000
    const patch = build(base, edited)
    const copy = clonePlan(base)
    copy.id = 'copy-plan'
    copy.scenarios = [{ id: 'scenario-1', name: patch.title, patch }]

    const rebound = rebindScenarioPatchesToPlan(copy)
    const applied = applyScenarioPatch(rebound, rebound.scenarios[0]!.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.expenses.baseAnnual).toBe(60_000)
    expect((rebound.scenarios[0]!.patch as { base: { planId: string } }).base.planId).toBe('copy-plan')
  })

  it('diffs optional undefined values and numeric record keys safely', () => {
    const base = plan()
    const edited = clonePlan(base)
    base.assumptions.assetClassParams = undefined
    edited.assumptions.assetClassParams = undefined
    edited.assumptions.historicalAnnualMagiByYear = { '2024': 75_000 }

    const patch = build(base, edited)
    expect(patch.operations.map((operation) => operation.path)).toEqual(['/assumptions/historicalAnnualMagiByYear'])
    expect(apply(base, patch).assumptions.historicalAnnualMagiByYear).toEqual({
      '2024': 75_000,
    })

    const next = clonePlan(edited)
    next.assumptions.historicalAnnualMagiByYear!['2024'] = 80_000
    const numericKeyPatch = build(edited, next)
    expect(numericKeyPatch.operations.map((operation) => operation.path)).toEqual([
      '/assumptions/historicalAnnualMagiByYear/2024',
    ])
    expect(apply(edited, numericKeyPatch).assumptions.historicalAnnualMagiByYear).toEqual({ '2024': 80_000 })
  })
})

describe('scenario patch validation and hostile paths', () => {
  const envelope = {
    kind: 'retiregolden.scenario-patch',
    version: 1,
    base: {
      planId: 'plan-1',
      planSchemaVersion: 1,
      snapshotHash: 'fnv1a64:0000000000000000',
    },
    title: 'Hostile path',
    rationale: null,
    createdAtIso: '2026-07-23T00:00:00.000Z',
    actor: { kind: 'user' },
  } as const

  it.each([
    '/id',
    '/schemaVersion',
    '/scenarios/0',
    '/assumptions/__proto__/polluted',
    '/assumptions/toString',
    '/assumptions/valueOf',
  ])('rejects unsafe path %s during document parsing', (path) => {
    expect(
      parseScenarioPatch({
        ...envelope,
        operations: [{ op: 'set', path, before: { present: false }, value: 1 }],
      }).ok,
    ).toBe(false)
  })

  it('accepts numeric object keys but rejects numeric traversal through actual arrays', () => {
    const parsed = parseScenarioPatch({
      ...envelope,
      operations: [
        {
          op: 'set',
          path: '/accounts/0/balance',
          before: { present: false },
          value: 1,
        },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const applied = applyScenarioPatchDocument(plan(), parsed.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) expect(applied.conflicts[0]?.kind).toBe('invalid-path')
  })

  it('only narrows fully validated documents', () => {
    expect(isScenarioPatchDocument({ kind: 'retiregolden.scenario-patch' })).toBe(false)
    expect(isScenarioPatchDocument({ ...envelope, operations: [] })).toBe(true)
  })

  it('rejects duplicate, overlapping, non-JSON, and malformed-pointer operations', () => {
    const duplicate = parseScenarioPatch({
      ...envelope,
      operations: [
        {
          op: 'set',
          path: '/assumptions/inflationPct',
          before: { present: true, value: 2.5 },
          value: 3,
        },
        {
          op: 'set',
          path: '/assumptions/inflationPct',
          before: { present: true, value: 2.5 },
          value: 4,
        },
      ],
    })
    expect(duplicate.ok).toBe(false)
    const overlap = parseScenarioPatch({
      ...envelope,
      operations: [
        {
          op: 'set',
          path: '/assumptions',
          before: { present: true, value: {} },
          value: {},
        },
        {
          op: 'set',
          path: '/assumptions/inflationPct',
          before: { present: true, value: 2.5 },
          value: 4,
        },
      ],
    })
    expect(overlap.ok).toBe(false)
    expect(
      parseScenarioPatch({
        ...envelope,
        operations: [
          {
            op: 'set',
            path: '/assumptions/inflationPct',
            before: { present: true, value: 2.5 },
            value: Number.NaN,
          },
        ],
      }).ok,
    ).toBe(false)
    expect(
      parseScenarioPatch({
        ...envelope,
        operations: [
          {
            op: 'set',
            path: '/assumptions/~2bad',
            before: { present: false },
            value: 1,
          },
        ],
      }).ok,
    ).toBe(false)
  })

  it('refuses schema-unknown operations that plan parsing would otherwise strip', () => {
    const base = plan()
    const parsed = parseScenarioPatch({
      ...envelope,
      base: { ...envelope.base, snapshotHash: scenarioPlanSnapshotHash(base) },
      operations: [
        {
          op: 'set',
          path: '/assumptions/unknownFutureField',
          before: { present: false },
          value: 1,
        },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const applied = applyScenarioPatchDocument(base, parsed.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) expect(applied.conflicts[0]?.kind).toBe('invalid-path')
  })

  it('rejects malformed canonical-looking envelopes instead of applying them as legacy patches', () => {
    const base = plan()
    const malformed = {
      version: 1,
      base: {
        planId: base.id,
        planSchemaVersion: 1,
        snapshotHash: scenarioPlanSnapshotHash(base),
      },
      title: 'Missing discriminator',
      rationale: null,
      createdAtIso: '1900-01-01T00:00:00.000Z',
      actor: { kind: 'user' },
      operations: [],
    }
    const applied = applyScenarioPatch(base, malformed)
    expect(applied.ok).toBe(false)
    expect(base.createdAtIso).toBe('2026-07-23T00:00:00.000Z')
  })
})
