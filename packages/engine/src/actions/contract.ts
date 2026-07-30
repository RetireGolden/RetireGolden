import { z } from 'zod'

import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import {
  actionReasonSchema,
  type ActionReason,
  type PartialActionReasonCode,
  type RefusedActionReasonCode,
  type TaxTreatmentAdjustmentReasonCode,
  type UnsupportedActionReasonCode,
} from './reasons.js'

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, { message: 'Value must not be blank' })

export const actionProvenanceSchema = z
  .object({
    source: z.enum(['manual', 'generator', 'optimizer', 'migration']),
    sourceId: nonBlankStringSchema.optional(),
    scenarioId: nonBlankStringSchema.optional(),
  })
  .strict()
export type ActionProvenance = z.infer<typeof actionProvenanceSchema>

export const retirementActionKinds = ['ordinaryWithdrawal', 'rothConversion', 'qcd'] as const
export const retirementActionKindSchema = z.enum(retirementActionKinds)
export type RetirementActionKind = z.infer<typeof retirementActionKindSchema>

const retirementActionRequestBaseShape = {
  actionId: actionIdSchema,
  kind: retirementActionKindSchema,
  year: z.number().int().min(1).max(9999),
  executionDate: z.string().optional(),
  executionSequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  requestedAmount: positiveUsdCentsSchema,
  provenance: actionProvenanceSchema,
}

export const retirementActionRequestBaseSchema = z.object(retirementActionRequestBaseShape).strict()
export type RetirementActionRequestBase = z.infer<typeof retirementActionRequestBaseSchema>

export const personRetirementActionRequestBaseSchema = z
  .object({
    ...retirementActionRequestBaseShape,
    personId: personIdSchema,
  })
  .strict()
export type PersonRetirementActionRequestBase = z.infer<
  typeof personRetirementActionRequestBaseSchema
>

export const sourceAllocationRequestSchema = z
  .object({
    allocationId: allocationIdSchema,
    sourceAccountId: accountIdSchema,
    requestedAmount: positiveUsdCentsSchema,
  })
  .strict()
export type SourceAllocationRequest = Readonly<{
  allocationId: AllocationId
  sourceAccountId: AccountId
  requestedAmount: PositiveUsdCents
}>

function validateAllocations(
  allocations: readonly SourceAllocationRequest[],
  requestedAmount: PositiveUsdCents,
  ctx: z.RefinementCtx,
): void {
  const allocationIds = new Set<string>()
  const sourceAccountIds = new Set<string>()

  allocations.forEach((allocation, index) => {
    if (allocationIds.has(allocation.allocationId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocations', index, 'allocationId'],
        message: `duplicate allocation id "${allocation.allocationId}"`,
      })
    }
    allocationIds.add(allocation.allocationId)

    if (sourceAccountIds.has(allocation.sourceAccountId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocations', index, 'sourceAccountId'],
        message: `duplicate source account id "${allocation.sourceAccountId}"`,
      })
    }
    sourceAccountIds.add(allocation.sourceAccountId)
  })

  const total = allocations.reduce(
    (sum, allocation) => sum + BigInt(allocation.requestedAmount),
    0n,
  )
  if (total !== BigInt(requestedAmount)) {
    ctx.addIssue({
      code: 'custom',
      path: ['allocations'],
      message: 'allocation cents must exactly sum to the action requested amount',
    })
  }
}

export const withdrawalPurposeSchema = z
  .object({
    kind: z.enum(['spending', 'goal', 'taxPayment', 'other']),
    referenceId: nonBlankStringSchema.optional(),
  })
  .strict()
export type WithdrawalPurpose = z.infer<typeof withdrawalPurposeSchema>

export const conversionTaxFundingSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('linkedWithdrawal'),
      withdrawalActionId: actionIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('externalCash'),
      amount: positiveUsdCentsSchema,
      attested: z.literal(true),
    })
    .strict(),
  z.object({ kind: z.literal('noneExpected') }).strict(),
  z
    .object({
      kind: z.literal('conversionPrincipalWithholding'),
      amount: positiveUsdCentsSchema,
    })
    .strict(),
])
export type ConversionTaxFunding = z.infer<typeof conversionTaxFundingSchema>

export const qcdCharityDesignationSchema = z
  .object({
    designationId: nonBlankStringSchema,
    name: nonBlankStringSchema,
    designationKind: z.enum([
      'eligiblePublicCharity',
      'donorAdvisedFund',
      'supportingOrganization',
      'splitInterestEntity',
      'unknown',
    ]),
    directFromCustodianAttested: z.boolean(),
    eligibleOrganizationAttested: z.boolean(),
    notDonorAdvisedFundOrSupportingOrganizationAttested: z.boolean(),
    notSplitInterestEntityAttested: z.boolean(),
    entireDistributionOtherwiseDeductibleAttested: z.boolean(),
  })
  .strict()
export type QcdCharityDesignation = z.infer<typeof qcdCharityDesignationSchema>

export const ordinaryWithdrawalRequestSchema = z
  .object({
    ...retirementActionRequestBaseShape,
    kind: z.literal('ordinaryWithdrawal'),
    personId: personIdSchema,
    allocations: z.array(sourceAllocationRequestSchema).min(1),
    purpose: withdrawalPurposeSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    validateAllocations(request.allocations, request.requestedAmount, ctx)
  })
export type OrdinaryWithdrawalRequest = z.infer<typeof ordinaryWithdrawalRequestSchema>

export const rothConversionRequestSchema = z
  .object({
    ...retirementActionRequestBaseShape,
    kind: z.literal('rothConversion'),
    personId: personIdSchema,
    allocations: z.array(sourceAllocationRequestSchema).min(1),
    destinationRothAccountId: accountIdSchema,
    taxFunding: conversionTaxFundingSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    validateAllocations(request.allocations, request.requestedAmount, ctx)
  })
export type RothConversionRequest = z.infer<typeof rothConversionRequestSchema>

export const qualifiedCharitableDistributionRequestSchema = z
  .object({
    ...retirementActionRequestBaseShape,
    kind: z.literal('qcd'),
    donorPersonId: personIdSchema,
    allocation: sourceAllocationRequestSchema,
    charity: qcdCharityDesignationSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.allocation.requestedAmount !== request.requestedAmount) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocation', 'requestedAmount'],
        message: 'QCD allocation cents must exactly equal the action requested amount',
      })
    }
  })
export type QualifiedCharitableDistributionRequest = z.infer<
  typeof qualifiedCharitableDistributionRequestSchema
>

export const migrationActionProvenanceSchema = actionProvenanceSchema.extend({
  source: z.literal('migration'),
})
export type MigrationActionProvenance = z.infer<typeof migrationActionProvenanceSchema>

const legacyAggregateActionRequestBaseShape = {
  actionId: actionIdSchema,
  year: z.number().int().min(1).max(9999),
  requestedAmount: positiveUsdCentsSchema,
  provenance: migrationActionProvenanceSchema,
}

export const legacyAggregateWithdrawalRequestSchema = z
  .object({
    ...legacyAggregateActionRequestBaseShape,
    kind: z.literal('legacyAggregateWithdrawal'),
    legacyCategory: nonBlankStringSchema,
  })
  .strict()
export type LegacyAggregateWithdrawalRequest = z.infer<
  typeof legacyAggregateWithdrawalRequestSchema
>

export const legacyAggregateRothConversionRequestSchema = z
  .object({
    ...legacyAggregateActionRequestBaseShape,
    kind: z.literal('legacyAggregateRothConversion'),
  })
  .strict()
export type LegacyAggregateRothConversionRequest = z.infer<
  typeof legacyAggregateRothConversionRequestSchema
>

export const legacyAggregateQcdRequestSchema = z
  .object({
    ...legacyAggregateActionRequestBaseShape,
    kind: z.literal('legacyAggregateQcd'),
    legacyField: z.literal('qcdAnnual'),
  })
  .strict()
export type LegacyAggregateQcdRequest = z.infer<typeof legacyAggregateQcdRequestSchema>

export const retirementActionRequestSchema = z.discriminatedUnion('kind', [
  ordinaryWithdrawalRequestSchema,
  rothConversionRequestSchema,
  qualifiedCharitableDistributionRequestSchema,
  legacyAggregateWithdrawalRequestSchema,
  legacyAggregateRothConversionRequestSchema,
  legacyAggregateQcdRequestSchema,
])
export type RetirementActionRequest = z.infer<typeof retirementActionRequestSchema>

const persistedConversionTaxFundingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('linkedWithdrawal'),
    withdrawalActionId: actionIdSchema,
  }),
  z.object({
    kind: z.literal('externalCash'),
    amount: positiveUsdCentsSchema,
    attested: z.literal(true),
  }),
  z.object({ kind: z.literal('noneExpected') }),
  z.object({
    kind: z.literal('conversionPrincipalWithholding'),
    amount: positiveUsdCentsSchema,
  }),
])

const persistedRetirementActionRequestBaseShape = {
  ...retirementActionRequestBaseShape,
  provenance: actionProvenanceSchema.strip(),
}

const persistedLegacyAggregateActionRequestBaseShape = {
  ...legacyAggregateActionRequestBaseShape,
  provenance: migrationActionProvenanceSchema.strip(),
}

const persistedOrdinaryWithdrawalRequestSchema = z
  .object({
    ...persistedRetirementActionRequestBaseShape,
    kind: z.literal('ordinaryWithdrawal'),
    personId: personIdSchema,
    allocations: z.array(sourceAllocationRequestSchema.strip()).min(1),
    purpose: withdrawalPurposeSchema.strip(),
  })
  .superRefine((request, ctx) => {
    validateAllocations(request.allocations, request.requestedAmount, ctx)
  })

const persistedRothConversionRequestSchema = z
  .object({
    ...persistedRetirementActionRequestBaseShape,
    kind: z.literal('rothConversion'),
    personId: personIdSchema,
    allocations: z.array(sourceAllocationRequestSchema.strip()).min(1),
    destinationRothAccountId: accountIdSchema,
    taxFunding: persistedConversionTaxFundingSchema,
  })
  .superRefine((request, ctx) => {
    validateAllocations(request.allocations, request.requestedAmount, ctx)
  })

const persistedQualifiedCharitableDistributionRequestSchema = z
  .object({
    ...persistedRetirementActionRequestBaseShape,
    kind: z.literal('qcd'),
    donorPersonId: personIdSchema,
    allocation: sourceAllocationRequestSchema.strip(),
    charity: qcdCharityDesignationSchema.strip(),
  })
  .superRefine((request, ctx) => {
    if (request.allocation.requestedAmount !== request.requestedAmount) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocation', 'requestedAmount'],
        message: 'QCD allocation cents must exactly equal the action requested amount',
      })
    }
  })

/**
 * Persisted Plan objects follow the Plan contract's forward-compatible
 * unknown-key stripping, while direct action API parsing remains strict.
 */
export const persistedLegacyAggregateWithdrawalRequestSchema = z.object({
  ...persistedLegacyAggregateActionRequestBaseShape,
  kind: z.literal('legacyAggregateWithdrawal'),
  legacyCategory: nonBlankStringSchema,
})

export const persistedLegacyAggregateRothConversionRequestSchema = z.object({
  ...persistedLegacyAggregateActionRequestBaseShape,
  kind: z.literal('legacyAggregateRothConversion'),
})

export const persistedLegacyAggregateQcdRequestSchema = z.object({
  ...persistedLegacyAggregateActionRequestBaseShape,
  kind: z.literal('legacyAggregateQcd'),
  legacyField: z.literal('qcdAnnual'),
})

export const persistedRetirementActionRequestSchema = z.discriminatedUnion('kind', [
  persistedOrdinaryWithdrawalRequestSchema,
  persistedRothConversionRequestSchema,
  persistedQualifiedCharitableDistributionRequestSchema,
  persistedLegacyAggregateWithdrawalRequestSchema,
  persistedLegacyAggregateRothConversionRequestSchema,
  persistedLegacyAggregateQcdRequestSchema,
])

export type LegacyAggregateRetirementActionRequest =
  | LegacyAggregateWithdrawalRequest
  | LegacyAggregateRothConversionRequest
  | LegacyAggregateQcdRequest

export type ParseRetirementActionRequestResult =
  | { ok: true; request: RetirementActionRequest }
  | { ok: false; issues: string[] }

export function parseRetirementActionRequest(
  input: unknown,
): ParseRetirementActionRequestResult {
  const result = retirementActionRequestSchema.safeParse(input)
  if (result.success) return { ok: true as const, request: result.data }

  return {
    ok: false as const,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length === 0 ? '$' : issue.path.join('.')
      return `${path}: ${issue.message}`
    }),
  }
}

export type ActionOutcome = 'executed' | 'partial' | 'refused' | 'unsupported'
export type ActionReadiness = 'actionable' | 'nonActionable'

interface DispositionAmounts {
  requestedAmount: PositiveUsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
}

export type ExecutedActionDisposition = Readonly<
  DispositionAmounts & {
    outcome: 'executed'
    readiness: 'actionable'
    reasons: readonly ActionReason<TaxTreatmentAdjustmentReasonCode>[]
  }
>

export type PartialActionDisposition = Readonly<
  DispositionAmounts & {
    outcome: 'partial'
    readiness: 'actionable'
    reasons: readonly [
      ActionReason<PartialActionReasonCode>,
      ...ActionReason<TaxTreatmentAdjustmentReasonCode>[],
    ]
  }
>

export type RefusedActionDisposition = Readonly<
  DispositionAmounts & {
    outcome: 'refused'
    readiness: 'nonActionable'
    reasons: readonly [
      ActionReason<RefusedActionReasonCode>,
      ...ActionReason<RefusedActionReasonCode>[],
    ]
  }
>

export type UnsupportedActionDisposition = Readonly<
  DispositionAmounts & {
    outcome: 'unsupported'
    readiness: 'nonActionable'
    reasons: readonly [
      ActionReason<UnsupportedActionReasonCode>,
      ...ActionReason<UnsupportedActionReasonCode | RefusedActionReasonCode>[],
    ]
  }
>

export type ActionExecutionDisposition =
  | ExecutedActionDisposition
  | PartialActionDisposition
  | RefusedActionDisposition
  | UnsupportedActionDisposition

const dispositionAmountsShape = {
  requestedAmount: positiveUsdCentsSchema,
  executedAmount: usdCentsSchema,
  unexecutedAmount: usdCentsSchema,
}

const adjustedActionReasonSchema = actionReasonSchema.refine(
  (reason): reason is ActionReason<TaxTreatmentAdjustmentReasonCode> =>
    reason.outcome === 'adjusted',
  { message: 'Expected an adjusted action reason' },
)
const partialActionReasonSchema = actionReasonSchema.refine(
  (reason): reason is ActionReason<PartialActionReasonCode> => reason.outcome === 'partial',
  { message: 'Expected a physical trim action reason' },
)
const refusedActionReasonSchema = actionReasonSchema.refine(
  (reason): reason is ActionReason<RefusedActionReasonCode> => reason.outcome === 'refused',
  { message: 'Expected a refused action reason' },
)
const unsupportedActionReasonSchema = actionReasonSchema.refine(
  (reason): reason is ActionReason<UnsupportedActionReasonCode> =>
    reason.outcome === 'unsupported',
  { message: 'Expected an unsupported action reason' },
)
const blockingActionReasonSchema = actionReasonSchema.refine(
  (
    reason,
  ): reason is ActionReason<UnsupportedActionReasonCode | RefusedActionReasonCode> =>
    reason.outcome === 'unsupported' || reason.outcome === 'refused',
  { message: 'Expected an unsupported or refused action reason' },
)

const executedActionDispositionSchema = z
  .object({
    outcome: z.literal('executed'),
    readiness: z.literal('actionable'),
    ...dispositionAmountsShape,
    reasons: z.array(adjustedActionReasonSchema),
  })
  .strict()

const partialActionDispositionSchema = z
  .object({
    outcome: z.literal('partial'),
    readiness: z.literal('actionable'),
    ...dispositionAmountsShape,
    reasons: z.tuple([partialActionReasonSchema], adjustedActionReasonSchema),
  })
  .strict()

const refusedActionDispositionSchema = z
  .object({
    outcome: z.literal('refused'),
    readiness: z.literal('nonActionable'),
    ...dispositionAmountsShape,
    reasons: z.tuple([refusedActionReasonSchema], refusedActionReasonSchema),
  })
  .strict()

const unsupportedActionDispositionSchema = z
  .object({
    outcome: z.literal('unsupported'),
    readiness: z.literal('nonActionable'),
    ...dispositionAmountsShape,
    reasons: z.tuple([unsupportedActionReasonSchema], blockingActionReasonSchema),
  })
  .strict()

const validatedActionExecutionDispositionSchema = z
  .discriminatedUnion('outcome', [
    executedActionDispositionSchema,
    partialActionDispositionSchema,
    refusedActionDispositionSchema,
    unsupportedActionDispositionSchema,
  ])
  .superRefine((disposition, ctx) => {
    const validateAdjustedReasonOrder = (reasons: typeof disposition.reasons, startIndex: number) => {
      const canonicalOrder = [
        'qcd-person-limit-trimmed',
        'qcd-contribution-offset-applied',
        'qcd-taxable-amount-trimmed',
      ] as const
      let previousOrder = -1
      const seen = new Set<string>()

      reasons.slice(startIndex).forEach((reason, offset) => {
        if (reason.outcome !== 'adjusted') return
        const index = startIndex + offset
        const order = canonicalOrder.indexOf(
          reason.code as (typeof canonicalOrder)[number],
        )
        if (seen.has(reason.code)) {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index],
            message: 'QCD adjustment reasons may appear at most once',
          })
        } else if (order < previousOrder) {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index],
            message: 'QCD adjustment reasons must use canonical order',
          })
        }
        seen.add(reason.code)
        previousOrder = Math.max(previousOrder, order)
      })
    }

    if (
      BigInt(disposition.executedAmount) + BigInt(disposition.unexecutedAmount) !==
      BigInt(disposition.requestedAmount)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['unexecutedAmount'],
        message: 'Executed and unexecuted cents must exactly conserve the requested amount',
      })
    }

    if (disposition.outcome === 'executed') {
      if (disposition.executedAmount !== disposition.requestedAmount) {
        ctx.addIssue({
          code: 'custom',
          path: ['executedAmount'],
          message: 'An executed action must move the full requested amount',
        })
      }
      if (disposition.unexecutedAmount !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['unexecutedAmount'],
          message: 'An executed action cannot leave an unexecuted remainder',
        })
      }
      disposition.reasons.forEach((reason, index) => {
        if (reason.outcome !== 'adjusted') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index],
            message: 'Executed actions may contain only adjusted reasons',
          })
        }
      })
      validateAdjustedReasonOrder(disposition.reasons, 0)
      return
    }

    if (disposition.outcome === 'partial') {
      if (disposition.executedAmount === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['executedAmount'],
          message: 'A partial action must move a positive amount',
        })
      }
      if (disposition.unexecutedAmount === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['unexecutedAmount'],
          message: 'A partial action must leave a positive remainder',
        })
      }
      if (disposition.reasons.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['reasons'],
          message: 'A partial action requires a physical trim reason first',
        })
      } else {
        if (disposition.reasons[0]?.outcome !== 'partial') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', 0],
            message: 'The first partial-action reason must be a physical trim',
          })
        }
        disposition.reasons.slice(1).forEach((reason, index) => {
          if (reason.outcome !== 'adjusted') {
            ctx.addIssue({
              code: 'custom',
              path: ['reasons', index + 1],
              message: 'Reasons after a physical trim may only be adjustments',
            })
          }
        })
        validateAdjustedReasonOrder(disposition.reasons, 1)
      }
      return
    }

    if (disposition.executedAmount !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['executedAmount'],
        message: 'A non-actionable action cannot move money',
      })
    }
    if (disposition.unexecutedAmount !== disposition.requestedAmount) {
      ctx.addIssue({
        code: 'custom',
        path: ['unexecutedAmount'],
        message: 'A non-actionable action must retain the full requested amount',
      })
    }
    if (disposition.reasons.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasons'],
        message: `A ${disposition.outcome} action requires at least one reason`,
      })
      return
    }

    if (disposition.outcome === 'refused') {
      disposition.reasons.forEach((reason, index) => {
        if (reason.outcome !== 'refused') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index],
            message: 'Refused actions may contain only refused reasons',
          })
        }
      })
      return
    }

    if (disposition.reasons[0]?.outcome !== 'unsupported') {
      ctx.addIssue({
        code: 'custom',
        path: ['reasons', 0],
        message: 'The first unsupported-action reason must be unsupported',
      })
    }
    disposition.reasons.slice(1).forEach((reason, index) => {
      if (reason.outcome !== 'unsupported' && reason.outcome !== 'refused') {
        ctx.addIssue({
          code: 'custom',
          path: ['reasons', index + 1],
          message: 'Unsupported actions may retain only unsupported or refused reasons',
        })
      }
    })
  })

export const actionExecutionDispositionSchema: z.ZodType<ActionExecutionDisposition> =
  validatedActionExecutionDispositionSchema.transform(
    (disposition): ActionExecutionDisposition => disposition,
  )

export type ParseActionExecutionDispositionResult =
  | { ok: true; disposition: ActionExecutionDisposition }
  | { ok: false; issues: string[] }

export function parseActionExecutionDisposition(
  input: unknown,
): ParseActionExecutionDispositionResult {
  const result = actionExecutionDispositionSchema.safeParse(input)
  if (result.success) return { ok: true as const, disposition: result.data }

  return {
    ok: false as const,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length === 0 ? '$' : issue.path.join('.')
      return `${path}: ${issue.message}`
    }),
  }
}

export type RetirementActionIdentity = Readonly<{
  actionId: ActionId
  personId?: PersonId
  planId: PlanId
}>
