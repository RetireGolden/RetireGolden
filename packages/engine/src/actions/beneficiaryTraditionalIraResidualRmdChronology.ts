import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import type {
  BeneficiaryTraditionalIraDetachedPhysicalApplication,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdAllocation,
  type PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
} from './beneficiaryTraditionalIraResidualRmdAllocation.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  type PersonId,
} from './identity.js'
import {
  positiveUsdCentsSchema,
  usdCentsSchema,
} from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

export interface BeneficiaryTraditionalIraResidualRmdScheduleEvidence {
  readonly predicate:
    'beneficiaryTraditionalIraResidualRmdScheduleEvidence'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly rmdPoolId: string
  readonly residualAllocationEvidenceId: string
  readonly finalAnnualEvidenceId: string
  readonly coordinatorEvidenceId: string
  readonly predecessorApplications:
    readonly Readonly<BeneficiaryTraditionalIraDetachedPhysicalApplication>[]
  readonly executionDate: string
  readonly executionSequence: number
  readonly scheduleEvidenceId: string
}

const SCHEDULE_KEYS = [
  'predicate',
  'beneficiaryPersonId',
  'decedentPersonId',
  'taxYear',
  'rmdPoolId',
  'residualAllocationEvidenceId',
  'finalAnnualEvidenceId',
  'coordinatorEvidenceId',
  'predecessorApplications',
  'executionDate',
  'executionSequence',
  'scheduleEvidenceId',
] as const
const APPLICATION_KEYS = [
  'predicate',
  'beneficiaryPersonId',
  'decedentPersonId',
  'taxYear',
  'actionId',
  'allocationId',
  'sourceAccountId',
  'executionDate',
  'executionSequence',
  'requestedAmount',
  'executedAmount',
  'sourceBalanceBefore',
  'sourceBalanceAfter',
  'rmdSatisfiedBefore',
  'rmdSatisfiedByApplication',
  'rmdSatisfiedAfter',
  'rmdRemainingAfter',
  'physicalSourceEvidenceId',
  'movementCandidateId',
  'finalMemberEvidenceId',
  'finalAnnualEvidenceId',
  'coordinatorEvidenceId',
  'applicationEvidenceId',
] as const

function exactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) &&
    typeof value === 'object' &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function exactScheduleEvidenceId(
  schedule: BeneficiaryTraditionalIraResidualRmdScheduleEvidence,
): string {
  const withoutId = {
    predicate: schedule.predicate,
    beneficiaryPersonId: schedule.beneficiaryPersonId,
    decedentPersonId: schedule.decedentPersonId,
    taxYear: schedule.taxYear,
    rmdPoolId: schedule.rmdPoolId,
    residualAllocationEvidenceId: schedule.residualAllocationEvidenceId,
    finalAnnualEvidenceId: schedule.finalAnnualEvidenceId,
    coordinatorEvidenceId: schedule.coordinatorEvidenceId,
    predecessorApplications: schedule.predecessorApplications,
    executionDate: schedule.executionDate,
    executionSequence: schedule.executionSequence,
  }
  return deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-schedule-evidence',
    [withoutId],
  )
}

function compareApplications(
  left: Readonly<BeneficiaryTraditionalIraDetachedPhysicalApplication>,
  right: Readonly<BeneficiaryTraditionalIraDetachedPhysicalApplication>,
): number {
  return left.executionDate < right.executionDate
    ? -1
    : left.executionDate > right.executionDate
      ? 1
      : left.executionSequence - right.executionSequence ||
        (left.actionId < right.actionId
          ? -1
          : left.actionId > right.actionId
            ? 1
            : left.allocationId < right.allocationId
              ? -1
              : left.allocationId > right.allocationId
                ? 1
                : left.sourceAccountId < right.sourceAccountId
                  ? -1
                  : left.sourceAccountId > right.sourceAccountId
                    ? 1
                    : 0)
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((value, index) => value === sortedRight[index])
}

function exactApplicationEvidenceId(
  application: BeneficiaryTraditionalIraDetachedPhysicalApplication,
): string {
  const withoutId = {
    predicate: application.predicate,
    beneficiaryPersonId: application.beneficiaryPersonId,
    decedentPersonId: application.decedentPersonId,
    taxYear: application.taxYear,
    actionId: application.actionId,
    allocationId: application.allocationId,
    sourceAccountId: application.sourceAccountId,
    executionDate: application.executionDate,
    executionSequence: application.executionSequence,
    requestedAmount: application.requestedAmount,
    executedAmount: application.executedAmount,
    sourceBalanceBefore: application.sourceBalanceBefore,
    sourceBalanceAfter: application.sourceBalanceAfter,
    rmdSatisfiedBefore: application.rmdSatisfiedBefore,
    rmdSatisfiedByApplication: application.rmdSatisfiedByApplication,
    rmdSatisfiedAfter: application.rmdSatisfiedAfter,
    rmdRemainingAfter: application.rmdRemainingAfter,
    physicalSourceEvidenceId: application.physicalSourceEvidenceId,
    movementCandidateId: application.movementCandidateId,
    finalMemberEvidenceId: application.finalMemberEvidenceId,
    finalAnnualEvidenceId: application.finalAnnualEvidenceId,
    coordinatorEvidenceId: application.coordinatorEvidenceId,
  }
  return deriveActionStructuralId(
    'beneficiary-ira-detached-physical-application',
    [withoutId],
  )
}

/**
 * Verifies the complete predecessor application chronology and proves that
 * the authorized residual slot follows its true terminal application.
 */
export function validateBeneficiaryTraditionalIraResidualRmdSchedule(
  value: unknown,
  allocation: Extract<
    ReturnType<typeof prepareBeneficiaryTraditionalIraResidualRmdAllocation>,
    { readonly status: 'residualRmdAllocationPrepared' }
  >,
  allocationInput:
    Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput>,
): value is BeneficiaryTraditionalIraResidualRmdScheduleEvidence {
  if (!exactRecord(value, SCHEDULE_KEYS)) return false
  const rmd = allocationInput.rmdTransition
  const schedule =
    value as unknown as BeneficiaryTraditionalIraResidualRmdScheduleEvidence
  const date = parseCivilIsoDate(schedule.executionDate)
  if (
    schedule.predicate !==
      'beneficiaryTraditionalIraResidualRmdScheduleEvidence' ||
    schedule.beneficiaryPersonId !== allocation.beneficiaryPersonId ||
    schedule.decedentPersonId !== allocation.decedentPersonId ||
    schedule.taxYear !== allocation.taxYear ||
    schedule.rmdPoolId !== allocation.rmdPoolId ||
    schedule.residualAllocationEvidenceId !== allocation.allocationEvidenceId ||
    schedule.finalAnnualEvidenceId !== rmd.finalAnnualEvidenceId ||
    schedule.coordinatorEvidenceId !== rmd.coordinatorEvidenceId ||
    !Array.isArray(schedule.predecessorApplications) ||
    date === null || formatCivilDate(date) !== schedule.executionDate ||
    date.year !== allocation.taxYear ||
    !Number.isSafeInteger(schedule.executionSequence) ||
    schedule.executionSequence <= 0 ||
    !nonblank(schedule.scheduleEvidenceId) ||
    schedule.scheduleEvidenceId !== exactScheduleEvidenceId(schedule)
  ) return false

  const applications = schedule.predecessorApplications
  for (let index = 0; index < applications.length; index += 1) {
    const rawApplication: unknown = applications[index]
    if (!exactRecord(rawApplication, APPLICATION_KEYS)) return false
    const application = rawApplication as unknown as
      BeneficiaryTraditionalIraDetachedPhysicalApplication
    const applicationDate = parseCivilIsoDate(application.executionDate)
    if (
      application.predicate !==
        'beneficiaryTraditionalIraDetachedPhysicalApplication' ||
      application.beneficiaryPersonId !== allocation.beneficiaryPersonId ||
      application.decedentPersonId !== allocation.decedentPersonId ||
      application.taxYear !== allocation.taxYear ||
      !actionIdSchema.safeParse(application.actionId).success ||
      !allocationIdSchema.safeParse(application.allocationId).success ||
      !accountIdSchema.safeParse(application.sourceAccountId).success ||
      applicationDate === null ||
      formatCivilDate(applicationDate) !== application.executionDate ||
      applicationDate.year !== allocation.taxYear ||
      !Number.isSafeInteger(application.executionSequence) ||
      application.executionSequence <= 0 ||
      !positiveUsdCentsSchema.safeParse(application.requestedAmount).success ||
      !positiveUsdCentsSchema.safeParse(application.executedAmount).success ||
      !usdCentsSchema.safeParse(application.sourceBalanceBefore).success ||
      !usdCentsSchema.safeParse(application.sourceBalanceAfter).success ||
      !usdCentsSchema.safeParse(application.rmdSatisfiedBefore).success ||
      !usdCentsSchema.safeParse(application.rmdSatisfiedByApplication).success ||
      !usdCentsSchema.safeParse(application.rmdSatisfiedAfter).success ||
      !usdCentsSchema.safeParse(application.rmdRemainingAfter).success ||
      application.executedAmount > application.requestedAmount ||
      application.sourceBalanceAfter !==
        application.sourceBalanceBefore - application.executedAmount ||
      application.rmdSatisfiedAfter !==
        application.rmdSatisfiedBefore +
          application.rmdSatisfiedByApplication ||
      application.rmdSatisfiedByApplication !== Math.min(
        application.executedAmount,
        rmd.rmdRequiredAmount - application.rmdSatisfiedBefore,
      ) ||
      application.rmdRemainingAfter !==
        rmd.rmdRequiredAmount - application.rmdSatisfiedAfter ||
      application.finalAnnualEvidenceId !== rmd.finalAnnualEvidenceId ||
      application.coordinatorEvidenceId !== rmd.coordinatorEvidenceId ||
      allocationInput.sourceBalanceTransitions.filter((source) =>
        source.sourceAccountId === application.sourceAccountId &&
        source.applicationEvidenceIds.includes(
          application.applicationEvidenceId,
        )).length !== 1 ||
      !nonblank(application.physicalSourceEvidenceId) ||
      !nonblank(application.movementCandidateId) ||
      !nonblank(application.finalMemberEvidenceId) ||
      !nonblank(application.applicationEvidenceId) ||
      application.applicationEvidenceId !==
        exactApplicationEvidenceId(application) ||
      (index > 0 &&
        compareApplications(applications[index - 1]!, application) >= 0)
    ) return false
  }

  const applicationEvidenceIds = applications.map(
    (application) => application.applicationEvidenceId,
  )
  if (
    new Set(applicationEvidenceIds).size !== applicationEvidenceIds.length ||
    !sameStrings(applicationEvidenceIds, rmd.applicationEvidenceIds)
  ) return false
  for (const source of allocationInput.sourceBalanceTransitions) {
    const sourceApplications = applications.filter(
      (application) => application.sourceAccountId === source.sourceAccountId,
    )
    if (
      !sameStrings(
        sourceApplications.map(
          (application) => application.applicationEvidenceId,
        ),
        source.applicationEvidenceIds,
      )
    ) return false
    if (sourceApplications.length === 0) continue
    if (
      sourceApplications[0]!.sourceBalanceBefore !==
        source.annualOpeningBalanceAmount ||
      sourceApplications.at(-1)!.sourceBalanceAfter !==
        source.annualFinalBalanceAmount
    ) return false
    for (let index = 1; index < sourceApplications.length; index += 1) {
      if (
        sourceApplications[index]!.sourceBalanceBefore !==
          sourceApplications[index - 1]!.sourceBalanceAfter
      ) return false
    }
  }
  if (applications.length > 0) {
    if (
      applications[0]!.rmdSatisfiedBefore !==
        rmd.initialRmdSatisfiedAmount ||
      applications.at(-1)!.rmdSatisfiedAfter !==
        rmd.finalRmdSatisfiedAmount ||
      applications.reduce(
        (total, application) =>
          total + application.rmdSatisfiedByApplication,
        0,
      ) !== rmd.rmdSatisfiedByTransaction
    ) return false
    for (let index = 1; index < applications.length; index += 1) {
      if (
        applications[index]!.rmdSatisfiedBefore !==
          applications[index - 1]!.rmdSatisfiedAfter
      ) return false
    }
  }
  const terminal = applications.at(-1)
  return terminal === undefined || compareApplications(terminal, {
    ...terminal,
    executionDate: schedule.executionDate,
    executionSequence: schedule.executionSequence,
  }) < 0
}
