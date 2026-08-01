import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { createActionReason } from '@retiregolden/engine/actions/reasons'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '@retiregolden/engine/actions/identity'
import { asPositiveUsdCents, asUsdCents } from '@retiregolden/engine/actions/money'
import type { ScenarioPlanComparison } from '@retiregolden/engine/scenarios/comparison'
import { ScenarioActionComparisonTable } from './ScenarioActionComparisonTable'

type ActionRow = ScenarioPlanComparison['actionRows'][number]

function render(actionRows: ScenarioPlanComparison['actionRows']) {
  return renderToStaticMarkup(<ScenarioActionComparisonTable actionRows={actionRows} />)
}

describe('ScenarioActionComparisonTable', () => {
  it('renders canonical stable identities, exact cents, allocation amounts, and typed reasons', () => {
    const reason = createActionReason('conversion-balance-trimmed', {
      accountId: asAccountId('traditional-source'),
      allocationId: asAllocationId('source-lot'),
    })
    const baseline = {
      actionId: asActionId('conversion-action'),
      kind: 'rothConversion',
      year: 2032,
      personId: asPersonId('person-alex'),
      destinationAccountId: asAccountId('roth-destination'),
      charityDesignationId: null,
      requestedAmountCents: asPositiveUsdCents(12_345),
      executedAmountCents: asUsdCents(10_001),
      unexecutedAmountCents: asUsdCents(2_344),
      readiness: 'actionable',
      outcome: 'partial',
      sourceAllocations: [{
        allocationId: asAllocationId('source-lot'),
        sourceAccountId: asAccountId('traditional-source'),
        resolution: 'resolved',
        requestedAmountCents: asPositiveUsdCents(12_345),
        executedAmountCents: asUsdCents(10_001),
        unexecutedAmountCents: asUsdCents(2_344),
      }],
      reasons: [reason],
    } as const
    const rows: readonly ActionRow[] = [{
      actionId: baseline.actionId,
      baseline,
      proposal: null,
      baselineScheduleDiagnostics: [],
      proposalScheduleDiagnostics: [],
    }]

    const html = render(rows)
    expect(html).toContain('conversion-action')
    expect(html).toContain('person-alex')
    expect(html).toContain('traditional-source')
    expect(html).toContain('source-lot')
    expect(html).toContain('roth-destination')
    expect(html).toContain('$123.45')
    expect(html).toContain('$100.01')
    expect(html).toContain('$23.44')
    expect(html).toContain('conversion-balance-trimmed')
    expect(html).toContain(reason.message)
    expect(html).toContain('Not present in proposal')
  })

  it('renders proposal-only QCD charity identity and schedule diagnostics without deriving identities', () => {
    const actionId = asActionId('qcd-action')
    const rows: readonly ActionRow[] = [{
      actionId,
      baseline: null,
      proposal: {
        actionId,
        kind: 'qcd',
        year: 2035,
        personId: asPersonId('person-donor'),
        destinationAccountId: null,
        charityDesignationId: 'charity-designation',
        requestedAmountCents: asPositiveUsdCents(50_001),
        executedAmountCents: asUsdCents(0),
        unexecutedAmountCents: asUsdCents(50_001),
        readiness: 'nonActionable',
        outcome: 'refused',
        sourceAllocations: [{
          allocationId: asAllocationId('qcd-allocation'),
          sourceAccountId: asAccountId('ira-source'),
          resolution: 'unresolved',
          requestedAmountCents: asPositiveUsdCents(50_001),
          executedAmountCents: asUsdCents(0),
          unexecutedAmountCents: asUsdCents(50_001),
        }],
        reasons: [createActionReason('action-sequence-conflict')],
      },
      baselineScheduleDiagnostics: [],
      proposalScheduleDiagnostics: [{
        kind: 'executionSequenceConflict',
        actionId,
        year: 2035,
        scheduledDate: '2035-08-01',
        executionSequence: 2,
        collidingActionIds: [actionId, asActionId('other-action')],
        reason: createActionReason('action-sequence-conflict'),
      }],
    }]

    const html = render(rows)
    expect(html).toContain('Not present in baseline')
    expect(html).toContain('person-donor')
    expect(html).toContain('ira-source')
    expect(html).toContain('charity-designation')
    expect(html).toContain('$500.01')
    expect(html).toContain('Scheduled date 2035-08-01, sequence 2')
    expect(html).not.toContain('.. Scheduled date')
    expect(html).toContain('qcd-action, other-action')
  })

  it('keeps the final cent exact at the safe-integer boundary', () => {
    const actionId = asActionId('large-action')
    const amount = asPositiveUsdCents(Number.MAX_SAFE_INTEGER)
    const action = {
      actionId,
      kind: 'ordinaryWithdrawal',
      year: 2030,
      personId: asPersonId('person-large'),
      destinationAccountId: null,
      charityDesignationId: null,
      requestedAmountCents: amount,
      executedAmountCents: asUsdCents(Number.MAX_SAFE_INTEGER),
      unexecutedAmountCents: asUsdCents(0),
      readiness: 'actionable',
      outcome: 'executed',
      sourceAllocations: [],
      reasons: [],
    } as const
    const rows: readonly ActionRow[] = [{
      actionId,
      baseline: action,
      proposal: action,
      baselineScheduleDiagnostics: [],
      proposalScheduleDiagnostics: [],
    }]

    expect(render(rows)).toContain('$90,071,992,547,409.91')
  })

  it('renders duplicate and year-mismatch diagnostics even when neither side has an action row', () => {
    const actionId = asActionId('schedule-only')
    const rows: readonly ActionRow[] = [{
      actionId,
      baseline: null,
      proposal: null,
      baselineScheduleDiagnostics: [{
        kind: 'duplicateActionId',
        actionId,
        inputIndexes: [0, 3],
      }],
      proposalScheduleDiagnostics: [{
        kind: 'actionYearMismatch',
        actionId,
        expectedYear: 2030,
        actualYear: 2031,
      }],
    }]

    const html = render(rows)
    expect(html).toContain('duplicateActionId: input indexes 0, 3.')
    expect(html).toContain('actionYearMismatch: expected year 2030; actual year 2031.')
  })

  it('states when the canonical comparison publishes no retirement actions', () => {
    const html = render([])
    expect(html).toContain('Retirement action execution (0 actions)')
    expect(html).toContain('Neither scenario published identity-bearing retirement actions.')
  })
})
