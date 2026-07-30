import { z } from 'zod'

import {
  accountIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type AllocationId,
  type PersonId,
} from './identity.js'

type RegistryEntry = Readonly<{
  predicate: string
  outcome: 'adjusted' | 'partial' | 'refused' | 'unsupported'
  message: string
}>

const actionReasonRegistry = {
  'person-not-found': {
    predicate: 'resolveActionPerson',
    outcome: 'refused',
    message: 'The action person is missing or is not alive when this action would occur.',
  },
  'person-not-alive': {
    predicate: 'resolveActionPerson',
    outcome: 'refused',
    message: 'The action person is missing or is not alive when this action would occur.',
  },
  'source-account-not-found': {
    predicate: 'resolveSourceAllocation',
    outcome: 'refused',
    message: 'Select each source account explicitly; a source is missing or repeated.',
  },
  'duplicate-source-account': {
    predicate: 'resolveSourceAllocation',
    outcome: 'refused',
    message: 'Select each source account explicitly; a source is missing or repeated.',
  },
  'duplicate-allocation-id': {
    predicate: 'reconcileRequestedAllocations',
    outcome: 'refused',
    message: 'Give each source allocation a unique stable ID.',
  },
  'allocation-total-mismatch': {
    predicate: 'reconcileRequestedAllocations',
    outcome: 'refused',
    message: 'The requested amount does not exactly match its source allocations.',
  },
  'source-owner-mismatch': {
    predicate: 'sourceBelongsToPerson',
    outcome: 'refused',
    message: 'This individually owned account belongs to a different person.',
  },
  'joint-source-acting-person-mismatch': {
    predicate: 'sourceBelongsToPerson',
    outcome: 'refused',
    message: 'The acting person for this joint source must be one of its recorded owners.',
  },
  'required-facts-missing': {
    predicate: 'requiredActionFacts',
    outcome: 'unsupported',
    message: 'Required source, date, plan, basis, or eligibility facts are missing.',
  },
  'action-sequence-conflict': {
    predicate: 'reconcileActionSchedule',
    outcome: 'refused',
    message: 'Give same-day actions a unique execution sequence; IDs do not prove transaction order.',
  },
  'source-balance-trimmed': {
    predicate: 'sourceBalanceAvailable',
    outcome: 'partial',
    message: 'The named source had less available than requested; the remainder was not executed.',
  },
  'source-balance-unavailable': {
    predicate: 'sourceBalanceAvailable',
    outcome: 'refused',
    message: 'The named source had no principal available when this withdrawal would execute.',
  },
  'withdrawal-taxable-basis-unsupported': {
    predicate: 'classifyWithdrawalSource',
    outcome: 'unsupported',
    message: "This source's tax character cannot be supported from the recorded basis and tax-ownership facts.",
  },
  'withdrawal-employer-basis-unsupported': {
    predicate: 'employerDistributionEligibility',
    outcome: 'unsupported',
    message: "The employer plan's allocation-bound after-tax basis evidence is missing or unsupported.",
  },
  'withdrawal-roth-ira-character-unsupported': {
    predicate: 'rothIraWithdrawalEvidence',
    outcome: 'unsupported',
    message:
      'Roth IRA character requires complete owned-source inventory, ordering, clock, and segment evidence; inherited Roth decedent-bound evidence is unsupported in v1.',
  },
  'withdrawal-designated-roth-character-unsupported': {
    predicate: 'designatedRothWithdrawalEvidence',
    outcome: 'unsupported',
    message:
      'Designated Roth distributions require complete in-plan rollover history plus plan-specific pro-rata, five-year, qualified-event, and character evidence.',
  },
  'withdrawal-source-not-spendable': {
    predicate: 'isSpendableInYear',
    outcome: 'refused',
    message: 'The selected equity compensation is not vested on the action date.',
  },
  'withdrawal-penalty-evidence-missing': {
    predicate: 'withdrawalPenaltyEvidence',
    outcome: 'unsupported',
    message:
      'Exact subtype, annual basis allocation, age, SIMPLE participation period, or exception evidence is missing, so treatment is not actionable.',
  },
  'withdrawal-plan-availability-unknown': {
    predicate: 'employerDistributionEligibility',
    outcome: 'unsupported',
    message: "The employer plan's dated distribution-availability evidence is missing.",
  },
  'withdrawal-plan-not-available': {
    predicate: 'employerDistributionEligibility',
    outcome: 'refused',
    message: 'This employer plan does not permit the requested distribution on that date.',
  },
  'withdrawal-rule-of-55-evidence-missing': {
    predicate: 'employerPenaltyExceptionEvidence',
    outcome: 'unsupported',
    message:
      "The named plan's separation or current SEPP payment facts are missing, so penalty treatment is not actionable.",
  },
  'withdrawal-sepp-evidence-missing': {
    predicate: 'employerPenaltyExceptionEvidence',
    outcome: 'unsupported',
    message:
      "The named plan's separation or current SEPP payment facts are missing, so penalty treatment is not actionable.",
  },
  'withdrawal-inherited-facts-missing': {
    predicate: 'inheritedWithdrawalEligibility',
    outcome: 'unsupported',
    message: 'Beneficiary, decedent, annual basis denominator, or inherited-distribution facts are incomplete.',
  },
  'withdrawal-hsa-qualification-unknown': {
    predicate: 'hsaWithdrawalEvidence',
    outcome: 'unsupported',
    message: "The HSA's medical-purpose, prior-reimbursement, tax-character, or age/exception facts are missing.",
  },
  'withdrawal-source-type-unsupported': {
    predicate: 'classifyWithdrawalSource',
    outcome: 'unsupported',
    message: 'Use the separately typed pension, annuity, property, debt, or other event.',
  },
  'withdrawal-aggregate-unallocated': {
    predicate: 'isWithdrawalActionable',
    outcome: 'unsupported',
    message: 'This legacy withdrawal is calculated but has no implementation-ready owner/source allocation.',
  },
  'conversion-date-missing': {
    predicate: 'conversionEligibilityDate',
    outcome: 'unsupported',
    message: 'Enter the actual planned conversion date in this action year.',
  },
  'conversion-date-invalid': {
    predicate: 'conversionEligibilityDate',
    outcome: 'refused',
    message: 'Enter the actual planned conversion date in this action year.',
  },
  'conversion-date-outside-action-year': {
    predicate: 'conversionEligibilityDate',
    outcome: 'refused',
    message: 'Enter the actual planned conversion date in this action year.',
  },
  'conversion-source-owner-mismatch': {
    predicate: 'isConvertibleSourceForOwner',
    outcome: 'refused',
    message: 'A Roth conversion cannot move value between spouses or owners.',
  },
  'conversion-destination-owner-mismatch': {
    predicate: 'isConvertibleSourceForOwner',
    outcome: 'refused',
    message: 'A Roth conversion cannot move value between spouses or owners.',
  },
  'conversion-source-not-convertible': {
    predicate: 'isConvertibleSourceForOwner',
    outcome: 'refused',
    message: 'The named IRA is not proven convertible for this owner.',
  },
  'conversion-ira-subtype-unknown': {
    predicate: 'isConvertibleSourceForOwner',
    outcome: 'unsupported',
    message: 'The named IRA is not proven convertible for this owner.',
  },
  'conversion-simple-two-year-rule-unknown': {
    predicate: 'simpleConversionEligibility',
    outcome: 'unsupported',
    message: 'Enter the SIMPLE IRA participation start date so the two-year period can be proven.',
  },
  'conversion-simple-two-year-period-open': {
    predicate: 'simpleConversionEligibility',
    outcome: 'refused',
    message: 'This SIMPLE IRA cannot move to an ordinary Roth IRA until its two-year period has ended.',
  },
  'conversion-roth-simple-destination-unsupported': {
    predicate: 'isCompatibleRothDestination',
    outcome: 'unsupported',
    message:
      'A same-owner Roth SIMPLE path may be legal during the initial period, but that destination is not supported in v1.',
  },
  'conversion-plan-availability-unknown': {
    predicate: 'employerRolloverEligibility',
    outcome: 'unsupported',
    message: "The employer plan's dated rollover-availability evidence is missing.",
  },
  'conversion-plan-not-available': {
    predicate: 'employerRolloverEligibility',
    outcome: 'refused',
    message: 'This employer plan does not permit the requested rollover on that date.',
  },
  'conversion-employer-basis-unsupported': {
    predicate: 'conversionBasisEvidence',
    outcome: 'unsupported',
    message: "The employer plan's allocation-bound conversion-basis evidence is missing or unsupported.",
  },
  'conversion-inherited-source': {
    predicate: 'isConvertibleSourceForOwner',
    outcome: 'refused',
    message: 'The selected inherited account cannot use this conversion contract.',
  },
  'conversion-destination-not-found': {
    predicate: 'isCompatibleRothDestination',
    outcome: 'refused',
    message: 'Select a compatible owned Roth IRA, not an inherited Roth IRA, held by the same person.',
  },
  'conversion-destination-incompatible': {
    predicate: 'isCompatibleRothDestination',
    outcome: 'refused',
    message: 'Select a compatible owned Roth IRA, not an inherited Roth IRA, held by the same person.',
  },
  'conversion-employer-destination-unsupported': {
    predicate: 'isCompatibleRothDestination',
    outcome: 'unsupported',
    message: 'A Roth employer account is not a fallback destination; same-plan compatibility is unproven.',
  },
  'conversion-rmd-reserve-unavailable': {
    predicate: 'conversionRmdReserve',
    outcome: 'refused',
    message: 'Required minimum distributions must be reserved before conversion.',
  },
  'conversion-basis-evidence-missing': {
    predicate: 'conversionBasisEvidence',
    outcome: 'unsupported',
    message: "The owner's complete IRA basis pool and annual conversion-basis allocation are required.",
  },
  'conversion-tax-funding-unallocated': {
    predicate: 'conversionTaxFundingEvidence',
    outcome: 'refused',
    message: 'The named conversion-tax funding could not execute or reconcile to the required amount.',
  },
  'conversion-tax-funding-evidence-unsupported': {
    predicate: 'conversionTaxFundingEvidence',
    outcome: 'unsupported',
    message: 'The conversion-tax funding evidence or required tax inputs are unavailable.',
  },
  'conversion-principal-withholding-unsupported': {
    predicate: 'conversionTaxFundingEvidence',
    outcome: 'unsupported',
    message:
      'Withholding from converted principal is not supported; it reduces the destination and may be an early distribution.',
  },
  'conversion-balance-trimmed': {
    predicate: 'executeConversionAllocations',
    outcome: 'partial',
    message: 'The named conversion source had less available; no principal disappeared.',
  },
  'conversion-balance-unavailable': {
    predicate: 'executeConversionAllocations',
    outcome: 'refused',
    message: 'The named conversion source had no principal available when this conversion would execute.',
  },
  'conversion-aggregate-unallocated': {
    predicate: 'isRothConversionActionable',
    outcome: 'unsupported',
    message:
      'This legacy conversion has no proven owner, execution date, source, destination, or tax-funding allocation.',
  },
  'qcd-date-missing': {
    predicate: 'qcdEligibilityDate',
    outcome: 'unsupported',
    message: 'Enter the actual planned QCD date in this action year.',
  },
  'qcd-date-invalid': {
    predicate: 'qcdEligibilityDate',
    outcome: 'refused',
    message: 'Enter the actual planned QCD date in this action year.',
  },
  'qcd-date-outside-action-year': {
    predicate: 'qcdEligibilityDate',
    outcome: 'refused',
    message: 'Enter the actual planned QCD date in this action year.',
  },
  'qcd-before-age-70-half': {
    predicate: 'qcdEligibilityDate',
    outcome: 'refused',
    message: 'The donor has not reached age 70½ on the requested date.',
  },
  'qcd-source-owner-mismatch': {
    predicate: 'isEligibleQcdSource',
    outcome: 'refused',
    message: 'The QCD donor must own or be the named beneficiary of this IRA.',
  },
  'qcd-source-not-ira': {
    predicate: 'isEligibleQcdSource',
    outcome: 'refused',
    message: 'A QCD must come directly from an eligible IRA, not an employer plan.',
  },
  'qcd-sep-simple-activity-unknown': {
    predicate: 'qcdSepSimpleActivity',
    outcome: 'unsupported',
    message: 'SEP/SIMPLE activity is missing or shows an ongoing plan, so this QCD is not actionable.',
  },
  'qcd-ongoing-sep-simple': {
    predicate: 'qcdSepSimpleActivity',
    outcome: 'refused',
    message: 'SEP/SIMPLE activity is missing or shows an ongoing plan, so this QCD is not actionable.',
  },
  'qcd-roth-source-unsupported': {
    predicate: 'isEligibleQcdSource',
    outcome: 'unsupported',
    message: 'Roth IRA QCD tax character is legally possible but unsupported in this planning contract.',
  },
  'qcd-direct-charity-unconfirmed': {
    predicate: 'qcdDirectCharityEvidence',
    outcome: 'unsupported',
    message:
      'Confirm a direct custodian payment to an eligible charity; RetireGolden does not verify the charity.',
  },
  'qcd-split-interest-unsupported': {
    predicate: 'qcdDirectCharityEvidence',
    outcome: 'unsupported',
    message: 'A split-interest QCD and its once-in-a-lifetime sublimit are not supported in v1.',
  },
  'qcd-entire-distribution-deductibility-unconfirmed': {
    predicate: 'qcdDeductibilityEvidence',
    outcome: 'unsupported',
    message: 'Confirm that the entire charitable transfer is otherwise deductible and provides no return benefit.',
  },
  'qcd-nonqcd-deduction-unsupported': {
    predicate: 'qcdDeductibilityEvidence',
    outcome: 'unsupported',
    message:
      'The charitable amount eligible for deduction treatment needs complete limit and filing-treatment evidence before this transfer is actionable.',
  },
  'qcd-tax-year-limit-unsupported': {
    predicate: 'qcdPersonalRemainingLimit',
    outcome: 'unsupported',
    message: 'The sourced personal QCD limit is unavailable or trims the excludable amount.',
  },
  'qcd-person-limit-trimmed': {
    predicate: 'qcdPersonalRemainingLimit',
    outcome: 'adjusted',
    message: 'The sourced personal QCD limit is unavailable or trims the excludable amount.',
  },
  'qcd-contribution-history-unknown': {
    predicate: 'qcdDeductibleContributionOffset',
    outcome: 'unsupported',
    message: 'Post-70½ deductible IRA contributions are missing or reduce the excludable QCD.',
  },
  'qcd-contribution-offset-applied': {
    predicate: 'qcdDeductibleContributionOffset',
    outcome: 'adjusted',
    message: 'Post-70½ deductible IRA contributions are missing or reduce the excludable QCD.',
  },
  'qcd-taxable-amount-trimmed': {
    predicate: 'qcdTaxableAmount',
    outcome: 'adjusted',
    message: 'The QCD exclusion was limited to the otherwise-taxable portion of the IRA transfer.',
  },
  'qcd-inherited-basis-unsupported': {
    predicate: 'qcdTaxableAmount',
    outcome: 'unsupported',
    message: 'Inherited IRA basis tax character is not supported in v1.',
  },
  'qcd-rmd-evidence-missing': {
    predicate: 'qcdRmdCoordination',
    outcome: 'unsupported',
    message:
      'This QCD is not capped by RMD, but donor-specific IRA RMD facts are required to state the amount satisfied.',
  },
  'qcd-spouse-pooling-refused': {
    predicate: 'qcdPersonalRemainingLimit',
    outcome: 'refused',
    message: "A spouse's age, IRA, QCD limit, contribution offset, or RMD cannot be pooled.",
  },
  'qcd-balance-trimmed': {
    predicate: 'executeQcd',
    outcome: 'partial',
    message: 'The source IRA had less available; the remaining request was not executed.',
  },
  'qcd-balance-unavailable': {
    predicate: 'executeQcd',
    outcome: 'refused',
    message: 'The source IRA had no principal available when this QCD would execute.',
  },
  'qcd-aggregate-unallocated': {
    predicate: 'isQcdActionable',
    outcome: 'unsupported',
    message: 'This legacy QCD has no donor, source IRA, execution date, or charity evidence.',
  },
} as const satisfies Readonly<Record<string, RegistryEntry>>

for (const entry of Object.values(actionReasonRegistry)) Object.freeze(entry)
export const ACTION_REASON_REGISTRY = Object.freeze(actionReasonRegistry)

export type ActionReasonCode = keyof typeof ACTION_REASON_REGISTRY
export type ActionPredicateName =
  (typeof ACTION_REASON_REGISTRY)[ActionReasonCode]['predicate']
export type ActionReasonOutcome<C extends ActionReasonCode = ActionReasonCode> =
  (typeof ACTION_REASON_REGISTRY)[C]['outcome']

type ReasonCodesWithOutcome<Outcome extends RegistryEntry['outcome']> = {
  [Code in ActionReasonCode]: ActionReasonOutcome<Code> extends Outcome ? Code : never
}[ActionReasonCode]

export type TaxTreatmentAdjustmentReasonCode = ReasonCodesWithOutcome<'adjusted'>
export type PartialActionReasonCode = ReasonCodesWithOutcome<'partial'>
export type UnsupportedActionReasonCode = ReasonCodesWithOutcome<'unsupported'>
export type RefusedActionReasonCode = ReasonCodesWithOutcome<'refused'>
export type BlockingActionReasonCode = UnsupportedActionReasonCode | RefusedActionReasonCode

export const actionReasonCodes = Object.freeze(
  Object.keys(ACTION_REASON_REGISTRY) as ActionReasonCode[],
)
export const actionPredicateNames = Object.freeze([
  ...new Set(actionReasonCodes.map((code) => ACTION_REASON_REGISTRY[code].predicate)),
] as ActionPredicateName[])
export const taxTreatmentAdjustmentReasonCodes = Object.freeze(
  actionReasonCodes.filter(
    (code): code is TaxTreatmentAdjustmentReasonCode =>
      ACTION_REASON_REGISTRY[code].outcome === 'adjusted',
  ),
)
export const partialActionReasonCodes = Object.freeze(
  actionReasonCodes.filter(
    (code): code is PartialActionReasonCode => ACTION_REASON_REGISTRY[code].outcome === 'partial',
  ),
)
export const unsupportedActionReasonCodes = Object.freeze(
  actionReasonCodes.filter(
    (code): code is UnsupportedActionReasonCode =>
      ACTION_REASON_REGISTRY[code].outcome === 'unsupported',
  ),
)
export const refusedActionReasonCodes = Object.freeze(
  actionReasonCodes.filter(
    (code): code is RefusedActionReasonCode => ACTION_REASON_REGISTRY[code].outcome === 'refused',
  ),
)

export const actionReasonCodeSchema = z.enum(
  actionReasonCodes as [ActionReasonCode, ...ActionReasonCode[]],
)

export interface ActionReasonIdentifiers {
  personId?: PersonId
  accountId?: AccountId
  allocationId?: AllocationId
}

export type ActionReason<C extends ActionReasonCode = ActionReasonCode> = Readonly<
  {
    code: C
    predicate: (typeof ACTION_REASON_REGISTRY)[C]['predicate']
    outcome: ActionReasonOutcome<C>
    message: (typeof ACTION_REASON_REGISTRY)[C]['message']
  } & ActionReasonIdentifiers
>

const reasonIdentifiersSchema = z
  .object({
    personId: personIdSchema.optional(),
    accountId: accountIdSchema.optional(),
    allocationId: allocationIdSchema.optional(),
  })
  .strict()

const actionReasonShapeSchema = z
  .object({
    code: actionReasonCodeSchema,
    predicate: z.string(),
    outcome: z.enum(['adjusted', 'partial', 'refused', 'unsupported']),
    message: z.string(),
    personId: personIdSchema.optional(),
    accountId: accountIdSchema.optional(),
    allocationId: allocationIdSchema.optional(),
  })
  .strict()

export const actionReasonSchema = actionReasonShapeSchema.superRefine((reason, ctx) => {
  const expected = ACTION_REASON_REGISTRY[reason.code]
  for (const field of ['predicate', 'outcome', 'message'] as const) {
    if (reason[field] !== expected[field]) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `${field} must match the registry entry for ${reason.code}`,
      })
    }
  }
})

export function createActionReason<C extends ActionReasonCode>(
  code: C,
  identifiers: ActionReasonIdentifiers = {},
): ActionReason<C> {
  const parsedIdentifiers = reasonIdentifiersSchema.parse(identifiers)
  return {
    code,
    ...ACTION_REASON_REGISTRY[code],
    ...parsedIdentifiers,
  } as ActionReason<C>
}

export type ParseActionReasonResult =
  | { ok: true; reason: ActionReason }
  | { ok: false; issues: string[] }

export function parseActionReason(input: unknown): ParseActionReasonResult {
  const result = actionReasonSchema.safeParse(input)
  if (result.success) return { ok: true, reason: result.data as ActionReason }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length === 0 ? '$' : issue.path.join('.')
      return `${path}: ${issue.message}`
    }),
  }
}
