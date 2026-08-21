/**
 * Unit coverage for assembleYearCashFlow seams that do not need a full
 * simulatePlan ledger (composite keys, reporting-map character).
 */
import { describe, expect, it } from 'vitest'

import { cashFlowLineIds } from './annualCashFlowIds.js'
import {
  assembleYearCashFlow,
  type AnnualCashFlowPassLocals,
  type AssembleYearCashFlowInput,
} from './annualCashFlowCapture.js'
import { createAnnualCashFlowYearSites } from './annualCashFlowYearSites.js'

function emptyPassLocals(
  overrides: Partial<AnnualCashFlowPassLocals> = {},
): AnnualCashFlowPassLocals {
  return {
    seppByAccountId: new Map(),
    hecmCoordinatedByProperty: new Map(),
    hecmBackstopByProperty: new Map(),
    annuityBasisReturnByAccountId: new Map(),
    rmdNontaxableByOwner: new Map(),
    seppNontaxableByAccountId: new Map(),
    penaltyLines: [],
    rothPoolTaxableOrdinaryByPersonId: new Map(),
    legacyPropertySaleDeposits: [],
    deathBenefits: [],
    surplusDestination: { entityKind: 'unassignedCash' },
    qcdExclusionFromRmdByOwner: new Map(),
    qcdExclusionBeyondRmdByOwner: new Map(),
    qcdOrdinaryBeyondRmdByOwner: new Map(),
    ...overrides,
  }
}

function assemble(overrides: Partial<AssembleYearCashFlowInput> = {}) {
  return assembleYearCashFlow({
    yearSites: createAnnualCashFlowYearSites(),
    passLocals: emptyPassLocals(),
    socialSecurityStreams: [],
    rmdTakeByAccount: new Map(),
    ownedIraRmdGrossByOwner: new Map(),
    qcdFromRmdByOwner: new Map(),
    qcdGrossByOwner: new Map(),
    deferredLegacyQcdDistributions: [],
    employerPlanAccountIds: new Set(),
    inheritedTraditionalAccountIds: new Set(),
    withdrawalPlanByAccountId: new Map(),
    withdrawalPlanTaxableSales: new Map(),
    iraCharacterFinal: { nontaxable: 0, taxableBySourceAccountId: new Map() },
    inheritedYearEvidence: [],
    retirementActionExecution: undefined,
    rothConversionActionExecution: undefined,
    qcdActionExecution: undefined,
    namedRothConversionExecuted: 0,
    namedRothConversionNontaxable: 0,
    conversionNontaxable: 0,
    rothConversion: 0,
    aggregateConversionDraws: [],
    distributedYieldByAccountId: new Map(),
    ownerPersonIdByAccountId: new Map(),
    employerAllocationByOwner: new Map(),
    desiredByAccountId: new Map(),
    yearTaxExemptInterest: 0,
    generatedTaxExemptInterest: 0,
    acaForeignExclusionAddback: 0,
    requiredLifestyle: 0,
    targetLifestyle: 0,
    targetLifestyleFunded: 0,
    idealLifestyle: 0,
    idealLifestyleFunded: 0,
    excessLifestyle: 0,
    excessLifestyleFunded: 0,
    healthcare: 0,
    shortfallAfterHecm: 0,
    tax: 0,
    penalties: 0,
    surplus: 0,
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
    contributionsTotal: 0,
    employerMatchTotal: 0,
    ...overrides,
  })
}

describe('assembleYearCashFlow', () => {
  it('does not merge aggregate-conversion pairs whose raw NUL keys collide', () => {
    // Schema-valid IDs may contain NUL. Concatenating source + NUL + dest
    // maps both of these distinct pairs onto "a\0b\0c":
    //   "a\u0000b" → "c"
    //   "a" → "b\u0000c"
    // The published line-ID builder encodes each segment, so they stay distinct.
    const result = assemble({
      aggregateConversionDraws: [
        {
          sourceAccountId: 'a\u0000b',
          destinationAccountId: 'c',
          ownerPersonId: 'p1',
          amount: 1_000,
          nontaxable: 0,
        },
        {
          sourceAccountId: 'a',
          destinationAccountId: 'b\u0000c',
          ownerPersonId: 'p2',
          amount: 2_000,
          nontaxable: 0,
        },
      ],
    })

    const firstId = cashFlowLineIds.transferAggregateRothConversion('a\u0000b', 'c')
    const secondId = cashFlowLineIds.transferAggregateRothConversion('a', 'b\u0000c')
    expect(firstId).not.toBe(secondId)
    expect(firstId).toBe('transfer:aggregateRothConversion:a%00b:c')
    expect(secondId).toBe('transfer:aggregateRothConversion:a:b%00c')

    const first = result.transferLines.find((line) => line.id === firstId)
    const second = result.transferLines.find((line) => line.id === secondId)
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.debitPlanDollars).toBe(1_000)
    expect(second!.debitPlanDollars).toBe(2_000)
    expect(result.transferLines.filter((line) => line.kind === 'aggregateRothConversion')).toHaveLength(2)
    expect(result.reconciliation.status).toBe('reconciled')
  })

  it('emits standalone property-sale capitalGain metadata when net proceeds are zero', () => {
    const yearSites = createAnnualCashFlowYearSites()
    yearSites.recordPropertySaleProceeds({
      propertyAccountId: 'home-1',
      netProceedsAfterHecm: 0,
      ordinaryGain: 0,
      capitalGain: 50_000,
    })
    const result = assemble({ yearSites })
    expect(result.sourceLines.some((line) =>
      line.id === cashFlowLineIds.sourcePropertySaleProceeds('home-1'),
    )).toBe(false)
    const gain = result.taxCharacterMetadata.find(
      (row) => row.id === cashFlowLineIds.metadataPropertySaleCapitalGain('home-1'),
    )
    expect(gain).toEqual({
      id: 'metadata:capitalGain:propertySale:home-1',
      taxCharacter: { kind: 'capitalGain', amountPlanDollars: 50_000 },
      identities: [{ entityKind: 'propertyAccount', propertyAccountId: 'home-1' }],
    })
    expect(result.reconciliation.status).toBe('reconciled')
  })
})

