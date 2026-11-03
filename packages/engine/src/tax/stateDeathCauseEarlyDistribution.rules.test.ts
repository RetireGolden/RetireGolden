/**
 * A distribution paid because of the owner's death is not an early
 * distribution (RetireGolden #825).
 *
 * IRC 72(t)(2)(A)(ii): the 10 percent additional tax "shall not apply to" a
 * distribution "made to a beneficiary (or to the estate of the employee) on or
 * after the death of the employee", at any age; the payer reports it with Form
 * 1099-R code 4. Delaware's 2025 PIT-RES instructions, line 6, deny the
 * pension exclusion only to a code 1 distribution or one assessed the federal
 * early-withdrawal penalty, so an inherited 401(k) paid to a 45-year-old
 * beneficiary keeps the under-60 exclusion of 30 Del. C. 1106(b)(3):
 * min($2,000, pension) = $2,000 on a $10,000 distribution.
 *
 * Expected amounts are hand calculations from those sources and the 2026
 * Delaware figures, not copies of helper output.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account, type Plan } from '../model/plan.js'
import { stateRetirementEventsFromAccountAmounts } from '../projection/internal/annualStateRetirementEvents.js'
import { characterizePensionDistribution, retirementDistributionFactsForYear } from '../projection/internal/stateRetirementFactsAdapter.js'
import type { TaxYearInput } from '../projection/types.js'
import { describeRule } from '../rules/describeRule.js'
import { computeStateTaxYearResult } from './stateTax.js'
import { mapStateIncomeComponent, type StateHouseholdTaxFacts, type StateRetirementDistributionFact } from './stateRetirementFacts.js'

/** The issue's plan: p1, born March 1, 1981 (45 in 2026), a Delaware resident. */
function delawarePlan(): Plan {
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.household.state = 'DE'
  plan.household.filingStatus = 'single'
  plan.household.people[0]!.dob = '1981-03-01'
  plan.accounts = [{
    type: 'traditional', kind: '401k', id: 'inh401k', name: 'Inherited 401(k)', ownerPersonId: 'p1',
    annualReturnPct: 0, balance: 100_000, annualContribution: 0, inherited: { decedentId: 'p0' },
  } as unknown as Account]
  return plan
}

const inheritedEvent = {
  eventId: 'forced:2026:inh401k', accountId: 'inh401k', recipientPersonId: 'p1',
  sourceOwnerPersonId: 'p0', source: 'employerPlan' as const, federallyIncludedAmount: 10_000,
}

const input = (change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state: 'DE', filingStatus: 'single', ordinaryIncome: 50_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [45], ...change,
})
const household: StateHouseholdTaxFacts = {
  stateFilingStatus: 'single', federalAgi: 50_000, federallyIncludedSocialSecurity: 0,
  householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
}
function delawareYear(rows: readonly StateRetirementDistributionFact[]) {
  return computeStateTaxYearResult(input(), {
    retirementDistributions: [...rows], hsaAccounts: [], qcdEvents: [], householdFacts: household,
  })
}
/** How much the rows take off Delaware taxable income. */
function excluded(rows: readonly StateRetirementDistributionFact[]): number {
  return delawareYear([]).taxableIncome - delawareYear(rows).taxableIncome
}
const warningCodes = (rows: readonly StateRetirementDistributionFact[]) => delawareYear(rows).warnings.map((warning) => warning.code)

describeRule('de-early-distribution-gate', {
  note: 'inherited 401(k) under 60',
  readings: { deathExceptionNotPremature: 2_000, unknownWithheld: 0 },
  accepted: 'deathExceptionNotPremature',
}, ({ accepted }) => {
  it('marks the inherited-account row death and not premature', () => {
    const [row] = retirementDistributionFactsForYear(delawarePlan(), 2026, [inheritedEvent])
    expect(row!.cause).toBe('death')
    expect(row!.earlyDistributionDisqualifier).toBe('false')
  })

  it('gives the $2,000 line 6 exclusion with no unknown-status warning', () => {
    const rows = retirementDistributionFactsForYear(delawarePlan(), 2026, [inheritedEvent])
    expect(excluded(rows)).toBe(accepted)
    expect(warningCodes(rows)).not.toContain('de-pension-early-unknown')
    expect(delawareYear(rows).status).toBe('complete')
  })

  it('reaches the row built from the account itself, its source owner the decedent', () => {
    const rows = stateRetirementEventsFromAccountAmounts(delawarePlan(), 2026, new Map([['inh401k', 10_000]]), 'forced')
    expect(rows[0]).toMatchObject({ sourceOwnerPersonId: 'p0', cause: 'death', earlyDistributionDisqualifier: 'false' })
    expect(excluded(rows)).toBe(accepted)
  })

  it('lets an explicit true disqualifier win over the death cause', () => {
    const rows = retirementDistributionFactsForYear(delawarePlan(), 2026, [{ ...inheritedEvent, eligibility: { earlyDistributionDisqualifier: 'true' } }])
    expect(rows[0]).toMatchObject({ cause: 'death', earlyDistributionDisqualifier: 'true' })
    expect(excluded(rows)).toBe(0)
    expect(warningCodes(rows)).not.toContain('de-pension-early-unknown')
  })
})

describe('the other producers of the death cause', () => {
  it('resolves a shared-contract death or survivor component the same way, and keeps code 1 premature', () => {
    const component = { id: 'c', ownerId: 'p1', recipient: 'primary', kind: 'qualifiedPlan401', amount: 10_000, federalIncludedAmount: 10_000, ageAtYearEnd: 45 } as const
    expect(mapStateIncomeComponent({ ...component, distributionReason: 'death' }).earlyDistributionDisqualifier).toBe('false')
    expect(mapStateIncomeComponent({ ...component, distributionReason: 'survivor' }).earlyDistributionDisqualifier).toBe('false')
    expect(mapStateIncomeComponent({ ...component, distributionReason: 'death', jurisdictionalFacts: { earlyDistributionCode: '1' } }).earlyDistributionDisqualifier).toBe('true')
  })

  it('marks a survivor pension paid to a 45-year-old not premature, unless the plan asserts it is', () => {
    const pension = (stateEligibility?: Record<string, unknown>) => ({
      type: 'pension', id: 'pension', source: 'private', ...(stateEligibility === undefined ? {} : { stateEligibility }),
    }) as unknown as Extract<Account, { type: 'pension' }>
    const survivor = (account: Extract<Account, { type: 'pension' }>) => characterizePensionDistribution({
      account, sourceOwnerPersonId: 'p0', payeePersonId: 'p1', federallyIncludedAmount: 10_000,
      recipientAgeYears: 45, taxYear: 2026, payeeDateOfBirth: '1981-03-01',
    }).fact
    expect(survivor(pension())).toMatchObject({ cause: 'death', earlyDistributionDisqualifier: 'false' })
    expect(survivor(pension({ earlyDistributionDisqualifier: 'true' })).earlyDistributionDisqualifier).toBe('true')
  })

  it('resolves a caller\'s own death row left unknown, and leaves an unknown ordinary row withheld', () => {
    const base = retirementDistributionFactsForYear(delawarePlan(), 2026, [inheritedEvent])[0]!
    expect(excluded([{ ...base, earlyDistributionDisqualifier: 'unknown' }])).toBe(2_000)
    expect(excluded([{ ...base, cause: 'ordinary', earlyDistributionDisqualifier: 'unknown' }])).toBe(0)
    expect(warningCodes([{ ...base, cause: 'ordinary', earlyDistributionDisqualifier: 'unknown' }])).toContain('de-pension-early-unknown')
  })

  it('leaves South Carolina\'s result for a death row unchanged now that its own death test is gone', () => {
    // South Carolina used to skip the unknown-status gate for a death cause
    // itself; the shared resolution now gives the row false first, so a
    // caller's death row left unknown prices as one marked false.
    const survivorPay: StateRetirementDistributionFact = {
      accountId: 'sbp', ownerPersonId: 'p1', sourceKind: 'militarySurvivor', federallyIncludedAmount: 20_000,
      grossDistribution: 20_000, recipientAgeYears: 45, recipientAgeKnown: true, cause: 'death',
      earlyDistributionDisqualifier: 'unknown', survivorSpouse: true,
    }
    const southCarolina = (rows: readonly StateRetirementDistributionFact[]) => computeStateTaxYearResult(input({ state: 'SC' }), {
      retirementDistributions: [...rows], hsaAccounts: [], qcdEvents: [], householdFacts: household,
    })
    const unknown = southCarolina([survivorPay])
    expect(unknown.taxableIncome).toBe(southCarolina([{ ...survivorPay, earlyDistributionDisqualifier: 'false' }]).taxableIncome)
    expect(unknown.warnings.map((warning) => warning.code)).not.toContain('sc-military-premature-unknown')
    // 12-6-1171 deducts the included military survivor pay in full.
    expect(southCarolina([]).taxableIncome - unknown.taxableIncome).toBe(20_000)
  })
})
