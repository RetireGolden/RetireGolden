import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import { asUsdCents } from './money.js'
import type { PersonId } from './identity.js'
import {
  evaluateBeneficiarySpousalElection,
  type EvaluateBeneficiarySpousalElectionInput,
} from './beneficiarySpousalElectionStatus.js'

const SPOUSE = 'person-spouse' as PersonId
const DECEDENT = 'person-decedent' as PersonId

function input(
  overrides: Partial<EvaluateBeneficiarySpousalElectionInput> = {},
): EvaluateBeneficiarySpousalElectionInput {
  return {
    beneficiaryPersonId: SPOUSE,
    decedentPersonId: DECEDENT,
    relationship: 'survivingSpouse',
    deathDate: '2025-05-01',
    taxYear: 2026,
    requiredDistributionHistory: [
      { taxYear: 2026, requiredAmount: asUsdCents(40_000_00), distributedAmount: asUsdCents(40_000_00) },
    ],
    contributionYears: [],
    affirmativeElectionYear: null,
    ...overrides,
  }
}

describe('evaluateBeneficiarySpousalElection', () => {
  // IRC 408(d)(3)(C)(ii) treats an account as inherited only where the acquirer
  // "was not the surviving spouse". So a surviving spouse is inside 1.408-8(c)
  // and can reach owner treatment; a reading that made every death-acquirer an
  // inherited holder would take the spouse out of scope entirely.
  describeRule('irc-408-d-3-C-ii-surviving-spouse-not-inherited', {
    readings: {
      spouseOutsideInheritedRules: 'spousalOwnerTreatmentNotBegun',
      everyDeathAcquirerHoldsInherited: 'spousalElectionNotApplicable',
    },
    accepted: 'spouseOutsideInheritedRules',
  }, ({ accepted, readings }) => {
    it('keeps a surviving spouse inside the election rules', () => {
      const result = evaluateBeneficiarySpousalElection(input())
      expect(result.status).toBe(accepted)
      expect(result.status).not.toBe(readings.everyDeathAcquirerHoldsInherited)
    })

    it('takes a non-spouse beneficiary out of scope', () => {
      const result = evaluateBeneficiarySpousalElection(
        input({ relationship: 'notSurvivingSpouse' }),
      )
      expect(result.status).toBe(readings.everyDeathAcquirerHoldsInherited)
    })
  })

  // Treas. Reg. 1.408-8(c)(2)(i): the election is deemed made when a required
  // amount for a year *following* the year of death goes undistributed. The
  // contrary reading -- that only an affirmative election begins owner
  // treatment -- would leave this spouse a beneficiary indefinitely.
  describeRule('treas-reg-1-408-8-c-2-spousal-deemed-election', {
    readings: {
      deemedOnUndistributedAmount: 'spousalOwnerTreatmentBegun',
      affirmativeElectionOnly: 'spousalOwnerTreatmentNotBegun',
    },
    accepted: 'deemedOnUndistributedAmount',
  }, ({ accepted, readings }) => {
    it('begins owner treatment when a post-death-year amount goes undistributed', () => {
      const result = evaluateBeneficiarySpousalElection(input({
        requiredDistributionHistory: [{
          taxYear: 2026,
          requiredAmount: asUsdCents(40_000_00),
          distributedAmount: asUsdCents(39_999_99),
        }],
      }))

      expect(result.status).toBe(accepted)
      expect(result.status).not.toBe(readings.affirmativeElectionOnly)
      expect(result).toMatchObject({
        trigger: 'undistributedRequiredAmount',
        effectiveTaxYear: 2026,
      })
    })

    it('does not read the year of death as a trigger year', () => {
      // 2025 is the year of death, so its shortfall is outside (c)(2)(i). The
      // history may not cover it at all, which is what makes the year-of-death
      // shortfall unable to trigger the election.
      const result = evaluateBeneficiarySpousalElection(input({
        requiredDistributionHistory: [
          { taxYear: 2025, requiredAmount: asUsdCents(10_000_00), distributedAmount: asUsdCents(0) },
          { taxYear: 2026, requiredAmount: asUsdCents(40_000_00), distributedAmount: asUsdCents(40_000_00) },
        ],
      }))
      expect(result).toMatchObject({ status: 'spousalElectionEvidenceInconsistent' })
    })

    it('treats a non-rollover contribution as a trigger', () => {
      const result = evaluateBeneficiarySpousalElection(input({ contributionYears: [2026] }))
      expect(result).toMatchObject({
        status: 'spousalOwnerTreatmentBegun',
        trigger: 'contributionMade',
        effectiveTaxYear: 2026,
      })
    })

    it('refuses an unobserved year rather than assuming it was satisfied', () => {
      const result = evaluateBeneficiarySpousalElection(input({
        taxYear: 2027,
        requiredDistributionHistory: [{
          taxYear: 2027,
          requiredAmount: asUsdCents(40_000_00),
          distributedAmount: asUsdCents(40_000_00),
        }],
      }))
      expect(result).toMatchObject({
        status: 'spousalElectionEvidenceIncomplete',
        missingTaxYear: 2026,
      })
    })
  })

  it('fixes the effective year at the earliest trigger', () => {
    const result = evaluateBeneficiarySpousalElection(input({
      taxYear: 2028,
      contributionYears: [2028],
      requiredDistributionHistory: [
        { taxYear: 2026, requiredAmount: asUsdCents(40_000_00), distributedAmount: asUsdCents(0) },
        { taxYear: 2027, requiredAmount: asUsdCents(40_000_00), distributedAmount: asUsdCents(40_000_00) },
        { taxYear: 2028, requiredAmount: asUsdCents(40_000_00), distributedAmount: asUsdCents(40_000_00) },
      ],
    }))
    expect(result).toMatchObject({
      status: 'spousalOwnerTreatmentBegun',
      trigger: 'undistributedRequiredAmount',
      effectiveTaxYear: 2026,
    })
  })

  it('refuses a non-spouse who claims an affirmative election', () => {
    const result = evaluateBeneficiarySpousalElection(input({
      relationship: 'notSurvivingSpouse',
      affirmativeElectionYear: 2026,
    }))
    expect(result).toMatchObject({ status: 'spousalElectionEvidenceInconsistent' })
  })

  it('refuses a tax year that precedes the year of death', () => {
    const result = evaluateBeneficiarySpousalElection(input({ taxYear: 2024 }))
    expect(result).toMatchObject({ status: 'spousalElectionEvidenceInconsistent' })
  })

  it('derives a stable evidence id that separates the trigger', () => {
    const undistributed = evaluateBeneficiarySpousalElection(input({
      requiredDistributionHistory: [{
        taxYear: 2026,
        requiredAmount: asUsdCents(40_000_00),
        distributedAmount: asUsdCents(0),
      }],
    }))
    const contribution = evaluateBeneficiarySpousalElection(input({ contributionYears: [2026] }))

    expect(undistributed).toMatchObject({ status: 'spousalOwnerTreatmentBegun' })
    expect(contribution).toMatchObject({ status: 'spousalOwnerTreatmentBegun' })
    expect((undistributed as { evidenceId: string }).evidenceId)
      .not.toBe((contribution as { evidenceId: string }).evidenceId)
  })
})
