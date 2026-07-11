/**
 * Load, refresh, and convert library example demos in IndexedDB.
 */

import { exampleStorageId } from '../../data/planOrigin'
import { convertExampleToUserPlan, loadPlan, savePlan, type SavePlanResult } from '../../data/planStore'
import type { Plan } from '@retiregolden/engine/model/plan'
import { exampleFixedNow } from './buildContext'
import { getExampleById, type ExamplePlan } from './registry'

export function demoPlanId(exampleId: string): string {
  return exampleStorageId(exampleId)
}

export function isDemoPlan(plan: Plan): boolean {
  return plan.origin === 'example'
}

function stampDemo(example: ExamplePlan): Plan {
  const built = example.build()
  return {
    ...built,
    id: demoPlanId(example.id),
    name: example.title,
    origin: 'example',
    exampleSourceId: example.id,
    createdAtIso: exampleFixedNow().toISOString(),
    updatedAtIso: exampleFixedNow().toISOString(),
  }
}

export async function demoRecordExists(exampleId: string): Promise<boolean> {
  const loaded = await loadPlan(demoPlanId(exampleId))
  return loaded.ok
}

export async function loadDemoRecord(exampleId: string): Promise<Plan | null> {
  const loaded = await loadPlan(demoPlanId(exampleId))
  return loaded.ok ? loaded.plan : null
}

export async function saveFreshDemo(example: ExamplePlan): Promise<SavePlanResult> {
  return savePlan(stampDemo(example), exampleFixedNow)
}

export type OpenExampleChoice = 'open-existing' | 'load-fresh'

export interface OpenExampleResult {
  ok: true
  planId: string
  /** When a record already existed and the caller should prompt. */
  needsChoice?: true
}

export async function prepareExampleOpen(exampleId: string): Promise<OpenExampleResult | { ok: false; reason: string }> {
  const example = getExampleById(exampleId)
  if (!example) return { ok: false, reason: 'unknown example' }

  const exists = await demoRecordExists(exampleId)
  if (!exists) {
    const saved = await saveFreshDemo(example)
    if (!saved.ok) return { ok: false, reason: saved.issues.join('; ') }
    return { ok: true, planId: saved.plan.id }
  }
  return { ok: true, planId: demoPlanId(exampleId), needsChoice: true }
}

export async function openExampleExisting(exampleId: string): Promise<{ ok: true; planId: string } | { ok: false; reason: string }> {
  const loaded = await loadDemoRecord(exampleId)
  if (!loaded) return { ok: false, reason: 'demo not found' }
  return { ok: true, planId: loaded.id }
}

export async function openExampleFresh(exampleId: string): Promise<{ ok: true; planId: string } | { ok: false; reason: string }> {
  const example = getExampleById(exampleId)
  if (!example) return { ok: false, reason: 'unknown example' }
  const saved = await saveFreshDemo(example)
  if (!saved.ok) return { ok: false, reason: saved.issues.join('; ') }
  return { ok: true, planId: saved.plan.id }
}

export async function saveExampleToMyPlans(
  plan: Plan,
  opts: { newId?: () => string } = {},
): Promise<SavePlanResult> {
  if (plan.origin !== 'example') {
    return { ok: false, issues: ['Only library examples can be converted.'] }
  }
  return convertExampleToUserPlan(plan, opts)
}
