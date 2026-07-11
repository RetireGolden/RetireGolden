/**
 * The v2 backup envelope — serialization and parsing of the plan-interchange
 * format documented in DOCS/features/plan-file-format.md.
 *
 * **Stability promise:** this module is published as the
 * `@retiregolden/planner-ui/plan-format` subpath and, unlike the wildcard
 * deep paths, is a supported API: the envelope `kind`/`backupVersion`
 * contract, the exported names, and their signatures only change with a
 * semver-major release of the package. It is deliberately browser-free
 * (no IndexedDB, no DOM) so hosts can run it anywhere — e.g. an Electron
 * main process assembling library backups. (A standalone
 * `@retiregolden/plan-format` package may eventually take this over; this
 * subpath is the first step.)
 *
 * Format invariants callers may rely on:
 * - Plans inside the envelope carry their own `schemaVersion` and are
 *   individually migrated on parse, so old backups stay restorable forever.
 * - `parseV2Backup` ignores unknown envelope fields — a host may extend the
 *   envelope (extra top-level keys) and the file still round-trips through
 *   this parser and the web app's import.
 * - Envelope `kind`s from before the RetireGolden rebrand are still accepted.
 */

import { migratePlanToCurrent } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'

export const V2_BACKUP_KIND = 'retiregolden.v2.backup'
/** Legacy envelope kinds from before the RetireGolden rebrand — still accepted on import. */
export const LEGACY_V2_BACKUP_KIND = 'retirecalc.v2.backup'
export const RETIREMINT_V2_BACKUP_KIND = 'retiremint.v2.backup'
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
  if (
    (env.kind !== V2_BACKUP_KIND &&
      env.kind !== RETIREMINT_V2_BACKUP_KIND &&
      env.kind !== LEGACY_V2_BACKUP_KIND) ||
    !Array.isArray(env.plans)
  ) {
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
