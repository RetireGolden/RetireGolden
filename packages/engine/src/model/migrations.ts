/**
 * Plan schema migrations.
 *
 * Every persisted or imported plan passes through `migratePlanToCurrent`
 * before `parsePlan`. When the schema changes: bump CURRENT_PLAN_SCHEMA_VERSION,
 * register a pure `fromVersion -> fromVersion+1` step here, and add a fixture
 * test in migrations.test.ts. Steps must never throw on well-formed input of
 * their version; unknown shapes fall through to parsePlan's validation.
 */

import { CURRENT_PLAN_SCHEMA_VERSION, parsePlan, type Plan } from './plan.js'

export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>

/** Keyed by the version the step migrates FROM. v1 is current — empty today. */
const defaultRegistry: Record<number, MigrationStep> = {}

function normalizeCurrentPlan(raw: Record<string, unknown>): Record<string, unknown> {
  const household = raw['household']
  const accounts = raw['accounts']
  if (typeof household !== 'object' || household === null || Array.isArray(household) || !Array.isArray(accounts)) {
    return raw
  }

  const people = (household as Record<string, unknown>)['people']
  if (!Array.isArray(people)) return raw
  const primary = people[0]
  if (typeof primary !== 'object' || primary === null || Array.isArray(primary)) return raw
  const primaryId = (primary as Record<string, unknown>)['id']
  if (typeof primaryId !== 'string' || primaryId.length === 0) return raw

  let changed = false
  const normalizedAccounts = accounts.map((account) => {
    if (typeof account !== 'object' || account === null || Array.isArray(account)) return account
    const accountRecord = account as Record<string, unknown>
    if (
      (accountRecord['type'] === 'traditional' || accountRecord['type'] === 'roth' || accountRecord['type'] === 'hsa') &&
      accountRecord['ownerPersonId'] === null
    ) {
      changed = true
      return { ...accountRecord, ownerPersonId: primaryId }
    }
    return account
  })

  return changed ? { ...raw, accounts: normalizedAccounts } : raw
}

export type MigrateResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'not_object' | 'bad_version' | 'newer_than_app' | 'missing_step' | 'invalid_after_migration'; issues?: string[] }

export function migratePlanToCurrent(
  input: unknown,
  registry: Record<number, MigrationStep> = defaultRegistry,
  currentVersion: number = CURRENT_PLAN_SCHEMA_VERSION,
): MigrateResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'not_object' }
  }
  let raw = input as Record<string, unknown>
  const v = raw['schemaVersion']
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return { ok: false, reason: 'bad_version' }
  }
  if (v > currentVersion) {
    // A backup from a newer app build; never destructively "fix" it.
    return { ok: false, reason: 'newer_than_app' }
  }
  for (let from = v; from < currentVersion; from++) {
    const step = registry[from]
    if (!step) return { ok: false, reason: 'missing_step' }
    raw = { ...step(raw), schemaVersion: from + 1 }
  }
  raw = normalizeCurrentPlan(raw)
  const parsed = parsePlan(raw)
  if (!parsed.ok) {
    return { ok: false, reason: 'invalid_after_migration', issues: parsed.issues }
  }
  return { ok: true, plan: parsed.plan }
}
