/**
 * Coordinates one annual conversion-linked withdrawal funding decision.
 *
 * The coordinator owns the T0 counterfactual, the discarded provisional run,
 * and the all-or-nothing authorization policy. The simulator retains the live
 * annual-pass implementation and supplies it through one explicit callback so
 * every run shares the caller's current settlement-assumption vector.
 */
import {
  authorizeConversionLinkedWithdrawalGroups,
  type ConversionLinkedWithdrawalGroupLiabilityRun,
  type ExecuteConversionLinkedWithdrawalGroupsResult,
} from '../../actions/conversionLinkedWithdrawalGroupExecution.js'
import type {
  ConversionLinkedWithdrawalGroupAuthorization,
} from '../../actions/conversionLinkedWithdrawalGroup.js'
import type { ActionId } from '../../actions/identity.js'
import type {
  AnnualLiabilityRunTaxInput,
} from '../../actions/annualLiabilityRunIdentity.js'
import {
  probeAnnualPassUnderTransaction,
  runCounterfactualAnnualLiability,
} from '../../internal/counterfactualAnnualLiability.js'
import type {
  SimulatorAnnualPassStateBindings,
} from '../annualPassTransaction.js'

export type AnnualConversionLinkedWithdrawalRelease =
  | Readonly<{ kind: 'refuseAll' }>
  | Readonly<{ kind: 'stageProvisionally' }>
  | Readonly<{
      kind: 'proven'
      authorizations:
        readonly Readonly<ConversionLinkedWithdrawalGroupAuthorization>[]
    }>

/** The permission every annual-pass run has until a staging run earns one. */
export const REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS:
  Readonly<AnnualConversionLinkedWithdrawalRelease> = Object.freeze({
    kind: 'refuseAll' as const,
  })

const STAGE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS:
  Readonly<AnnualConversionLinkedWithdrawalRelease> = Object.freeze({
    kind: 'stageProvisionally' as const,
  })

export interface AnnualConversionLinkedWithdrawalFundingPassRequest {
  /** Present only for the T0 counterfactual run. */
  readonly omittedRetirementActionIds?: ReadonlySet<ActionId>
  readonly annualLiabilityBaseline:
    Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  readonly release: Readonly<AnnualConversionLinkedWithdrawalRelease>
}

export interface AnnualConversionLinkedWithdrawalFundingPassResult {
  readonly yearResult: Readonly<{
    readonly year: number
    readonly tax: number
    readonly penalties: number
    readonly conversionLinkedWithdrawalGroupExecution?:
      Readonly<ExecuteConversionLinkedWithdrawalGroupsResult>
  }>
}

export interface AnnualConversionLinkedWithdrawalFundingInput {
  readonly state: SimulatorAnnualPassStateBindings
  readonly planId: string
  readonly taxYear: number
  readonly taxUnitId: string | null
  readonly omitActionIds: readonly ActionId[]
  readonly nonGroupTaxInputs:
    readonly Readonly<AnnualLiabilityRunTaxInput>[]
  /**
   * Runs the caller's post-contribution annual pass under the caller's current
   * settlement-assumption vector. Counterfactual and staging invocations are
   * transactionally rolled back by this coordinator.
   */
  readonly runPass: (
    request: Readonly<AnnualConversionLinkedWithdrawalFundingPassRequest>,
  ) => Readonly<AnnualConversionLinkedWithdrawalFundingPassResult>
}

export interface AnnualConversionLinkedWithdrawalFundingResult {
  readonly baseline:
    Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  readonly release: Readonly<AnnualConversionLinkedWithdrawalRelease>
}

/**
 * Reads T0, stages the linked group, and grants the committed run only the
 * authorizations proven by the discarded staging run. Every refusal is
 * fail-closed and returns the shared `refuseAll` permission.
 */
export function annualConversionLinkedWithdrawalFunding(
  input: Readonly<AnnualConversionLinkedWithdrawalFundingInput>,
): Readonly<AnnualConversionLinkedWithdrawalFundingResult> {
  if (input.taxUnitId === null || input.omitActionIds.length === 0) {
    return {
      baseline: null,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    }
  }

  const baselineRead = runCounterfactualAnnualLiability({
    state: input.state,
    request: {
      planId: input.planId,
      taxUnitId: input.taxUnitId,
      taxYear: input.taxYear,
      omitActionIds: input.omitActionIds,
      nonGroupTaxInputs: input.nonGroupTaxInputs,
    },
    runPass: (omittedRetirementActionIds) => input.runPass({
      omittedRetirementActionIds,
      annualLiabilityBaseline: null,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    }),
  })
  if (baselineRead.status !== 'counterfactualAnnualLiabilityRead') {
    return {
      baseline: null,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    }
  }

  const baseline: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> = {
    liability: baselineRead.liability,
    identity: baselineRead.identity,
  }
  const staged = probeAnnualPassUnderTransaction({
    state: input.state,
    runProbe: () => input.runPass({
      annualLiabilityBaseline: baseline,
      release: STAGE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    }).yearResult.conversionLinkedWithdrawalGroupExecution ?? null,
  })
  if (staged.status !== 'annualPassProbeRead' || staged.observation === null) {
    return {
      baseline,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    }
  }

  const authorized = authorizeConversionLinkedWithdrawalGroups(
    staged.observation,
  )
  return {
    baseline,
    release:
      authorized.status === 'conversionLinkedWithdrawalGroupsAuthorized'
        ? { kind: 'proven', authorizations: authorized.authorizations }
        : REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
  }
}
