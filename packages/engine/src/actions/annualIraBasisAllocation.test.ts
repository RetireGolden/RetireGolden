import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  allocateAnnualIraBasis,
  type AllocateAnnualIraBasisInput,
  type AnnualIraBasisAllocationEntryInput,
} from './annualIraBasisAllocation.js'

function entry(
  suffix: string,
  grossAmount: number,
  overrides: Partial<AnnualIraBasisAllocationEntryInput> = {},
): AnnualIraBasisAllocationEntryInput {
  return {
    actionId: asActionId(`action-${suffix}`),
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId('ira-1'),
    scheduledDate: '2030-06-01',
    scheduledSequence: 1,
    grossAmount: asUsdCents(grossAmount),
    ...overrides,
  }
}

function input(
  overrides: Partial<AllocateAnnualIraBasisInput> = {},
): AllocateAnnualIraBasisInput {
  return {
    poolId: 'owner-pool',
    taxYear: 2030,
    calculationScope: 'form8606Line7Distributions',
    annualBasisRatio: {
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: asUsdCents(1),
      denominatorMinorUnits: asPositiveUsdCents(2),
      intermediateArithmetic: 'bigintRational',
    },
    annualGrossAmount: asUsdCents(2),
    entries: [
      entry('a', 1),
      entry('b', 1, {
        scheduledDate: '2030-07-01',
      }),
    ],
    ...overrides,
  }
}

describe('allocateAnnualIraBasis', () => {
  it('rounds a half-cent annual result once and awards the cent once', () => {
    const result = allocateAnnualIraBasis(input())

    expect(result.annualNontaxableBasisAmount).toBe(1)
    expect(result.annualTaxableAmount).toBe(1)
    expect(result.allocations.map((item) => item.allocatedBasisAmount)).toEqual([1, 0])
    expect(result.allocations.map((item) => item.residualCentAwarded)).toEqual([1, 0])
  })

  it('keeps zero executions out of the ledger and residual competition', () => {
    const result = allocateAnnualIraBasis(
      input({
        annualGrossAmount: asUsdCents(1),
        entries: [
          entry('zero', 0, {
            scheduledDate: '2030-01-01',
          }),
          entry('positive', 1, {
            scheduledDate: '2030-12-31',
          }),
        ],
      }),
    )

    expect(result.allocations).toHaveLength(1)
    expect(result.allocations[0]?.actionId).toBe('action-positive')
    expect(result.allocations[0]?.allocatedBasisAmount).toBe(1)
  })

  it('uses canonical dated then undated ordering independent of input order', () => {
    const dated = entry('dated', 1, {
      scheduledDate: '2030-12-31',
      scheduledSequence: 2,
    })
    const undated = entry('undated', 1, {
      scheduledDate: null,
      scheduledSequence: 1,
    })
    const forward = allocateAnnualIraBasis(input({ entries: [undated, dated] }))
    const reverse = allocateAnnualIraBasis(input({ entries: [dated, undated] }))

    expect(forward).toEqual(reverse)
    expect(forward.allocationEvidenceId).toBe(reverse.allocationEvidenceId)
    expect(forward.allocations.map((item) => item.actionId)).toEqual([
      'action-dated',
      'action-undated',
    ])
    expect(forward.allocations.map((item) => item.residualCentAwarded)).toEqual([1, 0])
  })

  it('allocates a repeating one-third ratio without independently rounding entries', () => {
    const result = allocateAnnualIraBasis(
      input({
        annualBasisRatio: {
          representation: 'exactMinorUnitRational',
          numeratorMinorUnits: asUsdCents(1),
          denominatorMinorUnits: asPositiveUsdCents(3),
          intermediateArithmetic: 'bigintRational',
        },
        annualGrossAmount: asUsdCents(3),
        entries: [
          entry('a', 1),
          entry('b', 1, { scheduledDate: '2030-07-01' }),
          entry('c', 1, { scheduledDate: null }),
        ],
      }),
    )

    expect(result.annualNontaxableBasisAmount).toBe(1)
    expect(result.allocations.map((item) => item.allocatedBasisAmount)).toEqual([1, 0, 0])
  })

  it('keeps line 7 and line 8 evidence identities distinct', () => {
    const line7 = allocateAnnualIraBasis(input())
    const line8 = allocateAnnualIraBasis(
      input({ calculationScope: 'form8606Line8NetConversions' }),
    )

    expect(line7.annualBasisRatio).toEqual(line8.annualBasisRatio)
    expect(line7.allocationEvidenceId).not.toBe(line8.allocationEvidenceId)
  })

  it('uses bigint intermediates when safe inputs multiply beyond the safe range', () => {
    const large = 9_000_000_000_000_000
    const result = allocateAnnualIraBasis(
      input({
        annualBasisRatio: {
          representation: 'exactMinorUnitRational',
          numeratorMinorUnits: asUsdCents(large - 1),
          denominatorMinorUnits: asPositiveUsdCents(large),
          intermediateArithmetic: 'bigintRational',
        },
        annualGrossAmount: asUsdCents(large),
        entries: [entry('large', large)],
      }),
    )

    expect(result.annualNontaxableBasisAmount).toBe(large - 1)
    expect(result.annualTaxableAmount).toBe(1)
  })

  it('supports only an all-zero ledger for the no-division ratio arm', () => {
    const result = allocateAnnualIraBasis(
      input({
        annualBasisRatio: {
          representation: 'notApplicableZeroDenominator',
          numeratorMinorUnits: 0 as const,
          denominatorMinorUnits: 0 as const,
          intermediateArithmetic: 'notApplicable',
        },
        annualGrossAmount: asUsdCents(0),
        entries: [entry('zero', 0)],
      }),
    )

    expect(result.allocations).toEqual([])
    expect(result.annualNontaxableBasisAmount).toBe(0)
    expect(result.annualTaxableAmount).toBe(0)
  })

  it('deep-freezes the detached canonical result', () => {
    const source = input()
    const result = allocateAnnualIraBasis(source)
    ;(source.entries[0] as AnnualIraBasisAllocationEntryInput).scheduledDate = null

    expect(result.allocations[0]?.scheduledDate).toBe('2030-06-01')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.allocations)).toBe(true)
    expect(Object.isFrozen(result.allocations[0])).toBe(true)
    expect(Object.isFrozen(result.annualBasisRatio)).toBe(true)
  })

  it.each([
    {
      name: 'mismatched annual gross',
      change: {
        annualGrossAmount: asUsdCents(3),
      },
      message: 'exactly equal',
    },
    {
      name: 'ratio numerator above denominator',
      change: {
        annualBasisRatio: {
          representation: 'exactMinorUnitRational' as const,
          numeratorMinorUnits: asUsdCents(3),
          denominatorMinorUnits: asPositiveUsdCents(2),
          intermediateArithmetic: 'bigintRational' as const,
        },
      },
      message: 'numerator <= denominator',
    },
    {
      name: 'unknown ratio arm',
      change: {
        annualBasisRatio: {
          representation: 'callerInvented',
          numeratorMinorUnits: asUsdCents(1),
          denominatorMinorUnits: asUsdCents(2),
          intermediateArithmetic: 'bigintRational',
        } as unknown as AllocateAnnualIraBasisInput['annualBasisRatio'],
      },
      message: 'representation is unsupported',
    },
    {
      name: 'positive gross under zero denominator',
      change: {
        annualBasisRatio: {
          representation: 'notApplicableZeroDenominator' as const,
          numeratorMinorUnits: 0 as const,
          denominatorMinorUnits: 0 as const,
          intermediateArithmetic: 'notApplicable' as const,
        },
      },
      message: 'zero-denominator',
    },
    {
      name: 'date outside tax year',
      change: {
        entries: [entry('a', 1, { scheduledDate: '2029-12-31' }), entry('b', 1)],
      },
      message: 'tax year',
    },
    {
      name: 'duplicate allocation identity',
      change: {
        entries: [entry('a', 1), entry('a', 1)],
      },
      message: 'identities',
    },
    {
      name: 'colliding action slots',
      change: {
        entries: [
          entry('a', 1),
          entry('b', 1, {
            actionId: asActionId('different-action'),
          }),
        ],
      },
      message: 'schedule position',
    },
    {
      name: 'one action with inconsistent allocation slots',
      change: {
        entries: [
          entry('a', 1, { actionId: asActionId('shared-action') }),
          entry('b', 1, {
            actionId: asActionId('shared-action'),
            scheduledDate: '2030-07-01',
          }),
        ],
      },
      message: 'share its schedule position',
    },
  ])('rejects $name', ({ change, message }) => {
    expect(() => allocateAnnualIraBasis(input(change))).toThrow(message)
  })

  it('mints both allocation evidence IDs with the hardened structural minter', () => {
    const populated = allocateAnnualIraBasis(input())
    const zeroGross = allocateAnnualIraBasis(input({
      annualGrossAmount: asUsdCents(0),
      entries: [entry('a', 0)],
    }))

    expect(populated.allocationEvidenceId).toBe(
      'annual-ira-basis-allocation:1aa1a4d12a7e664a3dadc9fa146cf305' +
        '70c919c7bde51288d54ce900144156bb',
    )
    expect(zeroGross.allocationEvidenceId).toBe(
      'annual-ira-basis-allocation:8ecc046314a5fc35f4179185370650aa' +
        '5020e4b4c3c9cfc62b9e9577b7a915bb',
    )
    expect(allocateAnnualIraBasis(input()).allocationEvidenceId)
      .toBe(populated.allocationEvidenceId)
    expect(populated.allocationEvidenceId)
      .not.toBe(zeroGross.allocationEvidenceId)
  })
})
