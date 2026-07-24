/**
 * Persisted, edition-neutral scenario patch contract.
 *
 * Version 1 treats arrays as atomic values. A path may point to an array, but
 * may never traverse through one: positional edits become unsafe as soon as a
 * user reorders accounts, people, or income streams.
 */

import { z } from 'zod'

export const CURRENT_SCENARIO_PATCH_VERSION = 1 as const
export const SCENARIO_PATCH_KIND = 'retiregolden.scenario-patch' as const

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const dangerousKeys = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  '__proto__',
  'constructor',
  'prototype',
])
const allowedRoots = new Set([
  'household',
  'accounts',
  'insurance',
  'careEvents',
  'incomes',
  'incomeFloor',
  'expenses',
  'strategies',
  'assumptions',
])

export function decodeScenarioPointer(path: string): string[] | null {
  if (!path.startsWith('/') || path === '/') return null
  const rawSegments = path.slice(1).split('/')
  const segments: string[] = []
  for (let index = 0; index < rawSegments.length; index++) {
    const raw = rawSegments[index]!
    if (/~(?:[^01]|$)/.test(raw)) return null
    const segment = raw.replaceAll('~1', '/').replaceAll('~0', '~')
    if (segment.length === 0 || dangerousKeys.has(segment)) {
      return null
    }
    segments.push(segment)
  }
  if (!allowedRoots.has(segments[0]!)) return null
  return segments
}

export function encodeScenarioPointer(segments: readonly string[]): string {
  return `/${segments.map((segment) => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema).superRefine((value, ctx) => {
      for (const key of Object.keys(value)) {
        if (dangerousKeys.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `reserved object key "${key}"`,
          })
        }
      }
    }),
  ]),
)

const scenarioPathSchema = z.string().superRefine((path, ctx) => {
  if (decodeScenarioPointer(path) === null) {
    ctx.addIssue({
      code: 'custom',
      message: 'expected a safe RFC 6901 pointer below an editable plan root',
    })
  }
})

export const scenarioValueStateSchema = z.discriminatedUnion('present', [
  z.strictObject({ present: z.literal(false) }),
  z.strictObject({ present: z.literal(true), value: jsonValueSchema }),
])
export type ScenarioValueState = z.infer<typeof scenarioValueStateSchema>

export const scenarioOperationSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('set'),
    path: scenarioPathSchema,
    before: scenarioValueStateSchema,
    value: jsonValueSchema,
  }),
  z.strictObject({
    op: z.literal('remove'),
    path: scenarioPathSchema,
    before: z.strictObject({
      present: z.literal(true),
      value: jsonValueSchema,
    }),
  }),
])
export type ScenarioOperation = z.infer<typeof scenarioOperationSchema>

export const scenarioActorSchema = z.strictObject({
  kind: z.enum(['user', 'advisor', 'system', 'legacy']),
  id: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
})
export type ScenarioActor = z.infer<typeof scenarioActorSchema>

export const scenarioPatchV1Schema = z.strictObject({
  kind: z.literal(SCENARIO_PATCH_KIND),
  version: z.literal(CURRENT_SCENARIO_PATCH_VERSION),
  base: z.strictObject({
    planId: z.string().min(1),
    planSchemaVersion: z.number().int().positive(),
    snapshotHash: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
  }),
  title: z.string().min(1),
  rationale: z.string().min(1).nullable(),
  createdAtIso: z.iso.datetime({ offset: true }),
  actor: scenarioActorSchema,
  operations: z.array(scenarioOperationSchema),
})
export type ScenarioPatchV1 = z.infer<typeof scenarioPatchV1Schema>

export interface ScenarioPatchMetadata {
  title: string
  rationale?: string | null
  createdAtIso: string
  actor: ScenarioActor
}

export type LegacyScenarioPatch = Record<string, unknown>
export type ScenarioPatchInput = LegacyScenarioPatch | ScenarioPatchV1

export type ParseScenarioPatchResult = { ok: true; patch: ScenarioPatchV1 } | { ok: false; issues: string[] }

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
}

/** Validate and canonicalize an operation document. */
export function parseScenarioPatch(input: unknown): ParseScenarioPatchResult {
  const parsed = scenarioPatchV1Schema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    }
  }
  const operations = [...parsed.data.operations].sort((left, right) => compareText(left.path, right.path))
  const issues: string[] = []
  for (let index = 1; index < operations.length; index++) {
    const previous = operations[index - 1]!
    const current = operations[index]!
    if (pathsOverlap(previous.path, current.path)) {
      issues.push(`operations overlap at "${previous.path}" and "${current.path}"`)
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, patch: { ...parsed.data, operations } }
}

export function isScenarioPatchDocument(input: unknown): input is ScenarioPatchV1 {
  return parseScenarioPatch(input).ok
}

/**
 * Detect a canonical-looking envelope even when its discriminator is missing
 * or misspelled, so malformed documents fail validation instead of falling
 * through to the permissive historical deep-merge path.
 */
export function isScenarioPatchEnvelope(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false
  const value = input as Record<string, unknown>
  if (Object.hasOwn(value, 'kind')) return true
  return (
    Object.hasOwn(value, 'base') &&
    Object.hasOwn(value, 'operations') &&
    (Object.hasOwn(value, 'version') || Object.hasOwn(value, 'actor'))
  )
}
