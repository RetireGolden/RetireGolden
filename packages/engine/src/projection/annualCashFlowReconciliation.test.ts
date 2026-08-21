import { describe, expect, it } from 'vitest'

import { asAccountId, asPersonId } from '../actions/identity.js'
import { CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS } from './annualCashFlowCapture.js'
import {
  type CashFlowIncompleteInventoryProbes,
  reconcileYearCashFlow,
} from './annualCashFlowReconciliation.js'
import type {
  YearCashFlowSourceLine,
  YearCashFlowTransferLine,
  YearCashFlowUseLine,
} from './types.js'

const TOLERANCE = CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS

function probes(
  overrides: Partial<CashFlowIncompleteInventoryProbes> = {},
): CashFlowIncompleteInventoryProbes {
  return {
    incomesTotal: 0,
    taxableYieldReinvested: 0,
    propertySaleProceedsTotal: 0,
    rmdTotal: 0,
    seppTotal: 0,
    inheritedTotal: 0,
    needBasedWithdrawalTotal: 0,
    retirementActionProceeds: 0,
    hecmDraw: 0,
    hecmShortfallDraw: 0,
    tax: 0,
    penalties: 0,
    contributionsTotal: 0,
    employerMatchTotal: 0,
    surplus: 0,
    ...overrides,
  }
}

function reconcile(opts: {
  sourceLines?: readonly YearCashFlowSourceLine[]
  useLines?: readonly YearCashFlowUseLine[]
  transferLines?: readonly YearCashFlowTransferLine[]
  probes?: CashFlowIncompleteInventoryProbes
}) {
  return reconcileYearCashFlow({
    sourceLines: opts.sourceLines ?? [],
    useLines: opts.useLines ?? [],
    transferLines: opts.transferLines ?? [],
    probes: opts.probes ?? probes(),
    tolerancePlanDollars: TOLERANCE,
  })
}

describe('reconcileYearCashFlow stage-1 stub', () => {
  it('reconciles the 0=0 empty year', () => {
    const result = reconcile({})
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).toEqual([])
    expect(result.diagnostics).toEqual([])
    expect(result.tolerancePlanDollars).toBe(1e-6)
    expect(result.cash.sourceTotalPlanDollars).toBe(0)
    expect(result.cash.destinationTotalPlanDollars).toBe(0)
    expect(result.cash.differencePlanDollars).toBe(0)
    expect(result.uses.differencePlanDollars).toBe(0)
    expect(result.transfers.differencePlanDollars).toBe(0)
  })

  it('flags a wages-like year via the spendable-source probe, not incomes.total 1:1', () => {
    // Worksheet: wages $50,000, no reinvested yield, no property sale, empty
    // published spendableSource lines. Probe scalar = 50,000 - 0 + 0.
    const result = reconcile({
      probes: probes({ incomesTotal: 50_000 }),
    })
    expect(result.status).toBe('notReconciled')
    expect(result.reasonCodes).toContain('unsupportedLedgerTerm')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        reasonCode: 'unsupportedLedgerTerm',
        lineIds: [],
        expectedPlanDollars: 50_000,
        actualPlanDollars: 0,
      }),
    ])
    // Published cash identity is still 0=0; the year is notReconciled because
    // the inventory is incomplete, not because the empty arrays fail to balance.
    expect(result.cash.differencePlanDollars).toBe(0)
    expect(result.reasonCodes).not.toContain('cashIdentityMismatch')
  })

  it('flags a reinvest-only year because reinvestedYield transfers are empty, not because incomesTotal is nonzero', () => {
    // Worksheet: taxable yield $4,000, all reinvested. incomes.total includes
    // that yield; the spendable-source probe subtracts it (4,000 - 4,000 = 0)
    // so empty spendable sources are correct. Until stage 4 emits the
    // reinvestedYield transfer, the reinvest probe is the nonempty one.
    const emptyTransfers = reconcile({
      probes: probes({ incomesTotal: 4_000, taxableYieldReinvested: 4_000 }),
    })
    expect(emptyTransfers.status).toBe('notReconciled')
    expect(emptyTransfers.reasonCodes).toEqual(['unsupportedLedgerTerm'])
    expect(emptyTransfers.diagnostics).toHaveLength(1)
    expect(emptyTransfers.diagnostics[0]).toEqual(expect.objectContaining({
      reasonCode: 'unsupportedLedgerTerm',
      expectedPlanDollars: 4_000,
    }))
    expect(emptyTransfers.cash.spendableSourcesPlanDollars).toBe(0)

    // Discriminator: the same incomesTotal with a published reinvestedYield
    // transfer of the gross must reconcile. A 1:1 incomes.total vs spendable
    // sources probe would still fail this year.
    const accountId = asAccountId('tax1')
    const withTransfer = reconcile({
      probes: probes({ incomesTotal: 4_000, taxableYieldReinvested: 4_000 }),
      transferLines: [
        {
          id: 'transfer:reinvestedYield:tax1',
          kind: 'reinvestedYield',
          source: { entityKind: 'accountYield', accountId },
          destination: { entityKind: 'account', accountId },
          debitPlanDollars: 4_000,
          creditPlanDollars: 4_000,
          identities: [],
        },
      ],
    })
    expect(withTransfer.status).toBe('reconciled')
    expect(withTransfer.reasonCodes).toEqual([])
  })

  it('flags nonempty needBasedWithdrawalTotal with empty need-based lines, and never probes withdrawals.total', () => {
    // withdrawals.total folds RMD+SEPP+inherited+actions+need-based. This year
    // has only need-based $8,000; a withdrawals.total probe is not a field
    // the stub accepts, and RMD/SEPP/inherited/action scalars stay 0.
    const result = reconcile({
      probes: probes({ needBasedWithdrawalTotal: 8_000 }),
    })
    expect(result.status).toBe('notReconciled')
    expect(result.diagnostics[0]?.expectedPlanDollars).toBe(8_000)

    const withdrawalsTotalWouldBe = 12_000
    const noNeedBased = reconcile({
      probes: probes({
        // If the stub probed withdrawals.total, this leftover would flag.
        needBasedWithdrawalTotal: 0,
        rmdTotal: 0,
        seppTotal: 0,
        inheritedTotal: 0,
        retirementActionProceeds: 0,
      }),
    })
    expect(withdrawalsTotalWouldBe).toBe(12_000)
    expect(noNeedBased.status).toBe('reconciled')
  })

  it('probes coordinated and backstop HECM separately and does not treat hecmDraw as a third group', () => {
    // Worksheet: coordinated $50 + backstop $50. hecmDraw (the YearResult
    // scalar) is 100 because it already includes hecmShortfallDraw. Matching
    // published lines for both kinds must not fire unsupportedLedgerTerm; a
    // third 1:1 hecmDraw probe against an empty "hecmDraw" kind would.
    const propertyId = asAccountId('prop1')
    const result = reconcile({
      probes: probes({ hecmDraw: 100, hecmShortfallDraw: 50, surplus: 100 }),
      sourceLines: [
        {
          id: 'source:hecmCoordinatedDraw:prop1',
          kind: 'hecmCoordinatedDraw',
          role: 'loanProceeds',
          amountPlanDollars: 50,
          identities: [{ entityKind: 'propertyAccount', propertyAccountId: propertyId }],
        },
        {
          id: 'source:hecmBackstopDraw:prop1',
          kind: 'hecmBackstopDraw',
          role: 'loanProceeds',
          amountPlanDollars: 50,
          identities: [{ entityKind: 'propertyAccount', propertyAccountId: propertyId }],
        },
      ],
      useLines: [
        {
          id: 'use:surplusInvestment:unassignedCash',
          kind: 'surplusInvestment',
          requestedPlanDollars: 100,
          fundedPlanDollars: 100,
          unfundedPlanDollars: 0,
          identities: [],
        },
      ],
    })
    expect(result.status).toBe('reconciled')
    expect(result.reasonCodes).not.toContain('unsupportedLedgerTerm')
  })

  it('treats an owned-IRA RMD as complete when the RMD-diverted QCD transfer is present even without a source line', () => {
    // Stages 1–4: the RMD group is RMD portfolioFunding lines PLUS QCD
    // transfers with divertedBeforeHouseholdCash lineage. Gross $10,000 all
    // diverted still has a nonempty group.
    const withDiversion = reconcile({
      probes: probes({ rmdTotal: 10_000 }),
      transferLines: [
        {
          id: 'transfer:qualifiedCharitableDistribution:rmd:p1',
          kind: 'qualifiedCharitableDistribution',
          source: { entityKind: 'requiredDistributionPool', personId: asPersonId('p1') },
          destination: { entityKind: 'charity' },
          debitPlanDollars: 10_000,
          creditPlanDollars: 10_000,
          identities: [],
          lineage: [{ lineId: 'source:requiredMinimumDistribution:ownedIraPool:p1', relationship: 'divertedBeforeHouseholdCash' }],
        },
      ],
    })
    expect(withDiversion.reasonCodes).not.toContain('unsupportedLedgerTerm')
    expect(withDiversion.status).toBe('reconciled')
  })

  it('fails closed on identity noise above 1e-6 and ignores 1e-7 association noise', () => {
    const propertyId = asAccountId('prop1')
    const noisy = reconcile({
      sourceLines: [
        {
          id: 'source:propertySaleProceeds:prop1',
          kind: 'propertySaleProceeds',
          role: 'spendableSource',
          amountPlanDollars: 1e-7,
          identities: [{ entityKind: 'propertyAccount', propertyAccountId: propertyId }],
        },
      ],
    })
    expect(noisy.status).toBe('reconciled')
    expect(Math.abs(noisy.cash.differencePlanDollars)).toBe(1e-7)

    const mismatch = reconcile({
      sourceLines: [
        {
          id: 'source:propertySaleProceeds:prop1',
          kind: 'propertySaleProceeds',
          role: 'spendableSource',
          amountPlanDollars: 1e-6 + 1e-12,
          identities: [{ entityKind: 'propertyAccount', propertyAccountId: propertyId }],
        },
      ],
    })
    expect(mismatch.status).toBe('notReconciled')
    expect(mismatch.reasonCodes).toContain('cashIdentityMismatch')
  })
})
