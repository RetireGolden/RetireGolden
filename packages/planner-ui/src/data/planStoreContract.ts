/**
 * Shared behavioral contract for the `PlanStore` seam (data/planStoreContext.ts).
 *
 * Every host that persists plans implements `PlanStore`; this suite pins the
 * semantics that ALL implementations must share so the public browser store
 * (data/planStore.ts → `indexedDbPlanStore`) and Pro's desktop library store
 * can prove they behave identically by running the same tests. Each consumer
 * supplies a `PlanStoreContractFactory` (fresh store per test + a valid plan
 * document builder + optional cleanup) and calls `describePlanStoreContract`.
 *
 * What is codified here is only what is genuinely shared, anchored in the
 * `PlanStore` interface doc comments in planStoreContext.ts:
 *
 * - `listPlans` returns `{ id, name, updatedAtIso }` summaries; ORDER IS NOT
 *   SIGNIFICANT (the seam sorts on read), so assertions here are order-free.
 * - `loadPlan` returns the stored document VERBATIM (any schemaVersion), or
 *   `null`/`undefined` when the id is absent.
 * - `savePlan` UPSERTS keyed by the plan document's own `id`: saving the same
 *   id twice leaves one entry with the later content and `updatedAtIso`. The
 *   raw store persists the document as given — it does not re-stamp or
 *   validate (that lives in the seam layer, savePlanVia/checkPlanForSave).
 * - `deletePlan` removes the plan, and deleting an ABSENT id must not reject
 *   (verified against the IndexedDB implementation, whose delete resolves for
 *   a missing key).
 *
 * Module dependencies: `vitest` + local seam types only. This file imports no
 * engine code and no adapter code — plan documents come from the factory — so
 * either repo can consume it. It is a TEST-ONLY subpath export
 * (`@retiregolden/planner-ui/data/planStoreContract`, via the package's
 * `"./*"` -> `"./src/*.ts"` map) and is deliberately NOT re-exported from
 * src/index.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PlanStore, PlanSummary } from './planStoreContext'

/** A plan document as the store receives it — the seam's own `savePlan` input type, kept engine-free here. */
export type PlanDoc = Parameters<PlanStore['savePlan']>[0]

/** Fields the suite varies when building documents. Everything else the factory fills with valid defaults. */
export interface PlanDocOverrides {
  /** The document's own id — the key `savePlan` upserts on. Defaults to a fresh unique id per call. */
  id?: string
  /** The plan name a summary must surface. Defaults to something unique. */
  name?: string
  /** The document's `updatedAtIso`, surfaced by summaries and used to prove upsert advances it. */
  updatedAtIso?: string
}

/**
 * Supplied by each consumer. The suite drives everything through this so it
 * never touches a concrete store or the engine directly.
 */
export interface PlanStoreContractFactory {
  /**
   * Return a FRESH, EMPTY store for a single test. Called in `beforeEach`;
   * `listPlans()` on the result must be empty. For a global-backed store
   * (e.g. IndexedDB) this is where you reset the backing database.
   */
  createStore: () => PlanStore | Promise<PlanStore>
  /**
   * Build a VALID plan document for the implementation under test. Given
   * overrides must be reflected verbatim in the returned document (so the
   * suite can assert on `id` / `name` / `updatedAtIso`). Omitted fields get
   * unique, valid defaults; two calls with no `id` yield two distinct ids.
   */
  makePlan: (overrides?: PlanDocOverrides) => PlanDoc | Promise<PlanDoc>
  /** Optional teardown run in `afterEach` (close handles, drop the database). */
  cleanup?: () => void | Promise<void>
}

/** Look up a summary by plan id without assuming any list ordering. */
function summaryById(summaries: readonly PlanSummary[], id: string): PlanSummary | undefined {
  return summaries.find((s) => s.id === id)
}

/**
 * Register the shared `PlanStore` contract under `label`. Call once per
 * implementation, e.g. `describePlanStoreContract('indexedDbPlanStore', { … })`.
 */
export function describePlanStoreContract(label: string, factory: PlanStoreContractFactory): void {
  describe(`PlanStore contract: ${label}`, () => {
    let store: PlanStore

    beforeEach(async () => {
      store = await factory.createStore()
    })

    afterEach(async () => {
      await factory.cleanup?.()
    })

    const makePlan = (overrides?: PlanDocOverrides): Promise<PlanDoc> =>
      Promise.resolve(factory.makePlan(overrides))

    it('lists nothing on a fresh store', async () => {
      expect(await store.listPlans()).toEqual([])
    })

    it('surfaces id, name and updatedAtIso in a summary after save', async () => {
      const plan = await makePlan({ id: 'plan-1', name: 'Alpha', updatedAtIso: '2026-01-01T00:00:00.000Z' })
      await store.savePlan(plan)

      const summaries = await store.listPlans()
      expect(summaries).toHaveLength(1)
      const summary = summaryById(summaries, 'plan-1')
      expect(summary).toBeDefined()
      expect(summary).toMatchObject({
        id: 'plan-1',
        name: 'Alpha',
        updatedAtIso: '2026-01-01T00:00:00.000Z',
      })
    })

    it('loads the stored document back verbatim', async () => {
      const plan = await makePlan({ id: 'plan-verbatim', name: 'Verbatim' })
      await store.savePlan(plan)

      const loaded = await store.loadPlan('plan-verbatim')
      expect(loaded).toEqual(plan)
    })

    it('returns null/undefined when loading an absent id', async () => {
      const loaded = await store.loadPlan('does-not-exist')
      expect(loaded == null).toBe(true)
    })

    it('lists every saved plan regardless of order', async () => {
      const a = await makePlan({ id: 'a', name: 'A', updatedAtIso: '2026-01-01T00:00:00.000Z' })
      const b = await makePlan({ id: 'b', name: 'B', updatedAtIso: '2026-06-01T00:00:00.000Z' })
      await store.savePlan(a)
      await store.savePlan(b)

      const ids = (await store.listPlans()).map((s) => s.id).sort()
      expect(ids).toEqual(['a', 'b'])
    })

    it('upserts by the document id: saving twice keeps one entry with the later content and updatedAtIso', async () => {
      const first = await makePlan({ id: 'same-id', name: 'First', updatedAtIso: '2026-01-01T00:00:00.000Z' })
      await store.savePlan(first)

      const second = await makePlan({ id: 'same-id', name: 'Second', updatedAtIso: '2026-02-02T00:00:00.000Z' })
      await store.savePlan(second)

      const summaries = await store.listPlans()
      expect(summaries).toHaveLength(1)
      const summary = summaryById(summaries, 'same-id')
      expect(summary?.name).toBe('Second')
      expect(summary?.updatedAtIso).toBe('2026-02-02T00:00:00.000Z')
      // updatedAtIso genuinely advanced, not merely overwritten with the same value.
      expect('2026-02-02T00:00:00.000Z' > '2026-01-01T00:00:00.000Z').toBe(true)

      const loaded = await store.loadPlan('same-id')
      expect(loaded).toEqual(second)
    })

    it('deletes a stored plan', async () => {
      const plan = await makePlan({ id: 'to-delete', name: 'Doomed' })
      await store.savePlan(plan)
      expect(await store.listPlans()).toHaveLength(1)

      await store.deletePlan('to-delete')

      expect(await store.listPlans()).toEqual([])
      expect((await store.loadPlan('to-delete')) == null).toBe(true)
    })

    it('does not reject when deleting an absent id, and leaves other plans intact', async () => {
      const keep = await makePlan({ id: 'keep', name: 'Keep' })
      await store.savePlan(keep)

      await expect(store.deletePlan('never-existed')).resolves.toBeUndefined()

      const ids = (await store.listPlans()).map((s) => s.id)
      expect(ids).toEqual(['keep'])
    })
  })
}
