/**
 * **Local PDF text extraction** — the document-parsing spike
 * (advisor-intake-and-migration-workbench, WS5). Given the bytes of a
 * statement, an old plan printout, or a Form 1040, this pulls the text layer
 * out page by page, says which pages have no text layer at all (the scanned
 * page an OCR pass would be needed for), and refuses honestly when it cannot.
 *
 * **Stability promise:** this module is published as the
 * `@retiregolden/planner-ui/document-text` subpath and, unlike the wildcard
 * deep paths, is a supported API: the exported names, their signatures, the
 * `DocumentTextResult` shape, and the `reason` vocabulary only change with a
 * semver-major release of the package. New `reason` values and new summary
 * fields may be added in a minor, so a consumer must treat an unrecognized
 * reason as "could not read this document" rather than assuming the union is
 * closed. It is deliberately DOM-free, so a Node process, an Electron
 * renderer, and a browser all run the same code path.
 *
 * **A page number is the citation.** `DocumentPage.page` is a 1-based integer
 * and nothing requires parsing a string to recover it. This module
 * deliberately does NOT add a page-citation member to the published
 * `SourceLocator` union in `provenance.ts`: `parseLocator`'s `default: return
 * null` propagates to `parseImportProvenance` returning `malformed`, so a new
 * locator kind would make every NEW provenance export unreadable by an older
 * consumer, and Pro's `isValidLocator` mirrors the same closed switch and
 * would reject those notes with a bare `invalid_input`. A spike exists to
 * decide whether PDF import is viable at all; committing the published
 * provenance contract before the accuracy benchmark answers that is
 * backwards. Promoting page citations into `SourceLocator` is the follow-up
 * if the numbers justify shipping.
 *
 * **Nothing here is wired into the free import wizard.** `ImportPage.tsx`
 * still tells the user "no PDF upload", and `tenForty.ts` is still guided
 * entry with no PDF parsing; both remain true, because the intended consumer
 * of this module is the Pro intake workbench. Importing this module is an
 * explicit act.
 *
 * **The pdfjs dependency is an OPTIONAL peer.** `pdfjs-dist` is declared in
 * `peerDependencies` with `peerDependenciesMeta.optional`, and the import
 * below is dynamic, so the module is never evaluated — and the peer never
 * needed — unless a caller actually extracts a document. A host that never
 * imports this subpath pays nothing: npm does not install the peer, and a
 * bundler never reaches the import. A host that DOES import it must install
 * `pdfjs-dist` itself; if it is missing at runtime the failure is reported as
 * `pdfjs_unavailable`, not thrown. (The package also keeps `pdfjs-dist` as a
 * devDependency purely so this repo's `tsc -b` and vitest can resolve it.)
 *
 * **Worker-free by construction.** pdfjs normally spawns a Web Worker from a
 * separately hosted `pdf.worker.mjs` asset. Importing that module on the main
 * thread instead sets `globalThis.pdfjsWorker`, which pdfjs checks first and
 * treats as a main-thread message handler — so no `new Worker(...)` call is
 * made and no worker asset has to be hosted, in Node, in an Electron
 * renderer, or in a browser alike. The cost is that extraction runs on the
 * calling thread; the caps below are what keep that bounded. (In Node pdfjs
 * disables the worker on its own, but the explicit import is what makes the
 * browser and Electron-renderer paths work.)
 *
 * **Local-only, enforced not merely intended.** pdfjs can fetch character
 * maps, standard font data, ICC profiles, its WebAssembly helpers, and the
 * document itself over the network. None of those are reachable here. The
 * document is passed as bytes, never a URL. Every option that names a
 * fetchable location — `url`, `docBaseUrl`, `cMapUrl`, `standardFontDataUrl`,
 * `iccUrl`, `wasmUrl` — is deliberately left undefined, so there is no
 * address to fetch from, and `useWorkerFetch: false` additionally disables
 * the Fetch API the parser would use to retrieve those three classes of
 * file itself. `useSystemFonts: false` and `disableFontFace: true` keep it
 * away from locally installed fonts and from installing font faces in a
 * host's document. (pdf.js 6 removed the `eval`-based font-compilation path
 * and its `isEvalSupported` switch outright, so there is no longer a knob to
 * turn off there.) A document that needs a non-embedded CJK cmap therefore
 * extracts poorly rather than phoning home — that is the intended trade, and
 * one of the things the accuracy benchmark has to measure.
 *
 * **Known cost, for the benchmark to price.** Deciding that a page is
 * image-only means building its operator list, which makes pdfjs decode the
 * page's images. That is only done for pages that yielded no text, but on a
 * fully scanned document it is every page. Bounding that decode without
 * losing the image-only signal (pdfjs drops paint operators for images it
 * declines to decode) is follow-up work, not spike work.
 */

/**
 * A single page's extracted text. `page` is the citation: a 1-based page
 * number, always present, never encoded in a string.
 */
export interface DocumentPage {
  /** 1-based page number, as a reader would cite it. */
  readonly page: number
  /** The page's extracted text, possibly empty. */
  readonly text: string
  /**
   * True when the page has no extractable text layer but does paint a raster
   * image — a scanned page, the case OCR would be needed for. A page that is
   * simply blank is `false` with empty `text`: "we found nothing" and "there
   * is a picture we cannot read" are different answers and a UI must be able
   * to tell the user which one it got.
   *
   * Decided from the text pdfjs actually read, BEFORE any cap clipped it. A
   * page with a full text layer and a logo, clipped to nothing by a tight
   * `maxPageTextChars`, is not a scanned page — reporting it as one would tell
   * a user to retype a page the parser read perfectly.
   */
  readonly imageOnly: boolean
  /** True when {@link MAX_PAGE_TEXT_CHARS} clipped this page's text. */
  readonly truncated: boolean
}

/** Which cap clipped the result. */
export type DocumentTextTruncation = 'page_text_cap' | 'document_text_cap'

/** Document-level counts, so a caller need not re-derive them from `pages`. */
export interface DocumentTextSummary {
  /** Pages the document declares. */
  readonly totalPages: number
  /**
   * Pages actually present in `pages`. Lower than `totalPages` only when the
   * total-text cap stopped extraction partway.
   */
  readonly pagesExtracted: number
  /** How many extracted pages were image-only. */
  readonly imageOnlyPages: number
  /**
   * True when the whole document yielded no text at all — a fully scanned
   * document, the honest "this needs OCR" signal at document level.
   *
   * False when no page was extracted at all (`pagesExtracted === 0`): a
   * document with no pages, or one the total-text cap stopped before the first
   * page, has nothing an OCR pass could read, and saying "these pages are
   * scanned, type them in" about no pages would be vacuously true — the exact
   * dishonesty this flag exists to avoid.
   */
  readonly noTextExtracted: boolean
  /** Total characters across `pages`, after any truncation. */
  readonly totalTextChars: number
  /** True when any cap clipped the result; `truncatedBy` says which. */
  readonly truncated: boolean
  /** The caps that clipped, in no particular order; empty when none did. */
  readonly truncatedBy: readonly DocumentTextTruncation[]
}

/**
 * Why extraction did not produce text. Machine-readable; the accompanying
 * `message` is the human sentence a UI can show. Treat an unrecognized value
 * as a generic "could not read this document" — new reasons may be added in a
 * minor release.
 */
export type DocumentTextFailureReason =
  /** Password-protected; we will not prompt for or hold a password. */
  | 'encrypted'
  /** Header says PDF but the structure is not parseable. */
  | 'corrupt'
  /** The bytes are not a PDF at all (no `%PDF-` header). */
  | 'not_pdf'
  /** Larger than {@link MAX_DOCUMENT_BYTES}; the bytes were never parsed. */
  | 'too_large'
  /** More pages than {@link MAX_DOCUMENT_PAGES}. */
  | 'too_many_pages'
  /** The optional `pdfjs-dist` peer is not installed in this host. */
  | 'pdfjs_unavailable'
  /**
   * The bytes could not be read from memory at all — the buffer was detached
   * before the call, which is what a `structuredClone(buffer, { transfer })`
   * or a worker handoff leaves behind. Nothing was ever inspected.
   */
  | 'unreadable_input'

/**
 * The result of {@link extractDocumentText}. A data condition is always a
 * `{ ok: false }` value — this function does not throw for a bad document, so
 * a caller may hand it arbitrary bytes and always get a result back.
 */
export type DocumentTextResult =
  | { ok: true; pages: readonly DocumentPage[]; summary: DocumentTextSummary }
  | { ok: false; reason: DocumentTextFailureReason; message: string }

/**
 * Largest document accepted, in bytes. Oversized input is rejected before the
 * bytes are inspected at all — it is the cheapest possible refusal, and it
 * takes precedence over every other reason including `not_pdf`.
 */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

/** Largest page count accepted. Checked once the document reports its length. */
export const MAX_DOCUMENT_PAGES = 300

/** Largest text kept from any one page. */
export const MAX_PAGE_TEXT_CHARS = 100_000

/**
 * Largest text kept from the whole document. A host that embeds extracted
 * text has its own limits; these are ours, exported so the two can be
 * reconciled rather than discovered.
 */
export const MAX_DOCUMENT_TEXT_CHARS = 2_000_000

/**
 * Per-call limits. Every value may only make a cap *stricter*: a host may
 * tighten what it is willing to process, but the exported constants are the
 * ceiling this module promises, so a caller cannot raise them into territory
 * the module has never been exercised in.
 */
export interface ExtractDocumentTextOptions {
  readonly maxBytes?: number
  readonly maxPages?: number
  readonly maxPageTextChars?: number
  readonly maxTotalTextChars?: number
}

/**
 * How far into the file the `%PDF-` header may appear. Real files sometimes
 * carry a few junk bytes ahead of the header and pdfjs tolerates them within
 * roughly this window, so the pre-check matches that tolerance instead of
 * rejecting a readable document on a strict byte-0 test.
 */
const PDF_HEADER_SEARCH_BYTES = 1024

/** `%PDF-` */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]

/**
 * View the input as bytes, or `null` when even that is impossible. Wrapping a
 * DETACHED `ArrayBuffer` throws a `TypeError`, and a detached buffer is a real
 * browser condition — a `structuredClone(buffer, { transfer: [buffer] })` or a
 * worker handoff leaves the caller holding one. The module's contract is that a
 * caller may hand it arbitrary bytes and always get a result back, so this is
 * the one place that turns that throw into a reason.
 */
function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array | null {
  try {
    if (data instanceof Uint8Array) {
      // A detached VIEW is the commoner half of this condition: transferring
      // `view.buffer` leaves the caller holding a view whose byteLength is now
      // zero. Reading it finds no header and would answer "this is not a PDF"
      // about bytes nobody read — a guess dressed up as a finding. It is
      // unreadable, and the reason says so.
      return (data.buffer as { detached?: boolean }).detached === true ? null : data
    }
    return new Uint8Array(data)
  } catch {
    return null
  }
}

/** Whether `%PDF-` appears within the first {@link PDF_HEADER_SEARCH_BYTES}. */
function hasPdfHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, PDF_HEADER_SEARCH_BYTES) - PDF_MAGIC.length
  for (let start = 0; start <= limit; start++) {
    let matched = true
    for (let i = 0; i < PDF_MAGIC.length; i++) {
      if (bytes[start + i] !== PDF_MAGIC[i]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

/** A cap the caller may tighten but not loosen. */
function cap(requested: number | undefined, ceiling: number): number {
  return requested === undefined || !Number.isFinite(requested) ? ceiling : Math.max(0, Math.min(requested, ceiling))
}

/**
 * pdfjs signals its own conditions by exception class *name*, which is the
 * only stable handle on them: its exception classes are not exported for
 * `instanceof` on every build, and today they inherit from `Error` only
 * because pdfjs assigns `BaseException.prototype = new Error()`. Reading the
 * name off any object keeps this working if that detail changes.
 */
function exceptionName(error: unknown): string {
  const name: unknown = (error as { name?: unknown } | null | undefined)?.name
  return typeof name === 'string' ? name : ''
}

/** Best-effort human detail from a thrown value, for the `corrupt` message. */
function exceptionMessage(error: unknown): string | undefined {
  const message: unknown = (error as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string' && message.length > 0 ? message : undefined
}

/**
 * Context for the human message. `limit` is the cap that actually fired,
 * which is NOT always the exported ceiling — a host may have tightened it,
 * and quoting "25 MB" at a user whose host stops at 5 MB would be a lie.
 */
interface FailureContext {
  readonly detail?: string
  readonly limit?: number
}

/**
 * Render a byte cap the way a user could check it against their own file.
 *
 * The unit follows the size of the cap rather than always being megabytes: a
 * host may tighten `maxBytes` to anything, and rounding 1 KiB up to "1 MB"
 * would tell someone their 866-byte file is over a 1 MB limit — a false
 * statement in the one sentence they can read. A fractional value keeps its
 * first decimal so a 1.5 MB cap is not reported as 1 MB or 2 MB.
 */
function formatByteLimit(bytes: number): string {
  const render = (value: number, unit: string): string =>
    `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`
  if (bytes >= 1024 * 1024) return render(bytes / (1024 * 1024), 'MB')
  if (bytes >= 1024) return render(bytes / 1024, 'KB')
  return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
}

function failureMessage(reason: DocumentTextFailureReason, context: FailureContext = {}): string {
  switch (reason) {
    case 'encrypted':
      return 'This PDF is password-protected, so its text cannot be read. Remove the password and try again, or enter the values by hand.'
    case 'corrupt':
      return context.detail
        ? `This PDF could not be read (${context.detail}). The file may be damaged or only partly downloaded.`
        : 'This PDF could not be read. The file may be damaged or only partly downloaded.'
    case 'not_pdf':
      return 'This file is not a PDF. Choose a PDF, or enter the values by hand.'
    case 'too_large':
      return `This file is larger than the ${formatByteLimit(context.limit ?? MAX_DOCUMENT_BYTES)} limit, so it was not opened. Split it, or enter the values by hand.`
    case 'too_many_pages': {
      const pages = context.limit ?? MAX_DOCUMENT_PAGES
      return `This document has more than ${pages} ${pages === 1 ? 'page' : 'pages'}, which is past the limit. Extract the pages you need, or enter the values by hand.`
    }
    case 'pdfjs_unavailable':
      return 'PDF reading is unavailable in this app because the optional "pdfjs-dist" package is not installed.'
    case 'unreadable_input':
      return 'This file could not be read from memory because its data had already been handed off elsewhere. Choose the file again, or enter the values by hand.'
  }
}

function failure(reason: DocumentTextFailureReason, context?: FailureContext): DocumentTextResult {
  return { ok: false, reason, message: failureMessage(reason, context) }
}

/**
 * Load pdfjs and force its main-thread (worker-free) path. See the module
 * header: importing the worker module sets `globalThis.pdfjsWorker`, which
 * pdfjs consults before it would ever construct a `Worker`.
 */
async function loadPdfjs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  const [pdfjs] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    // @ts-expect-error -- pdf.worker.mjs ships no declaration file; it is
    // imported for its side effect (setting globalThis.pdfjsWorker), and its
    // exports are never touched, so an implicit `any` here costs nothing.
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ])
  return pdfjs
}

/**
 * Extract the text layer of a PDF, locally, page by page.
 *
 * Never throws for a bad document: every data condition — bytes that are not a
 * PDF at all, a host without the optional pdfjs peer, and an ArrayBuffer that
 * was already detached by a transfer — comes back as
 * `{ ok: false, reason, message }`. The input bytes are copied before parsing,
 * so the caller's buffer is never detached or mutated by this call.
 *
 * Checks run cheapest-first: readability of the input at all, then size, then
 * the `%PDF-` header, then the page cap once the document declares its length,
 * then per-page extraction.
 */
export async function extractDocumentText(
  data: ArrayBuffer | Uint8Array,
  opts: ExtractDocumentTextOptions = {},
): Promise<DocumentTextResult> {
  const maxBytes = cap(opts.maxBytes, MAX_DOCUMENT_BYTES)
  const maxPages = cap(opts.maxPages, MAX_DOCUMENT_PAGES)
  const maxPageTextChars = cap(opts.maxPageTextChars, MAX_PAGE_TEXT_CHARS)
  const maxTotalTextChars = cap(opts.maxTotalTextChars, MAX_DOCUMENT_TEXT_CHARS)

  const bytes = toBytes(data)
  if (bytes === null) return failure('unreadable_input')
  if (bytes.length > maxBytes) return failure('too_large', { limit: maxBytes })
  if (!hasPdfHeader(bytes)) return failure('not_pdf')

  let pdfjs: Awaited<ReturnType<typeof loadPdfjs>>
  try {
    pdfjs = await loadPdfjs()
  } catch {
    return failure('pdfjs_unavailable')
  }

  // pdfjs may take ownership of the buffer it is handed; copy so the caller's
  // ArrayBuffer is never detached out from under them.
  const owned = new Uint8Array(bytes)

  // Declared out here so `finally` can still release it, but ASSIGNED inside
  // the try: the peer is optional, so a host may supply its own pdfjs build,
  // and one shaped differently enough to throw here — a missing
  // VerbosityLevel, a getDocument that rejects its parameter object — must
  // come back as a reason like every other unusable input, never a throw.
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null

  try {
    loadingTask = pdfjs.getDocument({
      data: owned,
      // See the local-only paragraph in the module header. Every option naming
      // a fetchable location — url, docBaseUrl, cMapUrl, standardFontDataUrl,
      // iccUrl, wasmUrl — is omitted on purpose; these three close the paths
      // that remain.
      useWorkerFetch: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    })
    const doc = await loadingTask.promise
    const totalPages = doc.numPages
    if (totalPages > maxPages) return failure('too_many_pages', { limit: maxPages })

    const imagePaintOps = new Set<number>([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
    ])

    const pages: DocumentPage[] = []
    const truncatedBy = new Set<DocumentTextTruncation>()
    let totalTextChars = 0
    // Did ANY extracted page have a text layer, judged before the caps clipped
    // it. `totalTextChars` cannot answer that — it is the post-truncation count,
    // so a cap of zero would make a perfectly readable document look scanned.
    let anyPageHadText = false

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (totalTextChars >= maxTotalTextChars) {
        truncatedBy.add('document_text_cap')
        break
      }

      const page = await doc.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        let text = ''
        for (const item of content.items) {
          // getTextContent also yields marked-content markers, which carry no
          // text; only the items with a `str` are glyphs.
          if (!('str' in item)) continue
          text += item.str
          if (item.hasEOL) text += '\n'
        }
        text = text.trim()
        // Whether the page HAD a text layer is decided here, on what pdfjs read,
        // before any cap touches it. Deciding it after truncation would let a
        // tight `maxPageTextChars` manufacture an image-only verdict about a page
        // whose text was read perfectly.
        const hadText = text.length > 0
        if (hadText) anyPageHadText = true

        let truncated = false
        if (text.length > maxPageTextChars) {
          text = text.slice(0, maxPageTextChars)
          truncated = true
          truncatedBy.add('page_text_cap')
        }
        const remaining = maxTotalTextChars - totalTextChars
        if (text.length > remaining) {
          text = text.slice(0, remaining)
          truncated = true
          truncatedBy.add('document_text_cap')
        }

        // Only a page with nothing to read is worth the extra operator-list
        // pass; that pass is what separates a scanned page from a blank one.
        let imageOnly = false
        if (!hadText) {
          const operators = await page.getOperatorList()
          imageOnly = operators.fnArray.some((fn: number) => imagePaintOps.has(fn))
        }

        totalTextChars += text.length
        pages.push({ page: pageNumber, text, imageOnly, truncated })
      } finally {
        // Best-effort, and never allowed to mask the page's real outcome.
        try {
          page.cleanup()
        } catch {
          /* the page is being abandoned either way */
        }
      }
    }

    return {
      ok: true,
      pages,
      summary: {
        totalPages,
        pagesExtracted: pages.length,
        imageOnlyPages: pages.filter((page) => page.imageOnly).length,
        // "Every page we read was unreadable", never "we read no pages" and
        // never "a cap clipped everything away". A zero-page document, or one
        // the total-text cap stopped before page 1, has no scanned page to send
        // anyone to OCR over; and text that was read and then truncated was
        // still read.
        noTextExtracted: pages.length > 0 && !anyPageHadText,
        totalTextChars,
        truncated: truncatedBy.size > 0,
        truncatedBy: [...truncatedBy],
      },
    }
  } catch (error) {
    // pdfjs raises PasswordException for both "no password given" and "wrong
    // password"; either way we will not hold a password, so both are the same
    // honest answer. Everything else — including an unexpected internal
    // failure — is reported as an unreadable document rather than escaping as
    // a throw, because the caller's contract is a result union.
    if (exceptionName(error) === 'PasswordException') return failure('encrypted')
    return failure('corrupt', { detail: exceptionMessage(error) })
  } finally {
    // A throw from `finally` would replace the result we just computed, which
    // would break the never-throws contract on the way out the door. Releasing
    // the parser is best-effort.
    try {
      await loadingTask?.destroy()
    } catch {
      /* nothing useful to do; the result is already decided */
    }
  }
}
