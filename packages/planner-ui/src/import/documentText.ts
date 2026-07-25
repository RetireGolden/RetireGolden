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
 * `pdfjs_unavailable`, not thrown. Three separate host conditions get three
 * separate reasons, because their remedies differ and because a wrong one is a
 * false statement: `pdfjs_unavailable` (the package is not installed),
 * `pdfjs_worker_unavailable` (it is installed but its main-thread worker
 * module would not load), and `pdfjs_incompatible` (the build present does not
 * expose the API this module drives). None of the three is ever reported as a
 * problem with the user's document. (The package also keeps `pdfjs-dist` as a
 * devDependency purely so this repo's `tsc -b` and vitest can resolve it.)
 *
 * **Worker-free by construction.** pdfjs normally spawns a Web Worker from a
 * separately hosted `pdf.worker.mjs` asset. Importing that module on the main
 * thread instead sets `globalThis.pdfjsWorker`, which pdfjs checks first and
 * treats as a main-thread message handler — so no `new Worker(...)` call is
 * made and no worker asset has to be hosted, in Node, in an Electron
 * renderer, or in a browser alike. The cost is that extraction runs on the
 * calling thread; the caps below are what keep that bounded — bounded in
 * memory as well as in output, which is why per-page text is accumulated only
 * up to the cap rather than concatenated and sliced afterwards (see
 * `readPageText`). (In Node pdfjs disables the worker on its own, but the
 * explicit import is what makes the browser and Electron-renderer paths work.)
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
  /**
   * True when this page's text was clipped short of what pdfjs read. EITHER
   * cap can set it: {@link MAX_PAGE_TEXT_CHARS} (or a caller's tighter
   * `maxPageTextChars`) clipping this page on its own, or the document-wide
   * {@link MAX_DOCUMENT_TEXT_CHARS} budget running out partway through this
   * page — the last page extracted before the total cap stops the run is
   * routinely clipped by the second with the first nowhere near firing.
   * `summary.truncatedBy` is what names the caps that actually fired.
   */
  readonly truncated: boolean
}

/** Which cap clipped the result. */
export type DocumentTextTruncation = 'page_text_cap' | 'document_text_cap'

/** Document-level counts, so a caller need not re-derive them from `pages`. */
export interface DocumentTextSummary {
  /** Pages the document declares. */
  readonly totalPages: number
  /**
   * Pages actually present in `pages`. Lower than `totalPages` when the
   * total-text cap stopped extraction partway, and when a page could not be
   * read at all — see {@link unreadablePages}.
   */
  readonly pagesExtracted: number
  /**
   * 1-based numbers of pages pdfjs failed on, in page order. A damaged page
   * inside an otherwise readable statement does not discard the pages around
   * it: they stay in `pages` and the page that failed is named here instead.
   *
   * Such a page is deliberately ABSENT from `pages`, because there is no
   * honest entry to put there — a page that could not be read is not a page
   * with no text (`text: ''`, which a consumer reads as "blank"), and it is
   * not a scanned page either (`imageOnly: true`, which sends a user to OCR
   * over something nobody has established is an image). Empty when every page
   * that was reached was read.
   */
  readonly unreadablePages: readonly number[]
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
   *
   * False, too, whenever {@link unreadablePages} is non-empty: a page that
   * could not be read is not a page known to hold no text, so "the whole
   * document yielded no text" is a claim about pages nobody managed to look
   * at.
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
  /**
   * Header says PDF but the structure is not parseable — a statement ABOUT
   * THE DOCUMENT'S BYTES, and only ever reported when pdfjs made that
   * statement itself (see `DOCUMENT_FAULT_EXCEPTIONS`). A failure that is
   * really this module, this host, or pdfjs falling over on a perfectly good
   * file is {@link DocumentTextFailureReason 'extraction_failed'} instead:
   * telling someone their statement "may be damaged or only partly
   * downloaded" when it is not is the kind of confident falsehood this
   * vocabulary exists to prevent.
   */
  | 'corrupt'
  /** The bytes are not a PDF at all (no `%PDF-` header). */
  | 'not_pdf'
  /** Larger than {@link MAX_DOCUMENT_BYTES}; the bytes were never parsed. */
  | 'too_large'
  /** More pages than {@link MAX_DOCUMENT_PAGES}. */
  | 'too_many_pages'
  /**
   * The optional `pdfjs-dist` peer is not installed in this host — its main
   * entry point could not be resolved at all.
   */
  | 'pdfjs_unavailable'
  /**
   * `pdfjs-dist` IS installed, but its main-thread worker module could not be
   * loaded. Distinct from `pdfjs_unavailable` because the remedy is different
   * and because "the optional pdfjs-dist package is not installed" would be a
   * false sentence to show a host that installed it.
   */
  | 'pdfjs_worker_unavailable'
  /**
   * The pdfjs build this host supplies is not one this module can drive — it
   * is missing an API used here (`getDocument`, `VerbosityLevel`, the `OPS`
   * paint operators) or rejected the parameter object outright. A host
   * integration problem, never a statement about the user's document.
   */
  | 'pdfjs_incompatible'
  /**
   * Reading this document failed for a reason that is NOT a finding about its
   * bytes: an allocation or range error, an internal pdfjs fault, anything
   * this module could not classify. The document may be perfectly good, and
   * the message says so rather than blaming the file.
   */
  | 'extraction_failed'
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
      //
      // Detected by CONSTRUCTING a view rather than reading `ArrayBuffer.prototype
      // .detached`: that accessor is ES2024, so on a runtime without it the check
      // would read `undefined`, quietly fall through, and restore the very wrong
      // answer above. Construction throws on a detached buffer everywhere.
      new Uint8Array(data.buffer, 0, 0)
      return data
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

/** Best-effort human detail from a thrown value, for the failure message. */
function exceptionMessage(error: unknown): string | undefined {
  const message: unknown = (error as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string' && message.length > 0 ? message : undefined
}

/**
 * The pdfjs exception names that ARE a finding about the document's bytes, and
 * so the only ones that may be reported as `corrupt`.
 *
 * Everything else becomes `extraction_failed`, and the omissions are the
 * point. `UnknownErrorException` is pdfjs's own wrapper for a throw it did not
 * recognise — it is by name a statement that pdfjs does not know what went
 * wrong, which is not evidence that a file is damaged. A bare `RangeError`
 * (an allocation, a string that outgrew the engine's limit) is this process
 * failing, and a `TypeError` from an unexpected shape is this code failing.
 * Reporting any of those as `corrupt` puts a confident, false sentence —
 * "the file may be damaged or only partly downloaded" — in front of someone
 * whose statement is fine.
 */
const DOCUMENT_FAULT_EXCEPTIONS: ReadonlySet<string> = new Set([
  // "Invalid PDF structure." — pdfjs parsed as far as it could and the bytes
  // do not describe a document.
  'InvalidPDFException',
  // A syntax fault in an object pdfjs did reach.
  'FormatError',
  // Retrieving the document itself failed. Unreachable here (we hand over
  // bytes, never a URL) but it is a statement about the document all the same.
  'MissingPDFException',
  'ResponseException',
  'UnexpectedResponseException',
])

/**
 * Which reason a throw out of the extraction body deserves. The split is the
 * whole point: `corrupt` is a claim about the user's file and may only be made
 * on pdfjs's own say-so.
 */
function throwReason(error: unknown): 'encrypted' | 'corrupt' | 'extraction_failed' {
  const name = exceptionName(error)
  // pdfjs raises PasswordException for both "no password given" and "wrong
  // password"; either way we will not hold a password, so both are the same
  // honest answer.
  if (name === 'PasswordException') return 'encrypted'
  return DOCUMENT_FAULT_EXCEPTIONS.has(name) ? 'corrupt' : 'extraction_failed'
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
    case 'pdfjs_worker_unavailable':
      return context.detail
        ? `PDF reading is unavailable in this app: "pdfjs-dist" is installed, but its main-thread worker module could not be loaded (${context.detail}).`
        : 'PDF reading is unavailable in this app: "pdfjs-dist" is installed, but its main-thread worker module could not be loaded.'
    case 'pdfjs_incompatible':
      return context.detail
        ? `PDF reading is unavailable in this app because the installed "pdfjs-dist" build is not one this app can use (${context.detail}).`
        : 'PDF reading is unavailable in this app because the installed "pdfjs-dist" build is not one this app can use.'
    case 'extraction_failed':
      return context.detail
        ? `Something went wrong while reading this PDF (${context.detail}). The document itself may be perfectly fine — try again, or enter the values by hand.`
        : 'Something went wrong while reading this PDF. The document itself may be perfectly fine — try again, or enter the values by hand.'
    case 'unreadable_input':
      return 'This file could not be read from memory because its data had already been handed off elsewhere. Choose the file again, or enter the values by hand.'
  }
}

function failure(reason: DocumentTextFailureReason, context?: FailureContext): DocumentTextResult {
  return { ok: false, reason, message: failureMessage(reason, context) }
}

/** The pdfjs API surface this module drives. */
type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

/** Either pdfjs, or the reason this host cannot give us a usable one. */
type PdfjsLoad =
  | { readonly ok: true; readonly pdfjs: PdfjsModule }
  | {
      readonly ok: false
      readonly reason: 'pdfjs_unavailable' | 'pdfjs_worker_unavailable'
      readonly detail?: string
    }

/**
 * Load pdfjs and force its main-thread (worker-free) path. See the module
 * header: importing the worker module sets `globalThis.pdfjsWorker`, which
 * pdfjs consults before it would ever construct a `Worker`.
 *
 * **`allSettled`, not `all`.** The two imports fail for different reasons and
 * deserve different answers. A single catch over both could only report one,
 * and the one it reported — "the optional pdfjs-dist package is not installed"
 * — is FALSE of the host whose problem is the worker subpath alone: a build
 * that relocated `pdf.worker.mjs`, a bundler that resolves the main entry and
 * not that one. They still run concurrently; only the reporting is split.
 */
async function loadPdfjs(): Promise<PdfjsLoad> {
  const [core, worker] = await Promise.allSettled([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    // @ts-expect-error -- pdf.worker.mjs ships no declaration file; it is
    // imported for its side effect (setting globalThis.pdfjsWorker), and its
    // exports are never touched, so an implicit `any` here costs nothing.
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ])
  if (core.status === 'rejected') {
    return { ok: false, reason: 'pdfjs_unavailable', detail: exceptionMessage(core.reason) }
  }
  if (worker.status === 'rejected') {
    return { ok: false, reason: 'pdfjs_worker_unavailable', detail: exceptionMessage(worker.reason) }
  }
  return { ok: true, pdfjs: core.value }
}

/**
 * The operators that mean "a raster was painted here". Their presence on a
 * page that yielded no text is what separates a scanned page from a blank one.
 */
const IMAGE_PAINT_OPS = [
  'paintImageXObject',
  'paintImageXObjectRepeat',
  'paintInlineImageXObject',
  'paintImageMaskXObject',
] as const

/**
 * Does this build expose the pdfjs API this module actually uses?
 *
 * The peer is optional, so a host may supply its own pdfjs — a different
 * major, a re-export, a stub. One shaped differently enough that reading
 * `VerbosityLevel.ERRORS` or an `OPS` member throws or yields nothing is a
 * HOST INTEGRATION problem, and answering `corrupt` would blame the user's
 * document for it. Checking the shape up front turns that into
 * `pdfjs_incompatible` before a single byte of the document is parsed, so the
 * verdict cannot be confused with a finding about the file.
 *
 * The whole inspection is guarded, because merely LOOKING is not always safe:
 * a namespace proxy — what a bundler or a test harness substitutes for a real
 * module — can throw on a missing export rather than answer `undefined`. A
 * build that will not even be inspected is exactly as unusable as one missing
 * an export, and gets the same answer.
 */
function pdfjsShapeProblem(candidate: PdfjsModule): string | undefined {
  const api = candidate as unknown as
    | {
        getDocument?: unknown
        VerbosityLevel?: { ERRORS?: unknown } | null
        OPS?: Record<string, unknown> | null
      }
    | null
    | undefined
  try {
    if (typeof api?.getDocument !== 'function') return 'it exports no getDocument function'
    if (typeof api.VerbosityLevel?.ERRORS !== 'number') return 'it exports no VerbosityLevel.ERRORS'
    const ops = api.OPS
    if (!ops) return 'it exports no OPS table'
    for (const op of IMAGE_PAINT_OPS) {
      if (typeof ops[op] !== 'number') return `its OPS table has no ${op}`
    }
  } catch (error) {
    return exceptionMessage(error) ?? 'its exports could not be inspected'
  }
  return undefined
}

/**
 * A text-carrying entry of `getTextContent().items`. The same array also
 * yields marked-content markers, which carry no text; only the entries with a
 * `str` are glyphs. Structural rather than imported so this stays independent
 * of the pdfjs build a host supplies.
 */
interface TextContentGlyphs {
  readonly str: string
  readonly hasEOL?: boolean
}

function isGlyphItem(item: unknown): item is TextContentGlyphs {
  return typeof item === 'object' && item !== null && typeof (item as { str?: unknown }).str === 'string'
}

/** What one page's text items amounted to, without ever holding all of it. */
interface PageTextReading {
  /** The text to keep: the page's trimmed text, clipped to what fits. */
  readonly text: string
  /**
   * Did the page have a text layer, judged on what pdfjs read and BEFORE any
   * cap clipped it. This is the input to the image-only verdict, so it must
   * survive the early exit below: a page whose text was cut short after two
   * items still had text.
   */
  readonly hadText: boolean
  /** The page's own cap clipped it. */
  readonly clippedByPageCap: boolean
  /** The document-wide budget clipped it. */
  readonly clippedByDocumentCap: boolean
}

/**
 * Read one page's text items into at most `min(maxPageTextChars, remaining)`
 * characters.
 *
 * **The caps bound the PEAK, not merely the result.** Concatenating every item
 * and slicing afterwards produces exactly the same string and bounds nothing:
 * the intermediate is as large as the page, built on the calling thread — the
 * thread this module deliberately runs pdfjs on — so a pathological page could
 * exhaust memory (or outgrow the engine's maximum string length) before any
 * cap was consulted. The module header claims the caps are what keep
 * main-thread work bounded; this is where that has to be true of memory and
 * not only of the return value.
 *
 * So the retained text never exceeds the budget, and the two things a caller
 * still needs to know about the text that was NOT retained are carried as
 * numbers instead of characters:
 *
 * - `length` — characters accepted so far, after the leading whitespace
 *   `trim()` would have removed;
 * - `trimmedLength` — the same with trailing whitespace removed, i.e. the
 *   length of the trimmed page text seen so far. Comparing it against each cap
 *   is what sets `truncated`, and comparing it against zero is the
 *   pre-truncation `hadText` the image-only verdict is decided from.
 *
 * Reading stops as soon as `trimmedLength` passes `maxPageTextChars`: at that
 * point every flag above is already decided and every further character would
 * be clipped away, so the remaining items cannot change one byte of the
 * answer.
 */
function readPageText(
  items: readonly unknown[],
  maxPageTextChars: number,
  remaining: number,
): PageTextReading {
  const budget = Math.min(maxPageTextChars, remaining)
  let kept = ''
  let length = 0
  let trimmedLength = 0

  const append = (chunk: string): void => {
    let piece = chunk
    if (length === 0) {
      // `trim()`'s leading half, applied as the text arrives — nothing before
      // the first non-whitespace character is ever part of the page's text, so
      // it must not be counted against the budget either.
      piece = piece.trimStart()
      if (piece.length === 0) return
    } else if (piece.length === 0) {
      return
    }
    const room = budget - kept.length
    if (room > 0) kept += piece.length <= room ? piece : piece.slice(0, room)
    // `trim()`'s trailing half is only decided by what comes after, so it is
    // tracked as a position rather than applied: whitespace here may yet turn
    // out to be interior.
    const withoutTrailing = piece.trimEnd()
    if (withoutTrailing.length > 0) trimmedLength = length + withoutTrailing.length
    length += piece.length
  }

  for (const item of items) {
    if (!isGlyphItem(item)) continue
    append(item.str)
    if (item.hasEOL) append('\n')
    if (trimmedLength > maxPageTextChars) break
  }

  return {
    // Past the budget, the kept prefix IS the answer. Short of it, `kept` holds
    // the whole page and only its trailing whitespace has still to come off.
    text: trimmedLength > budget ? kept : kept.trimEnd(),
    hadText: trimmedLength > 0,
    clippedByPageCap: trimmedLength > maxPageTextChars,
    // What the document budget sees is the already page-capped text, so the
    // page cap is the ceiling on what it can clip.
    clippedByDocumentCap: Math.min(trimmedLength, maxPageTextChars) > remaining,
  }
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

  let loaded: PdfjsLoad
  try {
    loaded = await loadPdfjs()
  } catch (error) {
    // `loadPdfjs` settles both imports rather than throwing, so this is only
    // reachable if the import machinery itself failed synchronously.
    loaded = { ok: false, reason: 'pdfjs_unavailable', detail: exceptionMessage(error) }
  }
  if (!loaded.ok) return failure(loaded.reason, { detail: loaded.detail })
  const pdfjs = loaded.pdfjs

  // The peer is optional, so a host may supply its own pdfjs build. One that
  // is shaped differently — a missing VerbosityLevel, no OPS table — is a HOST
  // problem, and it is settled here, before a byte of the document is parsed,
  // so it can never be mistaken for a finding about the document.
  const shapeProblem = pdfjsShapeProblem(pdfjs)
  if (shapeProblem !== undefined) return failure('pdfjs_incompatible', { detail: shapeProblem })

  // pdfjs may take ownership of the buffer it is handed; copy so the caller's
  // ArrayBuffer is never detached out from under them.
  const owned = new Uint8Array(bytes)

  // Opened before the extraction body rather than inside it. A conforming
  // getDocument returns a task whose PROMISE rejects for a bad document; a
  // synchronous throw means the parameter object was rejected outright, which
  // is the same host-build problem as a failed shape check and gets the same
  // answer — never `corrupt`, which would blame the user's file for it.
  let opened: ReturnType<typeof pdfjs.getDocument>
  try {
    opened = pdfjs.getDocument({
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
  } catch (error) {
    return failure('pdfjs_incompatible', { detail: exceptionMessage(error) })
  }
  // Bound outside the try below so `finally` can always release it.
  const loadingTask = opened

  try {
    const doc = await loadingTask.promise
    const totalPages = doc.numPages
    if (totalPages > maxPages) return failure('too_many_pages', { limit: maxPages })

    const imagePaintOps = new Set<number>(IMAGE_PAINT_OPS.map((op) => pdfjs.OPS[op]))

    const pages: DocumentPage[] = []
    // Pages pdfjs could not read. They are NOT pushed into `pages`: there is no
    // honest DocumentPage for a page nobody read, and every value one could
    // carry is a claim — `text: ''` says blank, `imageOnly: true` says scanned.
    const unreadablePages: number[] = []
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

      const remaining = maxTotalTextChars - totalTextChars
      let page: Awaited<ReturnType<typeof doc.getPage>> | null = null
      try {
        page = await doc.getPage(pageNumber)
        const content = await page.getTextContent()
        // The caps are applied AS the text is read, not to a concatenation of
        // the whole page; see readPageText.
        const read = readPageText(content.items, maxPageTextChars, remaining)
        // Whether the page HAD a text layer is decided on what pdfjs read,
        // before any cap touches it. Deciding it after truncation would let a
        // tight `maxPageTextChars` manufacture an image-only verdict about a page
        // whose text was read perfectly.
        if (read.hadText) anyPageHadText = true
        if (read.clippedByPageCap) truncatedBy.add('page_text_cap')
        if (read.clippedByDocumentCap) truncatedBy.add('document_text_cap')

        // Only a page with nothing to read is worth the extra operator-list
        // pass; that pass is what separates a scanned page from a blank one.
        let imageOnly = false
        if (!read.hadText) {
          const operators = await page.getOperatorList()
          imageOnly = operators.fnArray.some((fn: number) => imagePaintOps.has(fn))
        }

        totalTextChars += read.text.length
        pages.push({
          page: pageNumber,
          text: read.text,
          imageOnly,
          truncated: read.clippedByPageCap || read.clippedByDocumentCap,
        })
      } catch (error) {
        // ONE damaged page is not a damaged document. Discarding every page
        // already extracted because page 2 of 3 threw would throw away text
        // that was read perfectly and answer `corrupt` about a statement whose
        // other pages are fine. The page is recorded as unreadable and the run
        // continues; `summary.unreadablePages` is what says so.
        //
        // A password demand is the exception: it is a fact about the whole
        // document and there is a truer reason for it, so it goes to the
        // document-level handler.
        if (exceptionName(error) === 'PasswordException') throw error
        unreadablePages.push(pageNumber)
      } finally {
        // Best-effort, and never allowed to mask the page's real outcome.
        try {
          page?.cleanup()
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
        unreadablePages,
        imageOnlyPages: pages.filter((page) => page.imageOnly).length,
        // "Every page we read had no text", never "we read no pages", never
        // "a cap clipped everything away", and never "some page defeated us".
        // A zero-page document, or one the total-text cap stopped before page
        // 1, has no scanned page to send anyone to OCR over; text that was read
        // and then truncated was still read; and a page that could not be read
        // is not a page known to be text-free.
        noTextExtracted: pages.length > 0 && !anyPageHadText && unreadablePages.length === 0,
        totalTextChars,
        truncated: truncatedBy.size > 0,
        truncatedBy: [...truncatedBy],
      },
    }
  } catch (error) {
    // Nothing escapes as a throw — the caller's contract is a result union —
    // but WHICH answer depends on who failed. `corrupt` is a sentence about
    // the user's file ("may be damaged or only partly downloaded") and is only
    // said when pdfjs itself said so; anything else is `extraction_failed`,
    // which blames nobody's document. See `throwReason`.
    const reason = throwReason(error)
    return reason === 'encrypted' ? failure('encrypted') : failure(reason, { detail: exceptionMessage(error) })
  } finally {
    // A throw from `finally` would replace the result we just computed, which
    // would break the never-throws contract on the way out the door. Releasing
    // the parser is best-effort.
    try {
      await loadingTask.destroy()
    } catch {
      /* nothing useful to do; the result is already decided */
    }
  }
}
