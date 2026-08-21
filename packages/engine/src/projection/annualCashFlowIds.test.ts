import { describe, expect, it } from 'vitest'

import {
  cashFlowLineIds,
  compareCashFlowLineId,
  encodeCashFlowSegment,
} from './annualCashFlowIds.js'

describe('encodeCashFlowSegment', () => {
  it('is total over lone UTF-16 surrogates: replace with U+FFFD, then encodeURIComponent', () => {
    // Independent oracle: JavaScript encodeURIComponent of U+FFFD, not the
    // engine encoder. Raw encodeURIComponent throws URIError on a lone
    // surrogate; replacement is what makes the encoder total.
    const encodedReplacement = encodeURIComponent('\uFFFD')
    expect(encodedReplacement).toBe('%EF%BF%BD')

    expect(encodeCashFlowSegment('\uD800')).toBe(encodedReplacement)
    expect(encodeCashFlowSegment('\uDBFF')).toBe(encodedReplacement)
    expect(encodeCashFlowSegment('\uDC00')).toBe(encodedReplacement)
    expect(encodeCashFlowSegment('\uDFFF')).toBe(encodedReplacement)
    expect(() => encodeCashFlowSegment('\uD800')).not.toThrow()
    expect(() => encodeURIComponent('\uD800')).toThrow(URIError)
  })

  it('replaces a lone high surrogate before a non-low unit and a trailing lone high', () => {
    expect(encodeCashFlowSegment('\uD800x')).toBe(encodeURIComponent('\uFFFDx'))
    expect(encodeCashFlowSegment('x\uD800')).toBe(encodeURIComponent('x\uFFFD'))
  })

  it('preserves paired surrogates, then encodeURIComponent', () => {
    // U+1F600 GRINNING FACE is the surrogate pair U+D83D U+DE00.
    const grinning = '\uD83D\uDE00'
    expect(grinning).toBe('😀')
    expect(encodeCashFlowSegment(grinning)).toBe(encodeURIComponent(grinning))
    expect(encodeCashFlowSegment(grinning)).toBe('%F0%9F%98%80')
  })

  it('escapes literal colons and percent signs so grammar delimiters stay collision-free', () => {
    expect(encodeCashFlowSegment('a:b')).toBe('a%3Ab')
    expect(encodeCashFlowSegment('a%b')).toBe('a%25b')
    expect(encodeCashFlowSegment('a%b:c')).toBe('a%25b%3Ac')
    expect(encodeCashFlowSegment('%')).toBe('%25')
    expect(encodeCashFlowSegment(':')).toBe('%3A')
  })

  it('collides two IDs that differ only by U+FFFD replacement (duplicate detection is the safety valve)', () => {
    expect(encodeCashFlowSegment('\uD800')).toBe(encodeCashFlowSegment('\uFFFD'))
    expect(cashFlowLineIds.sourceWages('\uD800')).toBe(cashFlowLineIds.sourceWages('\uFFFD'))
  })

  it('leaves unreserved ASCII unchanged', () => {
    expect(encodeCashFlowSegment('wage-stream_1')).toBe('wage-stream_1')
  })
})

describe('cashFlowLineIds', () => {
  it('matches each grammar row in DOCS/features/year-cash-flow.md literally', () => {
    // Expected strings are the contract grammar with E(value) already applied,
    // not read back from the builder. Unreserved ids are copied through;
    // colon and percent use the encodeURIComponent escapes the contract names.
    const rows: readonly (readonly [string, string])[] = [
      [cashFlowLineIds.sourceWages('w1'), 'source:wages:w1'],
      [cashFlowLineIds.sourceSocialSecurity('ss1'), 'source:socialSecurity:ss1'],
      [cashFlowLineIds.sourceRecurringIncome('r1'), 'source:recurringIncome:r1'],
      [cashFlowLineIds.sourceOneTimeIncome('o1'), 'source:oneTimeIncome:o1'],
      [cashFlowLineIds.sourcePension('pen1'), 'source:pension:pen1'],
      [cashFlowLineIds.sourceAnnuityPayment('ann1'), 'source:annuityPayment:ann1'],
      [cashFlowLineIds.sourceTipsLadderCash('lad1'), 'source:tipsLadderCash:lad1'],
      [cashFlowLineIds.sourceTaxableAccountYield('tax1'), 'source:taxableAccountYield:tax1'],
      [cashFlowLineIds.sourceTaxExemptInterest('tax1'), 'source:taxExemptInterest:tax1'],
      [cashFlowLineIds.sourcePropertySaleProceeds('prop1'), 'source:propertySaleProceeds:prop1'],
      [cashFlowLineIds.sourceLegacyPropertySaleDeposit('prop1'), 'source:legacyPropertySaleDeposit:prop1'],
      [cashFlowLineIds.sourceSeppDistribution('ira1'), 'source:seppDistribution:ira1'],
      [cashFlowLineIds.sourceInheritedAccountDistribution('inh1'), 'source:inheritedAccountDistribution:inh1'],
      [cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('ira1'), 'source:needBasedPortfolioWithdrawal:ira1'],
      [cashFlowLineIds.sourceEmployerPlanRmd('401k1'), 'source:requiredMinimumDistribution:account:401k1'],
      [cashFlowLineIds.sourceOwnedIraRmd('p1'), 'source:requiredMinimumDistribution:ownedIraPool:p1'],
      [cashFlowLineIds.sourceRetirementActionWithdrawal('act1', 'alloc1'), 'source:retirementActionWithdrawal:act1:alloc1'],
      [cashFlowLineIds.sourceHecmCoordinatedDraw('prop1'), 'source:hecmCoordinatedDraw:prop1'],
      [cashFlowLineIds.sourceHecmBackstopDraw('prop1'), 'source:hecmBackstopDraw:prop1'],
      [cashFlowLineIds.sourceLifeInsuranceDeathBenefit('pol1'), 'source:lifeInsuranceDeathBenefit:pol1'],

      [cashFlowLineIds.useRequiredLifestyle(), 'use:requiredLifestyle:household'],
      [cashFlowLineIds.useTargetLifestyle(), 'use:targetLifestyle:household'],
      [cashFlowLineIds.useIdealLifestyle(), 'use:idealLifestyle:household'],
      [cashFlowLineIds.useExcessLifestyle(), 'use:excessLifestyle:household'],
      [cashFlowLineIds.useOneTimeGoal('g1'), 'use:oneTimeGoal:g1'],
      [cashFlowLineIds.useDebtService('debt1'), 'use:debtService:debt1'],
      [cashFlowLineIds.usePropertyCosts('prop1'), 'use:propertyCosts:prop1'],
      [cashFlowLineIds.useInsurancePremium('pol1'), 'use:insurancePremium:pol1'],
      [cashFlowLineIds.useHealthcare(), 'use:healthcare:household'],
      [cashFlowLineIds.useLongTermCare('p1'), 'use:longTermCare:p1'],
      [cashFlowLineIds.useSettledTax(), 'use:settledTax:household'],
      [cashFlowLineIds.usePenaltyAccount('ira1', 'traditionalEarly'), 'use:earlyWithdrawalPenalty:account:ira1:traditionalEarly'],
      [cashFlowLineIds.usePenaltyAccount('hsa1', 'hsaNonMedical'), 'use:earlyWithdrawalPenalty:account:hsa1:hsaNonMedical'],
      [cashFlowLineIds.usePenaltyAccount('roth401k', 'rothEarly'), 'use:earlyWithdrawalPenalty:account:roth401k:rothEarly'],
      [cashFlowLineIds.usePenaltyRothPool('p1'), 'use:earlyWithdrawalPenalty:rothPool:p1:rothEarly'],
      [cashFlowLineIds.usePenaltyHousehold('traditionalEarly'), 'use:earlyWithdrawalPenalty:household:traditionalEarly'],
      [cashFlowLineIds.useContribution('ira1'), 'use:contribution:ira1'],
      [cashFlowLineIds.useSurplusAccount('cash1'), 'use:surplusInvestment:account:cash1'],
      [cashFlowLineIds.useSurplusUnassigned(), 'use:surplusInvestment:unassignedCash'],

      [cashFlowLineIds.transferNamedRothConversion('act1', 'alloc1'), 'transfer:namedRothConversion:act1:alloc1'],
      [cashFlowLineIds.transferAggregateRothConversion('trad1', 'roth1'), 'transfer:aggregateRothConversion:trad1:roth1'],
      [cashFlowLineIds.transferNamedQcd('act1', 'alloc1'), 'transfer:qualifiedCharitableDistribution:named:act1:alloc1'],
      [cashFlowLineIds.transferBeyondRmdQcd('p1', 'ira1'), 'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira1'],
      [cashFlowLineIds.transferRmdQcd('p1'), 'transfer:qualifiedCharitableDistribution:rmd:p1'],
      [cashFlowLineIds.transferEmployeeContribution('ira1'), 'transfer:employeeContribution:ira1'],
      [cashFlowLineIds.transferEmployerMatch('401k1'), 'transfer:employerMatch:401k1'],
      [cashFlowLineIds.transferReinvestedYield('tax1'), 'transfer:reinvestedYield:tax1'],
      [cashFlowLineIds.transferAnnuityPurchase('ann1'), 'transfer:annuityPurchase:ann1'],
      [cashFlowLineIds.transferTipsLadderPurchase('lad1'), 'transfer:tipsLadderPurchase:lad1'],
      [cashFlowLineIds.transferPensionRollover('pen1', 'ira1'), 'transfer:pensionRollover:pen1:ira1'],
      [cashFlowLineIds.transferSurplusAccount('cash1'), 'transfer:surplusInvestment:account:cash1'],
      [cashFlowLineIds.transferSurplusUnassigned(), 'transfer:surplusInvestment:unassignedCash'],

      [cashFlowLineIds.metadataTipsPhantomOid('lad1'), 'metadata:tipsPhantomOidIncome:lad1'],
      [cashFlowLineIds.metadataTaxExemptInterestAttestedExcess(), 'metadata:taxExemptInterestAttestedExcess:household'],
      [cashFlowLineIds.metadataForeignExclusionAddback(), 'metadata:foreignExclusionAddback:household'],
      [cashFlowLineIds.metadataRothPoolOrdinaryIncome('p1'), 'metadata:ordinaryIncome:rothPool:p1'],
      [cashFlowLineIds.metadataRebalancingCapitalGain('tax1'), 'metadata:capitalGain:rebalancing:tax1'],
      [cashFlowLineIds.metadataPropertySaleCapitalGain('home-1'), 'metadata:capitalGain:propertySale:home-1'],
    ]
    for (const [actual, expected] of rows) {
      expect(actual).toBe(expected)
    }
  })

  it('encodes dynamic segments that contain a colon or percent', () => {
    expect(cashFlowLineIds.sourceWages('a:b')).toBe('source:wages:a%3Ab')
    expect(cashFlowLineIds.useContribution('a%b')).toBe('use:contribution:a%25b')
    expect(cashFlowLineIds.sourceRetirementActionWithdrawal('a:b', 'c%d'))
      .toBe('source:retirementActionWithdrawal:a%3Ab:c%25d')
  })
})

describe('compareCashFlowLineId', () => {
  it('orders by JavaScript UTF-16 code-unit comparison, not locale collation', () => {
    expect(compareCashFlowLineId('a', 'a')).toBe(0)
    expect(compareCashFlowLineId('A', 'a')).toBe(-1)
    expect(compareCashFlowLineId('a', 'A')).toBe(1)
    expect(compareCashFlowLineId('source:wages:a', 'source:wages:b')).toBe(-1)
    // '%' (U+0025) precedes ':' (U+003A) in code-unit order.
    expect(compareCashFlowLineId('a%3Ab', 'a:b')).toBe(-1)
    expect(['b', 'a', 'A'].sort(compareCashFlowLineId)).toEqual(['A', 'a', 'b'])
  })
})
