import { describe, expect, it } from 'vitest'
import { createEmptyPlan } from '../../model/plan.js'
import type { SocialSecurityStreamActivity } from '../types.js'
import { buildAnnualStateHouseholdFacts } from './annualStateHouseholdFacts.js'
const federal = { agi: 70000, taxableIncome: 50000, deductionUsed: 20000, taxableSocialSecurity: 17000, taxExemptInterest: 300 }
function stream(personId: string, amount: number): SocialSecurityStreamActivity {
  return { personId, streamId: `ss-${personId}`, source: 'own-retirement', annualAmount: amount,
    claimInForce: true, preWithholdingAnnual: amount, isSpousalSurvivorGateStream: true }
}
function plan() {
  const result = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01T00:00:00Z') })
  result.household.people[0]!.dob = '1952-12-31'
  return result
}
describe('annual state household source facts', () => {
  it('attributes federal inclusion to the sole SS recipient without an arbitrary split', () => {
    // IRC86 household worksheet: $20k actual benefits, $17k federally included.
    // With only one recipient and verified no TierI there is no allocation ambiguity.
    const result = buildAnnualStateHouseholdFacts({ plan: plan(), taxYear: 2026,
      socialSecurityStreams: [stream('p1', 20000)], federal, railroadBenefits: [] })
    expect(result.recipientSocialSecurity).toEqual([{ ownerPersonId: 'p1', grossSocialSecurity: 20000,
      federallyIncludedSocialSecurity: 17000, grossRailroadTier1: 0, federallyIncludedRailroadTier1: 0 }])
    expect(result.householdFacts.claimantDatesOfBirth).toEqual(['1952-12-31'])
    expect(result.householdFacts.interestExcludedFromFederalAgi).toBe(300)
  })
  it('does not allocate a household inclusion by gross-benefit ratio', () => {
    const result = buildAnnualStateHouseholdFacts({ plan: plan(), taxYear: 2026,
      socialSecurityStreams: [stream('p1', 12000), stream('p2', 8000)], federal, railroadBenefits: [] })
    expect(result.recipientSocialSecurity.map((row) => row.federallyIncludedSocialSecurity)).toEqual([undefined, undefined])
    expect(result.warnings).toContain('Per-recipient federally included Social Security is unknown; household inclusion was not proportionally allocated.')
  })
  it('preserves characterized separate state bases and eligibility rather than replacing them with federal AGI', () => {
    const inputPlan = plan()
    inputPlan.stateTaxFacts.householdYearFacts = [{ year: 2026, stateFilingStatus: 'headOfHousehold',
      connecticutAgi: 60000, oregonHouseholdIncome: 80000, missouriIncome: 61000,
      exemptionTaxpayerCount: 1, exemptionDependentCount: 2, age65EligibleCount: 1,
      utahCreditElection: 'retirement', iowaTestNetIncome: 62000 }]
    const result = buildAnnualStateHouseholdFacts({ plan: inputPlan, taxYear: 2026,
      socialSecurityStreams: [stream('p1', 20000)], federal, railroadBenefits: [] })
    expect(result.householdFacts).toMatchObject({ federalAgi: 70000, connecticutAgi: 60000,
      oregonHouseholdIncome: 80000, missouriIncome: 61000, stateFilingStatus: 'headOfHousehold',
      exemptionTaxpayerCount: 1, exemptionDependentCount: 2, age65EligibleCount: 1,
      utahCreditElection: 'retirement', iowaTestNetIncome: 62000 })
  })
  it('keeps RRA gross benefits distinct from federally included amounts', () => {
    // 45USC231m protects RRA benefits; state subtraction uses the included
    // amount, not the gross $30k already partly excluded federally.
    const result = buildAnnualStateHouseholdFacts({ plan: plan(), taxYear: 2026,
      socialSecurityStreams: [], federal: { ...federal, taxableSocialSecurity: 0 },
      railroadBenefits: [{ ownerPersonId: 'p1', kind: 'tier1', grossAmount: 20000, federallyIncludedAmount: 12000 },
        { ownerPersonId: 'p1', kind: 'tier2', grossAmount: 10000, federallyIncludedAmount: 8000 }] })
    expect(result.householdFacts.railroadRetirementActBenefitsPaid).toBe(30000)
    expect(result.householdFacts.railroadRetirementActBenefitsIncludedInFederalAgi).toBe(20000)
    expect(result.householdFacts.federallyIncludedRailroadTier1).toBe(12000)
  })
  it('rejects a stored recipient allocation when a candidate changes the federal inclusion', () => {
    const inputPlan = plan()
    inputPlan.stateTaxFacts.householdYearFacts = [{ year: 2026, recipientSocialSecurity: [
      { ownerPersonId: 'p1', grossSocialSecurity: 12000, federallyIncludedSocialSecurity: 10000, grossRailroadTier1: 0, federallyIncludedRailroadTier1: 0 },
      { ownerPersonId: 'p2', grossSocialSecurity: 8000, federallyIncludedSocialSecurity: 7000, grossRailroadTier1: 0, federallyIncludedRailroadTier1: 0 },
    ] }]
    const result = buildAnnualStateHouseholdFacts({ plan: inputPlan, taxYear: 2026,
      socialSecurityStreams: [stream('p1', 12000), stream('p2', 8000)],
      federal: { ...federal, taxableSocialSecurity: 16000 }, railroadBenefits: [] })
    expect(result.recipientSocialSecurity.every((row) => row.federallyIncludedSocialSecurity === undefined)).toBe(true)
  })
})
