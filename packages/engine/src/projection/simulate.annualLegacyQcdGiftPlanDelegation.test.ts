/** Hostile delegation, downstream-application, and rollback guard for scalar QCD planning. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualLegacyQcdGiftPlanInput,
  AnnualLegacyQcdGiftPlanResult,
} from './internal/annualLegacyQcdGiftPlan.js'

interface GiftPhase {
  readonly input: AnnualLegacyQcdGiftPlanInput
  readonly balancesAtCall: readonly Readonly<{
    accountId: string
    balance: number
  }>[]
  readonly natural: AnnualLegacyQcdGiftPlanResult
  readonly injected: AnnualLegacyQcdGiftPlanResult
}

const seam = vi.hoisted(() => ({
  mode: 'normal' as
    | 'normal'
    | 'naturalGrouped'
    | 'wrongPosition'
    | 'wrongSecondPosition'
    | 'wrongOwner'
    | 'staleBalance'
    | 'zeroAmount'
    | 'subCentAmount'
    | 'overdraw'
    | 'duplicateSourceOverdraw'
    | 'nonIra'
    | 'historyWrite'
    | 'laterAmountReadFailure'
    | 'laterIdentityReadFailure'
    | 'identityFlipAfterValidation'
    | 'historyPropertyReadFailure'
    | 'historyIteratorReadFailure',
  amountReads: [] as string[],
  identityReads: [] as string[],
  captureLogicalWrites: false,
  logicalWrites: [] as Readonly<{ accountId: string; balance: number }>[],
  historyPropertyReads: 0,
  historyIterations: 0,
  giftPhases: [] as GiftPhase[],
  characterInputs: [] as Readonly<{
    grossIdentity: ReadonlyMap<string, number>
    fromRmdIdentity: ReadonlyMap<string, number>
    gross: readonly (readonly [string, number])[]
    fromRmd: readonly (readonly [string, number])[]
  }>[],
  prerequisitePriorOffsets: [] as Readonly<{
    taxYear: number
    actionIds: readonly string[]
  }>[],
}))

vi.mock('./internal/annualLegacyQcdGiftPlan.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualLegacyQcdGiftPlan.js')
  >()
  return {
    ...original,
    annualLegacyQcdGiftPlan: (input: AnnualLegacyQcdGiftPlanInput) => {
      const natural = original.annualLegacyQcdGiftPlan(input)
      if (input.hasNamedQcdRequest || input.qcdAnnual <= 0) return natural
      if (seam.mode === 'naturalGrouped') {
        seam.giftPhases.push({
          input,
          balancesAtCall: input.balances.map(({ accountId, balance }) => ({
            accountId,
            balance,
          })),
          natural,
          injected: natural,
        })
        return natural
      }
      const firstIndex = input.balances.find(
        (state) => state.accountId === 'ira-a',
      )?.balanceIndex
      const secondIndex = input.balances.find(
        (state) => state.accountId === 'ira-b',
      )?.balanceIndex
      const cashIndex = input.balances.find(
        (state) => state.accountId === 'cash',
      )?.balanceIndex
      if (
        firstIndex === undefined ||
        secondIndex === undefined ||
        cashIndex === undefined
      ) {
        throw new Error('delegation fixture lost an IRA source')
      }
      const firstBalance = input.balances.find(
        (state) => state.accountId === 'ira-a',
      )!.balance
      const secondBalance = input.balances.find(
        (state) => state.accountId === 'ira-b',
      )!.balance
      const cashBalance = input.balances.find(
        (state) => state.accountId === 'cash',
      )!.balance
      let secondSourceAccountIdReads = 0
      const firstIntent = {
        balanceIndex: seam.mode === 'wrongPosition'
          ? firstIndex
          : seam.mode === 'nonIra'
            ? cashIndex
            : secondIndex,
        sourceAccountId: seam.mode === 'nonIra' ? 'cash' : 'ira-b',
        ownerId: seam.mode === 'wrongOwner' ? 'p2' : 'p1',
        sourceBalanceBefore: seam.mode === 'staleBalance'
          ? secondBalance + 1
          : seam.mode === 'nonIra'
            ? cashBalance
            : secondBalance,
        get amount() {
          seam.amountReads.push('ira-b')
          return seam.mode === 'duplicateSourceOverdraw' ? 1_200 : 222.22
        },
      }
      const secondIntent = {
        balanceIndex: seam.mode === 'wrongSecondPosition'
          ? secondIndex
          : seam.mode === 'duplicateSourceOverdraw'
            ? secondIndex
            : firstIndex,
        get sourceAccountId() {
          seam.identityReads.push(
            seam.mode === 'duplicateSourceOverdraw' ? 'ira-b' : 'ira-a',
          )
          secondSourceAccountIdReads += 1
          if (
            seam.mode === 'laterIdentityReadFailure' ||
            (seam.mode === 'identityFlipAfterValidation' &&
              secondSourceAccountIdReads > 1)
          ) {
            throw new Error('hostile later identity read')
          }
          return seam.mode === 'duplicateSourceOverdraw' ? 'ira-b' : 'ira-a'
        },
        ownerId: 'p1',
        sourceBalanceBefore: seam.mode === 'duplicateSourceOverdraw'
          ? secondBalance - 1_200
          : firstBalance,
        get amount() {
          seam.amountReads.push(
            seam.mode === 'duplicateSourceOverdraw' ? 'ira-b' : 'ira-a',
          )
          if (seam.mode === 'laterAmountReadFailure') {
            throw new Error('hostile later amount read')
          }
          return seam.mode === 'zeroAmount'
            ? 0
            : seam.mode === 'subCentAmount'
              ? 0.004
            : seam.mode === 'overdraw'
              ? firstBalance + 0.01
              : seam.mode === 'duplicateSourceOverdraw'
                ? 900
                : 111.11
        },
      }
      const offsetHistoryUnprovableDonorIds = seam.mode === 'historyWrite'
        ? ['p1']
        : []
      const historyIterator = offsetHistoryUnprovableDonorIds[Symbol.iterator]
        .bind(offsetHistoryUnprovableDonorIds)
      Object.defineProperty(offsetHistoryUnprovableDonorIds, Symbol.iterator, {
        value: () => {
          seam.historyIterations += 1
          if (seam.mode === 'historyIteratorReadFailure') {
            throw new Error('hostile history iterator read')
          }
          return historyIterator()
        },
      })
      const injected = {
        qcd: 333.33,
        qcdFromRmd: 0,
        qcdGrossByOwner: new Map([['p1', 333.33]]),
        qcdFromRmdByOwner: new Map(),
        // Reverse account order so mutation/application order is observable.
        debitIntents: [firstIntent, secondIntent],
        offsetHistoryUnprovableDonorIds,
        // Natural planning marks p1. Both outcomes are deliberately hostile:
        // empty catches retained inline marking, while nonempty catches a
        // caller that drops the helper-provided history-write list entirely.
      } satisfies AnnualLegacyQcdGiftPlanResult
      Object.defineProperty(injected, 'offsetHistoryUnprovableDonorIds', {
        get: () => {
          seam.historyPropertyReads += 1
          if (seam.mode === 'historyPropertyReadFailure') {
            throw new Error('hostile history property read')
          }
          return offsetHistoryUnprovableDonorIds
        },
      })
      seam.giftPhases.push({
        input,
        balancesAtCall: input.balances.map(({ accountId, balance }) => ({
          accountId,
          balance,
        })),
        natural,
        injected,
      })
      seam.captureLogicalWrites = true
      return injected
    },
  }
})

vi.mock('./internal/annualLogicalBalanceLedger.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualLogicalBalanceLedger.js')
  >()
  const applyClosingSnapshot =
    original.AnnualLogicalBalanceGroup.prototype.applyClosingSnapshot
  original.AnnualLogicalBalanceGroup.prototype.applyClosingSnapshot = function (
    closing,
  ) {
    if (seam.captureLogicalWrites) {
      seam.logicalWrites.push({ accountId: this.id, balance: closing.balance })
    }
    return applyClosingSnapshot.call(this, closing)
  }
  return original
})

vi.mock('./internal/annualLegacyQcdOwnerCharacterPlan.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualLegacyQcdOwnerCharacterPlan.js')
  >()
  return {
    ...original,
    annualLegacyQcdOwnerCharacterPlan: (
      input: Parameters<typeof original.annualLegacyQcdOwnerCharacterPlan>[0],
    ) => {
      seam.characterInputs.push({
        grossIdentity: input.qcdGrossByOwner,
        fromRmdIdentity: input.qcdFromRmdByOwner,
        gross: [...input.qcdGrossByOwner],
        fromRmd: [...input.qcdFromRmdByOwner],
      })
      return original.annualLegacyQcdOwnerCharacterPlan(input)
    },
  }
})

vi.mock('../actions/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../actions/index.js')>()
  return {
    ...original,
    evaluateAnnualQcdExecutionPrerequisites: (
      input: Parameters<typeof original.evaluateAnnualQcdExecutionPrerequisites>[0],
    ) => {
      seam.prerequisitePriorOffsets.push({
        taxYear: input.taxYear,
        actionIds: (input.runtimeEvidence?.priorQcdOffsetEvidence ?? [])
          .map((evidence) => String(evidence.actionId)),
      })
      return original.evaluateAnnualQcdExecutionPrerequisites(input)
    },
  }
})

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'

const START_YEAR = 2026

function ira(id: string, balance: number): Account {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function namedQcd2027(): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(100 * 100)
  return {
    actionId: asActionId('named-qcd-2027'),
    kind: 'qcd',
    year: 2027,
    executionDate: '2027-08-01',
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('named-qcd-2027-allocation'),
      sourceAccountId: asAccountId('ira-a'),
      requestedAmount: amount,
    },
    charity: {
      designationId: 'delegation-charity',
      name: 'Eligible public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function plan(grouped = false): Plan {
  const value = singlePersonPlan({
    dob: grouped ? '1956-06-15' : '1955-01-01',
    planningAge: 95,
    retirementAge: null,
  })
  value.assumptions.inflationPct = 0
  value.assumptions.defaultReturnPct = 0
  value.expenses.baseAnnual = 0
  value.accounts = grouped
    ? [
        cashAccount('cash', 100_000),
        ira('grouped-ira', 1_000),
        ira('grouped-ira', 200),
      ]
    : [
        cashAccount('cash', 100_000),
        ira('ira-a', 1_000),
        ira('ira-b', 2_000),
      ]
  value.strategies.qcdAnnual = grouped ? 1_100 : 9_999
  value.strategies.retirementActions = grouped ? [] : [namedQcd2027()]
  value.retirementActionEligibilityFacts = grouped ? {
    iraClassifications: [],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  } : {
    iraClassifications: [{
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [2025, 2026, 2027].map((taxYear) => ({
      donorPersonId: 'p1',
      taxYear,
      amountCents: asUsdCents((taxYear === 2025 ? 100 : 0) * 100),
      evidenceId: `section-219-${taxYear}`,
      provenance: { source: 'manual', sourceId: `ledger-${taxYear}` },
    })),
  }
  return value
}

function run(mode: typeof seam.mode = 'normal') {
  seam.mode = mode
  seam.giftPhases.length = 0
  seam.amountReads.length = 0
  seam.identityReads.length = 0
  seam.captureLogicalWrites = false
  seam.logicalWrites.length = 0
  seam.historyPropertyReads = 0
  seam.historyIterations = 0
  seam.characterInputs.length = 0
  seam.prerequisitePriorOffsets.length = 0
  const counterfactualReads: unknown[] = []
  const annualCounterfactual: SimulateAnnualCounterfactualRequest = {
    omitActionIds: [],
    taxUnitId: 'qcd-gift-delegation-tax-unit',
    nonGroupTaxInputs: [{
      inputId: 'federalFilingStatus',
      value: { representation: 'declaredTerm', term: 'single' },
    }],
    capture: (reading) => { counterfactualReads.push(reading) },
  }
  const result = simulatePlan(validatePlan(plan(mode === 'naturalGrouped')), {
    startYear: START_YEAR,
    horizonEndYear: START_YEAR + 1,
    taxCalculator: createFlatTaxCalculator(0),
    captureAnnualCashFlow: true,
    annualCounterfactual,
  })
  return { result, counterfactualReads }
}

describe('simulatePlan delegates scalar QCD gift planning', () => {
  it('plans and journals one logical debit across compatible duplicate physical rows', () => {
    const { result } = run('naturalGrouped')
    const calls = seam.giftPhases.filter((phase) =>
      phase.input.people[0]?.ageAttained === 70)

    expect(calls.length).toBeGreaterThan(1)
    for (const phase of calls) {
      expect(phase.balancesAtCall).toEqual([
        { accountId: 'cash', balance: 100_000 },
        { accountId: 'grouped-ira', balance: 1_200 },
      ])
      expect(phase.natural.debitIntents).toEqual([{
        balanceIndex: 1,
        sourceAccountId: 'grouped-ira',
        ownerId: 'p1',
        sourceBalanceBefore: 1_200,
        amount: 1_100,
      }])
    }

    const year = result.years[0]!
    expect(year.qcd).toBe(1_100)
    expect(year.balances['grouped-ira']).toBe(100)
    const occurrences = year.retirementRuntimeSource!.runtimeOccurrences
      .filter((occurrence) => occurrence.kind === 'legacyQcd')
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]).toMatchObject({
      sourceAccountId: 'grouped-ira',
      grossAmountPlanDollars: 1_100,
    })
    const applications = year.retirementRuntimeApplicationSource!.applications
      .filter((application) =>
        application.applicationKind === 'debit' &&
        application.simulatorPhase === 'legacyQcdDistribution')
    expect(applications).toHaveLength(1)
    expect(applications[0]).toMatchObject({
      sourceAccountId: 'grouped-ira',
      sourceBalanceBeforePlanDollars: 1_200,
      appliedAmountPlanDollars: 1_100,
      sourceBalanceAfterPlanDollars: 100,
    })
  })

  it('passes exact snapshots, applies hostile intents in order, and rolls back re-entry', () => {
    const { result, counterfactualReads } = run()
    const calls2026 = seam.giftPhases.filter((phase) =>
      phase.input.people[0]?.ageAttained === 71)

    expect(calls2026.length).toBeGreaterThan(1)
    expect(counterfactualReads).toHaveLength(2)
    for (const phase of calls2026) {
      expect(phase.input).toMatchObject({
        qcdAnnual: 9_999,
        inflFactor: 1,
        perDonorLimit: 111_000,
        hasNamedQcdRequest: false,
        people: [{
          personId: 'p1', alive: true, ageAttained: 71, birthMonth: 1,
        }],
        ownedIraRmdTotal: 0,
      })
      expect([...phase.input.ownedIraRmdGrossByOwner]).toEqual([])
      expect(phase.balancesAtCall).toEqual([
        { accountId: 'cash', balance: 100_000 },
        { accountId: 'ira-a', balance: 1_000 },
        { accountId: 'ira-b', balance: 2_000 },
      ])
      expect(phase.natural.qcd).toBe(3_000)
      expect(phase.injected.qcd).toBe(333.33)
    }
    expect(new Set(calls2026.map((phase) => phase.injected.debitIntents)))
      .toHaveLength(calls2026.length)
    expect(new Set(calls2026.flatMap(
      (phase) => phase.injected.debitIntents,
    ))).toHaveLength(calls2026.length * 2)
    expect(new Set(calls2026.map((phase) => phase.injected.qcdGrossByOwner)))
      .toHaveLength(calls2026.length)

    const year = result.years[0]!
    expect(year.qcd).toBe(333.33)
    expect(year.balances['ira-a']).toBe(888.89)
    expect(year.balances['ira-b']).toBe(1_777.78)
    const applications = year.retirementRuntimeApplicationSource!.applications.filter(
      (application) =>
        application.applicationKind === 'debit' &&
        application.simulatorPhase === 'legacyQcdDistribution',
    )
    expect(applications.map((application) => ({
      sourceAccountId: application.sourceAccountId,
      amount: 'appliedAmountPlanDollars' in application
        ? application.appliedAmountPlanDollars
        : null,
      before: application.sourceBalanceBeforePlanDollars,
      after: application.sourceBalanceAfterPlanDollars,
      mutationOrdinal: application.mutationOrdinal,
    }))).toEqual([
      {
        sourceAccountId: 'ira-b', amount: 222.22,
        before: 2_000, after: 1_777.78,
        mutationOrdinal: 1,
      },
      {
        sourceAccountId: 'ira-a', amount: 111.11,
        before: 1_000, after: 888.89,
        mutationOrdinal: 2,
      },
    ])
    expect(seam.characterInputs.some((input) =>
      JSON.stringify({ gross: input.gross, fromRmd: input.fromRmd }) ===
      JSON.stringify({
        gross: [['p1', 333.33]],
        fromRmd: [],
      }))).toBe(true)
    const committedCharacterInput = seam.characterInputs.find((input) =>
      input.grossIdentity === calls2026.at(-1)!.injected.qcdGrossByOwner)
    expect(committedCharacterInput?.fromRmdIdentity).toBe(
      calls2026.at(-1)!.injected.qcdFromRmdByOwner,
    )
    const beyondTransfers = year.cashFlow!.transferLines.filter((line) =>
      line.id.includes('qualifiedCharitableDistribution:beyondRmd'))
    expect(beyondTransfers.map((line) => [line.id, line.debitPlanDollars]))
      .toEqual([
        ['transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-a', 111.11],
        ['transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-b', 222.22],
      ])
  })

  it('uses the helper history-write list rather than retaining inline donor marking', () => {
    run()
    const named2027CallsWithEmptyWriteList = seam.prerequisitePriorOffsets.filter((call) =>
      call.taxYear === 2027)
    expect(named2027CallsWithEmptyWriteList.length).toBeGreaterThan(1)
    for (const call of named2027CallsWithEmptyWriteList) {
      expect(call.actionIds).toContain('named-qcd-2027')
    }

    run('historyWrite')
    const named2027CallsWithP1Write = seam.prerequisitePriorOffsets.filter((call) =>
      call.taxYear === 2027)
    expect(named2027CallsWithP1Write).toHaveLength(
      named2027CallsWithEmptyWriteList.length,
    )
    for (const call of named2027CallsWithP1Write) {
      expect(call.actionIds).not.toContain('named-qcd-2027')
    }
  })

  it('fails closed before mutation for hostile debit intents', () => {
    for (const mode of [
      'wrongPosition',
      'wrongSecondPosition',
      'wrongOwner',
      'staleBalance',
      'zeroAmount',
      'subCentAmount',
      'overdraw',
      'nonIra',
    ] as const) {
      expect(() => run(mode)).toThrow(
        'Legacy scalar QCD debit intent lost its live source identity',
      )
    }
  })

  it('rejects a same-source cumulative amount after sequential identity passes', () => {
    // The second intent declares the post-first-debit $800 shadow balance, so
    // it reaches the independent $900 > $800 amount check rather than the
    // earlier sourceBalanceBefore identity check already covered elsewhere.
    expect(() => run('duplicateSourceOverdraw')).toThrow(
      'Legacy scalar QCD debit intent lost its live source identity',
    )
    expect(seam.amountReads.length).toBeGreaterThan(0)
    expect(seam.amountReads.length % 2).toBe(0)
    for (let index = 0; index < seam.amountReads.length; index += 2) {
      expect(seam.amountReads.slice(index, index + 2))
        .toEqual(['ira-b', 'ira-b'])
    }
  })

  it('reads every intent for validation before it can re-read the first for mutation', () => {
    expect(() => run('laterAmountReadFailure')).toThrow(
      'hostile later amount read',
    )
    // A validate-and-mutate loop would read ira-b again to debit it (and write
    // its runtime occurrence/application) before reaching ira-a. Counterfactual
    // evaluation retries the annual pass, so prove the invariant independently
    // for each attempt: every read pair reaches the later intent before any
    // first-intent re-read can begin a mutation.
    expect(seam.amountReads.length).toBeGreaterThan(0)
    expect(seam.amountReads.length % 2).toBe(0)
    for (let index = 0; index < seam.amountReads.length; index += 2) {
      expect(seam.amountReads.slice(index, index + 2)).toEqual(['ira-b', 'ira-a'])
    }
  })

  it('fails on a later identity getter before any scalar-QCD publication', () => {
    expect(() => run('laterIdentityReadFailure')).toThrow(
      'hostile later identity read',
    )
    expect(seam.identityReads.length).toBeGreaterThan(0)
    expect(seam.identityReads).toEqual(
      seam.identityReads.map(() => 'ira-a'),
    )
    expect(seam.amountReads).toEqual(
      seam.identityReads.map(() => 'ira-b'),
    )
    expect(seam.logicalWrites).toEqual([])
    expect(seam.historyIterations).toBe(0)
    expect(seam.characterInputs).toEqual([])
  })

  it('never re-reads a normalized later identity during apply', () => {
    const { result } = run('identityFlipAfterValidation')
    const calls2026 = seam.giftPhases.filter((phase) =>
      phase.input.people[0]?.ageAttained === 71)

    expect(calls2026.length).toBeGreaterThan(1)
    expect(seam.identityReads).toEqual(
      calls2026.map(() => 'ira-a'),
    )
    expect(result.years[0]!.balances).toMatchObject({
      'ira-a': 888.89,
      'ira-b': 1_777.78,
    })
    expect(result.years[0]!.retirementRuntimeApplicationSource!.applications
      .filter((application) =>
        application.applicationKind === 'debit' &&
        application.simulatorPhase === 'legacyQcdDistribution'))
      .toHaveLength(2)
  })

  it('materializes hostile history channels before any scalar-QCD publication', () => {
    expect(() => run('historyPropertyReadFailure')).toThrow(
      'hostile history property read',
    )
    expect(seam.historyPropertyReads).toBeGreaterThan(0)
    expect(seam.historyIterations).toBe(0)
    // The logical setter is the first apply operation and strictly precedes
    // runtime, deferred-character and history publication at this seam.
    expect(seam.logicalWrites).toEqual([])
    expect(seam.characterInputs).toEqual([])
    expect(seam.prerequisitePriorOffsets).toEqual([])

    expect(() => run('historyIteratorReadFailure')).toThrow(
      'hostile history iterator read',
    )
    expect(seam.historyPropertyReads).toBeGreaterThan(0)
    expect(seam.historyIterations).toBe(seam.historyPropertyReads)
    expect(seam.logicalWrites).toEqual([])
    expect(seam.characterInputs).toEqual([])
    expect(seam.prerequisitePriorOffsets).toEqual([])
  })
})
