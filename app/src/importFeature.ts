const IMPORT_FEATURE_PATH = '/import-feature.json'
const MAX_CONFIG_BYTES = 256
const CONFIG_TIMEOUT_MS = 5_000

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export function parseImportFeatureConfig(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'enabled')) return false
  return record.enabled === true
}

async function readBoundedBody(response: Response): Promise<string | null> {
  const declaredLength = response.headers.get('Content-Length')
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim()
    if (!/^\d+$/.test(normalizedLength) || Number(normalizedLength) > MAX_CONFIG_BYTES) return null
  }

  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_CONFIG_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/**
 * Fetch the same-origin, no-cache emergency switch while the shell is mounted
 * fail closed in its neutral pending state.
 * Missing, oversized, malformed, or non-200 responses fail closed.
 */
export async function loadImportFeature(fetcher: FetchLike = globalThis.fetch): Promise<boolean> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort()
      resolve(false)
    }, CONFIG_TIMEOUT_MS)
  })
  const request = (async () => {
    try {
      const response = await fetcher(IMPORT_FEATURE_PATH, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      })
      if (response.status !== 200) return false
      const text = await readBoundedBody(response)
      if (text === null) return false
      return parseImportFeatureConfig(JSON.parse(text))
    } catch {
      return false
    }
  })()
  try {
    return await Promise.race([request, deadline])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}
