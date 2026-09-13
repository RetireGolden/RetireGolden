import { describe, expect, it } from 'vitest'
import { consumeStateBasis, type StateBasisPool } from './stateBasisPoolState.js'

describe('state basis commit isolation', () => {
  it('consumes a committed event once and leaves rejected probes reusable', () => {
    const pools: StateBasisPool[] = [{ key: 'NJ/ira/owner', state: 'NJ', accountId: 'ira', ownerPersonId: 'owner',
      kind: 'njIra', taxYear: 2026, opening: { known: true, amount: 100 },
      remaining: { known: true, amount: 100 }, consumedByEvent: {} }]
    const first = consumeStateBasis(pools, { key: pools[0]!.key, eventId: 'first', recoveredBasis: 60 })
    expect(first.pools[0]!.remaining).toEqual({ known: true, amount: 40 })
    expect(pools[0]!.remaining).toEqual({ known: true, amount: 100 })
    expect(consumeStateBasis(first.pools, { key: pools[0]!.key, eventId: 'first', recoveredBasis: 60 }).pools).toBe(first.pools)
    expect(consumeStateBasis(first.pools, { key: pools[0]!.key, eventId: 'second', recoveredBasis: 50 }).status).toBe('incomplete')
  })
})
