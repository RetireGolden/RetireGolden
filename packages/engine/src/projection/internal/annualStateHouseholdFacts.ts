import { ageOnDate, householdFactsForYear } from './stateRetirementFactsAdapter.js'
/** Annual source facts, not a second state-tax calculator.
 * State household bases and eligibility are characterized inputs. Household
 * §86 inclusion cannot be allocated between recipients by an invented ratio.
 */
import type { Plan, StateTaxYearHouseholdFacts } from '../../model/plan.js'
import type { SocialSecurityStreamActivity, StateHouseholdTaxFactsInput } from '../types.js'

export interface AnnualRailroadBenefit {
  readonly ownerPersonId: string
  readonly kind: 'tier1' | 'tier2' | 'otherRra'
  readonly grossAmount: number
  readonly federallyIncludedAmount?: number
}
export interface AnnualRecipientSocialSecurity {
  readonly ownerPersonId: string
  readonly grossSocialSecurity: number
  readonly federallyIncludedSocialSecurity?: number
  readonly grossRailroadTier1: number
  readonly federallyIncludedRailroadTier1?: number
}
export type AnnualStateHouseholdFacts = StateHouseholdTaxFactsInput &
  Omit<StateTaxYearHouseholdFacts, 'year' | 'utahCreditElection' | 'recipientSocialSecurity' | 'ownerStateTaxFacts'> & {
    recipientSocialSecurity: readonly AnnualRecipientSocialSecurity[]
  }
export interface AnnualStateHouseholdFactsInput {
  readonly plan: Readonly<Plan>
  readonly taxYear: number
  readonly socialSecurityStreams: readonly SocialSecurityStreamActivity[]
  readonly federal: {
    readonly agi: number
    readonly taxableIncome: number
    readonly deductionUsed: number
    readonly taxableSocialSecurity: number
    readonly taxExemptInterest: number
  }
  /** Complete actual annual RRA benefit ledger. Absence is unknown, not empty. */
  readonly railroadBenefits?: readonly AnnualRailroadBenefit[]
  /** Actual claimants in this year's return; needed after a household death. */
  readonly claimantPersonIds?: readonly string[]
}
export function buildAnnualStateHouseholdFacts(input: AnnualStateHouseholdFactsInput): {
  householdFacts: AnnualStateHouseholdFacts
  recipientSocialSecurity: readonly AnnualRecipientSocialSecurity[]
  warnings: readonly string[]
} {
  const { plan, taxYear, federal } = input
  const warnings: string[] = []
  const stored = plan.stateTaxFacts.householdYearFacts.find((row) => row.year === taxYear)
  const { year: ignoredYear, utahCreditElection, recipientSocialSecurity: storedRecipients, ...storedFacts } = stored ?? { year: taxYear }
  void ignoredYear
  const people = new Map(plan.household.people.map((person) => [person.id, person]))
  const grossByPerson = new Map<string, number>()
  for (const stream of input.socialSecurityStreams) {
    grossByPerson.set(stream.personId, (grossByPerson.get(stream.personId) ?? 0) + stream.annualAmount)
  }
  const railroad = input.railroadBenefits
  const tier1ByPerson = new Map<string, number>()
  const tier1IncludedByPerson = new Map<string, number | undefined>()
  for (const row of railroad ?? []) {
    if (row.kind !== 'tier1') continue
    tier1ByPerson.set(row.ownerPersonId, (tier1ByPerson.get(row.ownerPersonId) ?? 0) + row.grossAmount)
    const previous = tier1IncludedByPerson.get(row.ownerPersonId)
    tier1IncludedByPerson.set(row.ownerPersonId,
      row.federallyIncludedAmount === undefined || (tier1IncludedByPerson.has(row.ownerPersonId) && previous === undefined)
        ? undefined : (previous ?? 0) + row.federallyIncludedAmount)
  }
  const ids = new Set([...grossByPerson.keys(), ...tier1ByPerson.keys()])
  const grossSs = [...grossByPerson.values()].reduce((sum, amount) => sum + amount, 0)
  const ssRecipients = [...grossByPerson].filter(([, amount]) => amount > 0)
  const knownNoTier1 = railroad !== undefined && !railroad.some((row) => row.kind === 'tier1' && row.grossAmount > 0)
  // Persisted recipient allocations are accepted only when their actual gross
  // and household included amounts still reconcile to this candidate ledger.
  const storedGrossMatches = storedRecipients !== undefined &&
    new Set(storedRecipients.map((row) => row.ownerPersonId)).size === storedRecipients.length &&
    [...ids].every((id) => storedRecipients.some((row) => row.ownerPersonId === id &&
      Math.abs(row.grossSocialSecurity - (grossByPerson.get(id) ?? 0)) < .005 &&
      Math.abs(row.grossRailroadTier1 - (tier1ByPerson.get(id) ?? 0)) < .005)) &&
    storedRecipients.every((row) => ids.has(row.ownerPersonId))
  const storedIncludedMatches = storedGrossMatches && knownNoTier1 && Math.abs(
    (storedRecipients?.reduce((sum, row) => sum + row.federallyIncludedSocialSecurity, 0) ?? Number.NaN) - federal.taxableSocialSecurity,
  ) < .005
  const recipients: AnnualRecipientSocialSecurity[] = [...ids].map((ownerPersonId) => {
    const grossSocialSecurity = grossByPerson.get(ownerPersonId) ?? 0
    const grossRailroadTier1 = tier1ByPerson.get(ownerPersonId) ?? 0
    const storedRecipient = storedIncludedMatches ? storedRecipients?.find((row) => row.ownerPersonId === ownerPersonId) : undefined
    const included = storedRecipient?.federallyIncludedSocialSecurity ??
      (grossSocialSecurity === 0 ? 0 : knownNoTier1 && (ssRecipients.length === 1 || federal.taxableSocialSecurity === 0)
        ? federal.taxableSocialSecurity : undefined)
    const includedTier1 = railroad === undefined ? undefined : tier1IncludedByPerson.get(ownerPersonId) ??
      (grossRailroadTier1 === 0 ? 0 : undefined)
    return { ownerPersonId, grossSocialSecurity, grossRailroadTier1,
      ...(included === undefined ? {} : { federallyIncludedSocialSecurity: included }),
      ...(includedTier1 === undefined ? {} : { federallyIncludedRailroadTier1: includedTier1 }),
    }
  })
  if (recipients.some((row) => row.federallyIncludedSocialSecurity === undefined)) {
    warnings.push('Per-recipient federally included Social Security is unknown; household inclusion was not proportionally allocated.')
  }
  if (storedRecipients !== undefined && !storedIncludedMatches) warnings.push('Stored recipient Social Security inclusion does not establish this candidate ledger allocation.')
  const allRailroadInclusionKnown = railroad !== undefined && railroad.every((row) => row.federallyIncludedAmount !== undefined)
  const claimantIds = input.claimantPersonIds ?? plan.household.people.map((person) => person.id)
  const allClaimantsKnown = claimantIds.every((id) => people.has(id))
  const dates = claimantIds.flatMap((id) => {
    const person = people.get(id)
    if (person === undefined) { warnings.push(`Unknown state-return claimant ${id}.`); return [] }
    return [person.dob]
  })
  const derivedOwners = householdFactsForYear(plan, taxYear, { claimantPersonIds: claimantIds })
  const claimantAges = dates.map((dob) => ageOnDate(dob, `${taxYear}-12-31`))
  const validDerivedAge65Count = allClaimantsKnown && claimantAges.length === claimantIds.length && claimantAges.every((age) => age !== undefined)
    ? claimantAges.filter((age) => age !== undefined && age >= 65).length
    : undefined
  const householdFacts: AnnualStateHouseholdFacts = {
    ...derivedOwners,
    ...storedFacts,
    ownerStateTaxFacts: derivedOwners?.ownerStateTaxFacts,
    stateFilingStatus: stored?.stateFilingStatus ?? plan.household.filingStatus,
    claimantDatesOfBirth: stored?.claimantDatesOfBirth ?? dates,
    ...(stored?.age65EligibleCount !== undefined
      ? { age65EligibleCount: stored.age65EligibleCount }
      : validDerivedAge65Count === undefined ? {} : { age65EligibleCount: validDerivedAge65Count }),
    federalAgi: federal.agi, federalTaxableIncome: federal.taxableIncome,
    federalDeductionUsed: federal.deductionUsed,
    householdGrossSocialSecurity: grossSs,
    federallyIncludedSocialSecurity: federal.taxableSocialSecurity,
    // The modeled SS stream enters Utah's federal-AGI base. A complete
    // empty RRA ledger proves there is no overlapping railroad subtraction.
    // Outside-engine section114 additions remain separately asserted facts.
    ...(railroad?.length === 0 ? {
      socialSecurityIncludedInUtahTaxableIncome: federal.taxableSocialSecurity,
      railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome: 0,
    } : {}),
    interestExcludedFromFederalAgi: federal.taxExemptInterest,
    recipientSocialSecurity: recipients,
    ...(utahCreditElection === undefined ? {} : { utahCreditElection:
      utahCreditElection === 'retirement' ? 'retirement' :
        utahCreditElection === 'military' || utahCreditElection === 'socialSecurityAndMilitary' ? 'socialSecurityAndMilitary' : 'auto' }),
    ...(railroad === undefined ? {} : {
      householdGrossRailroadBenefits: railroad.reduce((sum, row) => sum + row.grossAmount, 0),
      railroadRetirementActBenefitsPaid: railroad.reduce((sum, row) => sum + row.grossAmount, 0),
    }),
    ...(allRailroadInclusionKnown ? {
      railroadRetirementActBenefitsIncludedInFederalAgi: (railroad ?? []).reduce((sum, row) => sum + row.federallyIncludedAmount!, 0),
      federallyIncludedRailroadTier1: (railroad ?? []).filter((row) => row.kind === 'tier1').reduce((sum, row) => sum + row.federallyIncludedAmount!, 0),
    } : {}),
  }
  return { householdFacts, recipientSocialSecurity: recipients, warnings }
}
