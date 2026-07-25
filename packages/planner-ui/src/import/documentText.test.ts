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
  type HostPdfjsModule,
} from './documentText'
import { buildSyntheticPdf } from './pdfFixtures'

/** Narrow to the success arm, failing loudly (with the reason) when it isn't. */
function expectOk(result: Awaited<ReturnType<typeof extractDocumentText>>) {
  if (!result.ok) throw new Error(`expected success, got ${result.reason}: ${result.message}`)
  return result
}

/** Narrow to the failure arm, so a reason can be asserted without a bare `if`. */
function expectFailed(result: Awaited<ReturnType<typeof extractDocumentText>>) {
  if (result.ok) throw new Error('expected a failure result, got a successful extraction')
  return result
}

/** This module's own source, for the assertions that are about what it says. */
function readSource(): string {
  return readFileSync(fileURLToPath(new URL('./documentText.ts', import.meta.url)), 'utf8') as string
}

// ---------------------------------------------------------------------------
// An instrumented pdfjs build.
//
// Some conditions cannot be reached through the bytes of a document: a page
// that pdfjs fails on halfway through a readable file, a RangeError raised by
// the reader rather than by the file, a host that supplies a differently
// shaped pdfjs. The peer is imported dynamically, so `vi.doMock` can stand a
// controllable one in its place — the same lever the peer-missing test already
// pulls — and drive those paths directly.
// ---------------------------------------------------------------------------

interface FakeGlyphItem {
  readonly str: string
  readonly hasEOL?: boolean
}

interface FakePdfPage {
  /** Called per `getTextContent`; may be lazy, so consumption can be counted. */
  readonly items?: () => Iterable<FakeGlyphItem>
  /**
   * Serve the page through pdfjs's STREAMING text API, one batch per chunk,
   * pulled on demand. A page with `chunks` also answers `getTextContent`, the
   * way a real build does — by materializing every chunk first, which is exactly
   * the cost the streaming path exists to avoid.
   */
  readonly chunks?: () => Iterable<readonly FakeGlyphItem[]>
  /** Put an image paint operator in the page's operator list. */
  readonly imagePainted?: boolean
  /** Which raster operator pdfjs chose for this page; defaults to the plain one. */
  readonly paintOp?: number
  /** Reject `getTextContent` — the page pdfjs cannot read. */
  readonly failWith?: unknown
}

interface FakePdfjsSpec {
  readonly pages?: readonly FakePdfPage[]
  /** Reject the loading task's promise: a document-level failure. */
  readonly documentError?: unknown
  /** Throw synchronously out of `getDocument`, as a mismatched build would. */
  readonly getDocumentThrows?: unknown
  /** Ship a build with no `VerbosityLevel`, as a different major might. */
  readonly omitVerbosityLevel?: boolean
}

const IMAGE_PAINT_OP = 85
/** A raster painted through one of pdfjs's grouped/optimized operators. */
const GROUPED_PAINT_OP = 89

/**
 * A page's text as pdfjs's `streamTextContent` serves it: a real
 * `ReadableStream` whose chunks are produced on demand, so what the reader never
 * asks for is never built.
 *
 * `cancel` THROWS, mirroring pdfjs 6.1.200 — whose `reader.cancel()` rejects and
 * whose own bookkeeping then raises an unhandled rejection. A reader that
 * cancels this stream unguarded fails the page, which is the point: the result
 * a page has already decided may never be replaced by the way it let go.
 *
 * **What this fake CANNOT show, and why the real-pdfjs tests at the bottom of
 * this file exist.** Nothing here waits on the reader: `pull` produces a chunk
 * whenever one is asked for and nothing is pending when nobody asks again, and
 * the fake's `destroy` resolves immediately. So walking away from this stream
 * costs nothing — while walking away from pdfjs's own leaves its producer
 * awaiting a sink that will never drain, and `loadingTask.destroy()` waiting on
 * that producer, so the call never settles at all. Every "the caps bound the
 * work" assertion below was written against this fake, which is exactly how a
 * deadlock shipped past a full green suite.
 */
function fakeTextStream(chunks: () => Iterable<readonly FakeGlyphItem[]>): ReadableStream {
  const batches = chunks()[Symbol.iterator]()
  return new ReadableStream({
    pull(controller) {
      const next = batches.next()
      if (next.done === true) controller.close()
      else controller.enqueue({ items: next.value })
    },
    cancel() {
      throw new Error('pdfjs rejects a text-stream cancel')
    },
  })
}

function fakePdfjs(spec: FakePdfjsSpec): Record<string, unknown> {
  const pages = spec.pages ?? []
  const makePage = (page: FakePdfPage) => ({
    ...(page.chunks === undefined ? {} : { streamTextContent: () => fakeTextStream(page.chunks!) }),
    getTextContent: () => {
      if (page.failWith !== undefined) return Promise.reject(page.failWith)
      // A real `getTextContent` materializes the whole page before it resolves;
      // a chunked page reproduces that so the cost of taking this path is
      // observable to a test that counts what was built.
      const items = page.chunks === undefined ? (page.items?.() ?? []) : [...page.chunks()].flat()
      return Promise.resolve({ items })
    },
    getOperatorList: () =>
      Promise.resolve({ fnArray: page.imagePainted ? [page.paintOp ?? IMAGE_PAINT_OP] : [] }),
    cleanup: () => undefined,
  })
  const module: Record<string, unknown> = {
    OPS: {
      paintImageXObject: IMAGE_PAINT_OP,
      paintImageXObjectRepeat: 86,
      paintInlineImageXObject: 87,
      paintImageMaskXObject: 88,
      // The grouped/optimized variants a real pdfjs also emits. Their absence
      // here is what let a scanned page painted with one read as blank.
      paintInlineImageXObjectGroup: GROUPED_PAINT_OP,
      paintImageMaskXObjectGroup: 90,
      paintImageMaskXObjectRepeat: 91,
      paintSolidColorImageMask: 92,
    },
    getDocument: () => {
      if (spec.getDocumentThrows !== undefined) throw spec.getDocumentThrows
      return {
        promise:
          spec.documentError === undefined
            ? Promise.resolve({
                numPages: pages.length,
                getPage: (pageNumber: number) => Promise.resolve(makePage(pages[pageNumber - 1]!)),
              })
            : Promise.reject(spec.documentError),
        destroy: () => Promise.resolve(),
      }
    },
  }
  if (!spec.omitVerbosityLevel) module.VerbosityLevel = { ERRORS: 0 }
  return module
}

/** Real PDF bytes, so every pre-parse check passes; the fake ignores them. */
const REAL_PDF_BYTES = buildSyntheticPdf({ pages: [{ text: 'the fake pdfjs decides what this says' }] })

async function extractWith(
  spec: FakePdfjsSpec,
  opts?: Parameters<typeof extractDocumentText>[1],
): Promise<Awaited<ReturnType<typeof extractDocumentText>>> {
  vi.resetModules()
  vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => fakePdfjs(spec))
  const { extractDocumentText: extract } = await import('./documentText')
  return extract(REAL_PDF_BYTES, opts)
}

/** An error carrying a pdfjs exception's `name`, which is how they are read. */
function named(name: string, message: string): Error {
  return Object.assign(new Error(message), { name })
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
    expect(result.summary.unreadablePages).toEqual([])
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
    // …and the document-level signal makes the same distinction. See the
    // dedicated test below: `noTextExtracted` is the needs-OCR signal, and
    // there is nothing on a blank page for an OCR pass to recover.
    expect(result.summary.noTextExtracted).toBe(false)
  })

  it('does not send a blank document to OCR — nothing there is recoverable', async () => {
    // Every page blank: no text anywhere, and every page `imageOnly: false`.
    // `noTextExtracted` used to be true of exactly this, because "no page had
    // text" was the whole test — so a stack of separator pages was reported as
    // "fully scanned, needs OCR" when there is no ink on it at all. The flag
    // documents itself as the needs-OCR signal, so it may only fire where OCR
    // could actually recover something.
    const result = expectOk(await extractDocumentText(buildSyntheticPdf({ pages: [{}, {}, {}] })))

    expect(result.summary.totalPages).toBe(3)
    expect(result.summary.pagesExtracted).toBe(3)
    expect(result.summary.imageOnlyPages).toBe(0)
    expect(result.summary.totalTextChars).toBe(0)
    expect(result.summary.noTextExtracted).toBe(false)
    // The document is still fully described: three pages, read, all empty.
    expect(result.pages.every((page) => page.text === '' && !page.imageOnly)).toBe(true)

    // …and one scanned page among the blanks is enough to make it true again:
    // narrowing the flag must not have blunted the signal it exists for.
    const mixed = expectOk(await extractDocumentText(buildSyntheticPdf({ pages: [{}, { image: true }] })))
    expect(mixed.summary.imageOnlyPages).toBe(1)
    expect(mixed.summary.noTextExtracted).toBe(true)
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

  it('survives the caller transferring the buffer while the call is in flight', async () => {
    // The owned copy used to be taken only AFTER `await loadPdfjs()`. A caller
    // that transfers the buffer once the call has handed back its promise — a
    // `structuredClone(buffer, { transfer })`, a worker handoff — left that later
    // copy wrapping a now-DETACHED view, which throws a TypeError straight out of
    // the result union this module promises, past every reason in the vocabulary.
    // The snapshot has to be taken before the first await, not merely before the
    // parse.
    const pdf = buildSyntheticPdf({ pages: [{ text: 'Transferred mid-flight' }] })
    const live = new Uint8Array(pdf) // its own buffer, so the transfer detaches only this
    const pending = extractDocumentText(live)
    // Synchronously after the call, while it is parked on its first await.
    structuredClone(live.buffer, { transfer: [live.buffer] })
    expect(live.byteLength).toBe(0) // detached out from under the call

    const result = expectOk(await pending)
    expect(result.pages[0]!.text).toBe('Transferred mid-flight')
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

describe('extractDocumentText — which raster operator pdfjs chose', () => {
  afterEach(() => {
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.mjs')
  })

  it('detects a scan whichever raster operator pdfjs chose for it', async () => {
    // Which operator carries the raster is an internal pdfjs optimization — it
    // groups repeated masks, batches inline images, folds a single-colour mask
    // into its own operator. Recognising only the plain ones made the OCR signal
    // depend on the file's encoding, and the failure direction is the bad one:
    // a scanned page reported as blank tells the user their statement is empty.
    const grouped = expectOk(
      await extractWith({ pages: [{ imagePainted: true, paintOp: GROUPED_PAINT_OP }] }),
    )
    expect(grouped.pages[0]!.imageOnly).toBe(true)
    expect(grouped.summary.imageOnlyPages).toBe(1)
    expect(grouped.summary.noTextExtracted).toBe(true)

    // The plain operator still works, and a page with no raster at all is still
    // blank rather than scanned.
    const plain = expectOk(await extractWith({ pages: [{ imagePainted: true }] }))
    expect(plain.pages[0]!.imageOnly).toBe(true)
    const empty = expectOk(await extractWith({ pages: [{ items: () => [] }] }))
    expect(empty.pages[0]!.imageOnly).toBe(false)
    expect(empty.summary.noTextExtracted).toBe(false)
  })

  it('honours a legacy operator an older host build emits', async () => {
    // pdfjs 6 has no paintJpegXObject — a JPEG XObject is decoded and painted as
    // an ordinary paintImageXObject there. But the peer is host-supplied, and an
    // older build a host pins does emit it, so it is recognised when present.
    const host = fakePdfjs({ pages: [{ imagePainted: true, paintOp: 93 }] })
    ;(host['OPS'] as Record<string, number>)['paintJpegXObject'] = 93
    const result = expectOk(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: host }))
    expect(result.pages[0]!.imageOnly).toBe(true)
    expect(result.summary.noTextExtracted).toBe(true)
  })

  it('accepts a build missing the optimized operators rather than calling it incompatible', async () => {
    // The grouped variants have come and gone across pdfjs versions. A build
    // without one is usable; refusing it would report a working pdfjs as broken.
    const host = fakePdfjs({ pages: [{ imagePainted: true }] })
    const ops = host['OPS'] as Record<string, number>
    for (const op of [
      'paintInlineImageXObjectGroup',
      'paintImageMaskXObjectGroup',
      'paintImageMaskXObjectRepeat',
      'paintSolidColorImageMask',
    ]) {
      delete ops[op]
    }
    const result = expectOk(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: host }))
    expect(result.pages[0]!.imageOnly).toBe(true)
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

  it('still says "not installed" when a loader reports the failure only as a code', async () => {
    // The half of the split that must keep working. Node names an unresolvable
    // specifier with `ERR_MODULE_NOT_FOUND` and a bundler's loader wraps whatever
    // it likes around it, so the code is looked for down the `cause` chain as well
    // as the message — a message this one deliberately does not carry.
    vi.resetModules()
    vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => {
      throw Object.assign(new Error('nothing here to read'), { code: 'ERR_MODULE_NOT_FOUND' })
    })

    const { extractDocumentText: extract } = await import('./documentText')
    const result = expectFailed(await extract(buildSyntheticPdf({ pages: [{ text: 'Statement' }] })))

    expect(result.reason).toBe('pdfjs_unavailable')
    expect(result.message).toMatch(/is not installed/i)
  })

  it('does not tell a host to install a package it HAS when that copy will not evaluate', async () => {
    // A peer that RESOLVES and then throws while it evaluates — a fault at module
    // scope, a runtime below its engine floor — came back as `pdfjs_unavailable`,
    // telling a host to install a package it already installed. Each reason has to
    // point at a different fix, and "npm install pdfjs-dist" is not this one's:
    // the build present is not one this module can drive, which is what
    // `pdfjs_incompatible` already says.
    vi.resetModules()
    vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => {
      throw new RangeError('pdfjs-dist requires a newer runtime than this one')
    })

    const { extractDocumentText: extract } = await import('./documentText')
    const result = expectFailed(await extract(buildSyntheticPdf({ pages: [{ text: 'Statement' }] })))

    expect(result.reason).toBe('pdfjs_incompatible')
    expect(result.reason).not.toBe('pdfjs_unavailable')
    expect(result.message).not.toMatch(/is not installed/i)
    expect(result.message).toContain('pdfjs-dist')
    expect(result.message).toMatch(/[.!]$/)
  })

  it('names BOTH remedies in EVERY browser engine, not only the one Chromium words', async () => {
    // Two things at once, because they are the same sentence.
    //
    // The message used to say only "the optional pdfjs-dist package is not
    // installed". In a browser bundle that is a fix that cannot work: the
    // package may be installed already and the page still cannot resolve a bare
    // npm specifier at run time. The other remedy — `options.pdfjs` — is the
    // only one that works there, so it has to be in the one sentence a UI shows.
    //
    // And a browser supplies no `error.code` at all, so the WORDING alone
    // decides which reason is chosen. Only Chromium's phrasing matched, so a
    // Firefox or Safari host that had installed nothing was told
    // `pdfjs_incompatible` — "the installed pdfjs-dist build is not one this app
    // can use" — a false sentence about a package that is not installed, and one
    // that never shows the remedy that works. These are each engine's real text
    // for an unresolvable bare specifier.
    const wordings = [
      ['Chromium', "Failed to resolve module specifier 'pdfjs-dist/legacy/build/pdf.mjs'"],
      [
        'Firefox',
        'The specifier “pdfjs-dist/legacy/build/pdf.mjs” was a bare specifier, but was not remapped to anything.',
      ],
      ['Safari', "Module name, 'pdfjs-dist/legacy/build/pdf.mjs' does not resolve to a valid URL."],
      ['any engine, when it blames the script', 'Importing a module script failed.'],
    ] as const

    for (const [engine, message] of wordings) {
      vi.resetModules()
      vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => {
        throw new Error(message)
      })

      const { extractDocumentText: extract } = await import('./documentText')
      const result = expectFailed(await extract(REAL_PDF_BYTES))

      expect(result.reason, `${engine}: ${message}`).toBe('pdfjs_unavailable')
      expect(result.message, engine).toMatch(/is not installed/i)
      expect(result.message, engine).toMatch(/options\.pdfjs/)
      expect(result.message, engine).toMatch(/[.!]$/)
      // …and never the sentence that describes a build the host does have.
      expect(result.message, engine).not.toMatch(/is not one this app can use/i)
    }
  })

  it('imports the peer through a specifier a bundler will not resolve at build time', async () => {
    // A LITERAL specifier is resolved by Vite and Rollup during dependency
    // scanning, so a host that never installs the optional peer fails to BUILD —
    // before `extractDocumentText` could ever return `pdfjs_unavailable`. This
    // package ships source for Vite-class bundlers, so a literal defeats the
    // optional-peer design for exactly its target consumers.
    const source = readSource()
    // `typeof import(...)` is a TYPE position and is erased before any bundler
    // sees it; only a value-position `import()` is a build-time resolution.
    expect(source).not.toMatch(/(?<!typeof )import\(\s*['"]pdfjs-dist/)
    expect(source).toMatch(/@vite-ignore/)

    // …and deferring resolution has not broken it: this repo's own run resolves
    // the peer through the same indirect specifier.
    const ok = expectOk(await extractDocumentText(buildSyntheticPdf({ pages: [{ text: 'resolved at run time' }] })))
    expect(ok.pages[0]!.text).toBe('resolved at run time')
  })
})

describe('extractDocumentText — the host supplies pdfjs (the browser path)', () => {
  afterEach(() => {
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.mjs')
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.worker.mjs')
    vi.resetModules()
  })

  it('uses the module the host passes and never reaches for one itself', async () => {
    // Making the specifier opaque to a bundler bought the BUILD and lost the
    // browser: a bare `pdfjs-dist/...` specifier survives into the bundle, and
    // no browser can resolve an npm package name at run time — so a host that
    // installed the peer got `pdfjs_unavailable` at the first extraction. The
    // host's own `import('pdfjs-dist/legacy/build/pdf.mjs')` IS resolved, by
    // its own bundler, so the host hands the module in.
    //
    // Both specifiers are mocked to fail the way a browser fails them, and the
    // import is counted: with a module supplied, this module must not attempt
    // either import at all — reaching for one is what breaks in the browser.
    let importsAttempted = 0
    const unresolvable = (): never => {
      importsAttempted += 1
      throw new Error("Failed to resolve module specifier 'pdfjs-dist'")
    }
    vi.resetModules()
    vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', unresolvable)
    vi.doMock('pdfjs-dist/legacy/build/pdf.worker.mjs', unresolvable)

    const { extractDocumentText: extract } = await import('./documentText')
    const hostPdfjs = fakePdfjs({
      pages: [{ items: () => [{ str: 'read through the host-supplied build' }] }, { imagePainted: true }],
    })
    const result = expectOk(await extract(REAL_PDF_BYTES, { pdfjs: hostPdfjs }))

    expect(result.pages[0]!.text).toBe('read through the host-supplied build')
    expect(result.pages[1]!.imageOnly).toBe(true)
    expect(result.summary.totalPages).toBe(2)
    expect(importsAttempted).toBe(0)

    // …and the same host, on the same bundle, without passing it: the honest
    // failure, not a throw.
    const without = expectFailed(await extract(REAL_PDF_BYTES))
    expect(without.reason).toBe('pdfjs_unavailable')
    expect(importsAttempted).toBeGreaterThan(0)
  })

  it('blames the host build, not the document, for a supplied module of the wrong shape', async () => {
    // A host may pass anything — the wrong module, a CJS interop wrapper, a
    // stub. The existing shape check has to catch it BEFORE a byte is parsed,
    // so it lands on `pdfjs_incompatible` rather than crashing out of the
    // result union or blaming the user's file.
    const wrong = { getDocument: 'not a function' } as unknown as HostPdfjsModule
    const result = expectFailed(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: wrong }))

    expect(result.reason).toBe('pdfjs_incompatible')
    expect(result.reason).not.toBe('corrupt')
    expect(result.message).not.toMatch(/damaged|partly downloaded/i)
    expect(result.message).toMatch(/[.!]$/)

    // An object with nothing on it at all is the same answer, not an exception.
    const empty = expectFailed(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: {} as HostPdfjsModule }))
    expect(empty.reason).toBe('pdfjs_incompatible')
  })

  it('still takes the zero-config import path when no module is supplied', async () => {
    // The convenience half of the design: in Node, SSR, and an Electron main
    // process a bare specifier DOES resolve, and this repo's own tests and
    // benchmark depend on it. Injection must not have become mandatory.
    const ok = expectOk(await extractDocumentText(buildSyntheticPdf({ pages: [{ text: 'no injection needed' }] })))
    expect(ok.pages[0]!.text).toBe('no injection needed')
  })

  it('drives the REAL pdfjs through the injected path, not only a hand-written fake', async () => {
    // Every other test on this path passes a fake, so the only thing that ever
    // reached the injected code with a real pdfjs was… nothing. A shape check
    // this module might add, or an option it might come to require, that the
    // fake satisfies and pdfjs 6 does not would pass the whole suite and fail
    // every browser host — the ONLY hosts that take this path. The peer is
    // already a devDependency, so injecting the genuine article costs one
    // import. (The worker module is not imported here on purpose: this is the
    // real injected-path configuration a browser host would have, and in Node
    // pdfjs disables the worker on its own — which is precisely why a missing
    // one is not refused up front.)
    const realPdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as HostPdfjsModule
    const pdf = buildSyntheticPdf({
      pages: [{ text: 'Injected pdfjs read this line' }, { image: true }, { text: '' }],
    })
    const ok = expectOk(await extractDocumentText(pdf, { pdfjs: realPdfjs }))

    expect(ok.pages[0]!.text).toBe('Injected pdfjs read this line')
    expect(ok.pages[1]!.imageOnly).toBe(true)
    expect(ok.pages[2]!.text).toBe('')
    expect(ok.pages[2]!.imageOnly).toBe(false)
    expect(ok.summary.totalPages).toBe(3)
    expect(ok.summary.unreadablePages).toEqual([])

    // …and the caps behave the same way against the real build as against the
    // fake, which is the other thing a fake alone cannot promise.
    const capped = expectOk(await extractDocumentText(pdf, { pdfjs: realPdfjs, maxPageTextChars: 8 }))
    expect(capped.pages[0]!.text).toBe('Injected')
    expect(capped.summary.truncatedBy).toContain('page_text_cap')
  })
})

describe('extractDocumentText — an injected pdfjs that has no main-thread worker', () => {
  // The worker-free guarantee rests on THIS module importing `pdf.worker.mjs`
  // for its side effect (`globalThis.pdfjsWorker`). On the injected path that
  // import never runs, so a browser host that passed only `pdf.mjs` has pdfjs
  // hunting for a worker asset. The README warned about it; the code has to
  // NAME it, because the reason a UI shows is the only thing that host sees.
  //
  // Not refused up front: an unset `globalThis.pdfjsWorker` is normal in Node
  // and in an Electron main process, and a host that hosts the worker asset and
  // sets `GlobalWorkerOptions.workerSrc` is configured correctly too. What is
  // recognised is pdfjs SAYING it could not get a worker — in its own words,
  // both of which are quoted from pdfjs 6.1.200.

  it('reports the worker reason for the synchronous "no workerSrc" throw', async () => {
    // pdfjs builds its PDFWorker inside `getDocument`, before it returns the
    // loading task, so this one is thrown synchronously — where this module
    // used to answer `pdfjs_incompatible`, blaming a build that is fine.
    const noWorker = fakePdfjs({})
    noWorker.getDocument = () => {
      throw new Error('No "GlobalWorkerOptions.workerSrc" specified.')
    }
    const result = expectFailed(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: noWorker }))

    expect(result.reason).toBe('pdfjs_worker_unavailable')
    expect(result.reason).not.toBe('pdfjs_incompatible')
    // The remedy is the host's own import, not an install and not a different
    // build — and not this module's worker import, which never ran.
    expect(result.message).toMatch(/pdf\.worker\.mjs/)
    expect(result.message).not.toMatch(/main-thread worker module could not be loaded/)
    expect(result.message).not.toMatch(/damaged|partly downloaded/i)
    expect(result.message).toMatch(/[.!]$/)
  })

  it('reports the worker reason when pdfjs fails later, setting up its fallback', async () => {
    // The other wording, and the other arrival: pdfjs's main-thread fallback
    // imports the worker module itself and rejects the loading task when that
    // fails. `extraction_failed` used to answer this with "the document itself
    // may be perfectly fine — try again", and trying again cannot supply a
    // module the host never imported.
    const failing = fakePdfjs({
      documentError: new Error('Setting up fake worker failed: "Cannot load script ./pdf.worker.mjs".'),
    })
    const result = expectFailed(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: failing }))

    expect(result.reason).toBe('pdfjs_worker_unavailable')
    expect(result.reason).not.toBe('extraction_failed')
    expect(result.message).toMatch(/pdf\.worker\.mjs/)
    expect(result.message).not.toMatch(/try again/i)
  })

  it('does not claim the worker for every failure a supplied build can raise', async () => {
    // The classification is narrow on purpose: a build that rejects the
    // parameter object, and a document that really is damaged, must keep the
    // reasons they had. A matcher that swallowed those would trade one wrong
    // sentence for another.
    const rejecting = fakePdfjs({ getDocumentThrows: new TypeError('unsupported parameter object') })
    expect(expectFailed(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: rejecting })).reason).toBe(
      'pdfjs_incompatible',
    )

    const damaged = fakePdfjs({ documentError: named('InvalidPDFException', 'Invalid PDF structure.') })
    expect(expectFailed(await extractDocumentText(REAL_PDF_BYTES, { pdfjs: damaged })).reason).toBe('corrupt')
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

  it('documents BOTH of the causes that really set DocumentPage.truncated', async () => {
    // The doc comment is part of a stability-promised surface, so it is held to
    // the same standard as the code: it said "MAX_PAGE_TEXT_CHARS clipped this
    // page's text" while the DOCUMENT cap set the same flag, which is a false
    // description of the flag a consumer branches on.
    //
    // First the behaviour it has to describe — no per-page cap in play at all,
    // and the flag is still set:
    const pdf = buildSyntheticPdf({ pages: [{ text: 'First page text' }] })
    const clipped = expectOk(await extractDocumentText(pdf, { maxTotalTextChars: 5 }))
    expect(clipped.pages[0]!.truncated).toBe(true)
    expect(clipped.summary.truncatedBy).toEqual(['document_text_cap'])
    expect(clipped.summary.truncatedBy).not.toContain('page_text_cap')

    // …and then the sentence, which has to name both causes.
    const source = readSource()
    const shape = source.slice(
      source.indexOf('interface DocumentPage'),
      source.indexOf('export type DocumentTextTruncation'),
    )
    const field = shape.indexOf('readonly truncated: boolean')
    const doc = shape.slice(shape.lastIndexOf('/**', field), field)
    expect(doc).toContain('MAX_PAGE_TEXT_CHARS')
    expect(doc).toContain('MAX_DOCUMENT_TEXT_CHARS')
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
    const source = readSource()
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

describe('extractDocumentText — the caps bound the work, not just the answer', () => {
  afterEach(() => {
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.mjs')
    vi.resetModules()
  })

  it('stops reading a page once the cap is satisfied instead of concatenating all of it', async () => {
    // The caps used to be applied to a string that had already been built:
    // every text item on the page was concatenated, THEN sliced. That bounds
    // the retained text and nothing else — the intermediate is as large as the
    // page, on the calling thread this module deliberately runs pdfjs on, so
    // the module header's claim that "the caps below are what keep that
    // bounded" was not true of memory. This page offers a megabyte in a
    // thousand items behind a 50-character cap.
    let itemsRead = 0
    let charsOffered = 0
    const result = await extractWith(
      {
        pages: [
          {
            items: function* () {
              for (let index = 0; index < 1000; index++) {
                itemsRead += 1
                charsOffered += 1000
                yield { str: 'x'.repeat(1000) }
              }
            },
          },
        ],
      },
      { maxPageTextChars: 50 },
    )

    // A handful of items is all 50 characters can possibly need. Before the
    // fix this read all 1000 and held 1,000,000 characters at once.
    expect(itemsRead).toBeLessThanOrEqual(2)
    expect(charsOffered).toBeLessThanOrEqual(2000)

    // …and the answer is exactly what the concatenating version produced.
    const ok = expectOk(result)
    expect(ok.pages[0]!.text).toBe('x'.repeat(50))
    expect(ok.pages[0]!.truncated).toBe(true)
    expect(ok.summary.truncatedBy).toContain('page_text_cap')
    expect(ok.summary.totalTextChars).toBe(50)
    // The signals decided from the PRE-truncation text survive the early exit:
    // a page cut short after one item still had a text layer, so it is neither
    // image-only nor evidence that the document needs OCR.
    expect(ok.pages[0]!.imageOnly).toBe(false)
    expect(ok.summary.noTextExtracted).toBe(false)
  })

  it('takes the page through the STREAMING text API so the whole page is never held', async () => {
    // Stopping early inside `getTextContent().items` bounds the ITERATION and
    // nothing else: pdfjs has already built the complete items array, with all its
    // strings, before that array is handed over. A content stream that decompresses
    // to a megabyte of glyphs sits well inside the 25 MB byte cap and the page cap,
    // so nothing refuses it and it materializes in full — on the calling thread this
    // module deliberately runs pdfjs on. Streaming is what keeps this module's own
    // peak to one batch plus a capped string.
    //
    // Two different quantities, because they now have two different answers. The
    // stream is DRAINED, so every chunk is produced — abandoning pdfjs's stream is
    // what deadlocks the call (see the real-pdfjs tests at the bottom of this
    // file). What must stop at the cap is the ACCUMULATING, so the items are
    // counted as they are inspected: each item's `str` is a getter, and reading it
    // is exactly the moment this module looks at a glyph it might keep.
    let chunksProduced = 0
    let itemsInspected = 0
    const bigItem = (): FakeGlyphItem =>
      ({
        get str() {
          itemsInspected += 1
          return 'x'.repeat(1000)
        },
      }) as FakeGlyphItem
    const result = await extractWith(
      {
        pages: [
          {
            chunks: function* () {
              for (let index = 0; index < 1000; index++) {
                chunksProduced += 1
                yield [bigItem()]
              }
            },
          },
        ],
      },
      { maxPageTextChars: 50 },
    )

    // Every chunk was read to the end — and exactly once. The fake's
    // `getTextContent` materializes the same generator, so a second thousand
    // would be the signature of the whole page having been built after all.
    expect(chunksProduced).toBe(1000)
    // One item settles all 50 characters: `isGlyphItem` looks at its `str` and
    // then the accumulator takes it. Nothing after it is ever opened, however
    // many chunks go past.
    expect(itemsInspected).toBeLessThanOrEqual(2)

    // …and the answer is exactly what materializing the whole page produced. The
    // fake's stream REJECTS on cancel, as pdfjs 6 does, so a result reaching here
    // at all is also the proof that letting go of the stream cannot replace it.
    const ok = expectOk(result)
    expect(ok.pages[0]!.text).toBe('x'.repeat(50))
    expect(ok.pages[0]!.truncated).toBe(true)
    expect(ok.summary.truncatedBy).toContain('page_text_cap')
    expect(ok.summary.totalTextChars).toBe(50)
    // The signals decided from the PRE-truncation text survive the early exit: a
    // page cut short after one chunk still had a text layer.
    expect(ok.pages[0]!.imageOnly).toBe(false)
    expect(ok.summary.noTextExtracted).toBe(false)
  })

  it('stops accumulating at the EFFECTIVE budget when the document cap is tighter', async () => {
    // The retained text was correctly limited to what the document budget had
    // left, but accumulating kept going until the PAGE cap was passed — so a
    // caller asking for 10 characters of a document still had this module
    // inspect and copy up to MAX_PAGE_TEXT_CHARS of that page. Every document
    // nearly out of its total budget pays that on its last page.
    let chunksProduced = 0
    let itemsInspected = 0
    const bigItem = (): FakeGlyphItem =>
      ({
        get str() {
          itemsInspected += 1
          return 'x'.repeat(1000)
        },
      }) as FakeGlyphItem
    const result = await extractWith(
      {
        pages: [
          {
            chunks: function* () {
              for (let index = 0; index < 1000; index++) {
                chunksProduced += 1
                yield [bigItem()]
              }
            },
          },
        ],
      },
      { maxTotalTextChars: 10 },
    )

    // Read to the end, as the stream must be; opened only until the 10
    // characters were settled. Before the fix 101 chunks were inspected and
    // 101,000 characters copied, to keep 10.
    expect(chunksProduced).toBe(1000)
    expect(itemsInspected).toBeLessThanOrEqual(2)

    // …and the answer, and the attribution, are exactly what they were: the
    // DOCUMENT cap clipped this, and the page cap — which never fired — is not
    // credited with it.
    const ok = expectOk(result)
    expect(ok.pages[0]!.text).toBe('x'.repeat(10))
    expect(ok.pages[0]!.truncated).toBe(true)
    expect(ok.summary.truncatedBy).toEqual(['document_text_cap'])
    expect(ok.summary.totalTextChars).toBe(10)
    // Decided before truncation, so stopping sooner has not changed it.
    expect(ok.pages[0]!.imageOnly).toBe(false)
    expect(ok.summary.noTextExtracted).toBe(false)
  })

  it('still credits the page cap when IT is the tighter of the two', async () => {
    // The other side of the same stop: attribution has to keep telling the two
    // caps apart, so a caller tightening the page cap under a roomy document
    // budget is still told which one clipped.
    const page = { chunks: () => [[{ str: 'x'.repeat(1000) }]] }
    const pageCapped = expectOk(await extractWith({ pages: [page] }, { maxPageTextChars: 20 }))
    expect(pageCapped.pages[0]!.text).toBe('x'.repeat(20))
    expect(pageCapped.summary.truncatedBy).toEqual(['page_text_cap'])

    // Both caps at the same value: the page cap is the one that clipped, and
    // the document cap only stops the run afterwards.
    const both = expectOk(await extractWith({ pages: [page] }, { maxPageTextChars: 20, maxTotalTextChars: 20 }))
    expect(both.pages[0]!.text).toBe('x'.repeat(20))
    expect(both.summary.truncatedBy).toEqual(['page_text_cap'])
  })

  it('gives the same answer through the stream as through a build without one', async () => {
    // The streaming path may not change one character of what a page says, and a
    // build that has no `streamTextContent` — the peer is optional and
    // host-supplied, so that is a real host — must still read the document rather
    // than be reported as a broken one. Same text, same trim, both ways.
    const batches: readonly (readonly FakeGlyphItem[])[] = [
      [{ str: '   ' }, { str: '  Ledger' }],
      [{ str: ' balance  ' }],
      [{ str: '   ' }],
    ]
    const streamed = expectOk(await extractWith({ pages: [{ chunks: () => batches }] }))
    const flat = expectOk(await extractWith({ pages: [{ items: () => batches.flat() }] }))
    expect(streamed.pages[0]!.text).toBe('Ledger balance')
    expect(flat.pages[0]!.text).toBe(streamed.pages[0]!.text)
    expect(streamed.summary.truncated).toBe(false)

    // Clipped inside the interior gap, both ways: the space is kept, because it is
    // only trailing once nothing follows it.
    const clippedStream = expectOk(await extractWith({ pages: [{ chunks: () => batches }] }, { maxPageTextChars: 7 }))
    const clippedFlat = expectOk(await extractWith({ pages: [{ items: () => batches.flat() }] }, { maxPageTextChars: 7 }))
    expect(clippedStream.pages[0]!.text).toBe('Ledger ')
    expect(clippedFlat.pages[0]!.text).toBe(clippedStream.pages[0]!.text)
    expect(clippedStream.pages[0]!.truncated).toBe(true)
  })

  it('reproduces trim() exactly while reading item by item', async () => {
    // Applying `trim()` to a string assembled from every item is easy; getting
    // the same answer while only ever holding a prefix is where a rewrite can
    // quietly change what a page says. Leading whitespace must not count
    // against the cap, trailing whitespace must come off, and whitespace that
    // turns out to be interior must stay.
    const items = () => [
      { str: '   ' },
      { str: '  Ledger' },
      { str: ' balance  ' },
      { str: '   ' },
    ]
    const whole = expectOk(await extractWith({ pages: [{ items }] }))
    expect(whole.pages[0]!.text).toBe('Ledger balance')
    expect(whole.pages[0]!.truncated).toBe(false)
    expect(whole.summary.totalTextChars).toBe('Ledger balance'.length)

    // Clipped inside the interior gap: the space is kept, because it is only
    // trailing once nothing follows it.
    const clipped = expectOk(await extractWith({ pages: [{ items }] }, { maxPageTextChars: 7 }))
    expect(clipped.pages[0]!.text).toBe('Ledger ')
    expect(clipped.pages[0]!.truncated).toBe(true)

    // A page of nothing but whitespace is blank, not a page with text — and
    // blank is not scanned, so it is not a document to send to OCR either.
    const blank = expectOk(await extractWith({ pages: [{ items: () => [{ str: '   ' }, { str: '\n' }] }] }))
    expect(blank.pages[0]!.text).toBe('')
    expect(blank.pages[0]!.imageOnly).toBe(false)
    expect(blank.summary.noTextExtracted).toBe(false)

    // The same whitespace page WITH a raster painted on it is the scanned case,
    // and that one does need OCR.
    const scanned = expectOk(
      await extractWith({ pages: [{ items: () => [{ str: '   ' }], imagePainted: true }] }),
    )
    expect(scanned.pages[0]!.imageOnly).toBe(true)
    expect(scanned.summary.noTextExtracted).toBe(true)
  })

  it('does not call a document corrupt when it was the reading that failed', async () => {
    // `corrupt` tells the user their file "may be damaged or only partly
    // downloaded". A RangeError, an allocation failure, or a pdfjs fault it
    // could not classify itself is no evidence for that sentence, and saying it
    // anyway sends someone to re-download a file that is perfectly good.
    const range = expectFailed(await extractWith({ documentError: new RangeError('Invalid string length') }))
    expect(range.reason).toBe('extraction_failed')
    expect(range.reason).not.toBe('corrupt')
    expect(range.message).not.toMatch(/damaged|partly downloaded/i)
    expect(range.message).not.toBe(range.reason)
    expect(range.message).toMatch(/[.!]$/)

    // pdfjs's own wrapper for a throw IT could not identify is, by name, not a
    // finding about the document either.
    const unknown = expectFailed(
      await extractWith({ documentError: named('UnknownErrorException', 'Failed to fetch') }),
    )
    expect(unknown.reason).toBe('extraction_failed')

    // …and the reasons that ARE about the bytes still say so, in both the
    // instrumented case and the real one, so the split has not simply moved
    // every failure to the new reason.
    const invalid = expectFailed(
      await extractWith({ documentError: named('InvalidPDFException', 'Invalid PDF structure.') }),
    )
    expect(invalid.reason).toBe('corrupt')
    expect(invalid.message).toMatch(/damaged/i)

    const encrypted = expectFailed(
      await extractWith({ documentError: named('PasswordException', 'No password given') }),
    )
    expect(encrypted.reason).toBe('encrypted')
  })

  it('keeps the pages it read when one page inside the document cannot be read', async () => {
    // A damaged page in an otherwise readable statement used to discard the
    // whole call: page 1's text was thrown away and the user was told the
    // document was corrupt, which was false of pages 1 and 3.
    const result = expectOk(
      await extractWith({
        pages: [
          { items: () => [{ str: 'Summary of accounts' }] },
          { failWith: named('FormatError', 'Bad (uncompressed) stream') },
          { items: () => [{ str: 'Disclosures' }] },
        ],
      }),
    )

    expect(result.pages.map((page) => [page.page, page.text])).toEqual([
      [1, 'Summary of accounts'],
      [3, 'Disclosures'],
    ])
    expect(result.summary.totalPages).toBe(3)
    expect(result.summary.pagesExtracted).toBe(2)
    expect(result.summary.unreadablePages).toEqual([2])
    // The failed page is not smuggled into `pages` wearing another page's
    // clothes: an entry there would read as blank (`text: ''`) or as scanned
    // (`imageOnly`), and it is neither.
    expect(result.pages.some((page) => page.page === 2)).toBe(false)
    expect(result.summary.imageOnlyPages).toBe(0)
    expect(result.summary.noTextExtracted).toBe(false)
  })

  it('does not call a document "scanned" when a page nobody could read might have had text', async () => {
    // Page 1 failed and page 2 is an image. "The whole document yielded no text
    // at all" is the needs-OCR signal, and it is a claim about page 1 that
    // nobody is in a position to make.
    const result = expectOk(
      await extractWith({
        pages: [{ failWith: new Error('page 1 is unreadable') }, { imagePainted: true }],
      }),
    )

    expect(result.summary.unreadablePages).toEqual([1])
    expect(result.summary.pagesExtracted).toBe(1)
    expect(result.pages[0]!.page).toBe(2)
    expect(result.pages[0]!.imageOnly).toBe(true)
    expect(result.summary.imageOnlyPages).toBe(1)
    expect(result.summary.noTextExtracted).toBe(false)
  })

  it('fails the document when EVERY declared page fails, instead of an empty success', async () => {
    // pdfjs opened the catalog and reported a page count, so the document-level
    // handling never ran — and plenty of damaged PDFs fail only once their
    // pages are touched. Every page went into `unreadablePages` and the call
    // still returned `{ ok: true, pages: [] }`: a successful extraction of
    // nothing, which a consumer reads as "this document is empty" about a
    // document nobody read a page of. The split is the document-level one:
    // `corrupt` only where pdfjs itself made a statement about the bytes.
    const corrupt = expectFailed(
      await extractWith({
        pages: [
          { failWith: named('FormatError', 'Bad (uncompressed) stream') },
          { failWith: named('InvalidPDFException', 'Invalid PDF structure.') },
        ],
      }),
    )
    expect(corrupt.reason).toBe('corrupt')
    expect(corrupt.message).toMatch(/damaged/i)
    expect(corrupt.message).toMatch(/[.!]$/)

    // A fault that is NOT pdfjs's verdict on the bytes may not become one just
    // because it happened on every page: this process failed, and `corrupt`
    // would tell someone to re-download a file that is perfectly good.
    const unclassified = expectFailed(
      await extractWith({
        pages: [{ failWith: new RangeError('Invalid string length') }, { failWith: new TypeError('not a function') }],
      }),
    )
    expect(unclassified.reason).toBe('extraction_failed')
    expect(unclassified.reason).not.toBe('corrupt')
    expect(unclassified.message).not.toMatch(/damaged|partly downloaded/i)
    expect(unclassified.message).toMatch(/[.!]$/)

    // A single page is a whole document too.
    const only = expectFailed(await extractWith({ pages: [{ failWith: new Error('nothing readable here') }] }))
    expect(only.reason).toBe('extraction_failed')
  })

  it('keeps partial success a success — the all-pages rule must not swallow it', async () => {
    // The guard above may only fire when NOTHING was read. One page out of
    // three is still a result, with the rest named in `unreadablePages`.
    const partial = expectOk(
      await extractWith({
        pages: [
          { failWith: named('FormatError', 'Bad (uncompressed) stream') },
          { items: () => [{ str: 'Disclosures' }] },
          { failWith: named('InvalidPDFException', 'Invalid PDF structure.') },
        ],
      }),
    )
    expect(partial.pages.map((page) => [page.page, page.text])).toEqual([[2, 'Disclosures']])
    expect(partial.summary.unreadablePages).toEqual([1, 3])
    expect(partial.summary.pagesExtracted).toBe(1)

    // …and neither does a document the total-text cap stopped before page 1:
    // no page failed, so nothing here applies to it.
    const capped = expectOk(
      await extractWith({ pages: [{ items: () => [{ str: 'Readable' }] }] }, { maxTotalTextChars: 0 }),
    )
    expect(capped.pages).toEqual([])
    expect(capped.summary.unreadablePages).toEqual([])
    expect(capped.summary.truncatedBy).toContain('document_text_cap')
  })

  it('reports an empty unreadablePages when every page was read', async () => {
    const result = expectOk(await extractWith({ pages: [{ items: () => [{ str: 'All fine' }] }] }))
    expect(result.summary.unreadablePages).toEqual([])
  })

  it('blames the host build, not the document, when the supplied pdfjs is shaped differently', async () => {
    // The optional peer means a host may supply its own pdfjs. One missing an
    // API this module uses threw inside the extraction body and came back as
    // `corrupt` — a verdict about the user's document for what is entirely a
    // host-integration problem.
    const missingVerbosity = expectFailed(
      await extractWith({ omitVerbosityLevel: true, pages: [{ items: () => [{ str: 'readable' }] }] }),
    )
    expect(missingVerbosity.reason).toBe('pdfjs_incompatible')
    expect(missingVerbosity.reason).not.toBe('corrupt')
    expect(missingVerbosity.message).not.toMatch(/damaged|partly downloaded/i)
    expect(missingVerbosity.message).toContain('pdfjs-dist')
    expect(missingVerbosity.message).toMatch(/[.!]$/)

    // A getDocument that rejects the parameter object outright — the other half
    // of the case the code comment already anticipated — lands the same way. A
    // conforming build reports a bad document by rejecting the task's promise,
    // never by throwing out of the call.
    const rejectsParameters = expectFailed(
      await extractWith({ getDocumentThrows: new TypeError('Invalid parameter object') }),
    )
    expect(rejectsParameters.reason).toBe('pdfjs_incompatible')
    expect(rejectsParameters.reason).not.toBe('corrupt')
  })
})

describe('extractDocumentText — the pdfjs worker module will not load', () => {
  afterEach(() => {
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.worker.mjs')
    vi.resetModules()
  })

  it('names the worker module rather than claiming pdfjs-dist is not installed', async () => {
    // Both imports used to sit under one catch, so a build that relocated the
    // worker subpath — or a bundler that resolves the main entry and not that
    // one — was reported as "the optional pdfjs-dist package is not installed".
    // The package IS installed here; only the worker import fails.
    vi.resetModules()
    vi.doMock('pdfjs-dist/legacy/build/pdf.worker.mjs', () => {
      throw new Error("Cannot find module 'pdfjs-dist/legacy/build/pdf.worker.mjs'")
    })

    const { extractDocumentText: extract } = await import('./documentText')
    const result = expectFailed(await extract(buildSyntheticPdf({ pages: [{ text: 'Statement' }] })))

    expect(result.reason).toBe('pdfjs_worker_unavailable')
    expect(result.reason).not.toBe('pdfjs_unavailable')
    expect(result.message).not.toMatch(/is not installed/i)
    expect(result.message).toContain('pdfjs-dist')
    expect(result.message).not.toBe(result.reason)
    expect(result.message).toMatch(/[.!]$/)
  })
})

describe('extractDocumentText — a capped page must SETTLE against real pdfjs', () => {
  // The gap these close, stated plainly: every "the caps bound the work"
  // assertion above drives the fake pdfjs at the top of this file, whose
  // `destroy` resolves immediately and whose stream has no producer waiting on
  // anybody. Abandoning a stream is therefore free in the fake — and fatal in
  // reality. pdfjs's text producer awaits its sink once the queue is full (it
  // flushes every 100 items), and `loadingTask.destroy()` waits on that
  // producer, so a reader that stops mid-page leaves the promise
  // `extractDocumentText` returned pending FOREVER. Measured before the fix:
  // `maxTotalTextChars: 10` and `maxPageTextChars: 10` both hang on the page
  // below; both answer in single-digit milliseconds once the stream is drained.
  //
  // Every test here carries an explicit timeout so a regression FAILS rather
  // than hanging the suite — the failure mode is a promise that never settles,
  // which without a timeout is a run that never ends.
  const SETTLE_TIMEOUT_MS = 15_000

  /**
   * A page with far more than pdfjs's 100-item flush threshold, so its stream
   * arrives in several chunks and its producer is still mid-page when a small
   * cap is satisfied by the first one. Ten columns per baseline keeps every run
   * on the page, which a long single column would not.
   */
  function manyItemPage(baselines = 40) {
    return {
      fontSize: 5,
      lines: Array.from({ length: baselines }, (_, row) =>
        Array.from({ length: 10 }, (_, column) => ({ x: 20 + column * 55, text: `r${row}-c${column}` })),
      ),
    }
  }

  it('the fixture really does leave pdfjs mid-stream — the premise, pinned', async () => {
    // If a future pdfjs (or a change to the fixture) delivered this page in one
    // chunk, every test below would still pass while covering nothing at all:
    // there would be no queued producer left to strand. So the premise is
    // asserted directly, through the real streaming API.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
    const task = pdfjs.getDocument({
      data: buildSyntheticPdf({ pages: [manyItemPage()] }),
      useWorkerFetch: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    })
    try {
      const page = await (await task.promise).getPage(1)
      const reader = page.streamTextContent().getReader()
      let chunks = 0
      for (;;) {
        const next = await reader.read()
        if (next.done === true) break
        chunks += 1
      }
      expect(chunks).toBeGreaterThan(1)
    } finally {
      await task.destroy()
    }
  }, SETTLE_TIMEOUT_MS)

  it(
    'settles when the DOCUMENT cap is satisfied long before the page ends',
    async () => {
      const ok = expectOk(
        await extractDocumentText(buildSyntheticPdf({ pages: [manyItemPage()] }), { maxTotalTextChars: 10 }),
      )
      expect(ok.pages[0]!.text).toHaveLength(10)
      expect(ok.pages[0]!.truncated).toBe(true)
      expect(ok.summary.truncatedBy).toEqual(['document_text_cap'])
      expect(ok.summary.totalTextChars).toBe(10)
      // Truncation is not a scanned page, however early it happened.
      expect(ok.pages[0]!.imageOnly).toBe(false)
      expect(ok.summary.noTextExtracted).toBe(false)
    },
    SETTLE_TIMEOUT_MS,
  )

  it(
    'settles when the PAGE cap is satisfied long before the page ends',
    async () => {
      // This one hung BEFORE this round's change as well as after it, so it is
      // a live bug on the branch and not only a regression guard.
      const ok = expectOk(
        await extractDocumentText(buildSyntheticPdf({ pages: [manyItemPage()] }), { maxPageTextChars: 10 }),
      )
      expect(ok.pages[0]!.text).toHaveLength(10)
      expect(ok.pages[0]!.truncated).toBe(true)
      expect(ok.summary.truncatedBy).toEqual(['page_text_cap'])
      expect(ok.summary.totalTextChars).toBe(10)
    },
    SETTLE_TIMEOUT_MS,
  )

  it(
    'settles when the budget runs out in the middle of a LATER page',
    async () => {
      // The commonest shape of all: pages read whole until the document budget
      // is nearly spent, and the page that spends it is abandoned mid-stream.
      // The cap is derived from the fixture rather than hard-coded, so this
      // keeps landing mid-page whatever a pdfjs bump does to the spacing.
      const pdf = buildSyntheticPdf({ pages: [manyItemPage(), manyItemPage(), manyItemPage()] })
      const whole = expectOk(await extractDocumentText(pdf))
      const firstPageChars = whole.pages[0]!.text.length
      expect(firstPageChars).toBeGreaterThan(100)
      expect(whole.summary.truncated).toBe(false)

      const ok = expectOk(await extractDocumentText(pdf, { maxTotalTextChars: firstPageChars + 10 }))
      expect(ok.pages).toHaveLength(2)
      expect(ok.pages[0]!.truncated).toBe(false)
      expect(ok.pages[1]!.text).toHaveLength(10)
      expect(ok.pages[1]!.truncated).toBe(true)
      expect(ok.summary.truncatedBy).toEqual(['document_text_cap'])
      expect(ok.summary.totalTextChars).toBe(firstPageChars + 10)
    },
    SETTLE_TIMEOUT_MS,
  )

  it(
    'reads a capped page and an uncapped one to the same text',
    async () => {
      // Draining must not change one character of the answer: the discarded
      // chunks are discarded, not folded in late.
      const pdf = buildSyntheticPdf({ pages: [manyItemPage(6)] })
      const whole = expectOk(await extractDocumentText(pdf))
      const capped = expectOk(await extractDocumentText(pdf, { maxPageTextChars: 25 }))
      expect(capped.pages[0]!.text).toBe(whole.pages[0]!.text.slice(0, 25))
    },
    SETTLE_TIMEOUT_MS,
  )
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
