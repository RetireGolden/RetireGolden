import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import {
  computeRmdShortfallExcise,
  rmdCorrectionWindowEnd,
  rmdShortfallObligationId,
  type RmdApplicablePlan,
  type RmdShortfallObligation,
  type RmdShortfallReliefElection,
} from './rmdShortfallExcise.js'

const OWNED_IRAS: RmdApplicablePlan = {
  kind: 'ownedTraditionalIras',
  payeePersonId: 'owner',
}

const EMPLOYER_PLAN: RmdApplicablePlan = {
  kind: 'employerPlan',
  accountId: 'employer-plan',
}

function obligation(
  overrides: Partial<RmdShortfallObligation> = {},
): RmdShortfallObligation {
  return {
    obligationId: rmdShortfallObligationId(OWNED_IRAS, 2026),
    distributionCalendarYear: 2026,
    taxYear: 2026,
    taxImposedOn: '2026-12-31',
    applicablePlan: OWNED_IRAS,
    requirementKind: 'ownedAnnual',
    requiredAmount: 10_000,
    distributedByDeadline: 8_000,
    ...overrides,
  }
}

function corrected(
  overrides: Partial<NonNullable<RmdShortfallReliefElection['correctiveDistribution']>> = {},
): RmdShortfallReliefElection {
  return {
    obligationId: rmdShortfallObligationId(OWNED_IRAS, 2026),
    correctiveDistribution: {
      amount: 2_000,
      receivedOn: '2027-03-01',
      sourceApplicablePlan: OWNED_IRAS,
      form5329FiledOn: '2027-04-15',
      returnReflectsReducedTax: true,
      ...overrides,
    },
  }
}

describeRule('irc-4974-rmd-shortfall-excise-tax', {
  readings: {
    statuteTaxesOnlyTheTwoThousandDollarShortfall: 500,
    rejectedTaxOnTheWholeRequiredAmount: 2_500,
  },
  accepted: 'statuteTaxesOnlyTheTwoThousandDollarShortfall',
  note: 'partial shortfall',
}, ({ accepted, readings }) => {
  it('applies 25 percent to required minus timely distributed', () => {
    const result = computeRmdShortfallExcise(obligation())

    expect(result.shortfall).toBe(2_000)
    expect(result.tax).toBe(accepted)
    expect(result.tax).not.toBe(readings.rejectedTaxOnTheWholeRequiredAmount)
    expect(result.reason).toBe('default25Percent')
  })
})

describeRule('irc-4974-rmd-shortfall-excise-tax', {
  readings: {
    statuteReducesAQualifiedCorrectionToTenPercent: 200,
    rejectedDefaultRateAfterBothCorrectionConditions: 500,
  },
  accepted: 'statuteReducesAQualifiedCorrectionToTenPercent',
  note: '10 percent correction path',
}, ({ accepted, readings }) => {
  it('requires the corrective distribution and the reflecting return inside the window', () => {
    const result = computeRmdShortfallExcise(obligation(), corrected())

    expect(result.tax).toBe(accepted)
    expect(result.tax).not.toBe(readings.rejectedDefaultRateAfterBothCorrectionConditions)
    expect(result.reason).toBe('corrected10Percent')
  })

  it.each([
    ['partial corrective distribution', corrected({ amount: 1_999.99 })],
    ['wrong-plan corrective distribution', corrected({ sourceApplicablePlan: EMPLOYER_PLAN })],
    ['return does not reflect the reduced tax', corrected({ returnReflectsReducedTax: false })],
    ['distribution after an earlier notice of deficiency', corrected({
      noticeOfDeficiencyMailedOn: '2027-02-15',
    })],
    ['return after an earlier assessment', corrected({
      assessedOn: '2027-03-15',
      form5329FiledOn: '2027-04-15',
    })],
  ])('keeps the 25 percent default for a %s', (_label, relief) => {
    expect(computeRmdShortfallExcise(obligation(), relief).tax).toBe(500)
  })

  it('uses the earliest statutory correction-window endpoint', () => {
    expect(rmdCorrectionWindowEnd(2026, {})).toBe('2028-12-31')
    expect(rmdCorrectionWindowEnd(2026, {
      noticeOfDeficiencyMailedOn: '2028-03-01',
      assessedOn: '2027-11-15',
    })).toBe('2027-11-15')
  })
})

describeRule('irc-4974-rmd-shortfall-excise-tax', {
  readings: {
    statuteLeavesTaxInPlaceWhenWaiverIsDenied: 500,
    rejectedAutomaticZeroForAReasonableErrorRequest: 0,
  },
  accepted: 'statuteLeavesTaxInPlaceWhenWaiverIsDenied',
  note: 'discretionary waiver denied versus granted',
}, ({ accepted, readings }) => {
  it('does not turn a waiver request or denial into a grant', () => {
    for (const discretionaryWaiver of ['requested', 'denied'] as const) {
      const result = computeRmdShortfallExcise(obligation(), {
        obligationId: obligation().obligationId,
        discretionaryWaiver,
      })
      expect(result.tax).toBe(accepted)
      expect(result.tax).not.toBe(readings.rejectedAutomaticZeroForAReasonableErrorRequest)
    }
  })

  it('uses zero only for an explicit modeled grant', () => {
    const result = computeRmdShortfallExcise(obligation(), {
      obligationId: obligation().obligationId,
      discretionaryWaiver: 'granted',
    })
    expect(result.tax).toBe(0)
    expect(result.reason).toBe('discretionaryWaiverGranted')
  })
})

describe('historical §4974 rate boundary', () => {
  it('uses the former 50 percent default and rejects the modern 10 percent path before 2023', () => {
    const historical = obligation({
      obligationId: rmdShortfallObligationId(OWNED_IRAS, 2022),
      distributionCalendarYear: 2022,
      taxYear: 2022,
      taxImposedOn: '2022-12-31',
    })
    const result = computeRmdShortfallExcise(historical, {
      ...corrected(),
      obligationId: historical.obligationId,
    })

    expect(result.tax).toBe(1_000)
    expect(result.rate).toBe(0.50)
    expect(result.reason).toBe('preSecure2Default50Percent')
  })
})

describe('final-regulation automatic waivers', () => {
  it('waives an EDB default-to-life-expectancy miss after a timely 10-year election', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const inheritedObligation = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2026),
      applicablePlan: inherited,
      requirementKind: 'inheritedAnnualLifeExpectancy',
    })
    const result = computeRmdShortfallExcise(inheritedObligation, {
      obligationId: inheritedObligation.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2024,
        electionMadeOn: '2033-12-31',
        ownerDiedBeforeRequiredBeginningDate: true,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })
    expect(result.tax).toBe(0)
    expect(result.reason).toBe('automaticEdbTenYearElectionWaiver')
  })

  it('does not apply the EDB election waiver after an owner dies on or after the RBD', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const inheritedObligation = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2026),
      applicablePlan: inherited,
      requirementKind: 'inheritedAnnualLifeExpectancy',
    })
    const result = computeRmdShortfallExcise(inheritedObligation, {
      obligationId: inheritedObligation.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2024,
        electionMadeOn: '2033-12-31',
        ownerDiedBeforeRequiredBeginningDate: false,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })
    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })

  it('does not back-port the final-regulation automatic waivers before 2025', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const inheritedObligation = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2024),
      distributionCalendarYear: 2024,
      taxYear: 2024,
      taxImposedOn: '2024-12-31',
      applicablePlan: inherited,
      requirementKind: 'inheritedAnnualLifeExpectancy',
    })
    const result = computeRmdShortfallExcise(inheritedObligation, {
      obligationId: inheritedObligation.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2022,
        electionMadeOn: '2024-12-31',
        ownerDiedBeforeRequiredBeginningDate: true,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })
    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })

  it('waives a year-of-death miss corrected by the later automatic deadline', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const yod = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2026),
      applicablePlan: inherited,
      requirementKind: 'inheritedYearOfDeath',
    })
    const result = computeRmdShortfallExcise(yod, {
      obligationId: yod.obligationId,
      automaticWaiver: {
        kind: 'yearOfDeath',
        ownerDeathYear: 2026,
        beneficiaryReturnDueDateIncludingExtensions: '2027-10-15',
        correctiveDistribution: {
          amount: 2_000,
          receivedOn: '2027-12-31',
          sourceApplicablePlan: inherited,
        },
      },
    })
    expect(result.tax).toBe(0)
    expect(result.reason).toBe('automaticYearOfDeathWaiver')
  })

  it.each([
    ['the election year itself', 2033, 'inheritedAnnualLifeExpectancy' as const],
    ['a later year', 2034, 'inheritedAnnualLifeExpectancy' as const],
    ['a final-sweep obligation', 2032, 'inheritedFinalSweep' as const],
    ['a year-of-death obligation', 2026, 'inheritedYearOfDeath' as const],
  ])('does not extend an EDB ten-year election waiver to %s', (_label, taxYear, requirementKind) => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(inherited, taxYear),
      distributionCalendarYear: taxYear,
      taxYear,
      taxImposedOn: `${taxYear}-12-31`,
      applicablePlan: inherited,
      requirementKind,
    })
    const result = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2024,
        electionMadeOn: '2033-12-31',
        ownerDiedBeforeRequiredBeginningDate: true,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })

    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })
})

describe('applicable-plan and evidence-key fail-closed checks', () => {
  it('allows inherited-IRA correction only from the same beneficiary/decedent group', () => {
    const targetPlan: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent-a',
      iraType: 'traditional',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(targetPlan, 2026),
      applicablePlan: targetPlan,
    })
    const relief = (sourceApplicablePlan: RmdApplicablePlan): RmdShortfallReliefElection => ({
      obligationId: target.obligationId,
      correctiveDistribution: {
        amount: 2_000,
        receivedOn: '2027-03-01',
        sourceApplicablePlan,
        form5329FiledOn: '2027-04-15',
        returnReflectsReducedTax: true,
      },
    })

    expect(computeRmdShortfallExcise(target, relief({
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent-a',
      iraType: 'traditional',
    })).tax).toBe(200)
    expect(computeRmdShortfallExcise(target, relief({
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent-b',
      iraType: 'traditional',
    })).tax).toBe(500)
  })

  it('keeps an unidentified inherited IRA distinct from an explicit lookalike decedent id', () => {
    const accountOnly: RmdApplicablePlan = {
      kind: 'inheritedIraAccount',
      payeePersonId: 'beneficiary',
      accountId: 'ira-a',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(accountOnly, 2026),
      applicablePlan: accountOnly,
    })
    const result = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      correctiveDistribution: {
        amount: 2_000,
        receivedOn: '2027-03-01',
        sourceApplicablePlan: {
          kind: 'inheritedIras',
          payeePersonId: 'beneficiary',
          decedentId: 'account:ira-a',
          iraType: 'traditional',
        },
        form5329FiledOn: '2027-04-15',
        returnReflectsReducedTax: true,
      },
    })

    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })

  it('aggregates 403(b) correction sources per payee but not across payees', () => {
    const targetPlan: RmdApplicablePlan = {
      kind: 'aggregable403bPlans',
      payeePersonId: 'owner',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(targetPlan, 2026),
      applicablePlan: targetPlan,
    })
    const relief = (payeePersonId: string): RmdShortfallReliefElection => ({
      obligationId: target.obligationId,
      correctiveDistribution: {
        amount: 2_000,
        receivedOn: '2027-03-01',
        sourceApplicablePlan: { kind: 'aggregable403bPlans', payeePersonId },
        form5329FiledOn: '2027-04-15',
        returnReflectsReducedTax: true,
      },
    })

    expect(computeRmdShortfallExcise(target, relief('owner')).tax).toBe(200)
    expect(computeRmdShortfallExcise(target, relief('spouse')).tax).toBe(500)
  })

  it('ignores a waiver whose obligation id does not match the computed obligation', () => {
    expect(computeRmdShortfallExcise(obligation(), {
      obligationId: 'some-other-obligation',
      discretionaryWaiver: 'granted',
    }).tax).toBe(500)
  })
})
