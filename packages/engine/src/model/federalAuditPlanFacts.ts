/**
 * Additive Plan schema for federal audit-phase facts (spousal election
 * history, inherited Roth tax-character pools, employer elective history,
 * five-year / post-deadline distribution history). Optional absence preserves
 * legacy/refusal behavior and never means false or zero.
 */
import { z } from 'zod'
import { parseCivilIsoDate } from '../actions/civilDate.js'
import { assertedFactProvenanceSchema } from './assertedFactProvenance.js'

const idSchema = z.string().min(1)
const nonNegative = z.number().nonnegative().finite()
const calendarYear = z.number().int().min(1900).max(2200)
const isoDateRe = /^\d{4}-\d{2}-\d{2}$/
/** Real Gregorian civil date — regex alone accepts impossible calendar days. */
const civilDate = z
  .string()
  .regex(isoDateRe, 'expected YYYY-MM-DD')
  .refine(
    (value) => parseCivilIsoDate(value) !== null,
    'expected a real canonical civil date',
  )

export const inheritedAnnualDistributionHistoryRowSchema = z
  .object({
    taxYear: calendarYear,
    requiredAmount: nonNegative,
    distributedAmount: nonNegative,
    remainingBenefitAtYearEnd: nonNegative.optional(),
    /**
     * The date through which the row was actually observed.  Omitting it keeps
     * legacy history available for display but prevents it from becoming a
     * deemed-election trigger in an annual opening determination.
     */
    observedAsOfDate: civilDate.optional(),
    legalDistributionDeadline: civilDate.optional(),
    provenance: assertedFactProvenanceSchema,
  })
  .strict()
export type InheritedAnnualDistributionHistoryRow = z.infer<
  typeof inheritedAnnualDistributionHistoryRowSchema
>

/** Asserted completed-deadline observation; the annual gate validates chronology.
 * Unknown amounts remain explicit and never become a certified zero assessment.
 * This snapshot does not authorize replay of a historical distribution.
 */
export const completedInheritedDeadlineObservationSchema = z.object({
  taxYear: calendarYear,
  openingBenefit: z.union([nonNegative, z.literal('unknown')]),
  distributedByDeadline: z.union([nonNegative, z.literal('unknown')]),
  legalDistributionDeadline: civilDate,
  observedAsOfDate: civilDate,
  provenance: assertedFactProvenanceSchema,
}).strict()
export type CompletedInheritedDeadlineObservationFact = z.infer<typeof completedInheritedDeadlineObservationSchema>

export const verifiedNonDesignatedRegimeSchema = z
  .object({
    classification: z.literal('non-designated-beneficiary'),
    schedule: z.literal('five-year'),
    provenance: assertedFactProvenanceSchema,
  })
  .strict()
export type VerifiedNonDesignatedRegime = z.infer<typeof verifiedNonDesignatedRegimeSchema>

/**
 * Surviving-spouse election history facts. Existing `soleBeneficiary` and
 * `spouseUnlimitedWithdrawalRight` remain the eligibility facts — do not
 * duplicate them here. Present null/empty = verified none; absent block = unknown.
 */
export const spousalElectionFactsSchema = z
  .object({
    /** Direct-spouse naming is distinct from sole-beneficiary eligibility. */
    directSpouseNamedOnIra: z
      .enum(['verifiedYes', 'verifiedNo', 'unknown'])
      .optional(),
    /** Dated observed execution; old year-only fields do not establish timing. */
    affirmativeElectionDate: civilDate.nullable().optional(),
    nonRolloverContributionEvents: z.array(z.object({
      executionDate: civilDate,
      observedAsOfDate: civilDate,
      provenance: assertedFactProvenanceSchema,
    }).strict()).optional(),
    section402c2j4Inputs: z.object({
      transaction: z.enum(['actualOwnPlanRollover', 'affirmativeTreatAsOwnElection', 'beneficiaryDestinationRollover']),
      spouseBirthDate: civilDate,
      decedentBirthDate: civilDate,
      distributionYear: calendarYear,
      currentYearRmdReferenceBalance: z.union([nonNegative, z.literal('unknown')]),
      actualPriorYearDistributions: z.array(z.object({ taxYear: calendarYear, amount: nonNegative }).strict()),
      actualPreElectionDistributionsCurrentYear: nonNegative,
      currentDistributionOrRemainingInterest: nonNegative,
      provenance: assertedFactProvenanceSchema,
    }).strict().optional(),
    preElectionDistributionMethod: z.enum(['tenYearRule', 'lifeExpectancyRule', 'unknown']).optional(),
    affirmativeElectionYear: calendarYear.nullable().optional(),
    nonRolloverContributionYears: z.array(calendarYear).optional(),
    lateElectionCatchUp: z
      .object({
        requiredAmount: nonNegative,
        distributedAmount: nonNegative,
        completedOn: civilDate.optional(),
      })
      .nullable().optional(),
    /**
     * Typed §1.402(c)-2(j)(4) result supplied from observed execution facts.
     * Absence is unknown — a plan recommendation never supplies this result.
     */
    section402c2j4: z
      .discriminatedUnion('status', [
        z.object({
          status: z.literal('notApplicable'),
          factsAsOfDate: civilDate,
          provenance: assertedFactProvenanceSchema,
        }).strict(),
        z.object({
          status: z.literal('applicable'),
          distributionTaxYear: calendarYear,
          amountTreatedAsCurrentDistributionRmd: nonNegative,
          amountActuallyDistributed: nonNegative,
          factsAsOfDate: civilDate,
          provenance: assertedFactProvenanceSchema,
        }).strict(),
        z.object({ status: z.literal('unknown') }).strict(),
      ])
      .optional(),
    provenance: assertedFactProvenanceSchema,
  })
  .strict()
export type SpousalElectionFacts = z.infer<typeof spousalElectionFactsSchema>

export const inheritedRothConversionLayerSchema = z
  .object({
    conversionTaxYear: calendarYear,
    remainingAmount: nonNegative,
    taxableAmount: nonNegative,
  })
  .strict()
  .superRefine((layer, ctx) => {
    if (layer.taxableAmount > layer.remainingAmount) {
      ctx.addIssue({
        code: 'custom',
        path: ['taxableAmount'],
        message:
          'taxableAmount cannot exceed remainingAmount on an inherited Roth conversion layer',
      })
    }
  })

/**
 * One legal inherited-Roth tax-character pool per (beneficiary, decedent).
 * Never initialize from owned-Roth `contributionBasis`.
 */
export const inheritedRothTaxCharacterPoolSchema = z
  .object({
    beneficiaryPersonId: idSchema,
    decedentId: idSchema,
    firstRothContributionTaxYear: calendarYear,
    /** Unknown basis remains unknown; a completed qualified clock can still prove ordinary income zero. */
    remainingRegularContributionBasis: z.union([nonNegative, z.literal('unknown')]),
    /**
     * Explicit empty array is verified no conversion layers. Omitting the
     * member is rejected — absence is not known-zero once the pool block exists.
     */
    conversionLayers: z.union([
      z.array(inheritedRothConversionLayerSchema),
      z.literal('unknown'),
    ]),
    /**
     * Explicit zero is verified no prior consumption. Omitting the member is
     * rejected once the pool block exists.
     */
    priorDistributionsConsumedAmount: nonNegative,
    provenance: assertedFactProvenanceSchema,
  })
  .strict()
  .superRefine((pool, ctx) => {
    if (pool.conversionLayers === 'unknown') return
    let previousYear = Number.NEGATIVE_INFINITY
    for (let i = 0; i < pool.conversionLayers.length; i++) {
      const layer = pool.conversionLayers[i]!
      if (layer.conversionTaxYear < previousYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['conversionLayers', i, 'conversionTaxYear'],
          message:
            'inherited Roth conversion layers must be ordered oldest-first by conversionTaxYear',
        })
      }
      previousYear = layer.conversionTaxYear
      const asOfYear = Number(pool.provenance.asOf.slice(0, 4))
      if (Number.isFinite(asOfYear) && layer.conversionTaxYear > asOfYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['conversionLayers', i, 'conversionTaxYear'],
          message:
            'inherited Roth conversion layer year cannot be after provenance.asOf year',
        })
      }
    }
  })
export type InheritedRothTaxCharacterPool = z.infer<
  typeof inheritedRothTaxCharacterPoolSchema
>

export const employerElectiveDeferralHistoryRowSchema = z
  .object({
    ownerPersonId: idSchema,
    employerPlanId: idSchema,
    contributionYear: calendarYear,
    totalElectiveDeferrals: nonNegative,
    designatedRothElectiveDeferrals: nonNegative,
    asOf: civilDate,
    provenance: z.object({
      source: z.string().refine((value) => value.trim().length > 0, {
        message: 'provenance.source must be non-blank after trimming',
      }),
    }),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (row.designatedRothElectiveDeferrals > row.totalElectiveDeferrals) {
      ctx.addIssue({
        code: 'custom',
        path: ['designatedRothElectiveDeferrals'],
        message:
          'designatedRothElectiveDeferrals cannot exceed totalElectiveDeferrals',
      })
    }
    const asOfYear = Number(row.asOf.slice(0, 4))
    if (Number.isFinite(asOfYear) && asOfYear !== row.contributionYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['asOf'],
        message: 'asOf must fall in contributionYear',
      })
    }
  })
export type EmployerElectiveDeferralHistoryRow = z.infer<
  typeof employerElectiveDeferralHistoryRowSchema
>
