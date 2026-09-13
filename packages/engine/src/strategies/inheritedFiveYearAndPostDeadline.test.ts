import { describeRule } from '../rules/describeRule.js'
import { expect, it } from 'vitest'

import {
  computeRmdShortfallExcise,
  type RmdShortfallObligation,
  type RmdShortfallReliefElection,
} from '../rmd/rmdShortfallExcise.js'
import {
  fiveYearEmptyingRequirement,
  postDeadlineRemainingBenefitObligation,
} from './inheritedFiveYearAndPostDeadline.js'

const confirmedFacts = {
  ownerDeathDate: '2026-03-01',
  ownerDeathYear: 2026,
  beneficiaryClassification: 'nonDesignatedConfirmed' as const,
  deathBeforeRequiredBeginningDate: true as const,
  classificationProvenance: 'plan.confirmedNonDesignated',
}

describeRule('irc-401-a-9-B-ii-confirmed-non-designated-five-year-schedule', { readings: { fiveYearDeadline: 50000, wronglyUsesTenYears: 0 }, accepted: 'fiveYearDeadline' }, ({ accepted }) => {
  // IRC 401(a)(9)(B)(ii) / 54.4974-1(c): pre-RBD non-designated — empty by deathYear+5.
  it('requires $0 annually 2027-2030 and full $50,000 by 2031-12-31 for a 2026 pre-RBD death', () => {
    for (const year of [2027, 2028, 2029, 2030]) {
      const row = fiveYearEmptyingRequirement({
        facts: confirmedFacts,
        taxYear: year,
        remainingInterest: 50_000,
      })
      expect(row.status).toBe('supported')
      expect(row.requiredMinimumForTaxYear).toBe(0)
      expect(row.deadlineYear).toBe(2031)
    }
    const deadline = fiveYearEmptyingRequirement({
      facts: confirmedFacts,
      taxYear: 2031,
      remainingInterest: 50_000,
    })
    expect(deadline.requiredMinimumForTaxYear).toBe(accepted)
  })

  it('refuses unknown trust classification and rejects post-RBD on this pathway', () => {
    expect(
      fiveYearEmptyingRequirement({
        facts: {
          ...confirmedFacts,
          beneficiaryClassification: 'unknownTrustOrEntity',
          classificationProvenance: 'unknown',
        },
        taxYear: 2031,
        remainingInterest: 50_000,
      }).status,
    ).toBe('refusal')

    expect(
      fiveYearEmptyingRequirement({
        facts: {
          ...confirmedFacts,
          deathBeforeRequiredBeginningDate: false,
        },
        taxYear: 2031,
        remainingInterest: 50_000,
      }),
    ).toMatchObject({ status: 'notThisPathway', reason: 'postRbdUsesSeparateRules' })
  })

  it('refuses tax years before death, invalid civil dates, year mismatches, and blank provenance', () => {
    expect(
      fiveYearEmptyingRequirement({
        facts: confirmedFacts,
        taxYear: 2025,
        remainingInterest: 50_000,
      }),
    ).toMatchObject({ status: 'refusal', reason: 'taxYearBeforeOwnerDeathYear' })

    expect(
      fiveYearEmptyingRequirement({
        facts: { ...confirmedFacts, ownerDeathDate: '2026-02-31' },
        taxYear: 2031,
        remainingInterest: 50_000,
      }),
    ).toMatchObject({ status: 'refusal', reason: 'invalidOwnerDeathDate' })

    expect(
      fiveYearEmptyingRequirement({
        facts: { ...confirmedFacts, ownerDeathDate: '2025-12-31' },
        taxYear: 2031,
        remainingInterest: 50_000,
      }),
    ).toMatchObject({ status: 'refusal', reason: 'ownerDeathDateYearMismatch' })

    expect(
      fiveYearEmptyingRequirement({
        facts: { ...confirmedFacts, classificationProvenance: '   ' },
        taxYear: 2031,
        remainingInterest: 50_000,
      }),
    ).toMatchObject({ status: 'refusal', reason: 'blankClassificationProvenance' })
  })

  it('routes deadline-plus-one to the post-deadline leaf without a second dollar requirement', () => {
    const fiveYear = fiveYearEmptyingRequirement({
      facts: confirmedFacts,
      taxYear: 2032,
      remainingInterest: 10_000,
    })
    const postDeadline = postDeadlineRemainingBenefitObligation({
      deadlineYear: 2031,
      taxYear: 2032,
      remainingBenefitBeforeCurrentYearDistributions: 10_000,
      qualifyingDistributionsThisYear: 0,
    })
    expect(fiveYear).toEqual({
      status: 'notThisPathway',
      reason: 'postDeadlineRemainingBenefitPathway',
    })
    expect(postDeadline).toMatchObject({
      status: 'obligation', requiredAmount: 10_000,
    })
  })
})

describeRule('treas-reg-54-4974-1-e-post-deadline-remaining-benefit', { readings: { remainingBenefit: 10000, noFurtherObligation: 0 }, accepted: 'remainingBenefit' }, ({ accepted }) => {
  // 26 CFR 54.4974-1(e): subsequent years require entire remaining benefit —
  // a distribution obligation. Excise rates come from computeRmdShortfallExcise.
  it('returns a $10,000 entire-remaining-benefit obligation with no distribution', () => {
    const obligation = postDeadlineRemainingBenefitObligation({
      deadlineYear: 2031,
      taxYear: 2032,
      remainingBenefitBeforeCurrentYearDistributions: 10_000,
      qualifyingDistributionsThisYear: 0,
    })
    expect(obligation).toMatchObject({
      status: 'obligation',
      requiredAmount: accepted,
      distributedByDeadline: 0,
      shortfall: 10_000,
      entireRemainingBenefitRequired: true,
    })
  })

  it('does not invent an obligation on an emptied opening balance after the deadline', () => {
    const emptied = postDeadlineRemainingBenefitObligation({
      deadlineYear: 2031,
      taxYear: 2033,
      remainingBenefitBeforeCurrentYearDistributions: 0,
      qualifyingDistributionsThisYear: 0,
    })
    expect(emptied).toMatchObject({
      status: 'obligation',
      requiredAmount: 0,
      shortfall: 0,
    })
  })

  it('refuses negative or nonfinite history instead of coercing to zero', () => {
    expect(
      postDeadlineRemainingBenefitObligation({
        deadlineYear: 2031,
        taxYear: 2032,
        remainingBenefitBeforeCurrentYearDistributions: -10_000,
        qualifyingDistributionsThisYear: 0,
      }),
    ).toMatchObject({
      status: 'invalidHistory',
      reason: 'negativeOrNonfiniteHistory',
    })

    expect(
      postDeadlineRemainingBenefitObligation({
        deadlineYear: 2031,
        taxYear: 2032,
        remainingBenefitBeforeCurrentYearDistributions: 10_000,
        qualifyingDistributionsThisYear: Number.NaN,
      }).status,
    ).toBe('invalidHistory')
  })

  it('prices shortfall through computeRmdShortfallExcise at 25% and 10% with complete facts', () => {
    const leaf = postDeadlineRemainingBenefitObligation({
      deadlineYear: 2031,
      taxYear: 2032,
      remainingBenefitBeforeCurrentYearDistributions: 10_000,
      qualifyingDistributionsThisYear: 0,
    })
    expect(leaf.status).toBe('obligation')
    if (leaf.status !== 'obligation') return

    const obligation: RmdShortfallObligation = {
      obligationId: 'post-deadline-2032',
      distributionCalendarYear: 2032,
      taxYear: 2032,
      taxImposedOn: '2032-12-31',
      applicablePlan: {
        kind: 'inheritedIras',
        payeePersonId: 'b1',
        decedentId: 'd1',
        iraType: 'traditional',
      },
      requirementKind: 'inheritedFinalSweep',
      requiredAmount: leaf.requiredAmount,
      distributedByDeadline: leaf.distributedByDeadline,
    }

    const ordinary = computeRmdShortfallExcise(obligation)
    expect(ordinary.rate).toBe(0.25)
    expect(ordinary.tax).toBe(2_500)
    expect(ordinary.reason).toBe('default25Percent')

    const completeRelief: RmdShortfallReliefElection = {
      obligationId: obligation.obligationId,
      correctiveDistribution: {
        amount: 10_000,
        receivedOn: '2033-06-01',
        sourceApplicablePlan: obligation.applicablePlan,
        form5329FiledOn: '2033-06-15',
        returnReflectsReducedTax: true,
      },
    }
    const ten = computeRmdShortfallExcise(obligation, completeRelief)
    expect(ten.rate).toBe(0.1)
    expect(ten.tax).toBe(1_000)
    expect(ten.reason).toBe('corrected10Percent')

    const missingFiling: RmdShortfallReliefElection = {
      obligationId: obligation.obligationId,
      correctiveDistribution: {
        amount: 10_000,
        receivedOn: '2033-06-01',
        sourceApplicablePlan: obligation.applicablePlan,
        form5329FiledOn: '2033-06-15',
        returnReflectsReducedTax: false,
      },
    }
    const noTen = computeRmdShortfallExcise(obligation, missingFiling)
    expect(noTen.rate).toBe(0.25)
    expect(noTen.tax).toBe(2_500)
  })
})
