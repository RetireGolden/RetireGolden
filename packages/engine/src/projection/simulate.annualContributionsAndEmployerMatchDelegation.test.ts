/**
 * Delegation guard for the extracted contribution/match phase.
 *
 * The injected stream deliberately disagrees with live account kinds, ids,
 * owners, balances, and flags. Positional balance/basis effects, runtime
 * payloads, Roth basis, warnings, downstream withdrawals, and recorder object
 * identity prove `simulatePlan` consumes the helper result without rebuilding
 * it or retaining an inline copy. An empty-omit counterfactual re-enters the
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

const seam = vi.hoisted(() => ({
  calls: [] as CallRecord[],
  recordedContributions: [] as RecordedContribution[],
  recordedMatches: [] as RecordedEmployerMatch[],
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
        const result: AnnualContributionsAndEmployerMatchResult =
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
                    balanceBefore: -30,
                    balanceAfter: 1_100,
                    costBasisBefore: -31,
                    costBasisAfter: -32,
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
                    balanceBefore: -10,
                    balanceAfter: 250,
                    costBasisBefore: 40,
                    costBasisAfter: 20,
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
                    kind: 'contribution',
                    balanceIndex: 1,
                    balanceBefore: -20,
                    balanceAfter: 0,
                    costBasisBefore: -21,
                    costBasisAfter: -22,
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
                    balanceIndex: 0,
                    balanceBefore: -40,
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
                    balanceBefore: -50,
                    balanceAfter: 1_000,
                    retirementOccurrence: null,
                    record: matchRecords[1]!,
                  },
                ],
                totals: {
                  contributions: 600,
                  ownedNonRothIraContributions: 73,
                  employerMatch: 150,
                  preTaxContributions: 271,
                  traditionalInflow: 281,
                  otherInflow: 319,
                  taxableInflow: 307,
                },
                desiredByAccountId: new Map([
                  ['sentinel-desired', 991],
                ]),
                employerAllocationByOwner: new Map(),
              }
            : {
                operations: [],
                totals: {
                  contributions: 0,
                  ownedNonRothIraContributions: 0,
                  employerMatch: 0,
                  preTaxContributions: 0,
                  traditionalInflow: 0,
                  otherInflow: 0,
                  taxableInflow: 0,
                },
                desiredByAccountId: new Map(),
                employerAllocationByOwner: new Map(),
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
      costBasis: 40, annualContribution: 0,
    },
    {
      type: 'traditional', id: POSITION_IDS[1], name: POSITION_IDS[1],
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 100,
      annualContribution: 0,
    },
    {
      type: 'roth', id: POSITION_IDS[2], name: POSITION_IDS[2],
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 100,
      contributionBasis: 0, annualContribution: 0,
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
    expect(first.ownedNonRothIraContributions).toBe(73)
    expect(first.employerMatch).toBe(150)
    expect(result.warnings).toContain('sentinel contribution warning')
    expect(first.balances).toEqual({
      [POSITION_IDS[0]!]: 200,
      [POSITION_IDS[1]!]: 0,
      [POSITION_IDS[2]!]: 1_000,
    })

    expect(seam.recordedContributions).toHaveLength(3)
    expect(seam.recordedMatches).toHaveLength(2)
    for (let index = 0; index < contributionRecords.length; index++) {
      expect(seam.recordedContributions[index])
        .toBe(contributionRecords[index])
    }
    for (let index = 0; index < matchRecords.length; index++) {
      expect(seam.recordedMatches[index]).toBe(matchRecords[index])
    }
    expect(seam.recordedContributions.map((row) => row.destinationAccountId))
      .toEqual([
        'duplicate-publication-id',
        'duplicate-publication-id',
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
        sourceBalanceBeforePlanDollars: 901,
        creditedAmountPlanDollars: 302,
        sourceBalanceAfterPlanDollars: 1_203,
      }))

    // In year 2 the authored wages have stopped. The injected cost-basis write
    // makes the $200 taxable liquidation realize $180, and the injected Roth
    // contribution basis covers the remaining $200 without an early penalty.
    const second = result.years[1]!
    expect(second.realizedGains).toBe(180)
    expect(second.withdrawals.taxable).toBe(200)
    expect(second.withdrawals.roth).toBe(200)
    expect(second.penalties).toBe(0)
  })
})
