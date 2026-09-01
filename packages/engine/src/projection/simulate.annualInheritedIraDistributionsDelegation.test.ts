/** Hostile call-site guard for the annual inherited-account planner. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualInheritedIraDistributionsInput,
  AnnualInheritedIraDistributionsResult,
} from './internal/annualInheritedIraDistributions.js'

interface Phase {
  readonly year: number
  readonly input: AnnualInheritedIraDistributionsInput
  readonly original: AnnualInheritedIraDistributionsResult
  readonly output: AnnualInheritedIraDistributionsResult
  readonly openingTraditional: number
  readonly openingRoth: number
  readonly getterReads: ReadonlyMap<string, number>
}

const seam = vi.hoisted(() => ({
  mode: 'original' as
    | 'original'
    | 'dynamic'
    | 'wrongPosition'
    | 'invalidSecond'
    | 'wrongOwner'
    | 'subCent'
    | 'singleRead'
    | 'throwDuringMaterialization',
  phases: [] as Phase[],
  snapshots: [] as {
    readonly phase: Phase | undefined
    readonly traditional: number | undefined
    readonly roth: number | undefined
  }[],
  taxInputs: [] as {
    readonly phase: Phase | undefined
    readonly ordinaryIncome: number
  }[],
}))

vi.mock('./internal/annualInheritedIraDistributions.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualInheritedIraDistributions.js')
  >()
  return {
    ...original,
    annualInheritedIraDistributions: (
      input: AnnualInheritedIraDistributionsInput,
    ) => {
      const production = original.annualInheritedIraDistributions(input)
      const ordinal = seam.phases.length
      const traditionalState = input.balances.find(
        (state) => state.account.id === 'inherited-traditional',
      )!
      const rothState = input.balances.find(
        (state) => state.account.id === 'inherited-roth',
      )!
      let output = production
      if (
        seam.mode !== 'original' &&
        seam.mode !== 'singleRead' &&
        seam.mode !== 'throwDuringMaterialization'
      ) {
        const traditionalExecuted = 10 + (input.year - 2025) + ordinal / 100
        const rothExecuted = 20 + (input.year - 2025) + ordinal / 100
        const rows = production.rows.map((row) => {
          const state = input.balances[row.balanceIndex]!
          const executed = seam.mode === 'subCent' &&
              row.accountId === 'inherited-roth'
            ? 0.004
            : row.accountId === 'inherited-traditional'
              ? traditionalExecuted
              : rothExecuted
          return {
            ...row,
            distribution: {
              balanceIndex: seam.mode === 'wrongPosition'
                ? 0
                : row.balanceIndex,
              accountId: row.accountId,
              ownerPersonId: seam.mode === 'wrongOwner' &&
                  row.accountId === 'inherited-roth'
                ? 'wrong-owner'
                : state.account.ownerPersonId,
              sourceBalanceBefore: state.balance,
              sourceBalanceAfter:
                state.balance - executed +
                (seam.mode === 'invalidSecond' &&
                    row.accountId === 'inherited-roth'
                  ? 1
                  : 0),
              executed,
            },
            evidence: {
              ...row.evidence,
              requiredAmount: executed + 400,
              executedRequiredAmount: executed,
            },
          }
        })
        const base = (input.year - 2025) * 100 + ordinal
        output = {
          totals: {
            inherited: traditionalExecuted + rothExecuted,
            ordinaryIncome: traditionalExecuted,
            rothForced: rothExecuted,
          },
          rows,
          rmdShortfallObligations: [{
            obligationId:
              `rmd-shortfall:["inherited-iras","p1","sentinel-${base}","traditional"]:${input.year}:tax-${input.year}`,
            distributionCalendarYear: input.year,
            taxYear: input.year,
            taxImposedOn: `${input.year}-12-31`,
            applicablePlan: {
              kind: 'inheritedIras',
              payeePersonId: 'p1',
              decedentId: `sentinel-${base}`,
              iraType: 'traditional',
            },
            requirementKind: 'inheritedAnnualLifeExpectancy',
            requiredAmount: 400,
            distributedByDeadline: 0,
          }],
        }
      }
      const getterReads = new Map<string, number>()
      if (
        seam.mode === 'singleRead' ||
        seam.mode === 'throwDuringMaterialization'
      ) {
        const guarded = (value: unknown, path: string): unknown => {
          if (Array.isArray(value)) {
            return value.map((child, index) => guarded(child, `${path}[${index}]`))
          }
          if (value === null || typeof value !== 'object') return value
          const result: Record<string, unknown> = {}
          for (const [key, child] of Object.entries(value)) {
            const childPath = `${path}.${key}`
            const guardedChild = guarded(child, childPath)
            Object.defineProperty(result, key, {
              enumerable: true,
              configurable: true,
              get() {
                const reads = (getterReads.get(childPath) ?? 0) + 1
                getterReads.set(childPath, reads)
                if (
                  seam.mode === 'throwDuringMaterialization' &&
                  childPath === 'result.rows[0].distribution.executed'
                ) {
                  throw new Error(
                    'hostile inherited result threw during materialization',
                  )
                }
                if (reads > 1) {
                  throw new Error(
                    `hostile inherited result property reread: ${childPath}`,
                  )
                }
                return guardedChild
              },
            })
          }
          return result
        }
        output = guarded(
          production,
          'result',
        ) as AnnualInheritedIraDistributionsResult
      }
      const phase = {
        year: input.year,
        input,
        original: production,
        output,
        openingTraditional: traditionalState.balance,
        openingRoth: rothState.balance,
        getterReads,
      }
      seam.phases.push(phase)
      return output
    },
  }
})

vi.mock('./internal/annualSnapshot.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualSnapshot.js')
  >()
  return {
    ...original,
    annualSnapshot: (
      input: Parameters<typeof original.annualSnapshot>[0],
    ) => {
      seam.snapshots.push({
        phase: seam.phases.at(-1),
        traditional: input.balances.find(
          (state) => state.account.id === 'inherited-traditional',
        )?.balance,
        roth: input.balances.find(
          (state) => state.account.id === 'inherited-roth',
        )?.balance,
      })
      return original.annualSnapshot(input)
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { parseRetirementActionRequest } from '../actions/index.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026

function parseAction(value: unknown) {
  const result = parseRetirementActionRequest(value)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.request
}

function inheritedAccount(
  id: string,
  type: 'traditional' | 'roth',
): Account {
  return {
    type,
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: type === 'traditional' ? 300_000 : 200_000,
    annualContribution: 0,
    inherited: {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: type === 'traditional',
      decedentId: `decedent-${type}`,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'none',
        beneficiaryBirthYear: 1970,
        soleBeneficiary: true,
        election: 'none',
        ownerBirthYear: 1940,
        ...(type === 'roth'
          ? { roth5YearStartYear: 2010 }
          : { ownerYearOfDeathRmdSatisfied: true }),
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    },
  }
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })
  value.id = 'inherited-distribution-delegation-plan'
  value.accounts = [
    {
      type: 'cash', id: 'cash', name: 'cash', ownerPersonId: 'p1',
      annualReturnPct: 0, balance: 1_000_000, annualContribution: 0,
    },
    {
      type: 'traditional', id: 'owned-traditional', name: 'owned-traditional',
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira',
      balance: 100_000, annualContribution: 0,
    },
    {
      type: 'roth', id: 'owned-roth', name: 'owned-roth', ownerPersonId: 'p1',
      annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0,
    },
    inheritedAccount('inherited-traditional', 'traditional'),
    inheritedAccount('inherited-roth', 'roth'),
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'owned-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'owned-traditional',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  value.strategies.retirementActions = [START_YEAR, START_YEAR + 1].flatMap(
    (year) => [
      parseAction({
        actionId: `withdraw-${year}`,
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year,
        executionDate: `${year}-01-15`,
        executionSequence: 1,
        requestedAmount: 100,
        allocations: [{
          allocationId: `withdraw-${year}-allocation`,
          sourceAccountId: 'cash',
          requestedAmount: 100,
        }],
        purpose: { kind: 'taxPayment', referenceId: `convert-${year}` },
        provenance: { source: 'manual' },
      }),
      parseAction({
        actionId: `convert-${year}`,
        kind: 'rothConversion',
        personId: 'p1',
        year,
        executionDate: `${year}-06-15`,
        executionSequence: 2,
        requestedAmount: 100,
        allocations: [{
          allocationId: `convert-${year}-allocation`,
          sourceAccountId: 'owned-traditional',
          requestedAmount: 100,
        }],
        destinationRothAccountId: 'owned-roth',
        taxFunding: {
          kind: 'linkedWithdrawal',
          withdrawalActionId: `withdraw-${year}`,
        },
        provenance: { source: 'manual' },
      }),
    ],
  )
  return validatePlan(value)
}

function phasesFor(year: number) {
  return seam.phases.filter((phase) => phase.year === year)
}

function run(mode: typeof seam.mode) {
  seam.mode = mode
  seam.phases.length = 0
  seam.snapshots.length = 0
  seam.taxInputs.length = 0
  const probes: { readonly year: number; readonly inheritedDistribution: number }[] = []
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: START_YEAR + 1,
    taxCalculator: {
      compute(input) {
        seam.taxInputs.push({
          phase: seam.phases.at(-1),
          ordinaryIncome: input.ordinaryIncome,
        })
        return 0
      },
    },
    captureAnnualCashFlow: true,
    captureOptimizerInputs: (probe) => probes.push({
      year: probe.year,
      inheritedDistribution: probe.inheritedDistribution,
    }),
  })
  return { result, probes }
}

describe('simulatePlan delegates inherited-account annual planning', () => {
  it('applies every fresh ordered result across re-entry and commits into the next year', () => {
    const { result, probes } = run('dynamic')
    expect(phasesFor(START_YEAR).length).toBeGreaterThan(1)
    expect(phasesFor(START_YEAR + 1).length).toBeGreaterThan(1)
    expect(new Set(seam.phases.map((phase) => phase.output)).size)
      .toBe(seam.phases.length)
    expect(new Set(seam.phases.map((phase) => phase.output.rows)).size)
      .toBe(seam.phases.length)
    expect(new Set(seam.phases.flatMap(
      (phase) => phase.output.rows.map((row) => row.evidence),
    )).size).toBe(seam.phases.length * 2)

    expect(phasesFor(START_YEAR).every(
      (phase) => phase.openingTraditional === 300_000 &&
        phase.openingRoth === 200_000,
    )).toBe(true)
    const firstYearFinal = phasesFor(START_YEAR).at(-1)!
    const firstTraditional = firstYearFinal.output.rows.find(
      (row) => row.accountId === 'inherited-traditional',
    )!.distribution!.sourceBalanceAfter
    const firstRoth = firstYearFinal.output.rows.find(
      (row) => row.accountId === 'inherited-roth',
    )!.distribution!.sourceBalanceAfter
    expect(phasesFor(START_YEAR + 1).every(
      (phase) => phase.openingTraditional === firstTraditional &&
        phase.openingRoth === firstRoth,
    )).toBe(true)

    expect(seam.snapshots).toHaveLength(seam.phases.length)
    for (const snapshot of seam.snapshots) {
      const phase = snapshot.phase!
      expect(snapshot.traditional).toBe(
        phase.output.rows.find(
          (row) => row.accountId === 'inherited-traditional',
        )!.distribution!.sourceBalanceAfter,
      )
      expect(snapshot.roth).toBe(
        phase.output.rows.find(
          (row) => row.accountId === 'inherited-roth',
        )!.distribution!.sourceBalanceAfter,
      )
    }

    for (const year of result.years) {
      const phase = phasesFor(year.year).at(-1)!
      expect(year.inheritedDistribution).toBe(phase.output.totals.inherited)
      expect(year.inheritedTraditionalDistribution)
        .toBe(phase.output.totals.ordinaryIncome)
      expect(year.withdrawals.roth).toBeGreaterThanOrEqual(
        phase.output.totals.rothForced,
      )
      expect(year.rmdShortfallExciseTax).toBe(100)
      expect(year.rmdShortfallExciseDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            obligationId:
              phase.output.rmdShortfallObligations[0]!.obligationId,
            tax: 100,
          }),
        ]),
      )
      expect(year.inheritedAccounts).toEqual(
        phase.output.rows.map((row) => row.evidence),
      )
      expect(year.inheritedAccounts?.[0]).not.toBe(
        phase.output.rows[0]!.evidence,
      )
      expect(year.inheritedAccounts?.[0]).toEqual(
        phase.output.rows[0]!.evidence,
      )
      expect(Object.isFrozen(year.inheritedAccounts?.[0])).toBe(true)
      const runtimeOccurrences =
        year.retirementRuntimeSource?.runtimeOccurrences ?? []
      const inheritedOccurrences = runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'inheritedIraRmd',
      )
      expect(inheritedOccurrences.map((occurrence) => ({
        accountId: occurrence.sourceAccountId,
        amount: occurrence.grossAmountPlanDollars,
      })).sort((left, right) => left.accountId!.localeCompare(right.accountId!)))
        .toEqual(phase.output.rows.map((row) => ({
        accountId: row.accountId,
        amount: row.distribution!.executed,
      })).sort((left, right) => left.accountId.localeCompare(right.accountId)))
      expect(probes.find((probe) => probe.year === year.year)
        ?.inheritedDistribution).toBe(phase.output.totals.ordinaryIncome)
    }
    for (const taxInput of seam.taxInputs) {
      const phase = taxInput.phase!
      expect(phase).toBeDefined()
      expect([
        phase.output.totals.ordinaryIncome,
        phase.output.totals.ordinaryIncome + 1,
      ]).toContain(taxInput.ordinaryIncome)
    }
    expect(result.warnings).toContain(
      'An IRC §4974 excise tax was charged on a required-minimum-distribution shortfall.',
    )

    const dynamicApplicationOrder = result.years.map((year) =>
      year.retirementRuntimeApplicationSource?.applications.map(
        (application) => ({
          mutationOrdinal: application.mutationOrdinal,
          simulatorPhase: application.simulatorPhase,
        }),
      ))
    const control = run('original').result
    expect(dynamicApplicationOrder).toEqual(control.years.map((year) =>
      year.retirementRuntimeApplicationSource?.applications.map(
        (application) => ({
          mutationOrdinal: application.mutationOrdinal,
          simulatorPhase: application.simulatorPhase,
        }),
      )))
  })

  it('rejects an operation whose balance position was changed', () => {
    expect(() => run('wrongPosition')).toThrow(
      'Inherited-IRA distribution operation lost its balance position',
    )
  })

  it('prevalidates every operation before changing any logical balance', () => {
    expect(() => run('invalidSecond')).toThrow(
      'invalid annual inherited-IRA distribution operation',
    )
    const phase = seam.phases.at(-1)!
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-traditional',
    )?.balance).toBe(phase.openingTraditional)
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-roth',
    )?.balance).toBe(phase.openingRoth)
  })

  it('rejects an operation whose selected owner was changed', () => {
    expect(() => run('wrongOwner')).toThrow(
      'invalid annual inherited-IRA distribution operation',
    )
    const phase = seam.phases.at(-1)!
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-traditional',
    )?.balance).toBe(phase.openingTraditional)
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-roth',
    )?.balance).toBe(phase.openingRoth)
  })

  it('rejects a positive operation that cannot move a ledger cent', () => {
    expect(() => run('subCent')).toThrow(
      'invalid annual inherited-IRA distribution operation',
    )
    const phase = seam.phases.at(-1)!
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-traditional',
    )?.balance).toBe(phase.openingTraditional)
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-roth',
    )?.balance).toBe(phase.openingRoth)
  })

  it('materializes every helper-owned result property exactly once', () => {
    const hostile = run('singleRead')
    const hostilePhases = [...seam.phases]
    expect(hostilePhases.length).toBeGreaterThan(0)
    for (const phase of hostilePhases) {
      expect([...phase.getterReads.values()].every((reads) => reads === 1))
        .toBe(true)
      const paths = [...phase.getterReads.keys()]
      expect(paths).toEqual(expect.arrayContaining([
        'result.rows',
        'result.totals',
        'result.rmdShortfallObligations',
        'result.rows[0].distribution.balanceIndex',
        'result.rows[0].distribution.accountId',
        'result.rows[0].distribution.ownerPersonId',
        'result.rows[0].distribution.sourceBalanceBefore',
        'result.rows[0].distribution.sourceBalanceAfter',
        'result.rows[0].distribution.executed',
        'result.rows[0].evidence',
        'result.totals.inherited',
        'result.totals.ordinaryIncome',
        'result.totals.rothForced',
      ]))
      expect(paths.some((path) =>
        path.startsWith('result.rmdShortfallObligations[0].'))).toBe(true)
    }
    const control = run('original')
    expect(hostile.result).toEqual(control.result)
    expect(hostile.probes).toEqual(control.probes)
  })

  it('does not write a balance when a getter throws during materialization', () => {
    expect(() => run('throwDuringMaterialization')).toThrow(
      'hostile inherited result threw during materialization',
    )
    const phase = seam.phases.at(-1)!
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-traditional',
    )?.balance).toBe(phase.openingTraditional)
    expect(phase.input.balances.find(
      (state) => state.account.id === 'inherited-roth',
    )?.balance).toBe(phase.openingRoth)
  })
})
