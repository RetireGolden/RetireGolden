import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FETCH_POLICY_VERSION,
  fetchWithCache,
  sameApprovedFetchHost,
} from './verify-quotes.mjs'

const MI_TREASURY_URL =
  'https://www.michigan.gov/treasury/reference/tax-administration/revenue-administrative-bulletins/rab-2026-1'

const USCODE_URL = 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72'

/** Enough HTML to pass the shell-length heuristic if a fallback succeeds. */
const SUBSTANTIAL_HTML =
  '<html><body><p>' + 'operative statutory language for quote verification. '.repeat(120) + '</p></body></html>'

const cacheDirs = []

/** @param {string} url */
function cacheKey(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

/**
 * @param {{ url: string; status: number; body: string; contentType?: string }} init
 * @returns {Response}
 */
function mockFetchResponse(init) {
  const response = new Response(init.body, {
    status: init.status,
    headers: { 'content-type': init.contentType ?? 'text/html' },
  })
  Object.defineProperty(response, 'url', { value: init.url, configurable: true })
  return response
}

function tempCacheDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rg-verify-quotes-test-'))
  cacheDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of cacheDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('redirect policy at the fetch boundary', () => {
  it('gates browser retry on same host, scheme, and credentials', () => {
    expect(sameApprovedFetchHost(MI_TREASURY_URL, MI_TREASURY_URL)).toEqual({ ok: true })
    expect(sameApprovedFetchHost(MI_TREASURY_URL, MI_TREASURY_URL + '#section')).toEqual({ ok: true })
    expect(
      sameApprovedFetchHost(
        MI_TREASURY_URL,
        'https://legislature.mi.gov/legislation/mcl/206-30',
      ),
    ).toEqual({ ok: false, reason: 'redirect landed on unapproved host legislature.mi.gov' })
    expect(
      sameApprovedFetchHost(MI_TREASURY_URL, 'http://www.michigan.gov/treasury/page'),
    ).toEqual({ ok: false, reason: 'redirect downgraded scheme to http:' })
    expect(
      sameApprovedFetchHost(MI_TREASURY_URL, 'https://user:secret@www.michigan.gov/treasury/page'),
    ).toEqual({ ok: false, reason: 'redirect URL carries credentials' })
    expect(
      sameApprovedFetchHost(
        'https://user:secret@www.michigan.gov/treasury/page',
        'https://www.michigan.gov/treasury/page',
      ),
    ).toEqual({ ok: false, reason: 'source URL carries credentials' })
    expect(sameApprovedFetchHost(MI_TREASURY_URL, '')).toEqual({
      ok: false,
      reason: 'redirect response has no final URL',
    })
    expect(sameApprovedFetchHost('not-a-url', MI_TREASURY_URL)).toEqual({
      ok: false,
      reason: 'malformed URL in redirect check',
    })
  })

  it('accepts a transparent cross-host 200 without treating it as unfetchable', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      mockFetchResponse({
        url: 'https://www.law.cornell.edu/uscode/text/26/72',
        status: 200,
        body: SUBSTANTIAL_HTML,
      }),
    )
    const result = await fetchWithCache(USCODE_URL, {
      cacheDir: tempCacheDir(),
      refresh: true,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.fetchProfile).toBe('transparent')
    expect(result.status).toBe(200)
    expect(result.finalUrl).toBe('https://www.law.cornell.edu/uscode/text/26/72')
    expect(result.error).toBeUndefined()
    expect(result.body.toString('utf8')).toContain('operative statutory language')
  })

  it('keeps an excluded-host transparent 403 as the original refusal with no browser retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({
          url: 'https://legislature.mi.gov/legislation/mcl/206-30',
          status: 403,
          body: 'forbidden',
        }),
      )
    const result = await fetchWithCache(MI_TREASURY_URL, {
      cacheDir: tempCacheDir(),
      refresh: true,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.fetchProfile).toBe('transparent')
    expect(result.status).toBe(403)
    expect(result.finalUrl).toBe('https://legislature.mi.gov/legislation/mcl/206-30')
    expect(result.error).toBeUndefined()
  })

  it('refuses browser retry when the transparent refusal has no final URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      mockFetchResponse({ url: '', status: 403, body: 'forbidden' }),
    )
    const result = await fetchWithCache(MI_TREASURY_URL, {
      cacheDir: tempCacheDir(),
      refresh: true,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.fetchProfile).toBe('transparent')
    expect(result.status).toBe(403)
    expect(result.error).toBeUndefined()
  })

  it('refuses browser redirects at the fetch layer and keeps the transparent refusal', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce((_url, init) => {
        expect(init?.redirect).toBe('follow')
        return Promise.resolve(
          mockFetchResponse({ url: MI_TREASURY_URL, status: 403, body: 'forbidden' }),
        )
      })
      .mockImplementationOnce((_url, init) => {
        expect(init?.redirect).toBe('error')
        return Promise.reject(new TypeError('redirected'))
      })
    const result = await fetchWithCache(MI_TREASURY_URL, {
      cacheDir: tempCacheDir(),
      refresh: true,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.fetchProfile).toBe('transparent')
    expect(result.status).toBe(403)
    expect(result.error).toBeUndefined()
  })

  it('succeeds through browser fallback when the same host serves the document', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({ url: MI_TREASURY_URL, status: 403, body: 'forbidden' }),
      )
      .mockImplementationOnce((_url, init) => {
        expect(init?.redirect).toBe('error')
        return Promise.resolve(
          mockFetchResponse({ url: MI_TREASURY_URL, status: 200, body: SUBSTANTIAL_HTML }),
        )
      })
    const result = await fetchWithCache(MI_TREASURY_URL, {
      cacheDir: tempCacheDir(),
      refresh: true,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.fetchProfile).toBe('browserFallback')
    expect(result.status).toBe(200)
    expect(result.error).toBeUndefined()
    expect(result.body.toString('utf8')).toContain('operative statutory language')
  })

  it('refetches browser-fallback cache rows that predate redirect policy evidence', async () => {
    const cacheDir = tempCacheDir()
    const key = cacheKey(MI_TREASURY_URL)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, `${key}.body`), SUBSTANTIAL_HTML)
    writeFileSync(
      join(cacheDir, `${key}.meta.json`),
      `${JSON.stringify(
        {
          url: MI_TREASURY_URL,
          status: 200,
          contentType: 'text/html',
          fetchedAt: '2026-09-01T00:00:00.000Z',
          bytes: Buffer.byteLength(SUBSTANTIAL_HTML),
          fetchProfile: 'browserFallback',
        },
        null,
        1,
      )}\n`,
    )
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({ url: MI_TREASURY_URL, status: 403, body: 'forbidden' }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({ url: MI_TREASURY_URL, status: 200, body: SUBSTANTIAL_HTML }),
      )
    const result = await fetchWithCache(MI_TREASURY_URL, {
      cacheDir,
      refresh: false,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.fromCache).toBe(false)
    expect(result.fetchProfile).toBe('browserFallback')
    expect(FETCH_POLICY_VERSION).toBe('redirect-same-host-v1')
  })

  it('reuses browser-fallback cache rows that carry the current fetchPolicyVersion', async () => {
    const cacheDir = tempCacheDir()
    const key = cacheKey(MI_TREASURY_URL)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, `${key}.body`), SUBSTANTIAL_HTML)
    writeFileSync(
      join(cacheDir, `${key}.meta.json`),
      `${JSON.stringify(
        {
          url: MI_TREASURY_URL,
          status: 200,
          contentType: 'text/html',
          fetchedAt: '2026-09-05T00:00:00.000Z',
          bytes: Buffer.byteLength(SUBSTANTIAL_HTML),
          fetchProfile: 'browserFallback',
          fetchPolicyVersion: FETCH_POLICY_VERSION,
        },
        null,
        1,
      )}\n`,
    )
    const fetchImpl = vi.fn()
    const result = await fetchWithCache(MI_TREASURY_URL, {
      cacheDir,
      refresh: false,
      delayMs: 0,
      fetchImpl,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.fromCache).toBe(true)
    expect(result.fetchProfile).toBe('browserFallback')
    expect(result.body.toString('utf8')).toContain('operative statutory language')
  })
})
