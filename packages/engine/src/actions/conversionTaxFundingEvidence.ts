import { z } from 'zod'

import {
  exactCentLargestRemainderSlices,
  exactCentNearestHalfUp,
} from './exactCentProRata.js'
import {
  actionIdSchema,
  personIdSchema,
  type ActionId,
  type PersonId,
} from './identity.js'
import { usdCentsSchema, type UsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

/**
 * The record a conversion's tax funding has to produce before anyone may claim
 * the funding was proved: what the filing unit's annual liability was without
 * the conversions, what it was with them, what that difference costs in whole
 * cents, which share of it this conversion owes, and what was actually funded
 * against that share.
 *
 * Nothing in the engine calls this module. That is deliberate and load-bearing,
 * not an oversight to be tidied up:
 *
 * - The two liability figures are inputs, never derived here. `T0` — the
 *   filing unit's annual liability recomputed with the conversions removed —
 *   has no producer anywhere in the engine. Until the annual second pass that
 *   computes it exists, no caller can supply an honest pair, so no caller can
 *   build a record that says funding was satisfied. The types can express
 *   satisfaction because expressing satisfaction is the entire point of a
 *   fixed-point record; a version that could only say "nothing was computed"
 *   would have to be rewritten by the slice that finally computes something.
 * - The gate that keeps money still is elsewhere and is untouched:
 *   `ConversionLinkedWithdrawalGroupDisposition` still has exactly one member
 *   and cannot express permission, and `committedTaxFunding` in
 *   `rothConversionExecution.ts` still publishes `unsupported` with null
 *   figures for the linked-withdrawal arm. Neither reads anything below.
 * - This module is not exported from `actions/index.ts` and is not a package
 *   subpath, so nothing outside the engine can reach it either. The slice that
 *   writes the first consumer publishes it.
 *
 * Two conventions differ from the specification this implements, and both are
 * the surrounding code's conventions rather than deviations of convenience.
 * Every amount is an exact integer `UsdCents`, with `currencyMinorUnit` carried
 * as a declaration of the unit those integers are counted in rather than as a
 * scale anyone multiplies by: quantities in dollars would reintroduce exactly
 * the binary floating point the quantization rule below exists to forbid. And
 * the residual cent is settled by largest remainder, the money rule the rest of
 * the engine already uses, not by walking members in scheduled order — see
 * `exactCentLargestRemainderSlices`, whose tie-break by position is what makes
 * scheduled order still decide the cases where the arithmetic does not.
 *
 * The `annualGroupId` here is not the `groupId` on
 * `ConversionLinkedWithdrawalGroupVerdict`. That one names a single
 * conversion/withdrawal pair. This one names every conversion a filing unit
 * makes in one tax year, because the liability being allocated is annual and
 * belongs to the unit, not to a pair.
 */

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, { message: 'Value must not be blank' })

/**
 * A signed whole number of cents.
 *
 * `UsdCents` is nonnegative by construction, which is right for an amount and
 * wrong for the difference between two of them: the whole use of a mismatch
 * difference is that its sign says whether funding fell short or overshot.
 * Declared here rather than in `money.ts` because no other caller has wanted a
 * signed cent yet, and a shared signed type is a decision for the first module
 * that needs it in a published shape.
 */
const signedCentDifferenceSchema = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .refine((value) => !Object.is(value, -0), { message: 'Difference must not be negative zero' })

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let larger = left < 0n ? -left : left
  let smaller = right < 0n ? -right : right
  while (smaller !== 0n) {
    const next = larger % smaller
    larger = smaller
    smaller = next
  }
  return larger
}

/**
 * A nonnegative quantity of cents that is not necessarily a whole number of
 * them.
 *
 * A modeled annual tax liability is the output of bracket arithmetic on
 * phase-outs and rate schedules, and lands on a fractional cent routinely. It
 * cannot be stored as a `UsdCents` without rounding it, and rounding it before
 * the two liabilities are subtracted would round twice — which is the one thing
 * the quantization rule forbids, because two roundings can differ from one by a
 * cent, and that cent then propagates into every allocated share.
 *
 * Held as an exact rational so the subtraction is exact and the single rounding
 * happens where the rule says it does. `denominator` is a count, not an amount,
 * which is why it is not `UsdCents`. The pair is always in lowest terms: an
 * amount with two spellings would make two members of one group carrying the
 * same liability compare unequal, and cross-member identity is checked by
 * comparing these fields.
 */
export interface ConversionTaxFundingExactCentAmount {
  readonly representation: 'exactRationalMinorUnits'
  readonly numeratorMinorUnits: UsdCents
  readonly denominator: number
  readonly intermediateArithmetic: 'bigintRational'
}

const conversionTaxFundingExactCentAmountSchema = z
  .object({
    representation: z.literal('exactRationalMinorUnits'),
    numeratorMinorUnits: usdCentsSchema,
    denominator: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    intermediateArithmetic: z.literal('bigintRational'),
  })
  .strict()
  .superRefine((amount, ctx) => {
    if (
      greatestCommonDivisor(
        BigInt(amount.numeratorMinorUnits),
        BigInt(amount.denominator),
      ) !== 1n
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['denominator'],
        message: 'An exact cent quantity must be in lowest terms',
      })
    }
  })

/**
 * The five federal statuses, declared here rather than imported from
 * `taxableWithdrawalCharacter.ts`.
 *
 * The values are the same and the duplication is deliberate. A conversion's
 * funding evidence borrowing a type named for taxable withdrawals would say
 * that the two are one concept, and the next change to either would have to
 * decide whose it is. They are two readings of the same statute by two
 * unrelated calculations, and the workstream keeps refusing borrowed identity.
 */
export type ConversionTaxFundingFederalFilingStatus =
  | 'single'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'headOfHousehold'
  | 'qualifyingSurvivingSpouse'

const conversionTaxFundingFederalFilingStatusSchema = z.enum([
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
])

/**
 * Which filing unit owes the liability being allocated.
 *
 * Keyed by an immutable `taxUnitId` plus the tax year, not by household
 * membership or current relationship. A joint-to-separate change, a
 * separate-to-joint change, a divorce, a death, a dependency change or a
 * domicile change all produce a different filing unit, and a different filing
 * unit's liability evidence is not this one's — reusing it would allocate one
 * unit's tax bill across another unit's conversions and still balance to the
 * cent, which is precisely why the identity is checked rather than inferred
 * from the arithmetic coming out even.
 */
export interface ConversionTaxFundingTaxUnitEvidence {
  readonly taxUnitId: string
  readonly taxYear: number
  readonly federalFilingStatus: ConversionTaxFundingFederalFilingStatus
  readonly stateFilingStatusId: string
  readonly taxUnitEvidenceId: string
  readonly taxUnitMemberPersonIds: readonly [PersonId, ...PersonId[]]
}

const conversionTaxFundingTaxUnitEvidenceSchema = z
  .object({
    taxUnitId: nonBlankStringSchema,
    taxYear: z.number().int().min(1).max(9999),
    federalFilingStatus: conversionTaxFundingFederalFilingStatusSchema,
    stateFilingStatusId: nonBlankStringSchema,
    taxUnitEvidenceId: nonBlankStringSchema,
    taxUnitMemberPersonIds: z.tuple([personIdSchema], personIdSchema),
  })
  .strict()
  .superRefine((taxUnit, ctx) => {
    const seen = new Set<string>()
    taxUnit.taxUnitMemberPersonIds.forEach((personId, index) => {
      if (seen.has(personId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxUnitMemberPersonIds', index],
          message: `duplicate tax unit member "${personId}"`,
        })
      }
      seen.add(personId)
    })
  })

/**
 * The stable identity of one filing unit's conversions in one tax year.
 *
 * Derived rather than supplied so two records claiming the same group cannot
 * disagree about which unit and year they belong to: the identifier is a
 * function of the unit and the year, and every record's is re-derived when it
 * is parsed. Kept module-internal because `deriveActionStructuralId` is
 * package-internal and stripped from the published declarations; only the
 * resulting string crosses the module boundary.
 */
function deriveConversionTaxFundingAnnualGroupId(
  taxUnitId: string,
  taxYear: number,
): string {
  return deriveActionStructuralId(
    'retirement-action-conversion-tax-funding-annual-group',
    [taxUnitId, taxYear],
  )
}

/**
 * The shared identity and arithmetic every evaluation carries, whichever answer
 * it reaches.
 *
 * The two arms below extend this rather than intersecting with it, because a
 * union of intersections cannot be discriminated and a record that could be
 * read as either arm is the one thing this contract must not admit.
 */
export interface ConversionTaxFundingEvaluationEvidenceBase {
  /** Derived from the tax unit and year; see the derivation above. */
  readonly annualGroupId: string
  readonly taxUnit: Readonly<ConversionTaxFundingTaxUnitEvidence>
  readonly conversionActionId: ActionId
  /** Always a member of `taxUnit.taxUnitMemberPersonIds`. */
  readonly conversionPersonId: PersonId
  readonly baselineAnnualTaxLiabilityEvidenceId: string
  readonly candidateAnnualTaxLiabilityEvidenceId: string
  /** `T0`: the unit's annual liability with the conversions removed. */
  readonly baselineAnnualTaxLiability: Readonly<ConversionTaxFundingExactCentAmount>
  /** `T1(F)`: the unit's annual liability with them, funded as stated. */
  readonly candidateAnnualTaxLiability: Readonly<ConversionTaxFundingExactCentAmount>
  /** `max(0, T1(F) - T0)`, exact and unrounded. */
  readonly unquantizedAnnualGroupRequiredFundingAmount:
    Readonly<ConversionTaxFundingExactCentAmount>
  /** The one and only rounding: nearest cent, exact half up. */
  readonly annualGroupRequiredFundingAmount: UsdCents
  readonly annualGroupFundedAmount: UsdCents
  /** The unit these integers count, declared rather than multiplied by. */
  readonly currencyMinorUnit: 0.01
  readonly liabilityQuantization: 'nearestCentHalfUp'
  /** Unique and contiguous from one across the group, in scheduled order. */
  readonly allocationOrder: number
  /** This conversion's finalized taxable principal after the basis post-pass. */
  readonly allocationWeight: UsdCents
  /** This conversion's share of the quantized group amount. */
  readonly requiredFundingAmount: UsdCents
  readonly fundedAmount: UsdCents
}

/**
 * Accepted equality, and nothing else.
 *
 * Every difference is a literal zero rather than a number that happens to be
 * zero, so a record cannot be built as satisfied and then edited into a
 * shortfall without changing its type. Both equalities are asserted at once:
 * this conversion funded its own share exactly, and the group funded the whole
 * quantized liability exactly. A member that funded its own share while the
 * unit's liability went unpaid is not satisfied, because the liability being
 * allocated is the unit's and it is still owed.
 */
export interface ConversionTaxFundingFixedPointEvidence
  extends ConversionTaxFundingEvaluationEvidenceBase {
  readonly evaluation: 'satisfied'
  readonly fundingEquality: 'exactCentQuantized'
  readonly fundedAmountDifference: 0
  readonly annualGroupFundedAmountDifference: 0
}

/**
 * Which of the two equalities failed.
 *
 * `annualGroupOnly` is the case worth naming: this conversion funded its own
 * allocated share to the cent and the group total is still wrong, because a
 * peer conversion in the same filing unit and year did not. It is why the group
 * figures are on every member's record rather than on a separate group record
 * nobody would be forced to read. `memberOnly` is its mirror — this member's
 * own share is off while the group total balances, which happens when two
 * peers' errors offset — and it is still a mismatch, because per-member
 * fidelity is what makes each conversion individually executable.
 */
export type ConversionTaxFundingMismatchKind =
  | 'memberOnly'
  | 'annualGroupOnly'
  | 'memberAndAnnualGroup'

/**
 * Funding that does not balance, with the signed cents by which it does not.
 *
 * The funded figures here are staged candidate diagnostics. A mismatch record
 * describes money that was not proved to have moved, so it can never accompany
 * actionable conversion evidence; a positive difference is an overshoot and a
 * negative one a shortfall, and neither is a fixed point.
 */
export interface ConversionTaxFundingMismatchEvidence
  extends ConversionTaxFundingEvaluationEvidenceBase {
  readonly evaluation: 'mismatch'
  readonly fundingEquality: 'notEqual'
  /** `fundedAmount - requiredFundingAmount`. */
  readonly fundedAmountDifference: number
  /** `annualGroupFundedAmount - annualGroupRequiredFundingAmount`. */
  readonly annualGroupFundedAmountDifference: number
  readonly mismatchKind: ConversionTaxFundingMismatchKind
}

export type ConversionTaxFundingEvidence =
  | Readonly<ConversionTaxFundingFixedPointEvidence>
  | Readonly<ConversionTaxFundingMismatchEvidence>

const conversionTaxFundingEvaluationEvidenceBaseShape = {
  annualGroupId: nonBlankStringSchema,
  taxUnit: conversionTaxFundingTaxUnitEvidenceSchema,
  conversionActionId: actionIdSchema,
  conversionPersonId: personIdSchema,
  baselineAnnualTaxLiabilityEvidenceId: nonBlankStringSchema,
  candidateAnnualTaxLiabilityEvidenceId: nonBlankStringSchema,
  baselineAnnualTaxLiability: conversionTaxFundingExactCentAmountSchema,
  candidateAnnualTaxLiability: conversionTaxFundingExactCentAmountSchema,
  unquantizedAnnualGroupRequiredFundingAmount: conversionTaxFundingExactCentAmountSchema,
  annualGroupRequiredFundingAmount: usdCentsSchema,
  annualGroupFundedAmount: usdCentsSchema,
  currencyMinorUnit: z.literal(0.01),
  liabilityQuantization: z.literal('nearestCentHalfUp'),
  allocationOrder: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  allocationWeight: usdCentsSchema,
  requiredFundingAmount: usdCentsSchema,
  fundedAmount: usdCentsSchema,
}

const conversionTaxFundingFixedPointEvidenceSchema = z
  .object({
    ...conversionTaxFundingEvaluationEvidenceBaseShape,
    evaluation: z.literal('satisfied'),
    fundingEquality: z.literal('exactCentQuantized'),
    fundedAmountDifference: z.literal(0),
    annualGroupFundedAmountDifference: z.literal(0),
  })
  .strict()

const conversionTaxFundingMismatchEvidenceSchema = z
  .object({
    ...conversionTaxFundingEvaluationEvidenceBaseShape,
    evaluation: z.literal('mismatch'),
    fundingEquality: z.literal('notEqual'),
    fundedAmountDifference: signedCentDifferenceSchema,
    annualGroupFundedAmountDifference: signedCentDifferenceSchema,
    mismatchKind: z.enum(['memberOnly', 'annualGroupOnly', 'memberAndAnnualGroup']),
  })
  .strict()

interface ExactCentRational {
  readonly numerator: bigint
  readonly denominator: bigint
}

function reduceExactCentRational(
  numerator: bigint,
  denominator: bigint,
): ExactCentRational {
  if (numerator === 0n) return { numerator: 0n, denominator: 1n }
  const divisor = greatestCommonDivisor(numerator, denominator)
  return { numerator: numerator / divisor, denominator: denominator / divisor }
}

function exactCentRational(
  amount: Readonly<ConversionTaxFundingExactCentAmount>,
): ExactCentRational {
  return {
    numerator: BigInt(amount.numeratorMinorUnits),
    denominator: BigInt(amount.denominator),
  }
}

/**
 * `max(0, candidate - baseline)`, in lowest terms.
 *
 * Cross-multiplied in `bigint` because the intermediate product of two cent
 * counts and two denominators leaves the safe-integer range long before either
 * input does, and a subtraction that silently loses precision here is a
 * liability that is wrong by an amount nobody can see.
 */
function unquantizedGroupRequirement(
  baseline: ExactCentRational,
  candidate: ExactCentRational,
): ExactCentRational {
  const numerator = candidate.numerator * baseline.denominator -
    baseline.numerator * candidate.denominator
  if (numerator <= 0n) return { numerator: 0n, denominator: 1n }
  return reduceExactCentRational(numerator, candidate.denominator * baseline.denominator)
}

function sameExactCentAmount(
  left: Readonly<ConversionTaxFundingExactCentAmount>,
  right: Readonly<ConversionTaxFundingExactCentAmount>,
): boolean {
  return left.numeratorMinorUnits === right.numeratorMinorUnits &&
    left.denominator === right.denominator
}

function mismatchKindFor(
  memberDifference: bigint,
  groupDifference: bigint,
): ConversionTaxFundingMismatchKind | null {
  if (memberDifference !== 0n && groupDifference !== 0n) return 'memberAndAnnualGroup'
  if (memberDifference !== 0n) return 'memberOnly'
  if (groupDifference !== 0n) return 'annualGroupOnly'
  return null
}

/**
 * The cross-field arithmetic no per-field schema can state.
 *
 * Everything checked here is a relationship between fields that a caller could
 * otherwise assert independently and get wrong: that the unrounded requirement
 * really is the difference of the two liabilities, that the quantized one
 * really is that difference rounded once, that each difference really is the
 * subtraction it claims to be, that the discriminant agrees with the
 * arithmetic, and that the record belongs to the filing unit it names.
 */
function validateConversionTaxFundingEvidence(
  evidence: z.infer<typeof conversionTaxFundingFixedPointEvidenceSchema> |
    z.infer<typeof conversionTaxFundingMismatchEvidenceSchema>,
  ctx: z.RefinementCtx,
): void {
  const expectedGroupId = deriveConversionTaxFundingAnnualGroupId(
    evidence.taxUnit.taxUnitId,
    evidence.taxUnit.taxYear,
  )
  if (evidence.annualGroupId !== expectedGroupId) {
    ctx.addIssue({
      code: 'custom',
      path: ['annualGroupId'],
      message: 'The annual group id must be derived from its tax unit and tax year',
    })
  }

  if (!evidence.taxUnit.taxUnitMemberPersonIds.includes(evidence.conversionPersonId)) {
    ctx.addIssue({
      code: 'custom',
      path: ['conversionPersonId'],
      message: 'The converting person must be a member of the named tax unit',
    })
  }

  const expectedUnquantized = unquantizedGroupRequirement(
    exactCentRational(evidence.baselineAnnualTaxLiability),
    exactCentRational(evidence.candidateAnnualTaxLiability),
  )
  const unquantized = exactCentRational(evidence.unquantizedAnnualGroupRequiredFundingAmount)
  if (
    unquantized.numerator !== expectedUnquantized.numerator ||
    unquantized.denominator !== expectedUnquantized.denominator
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['unquantizedAnnualGroupRequiredFundingAmount'],
      message:
        'The unrounded group requirement must be the candidate liability less the baseline, floored at zero',
    })
  }

  const expectedQuantized = exactCentNearestHalfUp(
    unquantized.numerator,
    unquantized.denominator,
  )
  if (BigInt(evidence.annualGroupRequiredFundingAmount) !== expectedQuantized) {
    ctx.addIssue({
      code: 'custom',
      path: ['annualGroupRequiredFundingAmount'],
      message: 'The group requirement must be its unrounded amount at the nearest cent, half up',
    })
  }

  const memberDifference = BigInt(evidence.fundedAmount) -
    BigInt(evidence.requiredFundingAmount)
  if (BigInt(evidence.fundedAmountDifference) !== memberDifference) {
    ctx.addIssue({
      code: 'custom',
      path: ['fundedAmountDifference'],
      message: 'The member difference must be the funded amount less the required amount',
    })
  }

  const groupDifference = BigInt(evidence.annualGroupFundedAmount) -
    BigInt(evidence.annualGroupRequiredFundingAmount)
  if (BigInt(evidence.annualGroupFundedAmountDifference) !== groupDifference) {
    ctx.addIssue({
      code: 'custom',
      path: ['annualGroupFundedAmountDifference'],
      message:
        'The group difference must be the group funded amount less the group required amount',
    })
  }

  // A weightless conversion owes nothing. Largest remainder never hands a
  // zero-weight part a cent, so a record claiming one did not come from this
  // module's allocation.
  if (evidence.allocationWeight === 0 && evidence.requiredFundingAmount !== 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['requiredFundingAmount'],
      message: 'A conversion with no taxable principal cannot be allocated a requirement',
    })
  }

  const expectedKind = mismatchKindFor(memberDifference, groupDifference)
  if (evidence.evaluation === 'mismatch') {
    if (expectedKind === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['evaluation'],
        message: 'A mismatch requires a nonzero member or group difference',
      })
    } else if (evidence.mismatchKind !== expectedKind) {
      ctx.addIssue({
        code: 'custom',
        path: ['mismatchKind'],
        message: `The mismatch kind must be "${expectedKind}" for these differences`,
      })
    }
  }
}

const validatedConversionTaxFundingEvidenceSchema = z
  .discriminatedUnion('evaluation', [
    conversionTaxFundingFixedPointEvidenceSchema,
    conversionTaxFundingMismatchEvidenceSchema,
  ])
  .superRefine(validateConversionTaxFundingEvidence)

export const conversionTaxFundingEvidenceSchema: z.ZodType<ConversionTaxFundingEvidence> =
  validatedConversionTaxFundingEvidenceSchema.transform(
    (evidence): ConversionTaxFundingEvidence => evidence,
  )

export type ParseConversionTaxFundingEvidenceResult =
  | { ok: true; evidence: ConversionTaxFundingEvidence }
  | { ok: false; issues: string[] }

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length === 0 ? '$' : issue.path.join('.')
    return `${path}: ${issue.message}`
  })
}

export function parseConversionTaxFundingEvidence(
  input: unknown,
): ParseConversionTaxFundingEvidenceResult {
  const result = conversionTaxFundingEvidenceSchema.safeParse(input)
  if (result.success) return { ok: true as const, evidence: result.data }

  return { ok: false as const, issues: formatIssues(result.error) }
}

type ValidatedConversionTaxFundingEvidence = z.infer<
  typeof validatedConversionTaxFundingEvidenceSchema
>

/**
 * The fields every member of one annual group must carry identically, and the
 * message naming each when it disagrees.
 *
 * These are the group's own facts, repeated on every member so that a member
 * read on its own still states which liability it was allocated out of. Repeated
 * facts can drift, and a drifted one is how two filing units' liabilities end up
 * mixed in a group that still sums correctly.
 */
const annualGroupIdenticalFields = [
  ['annualGroupId', 'annual group id'],
  ['baselineAnnualTaxLiabilityEvidenceId', 'baseline liability evidence id'],
  ['candidateAnnualTaxLiabilityEvidenceId', 'candidate liability evidence id'],
  ['annualGroupRequiredFundingAmount', 'group required amount'],
  ['annualGroupFundedAmount', 'group funded amount'],
  ['annualGroupFundedAmountDifference', 'group difference'],
  ['currencyMinorUnit', 'currency minor unit'],
  ['liabilityQuantization', 'liability quantization'],
] as const

const annualGroupIdenticalAmountFields = [
  ['baselineAnnualTaxLiability', 'baseline liability'],
  ['candidateAnnualTaxLiability', 'candidate liability'],
  ['unquantizedAnnualGroupRequiredFundingAmount', 'unrounded group requirement'],
] as const

function validateAnnualGroupIdentity(
  members: readonly ValidatedConversionTaxFundingEvidence[],
  ctx: z.RefinementCtx,
): void {
  const first = members[0]
  if (first === undefined) return

  members.forEach((member, index) => {
    if (index === 0) return
    for (const [field, label] of annualGroupIdenticalFields) {
      if (member[field] !== first[field]) {
        ctx.addIssue({
          code: 'custom',
          path: [index, field],
          message: `Every member of one annual group must carry the same ${label}`,
        })
      }
    }
    for (const [field, label] of annualGroupIdenticalAmountFields) {
      if (!sameExactCentAmount(member[field], first[field])) {
        ctx.addIssue({
          code: 'custom',
          path: [index, field],
          message: `Every member of one annual group must carry the same ${label}`,
        })
      }
    }
    const taxUnit = member.taxUnit
    const expected = first.taxUnit
    if (
      taxUnit.taxUnitId !== expected.taxUnitId ||
      taxUnit.taxYear !== expected.taxYear ||
      taxUnit.federalFilingStatus !== expected.federalFilingStatus ||
      taxUnit.stateFilingStatusId !== expected.stateFilingStatusId ||
      taxUnit.taxUnitEvidenceId !== expected.taxUnitEvidenceId ||
      taxUnit.taxUnitMemberPersonIds.length !== expected.taxUnitMemberPersonIds.length ||
      taxUnit.taxUnitMemberPersonIds.some(
        (personId, position) => personId !== expected.taxUnitMemberPersonIds[position],
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'taxUnit'],
        message: 'Every member of one annual group must carry the same tax unit',
      })
    }
  })

  const conversionActionIds = new Set<string>()
  members.forEach((member, index) => {
    if (conversionActionIds.has(member.conversionActionId)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'conversionActionId'],
        message: `duplicate group member "${member.conversionActionId}"`,
      })
    }
    conversionActionIds.add(member.conversionActionId)

    if (member.allocationOrder !== index + 1) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'allocationOrder'],
        message: 'Allocation order must be unique and contiguous from one in scheduled order',
      })
    }
  })
}

function validateAnnualGroupAllocation(
  members: readonly ValidatedConversionTaxFundingEvidence[],
  ctx: z.RefinementCtx,
): void {
  const first = members[0]
  if (first === undefined) return

  const groupRequired = BigInt(first.annualGroupRequiredFundingAmount)
  const weights = members.map((member) => BigInt(member.allocationWeight))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n)
  if (groupRequired > 0n && totalWeight === 0n) {
    // Fail closed. A positive liability with nothing to allocate it against has
    // no pro-rata answer at all, and zero for everyone would publish "no
    // conversion owes any of this tax" about a tax that is owed.
    ctx.addIssue({
      code: 'custom',
      path: [0, 'allocationWeight'],
      message: 'A positive group requirement cannot be allocated across zero total weight',
    })
    return
  }

  const expected = exactCentLargestRemainderSlices(groupRequired, weights)
  members.forEach((member, index) => {
    if (BigInt(member.requiredFundingAmount) !== expected[index]) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'requiredFundingAmount'],
        message: 'Allocated cents must be the largest-remainder share of the group requirement',
      })
    }
  })

  const totalFunded = members.reduce((sum, member) => sum + BigInt(member.fundedAmount), 0n)
  if (totalFunded !== BigInt(first.annualGroupFundedAmount)) {
    ctx.addIssue({
      code: 'custom',
      path: [0, 'annualGroupFundedAmount'],
      message: 'Member funded cents must exactly sum to the group funded amount',
    })
  }
}

const validatedConversionTaxFundingAnnualGroupSchema = z
  .array(validatedConversionTaxFundingEvidenceSchema)
  .min(1)
  .superRefine((members, ctx) => {
    validateAnnualGroupIdentity(members, ctx)
    validateAnnualGroupAllocation(members, ctx)
  })

export type ConversionTaxFundingAnnualGroupEvidence = readonly [
  ConversionTaxFundingEvidence,
  ...ConversionTaxFundingEvidence[],
]

export type ParseConversionTaxFundingAnnualGroupResult =
  | { ok: true; members: ConversionTaxFundingAnnualGroupEvidence }
  | { ok: false; issues: string[] }

/**
 * Parse a whole annual group, which is the only level at which most of this
 * contract can be checked.
 *
 * A single record cannot know whether its allocated share is the right share:
 * that depends on every other member's weight. Nor can it know whether the
 * group's repeated facts agree, or whether its allocation order is contiguous.
 * A caller that parses records one at a time has verified the arithmetic inside
 * each and nothing about the group they claim to belong to.
 *
 * Members must arrive in scheduled date and sequence order, which is what
 * `allocationOrder` is checked against.
 */
export function parseConversionTaxFundingAnnualGroup(
  input: unknown,
): ParseConversionTaxFundingAnnualGroupResult {
  const result = validatedConversionTaxFundingAnnualGroupSchema.safeParse(input)
  if (!result.success) return { ok: false as const, issues: formatIssues(result.error) }

  const parsed: readonly ConversionTaxFundingEvidence[] = result.data
  const [head, ...rest] = parsed
  if (head === undefined) {
    return { ok: false as const, issues: ['$: An annual group must have at least one member'] }
  }
  return { ok: true as const, members: [head, ...rest] }
}

/** One conversion the annual liability has to be allocated across. */
export interface ConversionTaxFundingAnnualGroupMemberInput {
  readonly conversionActionId: ActionId
  readonly conversionPersonId: PersonId
  /** Finalized taxable conversion principal after the annual basis post-pass. */
  readonly allocationWeight: UsdCents
  readonly fundedAmount: UsdCents
}

/**
 * Everything the group evaluation needs and none of it computed here.
 *
 * Both liabilities are the caller's to supply. That is the boundary this slice
 * stops at: the annual second pass that recomputes a filing unit's liability
 * with the conversions removed does not exist, so there is no engine caller
 * that can fill these in, and no engine caller that can therefore build a
 * satisfied record.
 */
export interface BuildConversionTaxFundingAnnualGroupInput {
  readonly taxUnit: Readonly<ConversionTaxFundingTaxUnitEvidence>
  readonly baselineAnnualTaxLiabilityEvidenceId: string
  readonly candidateAnnualTaxLiabilityEvidenceId: string
  readonly baselineAnnualTaxLiability: Readonly<ConversionTaxFundingExactCentAmount>
  readonly candidateAnnualTaxLiability: Readonly<ConversionTaxFundingExactCentAmount>
  /** In scheduled date and sequence order, which fixes `allocationOrder`. */
  readonly members: readonly ConversionTaxFundingAnnualGroupMemberInput[]
}

const buildConversionTaxFundingAnnualGroupInputSchema = z
  .object({
    taxUnit: conversionTaxFundingTaxUnitEvidenceSchema,
    baselineAnnualTaxLiabilityEvidenceId: nonBlankStringSchema,
    candidateAnnualTaxLiabilityEvidenceId: nonBlankStringSchema,
    baselineAnnualTaxLiability: conversionTaxFundingExactCentAmountSchema,
    candidateAnnualTaxLiability: conversionTaxFundingExactCentAmountSchema,
    members: z
      .array(
        z
          .object({
            conversionActionId: actionIdSchema,
            conversionPersonId: personIdSchema,
            allocationWeight: usdCentsSchema,
            fundedAmount: usdCentsSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export type BuildConversionTaxFundingAnnualGroupResult =
  | { ok: true; members: ConversionTaxFundingAnnualGroupEvidence }
  | { ok: false; issues: string[] }

function exactCentAmountFrom(
  rational: ExactCentRational,
): ConversionTaxFundingExactCentAmount | null {
  if (
    rational.numerator > BigInt(Number.MAX_SAFE_INTEGER) ||
    rational.denominator > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return null
  }
  return {
    representation: 'exactRationalMinorUnits',
    numeratorMinorUnits: usdCentsSchema.parse(Number(rational.numerator)),
    denominator: Number(rational.denominator),
    intermediateArithmetic: 'bigintRational',
  }
}

/**
 * Build one filing unit's annual funding evaluation from two liabilities and
 * the conversions they are owed by.
 *
 * The order of operations is the whole of the money rule and is not
 * rearrangeable. The two liabilities are subtracted exactly, the difference is
 * quantized to whole cents once, and only then is the quantized amount split.
 * Rounding each conversion's share on its own instead would let the shares miss
 * the group total by a cent per member, and the shares are what a household is
 * told it must pay.
 *
 * Non-throwing: a caller supplying an unusable pair of liabilities gets the
 * reasons back rather than an exception.
 */
export function buildConversionTaxFundingAnnualGroupEvidence(
  input: unknown,
): BuildConversionTaxFundingAnnualGroupResult {
  const parsed = buildConversionTaxFundingAnnualGroupInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, issues: formatIssues(parsed.error) }

  const request = parsed.data
  const issues: string[] = []
  request.members.forEach((member, index) => {
    if (!request.taxUnit.taxUnitMemberPersonIds.includes(member.conversionPersonId)) {
      issues.push(
        `members.${index}.conversionPersonId: ` +
          'The converting person must be a member of the named tax unit',
      )
    }
  })
  const conversionActionIds = new Set<string>()
  request.members.forEach((member, index) => {
    if (conversionActionIds.has(member.conversionActionId)) {
      issues.push(
        `members.${index}.conversionActionId: duplicate group member ` +
          `"${member.conversionActionId}"`,
      )
    }
    conversionActionIds.add(member.conversionActionId)
  })

  const unquantized = unquantizedGroupRequirement(
    exactCentRational(request.baselineAnnualTaxLiability),
    exactCentRational(request.candidateAnnualTaxLiability),
  )
  const unquantizedAmount = exactCentAmountFrom(unquantized)
  if (unquantizedAmount === null) {
    issues.push(
      'candidateAnnualTaxLiability: The unrounded group requirement is not exactly ' +
        'representable in safe integers',
    )
  }
  const quantized = exactCentNearestHalfUp(unquantized.numerator, unquantized.denominator)
  if (quantized > BigInt(Number.MAX_SAFE_INTEGER)) {
    issues.push(
      'candidateAnnualTaxLiability: The group requirement exceeds the safe integer range',
    )
  }

  const weights = request.members.map((member) => BigInt(member.allocationWeight))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n)
  if (quantized > 0n && totalWeight === 0n) {
    issues.push(
      'members: A positive group requirement cannot be allocated across zero total weight',
    )
  }

  const totalFunded = request.members.reduce(
    (sum, member) => sum + BigInt(member.fundedAmount),
    0n,
  )
  if (totalFunded > BigInt(Number.MAX_SAFE_INTEGER)) {
    issues.push('members: The group funded amount exceeds the safe integer range')
  }

  if (issues.length > 0 || unquantizedAmount === null) {
    return { ok: false as const, issues }
  }

  const annualGroupRequiredFundingAmount = usdCentsSchema.parse(Number(quantized))
  const annualGroupFundedAmount = usdCentsSchema.parse(Number(totalFunded))
  const groupDifference = Number(totalFunded - quantized)
  const allocated = exactCentLargestRemainderSlices(quantized, weights)
  const annualGroupId = deriveConversionTaxFundingAnnualGroupId(
    request.taxUnit.taxUnitId,
    request.taxUnit.taxYear,
  )

  const members = request.members.map((member, index): ConversionTaxFundingEvidence => {
    const requiredFundingAmount = usdCentsSchema.parse(Number(allocated[index]))
    const memberDifference = member.fundedAmount - requiredFundingAmount
    const base = {
      annualGroupId,
      taxUnit: request.taxUnit,
      conversionActionId: member.conversionActionId,
      conversionPersonId: member.conversionPersonId,
      baselineAnnualTaxLiabilityEvidenceId: request.baselineAnnualTaxLiabilityEvidenceId,
      candidateAnnualTaxLiabilityEvidenceId: request.candidateAnnualTaxLiabilityEvidenceId,
      baselineAnnualTaxLiability: request.baselineAnnualTaxLiability,
      candidateAnnualTaxLiability: request.candidateAnnualTaxLiability,
      unquantizedAnnualGroupRequiredFundingAmount: unquantizedAmount,
      annualGroupRequiredFundingAmount,
      annualGroupFundedAmount,
      currencyMinorUnit: 0.01 as const,
      liabilityQuantization: 'nearestCentHalfUp' as const,
      allocationOrder: index + 1,
      allocationWeight: member.allocationWeight,
      requiredFundingAmount,
      fundedAmount: member.fundedAmount,
    }
    const mismatchKind = mismatchKindFor(
      BigInt(memberDifference),
      BigInt(groupDifference),
    )
    if (mismatchKind === null) {
      return {
        ...base,
        evaluation: 'satisfied',
        fundingEquality: 'exactCentQuantized',
        fundedAmountDifference: 0,
        annualGroupFundedAmountDifference: 0,
      }
    }
    return {
      ...base,
      evaluation: 'mismatch',
      fundingEquality: 'notEqual',
      fundedAmountDifference: memberDifference,
      annualGroupFundedAmountDifference: groupDifference,
      mismatchKind,
    }
  })

  const [head, ...rest] = members
  if (head === undefined) {
    return { ok: false as const, issues: ['members: An annual group must have at least one member'] }
  }
  return { ok: true as const, members: [head, ...rest] }
}
