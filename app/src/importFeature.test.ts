import { describe, expect, it, vi } from 'vitest'

import { loadImportFeature, parseImportFeatureConfig } from './importFeature'

describe('import feature bootstrap', () => {
  it('accepts only the exact enabled configuration', () => {
    expect(parseImportFeatureConfig({ enabled: true })).toBe(true)
    expect(parseImportFeatureConfig({ enabled: false })).toBe(false)
    expect(parseImportFeatureConfig({ enabled: true, unexpected: true })).toBe(false)
    expect(parseImportFeatureConfig(null)).toBe(false)
  })

  it('loads the switch from a same-origin no-cache request', async () => {
    const fetcher = vi.fn(async () => new Response('{"enabled":true}', { status: 200 }))

    await expect(loadImportFeature(fetcher)).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledWith(
      '/import-feature.json',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it.each([
    ['disabled', new Response('{"enabled":false}', { status: 200 })],
    ['missing', new Response('missing', { status: 404 })],
    ['malformed', new Response('<html>fallback</html>', { status: 200 })],
    ['oversized', new Response(JSON.stringify({ enabled: true, padding: 'x'.repeat(300) }), { status: 200 })],
  ])('fails closed for a %s response', async (_name, response) => {
    await expect(loadImportFeature(async () => response)).resolves.toBe(false)
  })

  it('fails closed when the request is unavailable', async () => {
    await expect(
      loadImportFeature(async () => {
        throw new Error('offline')
      }),
    ).resolves.toBe(false)
  })

  it('stops reading a streamed response as soon as it crosses the byte cap', async () => {
    const encoder = new TextEncoder()
    let cancelled = false
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{"enabled":true,"padding":"'))
          controller.enqueue(encoder.encode('x'.repeat(300)))
        },
        cancel() {
          cancelled = true
        },
      }),
      { status: 200 },
    )

    await expect(loadImportFeature(async () => response)).resolves.toBe(false)
    expect(cancelled).toBe(true)
  })

  it('rejects a declared oversized response before reading its body', async () => {
    let bodyAccessed = false
    const response = {
      ok: true,
      headers: new Headers({ 'Content-Length': '257' }),
      get body() {
        bodyAccessed = true
        return new Response('{"enabled":true}').body
      },
    } as Response

    await expect(loadImportFeature(async () => response)).resolves.toBe(false)
    expect(bodyAccessed).toBe(false)
  })
})
