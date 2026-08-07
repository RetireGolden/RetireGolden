/**
 * Plan schema migrations.
 *
 * Every persisted or imported plan passes through `migratePlanToCurrent`
 * before `parsePlan`. When the schema changes: bump CURRENT_PLAN_SCHEMA_VERSION,
 * register a pure `fromVersion -> fromVersion+1` step here, and add a fixture
 * test in migrations.test.ts. Steps must never throw on well-formed input of
 * their version; unknown shapes fall through to parsePlan's validation.
 */

import {
  CURRENT_PLAN_SCHEMA_VERSION,
  latestNonQlacQualifiedAnnuityStartAge,
  latestQlacAnnuityStartAge,
  parsePlan,
  type Plan,
} from './plan.js'
import {
  persistedLegacyAggregateQcdRequestSchema,
  persistedLegacyAggregateRothConversionRequestSchema,
  persistedLegacyAggregateWithdrawalRequestSchema,
  persistedRetirementActionRequestSchema,
} from '../actions/contract.js'
import {
  isScenarioPatchEnvelope,
  parseScenarioPatch,
} from '../scenarios/contract.js'
import { rebindScenarioPatchesToPlan } from '../scenarios/patch.js'

export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>

const legacyAggregateKinds = new Set([
  'legacyAggregateWithdrawal',
  'legacyAggregateRothConversion',
  'legacyAggregateQcd',
])
const legacyAggregateWithoutIdSchemas = [
  persistedLegacyAggregateWithdrawalRequestSchema.omit({ actionId: true }),
  persistedLegacyAggregateRothConversionRequestSchema.omit({ actionId: true }),
  persistedLegacyAggregateQcdRequestSchema.omit({ actionId: true }),
] as const

function parseTypedLegacyAggregateWithoutId(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const schema of legacyAggregateWithoutIdSchemas) {
    const parsed = schema.safeParse(record)
    if (parsed.success) return parsed.data as Record<string, unknown>
  }
  return null
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

interface LegacyActionCandidate {
  canonical: string
  seed: string
  normalized: Record<string, unknown>
}

type LegacyActionIdContext = ReadonlyMap<string, readonly string[]>

function legacyActionCandidate(action: unknown): LegacyActionCandidate | null {
  if (typeof action !== 'object' || action === null || Array.isArray(action)) return null
  const record = action as Record<string, unknown>
  if (!legacyAggregateKinds.has(String(record['kind']))) return null
  if (Object.prototype.hasOwnProperty.call(record, 'actionId')) return null
  const normalized = parseTypedLegacyAggregateWithoutId(record)
  if (normalized === null) return null
  const canonical = canonicalJson(normalized)
  return {
    canonical,
    seed: readableLegacyIdSeed(normalized, canonical),
    normalized,
  }
}

function createLegacyActionIdContext(
  schedules: readonly unknown[],
): LegacyActionIdContext {
  const suppliedIds = new Set<string>()
  const candidatesByCanonical = new Map<
    string,
    { seed: string; maxOccurrences: number }
  >()
  schedules.forEach((schedule) => {
    if (!Array.isArray(schedule)) return
    const occurrences = new Map<string, number>()
    schedule.forEach((action) => {
      if (typeof action === 'object' && action !== null && !Array.isArray(action)) {
        const actionId = (action as Record<string, unknown>)['actionId']
        if (typeof actionId === 'string') suppliedIds.add(actionId)
      }
      const candidate = legacyActionCandidate(action)
      if (candidate === null) return
      occurrences.set(
        candidate.canonical,
        (occurrences.get(candidate.canonical) ?? 0) + 1,
      )
      const current = candidatesByCanonical.get(candidate.canonical)
      if (current === undefined) {
        candidatesByCanonical.set(candidate.canonical, {
          seed: candidate.seed,
          maxOccurrences: 0,
        })
      }
    })
    occurrences.forEach((count, canonical) => {
      const candidate = candidatesByCanonical.get(canonical)!
      candidate.maxOccurrences = Math.max(candidate.maxOccurrences, count)
    })
  })

  const usedIds = new Set(suppliedIds)
  const nextSuffixBySeed = new Map<string, number>()
  const assignedIds = new Map<string, string[]>()
  const sortedCandidates = [...candidatesByCanonical.entries()].sort(
    ([leftCanonical, left], [rightCanonical, right]) => {
      const seedOrder = compareCanonicalStrings(left.seed, right.seed)
      return seedOrder !== 0
        ? seedOrder
        : compareCanonicalStrings(leftCanonical, rightCanonical)
    },
  )
  sortedCandidates.forEach(([canonical, candidate]) => {
    const ids: string[] = []
    for (let occurrence = 0; occurrence < candidate.maxOccurrences; occurrence++) {
      let suffix = nextSuffixBySeed.get(candidate.seed) ?? 1
      let actionId =
        suffix === 1 ? candidate.seed : `${candidate.seed}-${suffix}`
      while (usedIds.has(actionId)) {
        suffix = suffix === 1 ? 2 : suffix + 1
        actionId = `${candidate.seed}-${suffix}`
      }
      usedIds.add(actionId)
      ids.push(actionId)
      nextSuffixBySeed.set(candidate.seed, suffix === 1 ? 2 : suffix + 1)
    }
    assignedIds.set(canonical, ids)
  })
  return assignedIds
}

function migrateLegacyActionSchedule(
  retirementActions: unknown,
  context: LegacyActionIdContext = createLegacyActionIdContext([retirementActions]),
): unknown {
  if (!Array.isArray(retirementActions)) return retirementActions
  let changed = false
  const occurrences = new Map<string, number>()
  const migrated = retirementActions.map((action) => {
    const candidate = legacyActionCandidate(action)
    if (candidate !== null) {
      const occurrence = occurrences.get(candidate.canonical) ?? 0
      occurrences.set(candidate.canonical, occurrence + 1)
      const actionId = context.get(candidate.canonical)?.[occurrence]
      if (actionId === undefined) return action
      changed = true
      return { ...candidate.normalized, actionId }
    }
    const parsed = persistedRetirementActionRequestSchema.safeParse(action)
    if (!parsed.success || canonicalJson(parsed.data) === canonicalJson(action)) {
      return action
    }
    changed = true
    return parsed.data
  })
  return changed ? migrated : retirementActions
}

function migrateScenarioOperationValue(
  path: string,
  value: unknown,
  context: LegacyActionIdContext,
  defaultRetirementActions: unknown,
): unknown {
  if (path === '/strategies/retirementActions') {
    return migrateLegacyActionSchedule(value, context)
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
  const migrated =
    retirementActions === undefined
      ? defaultRetirementActions
      : migrateLegacyActionSchedule(retirementActions, context)
  return migrated === retirementActions
    ? value
    : { ...strategies, retirementActions: migrated }
}

function migrateCanonicalScenarioPatch(
  patch: unknown,
  context: LegacyActionIdContext,
  defaultRetirementActions: unknown,
): unknown {
  if (!parseScenarioPatch(patch).ok) return patch
  const patchRecord = patch as Record<string, unknown>
  const operations = patchRecord['operations'] as unknown[]
  let changed = false
  const migratedOperations = operations.map((operation) => {
    const operationRecord = operation as Record<string, unknown>
    const path = operationRecord['path'] as string
    let migratedOperation = operationRecord
    const before = operationRecord['before'] as Record<string, unknown>
    if (
      path === '/strategies/retirementActions' &&
      before['present'] === false
    ) {
      migratedOperation = {
        ...migratedOperation,
        before: { present: true, value: [] },
      }
    } else if (before['present'] === true) {
      const migratedBeforeValue = migrateScenarioOperationValue(
        path,
        before['value'],
        context,
        defaultRetirementActions,
      )
      if (migratedBeforeValue !== before['value']) {
        migratedOperation = {
          ...migratedOperation,
          before: { ...before, value: migratedBeforeValue },
        }
      }
    }
    if (
      operationRecord['op'] === 'remove' &&
      path === '/strategies/retirementActions'
    ) {
      migratedOperation = {
        op: 'set',
        path,
        before: migratedOperation['before'],
        value: [],
      }
    } else if (operationRecord['op'] === 'set') {
      const migratedValue = migrateScenarioOperationValue(
        path,
        operationRecord['value'],
        context,
        defaultRetirementActions,
      )
      if (migratedValue !== operationRecord['value']) {
        migratedOperation = { ...migratedOperation, value: migratedValue }
      }
    }
    if (migratedOperation !== operationRecord) changed = true
    return migratedOperation
  })
  return changed ? { ...patchRecord, operations: migratedOperations } : patch
}

function migrateLegacyScenarioPatch(
  patch: unknown,
  context: LegacyActionIdContext,
): unknown {
  if (
    isScenarioPatchEnvelope(patch) ||
    typeof patch !== 'object' ||
    patch === null ||
    Array.isArray(patch)
  ) {
    return patch
  }
  const patchRecord = patch as Record<string, unknown>
  const strategies = patchRecord['strategies']
  if (typeof strategies !== 'object' || strategies === null || Array.isArray(strategies)) {
    return patch
  }
  const strategiesRecord = strategies as Record<string, unknown>
  const retirementActions = strategiesRecord['retirementActions']
  const migratedActions = migrateLegacyActionSchedule(retirementActions, context)
  if (migratedActions === retirementActions) return patch
  return {
    ...patchRecord,
    strategies: { ...strategiesRecord, retirementActions: migratedActions },
  }
}

function migrateScenarioActionArrays(
  scenarios: unknown,
  context: LegacyActionIdContext,
  defaultRetirementActions: unknown,
  sourcePlanId: unknown,
  sourceSchemaVersion: number,
): unknown {
  if (!Array.isArray(scenarios)) return scenarios
  let changed = false
  const migratedScenarios = scenarios.map((scenario) => {
    if (typeof scenario !== 'object' || scenario === null || Array.isArray(scenario)) {
      return scenario
    }
    const scenarioRecord = scenario as Record<string, unknown>
    const patch = scenarioRecord['patch']
    const parsedPatch = parseScenarioPatch(patch)
    if (
      parsedPatch.ok &&
      (parsedPatch.patch.base.planId !== sourcePlanId ||
        parsedPatch.patch.base.planSchemaVersion !== sourceSchemaVersion)
    ) {
      return scenario
    }
    const canonicalPatch = migrateCanonicalScenarioPatch(
      patch,
      context,
      defaultRetirementActions,
    )
    const migratedPatch =
      canonicalPatch === patch
        ? migrateLegacyScenarioPatch(patch, context)
        : canonicalPatch
    if (migratedPatch === patch) return scenario
    changed = true
    return { ...scenarioRecord, patch: migratedPatch }
  })
  return changed ? migratedScenarios : scenarios
}

function collectScenarioOperationSchedule(
  path: string,
  value: unknown,
  schedules: unknown[],
): void {
  if (path === '/strategies/retirementActions') {
    if (Array.isArray(value)) schedules.push(value)
    return
  }
  if (
    path !== '/strategies' ||
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return
  }
  const retirementActions = (value as Record<string, unknown>)['retirementActions']
  if (Array.isArray(retirementActions)) schedules.push(retirementActions)
}

function collectScenarioActionSchedules(
  scenarios: unknown,
  sourcePlanId: unknown,
  sourceSchemaVersion: number,
): unknown[] {
  if (!Array.isArray(scenarios)) return []
  const schedules: unknown[] = []
  scenarios.forEach((scenario) => {
    if (typeof scenario !== 'object' || scenario === null || Array.isArray(scenario)) {
      return
    }
    const patch = (scenario as Record<string, unknown>)['patch']
    const parsedPatch = parseScenarioPatch(patch)
    if (parsedPatch.ok) {
      if (
        parsedPatch.patch.base.planId !== sourcePlanId ||
        parsedPatch.patch.base.planSchemaVersion !== sourceSchemaVersion
      ) {
        return
      }
      const operations = (patch as Record<string, unknown>)['operations'] as unknown[]
      operations.forEach((operation) => {
        const operationRecord = operation as Record<string, unknown>
        const path = operationRecord['path'] as string
        const before = operationRecord['before'] as Record<string, unknown>
        if (before['present'] === true) {
          collectScenarioOperationSchedule(path, before['value'], schedules)
        }
        if (operationRecord['op'] === 'set') {
          collectScenarioOperationSchedule(path, operationRecord['value'], schedules)
        }
      })
      return
    }
    if (
      isScenarioPatchEnvelope(patch) ||
      typeof patch !== 'object' ||
      patch === null ||
      Array.isArray(patch)
    ) {
      return
    }
    const strategies = (patch as Record<string, unknown>)['strategies']
    if (typeof strategies !== 'object' || strategies === null || Array.isArray(strategies)) {
      return
    }
    const retirementActions = (strategies as Record<string, unknown>)[
      'retirementActions'
    ]
    if (Array.isArray(retirementActions)) schedules.push(retirementActions)
  })
  return schedules
}

/**
 * Pure v1 -> v2 migration. Legacy scalar strategies remain untouched and no
 * action is synthesized from them. Only already-present typed legacy action
 * records that genuinely omitted actionId receive a deterministic ID.
 */
export const migratePlanV1ToV2: MigrationStep = (raw) => {
  const sourceSchemaVersion = 1
  const strategies = raw['strategies']
  if (typeof strategies !== 'object' || strategies === null || Array.isArray(strategies)) {
    return raw
  }
  const strategiesRecord = strategies as Record<string, unknown>
  const retirementActions = strategiesRecord['retirementActions']
  const scenarios = raw['scenarios']
  const actionIdContext = createLegacyActionIdContext([
    retirementActions,
    ...collectScenarioActionSchedules(
      scenarios,
      raw['id'],
      sourceSchemaVersion,
    ),
  ])
  const normalizedActions =
    retirementActions === undefined
      ? []
      : migrateLegacyActionSchedule(retirementActions, actionIdContext)
  const migratedScenarios = migrateScenarioActionArrays(
    scenarios,
    actionIdContext,
    normalizedActions,
    raw['id'],
    sourceSchemaVersion,
  )
  if (normalizedActions === retirementActions && migratedScenarios === scenarios) return raw
  return {
    ...raw,
    strategies: { ...strategiesRecord, retirementActions: normalizedActions },
    ...(migratedScenarios === scenarios ? {} : { scenarios: migratedScenarios }),
  }
}

/**
 * Pure v2 -> v3 migration. Eligibility facts are never inferred. Any
 * same-named root supplied to an older schema is untrusted and explicitly
 * discarded rather than promoted across the version boundary.
 */
export const migratePlanV2ToV3: MigrationStep = (raw) => {
  if (!Object.prototype.hasOwnProperty.call(raw, 'retirementActionEligibilityFacts')) {
    return raw
  }
  const withoutEligibilityFacts = { ...raw }
  Reflect.deleteProperty(
    withoutEligibilityFacts,
    'retirementActionEligibilityFacts',
  )
  return withoutEligibilityFacts
}

/**
 * Pure v3 -> v4 migration. Filing-grade annual tax facts are never inferred
 * from account planning basis or projection state. A same-named older root is
 * untrusted and discarded instead of promoted across the version boundary.
 */
export const migratePlanV3ToV4: MigrationStep = (raw) => {
  if (!Object.prototype.hasOwnProperty.call(raw, 'retirementActionAnnualTaxFacts')) {
    return raw
  }
  const withoutAnnualTaxFacts = { ...raw }
  Reflect.deleteProperty(withoutAnnualTaxFacts, 'retirementActionAnnualTaxFacts')
  return withoutAnnualTaxFacts
}

/** Keyed by the version the step migrates FROM. */
const defaultRegistry: Record<number, MigrationStep> = {
  1: migratePlanV1ToV2,
  2: migratePlanV2ToV3,
  3: migratePlanV3ToV4,
}

/**
 * One thing `normalizeCurrentPlan` changed on the way in, as facts rather than
 * prose. A host renders these; the engine never phrases them.
 *
 * Discipline this type is under:
 * - **Kinds and facts, never sentences.** No i18n strings, no clock, no
 *   formatting. Every field is read out of the stored document.
 * - **Stable `kind` strings.** A host switches on them, so a kind is renamed
 *   only alongside the host copy that reads it.
 * - **Deterministic.** Records appear in stored account order, one per repaired
 *   account, and the same document always produces the same list.
 *
 * Names carry `''` and ids `null` only for shapes the document could not have
 * loaded with otherwise (an election naming a non-string account id, say, whose
 * removal is the very repair being reported).
 */
export type PlanLoadRepair =
  /** An individually-owned account stored with no owner, assigned to the first person in the household. */
  | { kind: 'accountOwnerBackFilled'; accountId: string; accountName: string; ownerPersonId: string }
  /** A lump-sum election whose election year is already behind the plan's own save stamp. */
  | { kind: 'lumpSumElectionDroppedElectionYearPassed'; accountId: string; accountName: string; electionYear: number }
  /** A lump-sum election on a document whose save stamp could not be read, so staleness could not be judged. */
  | { kind: 'lumpSumElectionDroppedUnreadableSaveDate'; accountId: string; accountName: string }
  /** A lump-sum election whose rollover target is an inherited account. */
  | { kind: 'lumpSumElectionDroppedInheritedTarget'; accountId: string; accountName: string; targetAccountId: string; targetAccountName: string }
  /** A lump-sum election whose rollover target does not resolve to one owned traditional account (missing, duplicated id, or another type). */
  | { kind: 'lumpSumElectionDroppedTargetUnavailable'; accountId: string; accountName: string; targetAccountId: string | null; targetAccountName: string | null }
  /** A qualified annuity premium moved off an inherited funding account onto an owned traditional account. */
  | {
      kind: 'annuityPremiumRetargeted'
      accountId: string
      accountName: string
      fromAccountId: string
      fromAccountName: string
      toAccountId: string
      toAccountName: string
    }
  /** A qualified annuity purchase funded from an inherited account with no owned traditional account to move it to. */
  | { kind: 'annuityPurchaseStoodDown'; accountId: string; accountName: string; fromAccountId: string; fromAccountName: string }
  /** A qualified annuity purchase, not declared a QLAC, whose payments commence after the owner's required beginning date. */
  | {
      kind: 'deferredAnnuityPurchaseStoodDown'
      accountId: string
      accountName: string
      startAge: number
      latestPermittedStartAge: number
    }
  /** A QLAC purchase whose payments commence after the first of the month following the owner's 85th birthday. */
  | {
      kind: 'qlacPurchaseStoodDown'
      accountId: string
      accountName: string
      startAge: number
      latestPermittedStartAge: number
    }

/** The document as repaired, plus what the repairs were. */
interface NormalizedPlan {
  raw: Record<string, unknown>
  repairs: PlanLoadRepair[]
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

/** True for a raw account record that is a beneficiary (inherited) traditional account. */
function isInheritedTraditionalRecord(account: unknown): boolean {
  if (typeof account !== 'object' || account === null || Array.isArray(account)) return false
  const record = account as Record<string, unknown>
  return record['type'] === 'traditional' && record['inherited'] !== undefined && record['inherited'] !== null
}

/** True for a raw account record that is a traditional account the household owns. */
function isOwnedTraditionalRecord(account: unknown): boolean {
  if (typeof account !== 'object' || account === null || Array.isArray(account)) return false
  const record = account as Record<string, unknown>
  return record['type'] === 'traditional' && (record['inherited'] === undefined || record['inherited'] === null)
}

/**
 * Load-time repairs for shapes a stored document could hold but current
 * validation refuses.
 *
 * This runs on EVERY load, before `parsePlan`, whatever version the document was
 * stored at — which is why it, and not a version-keyed migration step, is the
 * seam for retiring a newly-invalid shape. A step in the registry only runs for
 * documents stored BELOW the current version, so a plan already stored at the
 * current version would sail past it and die at the parse instead. The house
 * pattern is set by the `ownerPersonId: null` repair below: a rule was added
 * ("traditional/roth/hsa accounts must have an individual owner") and legacy
 * documents were carried across it here rather than being refused at the door.
 *
 * The bar every repair meets: it never locks a household out of the plan the new
 * message is telling them to fix, and it never leaves the projection richer than
 * the stored facts support.
 *
 * Two of these repairs are invisible in the projection (a future-year election
 * that never fired, and the annuity retarget in every case), so the second
 * return value exists to let a host tell the household what changed. It reports
 * facts only; the phrasing belongs to whoever is doing the telling.
 */
function normalizeCurrentPlan(raw: Record<string, unknown>): NormalizedPlan {
  const household = raw['household']
  const accounts = raw['accounts']
  if (typeof household !== 'object' || household === null || Array.isArray(household) || !Array.isArray(accounts)) {
    return { raw, repairs: [] }
  }

  const people = (household as Record<string, unknown>)['people']
  if (!Array.isArray(people)) return { raw, repairs: [] }
  const primary = people[0]
  if (typeof primary !== 'object' || primary === null || Array.isArray(primary)) return { raw, repairs: [] }
  const primaryId = (primary as Record<string, unknown>)['id']
  if (typeof primaryId !== 'string' || primaryId.length === 0) return { raw, repairs: [] }

  const stamped = typeof raw['updatedAtIso'] === 'string' ? /^(\d{4})-/.exec(raw['updatedAtIso']) : null
  const planAsOfYear = stamped === null ? null : Number(stamped[1])
  const inheritedAccountIds = new Set(
    accounts
      .filter(isInheritedTraditionalRecord)
      .map((a) => (a as Record<string, unknown>)['id'])
      .filter((id): id is string => typeof id === 'string'),
  )
  // Owned-traditional AND uniquely resolving: parsePlan refuses a duplicated
  // account id once a rollover target or annuity funding source references it,
  // so a repair that preserved or created a reference to a duplicated id would
  // trade the lockout this seam exists to prevent for a different one.
  const ownedTraditionalIdCounts = new Map<string, number>()
  for (const a of accounts.filter(isOwnedTraditionalRecord)) {
    const id = (a as Record<string, unknown>)['id']
    if (typeof id === 'string') ownedTraditionalIdCounts.set(id, (ownedTraditionalIdCounts.get(id) ?? 0) + 1)
  }
  const ownedTraditionalIds = [...ownedTraditionalIdCounts]
    .filter(([, count]) => count === 1)
    .map(([id]) => id)

  /** The stored name of the first account carrying this id, for a repair record. */
  const accountNameById = (id: string): string | null => {
    for (const candidate of accounts) {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue
      const record = candidate as Record<string, unknown>
      if (record['id'] === id) return typeof record['name'] === 'string' ? record['name'] : ''
    }
    return null
  }

  /**
   * Birth year and birth month of the person a stored account belongs to, by
   * the same owner resolution `parsePlan` and the projection take: the named
   * owner, or the first person in the household when the account carries none.
   * Null when the document holds no readable birth date, in which case the
   * deferred-annuity repairs below stand aside — the parse rules stand aside on
   * the same fact, so there is nothing to repair and nothing to lock the
   * household out of.
   *
   * The month is here because the QLAC ceiling needs it: (q)(1)(ii)'s deadline
   * is the first day of the month after the 85th birthday, which falls in the
   * next calendar year for a December birth and so admits one more start age.
   */
  const ownerBirthParts = (ownerPersonId: unknown): { year: number; month: number } | null => {
    const owner =
      people.find(
        (candidate) =>
          typeof candidate === 'object' &&
          candidate !== null &&
          !Array.isArray(candidate) &&
          (candidate as Record<string, unknown>)['id'] === ownerPersonId,
      ) ?? primary
    if (typeof owner !== 'object' || owner === null || Array.isArray(owner)) return null
    const dob = (owner as Record<string, unknown>)['dob']
    if (typeof dob !== 'string') return null
    const year = Number(dob.slice(0, 4))
    const month = Number(dob.slice(5, 7))
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null
    return { year, month }
  }

  const repairs: PlanLoadRepair[] = []
  let changed = false
  const normalizedAccounts = accounts.map((account) => {
    if (typeof account !== 'object' || account === null || Array.isArray(account)) return account
    const accountRecord = account as Record<string, unknown>
    if (
      (accountRecord['type'] === 'traditional' || accountRecord['type'] === 'roth' || accountRecord['type'] === 'hsa') &&
      accountRecord['ownerPersonId'] === null
    ) {
      changed = true
      repairs.push({
        kind: 'accountOwnerBackFilled',
        accountId: stringField(accountRecord, 'id'),
        accountName: stringField(accountRecord, 'name'),
        ownerPersonId: primaryId,
      })
      return { ...accountRecord, ownerPersonId: primaryId }
    }

    // A pension lump-sum election a stored document may hold but parse refuses.
    //
    // Both refused shapes resolve the same way: drop the ELECTION, keep the
    // OFFER. The Plan has no field anywhere that records a lump sum already
    // taken — an executed one is representable only as a balance with no pension
    // — so `lumpSumElection` can only ever mean "model the rollover in the
    // election year", which the schema states outright and the editor's own
    // wording repeats ("Take the lump sum (rollover)" against "Keep the annuity
    // (undecided)"). An election naming a year already gone, or naming a target
    // no beneficiary may use, therefore cannot mean the household did it; it can
    // only be a modelled election that never happened. Undecided-with-the-offer-
    // on-record is the state the model can actually express, and it is the state
    // the editor would put them in.
    if (accountRecord['type'] === 'pension' && accountRecord['lumpSumElection'] !== undefined && accountRecord['lumpSumElection'] !== null) {
      const election = accountRecord['lumpSumElection']
      const offer = accountRecord['lumpSumOffer']
      const target =
        typeof election === 'object' && election !== null && !Array.isArray(election)
          ? (election as Record<string, unknown>)['rolloverAccountId']
          : undefined
      const electionYear =
        typeof offer === 'object' && offer !== null && !Array.isArray(offer)
          ? (offer as Record<string, unknown>)['electionYear']
          : undefined
      // Kept as the year itself, not a boolean, so the repair record can name it.
      const staleElectionYear =
        planAsOfYear !== null && typeof electionYear === 'number' && electionYear < planAsOfYear
          ? electionYear
          : null
      const yearAlreadyGone = staleElectionYear !== null
      // A stamp the staleness rule cannot read fails closed at parse, so a
      // stored document carrying one must shed the election here or it cannot
      // load at all; re-saving rewrites the stamp and the field stays editable.
      const stampUnreadable = planAsOfYear === null
      const targetNotOwnedTraditional =
        typeof target !== 'string' || !ownedTraditionalIds.includes(target)
      if (yearAlreadyGone || stampUnreadable || targetNotOwnedTraditional) {
        changed = true
        // One record per repaired account, and the causes are reported in the
        // order they are tested. An unreadable stamp and a refused target can
        // both be true of the same election; the stamp is reported because it is
        // the fault that would have to be fixed first anyway (a re-save is what
        // makes the year judgeable at all).
        const accountId = stringField(accountRecord, 'id')
        const accountName = stringField(accountRecord, 'name')
        if (staleElectionYear !== null) {
          repairs.push({
            kind: 'lumpSumElectionDroppedElectionYearPassed',
            accountId,
            accountName,
            electionYear: staleElectionYear,
          })
        } else if (stampUnreadable) {
          repairs.push({ kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId, accountName })
        } else if (typeof target === 'string' && inheritedAccountIds.has(target)) {
          repairs.push({
            kind: 'lumpSumElectionDroppedInheritedTarget',
            accountId,
            accountName,
            targetAccountId: target,
            targetAccountName: accountNameById(target) ?? '',
          })
        } else {
          repairs.push({
            kind: 'lumpSumElectionDroppedTargetUnavailable',
            accountId,
            accountName,
            targetAccountId: typeof target === 'string' ? target : null,
            targetAccountName: typeof target === 'string' ? accountNameById(target) : null,
          })
        }
        const repaired = { ...accountRecord }
        Reflect.deleteProperty(repaired, 'lumpSumElection')
        return repaired
      }
    }

    // A qualified annuity purchase that starts paying later than its shape
    // permits: past the owner's required beginning date when it is not a QLAC
    // (Treas. Reg. 1.401(a)(9)-6(a)(3)(i), excused by (q)(1)(iii) for a QLAC
    // alone), or past the first of the month after the owner's 85th birthday
    // when it is one ((q)(1)(ii) — a contract naming a later starting date is
    // not a QLAC, so it holds neither the excuse nor 1.401(a)(9)-5(b)(4)'s
    // exclusion from the required-distribution base). Every qualified purchase
    // is under exactly one of the two bounds, so the branches below cannot both
    // fire on one account.
    //
    // Tested BEFORE the funding repair below, because a contract carrying both
    // faults cannot be saved by retargeting its premium — the start age would
    // still refuse — and standing the purchase down cures the funding fault
    // along with it.
    //
    // WHY THE REPAIR IS A STAND-DOWN, derived from what the stored document
    // means rather than from what is convenient. The household authored a
    // deferred contract bought with pre-tax dollars, and the stored shape has no
    // legal expression that keeps every stored fact. The same three repairs were
    // available for each bound, and the same two are refused by the never-richer
    // bar this seam is under:
    //
    //  - CHANGE WHICH BOUND APPLIES — mark a non-QLAC a QLAC, or untick the box
    //    on a QLAC. Forbidden in both directions. QLAC status is precisely the
    //    grant that keeps a deferred contract's value out of the required-
    //    distribution base, and a household that did not tick the box never
    //    chose it; conferring it would keep the exclusion the regulation denies
    //    and make the parse refusal cosmetic, since every refused document
    //    would be relabelled into the shape that is allowed to defer. It is not
    //    even a safe relabel: the premium would then be clamped to the statutory
    //    cap (a purchase the household did not make), and a start age past the
    //    (q)(1)(ii) ceiling would fail on the other bound instead, so the "QLAC"
    //    produced can be no more legal than what it replaced. Unticking the box
    //    on a stored QLAC is the same move mirrored and is richer for a second
    //    reason: it lifts the premium cap the household's own QLAC election put
    //    the contract under, and it lands on the required-beginning-date bound,
    //    which is lower than the ceiling it just failed in every case but an
    //    annuitization bought at that very age.
    //  - ADVANCE THE START AGE. Forbidden, and richer by a wide margin. The
    //    `monthlyAmount` on record was quoted for a deferred start; paying it
    //    from an earlier age instead hands the household years of payments
    //    nobody bought, at a rate nobody would have been offered. The argument
    //    is if anything stronger on a QLAC, whose whole pricing IS the deferral.
    //  - STAND THE PURCHASE DOWN. What is done. The premium never leaves the
    //    funding balance and the contract pays nothing, so the household keeps
    //    exactly the dollars it started with and gains no stream — the strictly
    //    poorer direction, and the same repair the funding branch below already
    //    takes when no legal shape exists for a purchase it cannot place. The
    //    account stays in the plan carrying its name and start age, so the
    //    household can see what happened and re-author it either way.
    if (
      accountRecord['type'] === 'annuity' &&
      typeof accountRecord['purchase'] === 'object' &&
      accountRecord['purchase'] !== null &&
      !Array.isArray(accountRecord['purchase'])
    ) {
      const purchase = accountRecord['purchase'] as Record<string, unknown>
      const startAge = accountRecord['startAge']
      const purchaseYear = purchase['year']
      const isQlac = purchase['qlac'] === true
      const birth =
        purchase['taxQualification'] === 'qualified'
          ? ownerBirthParts(accountRecord['ownerPersonId'])
          : null
      if (birth !== null && typeof startAge === 'number' && typeof purchaseYear === 'number') {
        const latestPermittedStartAge = isQlac
          ? latestQlacAnnuityStartAge(birth.month)
          : latestNonQlacQualifiedAnnuityStartAge(birth.year, purchaseYear)
        if (startAge > latestPermittedStartAge) {
          changed = true
          repairs.push({
            kind: isQlac ? 'qlacPurchaseStoodDown' : 'deferredAnnuityPurchaseStoodDown',
            accountId: stringField(accountRecord, 'id'),
            accountName: stringField(accountRecord, 'name'),
            startAge,
            latestPermittedStartAge,
          })
          const stoodDown = { ...accountRecord, monthlyAmount: 0 }
          Reflect.deleteProperty(stoodDown, 'purchase')
          return stoodDown
        }
      }
    }

    // A qualified annuity purchase funded from an inherited IRA. Unlike the
    // election above this one already MOVED money in every stored projection —
    // the premium left the funding balance and the contract pays — so dropping
    // the purchase outright would hand the household a contract nobody paid for,
    // which is the one direction a repair may never go. Retarget instead: the
    // decision on record is "buy this with pre-tax dollars", and the household's
    // own pre-tax dollars are exactly the owned traditional accounts, so the
    // premium keeps its year, its size, and its pre-tax character and only
    // changes which bucket it leaves. With no owned traditional account anywhere
    // in the plan there is no legal shape and no source that could have paid the
    // premium, so the contract is stood down rather than left paying.
    if (accountRecord['type'] === 'annuity' && typeof accountRecord['purchase'] === 'object' && accountRecord['purchase'] !== null && !Array.isArray(accountRecord['purchase'])) {
      const purchase = accountRecord['purchase'] as Record<string, unknown>
      const fundingAccountId = purchase['fundingAccountId']
      if (purchase['taxQualification'] === 'qualified' && typeof fundingAccountId === 'string' && inheritedAccountIds.has(fundingAccountId)) {
        changed = true
        const accountId = stringField(accountRecord, 'id')
        const accountName = stringField(accountRecord, 'name')
        const fromAccountName = accountNameById(fundingAccountId) ?? ''
        const replacement = ownedTraditionalIds.find((id) => id !== accountRecord['id'])
        if (replacement !== undefined) {
          repairs.push({
            kind: 'annuityPremiumRetargeted',
            accountId,
            accountName,
            fromAccountId: fundingAccountId,
            fromAccountName,
            toAccountId: replacement,
            toAccountName: accountNameById(replacement) ?? '',
          })
          return { ...accountRecord, purchase: { ...purchase, fundingAccountId: replacement } }
        }
        repairs.push({
          kind: 'annuityPurchaseStoodDown',
          accountId,
          accountName,
          fromAccountId: fundingAccountId,
          fromAccountName,
        })
        const stoodDown = { ...accountRecord, monthlyAmount: 0 }
        Reflect.deleteProperty(stoodDown, 'purchase')
        return stoodDown
      }
    }

    return account
  })

  return { raw: changed ? { ...raw, accounts: normalizedAccounts } : raw, repairs }
}

/**
 * `repairs` lists what load-time repair changed on the way in, empty when the
 * stored document needed nothing. It is additive: a caller with nobody to tell
 * (the case runner, the backup importer, any headless host) ignores the field
 * and keeps the behavior it always had. A failed load carries no list at all,
 * because a document that did not open has nothing to report.
 */
export type MigrateResult =
  | { ok: true; plan: Plan; repairs: readonly PlanLoadRepair[] }
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
  const normalized = normalizeCurrentPlan(raw)
  raw = normalized.raw
  const parsed = parsePlan(raw)
  if (!parsed.ok) {
    return { ok: false, reason: 'invalid_after_migration', issues: parsed.issues }
  }
  return {
    ok: true,
    repairs: normalized.repairs,
    plan:
      v < currentVersion
        ? rebindScenarioPatchesToPlan(parsed.plan, {
            matchingPlanIdOnly: true,
            matchingPlanSchemaVersion: v,
          })
        : parsed.plan,
  }
}
