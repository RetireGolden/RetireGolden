import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { annualRothBasisPoolKey } from './annualRothBasisPoolKey.js'

function rothAccount(
  kind: 'ira' | 'employer',
  ownerPersonId: string | null,
  id: string,
): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    kind,
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
  }
}

describe('annualRothBasisPoolKey', () => {
  it('aggregates Roth IRAs by owner and falls back to the primary owner', () => {
    expect(annualRothBasisPoolKey(rothAccount('ira', 'p2', 'ira-a'), 'p1'))
      .toBe('rothira:p2')
    expect(annualRothBasisPoolKey(rothAccount('ira', null, 'ira-b'), 'p1'))
      .toBe('rothira:p1')
  })

  it('keeps employer Roth accounts in account-specific pools', () => {
    expect(annualRothBasisPoolKey(
      rothAccount('employer', 'p2', 'roth-401k'),
      'p1',
    )).toBe('roth:roth-401k')
  })
})
