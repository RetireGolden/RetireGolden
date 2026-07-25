import { afterEach, describe, expect, it, vi } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_PAGES,
  MAX_DOCUMENT_TEXT_CHARS,
  MAX_PAGE_TEXT_CHARS,
  extractDocumentText,
} from './documentText'
import { buildSyntheticPdf } from './pdfFixtures'

/** Narrow to the success arm, failing loudly (with the reason) when it isn't. */
function expectOk(result: Awaited<ReturnType<typeof extractDocumentText>>) {
  if (!result.ok) throw new Error(`expected success, got ${result.reason}: ${result.message}`)
  return result
}

describe('extractDocumentText — reading the text layer', () => {
  it('extracts a single page of text with its 1-based page number', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Vanguard Brokerage Account 1234' }] })
    const result = expectOk(await extractDocumentText(pdf))

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]!.page).toBe(1)
    expect(result.pages[0]!.text).toBe('Vanguard Brokerage Account 1234')
    expect(result.pages[0]!.imageOnly).toBe(false)
    expect(result.pages[0]!.truncated).toBe(false)
    expect(result.summary.totalPages).toBe(1)
    expect(result.summary.noTextExtracted).toBe(false)
    expect(result.summary.truncated).toBe(false)
    expect(result.summary.truncatedBy).toEqual([])
  })

  it('cites the right page for each string in a multi-page document', async () => {
    // The page citation is the whole point: a value read off page 3 must be
    // attributable to page 3 without parsing any string to find out.
    const pdf = buildSyntheticPdf({
      pages: [{ text: 'Summary of accounts' }, { text: 'Holdings detail' }, { text: 'Disclosures' }],
    })
    const result = expectOk(await extractDocumentText(pdf))

    expect(result.pages.map((page) => [page.page, page.text])).toEqual([
      [1, 'Summary of accounts'],
      [2, 'Holdings detail'],
      [3, 'Disclosures'],
    ])
    expect(result.summary.totalPages).toBe(3)
    expect(result.summary.pagesExtracted).toBe(3)

    const holdingsPage = result.pages.find((page) => page.text.includes('Holdings'))!.page
    expect(holdingsPage).toBe(2)
    expect(Number.isInteger(holdingsPage)).toBe(true)
  })

  it('accepts an ArrayBuffer as readily as a Uint8Array, without detaching it', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Same bytes either way' }] })
    const buffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer

    const result = expectOk(await extractDocumentText(buffer))
    expect(result.pages[0]!.text).toBe('Same bytes either way')
    // pdfjs can take ownership of the buffer it is given; the caller's must
    // survive so they can hash it or retry.
    expect(buffer.byteLength).toBe(pdf.byteLength)
  })
})

describe('extractDocumentText — pages with no text layer', () => {
  it('reports a scanned page as imageOnly rather than as an empty success', async () => {
    const pdf = buildSyntheticPdf({
      pages: [{ text: 'Statement of position' }, { image: true }],
    })
    const result = expectOk(await extractDocumentText(pdf))

    expect(result.pages[0]!.imageOnly).toBe(false)
    expect(result.pages[1]!.page).toBe(2)
    expect(result.pages[1]!.text).toBe('')
    expect(result.pages[1]!.imageOnly).toBe(true)
    expect(result.summary.imageOnlyPages).toBe(1)
    // Some text came out, so this is not a "whole document needs OCR" case.
    expect(result.summary.noTextExtracted).toBe(false)
  })

  it('distinguishes a genuinely blank page from a scanned one', async () => {
    // "We found nothing here" and "there is a picture we cannot read" are
    // different answers; collapsing them would send a user to OCR over a
    // blank separator page.
    const pdf = buildSyntheticPdf({ pages: [{}] })
    const result = expectOk(await extractDocumentText(pdf))

    expect(result.pages[0]!.text).toBe('')
    expect(result.pages[0]!.imageOnly).toBe(false)
    expect(result.summary.imageOnlyPages).toBe(0)
    expect(result.summary.noTextExtracted).toBe(true)
  })

  it('flags a fully scanned document as yielding no text at all', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ image: true }, { image: true }] })
    const result = expectOk(await extractDocumentText(pdf))

    expect(result.summary.totalPages).toBe(2)
    expect(result.summary.imageOnlyPages).toBe(2)
    expect(result.summary.noTextExtracted).toBe(true)
    expect(result.summary.totalTextChars).toBe(0)
  })

  it('never lets truncation manufacture an image-only verdict', async () => {
    // A page with a full text layer AND a logo. Clipped to nothing by the
    // caller's own cap, it is still a page pdfjs read perfectly — calling it
    // image-only would tell a user to retype a page that needs no retyping,
    // and `noTextExtracted` would repeat the same lie at document level.
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Total account value $128,450.22', image: true }] })

    const clipped = expectOk(await extractDocumentText(pdf, { maxPageTextChars: 0 }))
    expect(clipped.pages[0]!.text).toBe('')
    expect(clipped.pages[0]!.truncated).toBe(true)
    expect(clipped.pages[0]!.imageOnly).toBe(false)
    expect(clipped.summary.imageOnlyPages).toBe(0)
    expect(clipped.summary.noTextExtracted).toBe(false)

    // Uncapped, the same bytes read normally — the page is not image-only
    // either way, so the cap changed nothing but the text.
    const whole = expectOk(await extractDocumentText(pdf))
    expect(whole.pages[0]!.text).toBe('Total account value $128,450.22')
    expect(whole.pages[0]!.imageOnly).toBe(false)
    expect(whole.summary.noTextExtracted).toBe(false)

    // …and the signal still fires for a page that genuinely has no text layer,
    // clipped or not: the fix must not have blunted the OCR signal itself.
    const scanned = expectOk(
      await extractDocumentText(buildSyntheticPdf({ pages: [{ image: true }] }), { maxPageTextChars: 0 }),
    )
    expect(scanned.pages[0]!.imageOnly).toBe(true)
    expect(scanned.summary.noTextExtracted).toBe(true)
  })

  it('does not call a document with no pages at all "scanned"', async () => {
    // `/Kids [] /Count 0`. `noTextExtracted` is the honest needs-OCR signal, so
    // it may never be vacuously true: there are no pages to scan, and telling a
    // consumer "these pages are images, type them in" about nothing at all is
    // the same dishonesty as mislabelling a blank page.
    const result = expectOk(await extractDocumentText(buildSyntheticPdf({ pages: [] })))

    expect(result.pages).toEqual([])
    expect(result.summary.totalPages).toBe(0)
    expect(result.summary.pagesExtracted).toBe(0)
    expect(result.summary.imageOnlyPages).toBe(0)
    expect(result.summary.totalTextChars).toBe(0)
    expect(result.summary.noTextExtracted).toBe(false)
  })

  it('does not call a document "scanned" when the total cap stopped it before page 1', async () => {
    // Same rule from the other direction: no page was read, so nothing is known
    // about whether any page is scanned.
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Readable page one' }] })
    const result = expectOk(await extractDocumentText(pdf, { maxTotalTextChars: 0 }))

    expect(result.pages).toEqual([])
    expect(result.summary.totalPages).toBe(1)
    expect(result.summary.noTextExtracted).toBe(false)
    expect(result.summary.truncatedBy).toContain('document_text_cap')
  })
})

describe('extractDocumentText — honest failure', () => {
  it('returns encrypted for a password-protected document, and does not throw', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'confidential' }], encrypted: true })
    const result = await extractDocumentText(pdf)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('encrypted')
    expect(result.message).toMatch(/password/i)
  })

  it('returns corrupt for a PDF header over unparseable structure', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nthis is not a real PDF body at all\n')
    const result = await extractDocumentText(bytes)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('corrupt')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('returns not_pdf when the magic bytes are not %PDF-', async () => {
    // A JPEG's leading bytes: the file a user picks when they meant to pick
    // the statement, not something to hand to a PDF parser at all.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    const result = await extractDocumentText(jpeg)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('not_pdf')
    expect(result.message).toMatch(/not a PDF/i)
  })

  it('returns not_pdf for empty input rather than throwing', async () => {
    const result = await extractDocumentText(new Uint8Array(0))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('not_pdf')
  })

  it('returns too_large before it inspects a single byte', async () => {
    // Deliberately NOT a PDF: oversized input is refused on size alone, so
    // `too_large` must win over `not_pdf` — we never looked at the content.
    const oversized = new Uint8Array(MAX_DOCUMENT_BYTES + 1)
    const result = await extractDocumentText(oversized)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too_large')
    expect(result.message).toContain('larger than the 25 MB limit')
  })

  it('states a sub-megabyte cap in a unit that is true of it', async () => {
    // `Math.round(limit / 1 MiB)` floored at 1, so every cap below ~1.5 MB was
    // reported as "the 1 MB limit" — an 866-byte file refused under a 10-byte
    // cap was told it exceeded a megabyte. Each of these must name its own cap.
    const oversized = new Uint8Array(2 * 1024 * 1024)
    const message = async (maxBytes: number) => {
      const result = await extractDocumentText(oversized, { maxBytes })
      if (result.ok) throw new Error('expected too_large')
      expect(result.reason).toBe('too_large')
      return result.message
    }

    expect(await message(1)).toContain('the 1 byte limit')
    expect(await message(10)).toContain('the 10 bytes limit')
    expect(await message(1024)).toContain('the 1 KB limit')
    expect(await message(500 * 1024)).toContain('the 500 KB limit')
    // A cap between the units keeps its decimal rather than rounding to a
    // number that is not the cap in either direction.
    expect(await message(1.5 * 1024 * 1024)).toContain('the 1.5 MB limit')
    // The module ceiling itself is asserted where it fires, above.
  })

  it('returns too_many_pages past the page cap', async () => {
    const pages = Array.from({ length: MAX_DOCUMENT_PAGES + 1 }, (_unused, index) => ({
      text: `Page ${index + 1}`,
    }))
    const result = await extractDocumentText(buildSyntheticPdf({ pages }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too_many_pages')
    expect(result.message).toMatch(String(MAX_DOCUMENT_PAGES))
  })

  it('returns a result for a DETACHED ArrayBuffer instead of throwing', async () => {
    // A detached buffer is what a caller holds after `structuredClone(buffer,
    // { transfer })` or a worker handoff. Wrapping it in a Uint8Array throws a
    // TypeError, which would escape the result union the module promises — the
    // one input class that ever did.
    const buffer = new ArrayBuffer(1024)
    structuredClone(buffer, { transfer: [buffer] })
    expect(buffer.byteLength).toBe(0) // detached

    const result = await extractDocumentText(buffer)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unreadable_input')
    // Not `not_pdf`: we never looked at a byte, so claiming it is not a PDF
    // would be a guess dressed up as a finding.
    expect(result.message).toMatch(/could not be read/i)
    expect(result.message).toMatch(/[.!]$/)
  })

  it('returns a result for a detached VIEW, not a verdict about bytes it never read', async () => {
    // The commoner half of the same condition: transferring `view.buffer`
    // leaves the caller holding the VIEW, whose byteLength is now 0. Wrapping
    // that does not throw, so it would sail through the header scan and come
    // back as "this is not a PDF" — a confident answer about zero bytes.
    const view = new Uint8Array(1024)
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]) // a real %PDF- header, before transfer
    structuredClone(view.buffer, { transfer: [view.buffer] })
    expect(view.byteLength).toBe(0) // the view is detached with it

    const result = await extractDocumentText(view)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unreadable_input')
    expect(result.reason).not.toBe('not_pdf')
    expect(result.message).toMatch(/[.!]$/)
  })

  it('never throws on arbitrary bytes — every input comes back as a result', async () => {
    const inputs: Uint8Array[] = [
      new Uint8Array(0),
      new Uint8Array([0x00]),
      new TextEncoder().encode('%PDF-'),
      new TextEncoder().encode('%PDF-1.4\n%%EOF\n'),
      new TextEncoder().encode('{"looks":"like json"}'),
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), // a zip/docx
      Uint8Array.from({ length: 512 }, (_unused, index) => (index * 7) % 256),
    ]

    for (const input of inputs) {
      const result = await extractDocumentText(input)
      if (!result.ok) {
        expect(typeof result.reason).toBe('string')
        expect(result.message.length).toBeGreaterThan(0)
      }
    }
  })

  it('gives every failure reason a human message a UI can show', async () => {
    const detached = new ArrayBuffer(8)
    structuredClone(detached, { transfer: [detached] })

    const results = await Promise.all([
      extractDocumentText(new Uint8Array(MAX_DOCUMENT_BYTES + 1)),
      extractDocumentText(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
      extractDocumentText(new TextEncoder().encode('%PDF-1.7\nrubbish\n')),
      extractDocumentText(buildSyntheticPdf({ pages: [{ text: 'x' }], encrypted: true })),
      extractDocumentText(buildSyntheticPdf({ pages: [{ text: 'x' }, { text: 'y' }] }), { maxPages: 1 }),
      extractDocumentText(detached),
    ])

    const seen = new Set<string>()
    for (const result of results) {
      expect(result.ok).toBe(false)
      if (result.ok) continue
      seen.add(result.reason)
      // A sentence, not a token: ends in punctuation and is not the enum.
      expect(result.message).not.toBe(result.reason)
      expect(result.message).toMatch(/[.!]$/)
    }
    // `pdfjs_unavailable` is the one reason that cannot be produced by any input
    // — it needs the peer to be missing — so it has its own test below.
    expect([...seen].sort()).toEqual([
      'corrupt',
      'encrypted',
      'not_pdf',
      'too_large',
      'too_many_pages',
      'unreadable_input',
    ])
  })

  it('says "1 page", not "1 pages", when the page cap is one', async () => {
    const result = await extractDocumentText(buildSyntheticPdf({ pages: [{ text: 'a' }, { text: 'b' }] }), {
      maxPages: 1,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('more than 1 page,')
    expect(result.message).not.toContain('1 pages')
  })
})

describe('extractDocumentText — the optional pdfjs peer is missing', () => {
  afterEach(() => {
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.mjs')
    vi.resetModules()
  })

  it('reports pdfjs_unavailable rather than throwing when the peer will not load', async () => {
    // The branch the whole optional-peer design exists for: a host that imports
    // this subpath without installing `pdfjs-dist`. The dynamic import is the
    // only thing that fails, and it must come back as a reason with a message a
    // UI can show, so the host can fall back to manual entry.
    vi.resetModules()
    vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => {
      throw new Error("Cannot find package 'pdfjs-dist'")
    })

    const { extractDocumentText: extractWithoutPdfjs } = await import('./documentText')
    const result = await extractWithoutPdfjs(buildSyntheticPdf({ pages: [{ text: 'Statement of position' }] }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('pdfjs_unavailable')
    expect(result.message).toContain('pdfjs-dist')
    expect(result.message).not.toBe(result.reason)
    expect(result.message).toMatch(/[.!]$/)
  })
})

describe('extractDocumentText — caps', () => {
  it('says so when the per-page character cap truncates', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Truncate me right here' }] })
    const result = expectOk(await extractDocumentText(pdf, { maxPageTextChars: 8 }))

    expect(result.pages[0]!.text).toBe('Truncate')
    expect(result.pages[0]!.truncated).toBe(true)
    expect(result.summary.truncated).toBe(true)
    expect(result.summary.truncatedBy).toContain('page_text_cap')
    expect(result.summary.totalTextChars).toBe(8)
  })

  it('says so when the whole-document character cap stops extraction early', async () => {
    const pdf = buildSyntheticPdf({
      pages: [{ text: 'First page text' }, { text: 'Second page text' }, { text: 'Third page text' }],
    })
    const result = expectOk(await extractDocumentText(pdf, { maxTotalTextChars: 5 }))

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]!.text).toBe('First')
    expect(result.pages[0]!.truncated).toBe(true)
    // The document still reports its real length, so a caller can see that
    // pages 2 and 3 exist and were not read — silently returning less is the
    // failure mode this guards.
    expect(result.summary.totalPages).toBe(3)
    expect(result.summary.pagesExtracted).toBe(1)
    expect(result.summary.truncated).toBe(true)
    expect(result.summary.truncatedBy).toContain('document_text_cap')
  })

  it('reports no truncation when nothing was clipped', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Short enough' }] })
    const result = expectOk(await extractDocumentText(pdf))

    expect(result.summary.truncated).toBe(false)
    expect(result.summary.truncatedBy).toEqual([])
    expect(result.pages.every((page) => !page.truncated)).toBe(true)
  })

  it('lets a caller tighten a cap but never loosen one', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Bounded work is the promise' }] })

    // Asking for more than the module promises is silently clamped to the
    // exported ceiling — the constants are the contract, not a default.
    const loosened = expectOk(
      await extractDocumentText(pdf, {
        maxBytes: MAX_DOCUMENT_BYTES * 100,
        maxPages: MAX_DOCUMENT_PAGES * 100,
        maxPageTextChars: MAX_PAGE_TEXT_CHARS * 100,
        maxTotalTextChars: MAX_DOCUMENT_TEXT_CHARS * 100,
      }),
    )
    expect(loosened.pages[0]!.text).toBe('Bounded work is the promise')
    expect(loosened.summary.truncated).toBe(false)

    // Tightening is honoured.
    const tightened = await extractDocumentText(pdf, { maxBytes: 10 })
    expect(tightened.ok).toBe(false)
    if (tightened.ok) return
    expect(tightened.reason).toBe('too_large')
    // …and the message quotes the cap that ACTUALLY fired, in a unit that
    // matches its size. Asserting the right figure, not merely the absence of
    // one wrong figure: "not 25 MB" would still pass on "1 MB", which is what a
    // caller who tightened to 10 bytes used to be told.
    expect(tightened.message).toContain('larger than the 10 bytes limit')

    const fewPages = await extractDocumentText(
      buildSyntheticPdf({ pages: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }),
      { maxPages: 2 },
    )
    expect(fewPages.ok).toBe(false)
    if (fewPages.ok) return
    expect(fewPages.reason).toBe('too_many_pages')
    expect(fewPages.message).toContain('more than 2 pages')
  })

  it('exports caps as constants a host can reconcile against its own limits', () => {
    for (const value of [MAX_DOCUMENT_BYTES, MAX_DOCUMENT_PAGES, MAX_PAGE_TEXT_CHARS, MAX_DOCUMENT_TEXT_CHARS]) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
    expect(MAX_DOCUMENT_TEXT_CHARS).toBeGreaterThanOrEqual(MAX_PAGE_TEXT_CHARS)
  })
})

describe('extractDocumentText — local-only, worker-free', () => {
  it('runs pdfjs on the main thread instead of spawning a worker', async () => {
    // The worker-free proof: pdfjs consults `globalThis.pdfjsWorker` before it
    // would construct a Worker, and importing the worker module on the main
    // thread is what puts it there. If this ever stops being set, pdfjs would
    // try to load a separately hosted worker asset — which is exactly what
    // this module must not require of a host.
    await extractDocumentText(buildSyntheticPdf({ pages: [{ text: 'main thread' }] }))
    const handler = (globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker
    expect(handler?.WorkerMessageHandler).toBeDefined()
  })

  it('is published by the exports map as ./document-text → this module', () => {
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { exports: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }> }
    expect(packageJson.exports['./document-text']).toBe('./src/import/documentText.ts')
  })

  it('declares pdfjs-dist as an OPTIONAL peer so consumers that never import it pay nothing', () => {
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as {
      peerDependencies?: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
      devDependencies?: Record<string, string>
    }
    expect(packageJson.peerDependencies?.['pdfjs-dist']).toBeTruthy()
    expect(packageJson.peerDependenciesMeta?.['pdfjs-dist']?.optional).toBe(true)
    // …and a devDependency, so this repo's typecheck and tests can resolve it.
    expect(packageJson.devDependencies?.['pdfjs-dist']).toBeTruthy()
  })

  it('never hands pdfjs a URL to fetch — the document is always bytes', () => {
    const source = readFileSync(fileURLToPath(new URL('./documentText.ts', import.meta.url)), 'utf8') as string
    // Every pdfjs option that names a fetchable location is a way back onto
    // the network; none may ever be configured here. Local processing is a
    // product promise, so it gets a guard rather than a comment.
    for (const option of ['url', 'docBaseUrl', 'cMapUrl', 'standardFontDataUrl', 'iccUrl', 'wasmUrl']) {
      expect(source, `${option} must never be passed to getDocument`).not.toMatch(
        new RegExp(`^\\s*${option}\\s*:`, 'm'),
      )
    }
    expect(source).toMatch(/useWorkerFetch:\s*false/)
    expect(source).toMatch(/useSystemFonts:\s*false/)
    expect(source).toMatch(/disableFontFace:\s*true/)
  })
})

describe('buildSyntheticPdf', () => {
  it('emits bytes that start with a PDF header and end with %%EOF', () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'hello' }] })
    const text = new TextDecoder().decode(pdf)
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('escapes parentheses so a fixture cannot corrupt its own content stream', async () => {
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Roth IRA (rollover)' }] })
    const result = expectOk(await extractDocumentText(pdf))
    expect(result.pages[0]!.text).toBe('Roth IRA (rollover)')
  })

  it('can emit something that is not a PDF at all', async () => {
    const notPdf = buildSyntheticPdf({ pages: [{ text: 'hi' }], header: '%NOPE-1.7' })
    const result = await extractDocumentText(notPdf)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('not_pdf')
  })

  it('throws on non-ASCII fixture text — a test bug, not a data condition', () => {
    expect(() => buildSyntheticPdf({ pages: [{ text: 'smart “quotes”' }] })).toThrow(/ASCII/)
  })

  it('lays out successive lines down the page and keeps them in order', async () => {
    const pdf = buildSyntheticPdf({
      pages: [{ lines: ['Statement of position', '', 'Account number ****4417', 'Total value $128,450.22'] }],
    })
    const result = expectOk(await extractDocumentText(pdf))
    // A blank line advances the baseline without drawing anything, so it
    // shapes the page without appearing in the text layer.
    expect(result.pages[0]!.text).toBe(
      'Statement of position\nAccount number ****4417\nTotal value $128,450.22',
    )
  })

  it('separates columns that are set apart and runs together columns that are not', async () => {
    // This is not a quirk of the emitter — it is pdfjs deciding whether the
    // horizontal gap between two runs warrants a space, and it is why the
    // accuracy benchmark can reproduce the over-tight-table artifact at all.
    const spaced = buildSyntheticPdf({
      pages: [{ fontSize: 10, lines: [[{ x: 72, text: 'Roth IRA' }, { x: 300, text: '****4417' }]] }],
    })
    expect(expectOk(await extractDocumentText(spaced)).pages[0]!.text).toBe('Roth IRA ****4417')

    const abutting = buildSyntheticPdf({
      pages: [{ fontSize: 10, lines: [[{ x: 72, text: 'Roth IRA' }, { x: 110, text: '****4417' }]] }],
    })
    expect(expectOk(await extractDocumentText(abutting)).pages[0]!.text).toBe('Roth IRA****4417')
  })
})
