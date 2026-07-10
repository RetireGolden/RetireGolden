/** Shared provenance helpers — raw IndexedDB records skip Zod defaults. */

export const EXAMPLE_PLAN_ID_PREFIX = 'example:'

export function isExamplePlanId(id: string): boolean {
  return id.startsWith(EXAMPLE_PLAN_ID_PREFIX)
}

export function exampleStorageId(exampleId: string): string {
  return `${EXAMPLE_PLAN_ID_PREFIX}${exampleId}`
}

/** Exclude only explicit demos; missing `origin` is treated as a user plan. */
export function isUserPlan(raw: Record<string, unknown>): boolean {
  return raw['origin'] !== 'example'
}

export function isExamplePlan(raw: Record<string, unknown>): boolean {
  return raw['origin'] === 'example'
}

export function planOriginFromRaw(raw: Record<string, unknown>): 'user' | 'example' {
  return raw['origin'] === 'example' ? 'example' : 'user'
}
