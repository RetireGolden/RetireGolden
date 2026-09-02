/**
 * Scenario row identity (#480): two rows must never share a label (their
 * Compare and Remove controls would share an accessible name), and the same
 * lever request must not be added twice.
 */

/** "Name", then "Name (2)", "Name (3)"... until the name is free. */
export function uniqueScenarioName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.includes(candidate)) return candidate
  }
}

/**
 * Rows with their names made distinct in order, so plans saved before the
 * add-time guard (or scenarios inserted by other paths) still render tellable
 * rows without touching the stored plan.
 */
export function withDistinctNames<T extends { name: string }>(rows: readonly T[]): T[] {
  const taken: string[] = []
  return rows.map((row) => {
    const name = uniqueScenarioName(row.name, taken)
    taken.push(name)
    return name === row.name ? row : { ...row, name }
  })
}

/** Keys that differ between two builds of the same request: generated ids, stamps, and evidence. */
const VOLATILE_KEYS = new Set(['id', 'createdAtIso', 'before'])

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key)) continue
      out[key] = canonical((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

/**
 * What a scenario patch does, as a stable string: its operations with keys
 * sorted and volatile fields (generated ids, creation stamps, `before`
 * evidence) removed. Two adds of the same lever produce the same signature
 * even when the plan moved on between them.
 */
export function scenarioPatchSignature(patch: Record<string, unknown>): string {
  return JSON.stringify(canonical(patch.operations ?? patch))
}
