import { describe, expect, it } from 'vitest'



import { determineSection402c2j4CatchUp, gateBeneficiarySpousalElectionForAnnualCoordinator, type GateBeneficiarySpousalElectionInput } from './beneficiarySpousalElectionAnnualGate.js'

import type { PersonId } from './identity.js'

import type { UsdCents } from './money.js'

import { describeRule } from '../rules/describeRule.js'



const spouse = 'spouse' as PersonId

const decedent = 'decedent' as PersonId

const cents = (n: number): UsdCents => n as UsdCents



function completedHistory(taxYear: number, required = 5_000_00, distributed = required) {

  return { taxYear, requiredAmount: cents(required), distributedAmount: cents(distributed), legalDeadline: `${taxYear}-12-31`, observedThrough: `${taxYear}-12-31`, provenance: 'custodian distribution record' }

}



function input(overrides: Partial<GateBeneficiarySpousalElectionInput> = {}): GateBeneficiarySpousalElectionInput {

  return {

    beneficiaryPersonId: spouse, decedentPersonId: decedent, relationship: 'survivingSpouse', deathDate: '2025-06-15', taxYear: 2026,

    determinationStage: 'openingOfTaxYear', deathYearDecedentResidualRmd: cents(0),

    electionFacts: {

      soleBeneficiaryStatus: 'verifiedSole', unlimitedWithdrawalRight: 'verifiedYes', beneficiaryIsDirectSpouseNamedOnIra: 'verifiedYes',

      affirmativeRedesignation: null, nonRolloverContributions: [], postDeathRequiredDistributionHistory: [],

      factsAsOfDate: '2026-01-01', factsProvenance: 'custodian statement',

      section402c2j4: { status: 'notApplicable', reason: 'beforeSpouseApplicableAge', factsAsOfDate: '2026-01-01', provenance: 'rollover review' },

    },

    ...overrides,

  }

}



function officialS1(currentPaid = 0) {

  return determineSection402c2j4CatchUp({

    accountType: 'traditional', transaction: 'affirmativeTreatAsOwnElection', preElectionDistributionMethod: 'tenYearRule',

    spouseBirthDate: '1958-06-15', decedentBirthDate: '1957-06-15', distributionYear: 2033,

    currentYearRmdReferenceBalance: cents(100_000_00), actualPriorYearDistributions: new Map([[2031, cents(1_000_00)], [2032, cents(0)]]),

    actualPreElectionDistributionsCurrentYear: cents(currentPaid), currentDistributionOrRemainingInterest: cents(0),

    factsAsOfDate: '2033-12-31', provenance: 'custodian balance and distribution records',

  })

}



describe('determineSection402c2j4CatchUp', () => {

  describeRule('treas-reg-1-402-c-2-j-4-surviving-spouse-catch-up-recurrence', {

    readings: { adjustedCurrentReferenceBalance: 'applicable', callerSuppliedHypotheticalRows: 'notSupportedByInput' },

    accepted: 'adjustedCurrentReferenceBalance',

  }, ({ accepted, readings }) => {

    it('exposes the regulated recurrence rather than an asserted catch-up worksheet', () => {

      expect(officialS1().status).toBe(accepted)

      expect(officialS1().status).not.toBe(readings.callerSuppliedHypotheticalRows)

    })

  })



  it('uses the final single-reference-balance recurrence, rounded yearly, not caller hypotheticals', () => {

    // 26 CFR 1.402(c)-2(j)(4)(ii)-(v), as illustrated by the 2024 proposed

    // example: 100,000/26.5 = 3,773.58; (100,000-(3,773.58-1,000))/25.5

    // = 3,812.80; (100,000-(3,773.58+3,812.80-1,000))/24.6 = 3,797.30.

    // Required = 3,773.58 + 3,812.80 + 3,797.30 - 1,000 = 10,383.68.

    expect(officialS1()).toMatchObject({ status: 'applicable', amountTreatedAsCurrentDistributionRmd: 10_383_68, remainingToDistributeBeforeElection: 10_383_68 })

  })



  it('subtracts executed current-year distributions only after calculating the statutory catch-up', () => {

    expect(officialS1(10_000_00)).toMatchObject({ status: 'applicable', amountTreatedAsCurrentDistributionRmd: 10_383_68, remainingToDistributeBeforeElection: 383_68 })

    expect(officialS1(10_383_68)).toMatchObject({ status: 'applicable', remainingToDistributeBeforeElection: 0 })

  })



  it('does not demand a fictional rollover for an affirmative election, while beneficiary destination is not applicable', () => {

    expect(officialS1()).toMatchObject({ status: 'applicable' })

    expect(determineSection402c2j4CatchUp({

      accountType: 'traditional', transaction: 'beneficiaryDestinationRollover', preElectionDistributionMethod: 'tenYearRule', spouseBirthDate: '1958-06-15', decedentBirthDate: '1957-06-15', distributionYear: 2033,

      currentYearRmdReferenceBalance: cents(100_000_00), actualPriorYearDistributions: new Map(), actualPreElectionDistributionsCurrentYear: cents(0), currentDistributionOrRemainingInterest: cents(0), factsAsOfDate: '2033-12-31', provenance: 'beneficiary rollover record',

    })).toMatchObject({ status: 'notApplicable', reason: 'beneficiaryDestination' })

  })



  it('refuses the owned-Roth positive catch-up limb and unresolved statutory inputs', () => {

    expect(determineSection402c2j4CatchUp({

      accountType: 'roth', transaction: 'affirmativeTreatAsOwnElection', preElectionDistributionMethod: 'tenYearRule', spouseBirthDate: '1958-06-15', decedentBirthDate: '1957-06-15', distributionYear: 2033,

      currentYearRmdReferenceBalance: cents(100_000_00), actualPriorYearDistributions: new Map(), actualPreElectionDistributionsCurrentYear: cents(0), currentDistributionOrRemainingInterest: cents(0), factsAsOfDate: '2033-12-31', provenance: 'IRA type record',

    })).toMatchObject({ status: 'notApplicableToOwnedRoth' })

    expect(determineSection402c2j4CatchUp({

      accountType: 'traditional', transaction: 'affirmativeTreatAsOwnElection', preElectionDistributionMethod: 'unknown', spouseBirthDate: '1958-06-15', decedentBirthDate: '1957-06-15', distributionYear: 2033,

      currentYearRmdReferenceBalance: 'unknown', actualPriorYearDistributions: new Map(), actualPreElectionDistributionsCurrentYear: cents(0), currentDistributionOrRemainingInterest: cents(0), factsAsOfDate: '2033-12-31', provenance: 'incomplete record',

    })).toMatchObject({ status: 'incomplete', reason: 'unknownDistributionMethod' })

  })

})



describe('gateBeneficiarySpousalElectionForAnnualCoordinator', () => {

  it('uses a completed prior-year shortfall at the opening and preserves death-year residual', () => {

    const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear: 2027, deathYearDecedentResidualRmd: cents(5_000_00), electionFacts: { ...input().electionFacts, factsAsOfDate: '2027-01-01', postDeathRequiredDistributionHistory: [completedHistory(2026, 5_000_00, 4_000_00)] } }))

    expect(result).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true, deathYearDecedentResidualRmdDue: 5_000_00 })

  })



  it('does not let a current recommendation or a pre-deadline observation become opening evidence', () => {

    const current = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ electionFacts: { ...input().electionFacts, factsAsOfDate: '2026-01-01', postDeathRequiredDistributionHistory: [completedHistory(2026, 5_000_00, 0)] } }))

    expect(current).toMatchObject({ status: 'missingFacts', missing: ['history chronology taxYear 2026'] })

    const premature = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear: 2027, electionFacts: { ...input().electionFacts, factsAsOfDate: '2027-01-01', postDeathRequiredDistributionHistory: [{ ...completedHistory(2026, 5_000_00, 4_000_00), observedThrough: '2026-11-30' }] } }))

    expect(premature).toMatchObject({ status: 'missingFacts', missing: ['history observed before legal deadline taxYear 2026'] })

  })



  it('uses a dated affirmative election only after execution and complete current-year history', () => {

    const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ determinationStage: 'endOfTaxYear', electionFacts: { ...input().electionFacts, factsAsOfDate: '2026-12-31', affirmativeRedesignation: { executedOn: '2026-05-01', provenance: 'executed redesignation' }, postDeathRequiredDistributionHistory: [completedHistory(2026)] } }))

    expect(result).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true })

  })



  it('keeps scheduled/future contributions out of opening and recognizes a dated completed act', () => {

    const opening = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ electionFacts: { ...input().electionFacts, nonRolloverContributions: [{ executedOn: '2026-05-01', provenance: 'scheduled only is not accepted by adapter' }] } }))

    expect(opening).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: false })

    const completed = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ determinationStage: 'endOfTaxYear', electionFacts: { ...input().electionFacts, factsAsOfDate: '2026-12-31', nonRolloverContributions: [{ executedOn: '2026-05-01', provenance: 'executed custodian contribution' }], postDeathRequiredDistributionHistory: [completedHistory(2026)] } }))

    expect(completed).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true })

  })



  it('requires the generated j(4) determination for a completed affirmative election', () => {

    const partial = officialS1(10_000_00)

    const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({

      deathDate: '2032-01-01', taxYear: 2033, determinationStage: 'endOfTaxYear',

      electionFacts: { ...input().electionFacts, factsAsOfDate: '2033-12-31', affirmativeRedesignation: { executedOn: '2033-12-31', provenance: 'executed redesignation after distribution' }, section402c2j4: partial, postDeathRequiredDistributionHistory: [completedHistory(2033)] },

    }))

    expect(result).toMatchObject({ status: 'lateElectionCatchUpIncomplete', requiredAmount: 10_383_68, observedDistributedAmount: 10_000_00, remainingAmount: 383_68 })

  })



  it('keeps unknown direct-spouse evidence distinct from verified false', () => {

    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ electionFacts: { ...input().electionFacts, beneficiaryIsDirectSpouseNamedOnIra: 'unknown' } }))).toMatchObject({ status: 'missingFacts', missing: ['beneficiaryIsDirectSpouseNamedOnIra'] })

    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ electionFacts: { ...input().electionFacts, beneficiaryIsDirectSpouseNamedOnIra: 'verifiedNo' } }))).toMatchObject({ status: 'eligibilityNotMet', reason: 'notDirectSpouseNamedOnIra' })

  })

})



// 1.408-8(c): an executed election's timing requirement belongs to its

// execution year. Later projection years preserve that established ownership.

describe('historical and committed modeled spouse-election contexts', () => {

  it('retains a satisfied 2033 election when projecting opening 2034 and 2035', () => {

    for (const taxYear of [2034, 2035]) {

      const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({

        taxYear, deathDate: '2032-01-01',

        electionFacts: { ...input().electionFacts, factsAsOfDate: '2034-01-01',

          affirmativeRedesignation: { executedOn: '2033-12-31', provenance: 'custodian redesignation' },

          section402c2j4: officialS1(10_383_68), postDeathRequiredDistributionHistory: [completedHistory(2033)],

        },

      }))

      expect(result).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true,

        evaluationContext: 'observed', evaluator: { effectiveTaxYear: 2033 } })

    }

  })

  it('does not accept a different-year j4 determination for the dated election', () => {

    const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({

      taxYear: 2034, deathDate: '2032-01-01',

      electionFacts: { ...input().electionFacts, factsAsOfDate: '2034-01-01',

        affirmativeRedesignation: { executedOn: '2032-12-31', provenance: 'custodian redesignation' },

        section402c2j4: officialS1(10_383_68), postDeathRequiredDistributionHistory: [completedHistory(2033)],

      },

    }))

    expect(result).toMatchObject({ status: 'missingFacts', missing: ['section402c2j4 distributionTaxYear'] })

  })

  const model = {

    simulationId: 'scenario-a', committedThroughTaxYear: 2026,

    requiredDistributionHistory: [{ taxYear: 2026, requiredAmount: cents(500000),

      distributedAmount: cents(400000), legalDeadline: '2026-12-31', commitId: 'annual-2026' }],

    nonRolloverContributions: [],

  }

  it('accepts committed prior-year modeled $5000/$4000 as scenario ownership, without altering observed facts', () => {

    const facts = input().electionFacts

    const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({

      taxYear: 2027, electionFacts: facts, simulationContext: model,

    }))

    expect(result).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true,

      evaluationContext: 'simulation', simulationId: 'scenario-a', evaluator: { effectiveTaxYear: 2026 } })

    expect(facts.postDeathRequiredDistributionHistory).toEqual([])

    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear: 2027 })).status).toBe('missingFacts')

  })

  it('rejects future/uncommitted and overlapping modeled history', () => {

    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ simulationContext: model })).status).toBe('missingFacts')

    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear: 2027,

      simulationContext: { ...model, requiredDistributionHistory: [{ ...model.requiredDistributionHistory[0]!, commitId: '' }] },

    })).status).toBe('missingFacts')

    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear: 2027,

      electionFacts: { ...input().electionFacts, factsAsOfDate: '2027-01-01', postDeathRequiredDistributionHistory: [completedHistory(2026)] },

      simulationContext: model,

    })).status).toBe('missingFacts')

  })

  it('accepts a committed modeled redesignation only with its own satisfied determination', () => {

    const result = gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear: 2034,

      deathDate: '2032-01-01', simulationContext: { simulationId: 'scenario-b', committedThroughTaxYear: 2033,

        requiredDistributionHistory: [{ taxYear: 2033, requiredAmount: cents(0), distributedAmount: cents(1038368), legalDeadline: '2033-12-31', commitId: 'annual-2033' }],

        affirmativeRedesignation: { executedOn: '2033-12-31', commitId: 'redesignation-2033' },

        nonRolloverContributions: [], section402c2j4: officialS1(1038368),

      },

    }))

    expect(result).toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true,

      evaluationContext: 'simulation', simulationId: 'scenario-b' })

  })

})


describe('January1 executed spouse-election boundary', () => {
  const january = { ...input().electionFacts,
    affirmativeRedesignation: { executedOn: '2026-01-01', provenance: 'Executed custodian event at opening' } }
  it('accepts a January1 act without a completed current-year history row', () => {
    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ electionFacts: january })))
      .toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true, evaluator: { effectiveTaxYear: 2026 } })
  })
  it('preserves January1 ownership in later years without inventing beneficiary history for owned years', () => {
    for (const taxYear of [2027, 2028]) {
      expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ taxYear, electionFacts: january })))
        .toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true, evaluator: { effectiveTaxYear: 2026 } })
    }
  })
  it('does not move a later act into the January1 opening', () => {
    expect(gateBeneficiarySpousalElectionForAnnualCoordinator(input({ electionFacts: { ...january,
      affirmativeRedesignation: { ...january.affirmativeRedesignation, executedOn: '2026-01-02' } } })))
      .toMatchObject({ status: 'evaluated', routeToOwnerTreatment: false })
  })
})
