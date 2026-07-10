export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function normalize(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map((item) => normalize(item) ?? null)
  if (typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {}
    for (const [key, child] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
      const normalized = normalize(child)
      if (normalized !== undefined) out[key] = normalized
    }
    return out
  }
  return String(value)
}

export function stableJsonValue(value: unknown): JsonValue {
  return normalize(value) ?? null
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(stableJsonValue(value), null, 2)}\n`
}
