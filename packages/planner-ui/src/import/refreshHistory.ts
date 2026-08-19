/**
 * Local operational history for broker refreshes. This deliberately lives
 * outside the engine Plan: snapshots and remembered row assignments describe a
 * refresh operation, not simulation inputs, so they never travel in a plan
 * file. The adapter is inert outside a browser (or fake IndexedDB test host).
 */

import { openDB, type IDBPDatabase } from 'idb'

import type { RefreshSnapshot } from './refresh'

const DB_NAME = 'retiregolden-refresh-history'
const DB_VERSION = 1
const SNAPSHOTS_STORE = 'snapshots'
const MAPPINGS_STORE = 'manualMappings'
const SNAPSHOT_LIMIT_PER_PLAN = 10

let dbPromise: Promise<IDBPDatabase> | null = null
// While a clear-all deletion is pending, no new connection may open from
// this module - an in-flight per-plan clear would otherwise re-block it.
let clearingAll = false

function db(): Promise<IDBPDatabase> | null {
  // `openDB` is only reached from an interaction in the browser. Keeping this
  // guard means the planner package remains importable by browser-free hosts.
  if (typeof indexedDB === 'undefined') return null
  if (clearingAll) return null
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        database.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(MAPPINGS_STORE)) {
        database.createObjectStore(MAPPINGS_STORE, { keyPath: ['planId', 'normalizedBrokerLabel'] })
      }
    },
  })
  return dbPromise
}

async function openHistoryDb(): Promise<IDBPDatabase | null> {
  const promise = db()
  if (promise === null) return null
  try {
    return await promise
  } catch {
    // A private-browsing/browser-policy failure must not make a balance refresh
    // fail. The refresh can still apply; it simply cannot retain local history.
    return null
  }
}

/** Test hook: let fake-indexeddb replacement take effect between tests. */
/**
 * Whether a durable history store exists in this host. Callers that must
 * order a durable write before a plan mutation await only when this is true,
 * so hosts without IndexedDB (and synchronous tests) stay synchronous.
 */
export function refreshHistoryAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

/** Prune a plan's snapshots to the retention bound; call after a mutation commits. */
export async function pruneRefreshSnapshots(planId: string): Promise<void> {
  try {
    const database = await openHistoryDb()
    if (database === null) return
    const tx = database.transaction(SNAPSHOTS_STORE, 'readwrite')
    const stale = ((await tx.store.getAll()) as unknown[])
      .filter(isSnapshot)
      .filter((candidate) => candidate.planId === planId)
      .sort((left, right) => right.appliedAtIso.localeCompare(left.appliedAtIso) || right.id.localeCompare(left.id))
      .slice(SNAPSHOT_LIMIT_PER_PLAN)
    await Promise.all(stale.map((candidate) => tx.store.delete(candidate.id)))
    await tx.done
  } catch {
    // Retention is best-effort; the next successful prune catches up.
  }
}

/** Remove one snapshot (an apply that aborted after its durable write). */
export async function deleteRefreshSnapshot(id: string): Promise<void> {
  const database = await openHistoryDb()
  if (!database) return
  await database.delete(SNAPSHOTS_STORE, id)
}

/** Erase the entire refresh-history database ("Clear all data" support). */
export async function clearAllRefreshHistory(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  // deleteDatabase blocks while a connection is open. Close this module's
  // own connection and latch db() shut so an in-flight per-plan clear cannot
  // reopen it; a blocked deletion is then queued by the browser and completes
  // the moment the last straggler transaction ends.
  clearingAll = true
  try {
    if (dbPromise !== null) {
      try {
        const open = await dbPromise
        open.close()
      } catch {
        // An unopenable database still gets the delete attempt below.
      }
      dbPromise = null
    }
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      // onblocked means the deletion has NOT run - a straggler transaction
      // (e.g. an unawaited per-plan clear) still holds a connection. With
      // db() latched shut nothing from this module reopens, so the queued
      // delete fires the moment that transaction ends; keep waiting for
      // onsuccess rather than declaring success early. The timeout is the
      // multi-tab escape hatch: another tab's connection is outside this
      // module's control, and hanging Clear-all on it would be worse.
      setTimeout(resolve, 10_000)
    })
  } finally {
    clearingAll = false
  }
}

export function _resetRefreshHistoryForTests(): void {
  dbPromise = null
}

export interface RefreshManualMapping {
  planId: string
  normalizedBrokerLabel: string
  accountId: string
  assignedAtIso: string
}

function isSnapshot(value: unknown): value is RefreshSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<RefreshSnapshot>
  return (
    typeof item.id === 'string' &&
    typeof item.planId === 'string' &&
    typeof item.appliedAtIso === 'string' &&
    typeof item.sourceLabel === 'string' &&
    typeof item.sourceSha256 === 'string' &&
    Array.isArray(item.changes)
  )
}

function isMapping(value: unknown): value is RefreshManualMapping {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<RefreshManualMapping>
  return (
    typeof item.planId === 'string' &&
    typeof item.normalizedBrokerLabel === 'string' &&
    typeof item.accountId === 'string' &&
    typeof item.assignedAtIso === 'string'
  )
}

/** The ten most recent snapshots for one plan, newest first. */
export async function listRefreshSnapshots(planId: string): Promise<RefreshSnapshot[]> {
  const database = await openHistoryDb()
  if (database === null) return []
  const all = (await database.getAll(SNAPSHOTS_STORE)) as unknown[]
  return all
    .filter(isSnapshot)
    .filter((snapshot) => snapshot.planId === planId)
    .sort((left, right) => right.appliedAtIso.localeCompare(left.appliedAtIso) || right.id.localeCompare(left.id))
}

/**
 * Persist a snapshot. Pruning is deliberately NOT done here: an aborted
 * apply/restore deletes its own record, and pruning at write time would let
 * that aborted write permanently evict a real older snapshot. Callers prune
 * with pruneRefreshSnapshots AFTER their mutation commits.
 */
export async function saveRefreshSnapshot(snapshot: RefreshSnapshot): Promise<boolean> {
  try {
    const database = await openHistoryDb()
    if (database === null) return false
    await database.put(SNAPSHOTS_STORE, snapshot)
    return true
  } catch {
    // A private-browsing, quota, or transaction failure must not turn the
    // refresh itself into a failure. Callers use the boolean to describe the
    // missing durable undo record accurately.
    return false
  }
}

/** Remove all local refresh history that belongs to one permanently deleted plan. */
export async function clearRefreshHistoryForPlan(planId: string): Promise<void> {
  const database = await openHistoryDb()
  if (database === null) return
  try {
    const tx = database.transaction([SNAPSHOTS_STORE, MAPPINGS_STORE], 'readwrite')
    const snapshots = tx.objectStore(SNAPSHOTS_STORE)
    const mappings = tx.objectStore(MAPPINGS_STORE)
    const [storedSnapshots, storedMappings] = await Promise.all([snapshots.getAll(), mappings.getAll()])
    await Promise.all([
      ...(storedSnapshots as unknown[])
        .filter(isSnapshot)
        .filter((snapshot) => snapshot.planId === planId)
        .map((snapshot) => snapshots.delete(snapshot.id)),
      ...(storedMappings as unknown[])
        .filter(isMapping)
        .filter((mapping) => mapping.planId === planId)
        .map((mapping) => mappings.delete([mapping.planId, mapping.normalizedBrokerLabel])),
    ])
    await tx.done
  } catch {
    // Deleting a plan must still succeed if browser policy makes its
    // operational history unavailable. A later clear-all remains a fallback.
  }
}

/** Read remembered manual row assignments for one plan. */
export async function listRefreshManualMappings(planId: string): Promise<RefreshManualMapping[]> {
  const database = await openHistoryDb()
  if (database === null) return []
  const all = (await database.getAll(MAPPINGS_STORE)) as unknown[]
  return all
    .filter(isMapping)
    .filter((mapping) => mapping.planId === planId)
    .sort((left, right) => right.assignedAtIso.localeCompare(left.assignedAtIso))
}

/** Upsert the one remembered destination for a normalized broker label in a plan. */
export async function saveRefreshManualMapping(mapping: RefreshManualMapping): Promise<void> {
  const database = await openHistoryDb()
  if (database === null) return
  await database.put(MAPPINGS_STORE, mapping)
}

/** Remove an obsolete remembered assignment without surfacing an error to the user. */
export async function deleteRefreshManualMapping(planId: string, normalizedBrokerLabel: string): Promise<void> {
  const database = await openHistoryDb()
  if (database === null) return
  await database.delete(MAPPINGS_STORE, [planId, normalizedBrokerLabel])
}
