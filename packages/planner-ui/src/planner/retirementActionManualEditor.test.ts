import { describe, expect, it } from 'vitest'

import {
  parseRetirementActionRequest,
  type LegacyAggregateRetirementActionRequest,
} from '@retiregolden/engine/actions/contract'
import { asPositiveUsdCents } from '@retiregolden/engine/actions/money'

import {
  buildRetirementActionManualIntent,
  emptyRetirementActionManualEditorDraft,
  formatPositiveUsdCents,
} from './retirementActionManualEditor'

function migrated(
  kind: 'legacyAggregateWithdrawal' | 'legacyAggregateRothConversion',
): Extract<
  LegacyAggregateRetirementActionRequest,
  { kind: 'legacyAggregateWithdrawal' | 'legacyAggregateRothConversion' }
> {
  const result = parseRetirementActionRequest({
    actionId: `migrated-${kind}`,
    kind,
    year: 2034,
    requestedAmount: asPositiveUsdCents(1_234_56),
    provenance: { source: 'migration', sourceId: 'plan-v1' },
    ...(kind === 'legacyAggregateWithdrawal' ? { legacyCategory: 'traditional' } : {}),
  })
  if (!result.ok || result.request.kind === 'legacyAggregateQcd' ||
      result.request.kind === 'qcd' || result.request.kind === 'ordinaryWithdrawal' ||
      result.request.kind === 'rothConversion') {
    throw new Error('expected migrated withdrawal/conversion')
  }
  return result.request
}

describe('buildRetirementActionManualIntent', () => {
  it('starts fail-closed and does not infer a person, account, date, sequence, or purpose', () => {
    const result = buildRetirementActionManualIntent(
      migrated('legacyAggregateWithdrawal'),
      emptyRetirementActionManualEditorDraft(),
    )

    expect(result).toEqual({
      ok: false,
      issues: [
        'Choose the person responsible for this action.',
        'Choose the exact source account.',
        'Confirm that the full preserved amount belongs to the selected source account.',
        'Choose a valid execution date in 2034.',
        'Enter a positive whole-number execution sequence.',
        'Choose the withdrawal purpose.',
      ],
    })
  })

  it('builds a complete manual withdrawal intent while preserving exact family/year/cents', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const draft = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'ira-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '7',
      withdrawalPurpose: 'taxPayment' as const,
    }

    expect(buildRetirementActionManualIntent(target, draft)).toEqual({
      ok: true,
      intent: {
        kind: 'ordinaryWithdrawal',
        year: 2034,
        executionDate: '2034-06-15',
        executionSequence: 7,
        requestedAmount: target.requestedAmount,
        personId: 'person-a',
        provenance: { source: 'manual' },
        sourceAllocations: [{
          sourceAccountId: 'ira-a',
          requestedAmount: target.requestedAmount,
        }],
        purpose: { kind: 'taxPayment' },
      },
    })
  })

  it('requires explicit conversion destination and funding facts', () => {
    const target = migrated('legacyAggregateRothConversion')
    const incomplete = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'ira-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      conversionTaxFunding: 'externalCash' as const,
    }
    expect(buildRetirementActionManualIntent(target, incomplete)).toEqual({
      ok: false,
      issues: [
        'Choose the exact Roth destination account.',
        'Enter a positive exact-cent tax-funding amount.',
        'Confirm that the external cash is available for conversion taxes.',
      ],
    })

    const built = buildRetirementActionManualIntent(target, {
      ...incomplete,
      destinationRothAccountId: 'roth-a',
      taxFundingAmountDollars: 0.07,
      externalCashAttested: true,
    })
    expect(built).toMatchObject({
      ok: true,
      intent: {
        kind: 'rothConversion',
        destinationRothAccountId: 'roth-a',
        taxFunding: { kind: 'externalCash', amount: 7, attested: true },
      },
    })
  })

  it('rejects invalid or wrong-year dates and unsafe/nonpositive sequences', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const base = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'ira-a',
      fullSourceAmountConfirmed: true,
      withdrawalPurpose: 'spending' as const,
    }
    for (const executionDate of ['2033-12-31', '2034-02-30', 'not-a-date']) {
      const result = buildRetirementActionManualIntent(target, {
        ...base,
        executionDate,
        executionSequence: '1',
      })
      expect(result.ok).toBe(false)
    }
    for (const executionSequence of ['', '0', '-1', '1.5', '9007199254740992']) {
      const result = buildRetirementActionManualIntent(target, {
        ...base,
        executionDate: '2034-01-01',
        executionSequence,
      })
      expect(result.ok).toBe(false)
    }
  })

  it('formats exact cents without dropping the fractional amount', () => {
    expect(formatPositiveUsdCents(7)).toBe('$0.07')
    expect(formatPositiveUsdCents(123_456)).toBe('$1,234.56')
  })
})
