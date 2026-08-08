import { describe, expect, it, vi } from 'vitest'

const settlementController = vi.hoisted(() => ({
  calls: vi.fn(),
}))

vi.mock('../internal/ownedNonRothIraAnnualAttemptSettlement.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../internal/ownedNonRothIraAnnualAttemptSettlement.js')
  >()
  return {
    ...original,
    runOwnedNonRothIraAnnualSettlementAttempts: (
      input: Parameters<
        typeof original.runOwnedNonRothIraAnnualSettlementAttempts
      >[0],
    ) => {
      const result =
        original.runOwnedNonRothIraAnnualSettlementAttempts(input)
      settlementController.calls(input.projectionStartTaxYear, result)
      return result
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe, YearResult } from './types.js'
import { replayOwnedNonRothIraContiguousYears } from
  '../internal/ownedNonRothIraContiguousReplay.js'

const TAX_YEAR = 2026

function ira(
  id: string,
  balance: number,
  basis = 0,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    ...(basis === 0 ? {} : { nondeductibleBasis: basis }),
  }
}

function roth(): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id: 'roth',
    name: 'Roth IRA',
    ownerPersonId: 'p1',
    kind: 'ira',
    balance: 0,
    annualReturnPct: 0,
    annualContribution: 0,
  }
}

function project(
  plan: Plan,
  endYear = TAX_YEAR,
  captureOptimizerInputs?: (probe: OptimizerYearProbe) => void,
  effectiveTaxRatePct = 0,
) {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(effectiveTaxRatePct),
    ...(captureOptimizerInputs === undefined
      ? {}
      : { captureOptimizerInputs }),
  })
}

function run(
  plan: Plan,
  endYear = TAX_YEAR,
  captureOptimizerInputs?: (probe: OptimizerYearProbe) => void,
): YearResult[] {
  return project(plan, endYear, captureOptimizerInputs).years
}

function replayAnnual(plan: Plan, year: YearResult) {
  const replay = replayOwnedNonRothIraContiguousYears(
    validatePlan(plan), year.year, [year],
  )
  if (replay.status !== 'ownedNonRothIraContiguousReplayComplete') {
    throw new Error(`expected complete replay, received ${replay.status}`)
  }
  return replay.annualReplays[0]!
}

describe('simulator owned non-Roth IRA exact annual settlement', () => {

  it('uses exact line-8 cents in MAGI and publishes one retry-clean journal', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-line8-half-cent'
    plan.accounts = [ira('ira', 0.06, 0.01), roth()]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 0.03 }],
    }

    const year = project(plan, TAX_YEAR, undefined, 25).years[0]!
    const owner = replayAnnual(plan, year).ownerReplays[0]!

    expect(owner.line8AllocationEvidence).toMatchObject({
      annualGrossAmount: 3,
      annualNontaxableBasisAmount: 1,
      annualTaxableAmount: 2,
    })
    expect(year.magi).toBeCloseTo(0.02, 12)
    expect(year.tax).toBeCloseTo(0.005, 12)
    expect(year.retirementRuntimeApplicationSource?.applications).toHaveLength(2)
    expect(year.retirementRuntimeApplicationSource?.applications.map(
      (application) => application.mutationOrdinal,
    )).toEqual([1, 2])
    expect(JSON.stringify(year)).not.toMatch(/pendingOwnedNonRothIraAnnualSettlement/)
  })

  it('grosses up generated conversions through exact line-8 character', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-fill-target-line8'
    plan.accounts = [ira('ira', 500_000, 250_000), roth()]
    plan.expenses.baseAnnual = 0
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: TAX_YEAR,
      endYear: TAX_YEAR,
    }

    const year = run(plan)[0]!
    const line8 = replayAnnual(plan, year)
      .ownerReplays[0]!.line8AllocationEvidence
    const taxable = line8.annualTaxableAmount / 100

    expect(year.rothConversion).toBeCloseTo(line8.annualGrossAmount / 100, 2)
    expect(year.rothConversion).toBeGreaterThan(taxable * 1.9)
    expect(year.magi).toBeCloseTo(taxable, 2)
  })

  it('uses one exact line-7 character vector for tax and early penalty', () => {
    const plan = singlePersonPlan({ dob: '1980-01-01', planningAge: 60 })
    plan.id = 'settled-line7-tax-penalty'
    plan.assumptions.inflationPct = 0
    plan.accounts = [ira('ira', 0.1, 0.01)]
    plan.expenses.baseAnnual = 0.03

    const year = run(plan)[0]!
    const line7 = replayAnnual(plan, year)
      .ownerReplays[0]!.line7AllocationEvidence
    const taxable = line7.annualTaxableAmount / 100

    expect(line7.annualGrossAmount).toBeGreaterThan(0)
    expect(year.magi).toBeCloseTo(taxable, 12)
    expect(year.penalties).toBeCloseTo(taxable * 0.1, 12)
  })

  it('carries exact basis into the next contiguous year', () => {
    const plan = singlePersonPlan({ planningAge: 80 })
    plan.id = 'settled-carryforward'
    plan.accounts = [ira('ira', 100_000, 20_000), roth()]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [
        { year: TAX_YEAR, amount: 10_000 },
        { year: TAX_YEAR + 1, amount: 10_000 },
      ],
    }

    const result = project(plan, TAX_YEAR + 1)
    const years = result.years
    // The first 20% basis ratio returns $2,000 on each conversion. The second
    // year can remain exactly 20% only when the first committed $18,000 basis
    // carryforward becomes that invocation's synthetic plan seed.
    expect(years.map((year) => year.magi)).toEqual([8_000, 8_000])
    expect(years[1]!.balances.ira).toBe(80_000)
    expect(result.endingNondeductibleIraBasis).toBe(16_000)
  })

  it('stops settlement after the committed carryforward reaches zero', () => {
    settlementController.calls.mockClear()
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-zero-carryforward'
    plan.accounts = [ira('ira', 0.01, 0.01)]
    plan.expenses.baseAnnual = 0.01

    const result = project(plan, TAX_YEAR + 1)

    expect(result.years).toHaveLength(2)
    expect(result.endingNondeductibleIraBasis).toBe(0)
    expect(settlementController.calls).toHaveBeenCalledTimes(1)
    expect(settlementController.calls).toHaveBeenCalledWith(
      TAX_YEAR,
      expect.objectContaining({
        status: 'committed',
        committedCarryforwards: [
          expect.objectContaining({
            ownerPersonId: 'p1',
            openingBasisAmount: 0,
          }),
        ],
      }),
    )
  })

  it('buffers optimizer publication until the exact attempt commits', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-optimizer-once'
    plan.accounts = [ira('ira', 0.06, 0.01), roth()]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 0.03 }],
    }
    const capture = vi.fn<(probe: OptimizerYearProbe) => void>()

    run(plan, TAX_YEAR, capture)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls[0]![0].incumbentModeledMagiBeforeTaxableWithdrawalGains)
      .toBeCloseTo(0.02, 12)
    expect(capture.mock.calls[0]![0].rothConversionTaxableFraction)
      .toBeCloseTo(2 / 3, 12)
  })

  it('preserves exact incumbent conversion character across mixed owners', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-optimizer-incumbent-conversion'
    plan.household.people.push({
      ...plan.household.people[0]!,
      id: 'p2',
      name: 'Spouse',
    })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      ira('ira-p1', 100, 50),
      ira('ira-p2', 100, 0, 'p2'),
      roth(),
      { ...roth(), id: 'roth-p2', ownerPersonId: 'p2' },
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 50 }],
    }
    const capture = vi.fn<(probe: OptimizerYearProbe) => void>()

    run(plan, TAX_YEAR, capture)

    expect(capture).toHaveBeenCalledTimes(1)
    // Equal convertible balances, so the 50 splits 25/25 and each owner
    // converts into their own Roth. p1's 25 is half basis and p2's is entirely
    // pre-tax, so 12.5 of the 50 is nontaxable and the household fraction is
    // 0.75 — a figure no single owner's ratio produces. Before the owner slice
    // this fixture gave p2 no Roth, the whole 50 came out of p1's IRA, and the
    // fraction read 0.5: one owner's ratio wearing the household's name.
    expect(capture.mock.calls[0]![0].incumbentRothConversion).toBe(50)
    expect(capture.mock.calls[0]![0].rothConversionTaxableFraction)
      .toBeCloseTo(0.75, 12)
  })

  it('preserves exact incumbent distribution character across mixed owners', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-optimizer-incumbent-distribution'
    plan.household.people.push({
      ...plan.household.people[0]!,
      id: 'p2',
      name: 'Spouse',
    })
    plan.expenses.baseAnnual = 50
    plan.accounts = [
      ira('ira-p1', 100, 50),
      ira('ira-p2', 100, 0, 'p2'),
    ]
    const capture = vi.fn<(probe: OptimizerYearProbe) => void>()

    run(plan, TAX_YEAR, capture)

    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls[0]![0].incumbentTraditionalDistribution).toBe(50)
    expect(capture.mock.calls[0]![0].traditionalWithdrawalTaxableFraction)
      .toBeCloseTo(0.5, 12)
  })

  it('excludes inherited draws from owner-traditional optimizer character', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-optimizer-inherited-separation'
    plan.expenses.baseAnnual = 150
    plan.accounts = [
      ira('owner-ira', 100, 50),
      {
        ...ira('inherited-ira', 100),
        inherited: {
          ownerDeathYear: TAX_YEAR - 2,
          decedentHadStartedRmds: false,
        },
      },
    ]
    const capture = vi.fn<(probe: OptimizerYearProbe) => void>()

    const year = run(plan, TAX_YEAR, capture)[0]!

    expect(year.withdrawals.traditional).toBe(150)
    expect(year.inheritedDistribution).toBe(0)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls[0]![0].incumbentTraditionalDistribution).toBe(100)
    expect(capture.mock.calls[0]![0].traditionalWithdrawalTaxableFraction)
      .toBeCloseTo(0.5, 12)
  })

  it('P1: settles owned basis alongside a K1 inherited-Roth final sweep', () => {
    settlementController.calls.mockClear()
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 80 })
    plan.id = 'settled-owned-basis-k1-final-sweep'
    plan.accounts = [
      ira('owner-ira', 100_000, 25_000),
      {
        type: 'roth',
        id: 'inherited-roth',
        name: 'Inherited Roth IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 50_000,
        annualContribution: 0,
        inherited: {
          ownerDeathYear: 2022,
          decedentHadStartedRmds: false,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'none',
            beneficiaryBirthYear: 1960,
            soleBeneficiary: true,
            ownerBirthYear: 1940,
            roth5YearStartYear: 2010,
            provenance: { source: 'test', asOf: '2026-01-01' },
          },
        },
      },
    ]

    const result = project(plan, 2032)
    const sweepYear = result.years.find((year) => year.year === 2032)!
    expect(sweepYear.inheritedDistribution).toBeCloseTo(50_000, 2)
    expect(sweepYear.inheritedTraditionalDistribution).toBe(0)
    expect(sweepYear.withdrawals.roth).toBeCloseTo(50_000, 2)

    const settlements = settlementController.calls.mock.calls
      .map(([, result]) => result)
    expect(settlements.length).toBeGreaterThan(0)
    expect(settlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'committed' }),
    ]))
    expect(JSON.stringify(settlements)).not.toMatch(/sourceIdentityInvalid|sourceCoverageInvalid/)
  })

  it('P2: settles basis through S2 ownership flip and post-flip owner RMDs', () => {
    settlementController.calls.mockClear()
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 80 })
    plan.id = 'settled-owned-basis-s2-owner-rmd'
    plan.accounts = [
      ira('owner-ira', 10_000, 5_000),
      {
        ...ira('s2-ira', 100_000),
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: true,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'surviving-spouse',
            beneficiaryBirthYear: 1950,
            soleBeneficiary: true,
            ownerBirthYear: 1945,
            ownerYearOfDeathRmdSatisfied: true,
            election: 'treat-as-own',
            spouseUnlimitedWithdrawalRight: true,
            treatAsOwnElectionYear: 2027,
            provenance: { source: 'test', asOf: '2026-01-01' },
          },
        },
      },
    ]

    const result = project(plan, 2028)
    const replay = replayOwnedNonRothIraContiguousYears(
      validatePlan(plan), TAX_YEAR, result.years,
    )
    expect(replay.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (replay.status !== 'ownedNonRothIraContiguousReplayComplete') {
      throw new Error(`expected complete replay, received ${replay.status}`)
    }
    for (const calendarYear of [2027, 2028]) {
      const year = result.years.find((candidate) => candidate.year === calendarYear)!
      const owner = replay.annualReplays.find(
        (annual) => annual.taxYear === calendarYear,
      )!.ownerReplays[0]!
      const line7 = owner.line7AllocationEvidence
      expect(year.inheritedDistribution).toBe(0)
      expect(year.rmd).toBeGreaterThan(0)
      expect(line7.annualGrossAmount / 100).toBeCloseTo(year.rmd, 2)
      expect(Math.abs(line7.annualTaxableAmount / 100 - year.magi)).toBeLessThan(0.01)
      expect(line7.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sourceAccountId: 's2-ira' }),
        ]),
      )
    }

    const settlements = settlementController.calls.mock.calls
      .map(([, result]) => result)
    expect(settlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'committed' }),
    ]))
    expect(JSON.stringify(settlements)).not.toMatch(/sourceIdentityInvalid|sourceCoverageInvalid/)
  })

  it('linearizes an empty incumbent from the committed post-growth ratio', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'settled-optimizer-empty-incumbent'
    plan.expenses.baseAnnual = 0
    plan.accounts = [{ ...ira('ira', 100, 20), annualReturnPct: 10 }, roth()]
    const capture = vi.fn<(probe: OptimizerYearProbe) => void>()

    const year = run(plan, TAX_YEAR, capture)[0]!
    const ratio = replayAnnual(plan, year).ownerReplays[0]!.annualBasisRatio

    expect(ratio).toMatchObject({
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: 2_000,
      denominatorMinorUnits: 11_000,
    })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls[0]![0].rothConversionTaxableFraction)
      .toBeCloseTo(9 / 11, 12)
    expect(capture.mock.calls[0]![0].traditionalWithdrawalTaxableFraction)
      .toBeCloseTo(9 / 11, 12)
  })

  it('falls back without publication when legacy QCD blocks replay', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    plan.id = 'settled-qcd-block'
    plan.accounts = [ira('ira', 100_000, 20_000)]
    plan.strategies.qcdAnnual = 1_000

    const years = run(plan, TAX_YEAR + 1)

    expect(years[0]!.qcd).toBeGreaterThan(0)
    expect(years[0]!.retirementRuntimeSource).toBeDefined()
  })
})
