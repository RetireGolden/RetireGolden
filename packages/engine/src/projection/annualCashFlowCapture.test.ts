/**
 * Unit coverage for assembleYearCashFlow seams that do not need a full
 * simulatePlan ledger (composite keys, reporting-map character).
 */
import { describe, expect, it } from 'vitest'

import { cashFlowLineIds } from './annualCashFlowIds.js'
import {
  assembleYearCashFlow,
  type AnnualCashFlowPassLocals,
  type AnnualCashFlowPenaltySnapshot,
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
    qcdBeyondRmdCharacterByOccurrence: [],
    qcdOrdinaryFromRmdByOwner: new Map(),
    qcdBasisFromRmdByOwner: new Map(),
    hsaNonqualifiedOrdinaryByAccountId: new Map(),
    employerRothTaxableOrdinaryByAccountId: new Map(),
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
  it('fails closed on an unattributed sub-half-cent shortfall', () => {
    const result = assemble({ shortfallAfterHecm: 0.004 })

    // There is no use inventory to receive the shortfall. Cash still reads
    // 0=0, so the structural missing-inventory diagnostic—not cash slack—must
    // keep the year out of the graph.
    expect(result.reconciliation.cash.differencePlanDollars).toBe(0)
    expect(result.reconciliation.status).toBe('notReconciled')
    expect(result.reconciliation.reasonCodes).toContain('missingRequiredIdentity')
  })

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

  it('attaches interest, dividend, and exempt character on a reinvestedYield transfer', () => {
    const yearSites = createAnnualCashFlowYearSites()
    yearSites.recordDistributedYield({
      accountId: 'tax-1',
      taxableGross: 6_000,
      interest: 4_000,
      ordinaryDividends: 300,
      qualified: 1_700,
      exempt: 1_000,
      reinvest: true,
    })
    const result = assemble({
      yearSites,
      distributedYieldByAccountId: new Map([
        ['tax-1', { gross: 7_000, distributedYieldPct: 7, reinvest: true }],
      ]),
    })
    const transfer = result.transferLines.find(
      (line) => line.id === cashFlowLineIds.transferReinvestedYield('tax-1'),
    )
    expect(transfer).toBeDefined()
    expect(transfer!.debitPlanDollars).toBe(7_000)
    expect(transfer!.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: 4_300 },
      { kind: 'qualifiedDividend', amountPlanDollars: 1_700 },
      { kind: 'taxExemptIncome', amountPlanDollars: 1_000 },
    ])
    expect(result.sourceLines.some((line) => line.kind === 'taxableAccountYield')).toBe(false)
    expect(result.reconciliation.status).toBe('reconciled')
  })

  it('does not consume a duplicate-id use ordinal for a defensive credited-only contribution row', () => {
    const yearSites = createAnnualCashFlowYearSites()
    yearSites.recordContribution({
      destinationAccountId: 'duplicate',
      ownerPersonId: 'p1',
      requested: 0,
      credited: 5,
    })
    yearSites.recordContribution({
      destinationAccountId: 'duplicate',
      ownerPersonId: 'p1',
      requested: 10,
      credited: 10,
    })

    const result = assemble({
      yearSites,
      contributionsTotal: 15,
      requiredLifestyle: 10,
    })
    const transfers = result.transferLines.filter((line) => line.kind === 'employeeContribution')
    expect(transfers).toHaveLength(2)
    expect(transfers[0]!.lineage).toBeUndefined()
    expect(transfers[1]!.lineage).toEqual([{
      lineId: 'use:contribution:duplicate',
      relationship: 'sameDollarLaterStage',
    }])
  })

  it('emits standalone ordinaryIncome metadata when a zero-net sale is recapture-only', () => {
    const yearSites = createAnnualCashFlowYearSites()
    yearSites.recordPropertySaleProceeds({
      propertyAccountId: 'rental-1',
      netProceedsAfterHecm: 0,
      ordinaryGain: 40_000,
      capitalGain: 0,
    })
    const result = assemble({ yearSites })
    expect(result.sourceLines.some((line) =>
      line.id === cashFlowLineIds.sourcePropertySaleProceeds('rental-1'),
    )).toBe(false)
    expect(result.taxCharacterMetadata.find(
      (row) => row.id === cashFlowLineIds.metadataPropertySaleCapitalGain('rental-1'),
    )).toBeUndefined()
    const recapture = result.taxCharacterMetadata.find(
      (row) => row.id === cashFlowLineIds.metadataPropertySaleOrdinaryIncome('rental-1'),
    )
    expect(recapture).toEqual({
      id: 'metadata:ordinaryIncome:propertySale:rental-1',
      taxCharacter: { kind: 'ordinaryIncome', amountPlanDollars: 40_000 },
      identities: [{ entityKind: 'propertyAccount', propertyAccountId: 'rental-1' }],
    })
    expect(result.reconciliation.status).toBe('reconciled')
  })

  it('attaches ordinaryIncome to a need-based HSA withdrawal for the nonqualified excess', () => {
    const result = assemble({
      withdrawalPlanByAccountId: new Map([['hsa-1', 12_500]]),
      ownerPersonIdByAccountId: new Map([['hsa-1', 'p1']]),
      requiredLifestyle: 12_500,
      passLocals: emptyPassLocals({
        hsaNonqualifiedOrdinaryByAccountId: new Map([['hsa-1', 8_750]]),
      }),
    })
    const line = result.sourceLines.find(
      (row) => row.id === cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('hsa-1'),
    )
    expect(line).toBeDefined()
    expect(line!.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: 8_750 },
    ])
    expect(result.reconciliation.status).toBe('reconciled')
  })

  it('carries settled from-RMD QCD taxable and basis, not diverted minus exclusion', () => {
    const result = assemble({
      ownedIraRmdGrossByOwner: new Map([['p1', 10_000]]),
      qcdFromRmdByOwner: new Map([['p1', 10_000]]),
      passLocals: emptyPassLocals({
        qcdExclusionFromRmdByOwner: new Map([['p1', 7_000]]),
        qcdOrdinaryFromRmdByOwner: new Map(),
        qcdBasisFromRmdByOwner: new Map([['p1', 3_000]]),
      }),
    })
    const qcd = result.transferLines.find(
      (line) => line.id === cashFlowLineIds.transferRmdQcd('p1'),
    )
    expect(qcd).toBeDefined()
    expect(qcd!.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 7_000 },
      { kind: 'returnOfBasis', amountPlanDollars: 3_000 },
    ])
    expect(qcd!.taxCharacter?.some((part) => part.kind === 'nonQualifiedQcdOrdinaryIncome')).toBe(false)
    const rmd = result.sourceLines.find(
      (line) => line.id === cashFlowLineIds.sourceOwnedIraRmd('p1'),
    )
    expect(rmd).toBeDefined()
    expect(rmd!.amountPlanDollars).toBe(0)
    expect(rmd!.taxCharacter).toBeUndefined()
    expect(result.reconciliation.status).toBe('reconciled')
  })

  it('charges beyond-RMD QCD excess onto the earliest draws, matching the Form 8606 walk', () => {
    // Independent worksheet: two $5,000 beyond-RMD gifts, one owner.
    // Owner exclusion $6,000; ordinary/excess $4,000.
    // Ledger Form 8606 walk (legacyQcdExcessByOwner over
    // deferredLegacyQcdDistributions in mutation order) charges excess onto
    // the earliest draw first:
    //   draw #1 (ira-1) = $4,000 excess + $1,000 exclusion
    //   draw #2 (ira-2) = $5,000 exclusion
    // Exclusion-first would invert the per-transfer character (owner totals
    // would still match).
    const result = assemble({
      deferredLegacyQcdDistributions: [
        { ownerId: 'p1', amount: 5_000, sourceAccountId: 'ira-1' },
        { ownerId: 'p1', amount: 5_000, sourceAccountId: 'ira-2' },
      ],
      ownerPersonIdByAccountId: new Map([['ira-1', 'p1'], ['ira-2', 'p1']]),
      passLocals: emptyPassLocals({
        qcdExclusionBeyondRmdByOwner: new Map([['p1', 6_000]]),
        qcdOrdinaryBeyondRmdByOwner: new Map([['p1', 4_000]]),
      }),
    })
    const first = result.transferLines.find(
      (line) => line.id === cashFlowLineIds.transferBeyondRmdQcd('p1', 'ira-1'),
    )
    const second = result.transferLines.find(
      (line) => line.id === cashFlowLineIds.transferBeyondRmdQcd('p1', 'ira-2'),
    )
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 1_000 },
      { kind: 'nonQualifiedQcdOrdinaryIncome', amountPlanDollars: 4_000 },
    ])
    expect(second!.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 5_000 },
    ])
    expect(result.reconciliation.status).toBe('reconciled')
  })

  it('attaches recovered cost basis as returnOfBasis alongside gain on a taxable need-based withdrawal', () => {
    // Independent worksheet: 20,000 sale of a 100,000 FMV / 40,000 basis
    // taxable account. Sold fraction 0.2 → recoveredCostBasis 8,000,
    // realizedCapitalGainOrLoss 12,000. Surplus closes the cash identity.
    const result = assemble({
      withdrawalPlanByAccountId: new Map([['brokerage-1', 20_000]]),
      withdrawalPlanTaxableSales: new Map([
        ['brokerage-1', {
          openingFairMarketValue: 100_000,
          openingCostBasis: 40_000,
          saleProceeds: 20_000,
          recoveredCostBasis: 8_000,
          realizedCapitalGainOrLoss: 12_000,
          remainingFairMarketValue: 80_000,
          remainingCostBasis: 32_000,
        }],
      ]),
      surplus: 20_000,
    })
    const line = result.sourceLines.find(
      (row) => row.id === cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('brokerage-1'),
    )
    expect(line).toBeDefined()
    expect(line!.taxCharacter).toEqual([
      { kind: 'capitalGain', amountPlanDollars: 12_000 },
      { kind: 'returnOfBasis', amountPlanDollars: 8_000 },
    ])
    expect(result.reconciliation.status).toBe('reconciled')
  })

  // Defensive seam: assemble forwards plan-level encoded-segment collisions
  // without minting a line, so reconciliation must name the segment directly.
  it('fails every assembled year as duplicateLineId when encoded producer segments collide', () => {
    const encoded = encodeURIComponent('\uFFFD')
    const result = assemble({
      collidingEncodedProducerSegments: [encoded],
    })
    expect(result.reconciliation.status).toBe('notReconciled')
    expect(result.reconciliation.reasonCodes).toContain('duplicateLineId')
    expect(result.reconciliation.diagnostics.filter((row) => row.reasonCode === 'duplicateLineId')).toEqual([
      { reasonCode: 'duplicateLineId', lineIds: [encoded] },
    ])
  })

  it.each([
    {
      name: 'one known penalty class attributes household remainder',
      penalties: 150,
      penaltyLines: [
        {
          attribution: 'account',
          accountId: 'penalty-a',
          penaltyClass: 'traditionalEarly',
          amount: 60,
        },
        {
          attribution: 'account',
          accountId: 'penalty-b',
          penaltyClass: 'traditionalEarly',
          amount: 40,
        },
      ] satisfies readonly AnnualCashFlowPenaltySnapshot[],
      funding: 150,
      expectedStatus: 'reconciled',
      expectedReasons: [] as string[],
      expectedDiagnostics: [] as {
        reasonCode: string
        lineIds: readonly string[]
      }[],
      expectedUses: [
        {
          id: 'use:earlyWithdrawalPenalty:account:penalty-a:traditionalEarly',
          penaltyClass: 'traditionalEarly',
          requestedPlanDollars: 60,
          fundedPlanDollars: 60,
          unfundedPlanDollars: 0,
        },
        {
          id: 'use:earlyWithdrawalPenalty:account:penalty-b:traditionalEarly',
          penaltyClass: 'traditionalEarly',
          requestedPlanDollars: 40,
          fundedPlanDollars: 40,
          unfundedPlanDollars: 0,
        },
        {
          id: 'use:earlyWithdrawalPenalty:household:traditionalEarly',
          penaltyClass: 'traditionalEarly',
          requestedPlanDollars: 50,
          fundedPlanDollars: 50,
          unfundedPlanDollars: 0,
          identities: [],
        },
      ],
    },
    {
      name: 'zero known penalty classes refuse remainder identity',
      penalties: 150,
      penaltyLines: [],
      funding: 0,
      expectedStatus: 'notReconciled',
      expectedReasons: ['missingRequiredIdentity'],
      expectedDiagnostics: [
        { reasonCode: 'missingRequiredIdentity', lineIds: [] },
      ],
      expectedUses: [] as {
        id: string
        penaltyClass?: string
        requestedPlanDollars: number
        fundedPlanDollars: number
        unfundedPlanDollars: number
        identities?: readonly unknown[]
      }[],
    },
    {
      name: 'multiple known penalty classes refuse household remainder',
      penalties: 150,
      penaltyLines: [
        {
          attribution: 'account',
          accountId: 'penalty-a',
          penaltyClass: 'traditionalEarly',
          amount: 60,
        },
        {
          attribution: 'account',
          accountId: 'penalty-b',
          penaltyClass: 'hsaNonMedical',
          amount: 40,
        },
      ] satisfies readonly AnnualCashFlowPenaltySnapshot[],
      funding: 100,
      expectedStatus: 'notReconciled',
      expectedReasons: ['missingRequiredIdentity'],
      expectedDiagnostics: [
        { reasonCode: 'missingRequiredIdentity', lineIds: [] },
      ],
      expectedUses: [
        {
          id: 'use:earlyWithdrawalPenalty:account:penalty-a:traditionalEarly',
          penaltyClass: 'traditionalEarly',
          requestedPlanDollars: 60,
          fundedPlanDollars: 60,
          unfundedPlanDollars: 0,
        },
        {
          id: 'use:earlyWithdrawalPenalty:account:penalty-b:hsaNonMedical',
          penaltyClass: 'hsaNonMedical',
          requestedPlanDollars: 40,
          fundedPlanDollars: 40,
          unfundedPlanDollars: 0,
        },
      ],
    },
  ] as const)(
    'assembles penalty remainder by known-class cardinality: $name',
    ({
      penalties,
      penaltyLines,
      funding,
      expectedStatus,
      expectedReasons,
      expectedDiagnostics,
      expectedUses,
    }) => {
      // Defensive assembler: when no single penalty class can name the
      // household remainder, assemble omits the use line and reports
      // missingRequiredIdentity with empty lineIds rather than inventing a
      // class. Reporting worksheet: 150 − (60 + 40) = 50 household remainder
      // when exactly one class is known; zero/multiple classes must fail closed.
      const result = assemble({
        penalties,
        passLocals: emptyPassLocals({ penaltyLines: [...penaltyLines] }),
        withdrawalPlanByAccountId: funding > 0
          ? new Map([['fund-source', funding]])
          : new Map(),
        ownerPersonIdByAccountId: new Map([
          ['penalty-a', 'owner'],
          ['penalty-b', 'owner'],
          ['fund-source', 'owner'],
        ]),
      })

      const penaltyUses = result.useLines
        .filter((line) => line.kind === 'earlyWithdrawalPenalty')
        .map((line) => ({
          id: line.id,
          ...(line.penaltyClass === undefined
            ? {}
            : { penaltyClass: line.penaltyClass }),
          requestedPlanDollars: line.requestedPlanDollars,
          fundedPlanDollars: line.fundedPlanDollars,
          unfundedPlanDollars: line.unfundedPlanDollars,
          ...(line.identities.length === 0 ? { identities: [] as const } : {}),
        }))

      expect(result.reconciliation.cash.differencePlanDollars).toBe(0)
      expect(result.reconciliation.status).toBe(expectedStatus)
      for (const reason of expectedReasons) {
        expect(result.reconciliation.reasonCodes).toContain(reason)
      }
      expect(
        result.reconciliation.diagnostics.filter(
          (row) => row.reasonCode === 'missingRequiredIdentity',
        ),
      ).toEqual(expectedDiagnostics)
      expect(penaltyUses).toEqual(expectedUses)
      for (const expected of expectedUses) {
        if (expected.penaltyClass === undefined) continue
        const line = result.useLines.find((row) => row.id === expected.id)
        expect(line?.penaltyClass).toBe(expected.penaltyClass)
      }
    },
  )
})

