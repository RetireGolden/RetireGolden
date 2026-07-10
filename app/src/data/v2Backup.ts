/**
 * v2 JSON backup envelope — ports the retired v1 pattern (versioned envelope,
 * size cap, validate-before-replace) to multi-plan v2 data.
 * Plans inside the envelope carry their own schemaVersion and are individually
 * migrated on import, so old backups stay restorable forever.
 */

import { migratePlanToCurrent } from '../engine/model/migrations'
import type { Plan } from '../engine/model/plan'
import { isExamplePlanId } from './planOrigin'
import { listPlanSummaries } from './planStore'

export const V2_BACKUP_KIND = 'retiregolden.v2.backup'
/** Legacy envelope kind from before the RetireGolden rebrand — still accepted on import. */
export const LEGACY_V2_BACKUP_KIND = 'retirecalc.v2.backup'
export const V2_BACKUP_VERSION = 1
/** Generous cap; primarily guards against importing the wrong (huge) file. */
export const MAX_BACKUP_JSON_CHARS = 10_000_000

export interface V2BackupEnvelope {
  kind: typeof V2_BACKUP_KIND
  backupVersion: typeof V2_BACKUP_VERSION
  exportedAtIso: string
  plans: unknown[]
}

export function serializeV2Backup(plans: Plan[], now: () => Date = () => new Date()): string {
  const envelope: V2BackupEnvelope = {
    kind: V2_BACKUP_KIND,
    backupVersion: V2_BACKUP_VERSION,
    exportedAtIso: now().toISOString(),
    plans,
  }
  return JSON.stringify(envelope, null, 2)
}

export type ParseV2BackupResult =
  | { ok: true; plans: Plan[]; warnings: string[] }
  | { ok: false; reason: 'too_large' | 'not_json' | 'wrong_kind' | 'unsupported_version' | 'no_valid_plans' }

export function parseV2Backup(json: string): ParseV2BackupResult {
  if (json.length > MAX_BACKUP_JSON_CHARS) return { ok: false, reason: 'too_large' }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'not_json' }
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'wrong_kind' }
  const env = raw as { kind?: string; backupVersion?: number; plans?: unknown }
  if ((env.kind !== V2_BACKUP_KIND && env.kind !== LEGACY_V2_BACKUP_KIND) || !Array.isArray(env.plans)) {
    return { ok: false, reason: 'wrong_kind' }
  }
  if (env.backupVersion !== V2_BACKUP_VERSION) return { ok: false, reason: 'unsupported_version' }

  const plans: Plan[] = []
  const warnings: string[] = []
  env.plans.forEach((rawPlan, i) => {
    const result = migratePlanToCurrent(rawPlan)
    if (result.ok) {
      plans.push(result.plan)
    } else {
      warnings.push(`plan ${i + 1}: skipped (${result.reason})`)
    }
  })
  if (plans.length === 0) return { ok: false, reason: 'no_valid_plans' }
  return { ok: true, plans, warnings }
}

/**
 * On import, demos become user plans and reserved `example:*` ids are rekeyed
 * so they cannot collide with library demo slots.
 */
export async function normalizePlansForImport(plans: Plan[]): Promise<Plan[]> {
  const existing = new Set((await listPlanSummaries()).map((s) => s.id))
  const used = new Set(existing)
  const normalized: Plan[] = []

  for (const plan of plans) {
    let id = plan.id
    if (plan.origin === 'example' || isExamplePlanId(id) || used.has(id)) {
      do {
        id = crypto.randomUUID()
      } while (used.has(id))
    }
    used.add(id)
    normalized.push({
      ...plan,
      id,
      origin: 'user',
    })
  }
  return normalized
}
