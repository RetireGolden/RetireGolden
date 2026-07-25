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
 * **The pdfjs dependency is an OPTIONAL peer, and a host may hand it in.**
 * `pdfjs-dist` is declared in `peerDependencies` with
 * `peerDependenciesMeta.optional`, and the import below is dynamic, so the
 * module is never evaluated — and the peer never needed — unless a caller
 * actually extracts a document. A host that never imports this subpath pays
 * nothing: npm does not install the peer, and a bundler never reaches the
 * import. A host that DOES import it either installs `pdfjs-dist` and lets the
 * dynamic import below find it, or imports pdfjs itself and passes the module
 * as `options.pdfjs`; if neither happened the failure is reported as
 * `pdfjs_unavailable`, not thrown.
 *
 * **Which of the two, and why the choice is not cosmetic.** The dynamic import
 * below resolves a BARE package specifier, which only a runtime that does
 * node-style resolution can do: Node, an SSR render, an Electron main process.
 * A browser cannot resolve `pdfjs-dist/...` at all, and a bundler is not asked
 * to (the specifier is deliberately opaque to it, so a host without the peer
 * still BUILDS — see {@link PDFJS_ENTRY}). So in a browser bundle the import
 * can only fail, and `options.pdfjs` is THE path: the host writes its own
 * `import()` of `pdfjs-dist/legacy/build/pdf.mjs`, which its own bundler
 * resolves and chunks correctly, and hands the module over. (Spelled with the
 * specifier outside the call throughout this file, prose included: the
 * source-scan test forbids a literal `import(` of the package name anywhere in
 * this source, and a guard that has to reason about which occurrences are
 * comments is a guard that can be argued with.) A library cannot resolve a
 * bare specifier on its host's behalf; the host can. When `options.pdfjs` is
 * given it is used exactly as supplied and no import is attempted here at all —
 * including the worker import, so a host taking this path imports
 * `pdf.worker.mjs` itself if it wants the worker-free main-thread mode
 * described below. Three separate host conditions get three
 * separate reasons, because their remedies differ and because a wrong one is a
 * false statement: `pdfjs_unavailable` (the package is not installed — its
 * specifier would not RESOLVE), `pdfjs_worker_unavailable` (a pdfjs is present
 * but has no worker to run in: its worker module would not load, or — on the
 * injected path — the host imported none), and `pdfjs_incompatible` (the
 * build present does not expose the API this module drives, or would not
 * evaluate at all — telling a host to install what it has already installed
 * points at a remedy that cannot work). None of the three is ever reported as a
 * problem with the user's document. (The package also keeps `pdfjs-dist` as a
 * devDependency purely so this repo's `tsc -b` and vitest can resolve it.)
 *
 * **Worker-free by construction — on the path where this module imports.**
 * pdfjs normally spawns a Web Worker from a separately hosted `pdf.worker.mjs`
 * asset. Importing that module on the main thread instead sets
 * `globalThis.pdfjsWorker`, which pdfjs checks first and treats as a
 * main-thread message handler — so no `new Worker(...)` call is made and no
 * worker asset has to be hosted, in Node, in an Electron renderer, or in a
 * browser alike. (In Node pdfjs disables the worker on its own, but the
 * explicit import is what makes the browser and Electron-renderer paths work.)
 *
 * **A supplied module opts out of that, so the condition is NAMED, not
 * pre-empted.** When the host passes `options.pdfjs`, nothing is imported here
 * — the worker module included — so a browser host that injected only `pdf.mjs`
 * leaves pdfjs hunting for a worker asset. That is deliberately not refused up
 * front on a "is `globalThis.pdfjsWorker` set?" test, because an unset one is
 * not by itself a fault: in Node and in an Electron main process pdfjs disables
 * the worker on its own and needs nothing, and a host that hosts the asset and
 * sets `GlobalWorkerOptions.workerSrc` is correctly configured too. Refusing
 * either would be a false failure about a setup that works. What IS the fault
 * is pdfjs then failing to obtain any worker, and it says so in its own words —
 * `No "GlobalWorkerOptions.workerSrc" specified.`, thrown synchronously out of
 * `getDocument`, or `Setting up fake worker failed: …` from the loading task.
 * Both are recognised and reported as `pdfjs_worker_unavailable`, with the
 * injected path's remedy (import `pdf.worker.mjs` as well), instead of
 * `pdfjs_incompatible` or `extraction_failed` — neither of which names the
 * thing that went wrong. See {@link isWorkerSetupFailure}.
 *
 * **What the caps bound, precisely.** Extraction runs on the calling thread,
 * and the caps below bound the text RETAINED and the peak of THIS module's own
 * accumulation: a page's text is taken through pdfjs's streaming text API and
 * appended only while it is inside the budget, so the high-water mark here is
 * one batch of items plus a string no longer than the cap — rather than the
 * whole page's items array that `getTextContent()` materializes before it
 * resolves (see `readPageText`). They bound nothing INSIDE pdfjs. A content
 * stream that decompresses enormously is still decompressed and its glyphs are
 * still produced, and the CPU and the pdfjs-internal memory that costs are not
 * governed by any number here — the document sits well inside the byte and page
 * caps the whole time. Bounding that is follow-up work, not spike work; saying
 * these caps already do it would be a stronger claim than this module can make.
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
   * This is exactly what it measures, and no more: no text layer, and at least
   * one raster paint operator. It does not judge how much of the page the
   * raster covers, so a textless cover or separator page carrying only a logo,
   * watermark or signature reads as image-only too. Deciding otherwise means
   * reconstructing the CTM across the graphics-state stack — the paint
   * operator's own arguments carry intrinsic pixel dimensions, not rendered
   * size — and then choosing a coverage threshold that could only be validated
   * against real scanned documents. A threshold guessed against synthetic
   * fixtures would err toward calling a cropped or low-DPI scan blank, which is
   * the direction that hurts. Left as follow-up rather than guessed at.
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
   *
   * Never every page the document declared, either: a document whose pages ALL
   * failed is not a successful extraction of nothing, so it comes back as
   * `corrupt` or `extraction_failed` instead of a result whose `pages` is empty
   * and whose `unreadablePages` lists the lot.
   */
  readonly unreadablePages: readonly number[]
  /** How many extracted pages were image-only. */
  readonly imageOnlyPages: number
  /**
   * True when the whole document yielded no text at all AND at least one page
   * is a scanned image — a fully scanned document, the honest "this needs OCR"
   * signal at document level.
   *
   * False when every extracted page was genuinely BLANK
   * ({@link imageOnlyPages} is zero): a run of empty separator pages also
   * yielded no text, but there is no ink anywhere for an OCR pass to recover,
   * so sending a user to OCR over it would waste their time on a document that
   * was read correctly and is simply empty. `pagesExtracted` with
   * `totalTextChars === 0` is what describes that document; this flag is
   * narrower on purpose.
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
   * No pdfjs was reachable: the host passed none as `options.pdfjs`, and the
   * optional `pdfjs-dist` peer's main entry point could not be RESOLVED at all
   * — either it is not installed, or this is a browser bundle, where a bare
   * package specifier cannot be resolved at run time and injection is the only
   * route. The message names both remedies for that reason. A peer that
   * resolves and then fails is never reported here: "install pdfjs-dist" is a
   * false instruction to a host that already did.
   */
  | 'pdfjs_unavailable'
  /**
   * A pdfjs is present, but it has no worker to run in: this module's own
   * import of the main-thread worker module failed, or — on the injected path,
   * where no import of ours runs at all — pdfjs itself reported that it could
   * find no worker of any kind, which is what a host that passed `pdf.mjs`
   * without `pdf.worker.mjs` gets. Distinct from `pdfjs_unavailable` because
   * the remedy is different and because "the optional pdfjs-dist package is not
   * installed" would be a false sentence to show a host that installed it, and
   * distinct from `pdfjs_incompatible` because the build is fine — it is the
   * worker that is missing. The message names the remedy for the path the call
   * actually took.
   */
  | 'pdfjs_worker_unavailable'
  /**
   * The pdfjs build this host supplies is not one this module can drive — it
   * is missing an API used here (`getDocument`, `VerbosityLevel`, the `OPS`
   * paint operators), rejected the parameter object outright, or resolved and
   * then threw while it evaluated (an initialization fault, a runtime below its
   * engine floor). A host integration problem, never a statement about the
   * user's document, and never one an install would fix.
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
 * A pdfjs module supplied by the host — whatever the host's own `import()` of
 * `pdfjs-dist/legacy/build/pdf.mjs` resolved to in its build.
 *
 * Deliberately structural and deliberately LOOSE. Naming
 * `typeof import('pdfjs-dist/...')` here would tie a published type to one
 * build of an OPTIONAL peer: a host on a different pdfjs major, or one that
 * re-exports its own wrapper, would face a type error over a module this code
 * can drive perfectly well, and a host that does not install the peer at all
 * could not even typecheck against this signature. Every member is `unknown`
 * because none of them is trusted on the strength of a type anyway —
 * {@link pdfjsShapeProblem} inspects the real object before a byte of the
 * document is parsed, so a structurally wrong module is answered with
 * `pdfjs_incompatible` rather than crashing somewhere inside extraction.
 */
export interface HostPdfjsModule {
  readonly getDocument?: unknown
  readonly VerbosityLevel?: unknown
  readonly OPS?: unknown
}

/**
 * Per-call limits, and the host's own pdfjs if it has one. Every cap may only
 * be made *stricter*: a host may tighten what it is willing to process, but the
 * exported constants are the ceiling this module promises, so a caller cannot
 * raise them into territory the module has never been exercised in.
 */
export interface ExtractDocumentTextOptions {
  readonly maxBytes?: number
  readonly maxPages?: number
  readonly maxPageTextChars?: number
  readonly maxTotalTextChars?: number
  /**
   * The pdfjs module to use, instead of importing one. **This is the browser
   * path** — see the module header: a bundled page cannot resolve the bare
   * `pdfjs-dist` specifier this module would otherwise import, but the host's
   * own `import()` of `pdfjs-dist/legacy/build/pdf.mjs` is resolved and chunked
   * by the host's bundler, so the host is the only party that can produce the
   * module at all. When it is present no import is attempted here, which also
   * means the main-thread worker module is the host's to import — and if it
   * did not, and pdfjs can find no worker, the call comes back as
   * `pdfjs_worker_unavailable` naming that import rather than as a vague
   * `extraction_failed` (see the worker paragraphs in the module header).
   * Omit it in Node, SSR, or an
   * Electron main process, where the bare specifier resolves at run time and
   * the zero-config import below is what this repo's own tests and benchmark
   * use.
   */
  readonly pdfjs?: HostPdfjsModule
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
  /**
   * The host supplied its own pdfjs, so a remedy naming this package's own
   * import is not its remedy. Only `pdfjs_worker_unavailable` reads it: the
   * host that let this module import pdfjs is told its worker subpath would not
   * load, and the host that injected a module is told to import the worker
   * module too — which is the whole of what it is missing.
   */
  readonly supplied?: boolean
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
      // Both remedies, because only one of them works in a browser. A message
      // naming the install alone sends a bundled host to a fix that cannot
      // work: the package may be installed already and a browser still cannot
      // resolve its bare specifier at run time.
      return 'PDF reading is unavailable in this app because the optional "pdfjs-dist" package is not installed. Install it, or — in a browser bundle, where the package name cannot be resolved at run time — import pdfjs in the app itself and pass it as options.pdfjs.'
    case 'pdfjs_worker_unavailable': {
      // A host that passed its own pdfjs in never reached this module's worker
      // import at all, so "its main-thread worker module could not be loaded"
      // would describe an import that never ran. What that host is missing is
      // its OWN import of `pdf.worker.mjs`, and that is what it is told.
      const because = context.detail ? ` (${context.detail})` : ''
      return context.supplied === true
        ? `PDF reading is unavailable in this app: the pdfjs module this app supplied has no main-thread worker, and pdfjs could not load a worker any other way${because}. Import "pdfjs-dist/legacy/build/pdf.worker.mjs" alongside it — that import is what makes pdfjs run worker-free.`
        : `PDF reading is unavailable in this app: "pdfjs-dist" is installed, but its main-thread worker module could not be loaded${because}.`
    }
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

/**
 * The pdfjs API surface this module drives, described STRUCTURALLY rather than
 * as `typeof import('pdfjs-dist/...')`.
 *
 * A type query would make the optional peer mandatory for TypeScript even
 * though it is optional at run time: the compiler has to resolve the package to
 * answer the query, so a consumer who imports this subpath without installing
 * `pdfjs-dist` gets TS2307 while the code itself would have run and returned
 * `pdfjs_unavailable`. This package ships `.ts` source, so `skipLibCheck` does
 * not spare them either — the error lands in their own build. That is the same
 * blind spot the bundler had, in a different tool: the import is erased at run
 * time, and a type that names it is not.
 *
 * Nothing is lost by describing it here. Every member is validated on the real
 * object by {@link pdfjsShapeProblem} before a byte is parsed, precisely because
 * the peer is host-supplied and a type is not evidence about it.
 */
interface PdfjsModule {
  getDocument: (params: {
    data: Uint8Array
    useWorkerFetch: boolean
    useSystemFonts: boolean
    disableFontFace: boolean
    verbosity: unknown
  }) => PdfLoadingTask
  VerbosityLevel: { ERRORS: unknown }
  OPS: Record<string, number>
}

/** The loading task `getDocument` returns, structurally. */
interface PdfLoadingTask {
  readonly promise: Promise<PdfDocument>
  destroy: () => Promise<void>
}

/** The document API this module drives, structurally. */
interface PdfDocument {
  readonly numPages: number
  getPage: (pageNumber: number) => Promise<PdfPage>
}

/** The page API, beyond the text members {@link PdfPageText} describes. */
interface PdfPage extends PdfPageText {
  getOperatorList: () => Promise<{ fnArray: readonly number[] }>
  cleanup: () => void
}

/**
 * The peer's entry points, held in variables instead of being written as
 * literal specifiers in the `import()` calls below.
 *
 * A literal specifier is resolved by Vite and Rollup during dependency
 * scanning, so a host that never installs the optional peer fails to BUILD —
 * before `extractDocumentText` could ever return `pdfjs_unavailable`. This
 * package ships source for exactly those bundlers, so the optional-peer design
 * would be defeated for its target consumers. An indirect specifier, marked
 * `@vite-ignore` (the conventional way to tell a bundler an import is
 * deliberately unanalyzable), defers resolution to runtime and is what makes
 * the documented fallback reachable at all. The `typeof import(...)` above is a
 * TYPE position and is erased before any bundler sees it.
 *
 * Deferring to runtime is also why these are only HALF the story: a browser
 * bundle then reaches a bare npm specifier it cannot resolve, and would report
 * `pdfjs_unavailable` to a host that installed pdfjs perfectly well. That host
 * passes its own module as `options.pdfjs` and none of this runs. Making the
 * specifier opaque buys the build; injection is what buys the browser.
 */
const PDFJS_ENTRY = 'pdfjs-dist/legacy/build/pdf.mjs'
const PDFJS_WORKER_ENTRY = 'pdfjs-dist/legacy/build/pdf.worker.mjs'

/** Either pdfjs, or the reason this host cannot give us a usable one. */
type PdfjsLoad =
  | { readonly ok: true; readonly pdfjs: PdfjsModule }
  | {
      readonly ok: false
      readonly reason: 'pdfjs_unavailable' | 'pdfjs_worker_unavailable' | 'pdfjs_incompatible'
      readonly detail?: string
    }

/** Node's names for "that specifier resolves to nothing" (ESM, then CommonJS). */
const MODULE_RESOLUTION_CODES: ReadonlySet<unknown> = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'])

/**
 * What a loader that carries no `code` says instead — and in a BROWSER that is
 * all there is, because no browser supplies `code` at all. So this list decides
 * the reason single-handedly on the one platform where the remedy it points at
 * (`options.pdfjs`) is the only one that can work, which is why it has to cover
 * every engine rather than the one the first test happened to be written from.
 * Each browser phrases an unresolvable bare specifier differently:
 *
 * - Chromium: `Failed to resolve module specifier 'pdfjs-dist/…'` —
 * - Firefox: `The specifier “pdfjs-dist/…” was a bare specifier, but was not
 *   remapped to anything.`
 * - Safari: `Module name, 'pdfjs-dist/…' does not resolve to a valid URL.`
 * - any of them, when the failure surfaces on the script rather than the
 *   specifier: `Importing a module script failed.`
 *
 * Only the first matched a Chromium-shaped wording, so Firefox and Safari were
 * told `pdfjs_incompatible` — "the installed pdfjs-dist build is not one this
 * app can use" — about a package that was never installed, and never saw the
 * remedy that works in a browser.
 */
const MODULE_RESOLUTION_MESSAGE =
  /cannot find (?:module|package)|module not found|failed to resolve|cannot resolve|does not resolve|bare specifier|importing a module script failed/i

/**
 * Did this import fail because the module could not be RESOLVED — the peer is
 * genuinely absent — rather than resolving and then throwing while it
 * evaluated?
 *
 * Only the first may be answered with `pdfjs_unavailable`. A build that IS
 * installed but will not initialize — a runtime below its engine floor, a throw
 * at module scope — would otherwise be told to install a package it already
 * has: a false sentence pointing at a remedy that cannot work.
 *
 * Node names the condition with a code, but a bundler's loader raises whatever
 * it likes and no code is guaranteed, so the message is matched as well — and
 * both are matched down the `cause` chain, because a loader that wraps the
 * failure in its own error (Vite, and vitest's module mocker) leaves the only
 * evidence there. Matching defensively is the point: a missed match costs a host
 * the `pdfjs_unavailable` wording, while a wrong one tells them to install what
 * they already have.
 */
function isModuleResolutionFailure(error: unknown): boolean {
  // Bounded, because an error's `cause` may be cyclic.
  for (let link: unknown = error, depth = 0; link != null && depth < 8; depth++) {
    const wrapped = link as { code?: unknown; cause?: unknown }
    if (MODULE_RESOLUTION_CODES.has(wrapped.code)) return true
    if (MODULE_RESOLUTION_MESSAGE.test(exceptionMessage(link) ?? '')) return true
    link = wrapped.cause
  }
  return false
}

/**
 * pdfjs's own words for "I could not get a worker of any kind".
 *
 * `No "GlobalWorkerOptions.workerSrc" specified.` comes out of `getDocument`
 * SYNCHRONOUSLY (pdfjs constructs its `PDFWorker` before it returns the loading
 * task), and `Setting up fake worker failed: "…"` rejects the loading task's
 * promise after the main-thread fallback's own import failed. Matched on
 * wording because neither carries a distinguishing exception name — both are
 * plain `Error`s — and matched narrowly, on strings that exist nowhere else in
 * pdfjs, so nothing about the user's document can land here.
 */
const WORKER_SETUP_MESSAGE = /workerSrc|setting up fake worker/i

/** Is this throw pdfjs saying it has no worker, rather than anything else? */
function isWorkerSetupFailure(error: unknown): boolean {
  return WORKER_SETUP_MESSAGE.test(exceptionMessage(error) ?? '')
}

/**
 * Take the host's pdfjs, or load one and force its main-thread (worker-free)
 * path. See the module header: importing the worker module sets
 * `globalThis.pdfjsWorker`, which pdfjs consults before it would ever construct
 * a `Worker`.
 *
 * **A supplied module short-circuits everything below.** It is already resolved
 * — by the host's own bundler, which is the only party that could resolve it in
 * a browser — so importing anything here would at best duplicate it and at
 * worst fail on a specifier the host has already worked around. It is NOT
 * trusted on arrival: `pdfjsShapeProblem` inspects it in the caller, before any
 * document is parsed, so a wrong object is `pdfjs_incompatible` and never a
 * verdict about the user's file.
 *
 * **`allSettled`, not `all`.** The two imports fail for different reasons and
 * deserve different answers. A single catch over both could only report one,
 * and the one it reported — "the optional pdfjs-dist package is not installed"
 * — is FALSE of the host whose problem is the worker subpath alone: a build
 * that relocated `pdf.worker.mjs`, a bundler that resolves the main entry and
 * not that one. They still run concurrently; only the reporting is split.
 */
async function loadPdfjs(supplied: HostPdfjsModule | undefined): Promise<PdfjsLoad> {
  if (supplied !== undefined && supplied !== null) {
    return { ok: true, pdfjs: supplied as unknown as PdfjsModule }
  }
  const [core, worker] = await Promise.allSettled([
    import(/* @vite-ignore */ PDFJS_ENTRY) as Promise<PdfjsModule>,
    // Imported for its side effect (setting globalThis.pdfjsWorker); its
    // exports are never touched.
    import(/* @vite-ignore */ PDFJS_WORKER_ENTRY),
  ])
  if (core.status === 'rejected') {
    // "Not installed" is reserved for an import that could not RESOLVE. One that
    // resolved and then rejected while evaluating names a build this host cannot
    // drive, which is the `pdfjs_incompatible` remedy, not an install.
    return {
      ok: false,
      reason: isModuleResolutionFailure(core.reason) ? 'pdfjs_unavailable' : 'pdfjs_incompatible',
      detail: exceptionMessage(core.reason),
    }
  }
  if (worker.status === 'rejected') {
    // Both halves of this one keep the same reason: "installed, but its
    // main-thread worker module could not be loaded" is true of a worker
    // subpath that will not resolve and of one that will not evaluate alike.
    return { ok: false, reason: 'pdfjs_worker_unavailable', detail: exceptionMessage(worker.reason) }
  }
  return { ok: true, pdfjs: core.value }
}

/**
 * The operators that mean "a raster was painted here". Their presence on a
 * page that yielded no text is what separates a scanned page from a blank one.
 */
/**
 * Every operator pdfjs may use to paint a raster. All of them, not the obvious
 * four: which one pdfjs emits is an internal optimization — it groups repeated
 * masks, folds a single-colour mask into `paintSolidColorImageMask`, and batches
 * inline images — so recognising only some makes image-only detection depend on
 * a choice pdfjs makes about the file's encoding. Missing one reports a scanned
 * page as BLANK, which is the wrong direction to be wrong in: it tells a user
 * their statement is empty when it needs OCR.
 */
const IMAGE_PAINT_OPS = [
  'paintImageXObject',
  'paintImageXObjectRepeat',
  'paintInlineImageXObject',
  'paintInlineImageXObjectGroup',
  'paintImageMaskXObject',
  'paintImageMaskXObjectGroup',
  'paintImageMaskXObjectRepeat',
  'paintSolidColorImageMask',
] as const

/**
 * The subset the shape check insists on. The grouped and optimized variants are
 * recognised when present but not REQUIRED: they have come and gone across pdfjs
 * versions, and refusing a host's build over one it does not happen to expose
 * would report a perfectly usable pdfjs as incompatible.
 */
const REQUIRED_IMAGE_PAINT_OPS = [
  'paintImageXObject',
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
    for (const op of REQUIRED_IMAGE_PAINT_OPS) {
      if (typeof ops[op] !== 'number') return `its OPS table has no ${op}`
    }
  } catch (error) {
    return exceptionMessage(error) ?? 'its exports could not be inspected'
  }
  return undefined
}

/**
 * A text-carrying entry of a text-content batch. The same batch also yields
 * marked-content markers, which carry no text; only the entries with a `str`
 * are glyphs. Structural rather than imported so this stays independent of the
 * pdfjs build a host supplies.
 */
interface TextContentGlyphs {
  readonly str: string
  readonly hasEOL?: boolean
}

function isGlyphItem(item: unknown): item is TextContentGlyphs {
  return typeof item === 'object' && item !== null && typeof (item as { str?: unknown }).str === 'string'
}

/**
 * The page API this module drives, structurally, for the same reason as
 * {@link TextContentGlyphs}: the peer is host-supplied. `streamTextContent` is
 * OPTIONAL here on purpose — a build without it must still read, through
 * `getTextContent`, rather than be reported as a broken document.
 */
interface PdfPageText {
  streamTextContent?: () => unknown
  getTextContent: () => Promise<{ items: Iterable<unknown> }>
}

/** One batch of text items off the streaming API. */
interface TextContentChunk {
  readonly items?: Iterable<unknown>
}

/** The `ReadableStream` reader member this module uses, structurally. */
interface TextContentStreamReader {
  read: () => Promise<{ done?: boolean; value?: TextContentChunk }>
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
 * Accumulate one page's text items, batch by batch, into at most
 * `min(maxPageTextChars, remaining)` characters.
 *
 * **The caps bound this module's PEAK, not merely its result.** Concatenating
 * every item and slicing afterwards produces exactly the same string and bounds
 * nothing about the accumulation: the intermediate is as large as the page,
 * built on the calling thread — the thread this module deliberately runs pdfjs
 * on — so a pathological page could exhaust memory (or outgrow the engine's
 * maximum string length) before any cap was consulted. That is what this file
 * can bound and does. What no cap here bounds is what pdfjs spends producing
 * the page in the first place; the module header says so plainly rather than
 * letting "the caps keep the work bounded" stand for more than it is.
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
 * `push` answers false as soon as `trimmedLength` passes the EFFECTIVE budget —
 * `min(maxPageTextChars, remaining)`, the same number the retained text is
 * clipped to. Stopping at the page cap alone would keep inspecting and copying
 * up to `MAX_PAGE_TEXT_CHARS` characters of a page whose text was going to be
 * discarded on arrival, which every document nearly out of its total budget
 * pays on its last page. At the effective budget every flag below is already
 * decided and every further character would be clipped away, so the rest of the
 * page cannot change one byte of the answer and none of it is looked at again.
 * (`readPageText` still READS the rest of the stream — dropping each chunk
 * unopened — because abandoning it would hang the call. What stops here is the
 * accumulating, which is what these caps are about.)
 *
 * Which cap gets the blame is unchanged by that, because each flag is still
 * read off the cap it belongs to. When the PAGE cap is the smaller, the stop
 * happens exactly where it always did and `clippedByPageCap` is decided on the
 * same comparison as before. When the DOCUMENT budget is the smaller, it is the
 * budget that clipped and `clippedByDocumentCap` says so; the page cap did not
 * clip anything and is not claimed to have. Establishing that it *would* have
 * clipped is counting nobody needs, and stopping here is what avoids it.
 */
function createPageTextReader(maxPageTextChars: number, remaining: number) {
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

  return {
    /** Feed one batch; false means no further item can change the answer. */
    push(items: Iterable<unknown>): boolean {
      for (const item of items) {
        if (!isGlyphItem(item)) continue
        append(item.str)
        if (item.hasEOL) append('\n')
        // The EFFECTIVE budget, not the page cap: past it nothing more is kept
        // and nothing more can be learned, whichever cap supplied it.
        if (trimmedLength > budget) return false
      }
      return true
    },
    result(): PageTextReading {
      return {
        // Past the budget, the kept prefix IS the answer. Short of it, `kept`
        // holds the whole page and only its trailing whitespace has still to
        // come off.
        text: trimmedLength > budget ? kept : kept.trimEnd(),
        hadText: trimmedLength > 0,
        // True exactly when the text read passed the page cap. Reading stops at
        // the effective budget, so when the document budget was the smaller one
        // this stays false — the page cap clipped nothing, and the document cap
        // below is what did.
        clippedByPageCap: trimmedLength > maxPageTextChars,
        // What the document budget sees is the already page-capped text, so the
        // page cap is the ceiling on what it can clip.
        clippedByDocumentCap: Math.min(trimmedLength, maxPageTextChars) > remaining,
      }
    },
  }
}

/**
 * Open the page's STREAMING text API, or `null` when this build has none usable.
 *
 * Guarded end to end, and the fall-back is deliberate: the peer is
 * host-supplied, so `streamTextContent` may be absent (an older or trimmed
 * build), may not return a `ReadableStream`, or may throw on the way. None of
 * those is a finding about the user's document, and none of them needs to be
 * fatal while `getTextContent` remains.
 */
function openTextStream(page: PdfPageText): TextContentStreamReader | null {
  try {
    if (typeof page.streamTextContent !== 'function') return null
    const stream = page.streamTextContent() as { getReader?: () => TextContentStreamReader } | null | undefined
    if (typeof stream?.getReader !== 'function') return null
    const reader = stream.getReader()
    return typeof reader?.read === 'function' ? reader : null
  } catch {
    return null
  }
}

/**
 * Read one page's text under both caps, taking the text INCREMENTALLY.
 *
 * `getTextContent()` builds the complete items array — every string on the page
 * — before it resolves, so applying the caps to its result bounds the answer
 * and nothing else: a content stream that decompresses enormously still
 * materializes in full, on the calling thread, while the document sits well
 * inside the byte and page caps. `streamTextContent()` hands the same items
 * over in batches, so reading stops at the cap instead of after the page has
 * already been built.
 *
 * The fallback path is not decoration: the peer is optional and host-supplied,
 * so a build without the streaming API must still read a document rather than
 * fail one.
 *
 * **The stream is DRAINED to completion; only the accumulating stops.** Once
 * the caps have decided the answer, every further chunk is taken off the stream
 * and dropped unopened — not one of its items is looked at — but the reading
 * itself continues until the stream ends on its own. That is not politeness, it
 * is the only ending that settles:
 *
 * - **Abandoning the stream hangs the call.** pdfjs's producer awaits its
 *   sink's `ready` once the queue is full (it flushes every 100 items), so a
 *   reader that stops mid-page leaves that await pending forever — and
 *   `loadingTask.destroy()` in the extraction loop's `finally` waits on the
 *   page's outstanding task, so the promise this module returns NEVER SETTLES.
 *   `page.cleanup()` does release the page, which is what made this look safe;
 *   `destroy()` is the one that does not. Measured on pdfjs 6 with a
 *   many-item page: `maxTotalTextChars: 10` and `maxPageTextChars: 10` both
 *   hang, and both settle once the stream is drained.
 * - **`reader.cancel()` is not the alternative.** On pdfjs 6 the cancel closes
 *   the web-stream controller without setting the `isClosed` flag pdfjs guards
 *   on, so the producer's already-queued CLOSE calls `controller.close()` on a
 *   closed controller and throws inside a pdfjs promise chain nobody owns — an
 *   UNHANDLED rejection in the host, raised by a document that read perfectly,
 *   and one no guard at this call site can catch. Draining needs no cancel at
 *   all: there is nothing left to cancel when the stream closes itself.
 *
 * **What draining costs, and what it still buys.** It costs the production of
 * the whole page: pdfjs decodes the content stream and builds every item either
 * way, so the caps do not bound that and this module does not claim they do.
 * What it buys is the memory the streaming change was for — the peak here is
 * one batch plus a string no longer than the budget, instead of the entire
 * items array `getTextContent()` assembles before it resolves, plus that
 * string. See the caps paragraph in the module header.
 */
async function readPageText(
  page: PdfPageText,
  maxPageTextChars: number,
  remaining: number,
): Promise<PageTextReading> {
  const reader = createPageTextReader(maxPageTextChars, remaining)
  const stream = openTextStream(page)
  if (stream === null) {
    reader.push((await page.getTextContent()).items)
    return reader.result()
  }

  let accumulating = true
  for (;;) {
    const chunk = await stream.read()
    if (chunk.done === true) break
    // Past the budget the chunk is dropped without being inspected — nothing in
    // it can change the answer, and touching it would be the copying the caps
    // exist to avoid. Reading itself continues; see above.
    if (accumulating) accumulating = reader.push(chunk.value?.items ?? [])
  }
  return reader.result()
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

  // pdfjs may take ownership of the buffer it is handed, so the caller's is
  // never the one parsed. The copy is taken SYNCHRONOUSLY, before the first
  // await: a caller may transfer their buffer the moment this call hands back
  // its promise, and a copy taken after an await would find a detached view and
  // throw a `TypeError` straight out of the result union this module promises.
  // Guarded even so, because "the input could not be read" is a reason here, not
  // an exception.
  let owned: Uint8Array
  try {
    owned = new Uint8Array(bytes)
  } catch {
    return failure('unreadable_input')
  }

  let loaded: PdfjsLoad
  try {
    loaded = await loadPdfjs(opts.pdfjs)
  } catch (error) {
    // `loadPdfjs` settles both imports rather than throwing, so this is only
    // reachable if the import machinery itself failed synchronously. The same
    // split applies: only a resolution failure means the peer is absent.
    loaded = {
      ok: false,
      reason: isModuleResolutionFailure(error) ? 'pdfjs_unavailable' : 'pdfjs_incompatible',
      detail: exceptionMessage(error),
    }
  }
  if (!loaded.ok) return failure(loaded.reason, { detail: loaded.detail })
  const pdfjs = loaded.pdfjs

  // The peer is optional, so a host may supply its own pdfjs build — through
  // `options.pdfjs`, or by installing a version of its choosing for the import
  // above. One that is shaped differently — a missing VerbosityLevel, no OPS
  // table — is a HOST problem, and it is settled here, before a byte of the
  // document is parsed, so it can never be mistaken for a finding about the
  // document.
  const shapeProblem = pdfjsShapeProblem(pdfjs)
  if (shapeProblem !== undefined) return failure('pdfjs_incompatible', { detail: shapeProblem })

  // Whether the host handed us the module. Only the worker reason reads it, and
  // only to name the remedy that belongs to the path this call actually took.
  const supplied = opts.pdfjs !== undefined && opts.pdfjs !== null

  // Opened before the extraction body rather than inside it. A conforming
  // getDocument returns a task whose PROMISE rejects for a bad document; a
  // synchronous throw means the parameter object was rejected outright, which
  // is the same host-build problem as a failed shape check and gets the same
  // answer — never `corrupt`, which would blame the user's file for it. The one
  // exception is pdfjs's own "I have no worker" throw: pdfjs constructs its
  // PDFWorker inside `getDocument`, so a host that injected `pdf.mjs` without
  // `pdf.worker.mjs` lands HERE, and calling that an incompatible build would
  // name neither the condition nor its remedy.
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
    const detail = exceptionMessage(error)
    return isWorkerSetupFailure(error)
      ? failure('pdfjs_worker_unavailable', { detail, supplied })
      : failure('pdfjs_incompatible', { detail })
  }
  // Bound outside the try below so `finally` can always release it.
  const loadingTask = opened

  try {
    const doc = await loadingTask.promise
    const totalPages = doc.numPages
    if (totalPages > maxPages) return failure('too_many_pages', { limit: maxPages })

    // Whichever of the paint operators this build actually exposes; an absent one
    // simply contributes nothing rather than a NaN that matches no operator.
    const imagePaintOps = new Set<number>(
      IMAGE_PAINT_OPS.map((op) => pdfjs.OPS[op]).filter((fn): fn is number => typeof fn === 'number'),
    )

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
    // The first page fault of any kind, and the first that pdfjs itself called a
    // fault in the DOCUMENT's bytes. Kept only for the all-pages-failed verdict
    // after the loop, which owes the caller the same reason split the
    // document-level handler makes — and can only make it from the throws it
    // saw. One fault each, rather than every error a 300-page document could
    // raise.
    let firstFault: { readonly error: unknown } | null = null
    let firstDocumentFault: { readonly error: unknown } | null = null

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (totalTextChars >= maxTotalTextChars) {
        truncatedBy.add('document_text_cap')
        break
      }

      const remaining = maxTotalTextChars - totalTextChars
      let page: Awaited<ReturnType<typeof doc.getPage>> | null = null
      try {
        page = await doc.getPage(pageNumber)
        // The caps are applied AS the text streams in, not to a page pdfjs has
        // already materialized in full; see readPageText.
        const read = await readPageText(page, maxPageTextChars, remaining)
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
        firstFault ??= { error }
        if (firstDocumentFault === null && DOCUMENT_FAULT_EXCEPTIONS.has(exceptionName(error))) {
          firstDocumentFault = { error }
        }
      } finally {
        // Best-effort, and never allowed to mask the page's real outcome.
        try {
          page?.cleanup()
        } catch {
          /* the page is being abandoned either way */
        }
      }
    }

    // EVERY page the document declared failed. pdfjs opened the catalog and
    // reported a page count, so none of the document-level handling below ever
    // ran — and many damaged PDFs fail exactly here, only once their pages are
    // touched. Returning `{ ok: true, pages: [] }` for that hands a consumer a
    // successful extraction with nothing in it, which reads as "this document
    // is empty" about a document nobody managed to read a page of. Partial
    // success is preserved above (`pages` non-empty is a real result with
    // `unreadablePages` naming the rest); total failure is a failure, and it
    // gets the same reason split the document-level catch makes: `corrupt` only
    // on pdfjs's own say-so about the bytes, `extraction_failed` otherwise.
    if (totalPages > 0 && unreadablePages.length === totalPages) {
      const fault = firstDocumentFault ?? firstFault
      return failure(firstDocumentFault === null ? 'extraction_failed' : 'corrupt', {
        detail: exceptionMessage(fault?.error),
      })
    }

    const imageOnlyPages = pages.filter((page) => page.imageOnly).length

    return {
      ok: true,
      pages,
      summary: {
        totalPages,
        pagesExtracted: pages.length,
        unreadablePages,
        imageOnlyPages,
        // "Every page we read had no text AND at least one of them is a
        // picture" — never "we read no pages", never "a cap clipped everything
        // away", never "some page defeated us", and never "every page was
        // blank". A zero-page document, or one the total-text cap stopped
        // before page 1, has no scanned page to send anyone to OCR over; text
        // that was read and then truncated was still read; a page that could
        // not be read is not a page known to be text-free; and a stack of blank
        // separator pages has no ink for OCR to recover, so telling someone to
        // run one over it is a false lead. `imageOnlyPages > 0` also implies
        // `pages` is non-empty.
        noTextExtracted: imageOnlyPages > 0 && !anyPageHadText && unreadablePages.length === 0,
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
    // …except pdfjs's own "I could not set up a worker", which arrives here
    // when the fallback import inside pdfjs failed rather than at `getDocument`.
    // `extraction_failed` would say "the document itself may be perfectly fine —
    // try again", and trying again cannot help a host that is missing a module.
    if (reason === 'extraction_failed' && isWorkerSetupFailure(error)) {
      return failure('pdfjs_worker_unavailable', { detail: exceptionMessage(error), supplied })
    }
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
