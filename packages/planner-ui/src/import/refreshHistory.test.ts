import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import type { RefreshSnapshot } from './refresh'
import {
  _resetRefreshHistoryForTests,
  clearRefreshHistoryForPlan,
  deleteRefreshManualMapping,
  deleteRefreshSnapshot,
  listRefreshManualMappings,
  listRefreshSnapshots,
  saveRefreshManualMapping,
  pruneRefreshSnapshots,
  saveRefreshSnapshot,
  type RefreshManualMapping,
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
      expect(await saveRefreshSnapshot(snapshot(`p1-${day}`, 'plan-1', `2026-07-${String(day).padStart(2, '0')}T12:00:00.000Z`))).toBe(true)
    }
    await saveRefreshSnapshot(snapshot('p2-1', 'plan-2', '2026-07-01T12:00:00.000Z'))
    // Pruning runs after a mutation commits, never inside the write itself,
    // so an aborted write can be deleted without having evicted anything.
    await pruneRefreshSnapshots('plan-1')

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

  it('reports an unavailable durable snapshot store without rejecting the caller', async () => {
    // This is the browser-policy/private-mode branch. The panel still applies
    // the refresh, but needs this result to avoid claiming a durable undo.
    globalThis.indexedDB = undefined as unknown as IDBFactory
    _resetRefreshHistoryForTests()
    await expect(saveRefreshSnapshot(snapshot('unpersisted', 'plan-1', '2026-07-15T12:00:00.000Z'))).resolves.toBe(false)
  })

  it('clears snapshots and remembered mappings for a final deletion only', async () => {
    await saveRefreshSnapshot(snapshot('p1', 'plan-1', '2026-07-15T12:00:00.000Z'))
    await saveRefreshSnapshot(snapshot('p2', 'plan-2', '2026-07-15T12:00:00.000Z'))
    await saveRefreshManualMapping({
      planId: 'plan-1',
      normalizedBrokerLabel: 'schwab:brokerage 789',
      accountId: 'acct-1',
      assignedAtIso: '2026-07-15T12:00:00.000Z',
    })
    await saveRefreshManualMapping({
      planId: 'plan-2',
      normalizedBrokerLabel: 'schwab:brokerage 456',
      accountId: 'acct-2',
      assignedAtIso: '2026-07-15T12:00:00.000Z',
    })

    await clearRefreshHistoryForPlan('plan-1')

    expect(await listRefreshSnapshots('plan-1')).toEqual([])
    expect(await listRefreshManualMappings('plan-1')).toEqual([])
    expect(await listRefreshSnapshots('plan-2')).toEqual([snapshot('p2', 'plan-2', '2026-07-15T12:00:00.000Z')])
    expect(await listRefreshManualMappings('plan-2')).toHaveLength(1)
  })
})

describe('refreshHistory failure policy', () => {
  /** `DB_NAME` is module-private; the connection cases need the real name. */
  const DB_NAME_UNDER_TEST = 'retiregolden-refresh-history'

  it('does not cache a rejected open, so a later refresh can retain history again', async () => {
    // Another tab left the database at a higher version, so opening at
    // DB_VERSION fails. Memoising that rejection used to leave the tab
    // without an undo record for every refresh that followed.
    const ahead = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(DB_NAME_UNDER_TEST, 2)
      request.onupgradeneeded = () => undefined
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    expect(await saveRefreshSnapshot(snapshot('s1', 'plan-1', '2026-07-15T12:00:00.000Z'))).toBe(false)

    ahead.close()
    await new Promise<void>((resolve) => {
      const request = globalThis.indexedDB.deleteDatabase(DB_NAME_UNDER_TEST)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })

    expect(await saveRefreshSnapshot(snapshot('s1', 'plan-1', '2026-07-15T12:00:00.000Z'))).toBe(true)
  })

  it('never rejects out of a write helper, whatever the store does', async () => {
    // A value IndexedDB refuses to key makes the put/delete itself reject,
    // which is the shape a quota or browser-policy refusal takes after the
    // connection is already open. The module's policy is that operational
    // history never turns a refresh or a plan delete into a failure.
    const unkeyable = {
      planId: undefined,
      normalizedBrokerLabel: 'schwab:brokerage 789',
      accountId: 'acct-1',
      assignedAtIso: '2026-07-15T12:00:00.000Z',
    } as unknown as RefreshManualMapping

    await expect(saveRefreshManualMapping(unkeyable)).resolves.toBeUndefined()
    await expect(
      deleteRefreshManualMapping(undefined as unknown as string, 'schwab:brokerage 789'),
    ).resolves.toBeUndefined()
    await expect(deleteRefreshSnapshot(undefined as unknown as string)).resolves.toBeUndefined()
  })
})
