/**
 * IndexedDB persistence for v2 plans. Replaces v1's localStorage approach —
 * plans (earnings histories, scenarios, cached results later) outgrow the
 * ~5 MB synchronous localStorage budget. Every read passes through schema
 * migration + validation; corrupt records are surfaced, never silently used.
 */

import { openDB, type IDBPDatabase } from 'idb'

import { isUserPlan, planOriginFromRaw } from './planOrigin'
import { migratePlanToCurrent, type MigrateResult } from '@retiregolden/engine/model/migrations'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

const DB_NAME = 'retiregolden.v2'
const DB_VERSION = 1
const PLANS_STORE = 'plans'

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(PLANS_STORE)) {
        database.createObjectStore(PLANS_STORE, { keyPath: 'id' })
      }
    },
  })
  return dbPromise
}

/** Test hook: drop the cached connection so fake-indexeddb resets take effect. */
export function _resetPlanStoreForTests(): void {
  dbPromise = null
}

export interface PlanSummary {
  id: string
  name: string
  updatedAtIso: string
  origin: 'user' | 'example'
}

function toSummary(raw: Record<string, unknown>): PlanSummary | null {
  const id = String(raw['id'] ?? '')
  if (id === '') return null
  return {
    id,
    name: String(raw['name'] ?? '(unnamed)'),
    updatedAtIso: String(raw['updatedAtIso'] ?? ''),
    origin: planOriginFromRaw(raw),
  }
}

async function summariesWhere(predicate: (raw: Record<string, unknown>) => boolean): Promise<PlanSummary[]> {
  const all = (await (await db()).getAll(PLANS_STORE)) as Array<Record<string, unknown>>
  return all
    .filter(predicate)
    .map(toSummary)
    .filter((s): s is PlanSummary => s !== null)
    .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso))
}

/** All stored plans, including library demos. Prefer the filtered helpers for UI. */
export async function listPlanSummaries(): Promise<PlanSummary[]> {
  return summariesWhere(() => true)
}

export async function listUserPlanSummaries(): Promise<PlanSummary[]> {
  return summariesWhere(isUserPlan)
}

export async function listExampleSummaries(): Promise<PlanSummary[]> {
  return summariesWhere((raw) => !isUserPlan(raw))
}

/** Loads, migrates, and validates a stored plan. */
export async function loadPlan(id: string): Promise<MigrateResult> {
  const raw = (await (await db()).get(PLANS_STORE, id)) as unknown
  if (raw === undefined) return { ok: false, reason: 'not_object' }
  return migratePlanToCurrent(raw)
}

export type SavePlanResult = { ok: true; plan: Plan } | { ok: false; issues: string[] }

/** Validates and writes a plan, bumping `updatedAtIso`. */
export async function savePlan(plan: Plan, now: () => Date = () => new Date()): Promise<SavePlanResult> {
  const stamped: Plan = { ...plan, updatedAtIso: now().toISOString() }
  const checked = parsePlan(stamped)
  if (!checked.ok) return { ok: false, issues: checked.issues }
  await (await db()).put(PLANS_STORE, checked.plan)
  return { ok: true, plan: checked.plan }
}

export interface DuplicatePlanOptions {
  name?: string
  newId?: () => string
  now?: () => Date
  /**
   * Clone this in-memory plan instead of reloading the stored copy. The open
   * workspace passes its live (possibly just-edited, not-yet-autosaved) plan so
   * a duplicate doesn't silently drop unsaved changes.
   */
  source?: Plan
}

export async function duplicatePlan(id: string, opts: DuplicatePlanOptions = {}): Promise<SavePlanResult> {
  let source = opts.source
  if (!source) {
    const loaded = await loadPlan(id)
    if (!loaded.ok) return { ok: false, issues: [`Could not load source plan (${loaded.reason}).`] }
    source = loaded.plan
  }
  const now = opts.now ?? (() => new Date())
  const nowIso = now().toISOString()
  const clone: Plan = structuredClone(source)
  clone.id = (opts.newId ?? (() => crypto.randomUUID()))()
  clone.name = opts.name?.trim() || `Copy of ${source.name}`
  clone.origin = 'user'
  clone.exampleSourceId = source.exampleSourceId
  clone.createdAtIso = nowIso
  clone.updatedAtIso = nowIso
  return savePlan(clone, () => new Date(nowIso))
}

/**
 * Atomically converts a library demo to a user plan: delete the reserved
 * `example:*` record and put the converted plan under a fresh id.
 */
export async function convertExampleToUserPlan(
  plan: Plan,
  opts: { newId?: () => string; now?: () => Date } = {},
): Promise<SavePlanResult> {
  const newId = (opts.newId ?? (() => crypto.randomUUID()))()
  const now = opts.now ?? (() => new Date())
  const nowIso = now().toISOString()
  const converted: Plan = {
    ...plan,
    id: newId,
    origin: 'user',
    exampleSourceId: plan.exampleSourceId ?? plan.id.replace(/^example:/, ''),
    updatedAtIso: nowIso,
  }
  const checked = parsePlan(converted)
  if (!checked.ok) return { ok: false, issues: checked.issues }

  const database = await db()
  const tx = database.transaction(PLANS_STORE, 'readwrite')
  await tx.store.delete(plan.id)
  await tx.store.put(checked.plan)
  await tx.done
  return { ok: true, plan: checked.plan }
}

export async function deletePlan(id: string): Promise<void> {
  await (await db()).delete(PLANS_STORE, id)
}

export async function clearAllPlans(): Promise<void> {
  await (await db()).clear(PLANS_STORE)
}

/** Raw record count — includes library demos. */
export async function countStoredPlans(): Promise<number> {
  return (await (await db()).count(PLANS_STORE))
}
