/**
 * Additive Plan schema for characterized state-tax facts.
 *
 * Leaf helpers consume the runtime shapes in `tax/stateRetirementFacts.ts`.
 * These persisted fields are the Plan inputs adapters map into that API. QCD
 * conformity policy is never persisted here â€” it resolves from versioned state
 * parameters.
 */
import { z } from 'zod'
import { assertedFactProvenanceSchema } from './assertedFactProvenance.js'

const idSchema = z.string().min(1)
const nonNegative = z.number().nonnegative().finite()
const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Invalid civil date')
const calendarYear = z.number().int().min(1900).max(2200)

/**
 * Expanded pension source vocabulary. Legacy `private` / `public` remain valid.
 * Coarse `public` without `stateEligibility` is incomplete for named-system /
 * military limbs (maps to unknownPublic at the adapter), never proof of a
 * specific exclusion.
 */
export const pensionSourceKindSchema = z.enum([
  'private',
  'public',
  'ordinaryPrivatePension',
  'ira',
  'employerPlan',
  'militaryRetirement',
  'militarySurvivor',
  'federalCivilService',
  'stateLocalPublic',
  'railroadTier1',
  'railroadTier2',
  'railroadRetirementAct',
  'governmentSurvivor',
  'unknownPublic',
  'unknownPrivate',
])
export type PensionSourceKind = z.infer<typeof pensionSourceKindSchema>

export const pensionStateEligibilitySchema = z
  .object({
    planSystemCode: z.string().min(1).optional(),
    qualifiedPlanType: z.enum(['401a', '401k', '403b', '457b', 'ira', 'other', 'unknown']).optional(),
    distributionCode: z.string().min(1).optional(),
    survivorSpouse: z.boolean().optional(),
    deathOrDisabilitySurvivorUnder55: z.boolean().optional(),
    planJurisdiction: z.string().length(2).optional(),
    railroadBenefitKind: z.enum(['tier1', 'tier2', 'lumpSum', 'unemployment', 'sickness', 'otherRra']).optional(),
    distributionReason: z
      .enum(['ordinary', 'disability', 'death', 'earlyDistributionCode1', 'unknown'])
      .optional(),
    contributoryStatus: z.enum(['contributory', 'noncontributory', 'unknown']).optional(),
    recipientDisabled: z.boolean().optional(),
    idahoEmploymentRequiresFederalReturn: z.boolean().optional(),
    earningsNotCoveredBySocialSecurity: z.boolean().optional(),
    decedentWouldQualify: z.boolean().optional(),
    decedentAgeYears: nonNegative.optional(),
    survivorInsurableInterest: z.boolean().optional(),
    survivorIssuer: z.enum(['dc', 'federal', 'other', 'unknown']).optional(),
    reciprocitySatisfied: z.boolean().optional(),
    knownPreviouslyTaxedBasis: nonNegative.optional(),
    priorTaxState: z.string().length(2).optional(),
    earlyDistributionDisqualifier: z.enum(['true', 'false', 'unknown']).optional(),
    provenance: assertedFactProvenanceSchema.optional(),
  })
  .strict()
export type PensionStateEligibility = z.infer<typeof pensionStateEligibilitySchema>

export const stateFilingStatusSchema = z.enum([
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
])

/** Optional per-year household facts a jurisdiction may need; missing year â‡’ unknown. */
export const stateTaxYearHouseholdFactsSchema = z
  .object({
    year: calendarYear,
    stateFilingStatus: stateFilingStatusSchema.optional(),
    exemptionTaxpayerCount: z.number().int().nonnegative().optional(),
    exemptionDependentCount: z.number().int().nonnegative().optional(),
    age65EligibleCount: z.number().int().nonnegative().optional(),
    section63fQualificationCount: z.number().int().nonnegative().optional(),
    federalExemptionCount: z
      .discriminatedUnion('known', [
        z.object({ known: z.literal(true), value: z.number().int().nonnegative() }),
        z.object({ known: z.literal(false) }),
      ])
      .optional(),
    zeroFederalExemptionReason: z.enum(['irc151d2', 'other', 'unknown']).optional(),
    survivingSpouseQualification: z
      .object({
        deathYear: calendarYear,
        remarried: z.boolean(),
      })
      .optional(),
    utahCreditElection: z.enum(['military', 'retirement', 'larger', 'socialSecurityAndMilitary', 'auto']).optional(),
    connecticutAgi: z.number().finite().optional(),
    missouriIncome: z.number().finite().optional(),
    oregonHouseholdIncome: z.number().finite().optional(),
    montanaNetTaxableLtcg: z.number().finite().optional(),
    wisconsinIncomeForStandardDeduction: z.number().finite().optional(),
    vermontUsObligationAdjustment: z.number().finite().optional(),
    vermontRetirementElection: z.enum(['civilService', 'socialSecurity']).optional(),
    claimedAsDependent: z.boolean().optional(),
    claimantDatesOfBirth: z.array(civilDate).optional(),
    southCarolinaAgi: z.number().finite().optional(),
    iowaAlternateTaxFactsComplete: z.boolean().optional(),
    iowaAlternateTaxEligible: z.boolean().optional(),
    stateBaseFactsComplete: z.boolean().optional(),
    idahoSpouseOwnershipComplete: z.boolean().optional(),
    taxpayerEligibility: z.array(z.object({ personId: idSchema, blind: z.boolean().optional(), claimedAsDependent: z.boolean().optional(), exemptionEligible: z.boolean().optional() }).strict()).optional(),
    oregonCreditClaimantPersonId: idSchema.optional(),
    arkansasRetirementElections: z.array(z.object({ ownerPersonId: idSchema, election: z.enum(['military', 'ordinary', 'larger']) }).strict()).optional(),
    recipientSocialSecurity: z.array(z.object({
      ownerPersonId: idSchema, grossSocialSecurity: nonNegative, federallyIncludedSocialSecurity: nonNegative,
      grossRailroadTier1: nonNegative, federallyIncludedRailroadTier1: nonNegative,
    }).strict()).optional(),
    interestExcludedFromFederalAgi: z.number().finite().optional(),
    utahSection59_10_114Additions: z.number().finite().optional(),
    socialSecurityIncludedInUtahTaxableIncome: z.number().finite().optional(),
    railroadRetirementActBenefitsPaid: z.number().finite().optional(),
    railroadRetirementActBenefitsIncludedInFederalAgi: z.number().finite().optional(),
    railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome: nonNegative.optional(),
    utahCreditApportionment: z.number().min(0).max(1).optional(),
    ownerStateTaxFacts: z.array(z.object({
      ownerPersonId: idSchema,
      remainingScIncome: z.number().finite().optional(),
      westVirginiaEligibleAge65OrDisabled: z.boolean().optional(),
      westVirginiaSurvivorEligible: z.boolean().optional(),
      westVirginiaRemainingFederalAgiIncome: z.number().finite().optional(),
      westVirginiaPriorNamedModifications: z.number().finite().optional(),
    }).strict()).optional(),
    iowaTestNetIncome: z.number().finite().optional(),
    /** Separate Iowa worksheet facts; omission remains unknown. */
    iowaCombinedSpouseTestNetIncome: z.number().finite().optional(),
    iowaSpouseTaxableIncome: z.number().finite().optional(),
    iowaSpouseNolCarryElection: z.boolean().optional(),
    iowaClaimedAsDependent: z.boolean().optional(),
    iowaClaimantTestNetIncome: z.number().finite().optional(),
    iowaClaimantJointThreshold: z.boolean().optional(),
    iowaSeniorForThreshold: z.boolean().optional(),
  })
  .strict()
export type StateTaxYearHouseholdFacts = z.infer<typeof stateTaxYearHouseholdFactsSchema>

/**
 * Optional owner/account/year HSA evidence for CA/NJ and similar limbs.
 * Known zero is explicit 0; omit a member when unknown. Never invent
 * contribution/earnings splits from `annualReturnPct`. Cash withdrawals are
 * not a New Jersey wage-like income category â€” use `njAssetDispositions` for
 * lot-level realized gain only.
 */
export const stateHsaYearEvidenceSchema = z
  .object({
    taxYear: calendarYear,
    accountId: idSchema,
    ownerPersonId: idSchema,
    /** Two-letter state this basis/evidence row applies to; required for basis reuse safety. */
    state: z.string().length(2),
    employeePayrollContributions: nonNegative.optional(),
    employeeDirectContributions: nonNegative.optional(),
    afterTaxContributionsAlreadyInStateIncome: nonNegative.optional(),
    grossDistributions: nonNegative.optional(),
    nonqualifiedCashWithdrawals: nonNegative.optional(),
    stateBasisConsumed: nonNegative.optional(),
    stateBasisAfterYear: nonNegative.optional(),
    activityCategoriesComplete: z.object({ contributions: z.boolean(), earnings: z.boolean(), dispositions: z.boolean(), distributions: z.boolean(), basis: z.boolean() }).strict().optional(),
    federalHsaDeduction: nonNegative.optional(),
    employerContributionExcludedFederally: nonNegative.optional(),
    employerContributionAlreadyInStateWages: nonNegative.optional(),
    interest: nonNegative.optional(),
    dividends: nonNegative.optional(),
    realizedGains: z.number().finite().optional(),
    unrealizedAppreciation: nonNegative.optional(),
    qualifiedCashWithdrawals: nonNegative.optional(),
    nonqualifiedDistributionFederalAmount: nonNegative.optional(),
    stateBasisBeforeYear: nonNegative.optional(),
    documentedOtherStateTaxed401aBasis: nonNegative.optional(),
    njAssetDispositions: z
      .array(
        z
          .object({
            proceeds: nonNegative,
            njLotBasis: nonNegative,
          })
          .strict(),
      )
      .optional(),
    californiaAssetDispositions: z
      .array(z.object({ proceeds: nonNegative, californiaLotBasis: nonNegative }).strict())
      .optional(),
    annualActivityComplete: z.boolean().optional(),
    provenance: assertedFactProvenanceSchema,
  })
  .strict()
export type StateHsaYearEvidence = z.infer<typeof stateHsaYearEvidenceSchema>

/**
 * State IRA basis evidence keyed by owner/year/state, alongside federal
 * retirement-action annual tax facts rather than replacing Form 8606 records.
 */
export const stateIraBasisYearEvidenceSchema = z
  .object({
    taxYear: calendarYear,
    ownerPersonId: idSchema,
    state: z.string().length(2),
    accountId: idSchema.optional(),
    unrecoveredStateBasis: nonNegative.optional(),
    annualDistributionsComplete: z.boolean().optional(),
    fullLiquidation: z.boolean().optional(),
    yearEndAccountValue: nonNegative.optional(),
    distributionsDuringYear: nonNegative.optional(),
    postYearContributionsThroughFilingDeadline: nonNegative.optional(),
    exemptObligationAdjustment: z.number().finite().optional(),
    provenance: assertedFactProvenanceSchema,
  })
  .strict()
export type StateIraBasisYearEvidence = z.infer<typeof stateIraBasisYearEvidenceSchema>

export const stateTaxPlanFactsSchema = z
  .object({
    householdYearFacts: z.array(stateTaxYearHouseholdFactsSchema).default([]),
    hsaYearEvidence: z.array(stateHsaYearEvidenceSchema).default([]),
    iraBasisYearEvidence: z.array(stateIraBasisYearEvidenceSchema).default([]),
    /** An absent collection is unknown; a certified empty year is deliberately distinct. */
    annualEvidenceCompleteness: z.array(z.object({
      taxYear: calendarYear, state: z.string().length(2),
      hsa: z.enum(['complete', 'unknown']).optional(), qcd: z.enum(['complete', 'unknown']).optional(),
      iraBasis: z.enum(['complete', 'unknown']).optional(),
      provenance: assertedFactProvenanceSchema,
    }).strict()).optional(),
    retirementDistributionEvidence: z.array(z.object({
      eventId: idSchema, taxYear: calendarYear, accountId: idSchema,
      sourceOwnerPersonId: idSchema, recipientPersonId: idSchema,
      distributionDate: civilDate.optional(), source: pensionSourceKindSchema,
      federallyIncludedAmount: nonNegative, eligibility: pensionStateEligibilitySchema.optional(),
      stateAllocation: z.array(z.object({ state: z.string().length(2), fraction: z.number().min(0).max(1) }).strict()).optional(),
      provenance: assertedFactProvenanceSchema,
    }).strict()).optional(),
    qcdEventEvidence: z.array(z.object({
      eventId: idSchema, taxYear: calendarYear, accountId: idSchema, ownerPersonId: idSchema,
      transferDate: civilDate.optional(), transactionKind: z.enum(['directQcd', 'splitInterest', 'other', 'unknown']),
      grossIraDistribution: nonNegative, directCharityTransfer: nonNegative,
      federalExcludedAmount: nonNegative, federalTaxableAmount: nonNegative, federalBasisAllocated: nonNegative,
      residency: z.enum(['fullYearResident', 'fullYearNonresident', 'partYear', 'unknown']),
      directTransfer: z.boolean(), kansasCoveredCharitableCreditClaimed: z.boolean().optional(),
      stateAllocation: z.array(z.object({ state: z.string().length(2), fraction: z.number().min(0).max(1) }).strict()).optional(),
      provenance: assertedFactProvenanceSchema,
    }).strict()).optional(),
    basisPoolEvidence: z.array(z.object({
      taxYear: calendarYear, state: z.string().length(2), accountId: idSchema, ownerPersonId: idSchema,
      kind: z.enum(['pension', 'eligiblePlan', 'otherState401a', 'hsa', 'njIra']),
      openingBasis: nonNegative.optional(), additions: nonNegative.optional(),
      provenance: assertedFactProvenanceSchema,
    }).strict()).optional(),
  })
  .strict()
export type StateTaxPlanFacts = z.infer<typeof stateTaxPlanFactsSchema>
