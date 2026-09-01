import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  RecordedDistributedYield,
  RecordedWage,
} from '../annualCashFlowYearSites.js'
import type {
  DistributedTaxableYieldInput,
  DistributedTaxableYieldResultRow,
} from './distributedTaxableYieldRows.js'
import type { WageIncomeRow, WageIncomeYearInput } from './wageIncomeStreams.js'

const seam = vi.hoisted(() => ({
  yieldRows: [] as DistributedTaxableYieldResultRow[],
  wageRows: [] as WageIncomeRow[],
  yieldInputs: [] as DistributedTaxableYieldInput[],
  wageInputs: [] as WageIncomeYearInput[],
  events: [] as string[],
}))

vi.mock('./distributedTaxableYieldRows.js', () => ({
  distributedTaxableYieldRows: (input: DistributedTaxableYieldInput) => {
    seam.yieldInputs.push(input)
    seam.events.push('yield-producer')
    return seam.yieldRows
  },
}))

vi.mock('./wageIncomeStreams.js', () => ({
  wageIncomeStreams: (input: WageIncomeYearInput) => {
    seam.wageInputs.push(input)
    seam.events.push('wage-producer')
    return seam.wageRows
  },
}))

import { annualIncomeSetup } from './annualIncomeSetup.js'

function yieldRow(input: {
  accountId: string
  interest?: number
  ordinaryDividends?: number
  qualified?: number
  exempt?: number
  gross: number
  distributedYieldPct: number
  reinvest: boolean
}): DistributedTaxableYieldResultRow {
  const interest = input.interest ?? 0
  const ordinaryDividends = input.ordinaryDividends ?? 0
  const qualified = input.qualified ?? 0
  const exempt = input.exempt ?? 0
  const taxableGross = interest + ordinaryDividends + qualified
  const record: RecordedDistributedYield = {
    accountId: input.accountId,
    taxableGross,
    interest,
    ordinaryDividends,
    qualified,
    exempt,
    reinvest: input.reinvest,
  }
  return {
    kind: 'yield',
    ...input,
    interest,
    ordinaryDividends,
    qualified,
    exempt,
    taxableGross,
    record,
  }
}

function wageRow(personId: string, amount: number, id: string): WageIncomeRow {
  const record: RecordedWage = { incomeStreamId: id, personId, amount }
  return { personId, amount, record }
}

const distributedYieldInput = {} as DistributedTaxableYieldInput
const wageInput = {} as WageIncomeYearInput

function float64Bits(value: number): bigint {
  return new BigUint64Array(new Float64Array([value]).buffer)[0]!
}

describe('annualIncomeSetup', () => {
  beforeEach(() => {
    seam.yieldRows = []
    seam.wageRows = []
    seam.yieldInputs.length = 0
    seam.wageInputs.length = 0
    seam.events.length = 0
  })

  it('finishes the eager yield fold before producing wage rows', () => {
    const ordered = yieldRow({
      accountId: 'ordered',
      interest: 1,
      gross: 1,
      distributedYieldPct: 1,
      reinvest: false,
    })
    if (ordered.kind !== 'yield') throw new Error('expected yield row')
    Object.defineProperty(ordered, 'interest', {
      get: () => {
        seam.events.push('yield-fold')
        return 1
      },
    })
    const record = ordered.record
    Object.defineProperty(ordered, 'record', {
      get: () => {
        seam.events.push('yield-record-get')
        return record
      },
    })
    seam.yieldRows = [ordered]

    annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
      commitDistributedYield: (row) => {
        void row.record
        seam.events.push('yield-commit')
      },
    })

    expect(seam.events[0]).toBe('yield-producer')
    expect(seam.events).toContain('yield-fold')
    expect(seam.events).toContain('yield-commit')
    expect(seam.events.indexOf('yield-fold')).toBeLessThan(
      seam.events.indexOf('yield-record-get'),
    )
    expect(seam.events.indexOf('yield-record-get')).toBeLessThan(
      seam.events.indexOf('yield-commit'),
    )
    expect(seam.events.indexOf('yield-commit')).toBeLessThan(
      seam.events.indexOf('wage-producer'),
    )
    expect(seam.events.lastIndexOf('yield-fold')).toBeLessThan(
      seam.events.indexOf('wage-producer'),
    )
  })

  it('stops at the original transaction point when a yield commit throws', () => {
    const first = yieldRow({
      accountId: 'throwing-yield',
      interest: 1,
      gross: 1,
      distributedYieldPct: 1,
      reinvest: false,
    })
    const second = yieldRow({
      accountId: 'must-not-fold',
      interest: 2,
      gross: 2,
      distributedYieldPct: 1,
      reinvest: false,
    })
    Object.defineProperty(second, 'interest', {
      get: () => {
        seam.events.push('yield-fold:second')
        return 2
      },
    })
    seam.yieldRows = [first, second]
    seam.wageRows = [wageRow('p1', 2, 'must-not-run')]

    expect(() => annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
      commitDistributedYield: (committed) => {
        expect(committed).toBe(first)
        seam.events.push('yield-commit-throw')
        throw new Error('yield recorder failed')
      },
      commitWage: () => seam.events.push('wage-commit'),
    })).toThrow('yield recorder failed')

    expect(seam.events).toEqual([
      'yield-producer',
      'yield-commit-throw',
    ])
  })

  it('commits each wage after its fold and before folding later rows', () => {
    const first = wageRow('p1', 1, 'first')
    const second = wageRow('p1', 2, 'second')
    let firstAmountReads = 0
    Object.defineProperty(first, 'amount', {
      get: () => {
        firstAmountReads += 1
        seam.events.push('wage-fold:first')
        return 1
      },
    })
    Object.defineProperty(second, 'amount', {
      get: () => {
        seam.events.push('wage-fold:second')
        return 2
      },
    })
    seam.wageRows = [first, second]

    expect(() => annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
      commitWage: (row) => {
        expect(firstAmountReads).toBeGreaterThan(0)
        seam.events.push(`wage-commit:${row.record.incomeStreamId}`)
        if (row === first) throw new Error('wage recorder failed')
      },
    })).toThrow('wage recorder failed')

    expect(seam.events.slice(0, 2)).toEqual([
      'yield-producer',
      'wage-producer',
    ])
    expect(seam.events).toContain('wage-commit:first')
    expect(seam.events.lastIndexOf('wage-fold:first')).toBeLessThan(
      seam.events.indexOf('wage-commit:first'),
    )
    expect(seam.events).not.toContain('wage-fold:second')
  })

  it('does not read recorder payload properties when no commit hook exists', () => {
    const distributed = yieldRow({
      accountId: 'no-capture-yield',
      interest: 1,
      gross: 1,
      distributedYieldPct: 1,
      reinvest: false,
    })
    const wage = wageRow('p1', 2, 'no-capture-wage')
    Object.defineProperty(distributed, 'record', {
      get: () => {
        throw new Error('yield record was read eagerly')
      },
    })
    Object.defineProperty(wage, 'record', {
      get: () => {
        throw new Error('wage record was read eagerly')
      },
    })
    seam.yieldRows = [distributed]
    seam.wageRows = [wage]

    const result = annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
    })

    expect(result.incomes.taxableInterest).toBe(1)
    expect(result.incomes.wages).toBe(2)
    expect(result.ordinaryIncome).toBe(3)
  })

  it('folds yield then wages in source order and preserves producer identity', () => {
    const first = yieldRow({
      accountId: 'duplicate',
      interest: 10_000_000_000_000_000,
      ordinaryDividends: 0.25,
      qualified: 2,
      exempt: 3,
      gross: 10_000_000_000_000_004,
      distributedYieldPct: 4,
      reinvest: true,
    })
    const lastDuplicate = yieldRow({
      accountId: 'duplicate',
      ordinaryDividends: 0.5,
      gross: 1,
      distributedYieldPct: 5,
      reinvest: false,
    })
    const secondAccount = yieldRow({
      accountId: 'second',
      interest: 0.5,
      gross: 1,
      distributedYieldPct: 6,
      reinvest: true,
    })
    seam.yieldRows = [{ kind: 'none' }, first, lastDuplicate, secondAccount]
    seam.wageRows = [
      wageRow('p2', 1, 'wage-z'),
      wageRow('p1', 1, 'wage-a'),
      wageRow('p2', 2, 'wage-m'),
    ]

    const result = annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
    })

    expect(seam.yieldInputs).toEqual([distributedYieldInput])
    expect(seam.wageInputs).toEqual([wageInput])
    expect(result.distributedYieldRows).toBe(seam.yieldRows)
    expect(result.wageRows).toBe(seam.wageRows)
    expect(result.distributedYieldRows[1]).toBe(first)
    expect(result.wageRows[0]?.record).toBe(seam.wageRows[0]?.record)

    let expectedOrdinary = 0
    for (const row of [first, lastDuplicate, secondAccount]) {
      if (row.kind === 'yield') {
        expectedOrdinary += row.interest + row.ordinaryDividends
      }
    }
    const ordinaryBeforeWages = expectedOrdinary
    const sourceOrderFold = [ordinaryBeforeWages]
    for (const row of seam.wageRows) {
      expectedOrdinary += row.amount
      sourceOrderFold.push(expectedOrdinary)
    }
    let reversedWages = ordinaryBeforeWages
    const reverseOrderFold = [ordinaryBeforeWages]
    for (const row of [...seam.wageRows].reverse()) {
      reversedWages += row.amount
      reverseOrderFold.push(reversedWages)
    }
    const preSummedWages = ordinaryBeforeWages +
      seam.wageRows.reduce((total, row) => total + row.amount, 0)

    // These are the exact binary64 folds, expressed both as Numbers and as
    // their raw bit patterns. At 10^16, one ULP is 2: the source order
    // [1, 1, 2] stays at the base for both halfway additions, then advances
    // one ULP. Reversing to [2, 1, 1] advances two ULPs. This makes the
    // ordering distinction executable rather than dependent on mental
    // decimal arithmetic in a review.
    expect(sourceOrderFold).toEqual([
      10_000_000_000_000_000,
      10_000_000_000_000_000,
      10_000_000_000_000_000,
      10_000_000_000_000_002,
    ])
    expect(sourceOrderFold.map(float64Bits)).toEqual([
      0x4341c37937e08000n,
      0x4341c37937e08000n,
      0x4341c37937e08000n,
      0x4341c37937e08001n,
    ])
    expect(reverseOrderFold).toEqual([
      10_000_000_000_000_000,
      10_000_000_000_000_002,
      10_000_000_000_000_004,
      10_000_000_000_000_004,
    ])
    expect(reverseOrderFold.map(float64Bits)).toEqual([
      0x4341c37937e08000n,
      0x4341c37937e08001n,
      0x4341c37937e08002n,
      0x4341c37937e08002n,
    ])
    expect(result.ordinaryIncome).toBe(10_000_000_000_000_002)
    expect(result.ordinaryIncome).toBe(expectedOrdinary)
    expect(reversedWages).toBe(10_000_000_000_000_004)
    expect(preSummedWages).toBe(10_000_000_000_000_004)
    expect(float64Bits(result.ordinaryIncome)).toBe(0x4341c37937e08001n)
    expect(float64Bits(reversedWages)).toBe(0x4341c37937e08002n)
    expect(float64Bits(preSummedWages)).toBe(0x4341c37937e08002n)

    expect(result.incomes).toEqual({
      wages: 4,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 10_000_000_000_000_000,
      ordinaryDividends: 0.75,
      qualifiedDividends: 2,
      taxableYield: 10_000_000_000_000_002,
      taxExemptInterest: 3,
      total: 0,
    })
    expect([...result.distributedYieldByAccountId]).toEqual([
      ['duplicate', { gross: 1, distributedYieldPct: 5, reinvest: false }],
      ['second', { gross: 1, distributedYieldPct: 6, reinvest: true }],
    ])
    expect([...result.wagesByPerson]).toEqual([['p2', 3], ['p1', 1]])
    expect(result.taxableYieldReinvested).toBe(
      10_000_000_000_000_004 + 1,
    )
  })

  it('returns fresh annual containers and does not mutate producer arrays', () => {
    const none: DistributedTaxableYieldResultRow = { kind: 'none' }
    const zeroWage = wageRow('p1', 0, 'zero')
    seam.yieldRows = [none]
    seam.wageRows = [zeroWage]
    const beforeYield = [...seam.yieldRows]
    const beforeWages = [...seam.wageRows]

    const first = annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
    })
    const second = annualIncomeSetup({
      distributedYield: distributedYieldInput,
      wages: wageInput,
    })

    expect(first.incomes).not.toBe(second.incomes)
    expect(first.distributedYieldByAccountId).not.toBe(
      second.distributedYieldByAccountId,
    )
    expect(first.wagesByPerson).not.toBe(second.wagesByPerson)
    expect(first.distributedYieldRows).toBe(seam.yieldRows)
    expect(second.wageRows).toBe(seam.wageRows)
    expect(seam.yieldRows).toEqual(beforeYield)
    expect(seam.wageRows).toEqual(beforeWages)
    expect(first.incomes.wages).toBe(0)
    expect(first.ordinaryIncome).toBe(0)
  })
})
