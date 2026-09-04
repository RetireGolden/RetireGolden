/**
 * Delegation guard for the extracted contribution/match phase.
 *
 * The injected stream keeps only its positional preimages truthful while its
 * closing balances, account-shaped payloads, owners, and flags are hostile.
 * Balance/basis effects, runtime payloads, Roth basis, warnings, downstream
 * withdrawals, and every detached recorder snapshot prove `simulatePlan`
 * consumes the helper result without retaining an inline copy. The caller
 * materializes each helper-owned getter once, then forwards the same cached
 * caller-owned payload through preflight and commit. An independent expected
 * row witness rejects coordinated emitted-row/identity omissions or inserts.
 * An empty-omit counterfactual re-enters the
 * annual pass and proves the pre-pass contribution prefix is neither replanned
 * nor applied twice.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
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

const hostile = vi.hoisted(() => ({
  recordedContributions: [] as RecordedContribution[],
  recordedMatches: [] as RecordedEmployerMatch[],
  fault: null as null | 'wrongPosition' | 'staleBalance' | 'staleBasis' |
    'signedZero' | 'signedZeroBasis' | 'lateIterator' |
    'lateNestedGetter' | 'lateWarningGetter' | 'totalsGetter' |
    'allocationGetter' | 'truncate' | 'emptyNonzero' | 'inconsistentTotal' |
    'coordinatedOmitZero' | 'coordinatedInsertWarning' |
    'changingGetters' | 'nonCreditApplication' | 'wrongIdentity' |
    'postMatchWarning' | 'badContributionMath' |
    'duplicateMatchIdentity' | 'badMatchMath' |
    'omitWholeContributionDecision' | 'duplicateContributionIndex' |
    'duplicateExpectedContributionIndex',
  changingGetterReads: {
    retirementOccurrence: 0,
    applicationKind: 0,
    identityKind: 0,
  },
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualContributionsAndEmployerMatchInput,
      AnnualContributionsAndEmployerMatchResult
    >(),
)

vi.mock(
  './internal/annualContributionsAndEmployerMatch.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualContributionsAndEmployerMatch.js')
      >(),
      'annualContributionsAndEmployerMatch',
      (
        _natural,
        { input },
      ): AnnualContributionsAndEmployerMatchResult => {
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
                expectedOperationIdentities: [
                  { kind: 'warning' },
                  { kind: 'contribution', balanceIndex: 2 },
                  { kind: 'contribution', balanceIndex: 0 },
                  { kind: 'warning' },
                  { kind: 'contribution', balanceIndex: 3 },
                  { kind: 'contribution', balanceIndex: 1 },
                  { kind: 'employerMatch', balanceIndex: 1 },
                  { kind: 'employerMatch', balanceIndex: 2 },
                ],
                expectedContributionBalanceIndices: [0, 1, 2, 3],
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
                expectedOperationIdentities: [],
                expectedContributionBalanceIndices: [],
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
        if (input.year === 2026 && hostile.fault !== null) {
          if (hostile.fault === 'lateIterator') {
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
          } else if (hostile.fault === 'coordinatedOmitZero') {
            const omittedIndex = result.operations.findIndex((operation) =>
              operation.kind === 'contribution' && operation.credited === 0
            )
            result = {
              ...result,
              operations: result.operations.filter((_, index) =>
                index !== omittedIndex
              ),
              operationIdentities: result.operationIdentities.filter(
                (_, index) => index !== omittedIndex,
              ),
            }
          } else if (hostile.fault === 'coordinatedInsertWarning') {
            result = {
              ...result,
              operations: [
                { kind: 'warning', message: 'coordinated extra warning' },
                ...result.operations,
              ],
              operationIdentities: [
                { kind: 'warning' },
                ...result.operationIdentities,
              ],
            }
          } else if (hostile.fault === 'omitWholeContributionDecision') {
            const omittedIndex = result.operations.findIndex((operation) =>
              operation.kind === 'contribution' && operation.credited === 0
            )
            result = {
              ...result,
              operations: result.operations.filter((_, index) =>
                index !== omittedIndex
              ),
              operationIdentities: result.operationIdentities.filter(
                (_, index) => index !== omittedIndex,
              ),
              expectedOperationIdentities:
                result.expectedOperationIdentities.filter(
                  (_, index) => index !== omittedIndex,
                ),
            }
          } else if (hostile.fault === 'duplicateContributionIndex') {
            const duplicateIndex = result.operations.findIndex((operation) =>
              operation.kind === 'contribution' && operation.credited === 0
            )
            result = {
              ...result,
              operations: result.operations.map((operation, index) =>
                index === duplicateIndex && operation.kind === 'contribution'
                  ? {
                      ...operation,
                      balanceIndex: 2,
                      sourceAccount: input.balances[2]!.account,
                      balanceBefore: 300,
                      balanceAfter: 300,
                      costBasisBefore: input.balances[2]!.costBasis,
                      costBasisAfter: input.balances[2]!.costBasis,
                    }
                  : operation
              ),
              operationIdentities: result.operationIdentities.map(
                (identity, index) => index === duplicateIndex
                  ? { kind: 'contribution', balanceIndex: 2 }
                  : identity,
              ),
              expectedOperationIdentities:
                result.expectedOperationIdentities.map(
                  (identity, index) => index === duplicateIndex
                    ? { kind: 'contribution', balanceIndex: 2 }
                    : identity,
                ),
            }
          } else if (hostile.fault === 'changingGetters') {
            result = {
              ...result,
              operations: result.operations.map((operation) => {
                if (
                  operation.kind !== 'contribution' ||
                  operation.balanceIndex !== 0
                ) return operation
                const sourceOccurrence = operation.retirementOccurrence!
                const sourceApplication = operation.retirementApplication!
                if (sourceApplication.applicationKind !== 'credit') {
                  throw new Error('fixture contribution must use a credit application')
                }
                return {
                  ...operation,
                  get retirementOccurrence() {
                    hostile.changingGetterReads.retirementOccurrence++
                    return hostile.changingGetterReads.retirementOccurrence === 1
                      ? sourceOccurrence
                      : {
                          ...sourceOccurrence,
                          producerOccurrenceKey: 'hybrid-occurrence',
                          kind: 'employerPlanEmployerMatch' as const,
                        }
                  },
                  retirementApplication: {
                    ...sourceApplication,
                    get applicationKind(): 'credit' {
                      hostile.changingGetterReads.applicationKind++
                      return (hostile.changingGetterReads.applicationKind === 1
                        ? 'credit'
                        : 'debit') as 'credit'
                    },
                  },
                }
              }),
              operationIdentities: result.operationIdentities.map(
                (identity) => {
                  if (
                    identity.kind !== 'contribution' ||
                    identity.balanceIndex !== 0
                  ) return identity
                  return {
                    balanceIndex: identity.balanceIndex,
                    get kind(): 'contribution' {
                      hostile.changingGetterReads.identityKind++
                      return (hostile.changingGetterReads.identityKind === 1
                        ? 'contribution'
                        : 'warning') as 'contribution'
                    },
                  }
                },
              ),
            }
          } else if (hostile.fault === 'nonCreditApplication') {
            result = {
              ...result,
              operations: result.operations.map((operation) =>
                operation.kind === 'contribution' &&
                operation.balanceIndex === 0
                  ? {
                      ...operation,
                      retirementApplication: {
                        ...operation.retirementApplication!,
                        applicationKind: 'debit',
                      } as typeof operation.retirementApplication,
                    }
                  : operation
              ),
            }
          } else if (hostile.fault === 'wrongIdentity') {
            result = {
              ...result,
              operationIdentities: result.operationIdentities.map(
                (identity, index) => index === 1
                  ? { kind: 'contribution', balanceIndex: 0 }
                  : identity,
              ),
            }
          } else if (hostile.fault === 'postMatchWarning') {
            const warningIndex = 3
            const reorder = <T,>(rows: readonly T[]): readonly T[] => [
              ...rows.slice(0, warningIndex),
              ...rows.slice(warningIndex + 1),
              rows[warningIndex]!,
            ]
            result = {
              ...result,
              operations: reorder(result.operations),
              operationIdentities: reorder(result.operationIdentities),
              expectedOperationIdentities:
                reorder(result.expectedOperationIdentities),
            }
          } else if (hostile.fault === 'badContributionMath') {
            result = {
              ...result,
              operations: result.operations.map((operation) =>
                operation.kind === 'contribution' &&
                operation.balanceIndex === 2
                  ? { ...operation, balanceAfter: operation.balanceAfter + 1 }
                  : operation
              ),
            }
          } else if (hostile.fault === 'duplicateMatchIdentity') {
            result = {
              ...result,
              operations: result.operations.map((operation, index) =>
                index === result.operations.length - 1 &&
                operation.kind === 'employerMatch'
                  ? {
                      ...operation,
                      balanceIndex: 1,
                      sourceAccount: input.balances[1]!.account,
                      balanceBefore: 200,
                      balanceAfter: 250,
                    }
                  : operation
              ),
              operationIdentities: result.operationIdentities.map(
                (identity, index) => index === result.operationIdentities.length - 1
                  ? { kind: 'employerMatch', balanceIndex: 1 }
                  : identity,
              ),
              expectedOperationIdentities:
                result.expectedOperationIdentities.map(
                  (identity, index) =>
                    index === result.expectedOperationIdentities.length - 1
                      ? { kind: 'employerMatch', balanceIndex: 1 }
                      : identity,
                ),
            }
          } else if (hostile.fault === 'badMatchMath') {
            result = {
              ...result,
              operations: result.operations.map((operation, index) =>
                index === result.operations.length - 1 &&
                operation.kind === 'employerMatch'
                  ? { ...operation, balanceAfter: operation.balanceAfter + 1 }
                  : operation
              ),
            }
          } else if (hostile.fault === 'truncate') {
            result = {
              ...result,
              operations: result.operations.slice(0, -1),
            }
          } else if (hostile.fault === 'emptyNonzero') {
            result = {
              ...result,
              operations: [],
              operationIdentities: [],
            }
          } else if (hostile.fault === 'inconsistentTotal') {
            result = {
              ...result,
              totals: {
                ...result.totals,
                contributions: result.totals.contributions + 1,
              },
            }
          } else if (hostile.fault === 'duplicateExpectedContributionIndex') {
            result = {
              ...result,
              expectedContributionBalanceIndices: [
                ...result.expectedContributionBalanceIndices,
                result.expectedContributionBalanceIndices[0]!,
              ],
            }
          } else if (hostile.fault === 'totalsGetter') {
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
          } else if (hostile.fault === 'allocationGetter') {
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
                  hostile.fault === 'lateWarningGetter' &&
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
                  hostile.fault === 'lateNestedGetter' &&
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
                hostile.fault === 'signedZero' &&
                operation.kind === 'contribution' &&
                operation.balanceIndex === 1
              ) {
                return {
                  ...operation,
                  balanceBefore: Object.is(operation.balanceBefore, -0) ? 0 : -0,
                }
              }
              if (
                hostile.fault === 'signedZeroBasis' &&
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
              if (hostile.fault === 'wrongPosition') {
                return { ...operation, sourceAccount: input.balances[3]!.account }
              }
              if (hostile.fault === 'staleBalance') {
                return { ...operation, balanceBefore: operation.balanceBefore + 1 }
              }
              return hostile.fault === 'staleBasis'
                ? { ...operation, costBasisBefore: operation.costBasisBefore + 1 }
                : operation
              }),
            }
          }
        }
        return result
      },
    ),
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
              hostile.recordedContributions.push(row)
              target.recordContribution(row)
            }
          }
          if (prop === 'recordEmployerMatch') {
            return (row: RecordedEmployerMatch) => {
              hostile.recordedMatches.push(row)
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
    seam.reset()
    hostile.recordedContributions.length = 0
    hostile.recordedMatches.length = 0
    hostile.fault = null
    const counterfactuals: CounterfactualAnnualLiabilityResult[] = []
    const fixturePlan = plan()
    const requiredContributionPublications = fixturePlan.accounts.filter(
      (account) =>
        'annualContribution' in account && account.annualContribution > 0,
    ).length
    const requiredMatchPublications = fixturePlan.accounts.filter(
      (account) => 'employerMatch' in account &&
        account.employerMatch !== null &&
        account.employerMatch !== undefined,
    ).length
    const result = simulatePlan(fixturePlan, {
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

    // These cardinalities come only from authored fixture accounts. They do
    // not read helper operations or either helper identity channel, so deleting
    // an entire helper decision site still loses a required publication.
    expect(hostile.recordedContributions)
      .toHaveLength(requiredContributionPublications)
    expect(hostile.recordedMatches).toHaveLength(requiredMatchPublications)
    expect(new Set(hostile.recordedContributions).size).toBe(4)
    expect(new Set(hostile.recordedMatches).size).toBe(2)
    expect(hostile.recordedContributions).toEqual([
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
      expect(hostile.recordedContributions[index])
        .toEqual(expectedContributionRecords[index])
      expect(hostile.recordedContributions[index])
        .not.toBe(expectedContributionRecords[index])
    }
    for (let index = 0; index < matchRecords.length; index++) {
      expect(hostile.recordedMatches[index]).toEqual(matchRecords[index])
      expect(hostile.recordedMatches[index]).not.toBe(matchRecords[index])
    }
    expect(hostile.recordedContributions.map((row) => row.destinationAccountId))
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
    seam.reset()
    hostile.recordedContributions.length = 0
    hostile.recordedMatches.length = 0
    hostile.fault = fault

    expect(() => simulatePlan(plan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    })).toThrow(message)

    expect(hostile.recordedContributions).toEqual([])
    expect(hostile.recordedMatches).toEqual([])
    hostile.fault = null
  })

  it.each([
    ['lateIterator' as const, 'sentinel late operation iterator failure'],
    ['lateNestedGetter' as const, 'sentinel nested record getter failure'],
    ['lateWarningGetter' as const, 'sentinel later warning getter failure'],
    ['totalsGetter' as const, 'sentinel totals getter failure'],
    ['allocationGetter' as const, 'sentinel allocation iterator failure'],
    [
      'nonCreditApplication' as const,
      'Annual contribution plan returned a non-credit application',
    ],
    ['wrongIdentity' as const, 'Annual contribution operation lost its identity'],
    [
      'postMatchWarning' as const,
      'Annual contribution operation order is inconsistent',
    ],
    [
      'badContributionMath' as const,
      'Annual contribution operation has inconsistent balance math',
    ],
    [
      'duplicateMatchIdentity' as const,
      'Annual employer-match operation lost its physical identity',
    ],
    [
      'badMatchMath' as const,
      'Annual employer-match operation has inconsistent balance math',
    ],
    ['truncate' as const, 'Annual contribution operations lost cardinality'],
    ['emptyNonzero' as const, 'Annual contribution operations lost cardinality'],
    [
      'inconsistentTotal' as const,
      'Annual contribution plan has an inconsistent contribution total',
    ],
    [
      'duplicateExpectedContributionIndex' as const,
      'Annual contribution expectation has duplicate positions',
    ],
    [
      'coordinatedOmitZero' as const,
      'Annual contribution operations lost cardinality',
    ],
    [
      'coordinatedInsertWarning' as const,
      'Annual contribution operations lost cardinality',
    ],
    [
      'omitWholeContributionDecision' as const,
      'Annual contribution operations lost expected positions',
    ],
    [
      'duplicateContributionIndex' as const,
      'Annual contribution operation duplicated a physical position',
    ],
  ])(
    'materializes and reconciles %s before any caller-owned effect',
    (fault, message) => {
      seam.reset()
      hostile.recordedContributions.length = 0
      hostile.recordedMatches.length = 0
      hostile.fault = fault

      expect(() => simulatePlan(plan(), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFlatTaxCalculator(0),
        captureAnnualCashFlow: true,
      })).toThrow(message)

      expect(hostile.recordedContributions).toEqual([])
      expect(hostile.recordedMatches).toEqual([])
      hostile.fault = null
    },
  )

  it('snapshots changing nested getters exactly once without a hybrid payload', () => {
    seam.reset()
    hostile.recordedContributions.length = 0
    hostile.recordedMatches.length = 0
    hostile.changingGetterReads.retirementOccurrence = 0
    hostile.changingGetterReads.applicationKind = 0
    hostile.changingGetterReads.identityKind = 0
    hostile.fault = 'changingGetters'

    const year = simulatePlan(plan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(hostile.changingGetterReads).toEqual({
      retirementOccurrence: 1,
      applicationKind: 1,
      identityKind: 1,
    })
    expect(year.retirementRuntimeSource!.runtimeOccurrences).toContainEqual(
      expect.objectContaining({
        producerOccurrenceKey: 'a-sentinel-contribution',
        kind: 'ownedIraContribution',
      }),
    )
    expect(year.retirementRuntimeApplicationSource!.applications)
      .toContainEqual(expect.objectContaining({
        applicationKind: 'credit',
        producerOccurrenceKey: 'a-sentinel-contribution',
      }))
    hostile.fault = null
  })
})
