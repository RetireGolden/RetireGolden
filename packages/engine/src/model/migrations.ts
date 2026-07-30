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
import {
  legacyAggregateQcdRequestSchema,
  legacyAggregateRothConversionRequestSchema,
  legacyAggregateWithdrawalRequestSchema,
} from '../actions/contract.js'
import { parseScenarioPatch } from '../scenarios/contract.js'
import { rebindScenarioPatchesToPlan } from '../scenarios/patch.js'

export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>

const legacyAggregateKinds = new Set([
  'legacyAggregateWithdrawal',
  'legacyAggregateRothConversion',
  'legacyAggregateQcd',
])
const legacyAggregateWithoutIdSchemas = [
  legacyAggregateWithdrawalRequestSchema.omit({ actionId: true }),
  legacyAggregateRothConversionRequestSchema.omit({ actionId: true }),
  legacyAggregateQcdRequestSchema.omit({ actionId: true }),
] as const

function isTypedLegacyAggregateWithoutId(record: Record<string, unknown>): boolean {
  return legacyAggregateWithoutIdSchemas.some((schema) => schema.safeParse(record).success)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function stableLegacyHash(value: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`
}

function readableLegacyIdSeed(record: Record<string, unknown>, canonical: string): string {
  const kind = String(record['kind']).replace(/^legacyAggregate/, '').toLowerCase()
  const year = typeof record['year'] === 'number' ? String(record['year']) : 'unknown-year'
  return `legacy-${kind}-${year}-${stableLegacyHash(canonical)}`
}

function compareCanonicalStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function migrateLegacyActionSchedule(retirementActions: unknown): unknown {
  if (!Array.isArray(retirementActions)) return retirementActions

  const suppliedIds = new Set<string>()
  retirementActions.forEach((action) => {
    if (typeof action !== 'object' || action === null || Array.isArray(action)) return
    const actionId = (action as Record<string, unknown>)['actionId']
    if (typeof actionId === 'string') suppliedIds.add(actionId)
  })

  const candidates: Array<{
    index: number
    canonical: string
    seed: string
  }> = []
  retirementActions.forEach((action, index) => {
    if (typeof action !== 'object' || action === null || Array.isArray(action)) return
    const record = action as Record<string, unknown>
    if (!legacyAggregateKinds.has(String(record['kind']))) return
    if (Object.prototype.hasOwnProperty.call(record, 'actionId')) return
    if (!isTypedLegacyAggregateWithoutId(record)) return
    const canonical = canonicalJson(record)
    candidates.push({
      index,
      canonical,
      seed: readableLegacyIdSeed(record, canonical),
    })
  })
  if (candidates.length === 0) return retirementActions

  const assignedByIndex = new Map<number, string>()
  const usedIds = new Set(suppliedIds)
  candidates
    .sort((left, right) => {
      const seedOrder = compareCanonicalStrings(left.seed, right.seed)
      if (seedOrder !== 0) return seedOrder
      const contentOrder = compareCanonicalStrings(left.canonical, right.canonical)
      if (contentOrder !== 0) return contentOrder
      return left.index - right.index
    })
    .forEach((candidate) => {
      let actionId = candidate.seed
      let suffix = 2
      while (usedIds.has(actionId)) {
        actionId = `${candidate.seed}-${suffix}`
        suffix++
      }
      usedIds.add(actionId)
      assignedByIndex.set(candidate.index, actionId)
    })

  return retirementActions.map((action, index) => {
    const actionId = assignedByIndex.get(index)
    if (actionId === undefined) return action
    return { ...(action as Record<string, unknown>), actionId }
  })
}

function migrateScenarioOperationValue(path: string, value: unknown): unknown {
  if (path === '/strategies/retirementActions') {
    return migrateLegacyActionSchedule(value)
  }
  if (
    path !== '/strategies' ||
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return value
  }
  const strategies = value as Record<string, unknown>
  const retirementActions = strategies['retirementActions']
  const migrated = migrateLegacyActionSchedule(retirementActions)
  return migrated === retirementActions
    ? value
    : { ...strategies, retirementActions: migrated }
}

function migrateCanonicalScenarioPatch(patch: unknown): unknown {
  if (!parseScenarioPatch(patch).ok) return patch
  const patchRecord = patch as Record<string, unknown>
  const operations = patchRecord['operations'] as unknown[]
  let changed = false
  const migratedOperations = operations.map((operation) => {
    const operationRecord = operation as Record<string, unknown>
    const path = operationRecord['path'] as string
    let migratedOperation = operationRecord
    const before = operationRecord['before'] as Record<string, unknown>
    if (before['present'] === true) {
      const migratedBeforeValue = migrateScenarioOperationValue(path, before['value'])
      if (migratedBeforeValue !== before['value']) {
        migratedOperation = {
          ...migratedOperation,
          before: { ...before, value: migratedBeforeValue },
        }
      }
    }
    if (operationRecord['op'] === 'set') {
      const migratedValue = migrateScenarioOperationValue(path, operationRecord['value'])
      if (migratedValue !== operationRecord['value']) {
        migratedOperation = { ...migratedOperation, value: migratedValue }
      }
    }
    if (migratedOperation !== operationRecord) changed = true
    return migratedOperation
  })
  return changed ? { ...patchRecord, operations: migratedOperations } : patch
}

function migrateCanonicalScenarioActionArrays(scenarios: unknown): unknown {
  if (!Array.isArray(scenarios)) return scenarios
  let changed = false
  const migratedScenarios = scenarios.map((scenario) => {
    if (typeof scenario !== 'object' || scenario === null || Array.isArray(scenario)) {
      return scenario
    }
    const scenarioRecord = scenario as Record<string, unknown>
    const patch = scenarioRecord['patch']
    const migratedPatch = migrateCanonicalScenarioPatch(patch)
    if (migratedPatch === patch) return scenario
    changed = true
    return { ...scenarioRecord, patch: migratedPatch }
  })
  return changed ? migratedScenarios : scenarios
}

/**
 * Pure v1 -> v2 migration. Legacy scalar strategies remain untouched and no
 * action is synthesized from them. Only already-present typed legacy action
 * records that genuinely omitted actionId receive a deterministic ID.
 */
export const migratePlanV1ToV2: MigrationStep = (raw) => {
  const strategies = raw['strategies']
  if (typeof strategies !== 'object' || strategies === null || Array.isArray(strategies)) {
    return raw
  }
  const strategiesRecord = strategies as Record<string, unknown>
  const retirementActions = strategiesRecord['retirementActions']
  const normalizedActions =
    retirementActions === undefined ? [] : migrateLegacyActionSchedule(retirementActions)
  const scenarios = raw['scenarios']
  const migratedScenarios = migrateCanonicalScenarioActionArrays(scenarios)
  if (normalizedActions === retirementActions && migratedScenarios === scenarios) return raw
  return {
    ...raw,
    strategies: { ...strategiesRecord, retirementActions: normalizedActions },
    ...(migratedScenarios === scenarios ? {} : { scenarios: migratedScenarios }),
  }
}

/** Keyed by the version the step migrates FROM. */
const defaultRegistry: Record<number, MigrationStep> = { 1: migratePlanV1ToV2 }

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
  return {
    ok: true,
    plan: v < currentVersion ? rebindScenarioPatchesToPlan(parsed.plan) : parsed.plan,
  }
}
