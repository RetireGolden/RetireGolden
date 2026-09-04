# Local PDF text extraction: how it is built

The design record for the extractor behind the WS5 document-parsing spike: what it promises callers,
why `pdfjs-dist` is an optional peer rather than a dependency, how it runs without a Web Worker, and
what it does and does not bound. The measurements, the reason vocabulary as a user meets it, and the
"do not scope OCR now" recommendation are in
[document-parsing-spike.md](document-parsing-spike.md). What the free import wizard actually does is in
[imports-and-migration.md](imports-and-migration.md).

Code: [`packages/planner-ui/src/import/documentText.ts`](../../packages/planner-ui/src/import/documentText.ts).
The module header carries the invariants a reader editing that file needs and points here for the rest.

## What it does

Given the bytes of a statement, an old plan printout, or a Form 1040, it pulls the text layer out page
by page, says which pages have no text layer at all (the scanned page an OCR pass would be needed for),
and refuses honestly when it cannot.

It is deliberately DOM-free, so a Node process, an Electron renderer, and a browser all run the same
code path.

## The published contract

This module is published as the `@retiregolden/planner-ui/document-text` subpath and, unlike the
unpromised deep subpaths, is a supported API: the exported names, their signatures, the
`DocumentTextResult` shape, and the `reason` vocabulary only change with a semver-major release of the
package. New `reason` values and new summary fields may be added in a minor, so a consumer must treat
an unrecognized reason as "could not read this document" rather than assuming the union is closed.

## A page number is the citation

`DocumentPage.page` is a 1-based integer and nothing requires parsing a string to recover it.

This module deliberately does NOT add a page-citation member to the published `SourceLocator` union in
`provenance.ts`: `parseLocator`'s `default: return null` propagates to `parseImportProvenance` returning
`malformed`, so a new locator kind would make every NEW provenance export unreadable by an older
consumer, and Pro's `isValidLocator` mirrors the same closed switch and would reject those notes with a
bare `invalid_input`. A spike exists to decide whether PDF import is viable at all; committing the
published provenance contract before the accuracy benchmark answers that is backwards. Promoting page
citations into `SourceLocator` is the follow-up if the numbers justify shipping.

`migrationSource.ts` lives with the same decision: a page citation rides as
`{ kind: 'none', note: 'page 4' }`.

## Nothing here is wired into the free import wizard

`ImportPage.tsx` still tells the user "no PDF upload", and `tenForty.ts` is still guided entry with no
PDF parsing; both remain true, because the intended consumer of this module is the Pro intake
workbench. Importing this module is an explicit act.

## The pdfjs dependency is an optional peer, and a host may hand it in

`pdfjs-dist` is declared in `peerDependencies` with `peerDependenciesMeta.optional`, and the import in
the module is dynamic, so the module is never evaluated (and the peer never needed) unless a caller
actually extracts a document. A host that never imports this subpath pays nothing: npm does not install
the peer, and a bundler never reaches the import. A host that DOES import it either installs
`pdfjs-dist` and lets the dynamic import find it, or imports pdfjs itself and passes the module as
`options.pdfjs`; if neither happened the failure is reported as `pdfjs_unavailable`, not thrown.

The package also keeps `pdfjs-dist` as a devDependency purely so this repo's `tsc -b` and vitest can
resolve it.

### Which of the two, and why the choice is not cosmetic

The dynamic import resolves a BARE package specifier, which only a runtime that does node-style
resolution can do: Node, an SSR render, an Electron main process. A browser cannot resolve
`pdfjs-dist/...` at all, and a bundler is not asked to (the specifier is deliberately opaque to it, so a
host without the peer still BUILDS; see `PDFJS_ENTRY`). So in a browser bundle the import can only fail,
and `options.pdfjs` is THE path: the host writes its own `import()` of
`pdfjs-dist/legacy/build/pdf.mjs`, which its own bundler resolves and chunks correctly, and hands the
module over.

A library cannot resolve a bare specifier on its host's behalf; the host can. When `options.pdfjs` is
given it is used exactly as supplied and no import is attempted in this module at all, including the
worker import, so a host taking this path imports `pdf.worker.mjs` itself if it wants the worker-free
main-thread mode described below.

The package specifier is spelled outside the call throughout `documentText.ts`, prose included: a
source-scan test forbids a literal `import(` of the package name anywhere in that source, and a guard
that has to reason about which occurrences are comments is a guard that can be argued with. That
constraint binds anyone editing the file, so it stays stated there as well as here.

### Three host conditions, three reasons

Three separate host conditions get three separate reasons, because their remedies differ and because a
wrong one is a false statement:

| Reason | The host condition |
|---|---|
| `pdfjs_unavailable` | The package is not installed. Its specifier would not RESOLVE. |
| `pdfjs_worker_unavailable` | A pdfjs is present but has no worker to run in: its worker module would not load, or, on the injected path, the host imported none. |
| `pdfjs_incompatible` | The build present does not expose the API this module drives, or would not evaluate at all. Telling a host to install what it has already installed points at a remedy that cannot work. |

None of the three is ever reported as a problem with the user's document.

## Worker-free by construction, on the path where this module imports

pdfjs normally spawns a Web Worker from a separately hosted `pdf.worker.mjs` asset. Importing that
module on the main thread instead sets `globalThis.pdfjsWorker`, which pdfjs checks first and treats as
a main-thread message handler, so no `new Worker(...)` call is made and no worker asset has to be
hosted, in Node, in an Electron renderer, or in a browser alike. (In Node pdfjs disables the worker on
its own, but the explicit import is what makes the browser and Electron-renderer paths work.)

### A supplied module opts out of that, so the condition is NAMED, not pre-empted

When the host passes `options.pdfjs`, nothing is imported by this module, the worker module included, so
a browser host that injected only `pdf.mjs` leaves pdfjs hunting for a worker asset. That is
deliberately not refused up front on a "is `globalThis.pdfjsWorker` set?" test, because an unset one is
not by itself a fault: in Node and in an Electron main process pdfjs disables the worker on its own and
needs nothing, and a host that hosts the asset and sets `GlobalWorkerOptions.workerSrc` is correctly
configured too. Refusing either would be a false failure about a setup that works.

What IS the fault is pdfjs then failing to obtain any worker, and it says so in its own words:
`No "GlobalWorkerOptions.workerSrc" specified.`, thrown synchronously out of `getDocument`, or
`Setting up fake worker failed: …` from the loading task. Both are recognised and reported as
`pdfjs_worker_unavailable`, with the injected path's remedy (import `pdf.worker.mjs` as well), instead
of `pdfjs_incompatible` or `extraction_failed`, neither of which names the thing that went wrong. See
`isWorkerSetupFailure`.

## What the caps bound, precisely

Extraction runs on the calling thread, and the caps in
[`documentLimits.ts`](../../packages/planner-ui/src/import/documentLimits.ts) bound the text RETAINED
and the peak of this module's own accumulation: a page's text is taken through pdfjs's streaming text
API and appended only while it is inside the budget, so the high-water mark is one batch of items plus a
string no longer than the cap, rather than the whole page's items array that `getTextContent()`
materializes before it resolves (see `readPageText`).

They bound nothing INSIDE pdfjs. A content stream that decompresses enormously is still decompressed and
its glyphs are still produced, and the CPU and the pdfjs-internal memory that costs are not governed by
any number here; the document sits well inside the byte and page caps the whole time. Bounding that is
follow-up work, not spike work. Saying these caps already do it would be a stronger claim than this
module can make.

## Local-only, enforced not merely intended

This is [standards.md](../standards.md) invariant 1 applied to a parser that would otherwise reach the
network on its own.

pdfjs can fetch character maps, standard font data, ICC profiles, its WebAssembly helpers, and the
document itself over the network. None of those are reachable here. The document is passed as bytes,
never a URL. Every option that names a fetchable location (`url`, `docBaseUrl`, `cMapUrl`,
`standardFontDataUrl`, `iccUrl`, `wasmUrl`) is deliberately left undefined, so there is no address to
fetch from, and `useWorkerFetch: false` additionally disables the Fetch API the parser would use to
retrieve those three classes of file itself. `useSystemFonts: false` and `disableFontFace: true` keep it
away from locally installed fonts and from installing font faces in a host's document. (pdf.js 6 removed
the `eval`-based font-compilation path and its `isEvalSupported` switch outright, so there is no longer
a knob to turn off there.)

A document that needs a non-embedded CJK cmap therefore extracts poorly rather than phoning home. That
is the intended trade, and one of the things the accuracy benchmark has to measure.

## Known cost, for the benchmark to price

Deciding that a page is image-only means building its operator list, which makes pdfjs decode the page's
images. That is only done for pages that yielded no text, but on a fully scanned document it is every
page. Bounding that decode without losing the image-only signal (pdfjs drops paint operators for images
it declines to decode) is follow-up work, not spike work.
