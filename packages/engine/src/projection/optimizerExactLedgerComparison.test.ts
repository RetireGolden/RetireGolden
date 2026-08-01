import { describe, expect, it } from 'vitest'
import { compareOptimizerExactLedgerResults } from './optimizerExactLedgerComparison.js'
import type { ProjectionResult, YearResult } from './types.js'

function projection(
  years: readonly Readonly<{
    year: number
    tax?: number
    penalties?: number
    investableTotal?: number
    netWorth?: number
    balances: Readonly<Record<string, number>>
  }>[],
  endings: Readonly<{
    endingInvestable?: number
    endingNetWorth?: number
    endingNondeductibleIraBasis?: number
  }> = {},
): ProjectionResult {
  return {
    startYear: years[0]?.year,
    endYear: years.at(-1)?.year,
    years: years.map((year) => ({
      year: year.year,
      tax: year.tax ?? 10,
      penalties: year.penalties ?? 0,
      investableTotal: year.investableTotal ?? 100,
      netWorth: year.netWorth ?? 120,
      balances: year.balances,
    })) as YearResult[],
    endingInvestable: endings.endingInvestable ?? 100,
    endingNetWorth: endings.endingNetWorth ?? 120,
    endingNondeductibleIraBasis: endings.endingNondeductibleIraBasis ?? 0,
  } as ProjectionResult
}

function twoYearResult(): ProjectionResult {
  return projection([
    { year: 2030, balances: { roth: 40, traditional: 60 } },
    { year: 2031, balances: { roth: 45, traditional: 55 } },
  ])
}

describe('compareOptimizerExactLedgerResults', () => {
  it('returns exactly the mandatory invariant-7 key set for equal ledgers', () => {
    const evidence = compareOptimizerExactLedgerResults(
      twoYearResult(),
      twoYearResult(),
    )

    expect(evidence).not.toBeNull()
    expect(evidence).toMatchObject({
      currencyMinorUnit: 0.01,
      quantization: 'nearestCentHalfUp',
      equality: 'exactMinorUnitByRequiredKey',
      aggregateHorizon: { startYear: 2030, endYear: 2031, taxYears: [2030, 2031] },
      allocatedHorizon: { startYear: 2030, endYear: 2031, taxYears: [2030, 2031] },
      evaluatedTaxYears: [2030, 2031],
      evaluatedAccountIds: ['roth', 'traditional'],
    })
    expect(evidence?.entries.map((entry) => entry.key)).toEqual([
      { kind: 'annualTaxTotal', taxYear: 2030, field: 'tax' },
      { kind: 'annualTaxTotal', taxYear: 2030, field: 'penalties' },
      { kind: 'annualBalanceTotal', taxYear: 2030, field: 'investableTotal' },
      { kind: 'annualBalanceTotal', taxYear: 2030, field: 'netWorth' },
      { kind: 'accountEndingBalance', taxYear: 2030, accountId: 'roth' },
      { kind: 'accountEndingBalance', taxYear: 2030, accountId: 'traditional' },
      { kind: 'annualTaxTotal', taxYear: 2031, field: 'tax' },
      { kind: 'annualTaxTotal', taxYear: 2031, field: 'penalties' },
      { kind: 'annualBalanceTotal', taxYear: 2031, field: 'investableTotal' },
      { kind: 'annualBalanceTotal', taxYear: 2031, field: 'netWorth' },
      { kind: 'accountEndingBalance', taxYear: 2031, accountId: 'roth' },
      { kind: 'accountEndingBalance', taxYear: 2031, accountId: 'traditional' },
      { kind: 'projectionEndingTotal', taxYear: 2031, field: 'endingInvestable' },
      { kind: 'projectionEndingTotal', taxYear: 2031, field: 'endingNetWorth' },
      { kind: 'projectionEndingTotal', taxYear: 2031, field: 'endingNondeductibleIraBasis' },
    ])
  })

  it('quantizes positive and negative half-cent ties exactly once', () => {
    const result = projection([
      {
        year: 2030,
        tax: 1.005,
        penalties: 0,
        investableTotal: 2.0049,
        netWorth: -0.0049,
        balances: { zero: -0 },
      },
      {
        year: 2031,
        netWorth: -1.005,
        balances: { zero: 0 },
      },
    ], { endingNetWorth: -1.005 })
    const evidence = compareOptimizerExactLedgerResults(result, structuredClone(result))!
    const amountFor = (kind: string, field?: string) => evidence.entries.find((entry) =>
      entry.key.kind === kind && (field === undefined ||
        ('field' in entry.key && entry.key.field === field)))?.aggregateMinorUnits

    expect(amountFor('annualTaxTotal', 'tax')).toBe(101)
    expect(amountFor('annualBalanceTotal', 'investableTotal')).toBe(200)
    expect(amountFor('annualBalanceTotal', 'netWorth')).toBe(0)
    expect(Object.is(amountFor('annualBalanceTotal', 'netWorth'), -0)).toBe(false)
    expect(amountFor('projectionEndingTotal', 'endingNetWorth')).toBe(-101)
    const zero = evidence.entries.find((entry) =>
      entry.key.kind === 'accountEndingBalance')!.aggregateMinorUnits
    expect(zero).toBe(0)
    expect(Object.is(zero, -0)).toBe(false)
  })

  it.each([
    ['annual tax', (value: ProjectionResult) => { value.years[0]!.tax += 0.01 }],
    ['penalty', (value: ProjectionResult) => { value.years[0]!.penalties += 0.01 }],
    ['investable total', (value: ProjectionResult) => { value.years[0]!.investableTotal += 0.01 }],
    ['net worth', (value: ProjectionResult) => { value.years[0]!.netWorth += 0.01 }],
    ['account balance', (value: ProjectionResult) => { value.years[0]!.balances.roth += 0.01 }],
    ['ending investable', (value: ProjectionResult) => { value.endingInvestable += 0.01 }],
    ['ending net worth', (value: ProjectionResult) => { value.endingNetWorth += 0.01 }],
    ['ending IRA basis', (value: ProjectionResult) => { value.endingNondeductibleIraBasis += 0.01 }],
  ])('rejects a one-cent mismatch in %s', (_label, mutate) => {
    const aggregate = twoYearResult()
    const allocated = structuredClone(aggregate)
    mutate(allocated)
    expect(compareOptimizerExactLedgerResults(aggregate, allocated)).toBeNull()
  })

  it.each([
    ['different end year', (value: ProjectionResult) => { value.endYear = 2032 }],
    ['allocated-only year', (value: ProjectionResult) => {
      value.startYear = 2029
      value.years.unshift({ ...value.years[0]!, year: 2029 })
    }],
    ['empty year sequence', (value: ProjectionResult) => { value.years = [] }],
    ['duplicate year', (value: ProjectionResult) => { value.years[1]!.year = 2030 }],
    ['unordered year', (value: ProjectionResult) => { value.years.reverse() }],
    ['boundary mismatch', (value: ProjectionResult) => { value.startYear = 2029 }],
  ])('rejects an invalid horizon: %s', (_label, mutate) => {
    const aggregate = twoYearResult()
    const allocated = structuredClone(aggregate)
    mutate(allocated)
    expect(compareOptimizerExactLedgerResults(aggregate, allocated)).toBeNull()
  })

  it('rejects a shared interior gap instead of omitting the missing year keys', () => {
    const gapped = projection([
      { year: 2030, balances: { roth: 40 } },
      { year: 2032, balances: { roth: 45 } },
    ])
    expect(compareOptimizerExactLedgerResults(gapped, structuredClone(gapped))).toBeNull()
  })

  it.each([
    ['ending investable', { endingInvestable: 100.01 }],
    ['ending net worth', { endingNetWorth: 120.01 }],
  ])('rejects internally inconsistent %s on both ledgers', (_label, endings) => {
    const inconsistent = projection(
      [{ year: 2030, balances: { roth: 100 } }],
      endings,
    )
    expect(compareOptimizerExactLedgerResults(
      inconsistent,
      structuredClone(inconsistent),
    )).toBeNull()
  })

  it('rejects an account missing from any source year instead of zero-filling it', () => {
    const aggregate = twoYearResult()
    delete aggregate.years[1]!.balances.roth
    expect(compareOptimizerExactLedgerResults(aggregate, twoYearResult())).toBeNull()
  })

  it('accepts whitespace-only IDs from the Plan account contract', () => {
    const result = projection([{ year: 2030, balances: { '   ': 100 } }])
    expect(compareOptimizerExactLedgerResults(result, structuredClone(result))
      ?.evaluatedAccountIds).toEqual(['   '])
  })

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1e20,
    -1,
  ])('rejects malformed, unsafe, or negative nonnegative amount %s', (amount) => {
    const aggregate = twoYearResult()
    aggregate.years[0]!.tax = amount
    expect(compareOptimizerExactLedgerResults(aggregate, twoYearResult())).toBeNull()
  })

  it('rejects the empty account identity', () => {
    const accountId = ''
    const aggregate = projection([{ year: 2030, balances: { [accountId]: 1 } }])
    expect(compareOptimizerExactLedgerResults(aggregate, structuredClone(aggregate))).toBeNull()
  })

  it('rejects ending IRA basis above ending investable on both ledgers', () => {
    const inconsistent = projection(
      [{ year: 2030, balances: { traditional: 100 } }],
      { endingNondeductibleIraBasis: 100.01 },
    )
    expect(compareOptimizerExactLedgerResults(
      inconsistent,
      structuredClone(inconsistent),
    )).toBeNull()
  })

  it('uses raw UTF-16 ordering and is invariant to balance-map insertion order', () => {
    const aggregate = projection([{ year: 2030, balances: { 'ä': 1, z: 2, a: 3 } }])
    const allocated = projection([{ year: 2030, balances: { a: 3, z: 2, 'ä': 1 } }])
    expect(compareOptimizerExactLedgerResults(aggregate, allocated)?.evaluatedAccountIds)
      .toEqual(['a', 'z', 'ä'])
  })

  it('is deterministic, input-pure, and returns deeply frozen detached evidence', () => {
    const aggregate = twoYearResult()
    const allocated = structuredClone(aggregate)
    const aggregateBefore = structuredClone(aggregate)
    const allocatedBefore = structuredClone(allocated)
    const first = compareOptimizerExactLedgerResults(aggregate, allocated)!
    const second = compareOptimizerExactLedgerResults(aggregate, allocated)!

    expect(first).toEqual(second)
    expect(aggregate).toEqual(aggregateBefore)
    expect(allocated).toEqual(allocatedBefore)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.aggregateHorizon.taxYears)).toBe(true)
    expect(Object.isFrozen(first.entries)).toBe(true)
    expect(Object.isFrozen(first.entries[0]?.key)).toBe(true)
    expect(Object.isFrozen(aggregate)).toBe(false)
  })

  it('fails closed without invoking accessor-backed balances or scalar fields', () => {
    const allocated = twoYearResult()
    let balanceReads = 0
    let taxReads = 0
    Object.defineProperty(allocated.years[0], 'balances', {
      enumerable: true,
      get: () => {
        balanceReads += 1
        return { roth: balanceReads === 1 ? 40 : 777, traditional: 60 }
      },
    })
    Object.defineProperty(allocated.years[0], 'tax', {
      enumerable: true,
      get: () => { taxReads += 1; return 10 },
    })
    expect(compareOptimizerExactLedgerResults(twoYearResult(), allocated)).toBeNull()
    expect(balanceReads).toBe(0)
    expect(taxReads).toBe(0)
  })

  it('exposes no caller-selected field, epsilon, residual, or tolerance options', () => {
    expect(compareOptimizerExactLedgerResults.length).toBe(2)
  })
})
