/**
 * Conflict-aware scenario patch construction, application, and reversal.
 *
 * The legacy object patch stays supported through `applyLegacyScenarioPatch`.
 * New persisted work should use ScenarioPatchV1 so every changed value records
 * its baseline precondition and can be applied or reverted atomically.
 */

import { parsePlan, type ParsePlanResult, type Plan } from '../model/plan.js'
import {
  decodeScenarioPointer,
  encodeScenarioPointer,
  isScenarioPatchEnvelope,
  parseScenarioPatch,
  type JsonValue,
  type LegacyScenarioPatch,
  type ScenarioOperation,
  type ScenarioPatchInput,
  type ScenarioPatchMetadata,
  type ScenarioPatchV1,
  type ScenarioValueState,
} from './contract.js'

const editableRoots = [
  'household',
  'accounts',
  'insurance',
  'careEvents',
  'incomes',
  'incomeFloor',
  'expenses',
  'strategies',
  'assumptions',
] as const

const protectedFields = [
  'schemaVersion',
  'id',
  'name',
  'origin',
  'exampleSourceId',
  'createdAtIso',
  'updatedAtIso',
  'scenarios',
] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function ownValue(object: Record<string, unknown>, key: string): unknown {
  return Object.getOwnPropertyDescriptor(object, key)?.value
}

function defineOwn(object: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(object, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  })
}

/**
 * Stable canonical text: object keys sort recursively and undefined object
 * values are omitted. A top-level undefined uses the sentinel "undefined" for
 * optional-field comparisons; persisted document values reject undefined.
 */
export function canonicalScenarioJson(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('scenario JSON cannot contain a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalScenarioJson(item === undefined ? null : item)).join(',')}]`
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareText(left, right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalScenarioJson(item)}`).join(',')}}`
  }
  throw new Error('scenario JSON contains a non-JSON value')
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return canonicalScenarioJson(left) === canonicalScenarioJson(right)
}

/** Deterministic input fingerprint; per-operation preconditions remain the collision-safe conflict check. */
export function scenarioPlanSnapshotHash(plan: Plan): string {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`cannot fingerprint invalid plan: ${parsed.issues.join('; ')}`)
  const record = parsed.plan as unknown as Record<string, unknown>
  const snapshot = Object.fromEntries([
    ['planId', parsed.plan.id],
    ['planSchemaVersion', parsed.plan.schemaVersion],
    ...editableRoots.map((root) => [root, record[root]] as const),
  ])
  const canonical = canonicalScenarioJson(snapshot)
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < canonical.length; index++) {
    const codeUnit = canonical.charCodeAt(index)
    for (const byte of [codeUnit & 0xff, codeUnit >>> 8]) {
      hash ^= BigInt(byte)
      hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`
}

function valueStateAt(root: Record<string, unknown>, segments: readonly string[]): ScenarioValueState {
  let current: unknown = root
  for (const segment of segments) {
    if (!isPlainObject(current) || !Object.hasOwn(current, segment)) return { present: false }
    current = ownValue(current, segment)
  }
  return current === undefined ? { present: false } : { present: true, value: cloneJson(current) as JsonValue }
}

function assertNoArrayTraversal(root: Record<string, unknown>, segments: readonly string[]): string | null {
  let current: unknown = root
  for (let index = 0; index < segments.length - 1; index++) {
    if (Array.isArray(current)) return `path "${encodeScenarioPointer(segments)}" traverses an array`
    if (!isPlainObject(current) || !Object.hasOwn(current, segments[index]!)) return null
    current = ownValue(current, segments[index]!)
  }
  return Array.isArray(current) ? `path "${encodeScenarioPointer(segments)}" traverses an array` : null
}

function setAt(root: Record<string, unknown>, segments: readonly string[], value: JsonValue): string | null {
  let current = root
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]!
    const next = ownValue(current, segment)
    if (Array.isArray(next)) return `path "${encodeScenarioPointer(segments)}" traverses an array`
    if (next === undefined) {
      const created: Record<string, unknown> = {}
      defineOwn(current, segment, created)
      current = created
    } else if (isPlainObject(next)) {
      current = next
    } else {
      return `path "${encodeScenarioPointer(segments)}" traverses a non-object`
    }
  }
  defineOwn(current, segments.at(-1)!, cloneJson(value))
  return null
}

function removeAt(root: Record<string, unknown>, segments: readonly string[]): string | null {
  let current: unknown = root
  for (let index = 0; index < segments.length - 1; index++) {
    if (Array.isArray(current)) return `path "${encodeScenarioPointer(segments)}" traverses an array`
    if (!isPlainObject(current) || !Object.hasOwn(current, segments[index]!)) return null
    current = ownValue(current, segments[index]!)
  }
  if (Array.isArray(current)) return `path "${encodeScenarioPointer(segments)}" traverses an array`
  if (isPlainObject(current)) Reflect.deleteProperty(current, segments.at(-1)!)
  return null
}

function diffNode(base: unknown, edited: unknown, segments: string[], operations: ScenarioOperation[]): void {
  if (jsonEqual(base, edited)) return
  if (isPlainObject(base) && isPlainObject(edited)) {
    const keys = [...new Set([...Object.keys(base), ...Object.keys(edited)])].sort(compareText)
    for (const key of keys) {
      const baseValue = ownValue(base, key)
      const editedValue = ownValue(edited, key)
      const hasBase = Object.hasOwn(base, key) && baseValue !== undefined
      const hasEdited = Object.hasOwn(edited, key) && editedValue !== undefined
      if (!hasBase && !hasEdited) continue
      const path = encodeScenarioPointer([...segments, key])
      if (!hasEdited) {
        operations.push({
          op: 'remove',
          path,
          before: { present: true, value: cloneJson(baseValue) as JsonValue },
        })
      } else if (!hasBase) {
        operations.push({
          op: 'set',
          path,
          before: { present: false },
          value: cloneJson(editedValue) as JsonValue,
        })
      } else {
        diffNode(baseValue, editedValue, [...segments, key], operations)
      }
    }
    return
  }
  const path = encodeScenarioPointer(segments)
  if (edited === undefined) {
    operations.push({
      op: 'remove',
      path,
      before: { present: true, value: cloneJson(base) as JsonValue },
    })
  } else {
    operations.push({
      op: 'set',
      path,
      before: base === undefined ? { present: false } : { present: true, value: cloneJson(base) as JsonValue },
      value: cloneJson(edited) as JsonValue,
    })
  }
}

export type CreateScenarioPatchResult = { ok: true; patch: ScenarioPatchV1 } | { ok: false; issues: string[] }

/** Build a canonical v1 document from two complete normalized plans. */
export function createScenarioPatch(
  basePlan: Plan,
  editedPlan: Plan,
  metadata: ScenarioPatchMetadata,
): CreateScenarioPatchResult {
  const base = parsePlan(basePlan)
  const edited = parsePlan(editedPlan)
  if (!base.ok || !edited.ok) {
    return {
      ok: false,
      issues: [
        ...(!base.ok ? base.issues.map((issue) => `base: ${issue}`) : []),
        ...(!edited.ok ? edited.issues.map((issue) => `edited: ${issue}`) : []),
      ],
    }
  }
  const protectedChanges = protectedFields.filter((field) => !jsonEqual(base.plan[field], edited.plan[field]))
  if (protectedChanges.length > 0) {
    return {
      ok: false,
      issues: protectedChanges.map((field) => `protected field "${field}" differs`),
    }
  }
  const operations: ScenarioOperation[] = []
  const baseRecord = base.plan as unknown as Record<string, unknown>
  const editedRecord = edited.plan as unknown as Record<string, unknown>
  for (const root of editableRoots) diffNode(baseRecord[root], editedRecord[root], [root], operations)
  return parseScenarioPatch({
    kind: 'retiregolden.scenario-patch',
    version: 1,
    base: {
      planId: base.plan.id,
      planSchemaVersion: base.plan.schemaVersion,
      snapshotHash: scenarioPlanSnapshotHash(base.plan),
    },
    title: metadata.title,
    rationale: metadata.rationale ?? null,
    createdAtIso: metadata.createdAtIso,
    actor: metadata.actor,
    operations,
  })
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    defineOwn(out, key, Object.hasOwn(out, key) ? deepMerge(ownValue(out, key), value) : value)
  }
  return out
}

/** Exact compatibility path for historical loose object patches. */
export function applyLegacyScenarioPatch(plan: Plan, patch: LegacyScenarioPatch): ParsePlanResult {
  const merged = deepMerge(plan, patch) as Record<string, unknown>
  merged['schemaVersion'] = plan.schemaVersion
  merged['id'] = plan.id
  merged['scenarios'] = plan.scenarios
  return parsePlan(merged)
}

/** Convert a legacy patch when a concrete base snapshot is available. */
export function migrateLegacyScenarioPatch(
  basePlan: Plan,
  legacyPatch: LegacyScenarioPatch,
  metadata: ScenarioPatchMetadata,
): CreateScenarioPatchResult {
  if (isScenarioPatchEnvelope(legacyPatch)) return parseScenarioPatch(legacyPatch)
  const applied = applyLegacyScenarioPatch(basePlan, legacyPatch)
  return applied.ok ? createScenarioPatch(basePlan, applied.plan, metadata) : { ok: false, issues: applied.issues }
}

export interface ScenarioConflict {
  kind: 'plan-id' | 'plan-schema-version' | 'value' | 'invalid-path'
  path: string
  expected?: ScenarioValueState
  actual?: ScenarioValueState
  message: string
}

export interface ScenarioConflictReport {
  baseSnapshotMatches: boolean
  conflicts: ScenarioConflict[]
}

function operationTarget(operation: ScenarioOperation): ScenarioValueState {
  return operation.op === 'set' ? { present: true, value: operation.value } : { present: false }
}

function stateEqual(left: ScenarioValueState, right: ScenarioValueState): boolean {
  return left.present === right.present && (!left.present || (right.present && jsonEqual(left.value, right.value)))
}

function conflictReport(plan: Plan, patch: ScenarioPatchV1, direction: 'apply' | 'revert'): ScenarioConflictReport {
  const conflicts: ScenarioConflict[] = []
  if (plan.id !== patch.base.planId) {
    conflicts.push({
      kind: 'plan-id',
      path: '/id',
      message: `patch targets plan "${patch.base.planId}"`,
    })
  }
  if (plan.schemaVersion !== patch.base.planSchemaVersion) {
    conflicts.push({
      kind: 'plan-schema-version',
      path: '/schemaVersion',
      message: `patch targets plan schema ${patch.base.planSchemaVersion}`,
    })
  }
  const record = plan as unknown as Record<string, unknown>
  for (const operation of patch.operations) {
    const segments = decodeScenarioPointer(operation.path)
    if (segments === null) {
      conflicts.push({
        kind: 'invalid-path',
        path: operation.path,
        message: 'invalid scenario path',
      })
      continue
    }
    const traversalIssue = assertNoArrayTraversal(record, segments)
    if (traversalIssue) {
      conflicts.push({
        kind: 'invalid-path',
        path: operation.path,
        message: traversalIssue,
      })
      continue
    }
    const actual = valueStateAt(record, segments)
    const expected = direction === 'apply' ? operation.before : operationTarget(operation)
    const idempotent = direction === 'apply' ? operationTarget(operation) : operation.before
    if (!stateEqual(actual, expected) && !stateEqual(actual, idempotent)) {
      conflicts.push({
        kind: 'value',
        path: operation.path,
        expected,
        actual,
        message: `value at "${operation.path}" changed since the scenario was created`,
      })
    }
  }
  return {
    baseSnapshotMatches: scenarioPlanSnapshotHash(plan) === patch.base.snapshotHash,
    conflicts: conflicts.sort((left, right) => compareText(left.path, right.path)),
  }
}

export function detectScenarioConflicts(plan: Plan, patch: ScenarioPatchV1): ScenarioConflictReport {
  return conflictReport(plan, patch, 'apply')
}

export type ApplyScenarioDocumentResult =
  | { ok: true; plan: Plan; baseSnapshotMatches: boolean }
  | { ok: false; issues: string[]; conflicts: ScenarioConflict[] }

function mutateOperations(
  plan: Plan,
  patch: ScenarioPatchV1,
  direction: 'apply' | 'revert',
): ApplyScenarioDocumentResult {
  const parsedPatch = parseScenarioPatch(patch)
  if (!parsedPatch.ok) return { ok: false, issues: parsedPatch.issues, conflicts: [] }
  const report = conflictReport(plan, parsedPatch.patch, direction)
  if (report.conflicts.length > 0) {
    return {
      ok: false,
      issues: report.conflicts.map((conflict) => conflict.message),
      conflicts: report.conflicts,
    }
  }
  const draft = cloneJson(plan) as unknown as Record<string, unknown>
  const operations = direction === 'apply' ? parsedPatch.patch.operations : [...parsedPatch.patch.operations].reverse()
  for (const operation of operations) {
    const segments = decodeScenarioPointer(operation.path)!
    const target = direction === 'apply' ? operationTarget(operation) : operation.before
    const issue = target.present ? setAt(draft, segments, target.value) : removeAt(draft, segments)
    if (issue) {
      return {
        ok: false,
        issues: [issue],
        conflicts: [{ kind: 'invalid-path', path: operation.path, message: issue }],
      }
    }
  }
  const parsedPlan = parsePlan(draft)
  if (!parsedPlan.ok) return { ok: false, issues: parsedPlan.issues, conflicts: [] }
  const parsedRecord = parsedPlan.plan as unknown as Record<string, unknown>
  for (const operation of parsedPatch.patch.operations) {
    const segments = decodeScenarioPointer(operation.path)!
    const expected = direction === 'apply' ? operationTarget(operation) : operation.before
    const actual = valueStateAt(parsedRecord, segments)
    if (!stateEqual(actual, expected)) {
      const message = `operation at "${operation.path}" is not preserved by the plan schema`
      return {
        ok: false,
        issues: [message],
        conflicts: [
          {
            kind: 'invalid-path',
            path: operation.path,
            expected,
            actual,
            message,
          },
        ],
      }
    }
  }
  return {
    ok: true,
    plan: parsedPlan.plan,
    baseSnapshotMatches: report.baseSnapshotMatches,
  }
}

export function applyScenarioPatchDocument(plan: Plan, patch: ScenarioPatchV1): ApplyScenarioDocumentResult {
  return mutateOperations(plan, patch, 'apply')
}

export function revertScenarioPatch(plan: Plan, patch: ScenarioPatchV1): ApplyScenarioDocumentResult {
  return mutateOperations(plan, patch, 'revert')
}

/**
 * Rebind valid canonical scenarios after an explicit containing-plan re-key.
 * Legacy and malformed documents are preserved byte-for-byte.
 */
export function rebindScenarioPatchesToPlan(plan: Plan): Plan {
  const snapshotHash = scenarioPlanSnapshotHash(plan)
  let changed = false
  const scenarios = plan.scenarios.map((scenario) => {
    if (!isScenarioPatchEnvelope(scenario.patch)) return scenario
    const parsed = parseScenarioPatch(scenario.patch)
    if (!parsed.ok) return scenario
    changed = true
    return {
      ...scenario,
      patch: {
        ...parsed.patch,
        base: {
          planId: plan.id,
          planSchemaVersion: plan.schemaVersion,
          snapshotHash,
        },
      },
    }
  })
  return changed ? { ...plan, scenarios } : plan
}

export function composeScenarioPatches(
  basePlan: Plan,
  patches: readonly ScenarioPatchV1[],
  metadata: ScenarioPatchMetadata,
): CreateScenarioPatchResult {
  let current = basePlan
  for (const patch of patches) {
    const applied = applyScenarioPatchDocument(current, patch)
    if (!applied.ok) return { ok: false, issues: applied.issues }
    current = applied.plan
  }
  return createScenarioPatch(basePlan, current, metadata)
}

export function applyScenarioPatchInput(plan: Plan, patch: ScenarioPatchInput): ParsePlanResult {
  if (!isScenarioPatchEnvelope(patch)) return applyLegacyScenarioPatch(plan, patch)
  const parsed = parseScenarioPatch(patch)
  if (!parsed.ok) return { ok: false, issues: parsed.issues }
  const applied = applyScenarioPatchDocument(plan, parsed.patch)
  return applied.ok ? { ok: true, plan: applied.plan } : { ok: false, issues: applied.issues }
}
