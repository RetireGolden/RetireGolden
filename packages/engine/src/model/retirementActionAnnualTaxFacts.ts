import { z } from 'zod'

import { formatCivilDate, parseCivilIsoDate } from '../actions/civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  planIdSchema,
} from '../actions/identity.js'
import {
  positiveUsdCentsSchema,
  usdCentsSchema,
} from '../actions/money.js'
import { ordinaryFederalFilingDeadline } from '../tax/ordinaryFederalFilingDeadline.js'

export { ordinaryFederalFilingDeadline }

const nonblankIdSchema = z.string().refine(
  (value) => value.trim().length > 0,
  { message: 'identifier must not be blank' },
)

const canonicalCivilDateSchema = z.string().refine(
  (value) => {
    const parsed = parseCivilIsoDate(value)
    return parsed !== null && formatCivilDate(parsed) === value
  },
  { message: 'expected a real canonical civil date' },
)

const exactZeroSchema = z.literal(0).refine(
  (value) => !Object.is(value, -0),
  { message: 'expected canonical literal zero' },
)

const filingTaxYearSchema = z.number().int().min(2006).max(9998)

// `z.tuple([])` emits an invalid empty `prefixItems` array in Zod's JSON
// Schema conversion. This has the same runtime contract while preserving the
// existing PR113 TypeScript tuple type.
const emptyTupleSchema = z.array(z.never()).max(0) as unknown as z.ZodType<[]>

export const planOwnedNonRothIraAnnualFilingSourceAuthoritySchema = z.object({
  acquisition: z.enum(['manual', 'import']),
  recordKind: z.enum([
    'filedForm8606',
    'taxProfessionalWorkpaper',
    'completeAccountRecordReconstruction',
  ]),
  sourceId: nonblankIdSchema,
  finalizedDate: z.string(),
}).strict()

export const planOwnedNonRothIraFilingDeadlineAuthoritySchema = z.object({
  authoritySourceId: nonblankIdSchema,
  designatedTaxYear: filingTaxYearSchema,
  deadlineStatus: z.literal('authoritativeFederalDeadlineEstablished'),
  deadlineKind: z.literal(
    'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
  ),
  calendarAdjustmentStatus: z.literal(
    'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
  ),
  disasterReliefContributionStatus: z.literal(
    'noPostOrdinaryDeadlineContributionClaimed',
  ),
  deadlineDate: z.string(),
}).strict()

export const planOwnedNonRothIraPostYearContributionSourceSchema = z.object({
  sourceRecordId: nonblankIdSchema,
  sourceEvidenceId: nonblankIdSchema,
  sourceAccountId: accountIdSchema,
  designatedTaxYear: filingTaxYearSchema,
  contributionDate: z.string(),
  nondeductibleContributionAmount: positiveUsdCentsSchema,
}).strict()

const planOwnedNonRothIraAnnualFilingSourceRecordStructuralSchema = z.object({
  predicate: z.literal('completePlanOwnedNonRothIraAnnualFilingSourceRecord'),
  planId: planIdSchema,
  ownerPersonId: personIdSchema,
  taxYear: filingTaxYearSchema,
  evidenceScope: z.literal('realWorldTaxRecordNotProjection'),
  sourceRecordId: nonblankIdSchema,
  sourceEvidenceId: nonblankIdSchema,
  authority: planOwnedNonRothIraAnnualFilingSourceAuthoritySchema,
  reviewedSourceAccountIds: z.array(accountIdSchema),
  openingBasis: z.object({
    asOfDate: z.string(),
    openingBasisAmount: usdCentsSchema,
    sourceEvidenceId: nonblankIdSchema,
  }).strict(),
  rolloverFacts: z.object({
    inventoryStatus: z.literal('completeIncludingExplicitEmpty'),
    outstandingRolloverAmount: exactZeroSchema,
    rolloverRepaymentAdjustmentAmount: exactZeroSchema,
    sourceEvidenceId: nonblankIdSchema,
  }).strict(),
  nondeductibleContributionFacts: z.object({
    inYearInventoryStatus: z.literal('completeExplicitEmpty'),
    inYearContributions: emptyTupleSchema,
    postYearWindowStatus: z.literal('completeThroughOrdinaryDeadline'),
    completedThroughDate: z.string(),
    deadlineAuthority: planOwnedNonRothIraFilingDeadlineAuthoritySchema,
    contributions: z.array(planOwnedNonRothIraPostYearContributionSourceSchema),
  }).strict(),
}).strict()

/** PR113's structural call-boundary schema, retained for precise builder issues. */
export const planOwnedNonRothIraAnnualFilingSourceRecordSchema =
  planOwnedNonRothIraAnnualFilingSourceRecordStructuralSchema

/** Persistence/runtime schema adds every cross-field filing-source invariant. */
export const persistedPlanOwnedNonRothIraAnnualFilingSourceRecordSchema =
  planOwnedNonRothIraAnnualFilingSourceRecordStructuralSchema.superRefine((record, ctx) => {
    const taxYearText = String(record.taxYear).padStart(4, '0')
    const expectedOpeningDate = `${taxYearText}-01-01`
    const taxYearEnd = `${taxYearText}-12-31`
    const deadline = record.nondeductibleContributionFacts.deadlineAuthority

  const requireCanonicalDate = (value: string, path: PropertyKey[]): void => {
    const valid = canonicalCivilDateSchema.safeParse(value).success
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: 'expected a real canonical civil date',
      })
    }
  }
  requireCanonicalDate(record.authority.finalizedDate, ['authority', 'finalizedDate'])
  requireCanonicalDate(
    record.nondeductibleContributionFacts.completedThroughDate,
    ['nondeductibleContributionFacts', 'completedThroughDate'],
  )
  requireCanonicalDate(deadline.deadlineDate, [
    'nondeductibleContributionFacts',
    'deadlineAuthority',
    'deadlineDate',
  ])

  if (record.reviewedSourceAccountIds.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['reviewedSourceAccountIds'],
      message: 'reviewed IRA account pool must not be empty',
    })
  }

  if (record.openingBasis.asOfDate !== expectedOpeningDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['openingBasis', 'asOfDate'],
      message: 'opening basis must be evidenced on January 1 of the tax year',
    })
  }
  if (deadline.designatedTaxYear !== record.taxYear) {
    ctx.addIssue({
      code: 'custom',
      path: ['nondeductibleContributionFacts', 'deadlineAuthority', 'designatedTaxYear'],
      message: 'contribution deadline must designate the source record tax year',
    })
  }
  if (deadline.deadlineDate !== ordinaryFederalFilingDeadline(record.taxYear)) {
    ctx.addIssue({
      code: 'custom',
      path: ['nondeductibleContributionFacts', 'deadlineAuthority', 'deadlineDate'],
      message: 'ordinary contribution deadline must exact-match the supported federal calendar',
    })
  }
  if (record.nondeductibleContributionFacts.completedThroughDate !== deadline.deadlineDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['nondeductibleContributionFacts', 'completedThroughDate'],
      message: 'contribution inventory must be complete through the authoritative deadline',
    })
  }
  if (record.authority.finalizedDate < deadline.deadlineDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['authority', 'finalizedDate'],
      message: 'source record cannot be finalized before the contribution window closes',
    })
  }

  const reviewed = new Set<string>()
  record.reviewedSourceAccountIds.forEach((accountId, index) => {
    if (reviewed.has(accountId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewedSourceAccountIds', index],
        message: `duplicate reviewed IRA account id "${accountId}"`,
      })
    }
    reviewed.add(accountId)
  })

  const identifiers = planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(record)
  let contributionTotal = 0n
  record.nondeductibleContributionFacts.contributions.forEach((contribution, index) => {
    requireCanonicalDate(contribution.contributionDate, [
      'nondeductibleContributionFacts',
      'contributions',
      index,
      'contributionDate',
    ])
    if (contribution.designatedTaxYear !== record.taxYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['nondeductibleContributionFacts', 'contributions', index, 'designatedTaxYear'],
        message: 'post-year contribution must designate the source record tax year',
      })
    }
    if (!reviewed.has(contribution.sourceAccountId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nondeductibleContributionFacts', 'contributions', index, 'sourceAccountId'],
        message: 'post-year contribution account must belong to the reviewed IRA pool',
      })
    }
    if (
      contribution.contributionDate <= taxYearEnd ||
      contribution.contributionDate > deadline.deadlineDate
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['nondeductibleContributionFacts', 'contributions', index, 'contributionDate'],
        message: 'post-year contribution must occur after December 31 through the deadline',
      })
    }
    contributionTotal += BigInt(contribution.nondeductibleContributionAmount)
  })
  if (contributionTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
    ctx.addIssue({
      code: 'custom',
      path: ['nondeductibleContributionFacts', 'contributions'],
      message: 'post-year contribution total exceeds exact safe-integer cents',
    })
  }

  const claimed = new Map<string, PropertyKey[]>()
  for (const identifier of identifiers) {
    const previous = claimed.get(identifier.value)
    if (previous !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: identifier.path,
        message: `source identifier collides with ${previous.join('.')}`,
      })
    } else {
      claimed.set(identifier.value, identifier.path)
    }
  }
})

export type PlanOwnedNonRothIraAnnualFilingSourceRecord = z.infer<
  typeof planOwnedNonRothIraAnnualFilingSourceRecordSchema
>

export interface PlanOwnedNonRothIraAnnualFilingSourceIdentifierClaim {
  value: string
  path: PropertyKey[]
}

/** Every stable source identifier, including identifiers nested in contributions. */
export function planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(
  record: Readonly<PlanOwnedNonRothIraAnnualFilingSourceRecord>,
): PlanOwnedNonRothIraAnnualFilingSourceIdentifierClaim[] {
  return [
    { value: record.sourceRecordId, path: ['sourceRecordId'] },
    { value: record.sourceEvidenceId, path: ['sourceEvidenceId'] },
    { value: record.authority.sourceId, path: ['authority', 'sourceId'] },
    { value: record.openingBasis.sourceEvidenceId, path: ['openingBasis', 'sourceEvidenceId'] },
    { value: record.rolloverFacts.sourceEvidenceId, path: ['rolloverFacts', 'sourceEvidenceId'] },
    {
      value: record.nondeductibleContributionFacts.deadlineAuthority.authoritySourceId,
      path: ['nondeductibleContributionFacts', 'deadlineAuthority', 'authoritySourceId'],
    },
    ...record.nondeductibleContributionFacts.contributions.flatMap(
      (contribution, index) => [{
        value: contribution.sourceRecordId,
        path: ['nondeductibleContributionFacts', 'contributions', index, 'sourceRecordId'],
      }, {
        value: contribution.sourceEvidenceId,
        path: ['nondeductibleContributionFacts', 'contributions', index, 'sourceEvidenceId'],
      }],
    ),
  ]
}

export const retirementActionAnnualTaxFactsSchema = z.object({
  ownedNonRothIraAnnualFilingSourceRecords: z.array(
    persistedPlanOwnedNonRothIraAnnualFilingSourceRecordSchema,
  ),
}).strict()

export type RetirementActionAnnualTaxFacts = z.infer<
  typeof retirementActionAnnualTaxFactsSchema
>

export function ownedNonRothIraAnnualFilingSourceKey(
  record: Pick<
    PlanOwnedNonRothIraAnnualFilingSourceRecord,
    'planId' | 'ownerPersonId' | 'taxYear'
  >,
): string {
  return JSON.stringify([record.planId, record.ownerPersonId, record.taxYear])
}
