import { beforeEach, describe, expect, it, vi } from 'vitest'

const controller = vi.hoisted(() => ({
  baselineResult: null as unknown,
  probeResult: null as unknown,
  authorizationResult: null as unknown,
  counterfactualInputs: [] as unknown[],
  probeInputs: [] as unknown[],
  authorizationInputs: [] as unknown[],
}))

vi.mock('../../internal/counterfactualAnnualLiability.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../../internal/counterfactualAnnualLiability.js')
  >()
  return {
    ...original,
    runCounterfactualAnnualLiability: (
      input: Parameters<typeof original.runCounterfactualAnnualLiability>[0],
    ): ReturnType<typeof original.runCounterfactualAnnualLiability> => {
      controller.counterfactualInputs.push(input)
      if (
        (controller.baselineResult as { status?: string }).status ===
          'counterfactualAnnualLiabilityRead'
      ) {
        input.runPass(new Set(input.request.omitActionIds))
      }
      return controller.baselineResult as ReturnType<
        typeof original.runCounterfactualAnnualLiability
      >
    },
    probeAnnualPassUnderTransaction: <Observation>(
      input: Parameters<
        typeof original.probeAnnualPassUnderTransaction<Observation>
      >[0],
    ): ReturnType<typeof original.probeAnnualPassUnderTransaction<Observation>> => {
      controller.probeInputs.push(input)
      if (
        (controller.probeResult as { status?: string }).status ===
          'annualPassProbeRead'
      ) {
        const observation = input.runProbe()
        return {
          status: 'annualPassProbeRead',
          restoration: 'checkpointRestored',
          observation,
        }
      }
      return controller.probeResult as ReturnType<
        typeof original.probeAnnualPassUnderTransaction<Observation>
      >
    },
  }
})

vi.mock(
  '../../actions/conversionLinkedWithdrawalGroupExecution.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('../../actions/conversionLinkedWithdrawalGroupExecution.js')
    >()
    return {
      ...original,
      authorizeConversionLinkedWithdrawalGroups: (
        input: Parameters<
          typeof original.authorizeConversionLinkedWithdrawalGroups
        >[0],
      ): ReturnType<
        typeof original.authorizeConversionLinkedWithdrawalGroups
      > => {
        controller.authorizationInputs.push(input)
        return controller.authorizationResult as ReturnType<
          typeof original.authorizeConversionLinkedWithdrawalGroups
        >
      },
    }
  },
)

import { asActionId } from '../../actions/identity.js'
import type {
  SimulatorAnnualPassStateBindings,
} from '../annualPassTransaction.js'
import {
  annualConversionLinkedWithdrawalFunding,
  REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
  type AnnualConversionLinkedWithdrawalFundingInput,
  type AnnualConversionLinkedWithdrawalFundingPassRequest,
} from './annualConversionLinkedWithdrawalFunding.js'

const ACTION_ID = asActionId('conversion-a')
const WITHDRAWAL_ID = asActionId('withdrawal-a')
const LIABILITY = Object.freeze({ marker: 'liability' })
const IDENTITY = Object.freeze({ marker: 'identity' })
const BASELINE = Object.freeze({ liability: LIABILITY, identity: IDENTITY })
const STAGED_EXECUTION = Object.freeze({ marker: 'staged-execution' })
const AUTHORIZATION = Object.freeze({ marker: 'authorization' })

function input(
  runPass: AnnualConversionLinkedWithdrawalFundingInput['runPass'] = () => ({
    yearResult: { year: 2026, tax: 10, penalties: 2 },
  }),
): AnnualConversionLinkedWithdrawalFundingInput {
  return {
    state: {} as SimulatorAnnualPassStateBindings,
    planId: 'plan-a',
    taxYear: 2026,
    taxUnitId: 'unit-a',
    omitActionIds: [ACTION_ID, WITHDRAWAL_ID],
    nonGroupTaxInputs: [],
    runPass,
  }
}

describe('annualConversionLinkedWithdrawalFunding', () => {
  beforeEach(() => {
    controller.baselineResult = {
      status: 'counterfactualAnnualLiabilityRefused',
      restoration: 'checkpointRestored',
      reason: 'liabilityUnreadable',
      detail: 'test refusal',
    }
    controller.probeResult = {
      status: 'annualPassProbeRefused',
      restoration: 'checkpointRestored',
      reason: 'annualPassThrew',
      detail: 'test refusal',
    }
    controller.authorizationResult = {
      status: 'conversionLinkedWithdrawalGroupAuthorizationWithheld',
      reason: 'fundingNotEvaluated',
    }
    controller.counterfactualInputs.length = 0
    controller.probeInputs.length = 0
    controller.authorizationInputs.length = 0
  })

  it('refuses without running a pass when the annual funding unit is absent', () => {
    const result = annualConversionLinkedWithdrawalFunding({
      ...input(),
      taxUnitId: null,
    })

    expect(result).toEqual({
      baseline: null,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    })
    expect(controller.counterfactualInputs).toHaveLength(0)
    expect(controller.probeInputs).toHaveLength(0)
  })

  it('refuses without running a pass when there are no linked actions to omit', () => {
    const result = annualConversionLinkedWithdrawalFunding({
      ...input(),
      omitActionIds: [],
    })

    expect(result).toEqual({
      baseline: null,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    })
    expect(controller.counterfactualInputs).toHaveLength(0)
    expect(controller.probeInputs).toHaveLength(0)
  })

  it('keeps the committed run refused when T0 cannot be read', () => {
    const result = annualConversionLinkedWithdrawalFunding(input())

    expect(result).toEqual({
      baseline: null,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    })
    expect(controller.counterfactualInputs).toHaveLength(1)
    expect(controller.probeInputs).toHaveLength(0)
  })

  it('uses one pass contract for T0 and staging and returns proven authorization', () => {
    controller.baselineResult = {
      status: 'counterfactualAnnualLiabilityRead',
      liability: LIABILITY,
      identity: IDENTITY,
    }
    controller.probeResult = {
      status: 'annualPassProbeRead',
      restoration: 'checkpointRestored',
      observation: STAGED_EXECUTION,
    }
    controller.authorizationResult = {
      status: 'conversionLinkedWithdrawalGroupsAuthorized',
      authorizations: [AUTHORIZATION],
    }
    const requests: Readonly<AnnualConversionLinkedWithdrawalFundingPassRequest>[] = []

    const result = annualConversionLinkedWithdrawalFunding(input((request) => {
      requests.push(request)
      return {
        yearResult: {
          year: 2026,
          tax: 10,
          penalties: 2,
          conversionLinkedWithdrawalGroupExecution:
            STAGED_EXECUTION as never,
        },
      }
    }))

    expect(requests).toHaveLength(2)
    expect([...requests[0]!.omittedRetirementActionIds!]).toEqual([
      ACTION_ID,
      WITHDRAWAL_ID,
    ])
    expect(requests[0]).toMatchObject({
      annualLiabilityBaseline: null,
      release: { kind: 'refuseAll' },
    })
    expect(requests[1]).toEqual({
      annualLiabilityBaseline: BASELINE,
      release: { kind: 'stageProvisionally' },
    })
    expect(controller.authorizationInputs).toEqual([STAGED_EXECUTION])
    expect(result).toEqual({
      baseline: BASELINE,
      release: {
        kind: 'proven',
        authorizations: [AUTHORIZATION],
      },
    })
  })

  it('retains T0 but refuses the commit when staging cannot be read', () => {
    controller.baselineResult = {
      status: 'counterfactualAnnualLiabilityRead',
      liability: LIABILITY,
      identity: IDENTITY,
    }

    const result = annualConversionLinkedWithdrawalFunding(input())

    expect(result).toEqual({
      baseline: BASELINE,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    })
    expect(controller.authorizationInputs).toHaveLength(0)
  })

  it('retains T0 but refuses a successful staging pass with no observation', () => {
    controller.baselineResult = {
      status: 'counterfactualAnnualLiabilityRead',
      liability: LIABILITY,
      identity: IDENTITY,
    }
    controller.probeResult = {
      status: 'annualPassProbeRead',
      restoration: 'checkpointRestored',
      observation: null,
    }

    const result = annualConversionLinkedWithdrawalFunding(input())

    expect(result).toEqual({
      baseline: BASELINE,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    })
    expect(controller.probeInputs).toHaveLength(1)
    expect(controller.authorizationInputs).toHaveLength(0)
  })

  it('retains T0 but refuses when group authorization is withheld', () => {
    controller.baselineResult = {
      status: 'counterfactualAnnualLiabilityRead',
      liability: LIABILITY,
      identity: IDENTITY,
    }
    controller.probeResult = {
      status: 'annualPassProbeRead',
      restoration: 'checkpointRestored',
      observation: STAGED_EXECUTION,
    }

    const result = annualConversionLinkedWithdrawalFunding(input(() => ({
      yearResult: {
        year: 2026,
        tax: 10,
        penalties: 2,
        conversionLinkedWithdrawalGroupExecution: STAGED_EXECUTION as never,
      },
    })))

    expect(result).toEqual({
      baseline: BASELINE,
      release: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    })
    expect(controller.authorizationInputs).toEqual([STAGED_EXECUTION])
  })
})
