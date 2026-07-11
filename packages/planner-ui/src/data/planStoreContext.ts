/**
 * The plan-persistence seam: a host supplies plan storage by implementing
 * `PlanStore` and wrapping the planner in `<PlanStoreProvider>`; the default
 * is the browser IndexedDB implementation, so web hosts change nothing.
 *
 * The seam is deliberately plan-scoped and storage-dumb:
 *
 * - **Documents in, documents out.** `loadPlan` returns the stored plan JSON
 *   verbatim (any schema version) and the seam layer runs schema migration +
 *   validation on read — the single code path persisted reads have always
 *   gone through. `savePlan` receives an already-validated, already-stamped
 *   `Plan`; a store never re-implements validation.
 * - **No client/household concepts.** A host that groups plans (per-client
 *   libraries) binds that identity outside this interface — its adapter maps
 *   plan ids into whatever structure it keeps.
 * - **No change feed.** Every list view refetches after its own mutations
 *   (the pattern the web app has always used), so a subscription mechanism
 *   is deliberately omitted rather than speculatively bolted on.
 * - **Library demo records (`example:*` ids) never cross the seam.** They
 *   are per-device preview UX, not plan data, and stay in the browser store
 *   regardless of provider; "Save to my plans" is the crossing point, and it
 *   writes the converted user plan through the seam. The `*Via` operations
 *   below route by id so callers don't care.
 */

import { createContext, useContext } from 'react'

import { migratePlanToCurrent, type MigrateResult } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'
import { isExamplePlanId } from './planOrigin'
import {
  checkPlanForSave,
  cloneAsUserPlan,
  deletePlan,
  getPlanRecord,
  listExampleSummaries,
  listUserPlanSummaries,
  loadPlan,
  putPlanRecord,
  savePlan,
  type DuplicatePlanOptions,
  type SavePlanResult,
} from './planStore'

/** What a plan list needs to render a row. The seam type carries no origin — every plan in a store is the user's. */
export interface PlanSummary {
  id: string
  name: string
  updatedAtIso: string
}

/**
 * Host-implementable plan storage. Implementations are plain objects; keep
 * the instance stable (module constant or memoized) — the planner reloads
 * when the provided store changes identity.
 */
export interface PlanStore {
  /** Summaries of every plan in the store. Order is not significant — the seam sorts by `updatedAtIso`, newest first. */
  listPlans(): Promise<PlanSummary[]>
  /** The stored plan document verbatim (any schema version), or `null`/`undefined` when absent. */
  loadPlan(id: string): Promise<unknown>
  /** Persist a validated plan. This is the autosave path — it runs on a debounce while the user edits. */
  savePlan(plan: Plan): Promise<void>
  deletePlan(id: string): Promise<void>
}

/**
 * The browser IndexedDB implementation (data/planStore.ts) — the default
 * store, and exported so hosts can wrap it. `listPlans` excludes library
 * demo records: they live in the same database but belong to the example
 * slots, not the user's plan list.
 */
export const indexedDbPlanStore: PlanStore = {
  listPlans: listUserPlanSummaries,
  loadPlan: getPlanRecord,
  savePlan: putPlanRecord,
  deletePlan,
}

/** Prefer `<PlanStoreProvider>` (data/PlanStoreProvider.tsx); the raw context is exported for it, not for general use. */
export const PlanStoreContext = createContext<PlanStore>(indexedDbPlanStore)

export function usePlanStore(): PlanStore {
  return useContext(PlanStoreContext)
}

/*
 * Store-generic operations. Components read the store from context and call
 * these; each routes `example:*` ids to the browser store (demo records are
 * device-local by design) and everything else through the given store, with
 * migration/validation applied here so hosts stay storage-dumb.
 */

/** The store's plan summaries, newest first. */
export async function listPlansVia(store: PlanStore): Promise<PlanSummary[]> {
  const summaries = await store.listPlans()
  return summaries.slice().sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso))
}

/** Loads, migrates, and validates a plan. Missing records surface as `{ ok: false, reason: 'not_object' }`, exactly like the browser store. */
export async function loadPlanVia(store: PlanStore, id: string): Promise<MigrateResult> {
  if (isExamplePlanId(id)) return loadPlan(id)
  const raw = await store.loadPlan(id)
  if (raw === undefined || raw === null) return { ok: false, reason: 'not_object' }
  return migratePlanToCurrent(raw)
}

/** Validates and writes a plan, bumping `updatedAtIso`. */
export async function savePlanVia(store: PlanStore, plan: Plan, now: () => Date = () => new Date()): Promise<SavePlanResult> {
  if (isExamplePlanId(plan.id)) return savePlan(plan, now)
  const checked = checkPlanForSave(plan, now)
  if (!checked.ok) return checked
  await store.savePlan(checked.plan)
  return checked
}

export async function deletePlanVia(store: PlanStore, id: string): Promise<void> {
  if (isExamplePlanId(id)) return deletePlan(id)
  return store.deletePlan(id)
}

export async function duplicatePlanVia(store: PlanStore, id: string, opts: DuplicatePlanOptions = {}): Promise<SavePlanResult> {
  let source = opts.source
  if (!source) {
    const loaded = await loadPlanVia(store, id)
    if (!loaded.ok) return { ok: false, issues: [`Could not load source plan (${loaded.reason}).`] }
    source = loaded.plan
  }
  const { clone, nowIso } = cloneAsUserPlan(source, opts)
  // Duplicates are always user plans (fresh uuid), so this writes through the store.
  return savePlanVia(store, clone, () => new Date(nowIso))
}

/** Every id the import path must not collide with: the store's plans plus the browser's demo slots. */
export async function listKnownPlanIdsVia(store: PlanStore): Promise<Set<string>> {
  const [stored, demos] = await Promise.all([store.listPlans(), listExampleSummaries()])
  return new Set([...stored.map((s) => s.id), ...demos.map((s) => s.id)])
}
