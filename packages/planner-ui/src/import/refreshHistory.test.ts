import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import type { RefreshSnapshot } from './refresh'
import {
  _resetRefreshHistoryForTests,
  deleteRefreshManualMapping,
  listRefreshManualMappings,
  listRefreshSnapshots,
  saveRefreshManualMapping,
  saveRefreshSnapshot,
} from './refreshHistory'

function snapshot(id: string, planId: string, appliedAtIso: string): RefreshSnapshot {
  return {
    id,
    planId,
    appliedAtIso,
    sourceLabel: 'Schwab — positions.csv',
    sourceSha256: '',
    changes: [],
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetRefreshHistoryForTests()
})

describe('refreshHistory', () => {
  it('keeps the ten newest snapshots per plan, without pruning another plan', async () => {
    for (let day = 1; day <= 11; day++) {
      await saveRefreshSnapshot(snapshot(`p1-${day}`, 'plan-1', `2026-07-${String(day).padStart(2, '0')}T12:00:00.000Z`))
    }
    await saveRefreshSnapshot(snapshot('p2-1', 'plan-2', '2026-07-01T12:00:00.000Z'))

    const planOne = await listRefreshSnapshots('plan-1')
    expect(planOne).toHaveLength(10)
    expect(planOne.map((item) => item.id)).toEqual(['p1-11', 'p1-10', 'p1-9', 'p1-8', 'p1-7', 'p1-6', 'p1-5', 'p1-4', 'p1-3', 'p1-2'])
    expect(await listRefreshSnapshots('plan-2')).toEqual([snapshot('p2-1', 'plan-2', '2026-07-01T12:00:00.000Z')])
  })

  it('persists one manual mapping per normalized broker label across a reopened store', async () => {
    await saveRefreshManualMapping({
      planId: 'plan-1',
      normalizedBrokerLabel: 'individual',
      accountId: 'acct-taxable',
      assignedAtIso: '2026-07-15T12:00:00.000Z',
    })
    await saveRefreshManualMapping({
      planId: 'plan-1',
      normalizedBrokerLabel: 'individual',
      accountId: 'acct-renamed',
      assignedAtIso: '2026-07-16T12:00:00.000Z',
    })
    _resetRefreshHistoryForTests()

    expect(await listRefreshManualMappings('plan-1')).toEqual([
      {
        planId: 'plan-1',
        normalizedBrokerLabel: 'individual',
        accountId: 'acct-renamed',
        assignedAtIso: '2026-07-16T12:00:00.000Z',
      },
    ])
    await deleteRefreshManualMapping('plan-1', 'individual')
    expect(await listRefreshManualMappings('plan-1')).toEqual([])
  })
})
