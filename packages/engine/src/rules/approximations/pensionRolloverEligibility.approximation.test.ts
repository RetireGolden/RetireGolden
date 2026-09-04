/**
 * Pins the pension lump-sum path's assumed direct-rollover eligibility.
 *
 * The Plan can express an offer, its election year, and a traditional
 * destination, but cannot express whether the source is a qualified trust or
 * whether its distribution is eligible for rollover. This fixture therefore
 * uses those unavailable facts to hide a genuinely nonqualifying or ineligible
 * offer, drives the real projection entry point with a round $300,000 pension
 * offer, and records the two readings the hidden facts separate. It
 * deliberately uses a 60-year-old, outside the RMD regime: the §402(c)(4)(B)
 * carve-out is the distinct sibling defect
 * irc-402-c-4-B-rmd-not-eligible-rollover-distribution.
 */
import { expect, it } from 'vitest'

import type { Account, Plan } from '../../model/plan.js'
import { simulatePlan } from '../../projection/simulate.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../../testing/planFixtures.js'
import { describeRule } from '../describeRule.js'

const ELECTION_YEAR = 2026
const OFFER = 300_000
const noTax = createFlatTaxCalculator(0)

function hiddenNonqualifyingOfferPensionPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 61 })
  plan.accounts = [
    traditionalAccount('rollover-ira', 0),
    {
      type: 'pension',
      id: 'pension',
      name: 'Pension with hidden nonqualifying rollover offer',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 60,
      monthlyAmount: 1000,
      colaPct: 0,
      survivorPct: 0,
      lumpSumOffer: { amount: OFFER, electionYear: ELECTION_YEAR },
      lumpSumElection: { rolloverAccountId: 'rollover-ira' },
    } satisfies Account,
  ]
  return plan
}

describeRule('irc-402-c-1-pension-lump-sum-direct-rollover-eligibility', {
  readings: {
    // The hidden facts make this a nonqualifying or ineligible offer, so the
    // claimed exclusion is unavailable: it is currently taxable and does not
    // arrive in the destination IRA.
    statuteTreatsHiddenNonqualifyingOfferAsCurrentlyTaxable: {
      traditionalDestinationBalance: 0,
      pensionIncome: OFFER,
      magi: OFFER,
    },
    engineAssumesEveryElectedOfferIsTaxFreeAndEligible: {
      traditionalDestinationBalance: OFFER,
      pensionIncome: 0,
      magi: 0,
    },
  },
  accepted: 'statuteTreatsHiddenNonqualifyingOfferAsCurrentlyTaxable',
  produced: 'engineAssumesEveryElectedOfferIsTaxFreeAndEligible',
  note: 'hidden nonqualifying offer is currently taxable',
}, ({ accepted, produced }) => {
  it('credits the entire elected offer to the traditional destination with no current pension income or MAGI', () => {
    const result = simulatePlan(validatePlan(hiddenNonqualifyingOfferPensionPlan()), {
      startYear: ELECTION_YEAR,
      horizonEndYear: ELECTION_YEAR,
      taxCalculator: noTax,
    })
    const year = result.years.find((row) => row.year === ELECTION_YEAR)!
    const observed = {
      traditionalDestinationBalance: year.balances['rollover-ira']!,
      pensionIncome: year.incomes.pension,
      magi: year.magi,
    }

    expect(observed).toEqual(produced)
    expect(observed).not.toEqual(accepted)
  })
})
