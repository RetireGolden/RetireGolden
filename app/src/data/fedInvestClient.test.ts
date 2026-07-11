import { afterEach, describe, expect, it, vi } from 'vitest'

import { latestPriceDateIso } from '@retiregolden/engine/ladder/fedInvest'

import { fetchFedInvestTips, importFedInvestCsv, readFedInvestCache } from './fedInvestClient'
import { STORAGE_KEYS } from './localStore'

// Two well-formed TIPS rows in the real FedInvest securityprice.csv shape
// (no header, rate as a decimal fraction, maturity MM/DD/YYYY); parsing
// itself is covered by the engine package's fedInvest tests.
const sampleCsv = [
  '912828S50,TIPS,0.00125,07/15/2026,,0.000000,100.031250,100.062500',
  '912828V49,TIPS,0.00375,01/15/2027,,98.687500,98.656250,98.687500',
].join('\n')

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  return store
}

function csvResponse(body: string, ok = true, status = 200): Pick<Response, 'ok' | 'status' | 'text'> {
  return { ok, status, text: async () => body }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('importFedInvestCsv', () => {
  it('builds an import-sourced snapshot with an unknown (null) price date', () => {
    const snapshot = importFedInvestCsv(sampleCsv)
    expect(snapshot.source).toBe('import')
    expect(snapshot.tips).toHaveLength(2)
    // The FedInvest CSV carries no date — never guess one (it would mislabel
    // the prices and make the cache look fresh, suppressing real fetches).
    expect(snapshot.priceDateIso).toBeNull()
  })

  it('rejects a file with no TIPS rows', () => {
    expect(() => importFedInvestCsv('a,b,c')).toThrow(/securityprice\.csv/)
  })

  it('caches the imported snapshot for later reads', () => {
    stubLocalStorage()
    const snapshot = importFedInvestCsv(sampleCsv)
    expect(readFedInvestCache()).toEqual(snapshot)
  })
})

describe('readFedInvestCache', () => {
  it('returns null with no storage available (node default)', () => {
    expect(readFedInvestCache()).toBeNull()
  })

  it('rejects malformed cache entries', () => {
    const store = stubLocalStorage()
    store.set(STORAGE_KEYS.fedInvestCache, 'not json')
    expect(readFedInvestCache()).toBeNull()
    store.set(STORAGE_KEYS.fedInvestCache, JSON.stringify({ priceDateIso: 7, tips: [] }))
    expect(readFedInvestCache()).toBeNull()
    store.set(STORAGE_KEYS.fedInvestCache, JSON.stringify({ priceDateIso: null, tips: 'nope' }))
    expect(readFedInvestCache()).toBeNull()
  })
})

describe('fetchFedInvestTips', () => {
  it('serves a same-day fetch-sourced snapshot from the cache without a request', async () => {
    const store = stubLocalStorage()
    const now = new Date('2026-07-08T12:00:00')
    const cached = {
      priceDateIso: latestPriceDateIso(now),
      fetchedAtIso: new Date().toISOString(),
      source: 'fetch',
      tips: importFedInvestCsv(sampleCsv).tips,
    }
    store.set(STORAGE_KEYS.fedInvestCache, JSON.stringify(cached))
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await fetchFedInvestTips(now)).toEqual(cached)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches, parses, and caches when there is no fresh snapshot', async () => {
    stubLocalStorage()
    const now = new Date('2026-07-08T12:00:00')
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse(sampleCsv)))
    const snapshot = await fetchFedInvestTips(now)
    expect(snapshot.source).toBe('fetch')
    expect(snapshot.priceDateIso).toBe(latestPriceDateIso(now))
    expect(snapshot.tips).toHaveLength(2)
    expect(readFedInvestCache()).toEqual(snapshot)
  })

  it('an import-sourced cache never suppresses a real fetch', async () => {
    stubLocalStorage()
    importFedInvestCsv(sampleCsv)
    const fetchSpy = vi.fn(async () => csvResponse(sampleCsv))
    vi.stubGlobal('fetch', fetchSpy)
    const snapshot = await fetchFedInvestTips(new Date('2026-07-08T12:00:00'))
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(snapshot.source).toBe('fetch')
  })

  it('reports an unreachable service readably', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('CORS'))))
    await expect(fetchFedInvestTips()).rejects.toThrow(/blocked or offline/)
  })

  it('reports a non-OK answer readably', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse('', false, 503)))
    await expect(fetchFedInvestTips()).rejects.toThrow(/answered 503/)
  })

  it('rejects an answer with no TIPS rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse('<html>maintenance</html>')))
    await expect(fetchFedInvestTips()).rejects.toThrow(/no TIPS rows/)
  })
})
