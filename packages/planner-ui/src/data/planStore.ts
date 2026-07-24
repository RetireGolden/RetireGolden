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
import { rebindScenarioPatchesToPlan } from '@retiregolden/engine/scenarios/patch'

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

/**
 * The pure half of a save: bump `updatedAtIso` and re-validate. Every store
 * that persists plans (this one and any host-provided `PlanStore`) writes
 * through this so validation cannot drift between implementations.
 */
export function checkPlanForSave(plan: Plan, now: () => Date = () => new Date()): SavePlanResult {
  const stamped: Plan = { ...plan, updatedAtIso: now().toISOString() }
  const checked = parsePlan(stamped)
  if (!checked.ok) return { ok: false, issues: checked.issues }
  return { ok: true, plan: checked.plan }
}

/** Validates and writes a plan, bumping `updatedAtIso`. */
export async function savePlan(plan: Plan, now: () => Date = () => new Date()): Promise<SavePlanResult> {
  const checked = checkPlanForSave(plan, now)
  if (!checked.ok) return checked
  await (await db()).put(PLANS_STORE, checked.plan)
  return checked
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

/**
 * The pure half of duplication: fresh id, user origin, stamped timestamps.
 * Shared by the browser store and the store-generic seam operations so the
 * clone semantics live in exactly one place.
 */
export function cloneAsUserPlan(source: Plan, opts: DuplicatePlanOptions = {}): { clone: Plan; nowIso: string } {
  const now = opts.now ?? (() => new Date())
  const nowIso = now().toISOString()
  const clone: Plan = structuredClone(source)
  clone.id = (opts.newId ?? (() => crypto.randomUUID()))()
  clone.name = opts.name?.trim() || `Copy of ${source.name}`
  clone.origin = 'user'
  clone.exampleSourceId = source.exampleSourceId
  clone.createdAtIso = nowIso
  clone.updatedAtIso = nowIso
  return { clone: rebindScenarioPatchesToPlan(clone), nowIso }
}

export async function duplicatePlan(id: string, opts: DuplicatePlanOptions = {}): Promise<SavePlanResult> {
  let source = opts.source
  if (!source) {
    const loaded = await loadPlan(id)
    if (!loaded.ok) return { ok: false, issues: [`Could not load source plan (${loaded.reason}).`] }
    source = loaded.plan
  }
  const { clone, nowIso } = cloneAsUserPlan(source, opts)
  return savePlan(clone, () => new Date(nowIso))
}

/**
 * The pure half of demo conversion: the `example:*` record re-keyed under a
 * fresh id as a user plan, re-validated. The delete/write choreography is the
 * caller's business (atomic here; save-then-delete across the seam).
 */
export function convertedFromExample(
  plan: Plan,
  opts: { newId?: () => string; now?: () => Date } = {},
): SavePlanResult {
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
  const checked = parsePlan(rebindScenarioPatchesToPlan(converted))
  if (!checked.ok) return { ok: false, issues: checked.issues }
  return { ok: true, plan: checked.plan }
}

/**
 * Atomically converts a library demo to a user plan: delete the reserved
 * `example:*` record and put the converted plan under a fresh id.
 */
export async function convertExampleToUserPlan(
  plan: Plan,
  opts: { newId?: () => string; now?: () => Date } = {},
): Promise<SavePlanResult> {
  const converted = convertedFromExample(plan, opts)
  if (!converted.ok) return converted

  const database = await db()
  const tx = database.transaction(PLANS_STORE, 'readwrite')
  await tx.store.delete(plan.id)
  await tx.store.put(converted.plan)
  await tx.done
  return converted
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

/**
 * Raw record accessors backing the browser implementation of the `PlanStore`
 * seam (data/planStoreContext.tsx): documents in/out, no migration or
 * validation — those stay in the seam layer so they run identically over any
 * store. Prefer `loadPlan`/`savePlan` everywhere else.
 */
export async function getPlanRecord(id: string): Promise<unknown> {
  return (await (await db()).get(PLANS_STORE, id)) as unknown
}

export async function putPlanRecord(plan: Plan): Promise<void> {
  await (await db()).put(PLANS_STORE, plan)
}
