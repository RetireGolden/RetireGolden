/**
 * Delegation guard for the extracted contribution/match phase.
 *
 * The injected stream keeps only its positional preimages truthful while its
 * closing balances, account-shaped payloads, owners, and flags are hostile.
 * Balance/basis effects, runtime payloads, Roth basis, warnings, downstream
 * withdrawals, and every detached recorder snapshot prove `simulatePlan`
 * consumes the helper result without retaining an inline copy. The caller
 * materializes each helper-owned getter once, then forwards the same cached
 * caller-owned payload through preflight and commit. An empty-omit
 * counterfactual re-enters the
 * annual pass and proves the pre-pass contribution prefix is neither replanned
 * nor applied twice.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  RecordedContribution,
  RecordedEmployerMatch,
} from './annualCashFlowYearSites.js'
import type {
  AnnualContributionsAndEmployerMatchInput,
  AnnualContributionsAndEmployerMatchResult,
} from './internal/annualContributionsAndEmployerMatch.js'

interface CallRecord {
  readonly input: AnnualContributionsAndEmployerMatchInput
  readonly result: AnnualContributionsAndEmployerMatchResult
}

const contributionRecords: readonly RecordedContribution[] = [
  {
    destinationAccountId: 'duplicate-publication-id',
    ownerPersonId: null,
    requested: 200,
    credited: 200,
  },
  {
    destinationAccountId: 'duplicate-publication-id',
    ownerPersonId: 'record-owner-b',
    requested: 300,
    credited: 300,
  },
  {
    destinationAccountId: 'unique-publication-id',
    ownerPersonId: 'record-owner-c',
    requested: 100,
    credited: 100,
  },
]
const matchRecords: readonly RecordedEmployerMatch[] = [
  {
    destinationAccountId: 'duplicate-publication-id',
    ownerPersonId: 'match-owner-a',
    amount: 100,
  },
  {
    destinationAccountId: 'unique-publication-id',
    ownerPersonId: null,
    amount: 50,
  },
]
const signedZeroBasisRecord: Readonly<RecordedContribution> = {
  destinationAccountId: 'signed-zero-basis-precondition',
  ownerPersonId: null,
  requested: 0,
  credited: 0,
}

const seam = vi.hoisted(() => ({
  calls: [] as CallRecord[],
  recordedContributions: [] as RecordedContribution[],
  recordedMatches: [] as RecordedEmployerMatch[],
  fault: null as null | 'wrongPosition' | 'staleBalance' | 'staleBasis' |
    'signedZero' | 'signedZeroBasis' | 'lateIterator' |
    'lateNestedGetter' | 'lateWarningGetter' | 'totalsGetter' |
    'allocationGetter' | 'truncate' | 'emptyNonzero',
}))

vi.mock(
  './internal/annualContributionsAndEmployerMatch.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualContributionsAndEmployerMatch.js')
    >()
    return {
      ...original,
      annualContributionsAndEmployerMatch: (
        input: AnnualContributionsAndEmployerMatchInput,
      ) => {
        let result: AnnualContributionsAndEmployerMatchResult =
          input.year === 2026
            ? {
                operations: [
                  {
                    kind: 'warning',
                    message: 'sentinel contribution warning',
                  },
                  {
                    kind: 'contribution',
                    balanceIndex: 2,
                    sourceAccount: input.balances[2]!.account,
                    balanceBefore: input.balances[2]!.balance,
                    balanceAfter: 300,
                    costBasisBefore: input.balances[2]!.costBasis,
                    costBasisAfter: input.balances[2]!.costBasis,
                    credited: 200,
                    retirementOccurrence: null,
                    retirementApplication: null,
                    rothContributionPoolKey: 'rothira:p1',
                    rothContributionBasisDelta: 500,
                    qcdSection219OwnerPersonId: null,
                    qcdSection219Amount: 0,
                    record: contributionRecords[0]!,
                  },
                  {
                    kind: 'contribution',
                    balanceIndex: 0,
                    sourceAccount: input.balances[0]!.account,
                    balanceBefore: input.balances[0]!.balance,
                    balanceAfter: 400,
                    costBasisBefore: input.balances[0]!.costBasis,
                    costBasisAfter: 340,
                    credited: 300,
                    retirementOccurrence: {
                      producerOccurrenceKey: 'a-sentinel-contribution',
                      kind: 'ownedIraContribution',
                      grossAmountPlanDollars: 301,
                      ownerPersonId: 'runtime-owner-a',
                      sourceAccountId: 'runtime-account-a',
                      executionDate: null,
                      executionSequence: null,
                      movementAuthorityId: null,
                    },
                    retirementApplication: {
                      applicationKind: 'credit',
                      producerOccurrenceKey: 'a-sentinel-contribution',
                      simulatorPhase: 'employeeContribution',
                      ownerPersonId: 'application-owner-a',
                      sourceAccountId: 'application-account-a',
                      balanceIndex: 91,
                      sourceBalanceBeforePlanDollars: 901,
                      creditedAmountPlanDollars: 302,
                      sourceBalanceAfterPlanDollars: 1_203,
                    },
                    rothContributionPoolKey: null,
                    rothContributionBasisDelta: 0,
                    qcdSection219OwnerPersonId: 'p1',
                    qcdSection219Amount: 17,
                    record: contributionRecords[1]!,
                  },
                  {
                    kind: 'warning',
                    message: 'later sentinel contribution warning',
                  },
                  {
                    kind: 'contribution',
                    balanceIndex: 3,
                    sourceAccount: input.balances[3]!.account,
                    balanceBefore: input.balances[3]!.balance,
                    balanceAfter: input.balances[3]!.balance,
                    costBasisBefore: input.balances[3]!.costBasis,
                    costBasisAfter: input.balances[3]!.costBasis,
                    credited: 0,
                    retirementOccurrence: null,
                    retirementApplication: null,
                    rothContributionPoolKey: null,
                    rothContributionBasisDelta: 0,
                    qcdSection219OwnerPersonId: null,
                    qcdSection219Amount: 0,
                    record: signedZeroBasisRecord,
                  },
                  {
                    kind: 'contribution',
                    balanceIndex: 1,
                    sourceAccount: input.balances[1]!.account,
                    balanceBefore: input.balances[1]!.balance,
                    balanceAfter: 100,
                    costBasisBefore: input.balances[1]!.costBasis,
                    costBasisAfter: input.balances[1]!.costBasis,
                    credited: 100,
                    retirementOccurrence: {
                      producerOccurrenceKey: 'b-sentinel-contribution',
                      kind: 'employerPlanEmployeeContribution',
                      grossAmountPlanDollars: 101,
                      ownerPersonId: null,
                      sourceAccountId: 'runtime-account-b',
                      executionDate: null,
                      executionSequence: null,
                      movementAuthorityId: null,
                    },
                    retirementApplication: null,
                    rothContributionPoolKey: null,
                    rothContributionBasisDelta: 0,
                    qcdSection219OwnerPersonId: null,
                    qcdSection219Amount: 0,
                    record: contributionRecords[2]!,
                  },
                  {
                    kind: 'employerMatch',
                    balanceIndex: 1,
                    sourceAccount: input.balances[1]!.account,
                    balanceBefore: 100,
                    balanceAfter: 200,
                    retirementOccurrence: {
                      producerOccurrenceKey: 'c-sentinel-match',
                      kind: 'employerPlanEmployerMatch',
                      grossAmountPlanDollars: 103,
                      ownerPersonId: 'runtime-match-owner',
                      sourceAccountId: 'runtime-match-account',
                      executionDate: null,
                      executionSequence: null,
                      movementAuthorityId: null,
                    },
                    record: matchRecords[0]!,
                  },
                  {
                    kind: 'employerMatch',
                    balanceIndex: 2,
                    sourceAccount: input.balances[2]!.account,
                    balanceBefore: 300,
                    balanceAfter: 350,
                    retirementOccurrence: null,
                    record: matchRecords[1]!,
                  },
                ],
                operationIdentities: [
                  { kind: 'warning' },
                  { kind: 'contribution', balanceIndex: 2 },
                  { kind: 'contribution', balanceIndex: 0 },
                  { kind: 'warning' },
                  { kind: 'contribution', balanceIndex: 3 },
                  { kind: 'contribution', balanceIndex: 1 },
                  { kind: 'employerMatch', balanceIndex: 1 },
                  { kind: 'employerMatch', balanceIndex: 2 },
                ],
                totals: {
                  contributions: 600,
                  ownedNonRothIraContributions: 0,
                  employerMatch: 150,
                  preTaxContributions: 100,
                  traditionalInflow: 200,
                  otherInflow: 550,
                  taxableInflow: 300,
                },
                employerAllocationByOwner: new Map(),
              }
            : {
                operations: [],
                operationIdentities: [],
                totals: {
                  contributions: 0,
                  ownedNonRothIraContributions: 0,
                  employerMatch: 0,
                  preTaxContributions: 0,
                  traditionalInflow: 0,
                  otherInflow: 0,
                  taxableInflow: 0,
                },
                employerAllocationByOwner: new Map(),
              }
        if (input.year === 2026 && seam.fault !== null) {
          if (seam.fault === 'lateIterator') {
            const operations = result.operations
            result = {
              ...result,
              operations: {
                *[Symbol.iterator]() {
                  yield operations[0]!
                  yield operations[1]!
                  yield operations[2]!
                  throw new Error('sentinel late operation iterator failure')
                },
              } as unknown as typeof result.operations,
            }
          } else if (seam.fault === 'truncate') {
            result = {
              ...result,
              operations: result.operations.slice(0, -1),
            }
          } else if (seam.fault === 'emptyNonzero') {
            result = {
              ...result,
              operations: [],
              operationIdentities: [],
            }
          } else if (seam.fault === 'totalsGetter') {
            const totals = result.totals
            result = {
              ...result,
              totals: {
                contributions: totals.contributions,
                ownedNonRothIraContributions:
                  totals.ownedNonRothIraContributions,
                employerMatch: totals.employerMatch,
                preTaxContributions: totals.preTaxContributions,
                traditionalInflow: totals.traditionalInflow,
                otherInflow: totals.otherInflow,
                get taxableInflow(): number {
                  throw new Error('sentinel totals getter failure')
                },
              },
            }
          } else if (seam.fault === 'allocationGetter') {
            result = {
              ...result,
              employerAllocationByOwner: {
                [Symbol.iterator](): Iterator<never> {
                  throw new Error('sentinel allocation iterator failure')
                },
              } as unknown as typeof result.employerAllocationByOwner,
            }
          } else {
            result = {
              ...result,
              operations: result.operations.map((operation) => {
                if (
                  seam.fault === 'lateWarningGetter' &&
                  operation.kind === 'warning' &&
                  operation.message.startsWith('later')
                ) {
                  return {
                    kind: 'warning' as const,
                    get message(): string {
                      throw new Error('sentinel later warning getter failure')
                    },
                  }
                }
                if (
                  seam.fault === 'lateNestedGetter' &&
                  operation.kind === 'employerMatch' &&
                  operation.balanceIndex === 2
                ) {
                  const record = operation.record
                  return {
                    ...operation,
                    record: {
                      destinationAccountId: record.destinationAccountId,
                      ownerPersonId: record.ownerPersonId,
                      get amount(): number {
                        throw new Error('sentinel nested record getter failure')
                      },
                    },
                  }
                }
              if (
                seam.fault === 'signedZero' &&
                operation.kind === 'contribution' &&
                operation.balanceIndex === 1
              ) {
                return {
                  ...operation,
                  balanceBefore: Object.is(operation.balanceBefore, -0) ? 0 : -0,
                }
              }
              if (
                seam.fault === 'signedZeroBasis' &&
                operation.kind === 'contribution' &&
                operation.balanceIndex === 2
              ) {
                return {
                  ...operation,
                  costBasisBefore: Object.is(operation.costBasisBefore, -0)
                    ? 0
                    : -0,
                }
              }
              if (operation.kind !== 'contribution' || operation.balanceIndex !== 2) {
                return operation
              }
              if (seam.fault === 'wrongPosition') {
                return { ...operation, sourceAccount: input.balances[3]!.account }
              }
              if (seam.fault === 'staleBalance') {
                return { ...operation, balanceBefore: operation.balanceBefore + 1 }
              }
              return seam.fault === 'staleBasis'
                ? { ...operation, costBasisBefore: operation.costBasisBefore + 1 }
                : operation
              }),
            }
          }
        }
        seam.calls.push({ input, result })
        return result
      },
    }
  },
)

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordContribution') {
            return (row: RecordedContribution) => {
              seam.recordedContributions.push(row)
              target.recordContribution(row)
            }
          }
          if (prop === 'recordEmployerMatch') {
            return (row: RecordedEmployerMatch) => {
              seam.recordedMatches.push(row)
              target.recordEmployerMatch(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function'
            ? (value as (...args: never[]) => unknown).bind(target)
            : value
        },
      })
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import type { CounterfactualAnnualLiabilityResult } from
  '../internal/counterfactualAnnualLiability.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const POSITION_IDS = ['position-taxable', 'position-traditional', 'position-roth']

function plan(): Plan {
  const value = singlePersonPlan({
    dob: '1986-01-01',
    planningAge: 41,
    retirementAge: 41,
  })
  value.id = 'contribution-delegation-plan'
  value.accounts = [
    {
      type: 'taxable', id: POSITION_IDS[0], name: POSITION_IDS[0],
      ownerPersonId: 'p1', annualReturnPct: 0, balance: 100,
      costBasis: 40, annualContribution: 300,
    },
    {
      type: 'traditional', id: POSITION_IDS[1], name: POSITION_IDS[1],
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'employer', balance: 0,
      annualContribution: 100,
      employerMatch: { matchPct: 100, capPctOfPay: 100 },
    },
    {
      type: 'roth', id: POSITION_IDS[2], name: POSITION_IDS[2],
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'employer', balance: 100,
      contributionBasis: 0, annualContribution: 200,
      employerMatch: { matchPct: 25, capPctOfPay: 100 },
    },
    {
      type: 'roth', id: POSITION_IDS[2], name: 'same-id-other-physical-row',
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'employer', balance: 0,
      contributionBasis: 0, annualContribution: 100,
      employerMatch: null,
    },
  ] as Account[]
  value.incomes = [{
    type: 'wages', id: 'wages', personId: 'p1', annualGross: 1_000,
    endAge: 41, realGrowthPct: 0,
  }]
  value.expenses.baseAnnual = 400
  return value
}

describe('simulatePlan delegates annual contributions and employer match', () => {
  it('applies the exact hostile operation stream once across annual-pass re-entry', () => {
    seam.calls.length = 0
    seam.recordedContributions.length = 0
    seam.recordedMatches.length = 0
    seam.fault = null
    const counterfactuals: CounterfactualAnnualLiabilityResult[] = []
    const result = simulatePlan(plan(), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
      annualCounterfactual: {
        omitActionIds: [],
        taxUnitId: 'contribution-delegation-tax-unit',
        nonGroupTaxInputs: [{
          inputId: 'federalFilingStatus',
          value: { representation: 'declaredTerm', term: 'single' },
        }],
        capture: (reading) => counterfactuals.push(reading),
      },
    })

    expect(seam.calls.map((call) => call.input.year)).toEqual([2026, 2027])
    expect(counterfactuals).toHaveLength(2)
    const first = result.years[0]!
    expect(first.contributions).toBe(600)
    expect(first.ownedNonRothIraContributions).toBe(0)
    expect(first.employerMatch).toBe(150)
    expect(result.warnings).toContain('sentinel contribution warning')
    expect(first.balances).toEqual({
      [POSITION_IDS[0]!]: 400,
      [POSITION_IDS[1]!]: 200,
      [POSITION_IDS[2]!]: 350,
    })

    expect(seam.recordedContributions).toHaveLength(4)
    expect(seam.recordedMatches).toHaveLength(2)
    expect(new Set(seam.recordedContributions).size).toBe(4)
    expect(new Set(seam.recordedMatches).size).toBe(2)
    expect(seam.recordedContributions).toEqual([
      contributionRecords[0],
      contributionRecords[1],
      signedZeroBasisRecord,
      contributionRecords[2],
    ])
    const expectedContributionRecords = [
      contributionRecords[0],
      contributionRecords[1],
      signedZeroBasisRecord,
      contributionRecords[2],
    ]
    for (let index = 0; index < expectedContributionRecords.length; index++) {
      expect(seam.recordedContributions[index])
        .toEqual(expectedContributionRecords[index])
      expect(seam.recordedContributions[index])
        .not.toBe(expectedContributionRecords[index])
    }
    for (let index = 0; index < matchRecords.length; index++) {
      expect(seam.recordedMatches[index]).toEqual(matchRecords[index])
      expect(seam.recordedMatches[index]).not.toBe(matchRecords[index])
    }
    expect(seam.recordedContributions.map((row) => row.destinationAccountId))
      .toEqual([
        'duplicate-publication-id',
        'duplicate-publication-id',
        'signed-zero-basis-precondition',
        'unique-publication-id',
      ])

    const occurrences = first.retirementRuntimeSource!.runtimeOccurrences
      .filter((row) => row.producerOccurrenceKey.includes('sentinel'))
    expect(occurrences).toEqual([
      expect.objectContaining({
        producerOccurrenceKey: 'a-sentinel-contribution',
        kind: 'ownedIraContribution',
        grossAmountPlanDollars: 301,
        ownerPersonId: 'runtime-owner-a',
        sourceAccountId: 'runtime-account-a',
      }),
      expect.objectContaining({
        producerOccurrenceKey: 'b-sentinel-contribution',
        kind: 'employerPlanEmployeeContribution',
        grossAmountPlanDollars: 101,
        ownerPersonId: null,
        sourceAccountId: 'runtime-account-b',
      }),
      expect.objectContaining({
        producerOccurrenceKey: 'c-sentinel-match',
        kind: 'employerPlanEmployerMatch',
        grossAmountPlanDollars: 103,
        ownerPersonId: 'runtime-match-owner',
        sourceAccountId: 'runtime-match-account',
      }),
    ])
    expect(first.retirementRuntimeApplicationSource!.applications)
      .toContainEqual(expect.objectContaining({
        applicationKind: 'credit',
        mutationOrdinal: 1,
        producerOccurrenceKey: 'a-sentinel-contribution',
        ownerPersonId: 'application-owner-a',
        sourceAccountId: 'application-account-a',
        balanceIndex: 91,
        sourceBalanceBeforePlanDollars: 901,
        creditedAmountPlanDollars: 302,
        sourceBalanceAfterPlanDollars: 1_203,
      }))

    // In year 2 the authored wages have stopped. The snapshotted contribution
    // and Roth-basis effects remain single-shot across annual-pass re-entry.
    const second = result.years[1]!
    expect(second.realizedGains).toBe(60)
    expect(second.withdrawals.taxable).toBe(400)
    expect(second.withdrawals.roth).toBe(0)
    expect(second.penalties).toBe(0)
  })

  it.each([
    [
      'wrongPosition' as const,
      'Annual contribution operation lost its live balance position',
    ],
    [
      'staleBalance' as const,
      'Annual contribution operation lost its live balance position',
    ],
    [
      'staleBasis' as const,
      'Annual contribution operation has a stale live cost basis',
    ],
    [
      'signedZero' as const,
      'Annual contribution operation lost its live balance position',
    ],
    [
      'signedZeroBasis' as const,
      'Annual contribution operation has a stale live cost basis',
    ],
  ])('fails closed before publishing a %s operation', (fault, message) => {
    seam.calls.length = 0
    seam.recordedContributions.length = 0
    seam.recordedMatches.length = 0
    seam.fault = fault

    expect(() => simulatePlan(plan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    })).toThrow(message)

    expect(seam.recordedContributions).toEqual([])
    expect(seam.recordedMatches).toEqual([])
    seam.fault = null
  })

  it.each([
    ['lateIterator' as const, 'sentinel late operation iterator failure'],
    ['lateNestedGetter' as const, 'sentinel nested record getter failure'],
    ['lateWarningGetter' as const, 'sentinel later warning getter failure'],
    ['totalsGetter' as const, 'sentinel totals getter failure'],
    ['allocationGetter' as const, 'sentinel allocation iterator failure'],
    ['truncate' as const, 'Annual contribution operations lost cardinality'],
    ['emptyNonzero' as const, 'inconsistent contribution total'],
  ])(
    'materializes and reconciles %s before any caller-owned effect',
    (fault, message) => {
      seam.calls.length = 0
      seam.recordedContributions.length = 0
      seam.recordedMatches.length = 0
      seam.fault = fault

      expect(() => simulatePlan(plan(), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFlatTaxCalculator(0),
        captureAnnualCashFlow: true,
      })).toThrow(message)

      expect(seam.recordedContributions).toEqual([])
      expect(seam.recordedMatches).toEqual([])
      seam.fault = null
    },
  )
})
