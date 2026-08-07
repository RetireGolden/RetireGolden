import { describe, expect, it } from 'vitest'

import { createEmptyPlan } from './plan.js'
import {
  applyScenarioPatchDocument,
  createScenarioPatch,
  revertScenarioPatch,
  scenarioPlanSnapshotHash,
} from '../scenarios/patch.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { parseScenarioPatch } from '../scenarios/contract.js'
import {
  migratePlanToCurrent,
  migratePlanV1ToV2,
  migratePlanV2ToV3,
  migratePlanV3ToV4,
  type MigrationStep,
} from './migrations.js'

const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
let counter = 0
const testIds = () => `mig-${++counter}`

describe('migratePlanToCurrent', () => {
  it('passes a current-version plan straight through', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const result = migratePlanToCurrent(JSON.parse(JSON.stringify(plan)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan).toEqual(plan)
      // A document that needed nothing reports nothing, so a host has a plain
      // "was anything changed" test and never a notice over an untouched plan.
      expect(result.repairs).toEqual([])
    }
  })

  it('normalizes existing joint retirement and HSA accounts to the primary person', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const primaryId = plan.household.people[0]!.id
    plan.accounts = [
      { type: 'traditional', id: 'trad', name: '401(k)', ownerPersonId: null, annualReturnPct: null, kind: 'employer', balance: 1, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: null, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      { type: 'hsa', id: 'hsa', name: 'HSA', ownerPersonId: null, annualReturnPct: null, balance: 1, annualContribution: 0 },
      { type: 'taxable', id: 'tax', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
    ]

    const result = migratePlanToCurrent(JSON.parse(JSON.stringify(plan)))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.accounts.slice(0, 3).map((a) => a.ownerPersonId)).toEqual([primaryId, primaryId, primaryId])
      expect(result.plan.accounts[3]!.ownerPersonId).toBeNull()
      // One record per back-filled account, in stored order; the taxable account
      // keeps its null owner and so contributes nothing.
      expect(result.repairs).toEqual([
        { kind: 'accountOwnerBackFilled', accountId: 'trad', accountName: '401(k)', ownerPersonId: primaryId },
        { kind: 'accountOwnerBackFilled', accountId: 'roth', accountName: 'Roth IRA', ownerPersonId: primaryId },
        { kind: 'accountOwnerBackFilled', accountId: 'hsa', accountName: 'HSA', ownerPersonId: primaryId },
      ])
    }
  })

  // Shapes a stored document can hold that current validation refuses. Each was
  // saveable under the old rules, so each must come back through the door rather
  // than dying at `invalid_after_migration` — `PlanContext` surfaces only a bare
  // reason code, so a refusal here is a household locked out of the very plan the
  // new message tells them to edit.
  describe('load-time repair of shapes current validation refuses', () => {
    function storedPension(
      offer: { amount: number; electionYear: number } | undefined,
      rolloverAccountId: string | undefined,
      storedAtVersion?: number,
    ): Record<string, unknown> {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.accounts = [
        { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 100_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: primaryId, annualReturnPct: null, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
          lumpSumOffer: offer, lumpSumElection: rolloverAccountId === undefined ? undefined : { rolloverAccountId } },
      ]
      const raw = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
      if (storedAtVersion !== undefined) raw['schemaVersion'] = storedAtVersion
      return raw
    }

    it('carries a legacy stale election back as an undecided offer, not a refusal', () => {
      // Stamped 2026 (fixedNow), elected for 2025: saveable before this rule
      // existed, and refused by `parsePlan` now.
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2025 }, 'ira'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      expect(pension.type).toBe('pension')
      if (pension.type !== 'pension') return
      // The election goes; the offer stays, so the decision record survives and
      // the household can re-elect it against a year that has not passed.
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2025 })
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedElectionYearPassed',
          accountId: 'pen',
          accountName: 'Pension',
          electionYear: 2025,
        },
      ])
    })

    it('repairs a legacy stale election stored at an older schema version too', () => {
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2025 }, 'ira', 3))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(result.repairs.map((r) => r.kind)).toEqual(['lumpSumElectionDroppedElectionYearPassed'])
    })

    it('sheds an election whose rollover target id is duplicated, instead of locking out', () => {
      // parsePlan refuses a duplicated account id once a rollover election
      // references it, so a repair that preserved the election would trade one
      // lockout for another. A duplicated id is not a uniquely resolving owned
      // account, and the repair treats it exactly like a missing one.
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'ira')
      const accounts = raw['accounts'] as Record<string, unknown>[]
      const owned = accounts.find((a) => a['id'] === 'ira')!
      accounts.push({ ...owned, name: 'Duplicate IRA' })
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2030 })
      // A duplicated id is neither inherited nor resolvable, so it reports as
      // unavailable and carries the name of the first record holding that id.
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedTargetUnavailable',
          accountId: 'pen',
          accountName: 'Pension',
          targetAccountId: 'ira',
          targetAccountName: 'IRA',
        },
      ])
    })

    it('reports a rollover target that is not in the plan at all as unavailable', () => {
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'gone')
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedTargetUnavailable',
          accountId: 'pen',
          accountName: 'Pension',
          targetAccountId: 'gone',
          // Nothing to name, and the record says so rather than inventing one.
          targetAccountName: null,
        },
      ])
    })

    it('sheds the election when the stored stamp is unreadable, instead of refusing the load', () => {
      // The staleness rule fails closed at parse when the stamp is not ISO, so
      // a stored document with a damaged or hand-crafted stamp must lose the
      // election here or it could not load at all. Re-saving restores the
      // stamp, and the offer survives for re-electing.
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'ira')
      raw['updatedAtIso'] = 'not-a-timestamp'
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2030 })
      expect(result.repairs).toEqual([
        { kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId: 'pen', accountName: 'Pension' },
      ])
    })

    it('reports the unreadable stamp, not the target, when both would refuse the election', () => {
      // A re-save is what makes the election year judgeable again, so the fault
      // that has to be fixed first is the one reported.
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'inh')
      raw['updatedAtIso'] = 'not-a-timestamp'
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs.map((r) => r.kind)).toEqual(['lumpSumElectionDroppedUnreadableSaveDate'])
    })

    it('carries a legacy inherited-IRA rollover target back the same way', () => {
      // A future election year, so only the target is at fault.
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2030 }, 'inh'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2030 })
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedInheritedTarget',
          accountId: 'pen',
          accountName: 'Pension',
          targetAccountId: 'inh',
          targetAccountName: 'Inherited',
        },
      ])
    })

    it('leaves a valid election untouched', () => {
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2030 }, 'ira'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toEqual({ rolloverAccountId: 'ira' })
      expect(result.repairs).toEqual([])
    })

    function storedAnnuity(fundingAccountId: string, ownedTraditional: boolean): Record<string, unknown> {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.accounts = [
        ...(ownedTraditional
          ? [{ type: 'traditional' as const, id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira' as const, balance: 400_000, annualContribution: 0 }]
          : []),
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: primaryId, annualReturnPct: null, startAge: 70, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          purchase: { year: 2030, premium: 100_000, fundingAccountId, taxQualification: 'qualified' } },
      ] as never
      return JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    }

    it('retargets a legacy inherited-funded qualified annuity to an owned traditional account', () => {
      // This purchase already MOVED money in every stored projection, so dropping
      // it would hand the household a contract nobody paid for. The premium keeps
      // its year, size, and pre-tax character; only the bucket it leaves changes.
      const result = migratePlanToCurrent(storedAnnuity('inh', true))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase?.fundingAccountId).toBe('ira')
      expect(annuity.purchase?.premium).toBe(100_000)
      expect(annuity.monthlyAmount).toBe(1_000)
      // This repair never shows up in the projection's shape, only in which
      // balance the premium leaves, so the record carries both account names.
      expect(result.repairs).toEqual([
        {
          kind: 'annuityPremiumRetargeted',
          accountId: 'ann',
          accountName: 'SPIA',
          fromAccountId: 'inh',
          fromAccountName: 'Inherited',
          toAccountId: 'ira',
          toAccountName: 'IRA',
        },
      ])
    })

    it('stands down a legacy inherited-funded annuity when no owned traditional account exists', () => {
      // No source could have paid the premium, so the contract does not pay
      // either. Standing it down is the only repair that is not richer than the
      // stored facts support.
      const result = migratePlanToCurrent(storedAnnuity('inh', false))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase).toBeUndefined()
      expect(annuity.monthlyAmount).toBe(0)
      expect(result.repairs).toEqual([
        {
          kind: 'annuityPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'SPIA',
          fromAccountId: 'inh',
          fromAccountName: 'Inherited',
        },
      ])
    })

    it('leaves an owned-traditional-funded qualified annuity untouched', () => {
      const result = migratePlanToCurrent(storedAnnuity('ira', true))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase?.fundingAccountId).toBe('ira')
      expect(result.repairs).toEqual([])
    })

    it('reports every repaired account in stored order, and reports it the same way twice', () => {
      // One document, three different repairs. The list a host renders must be
      // a function of the document alone: same input, same records, same order.
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.accounts = [
        { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: null, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
        { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: primaryId, annualReturnPct: null, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
          lumpSumOffer: { amount: 400_000, electionYear: 2025 }, lumpSumElection: { rolloverAccountId: 'ira' } },
        { type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: primaryId, annualReturnPct: null, startAge: 70, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          purchase: { year: 2030, premium: 100_000, fundingAccountId: 'inh', taxQualification: 'qualified' } },
      ] as never
      const raw = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>

      const expected = [
        { kind: 'accountOwnerBackFilled', accountId: 'roth', accountName: 'Roth IRA', ownerPersonId: primaryId },
        { kind: 'lumpSumElectionDroppedElectionYearPassed', accountId: 'pen', accountName: 'Pension', electionYear: 2025 },
        {
          kind: 'annuityPremiumRetargeted',
          accountId: 'ann',
          accountName: 'SPIA',
          fromAccountId: 'inh',
          fromAccountName: 'Inherited',
          toAccountId: 'ira',
          toAccountName: 'IRA',
        },
      ]
      const first = migratePlanToCurrent(JSON.parse(JSON.stringify(raw)))
      const second = migratePlanToCurrent(JSON.parse(JSON.stringify(raw)))
      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      if (!first.ok || !second.ok) return
      expect(first.repairs).toEqual(expected)
      expect(second.repairs).toEqual(first.repairs)
    })
  })

  it('rejects non-objects and bad versions', () => {
    expect(migratePlanToCurrent(null)).toEqual({ ok: false, reason: 'not_object' })
    expect(migratePlanToCurrent([])).toEqual({ ok: false, reason: 'not_object' })
    expect(migratePlanToCurrent({})).toEqual({ ok: false, reason: 'bad_version' })
    expect(migratePlanToCurrent({ schemaVersion: 0 })).toEqual({ ok: false, reason: 'bad_version' })
    expect(migratePlanToCurrent({ schemaVersion: 1.5 })).toEqual({ ok: false, reason: 'bad_version' })
  })

  it('refuses plans from a newer app build', () => {
    const result = migratePlanToCurrent({ schemaVersion: 99 })
    expect(result).toEqual({ ok: false, reason: 'newer_than_app' })
  })

  it('fails when a migration step is missing', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const old = { ...JSON.parse(JSON.stringify(plan)), schemaVersion: 1 }
    // Pretend current is 2 with an empty registry.
    const result = migratePlanToCurrent(old, {}, 2)
    expect(result).toEqual({ ok: false, reason: 'missing_step' })
  })

  it('applies registered steps in order and re-validates', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const old = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    // Simulate a v0 plan whose name lived under a different key.
    delete old['name']
    old['title'] = 'Renamed plan'
    old['schemaVersion'] = 1

    // Hypothetical transitions prove every registered step runs in order and
    // final output is re-validated against the actual current Plan schema.
    const step1to2: MigrationStep = (raw) => {
      const { title, ...rest } = raw
      return { ...rest, name: title }
    }
    const step2to3: MigrationStep = (raw) => ({
      ...raw,
      name: `${String(raw['name'])} plan`,
    })
    const step3to4: MigrationStep = (raw) => raw
    const result = migratePlanToCurrent(
      old,
      { 1: step1to2, 2: step2to3, 3: step3to4 },
      4,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.name).toBe('Renamed plan plan')
  })

  it('reports validation issues for corrupt current-version data', () => {
    const result = migratePlanToCurrent({ schemaVersion: 4, id: '', name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_after_migration')
      expect(result.issues).toBeDefined()
    }
  })
})

describe('v1 -> v2 retirement-action migration', () => {
  function rawV1Plan(): Record<string, unknown> {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    return { ...JSON.parse(JSON.stringify(plan)), schemaVersion: 1 } as Record<string, unknown>
  }

  const legacyWithdrawal = {
    kind: 'legacyAggregateWithdrawal',
    year: 2030,
    requestedAmount: 50_000,
    legacyCategory: 'traditional',
    provenance: { source: 'migration', sourceId: 'withdrawalOrder' },
  } as const
  const legacyConversion = {
    kind: 'legacyAggregateRothConversion',
    year: 2031,
    requestedAmount: 25_000,
    provenance: { source: 'migration', sourceId: 'rothConversion' },
  } as const
  const legacyQcd = {
    kind: 'legacyAggregateQcd',
    year: 2032,
    requestedAmount: 10_000,
    legacyField: 'qcdAnnual',
    provenance: { source: 'migration', sourceId: 'qcdAnnual' },
  } as const

  function withActions(
    raw: Record<string, unknown>,
    retirementActions: readonly unknown[],
  ): Record<string, unknown> {
    const strategies = raw['strategies'] as Record<string, unknown>
    return { ...raw, strategies: { ...strategies, retirementActions } }
  }

  function migratedActions(raw: Record<string, unknown>): Array<Record<string, unknown>> {
    const migrated = migratePlanV1ToV2(raw)
    const strategies = migrated['strategies'] as Record<string, unknown>
    return strategies['retirementActions'] as Array<Record<string, unknown>>
  }

  it('adds an empty action schedule without changing legacy scalar strategies', () => {
    const raw = rawV1Plan()
    const strategies = raw['strategies'] as Record<string, unknown>
    delete strategies['retirementActions']
    strategies['withdrawalOrder'] = { mode: 'bracketTargeted', bracketPct: 24 }
    strategies['rothConversion'] = {
      mode: 'manual',
      conversions: [{ year: 2030, amount: 12_345.67 }],
    }
    strategies['qcdAnnual'] = 4_321.09
    const scalarSnapshot = JSON.parse(JSON.stringify(strategies)) as Record<string, unknown>

    const result = migratePlanToCurrent(raw)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(4)
      expect(result.plan.strategies.retirementActions).toEqual([])
      expect(result.plan.strategies.withdrawalOrder).toEqual(scalarSnapshot['withdrawalOrder'])
      expect(result.plan.strategies.rothConversion).toEqual(scalarSnapshot['rothConversion'])
      expect(result.plan.strategies.qcdAnnual).toBe(scalarSnapshot['qcdAnnual'])
    }
  })

  it('rebinds canonical scenario patches to the migrated current plan snapshot', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'scenario-1',
        name: 'Higher inflation',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Higher inflation',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'user' },
          operations: [
            {
              op: 'set',
              path: '/assumptions/inflationPct',
              before: { present: true, value: 2.5 },
              value: 3,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base).toEqual({
      planId: migrated.plan.id,
      planSchemaVersion: 4,
      snapshotHash: scenarioPlanSnapshotHash(migrated.plan),
    })

    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.assumptions.inflationPct).toBe(3)
    const reverted = revertScenarioPatch(applied.plan, parsedPatch.patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) expect(reverted.plan.assumptions.inflationPct).toBe(2.5)
  })

  it('migrates legacy IDs inside canonical action-array operations', () => {
    const raw = withActions(rawV1Plan(), [legacyWithdrawal])
    raw['scenarios'] = [
      {
        id: 'scenario-actions',
        name: 'Add legacy QCD',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Add legacy QCD',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: true, value: [legacyWithdrawal] },
              value: [legacyWithdrawal, legacyQcd],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    expect(operation?.before.present).toBe(true)
    if (operation?.before.present !== true || operation.op !== 'set') return
    const beforeActions = operation.before.value as Array<Record<string, unknown>>
    const valueActions = operation.value as Array<Record<string, unknown>>
    expect(beforeActions[0]?.['actionId']).toBe(
      migrated.plan.strategies.retirementActions[0]?.actionId,
    )
    expect(valueActions.map((action) => action['actionId'])).toEqual([
      beforeActions[0]?.['actionId'],
      expect.stringMatching(/^legacy-qcd-2032-/),
    ])

    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.strategies.retirementActions).toHaveLength(2)
    const reverted = revertScenarioPatch(applied.plan, parsedPatch.patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) {
      expect(reverted.plan.strategies.retirementActions).toEqual(
        migrated.plan.strategies.retirementActions,
      )
    }
  })

  it('keeps retained legacy IDs stable across scenario collision states', () => {
    const standalone = migratedActions(
      withActions(rawV1Plan(), [legacyWithdrawal]),
    )
    const generatedSeed = standalone[0]?.['actionId'] as string
    const collidingSuppliedAction = {
      ...legacyConversion,
      actionId: generatedSeed,
    }
    const raw = withActions(rawV1Plan(), [
      legacyWithdrawal,
      collidingSuppliedAction,
    ])
    raw['scenarios'] = [
      {
        id: 'scenario-remove-collision',
        name: 'Remove colliding action',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Remove colliding action',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: {
                present: true,
                value: [legacyWithdrawal, collidingSuppliedAction],
              },
              value: [legacyWithdrawal],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const retainedActionId =
      migrated.plan.strategies.retirementActions[0]?.actionId
    expect(retainedActionId).toBe(`${generatedSeed}-2`)
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    if (operation?.op !== 'set') return
    const valueActions = operation.value as Array<Record<string, unknown>>
    expect(valueActions[0]?.['actionId']).toBe(retainedActionId)
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toBe(
        retainedActionId,
      )
    }
  })

  it('strips unknown legacy metadata consistently inside canonical scenario arrays', () => {
    const baseAction = {
      ...legacyQcd,
      thirdPartyMetadata: 'base-only',
      provenance: {
        ...legacyQcd.provenance,
        importNote: 'base-only',
      },
    }
    const scenarioAction = {
      ...legacyQcd,
      thirdPartyMetadata: 'scenario-only',
      provenance: {
        ...legacyQcd.provenance,
        importNote: 'scenario-only',
      },
    }
    const raw = withActions(rawV1Plan(), [baseAction])
    raw['scenarios'] = [
      {
        id: 'scenario-strip-action-metadata',
        name: 'Strip action metadata',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Strip action metadata',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: true, value: [baseAction] },
              value: [scenarioAction],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    if (operation?.op !== 'set' || operation.before.present !== true) return
    const beforeAction = (
      operation.before.value as Array<Record<string, unknown>>
    )[0]!
    const valueAction = (operation.value as Array<Record<string, unknown>>)[0]!
    for (const action of [beforeAction, valueAction]) {
      expect(action).not.toHaveProperty('thirdPartyMetadata')
      expect(action['provenance']).not.toHaveProperty('importNote')
    }
    expect(valueAction['actionId']).toBe(beforeAction['actionId'])
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
  })

  it('normalizes an absent direct action-schedule precondition to the v2 default', () => {
    const raw = rawV1Plan()
    const strategies = raw['strategies'] as Record<string, unknown>
    delete strategies['retirementActions']
    raw['scenarios'] = [
      {
        id: 'scenario-add-actions',
        name: 'Introduce action schedule',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Introduce action schedule',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: false },
              value: [legacyQcd],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.operations[0]?.before).toEqual({
      present: true,
      value: [],
    })
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toMatch(
        /^legacy-qcd-2032-/,
      )
    }
  })

  it('normalizes removal of the action schedule to the v2 empty default', () => {
    const raw = withActions(rawV1Plan(), [legacyQcd])
    raw['scenarios'] = [
      {
        id: 'scenario-remove-actions',
        name: 'Remove action schedule',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Remove action schedule',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'remove',
              path: '/strategies/retirementActions',
              before: { present: true, value: [legacyQcd] },
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.operations[0]).toMatchObject({
      op: 'set',
      path: '/strategies/retirementActions',
      value: [],
    })
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.strategies.retirementActions).toEqual([])
    const reverted = revertScenarioPatch(applied.plan, parsedPatch.patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) {
      expect(reverted.plan.strategies.retirementActions[0]?.actionId).toMatch(
        /^legacy-qcd-2032-/,
      )
    }
  })

  it('adds the empty schedule inside whole-strategies scenario operations', () => {
    const raw = rawV1Plan()
    const strategies = raw['strategies'] as Record<string, unknown>
    delete strategies['retirementActions']
    const beforeStrategies = JSON.parse(JSON.stringify(strategies)) as Record<
      string,
      unknown
    >
    const valueStrategies = {
      ...beforeStrategies,
      qcdAnnual: 2_500,
    }
    raw['scenarios'] = [
      {
        id: 'scenario-strategies',
        name: 'Change strategies',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Change strategies',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies',
              before: { present: true, value: beforeStrategies },
              value: valueStrategies,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    expect(operation?.before.present).toBe(true)
    if (operation?.before.present !== true || operation.op !== 'set') return
    expect(operation.before.value).toMatchObject({ retirementActions: [] })
    expect(operation.value).toMatchObject({ retirementActions: [] })

    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.strategies.qcdAnnual).toBe(2_500)
  })

  it('carries a nonempty base schedule through whole-strategies operations', () => {
    const raw = withActions(rawV1Plan(), [legacyQcd])
    const strategies = raw['strategies'] as Record<string, unknown>
    const beforeStrategies = JSON.parse(JSON.stringify(strategies)) as Record<
      string,
      unknown
    >
    delete beforeStrategies['retirementActions']
    const valueStrategies = {
      ...beforeStrategies,
      qcdAnnual: 2_500,
    }
    raw['scenarios'] = [
      {
        id: 'scenario-strategies-with-actions',
        name: 'Change strategies and retain actions',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Change strategies and retain actions',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies',
              before: { present: true, value: beforeStrategies },
              value: valueStrategies,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const retainedActionId =
      migrated.plan.strategies.retirementActions[0]?.actionId
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    if (operation?.op !== 'set' || operation.before.present !== true) return
    for (const value of [operation.before.value, operation.value]) {
      const operationStrategies = value as Record<string, unknown>
      const operationActions = operationStrategies[
        'retirementActions'
      ] as Array<Record<string, unknown>>
      expect(operationActions[0]?.['actionId']).toBe(retainedActionId)
    }
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toBe(
        retainedActionId,
      )
    }
  })

  it('migrates ID-less actions inside loose legacy scenario patches', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'legacy-scenario-actions',
        name: 'Legacy action patch',
        patch: {
          strategies: {
            retirementActions: [legacyQcd],
          },
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const applied = applyScenarioPatch(
      migrated.plan,
      migrated.plan.scenarios[0]!.patch,
    )
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toMatch(
        /^legacy-qcd-2032-/,
      )
    }
  })

  it('preserves a canonical scenario that targets a different plan ID', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'foreign-scenario',
        name: 'Foreign scenario',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: 'another-plan',
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Foreign scenario',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/assumptions/inflationPct',
              before: { present: true, value: 2.5 },
              value: 3,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base.planId).toBe('another-plan')
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) {
      expect(applied.conflicts.some((conflict) => conflict.kind === 'plan-id')).toBe(
        true,
      )
    }
  })

  it('preserves a canonical scenario that targets a different schema version', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'foreign-version-scenario',
        name: 'Foreign schema scenario',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 99,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Foreign schema scenario',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: true, value: [] },
              value: [legacyQcd],
            },
          ],
        },
      },
    ]
    const patchSnapshot = JSON.parse(
      JSON.stringify(
        (raw['scenarios'] as Array<Record<string, unknown>>)[0]?.['patch'],
      ),
    )

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.plan.scenarios[0]!.patch).toEqual(patchSnapshot)
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base.planSchemaVersion).toBe(99)
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) {
      expect(
        applied.conflicts.some(
          (conflict) => conflict.kind === 'plan-schema-version',
        ),
      ).toBe(true)
    }
  })

  it('assigns stable IDs to only genuinely ID-less typed legacy records', () => {
    const raw = withActions(rawV1Plan(), [
      legacyWithdrawal,
      { ...legacyConversion, actionId: 'preserved-byte-for-byte' },
      legacyQcd,
    ])
    const first = migratedActions(raw)
    const second = migratedActions(raw)

    expect(first).toEqual(second)
    expect(first[0]?.['actionId']).toMatch(/^legacy-withdrawal-2030-/)
    expect(first[1]?.['actionId']).toBe('preserved-byte-for-byte')
    expect(first[2]?.['actionId']).toMatch(/^legacy-qcd-2032-/)
    expect(new Set(first.map((action) => action['actionId'])).size).toBe(3)

    const forbiddenInventedFields = [
      'personId',
      'donorPersonId',
      'allocations',
      'allocation',
      'destinationRothAccountId',
      'executionDate',
      'executionSequence',
      'purpose',
      'charity',
      'taxFunding',
    ]
    for (const action of first) {
      for (const field of forbiddenInventedFields) {
        expect(action).not.toHaveProperty(field)
      }
    }

    const fullyMigrated = migratePlanToCurrent(raw)
    expect(fullyMigrated.ok).toBe(true)
  })

  it('is independent of action input ordering', () => {
    const forward = migratedActions(
      withActions(rawV1Plan(), [legacyWithdrawal, legacyConversion, legacyQcd]),
    )
    const reverse = migratedActions(
      withActions(rawV1Plan(), [legacyQcd, legacyConversion, legacyWithdrawal]),
    )
    const idByKind = (actions: Array<Record<string, unknown>>) =>
      Object.fromEntries(actions.map((action) => [action['kind'], action['actionId']]))

    expect(idByKind(reverse)).toEqual(idByKind(forward))
  })

  it('reserves supplied IDs and suffixes a generated collision deterministically', () => {
    const seed = migratedActions(withActions(rawV1Plan(), [legacyWithdrawal]))[0]?.[
      'actionId'
    ] as string
    const actions = migratedActions(
      withActions(rawV1Plan(), [
        { ...legacyConversion, actionId: seed },
        legacyWithdrawal,
      ]),
    )

    expect(actions[0]?.['actionId']).toBe(seed)
    expect(actions[1]?.['actionId']).toBe(`${seed}-2`)
  })

  it('is copy-on-change and idempotent once all legacy records have IDs', () => {
    const raw = withActions(rawV1Plan(), [
      { ...legacyWithdrawal, actionId: 'legacy-withdrawal-fixed' },
    ])
    expect(migratePlanV1ToV2(raw)).toBe(raw)

    const missing = withActions(rawV1Plan(), [legacyWithdrawal])
    const normalized = migratePlanV1ToV2(missing)
    expect(normalized).not.toBe(missing)
    expect(migratePlanV1ToV2(normalized)).toBe(normalized)
  })

  it.each([
    ['blank', ''],
    ['blank whitespace', '  '],
    ['null', null],
  ])('never replaces a supplied %s action ID; final parsing rejects it', (_label, actionId) => {
    const raw = withActions(rawV1Plan(), [{ ...legacyQcd, actionId }])
    expect(migratedActions(raw)[0]?.['actionId']).toBe(actionId)
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_after_migration')
  })

  it('does not normalize unknown/current records that omit an action ID', () => {
    const raw = withActions(rawV1Plan(), [
      {
        kind: 'ordinaryWithdrawal',
        personId: 'missing',
        year: 2030,
        requestedAmount: 100,
      },
    ])
    expect(migratePlanV1ToV2(raw)).toBe(raw)
  })

  it('strips unknown persisted legacy fields while assigning a missing ID', () => {
    const raw = withActions(rawV1Plan(), [
      {
        ...legacyQcd,
        thirdPartyMetadata: 'ignored',
        provenance: {
          ...legacyQcd.provenance,
          importNote: 'ignored',
        },
      },
    ])
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const action = result.plan.strategies.retirementActions[0] as unknown as Record<
      string,
      unknown
    >
    expect(action['actionId']).toMatch(/^legacy-qcd-2032-/)
    expect(action).not.toHaveProperty('thirdPartyMetadata')
    expect(action['provenance']).not.toHaveProperty('importNote')
  })

  it('does not normalize a malformed legacy-looking record', () => {
    const raw = withActions(rawV1Plan(), [
      {
        kind: 'legacyAggregateQcd',
        year: 2030,
        requestedAmount: 100,
        legacyField: 'not-qcdAnnual',
        provenance: { source: 'migration' },
      },
    ])
    expect(migratePlanV1ToV2(raw)).toBe(raw)
  })
})

describe('v2 -> v3 retirement-action eligibility facts migration', () => {
  function rawV2Plan(): Record<string, unknown> {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    return {
      ...JSON.parse(JSON.stringify(current)),
      schemaVersion: 2,
    } as Record<string, unknown>
  }

  it('is pure and does not invent eligibility evidence', () => {
    const raw = rawV2Plan()
    const migrated = migratePlanV2ToV3(raw)
    expect(migrated).toBe(raw)
    expect(migrated).not.toHaveProperty('retirementActionEligibilityFacts')

    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(4)
      expect(result.plan).not.toHaveProperty('retirementActionEligibilityFacts')
    }
  })

  it.each([1, 2])(
    'discards a root eligibility-facts field smuggled into schema v%s',
    (schemaVersion) => {
      const raw = {
        ...rawV2Plan(),
        schemaVersion,
        retirementActionEligibilityFacts: {
          iraClassifications: [
            {
              evidenceId: 'untrusted',
              provenance: { source: 'manual' },
              sourceAccountId: 'invented',
              subtype: 'traditional',
            },
          ],
          sepSimpleActivities: [],
          deductibleIraContributions: [],
        },
      }
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.plan.schemaVersion).toBe(4)
        expect(result.plan).not.toHaveProperty(
          'retirementActionEligibilityFacts',
        )
      }
    },
  )

  it('rebinds a canonical v2 scenario to the migrated current snapshot', () => {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    const edited = structuredClone(current)
    edited.assumptions.inflationPct = 3
    const created = createScenarioPatch(current, edited, {
      title: 'Higher inflation',
      createdAtIso: '2026-06-11T00:00:00.000Z',
      actor: { kind: 'user' },
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const raw = {
      ...JSON.parse(JSON.stringify(current)),
      schemaVersion: 2,
      scenarios: [
        {
          id: 'scenario-v2',
          name: 'Higher inflation',
          patch: {
            ...created.patch,
            base: {
              ...created.patch.base,
              planSchemaVersion: 2,
            },
          },
        },
      ],
    }

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base).toEqual({
      planId: migrated.plan.id,
      planSchemaVersion: 4,
      snapshotHash: scenarioPlanSnapshotHash(migrated.plan),
    })
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.assumptions.inflationPct).toBe(3)
  })
})

describe('v3 -> v4 retirement-action annual tax facts migration', () => {
  function rawV3Plan(): Record<string, unknown> {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    return {
      ...JSON.parse(JSON.stringify(current)),
      schemaVersion: 3,
    } as Record<string, unknown>
  }

  it('is pure and does not invent authoritative annual tax facts', () => {
    const raw = rawV3Plan()
    const migrated = migratePlanV3ToV4(raw)
    expect(migrated).toBe(raw)
    expect(migrated).not.toHaveProperty('retirementActionAnnualTaxFacts')

    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(4)
      expect(result.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    }
  })

  it.each([1, 2, 3])(
    'discards annual tax facts smuggled into schema v%s',
    (schemaVersion) => {
      const raw = {
        ...rawV3Plan(),
        schemaVersion,
        retirementActionAnnualTaxFacts: {
          ownedNonRothIraAnnualFilingSourceRecords: [{
            predicate: 'completePlanOwnedNonRothIraAnnualFilingSourceRecord',
            planId: 'invented-plan',
            ownerPersonId: 'invented-owner',
            taxYear: 2025,
          }],
        },
      }
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.plan.schemaVersion).toBe(4)
        expect(result.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
      }
    },
  )
})
