/**
 * v2 JSON backup envelope — ports the retired v1 pattern (versioned envelope,
 * size cap, validate-before-replace) to multi-plan v2 data.
 *
 * The pure envelope logic lives in `planFormat.ts` (published as the stable
 * `@retiregolden/planner-ui/plan-format` subpath) and is re-exported here so
 * existing import sites keep working; this module keeps the storage-aware
 * import normalization.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { rebindScenarioPatchesToPlan } from '@retiregolden/engine/scenarios/patch'
import { isExamplePlanId } from './planOrigin'
import { listPlanSummaries } from './planStore'

export {
  LEGACY_V2_BACKUP_KIND,
  MAX_BACKUP_JSON_CHARS,
  RETIREMINT_V2_BACKUP_KIND,
  V2_BACKUP_KIND,
  V2_BACKUP_VERSION,
  parseV2Backup,
  serializeV2Backup,
  type ParseV2BackupResult,
  type V2BackupEnvelope,
} from './planFormat'

/**
 * On import, demos become user plans and reserved `example:*` ids are rekeyed
 * so they cannot collide with library demo slots. `existingIds` is every id
 * already taken (host store plans + browser demo slots — see
 * `listKnownPlanIdsVia`); when omitted, the browser store supplies them.
 */
export async function normalizePlansForImport(plans: Plan[], existingIds?: Iterable<string>): Promise<Plan[]> {
  const used = new Set(existingIds ?? (await listPlanSummaries()).map((s) => s.id))
  const normalized: Plan[] = []

  for (const plan of plans) {
    let id = plan.id
    if (plan.origin === 'example' || isExamplePlanId(id) || used.has(id)) {
      do {
        id = crypto.randomUUID()
      } while (used.has(id))
    }
    used.add(id)
    const imported = {
      ...plan,
      id,
      origin: 'user',
    } satisfies Plan
    normalized.push(id === plan.id ? imported : rebindScenarioPatchesToPlan(imported))
  }
  return normalized
}
