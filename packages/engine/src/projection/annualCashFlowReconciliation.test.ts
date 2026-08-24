import { describe, expect, it } from 'vitest'

import { asAccountId, asPersonId } from '../actions/identity.js'
import {
  CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
} from './annualCashFlowCapture.js'
import {
  finalizeYearCashFlow,
  reconcileYearCashFlow,
} from './annualCashFlowReconciliation.js'
import type {
  YearCashFlowSourceLine,
  YearCashFlowStandaloneTaxCharacter,
  YearCashFlowTransferLine,
  YearCashFlowUseLine,
} from './types.js'

const TOLERANCE = CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS
const accountId = asAccountId('tax1')
const propertyId = asAccountId('prop1')
const personId = asPersonId('p1')

function reconcile(opts: {
  sourceLines?: readonly YearCashFlowSourceLine[]
  useLines?: readonly YearCashFlowUseLine[]
  transferLines?: readonly YearCashFlowTransferLine[]
  taxCharacterMetadata?: readonly YearCashFlowStandaloneTaxCharacter[]
  missingRequiredIdentityReports?: readonly { readonly lineIds: readonly string[] }[]
  collidingEncodedProducerSegments?: readonly string[]
  cashIdentityTolerancePlanDollars?: number
}) {
  return reconcileYearCashFlow({
    sourceLines: opts.sourceLines ?? [],
    useLines: opts.useLines ?? [],
    transferLines: opts.transferLines ?? [],
    taxCharacterMetadata: opts.taxCharacterMetadata ?? [],
    missingRequiredIdentityReports: opts.missingRequiredIdentityReports,
    collidingEncodedProducerSegments: opts.collidingEncodedProducerSegments,
    tolerancePlanDollars: TOLERANCE,
    cashIdentityTolerancePlanDollars: opts.cashIdentityTolerancePlanDollars ?? TOLERANCE,
  })
}

function reinvestedYield(amount: number): YearCashFlowTransferLine {
  return {
    id: 'transfer:reinvestedYield:tax1',
    kind: 'reinvestedYield',
    source: { entityKind: 'accountYield', accountId },
    destination: { entityKind: 'account', accountId },
    debitPlanDollars: amount,
    creditPlanDollars: amount,
    identities: [{ entityKind: 'account', accountId }],
  }
}

function propertySale(amount: number): YearCashFlowSourceLine {
  return {
    id: 'source:propertySaleProceeds:prop1',
    kind: 'propertySaleProceeds',
    role: 'spendableSource',
    amountPlanDollars: amount,
    identities: [{ entityKind: 'propertyAccount', propertyAccountId: propertyId }],
  }
}

function surplusUse(amount: number): YearCashFlowUseLine {
  return {
    id: 'use:surplusInvestment:unassignedCash',
    kind: 'surplusInvestment',
    requestedPlanDollars: amount,
    fundedPlanDollars: amount,
    unfundedPlanDollars: 0,
    identities: [],
  }
}

function contributionUse(opts: {
  requested: number
  funded: number
  unfunded: number
}): YearCashFlowUseLine {
  return {
    id: 'use:contribution:tax1',
    kind: 'contribution',
    requestedPlanDollars: opts.requested,
    fundedPlanDollars: opts.funded,
    unfundedPlanDollars: opts.unfunded,
    identities: [{ entityKind: 'account', accountId }],
  }
}

function employeeContributionTransfer(
  amount: number,
  relationship: 'sameDollarLaterStage' | 'committedCreditBeyondFunding',
): YearCashFlowTransferLine {
  return {
    id: 'transfer:employeeContribution:tax1',
    kind: 'employeeContribution',
    source: { entityKind: 'householdCash' },
    destination: { entityKind: 'account', accountId },
    debitPlanDollars: amount,
    creditPlanDollars: amount,
    identities: [{ entityKind: 'account', accountId }],
    lineage: [{ lineId: 'use:contribution:tax1', relationship }],
  }
}

describe('reconcileYearCashFlow', () => {
  it('reconciles the 0=0 empty year', () => {
    const result = reconcile({})
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).toEqual([])
    expect(result.diagnostics).toEqual([])
    expect(result.tolerancePlanDollars).toBe(1e-6)
    expect(result.cashIdentityTolerancePlanDollars).toBe(TOLERANCE)
    expect(result.cash.sourceTotalPlanDollars).toBe(0)
    expect(result.cash.destinationTotalPlanDollars).toBe(0)
    expect(result.cash.differencePlanDollars).toBe(0)
    expect(result.uses.differencePlanDollars).toBe(0)
    expect(result.transfers.differencePlanDollars).toBe(0)
  })

  it('reconciles a reinvest-only year: empty spendable sources, one gross reinvestedYield transfer', () => {
    // Worksheet: taxable yield $4,000, all reinvested. incomes.total includes
    // that yield; spendable sources stay empty by design. The transfer is
    // excluded from both cash sides, so 0=0 cash and 4,000=4,000 pairing.
    const result = reconcile({
      transferLines: [reinvestedYield(4_000)],
    })
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).toEqual([])
    expect(result.cash.spendableSourcesPlanDollars).toBe(0)
    expect(result.cash.differencePlanDollars).toBe(0)
    expect(result.transfers.debitsPlanDollars).toBe(4_000)
    expect(result.transfers.creditsPlanDollars).toBe(4_000)
    expect(result.transfers.differencePlanDollars).toBe(0)
  })

  it('supports an explicit strict cash override for direct reconciliation callers', () => {
    const noisy = reconcile({
      sourceLines: [propertySale(1e-7)],
      cashIdentityTolerancePlanDollars: TOLERANCE,
    })
    expect(noisy.status).toBe('reconciled')
    expect(Math.abs(noisy.cash.differencePlanDollars)).toBe(1e-7)

    const mismatch = reconcile({
      sourceLines: [propertySale(1e-6 + 1e-12)],
      cashIdentityTolerancePlanDollars: TOLERANCE,
    })
    expect(mismatch.status).toBe('notReconciled')
    expect(mismatch.reasonCodes).toContain('cashIdentityMismatch')
    expect(mismatch.diagnostics).toEqual([
      expect.objectContaining({
        reasonCode: 'cashIdentityMismatch',
        expectedPlanDollars: 0,
        actualPlanDollars: 1e-6 + 1e-12,
      }),
    ])
  })

  it('preserves the strict single-tolerance contract when the cash override is omitted', () => {
    const result = reconcileYearCashFlow({
      sourceLines: [propertySale(0.004)],
      useLines: [],
      transferLines: [],
      tolerancePlanDollars: TOLERANCE,
    })
    expect(result.cashIdentityTolerancePlanDollars).toBe(TOLERANCE)
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('cashIdentityMismatch')
  })

  it('accepts the funding solve half-cent cash residual without weakening structural checks', () => {
    // Funding-root worksheet rule (simulate.ts): a solve is accepted when
    // Math.abs(requiredNeed - need) <= EPSILON. Both exact +/- $0.005 cash
    // boundaries must therefore remain graphable; > $0.005 must fail closed.
    for (const boundary of [
      { sourceLines: [propertySale(0.005)], useLines: [] },
      { sourceLines: [], useLines: [surplusUse(0.005)] },
    ]) {
      const exactBoundary = reconcile({
        ...boundary,
        cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
      })
      expect(exactBoundary.status).toBe('reconciled')
      expect(Math.abs(exactBoundary.cash.differencePlanDollars)).toBe(0.005)
    }

    const cash = reconcile({
      sourceLines: [propertySale(100)],
      useLines: [surplusUse(100.004)],
      cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
    })
    expect(cash.status).toBe('reconciled')
    expect(cash.cash.differencePlanDollars).toBeCloseTo(-0.004, 12)
    expect(cash.cashIdentityTolerancePlanDollars).toBe(0.005)

    const cashMismatch = reconcile({
      sourceLines: [propertySale(100)],
      useLines: [surplusUse(100.006)],
      cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
    })
    expect(cashMismatch.status).toBe('notReconciled')
    expect(cashMismatch.reasonCodes).toContain('cashIdentityMismatch')

    const transfer = reconcile({
      transferLines: [{
        ...reinvestedYield(100),
        creditPlanDollars: 100.004,
      }],
      cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
    })
    expect(transfer.status).toBe('notReconciled')
    expect(transfer.reasonCodes).not.toContain('cashIdentityMismatch')
    expect(transfer.reasonCodes).toContain('transferIdentityMismatch')
  })

  it('flags a duplicate published id once per colliding id and still publishes both lines', () => {
    const result = reconcile({
      sourceLines: [propertySale(50), { ...propertySale(50) }],
      useLines: [surplusUse(100)],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('duplicateLineId')
    expect(result.diagnostics.filter((row) => row.reasonCode === 'duplicateLineId')).toEqual([
      { reasonCode: 'duplicateLineId', lineIds: ['source:propertySaleProceeds:prop1'] },
    ])
    expect(result.cash.sourceTotalPlanDollars).toBe(100)
  })

  it('flags a plan-level encoded producer collision as duplicateLineId naming the segment', () => {
    const encoded = encodeURIComponent('\uFFFD')
    const result = reconcile({
      collidingEncodedProducerSegments: [encoded],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('duplicateLineId')
    expect(result.diagnostics.filter((row) => row.reasonCode === 'duplicateLineId')).toEqual([
      { reasonCode: 'duplicateLineId', lineIds: [encoded] },
    ])
  })

  it('flags a negative physical amount as invalidAmount', () => {
    const result = reconcile({
      sourceLines: [propertySale(-1)],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('invalidAmount')
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'invalidAmount',
        lineIds: ['source:propertySaleProceeds:prop1'],
        actualPlanDollars: -1,
      }),
    ]))
  })

  it('flags a nonfinite physical amount as invalidAmount', () => {
    const result = reconcile({
      sourceLines: [propertySale(Number.POSITIVE_INFINITY)],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('invalidAmount')
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({
      reasonCode: 'invalidAmount',
      actualPlanDollars: Number.POSITIVE_INFINITY,
    }))
  })

  it('allows a negative capitalGain character and never folds it into a money total', () => {
    const result = reconcile({
      taxCharacterMetadata: [
        {
          id: 'metadata:capitalGain:rebalancing:tax1',
          taxCharacter: { kind: 'capitalGain', amountPlanDollars: -250 },
          identities: [{ entityKind: 'account', accountId }],
        },
      ],
    })
    expect(result.status).toBe('reconciled')
    expect(result.cash.differencePlanDollars).toBe(0)
    expect(result.transfers.differencePlanDollars).toBe(0)
  })

  it('flags dangling lineage as invalidLineage', () => {
    const result = reconcile({
      transferLines: [
        {
          ...reinvestedYield(4_000),
          kind: 'qualifiedCharitableDistribution',
          id: 'transfer:qualifiedCharitableDistribution:rmd:p1',
          source: { entityKind: 'requiredDistributionPool', personId },
          destination: { entityKind: 'charity' },
          identities: [{ entityKind: 'requiredDistributionPool', personId }],
          lineage: [{
            lineId: 'source:requiredMinimumDistribution:ownedIraPool:p1',
            relationship: 'divertedBeforeHouseholdCash',
          }],
        },
      ],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('invalidLineage')
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'invalidLineage',
        lineIds: [
          'transfer:qualifiedCharitableDistribution:rmd:p1',
          'source:requiredMinimumDistribution:ownedIraPool:p1',
        ],
      }),
    ]))
  })

  it('accepts committedCreditBeyondFunding when the transfer delta equals the use unfunded remainder', () => {
    // Worksheet: requested 8,000, funded 1,000, unfunded 7,000. Transfer
    // records the full committed credit 8,000. Residual attributed
    // 8,000 − 1,000 = 7,000, which does not exceed unfunded.
    const result = reconcile({
      sourceLines: [propertySale(1_000)],
      useLines: [contributionUse({ requested: 8_000, funded: 1_000, unfunded: 7_000 })],
      transferLines: [employeeContributionTransfer(8_000, 'committedCreditBeyondFunding')],
    })
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).not.toContain('invalidLineage')
    expect(result.cash.differencePlanDollars).toBe(0)
  })

  it('accepts committedCreditBeyondFunding when transfer − funded is residual, not all unfunded', () => {
    // Worksheet: requested 20,000, credited 8,000. Residual cash shortage
    // 1,000 and statutory-cap rejection 11,000. Funded 7,000, unfunded
    // 13,000, transfer 8,000. Residual attributed = 1,000, not 13,000.
    const result = reconcile({
      sourceLines: [propertySale(7_000)],
      useLines: [contributionUse({ requested: 20_000, funded: 7_000, unfunded: 13_000 })],
      transferLines: [employeeContributionTransfer(8_000, 'committedCreditBeyondFunding')],
    })
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).not.toContain('invalidLineage')
    expect(result.cash.differencePlanDollars).toBe(0)
  })

  it('accepts sameDollarLaterStage when transfer equals funded despite cap-rejected unfunded', () => {
    // Worksheet: requested 20,000, statutory cap 8,600, ample cash. Transfer
    // = funded = 8,600; unfunded 11,400 is cap rejection, not residual.
    const result = reconcile({
      sourceLines: [propertySale(8_600)],
      useLines: [contributionUse({ requested: 20_000, funded: 8_600, unfunded: 11_400 })],
      transferLines: [employeeContributionTransfer(8_600, 'sameDollarLaterStage')],
    })
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).not.toContain('invalidLineage')
    expect(result.cash.differencePlanDollars).toBe(0)
  })

  it('rejects committedCreditBeyondFunding when the residual exceeds the unfunded remainder', () => {
    const result = reconcile({
      sourceLines: [propertySale(1_000)],
      useLines: [contributionUse({ requested: 8_000, funded: 1_000, unfunded: 7_000 })],
      transferLines: [employeeContributionTransfer(8_001, 'committedCreditBeyondFunding')],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('invalidLineage')
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'invalidLineage',
        lineIds: ['transfer:employeeContribution:tax1', 'use:contribution:tax1'],
        expectedPlanDollars: 7_000,
        actualPlanDollars: 7_001,
        differencePlanDollars: 1,
      }),
    ]))
  })

  it('flags a transfer whose debit and credit differ beyond tolerance', () => {
    const result = reconcile({
      transferLines: [
        {
          ...reinvestedYield(4_000),
          creditPlanDollars: 3_999,
        },
      ],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('transferIdentityMismatch')
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'transferIdentityMismatch',
        lineIds: ['transfer:reinvestedYield:tax1'],
        expectedPlanDollars: 3_999,
        actualPlanDollars: 4_000,
        differencePlanDollars: 1,
      }),
    ]))
  })

  it('flags a use line whose requested amount is not funded plus unfunded', () => {
    const result = reconcile({
      useLines: [contributionUse({ requested: 10, funded: 3, unfunded: 6 })],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('useIdentityMismatch')
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'useIdentityMismatch',
        lineIds: ['use:contribution:tax1'],
        expectedPlanDollars: 10,
        actualPlanDollars: 9,
        differencePlanDollars: 1,
      }),
    ]))
  })

  it('flags a published line that lacks a grammar-required identity', () => {
    const result = reconcile({
      sourceLines: [
        {
          id: 'source:wages:wage-1',
          kind: 'wages',
          role: 'spendableSource',
          amountPlanDollars: 50_000,
          identities: [{ entityKind: 'incomeStream', incomeStreamId: 'wage-1' }],
        },
      ],
      useLines: [
        {
          id: 'use:requiredLifestyle:household',
          kind: 'requiredLifestyle',
          requestedPlanDollars: 50_000,
          fundedPlanDollars: 50_000,
          unfundedPlanDollars: 0,
          identities: [],
        },
      ],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('missingRequiredIdentity')
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'missingRequiredIdentity',
        lineIds: ['source:wages:wage-1'],
      }),
    ]))
  })

  it('records an assemble-omitted producer as missingRequiredIdentity with empty lineIds', () => {
    const result = reconcile({
      missingRequiredIdentityReports: [{ lineIds: [] }],
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toEqual(['missingRequiredIdentity'])
    expect(result.diagnostics).toEqual([
      { reasonCode: 'missingRequiredIdentity', lineIds: [] },
    ])
  })
})

describe('finalizeYearCashFlow', () => {
  it('omits a zero physical line except an owned-IRA RMD zero-net with a QCD diversion target', () => {
    const zeroWage: YearCashFlowSourceLine = {
      id: 'source:wages:wage-1',
      kind: 'wages',
      role: 'spendableSource',
      amountPlanDollars: 0,
      identities: [
        { entityKind: 'incomeStream', incomeStreamId: 'wage-1' },
        { entityKind: 'person', personId },
      ],
    }
    const zeroRmd: YearCashFlowSourceLine = {
      id: 'source:requiredMinimumDistribution:ownedIraPool:p1',
      kind: 'requiredMinimumDistribution',
      role: 'portfolioFunding',
      amountPlanDollars: 0,
      identities: [{ entityKind: 'requiredDistributionPool', personId }],
    }
    const qcd: YearCashFlowTransferLine = {
      id: 'transfer:qualifiedCharitableDistribution:rmd:p1',
      kind: 'qualifiedCharitableDistribution',
      source: { entityKind: 'requiredDistributionPool', personId },
      destination: { entityKind: 'charity' },
      debitPlanDollars: 10_000,
      creditPlanDollars: 10_000,
      identities: [{ entityKind: 'requiredDistributionPool', personId }],
      lineage: [{
        lineId: 'source:requiredMinimumDistribution:ownedIraPool:p1',
        relationship: 'divertedBeforeHouseholdCash',
      }],
    }
    const published = finalizeYearCashFlow({
      sourceLines: [zeroWage, zeroRmd],
      useLines: [],
      transferLines: [qcd],
      taxCharacterMetadata: [],
      tolerancePlanDollars: TOLERANCE,
      cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
    })
    expect(published.sourceLines.map((line) => line.id)).toEqual([
      'source:requiredMinimumDistribution:ownedIraPool:p1',
    ])
    expect(published.reconciliation.status).toBe('reconciled')
  })

  it('emits each reporting array in lexicographic id order', () => {
    const published = finalizeYearCashFlow({
      sourceLines: [
        propertySale(50),
        {
          id: 'source:wages:wage-1',
          kind: 'wages',
          role: 'spendableSource',
          amountPlanDollars: 50,
          identities: [
            { entityKind: 'incomeStream', incomeStreamId: 'wage-1' },
            { entityKind: 'person', personId },
          ],
        },
      ],
      useLines: [
        surplusUse(40),
        {
          id: 'use:requiredLifestyle:household',
          kind: 'requiredLifestyle',
          requestedPlanDollars: 60,
          fundedPlanDollars: 60,
          unfundedPlanDollars: 0,
          identities: [],
        },
      ],
      transferLines: [],
      taxCharacterMetadata: [],
      tolerancePlanDollars: TOLERANCE,
      cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
    })
    expect(published.sourceLines.map((line) => line.id)).toEqual([
      'source:propertySaleProceeds:prop1',
      'source:wages:wage-1',
    ])
    expect(published.useLines.map((line) => line.id)).toEqual([
      'use:requiredLifestyle:household',
      'use:surplusInvestment:unassignedCash',
    ])
    expect(published.reconciliation.status).toBe('reconciled')
  })
})
