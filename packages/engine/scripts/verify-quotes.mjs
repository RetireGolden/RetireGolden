#!/usr/bin/env node
/**
 * Quote-fidelity verifier for the tax rule registry.
 *
 * `TaxRuleAuthority.quotedText` promises *character-exact operative language,
 * quoted rather than paraphrased*. That promise is the registry's entire value:
 * the quote is what a preparer is shown when they ask why a number came out the
 * way it did. Nothing in the repo checks it. The conformance suite
 * (`taxRuleRegistry.conformance.test.ts`) verifies publisher tier, quote
 * *presence*, and error direction, but it cannot fetch a source, so quote
 * *fidelity* has had no guard at all — and a fluent sentence that appears
 * nowhere in the cited document passes conformance and human review alike.
 *
 * This script fetches every distinct `authority[].url`, normalises source and
 * quote the same way, and asserts three things:
 *
 *   1. Every segment of an elided quote (one containing `...` or `…`) is a
 *      literal substring of the source. Honest elision is a legitimate and
 *      common practice here; a *broken* elision is a quote that has dropped
 *      text without saying so.
 *   2. After the punctuation ladder below, the quote is still a substring.
 *      The ladder folds away differences in how publishers *render* the same
 *      characters (see HOST_CONVENTIONS); what survives it is a difference in
 *      the words. This is the check that isolates absent passages and
 *      unmarked truncations.
 *   3. A source that cannot be fetched fails loudly. It is never skipped.
 *      Silence here is how an unverifiable citation stays unverified forever.
 *
 * It asserts nothing else. In particular it does NOT fold away the registry's
 * own rewrites of the source ("$6,000" written as "6,000 dollar", a possessive
 * `'s` dropped, a contraction expanded). Those are alterations of the text, not
 * differences in rendering, and the field's contract forbids them — so they are
 * reported, with a diagnosis showing exactly where the quote leaves the source.
 *
 * ── Why this is not in CI ────────────────────────────────────────────────────
 * Two reasons, both fatal to a build gate:
 *   - It needs the network, and the engine is deliberately network-free.
 *   - uscode.house.gov and law.cornell.edu are *mirrors*, and they lag
 *     amendments. A red build would sometimes mean "Congress moved faster than
 *     the mirror", which is not a signal a build should carry. When a quote
 *     fails only because the mirror predates the amendment, the fix is to wait
 *     or re-cite — not to change the quote.
 * Run it by hand after touching the registry, and on the annual re-verification
 * pass (DOCS/maintenance-schedule.md).
 *
 * ── Why it lives in scripts/ ────────────────────────────────────────────────
 * `eslint.config.js` bans `fetch` inside `src/**` to keep the engine pure. A
 * verifier that reaches the network cannot live in the package's runtime
 * surface, so it lives here, beside the other maintenance scripts, and never
 * ships (package.json `files` covers dist/ and schema/ only).
 *
 * Run:  npm run verify:quotes                (repo root, or -w @retiregolden/engine)
 *       node packages/engine/scripts/verify-quotes.mjs --help
 *
 * Full documentation, including how to read each verdict:
 * DOCS/operations/quote-fidelity.md
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(scriptDir, '..')

/**
 * Identifies the verifier honestly while staying inside the `Mozilla/5.0
 * (compatible; ...)` shape. eCFR serves a ~10 kB stub instead of the regulation
 * to user agents outside that shape, which would turn every eCFR quote into a
 * false "absent passage" — the exact failure mode this script exists to catch.
 */
const USER_AGENT =
  'Mozilla/5.0 (compatible; RetireGolden-quote-verifier/1.0; +https://github.com/RetireGolden/RetireGolden)'

/** Public government servers. Serialise requests and space them out. */
const DEFAULT_DELAY_MS = 1200
const FETCH_TIMEOUT_MS = 45_000

/**
 * A fetched HTML page that yields less text than this is a shell, a bot
 * challenge, or an error page dressed as a 200. Treating it as a real source
 * would report every quote on it as absent, so it is an unfetchable source
 * instead — assertion 3, and the reason a stub can never masquerade as a pass.
 */
const MIN_SOURCE_TEXT_CHARS = 2000

/** Bodies that are a challenge or block page regardless of status code. */
const BLOCK_MARKERS =
  /Just a moment\.\.\.|challenges\.cloudflare\.com|Access Denied|Request unsuccessful|Pardon Our Interruption/i

// ─── Per-host rendering conventions ──────────────────────────────────────────
/**
 * What each publisher actually emits for the characters that quotes trip over.
 * Measured across every page this registry cites (95 documents), not assumed.
 *
 * The `apostrophe` column is the only one this script asserts on, because it is
 * the only one that is unambiguous per host and mechanically fixable: a quote
 * carrying U+2019 against a host that renders U+0027 was copied from somewhere
 * other than the page it cites. The other columns are here because a future fix
 * needs them in order not to guess — they are the reason each ladder rung
 * exists, and they are reproduced in DOCS/operations/quote-fidelity.md.
 *
 * `null` apostrophe means the host is internally inconsistent and no assertion
 * can be made: irs.gov renders `doesn’t` (U+2019) in Publication 969 and the
 * Form 5329 instructions but `decedent's` (U+0027) in Publication 590-B.
 *
 * @typedef {object} HostConvention
 * @property {string|null} apostrophe   Possessive/contraction apostrophe codepoint, or null if mixed.
 * @property {string} structuralDash    The dash that introduces an enumerated list in the source text.
 * @property {string} sectionSign       How a section reference is written.
 * @property {string} notes             Anything else a fix has to know about this host.
 */
/** @type {Readonly<Record<string, HostConvention>>} */
const HOST_CONVENTIONS = Object.freeze({
  'uscode.house.gov': {
    apostrophe: "'",
    structuralDash: '-',
    sectionSign: '§ in notes; the statutory body spells out "section"',
    notes:
      'Straight U+0022 double quotes around amended text. Vulgar fraction U+00BD set tight: "age 59½". ' +
      'U+2013 appears only inside Pub. L. numbers, never as a structural dash.',
  },
  'www.govinfo.gov': {
    apostrophe: "'",
    structuralDash: '—',
    sectionSign: '§',
    notes:
      'Straight double quotes. Statutory dash is a tight em dash: "paragraph (1)—(A)". ' +
      'Embeds <!-- PDFPage:NNNN --> comments *inside* words, so tag stripping must not insert a space.',
  },
  'www.law.cornell.edu': {
    apostrophe: '’',
    structuralDash: '—',
    sectionSign: '§',
    notes:
      'Curly U+201C/U+201D double quotes around defined terms. Some CFR pages use the U+2044 fraction ' +
      'slash ("70 1⁄2"). LII CFR pages carry far less text than the eCFR original — prefer eCFR for regulations.',
  },
  'www.ecfr.gov': {
    apostrophe: "'",
    structuralDash: '—',
    sectionSign: '§',
    notes: 'Renders halves as "70 1⁄2" with U+2044 and surrounding spaces. Straight double quotes.',
  },
  'www.irs.gov': {
    apostrophe: null,
    structuralDash: '—',
    sectionSign: '§',
    notes:
      'Inconsistent between publications: P969 and i5329 use U+2019, P590-B uses U+0027. ' +
      'Contractions ("doesn’t", "can’t") are the publication\'s own voice and must be quoted as written. ' +
      'PDFs on this host lose every one of these characters in extraction — see PDF handling.',
  },
})

// ─── The punctuation ladder ──────────────────────────────────────────────────
/**
 * Cumulative normalisations, weakest first. A quote is tested at each rung in
 * order and reported at the *first* rung that matches, so the reported rung is
 * the minimal transformation needed — which is the diagnosis.
 *
 * Every rung folds a difference in how a publisher *renders* a character, never
 * a difference in words. Each `why` names the host convention that forces it.
 *
 * @typedef {object} Rung
 * @property {string} name
 * @property {string} why
 * @property {(s: string) => string} apply Applied to this rung only; rungs compose in order.
 */
/** @type {readonly Rung[]} */
const LADDER = Object.freeze([
  {
    name: 'exact',
    why: 'No transformation. This is the contract the field states.',
    apply: (s) => s,
  },
  {
    name: 'apostrophe',
    why: 'LII and most irs.gov pages render the possessive U+2019; uscode, govinfo and eCFR render U+0027.',
    apply: (s) => s.replace(/[‘’ʼ′`]/g, "'"),
  },
  {
    name: 'quote-marks',
    why: 'LII wraps statutory defined terms in curly U+201C/U+201D; uscode, govinfo and eCFR use U+0022.',
    apply: (s) => s.replace(/[“”″]/g, '"'),
  },
  {
    name: 'dashes',
    why: 'The same structural dash is U+2014 on LII/govinfo/eCFR and a plain U+002D on uscode.house.gov.',
    apply: (s) => s.replace(/[\u2014\u2013\u2212\u2010\u2011]/g, '-'),
  },
  {
    name: 'dash-spacing',
    why: 'Sources set the structural dash tight ("the sum of—(A)"); registry quotes commonly write " - ".',
    apply: (s) => s.replace(/\s*-\s*/g, '-'),
  },
  {
    name: 'spaces',
    why: 'HTML sources emit U+00A0 and friends inside statutory text; they survive entity decoding.',
    // U+00A0 no-break, U+2002 en, U+2003 em, U+2007 figure, U+2009 thin,
    // U+202F narrow no-break. Escaped because the literal forms are invisible.
    apply: (s) => s.replace(/[\u00a0\u2002\u2003\u2007\u2009\u202f]/g, ' '),
  },
  {
    name: 'fractions',
    why: 'uscode sets "age 59½" (U+00BD, tight), eCFR sets "age 70 1⁄2" (U+2044, spaced), PDFs yield "701/2".',
    apply: (s) =>
      s
        .replace(/½/g, ' 1/2')
        .replace(/¼/g, ' 1/4')
        .replace(/¾/g, ' 3/4')
        .replace(/⅓/g, ' 1/3')
        .replace(/⅔/g, ' 2/3')
        .replace(/(\d)\s*⁄\s*(\d)/g, '$1/$2')
        // pdftotext renders "age 70½" as "age 701/2"; re-separate the whole
        // number so it lines up with the spaced form every quote uses.
        .replace(/(\d)(1\/2|1\/4|3\/4|1\/3|2\/3)\b/g, '$1 $2'),
  },
  {
    name: 'section-sign',
    why: 'Every host writes § in a regulation cite; registry quotes sometimes spell it "section".',
    apply: (s) => s.replace(/§§/g, 'sections').replace(/§/g, 'section'),
  },
  {
    name: 'case',
    why: 'A quote that begins mid-sentence is commonly lowercased to fit the sentence it is dropped into.',
    apply: (s) => s.toLowerCase(),
  },
  {
    name: 'whitespace',
    why:
      'Tag stripping and PDF reflow insert or drop spaces that were never in the text (LII yields ' +
      '"IRA owner s", govinfo yields "re tirement"). After every other rung, spacing is positional noise.',
    apply: (s) => s.replace(/\s+/g, ''),
  },
])

/**
 * Run after the ladder and after the truncation probe, never before: deleting
 * terminal punctuation would hide an unmarked truncation, which is a finding,
 * not noise. What it catches is a comma or period inserted *inside* a quote —
 * e.g. IRC 72(t)(10)(A), where the registry writes `whichever is earlier, for
 * age 55` and the statute has `"whichever is earlier" for "age 55"`.
 */
const strayPunctuation = (s) => s.replace(/[.,;:]/g, '')

/**
 * Words and digits only. Used *solely* for PDF sources, where extraction
 * destroys §, ½ and every curly character, so a character-level verdict would
 * be an assertion about the extractor rather than about the registry.
 */
const wordsOnly = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const collapse = (s) => s.replace(/\s+/gu, ' ').trim()

/** Zero-width and soft-hyphen characters, which are invisible in both texts. */
const INVISIBLE = /\u00ad|\u200b|\u200c|\u200d|\ufeff/g

/**
 * Apply the ladder cumulatively up to and including `depth`.
 * @param {string} s
 * @param {number} depth
 */
function ladderTo(s, depth) {
  let out = s
  for (let i = 0; i <= depth; i += 1) out = LADDER[i].apply(out)
  return collapse(out)
}

const LADDER_FLOOR = LADDER.length - 1
/** The strongest rung that still leaves words separated, for prefix diagnosis. */
const DIAGNOSIS_RUNG = LADDER.findIndex((rung) => rung.name === 'case')

// ─── HTML and PDF text extraction ────────────────────────────────────────────
/** Named entities that appear in these publishers' statutory text. */
const ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', minus: '−', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  sect: '§', frac12: '½', frac14: '¼', frac34: '¾',
  ensp: ' ', emsp: ' ', thinsp: ' ', shy: '', times: '×',
  middot: '·', bull: '•', deg: '°', reg: '®', trade: '™',
})

/** Largest codepoint `String.fromCodePoint` accepts; above it, it throws. */
const MAX_CODE_POINT = 0x10ffff

/**
 * A numeric entity naming a codepoint outside Unicode (`&#x110000;`, `&#-1;`)
 * is left as written rather than decoded. `String.fromCodePoint` throws a
 * RangeError on those, and a throw here would take down the whole run on one
 * malformed page — which is the one thing this tool must not do. Its value is
 * that it finishes and produces a ledger, so a page nobody can parse has to
 * degrade to a reported failure for that page and nothing more.
 *
 * @param {string} s
 */
function decodeEntities(s) {
  // `#[xX]?` and not `#x?`: the branch below already handles an uppercase X,
  // but the pattern never matched one, so `&#X2019;` passed through undecoded
  // and could turn a correct quote into a false ABSENT. A checker that invents
  // findings is worse than no checker.
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
      return Number.isInteger(code) && code >= 0 && code <= MAX_CODE_POINT
        ? String.fromCodePoint(code)
        : match
    }
    return ENTITIES[body] ?? match
  })
}

/**
 * Two variants, because neither joiner is right for every publisher.
 *
 *   - joiner ' ' keeps block boundaries apart, which is what govinfo's
 *     `<p>` structure needs.
 *   - joiner '' is the only way LII's inline markup survives: LII wraps every
 *     defined term in an `<a>`, so `contribution</a>.` becomes "contribution ."
 *     under a space joiner and no quote could ever match. govinfo likewise
 *     embeds `<!-- PDFPage:1310 -->` in the middle of "retirement".
 *
 * A quote need only match one variant. Testing both costs nothing and removes
 * an entire class of false "absent passage" reports.
 *
 * @param {string} html
 * @returns {string[]}
 */
function htmlVariants(html) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  return ['', ' '].map((joiner) =>
    collapse(
      decodeEntities(
        withoutNoise.replace(/<!--[\s\S]*?-->/g, joiner).replace(/<[^>]+>/g, joiner),
      ).replace(INVISIBLE, ''),
    ),
  )
}

let pdfExtractorChecked = false
let pdfExtractorAvailable = false

/**
 * Poppler's pdftotext, if it happens to be installed. It is deliberately not a
 * dependency: PDF sources can only ever be word-level verified anyway (see
 * below), so making the whole script unrunnable without a native binary would
 * trade a large benefit for a small one.
 */
function hasPdfExtractor() {
  if (pdfExtractorChecked) return pdfExtractorAvailable
  pdfExtractorChecked = true
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' })
    pdfExtractorAvailable = true
  } catch (err) {
    // `pdftotext -v` exits 99 in the Xpdf-derived builds, so a non-zero status
    // is not absence. A missing binary throws with `status: null` and an
    // ENOENT-shaped `code`; a binary that ran and complained sets `status`.
    pdfExtractorAvailable = typeof err?.status === 'number'
  }
  return pdfExtractorAvailable
}

/**
 * Extract text from a PDF in both reading orders.
 *
 * Extraction is lossy in ways that matter here: § comes out as U+FFFD, ½ is
 * glued to the preceding digit ("701/2"), and every curly character is gone.
 * That is why a PDF source can never produce a PASS — only "word-level
 * verified" or "not verifiable". The de-hyphenated variant undoes line-break
 * hyphenation, which otherwise splits words mid-sentence.
 *
 * @param {Buffer} body
 * @returns {string[]}
 */
function pdfVariants(body) {
  if (!hasPdfExtractor()) return []
  const dir = mkdtempSync(join(tmpdir(), 'rg-verify-quotes-'))
  const file = join(dir, 'source.pdf')
  try {
    writeFileSync(file, body)
    const raw = []
    for (const flags of [[], ['-layout']]) {
      try {
        raw.push(
          execFileSync('pdftotext', ['-q', ...flags, file, '-'], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
          }),
        )
      } catch {
        // One reading order failing is survivable; both failing yields [].
      }
    }
    // U+FFFD is what the extractor emits for characters it cannot map — in
    // these documents almost always § or ½. Offering all three readings lets
    // the section-sign and fractions rungs do their job instead of the
    // difference being mistaken for a change of words.
    const readings = ['§', '½', '']
    return raw.flatMap((t) =>
      [t, t.replace(/-\r?\n/g, '')].flatMap((variant) =>
        readings.map((glyph) => collapse(variant.replace(/\ufffd/g, glyph).replace(INVISIBLE, ''))),
      ),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ─── Fetch with an on-disk cache ─────────────────────────────────────────────
/** @param {string} url */
const cacheKey = (url) => createHash('sha256').update(url).digest('hex').slice(0, 16)

/**
 * @typedef {object} Source
 * @property {string} url
 * @property {boolean} ok            False means nothing on this page can be checked. Three routes
 *                                   reach it: the fetch failed, the response was a block page, or
 *                                   it came back a stub (assertion 3). A PDF that fetched but
 *                                   would not extract is also `ok: false` — see `pdfUnreadable`,
 *                                   which is what separates the two verdicts.
 * @property {string} [problem]      Why it is unusable, when !ok.
 * @property {boolean} isPdf
 * @property {boolean} [pdfUnreadable] Set alongside `ok: false` when a PDF fetched but no text
 *                                     could be extracted. The distinction is whose fault it is:
 *                                     the document arrived and the local reader failed, so its
 *                                     quotes report PDF-NOT-VERIFIABLE, not UNFETCHABLE. Blaming
 *                                     the publisher for a missing poppler would be a finding
 *                                     about this machine.
 * @property {string[]} variants     Normalised full-text renderings; a quote need match only one.
 * @property {boolean} fromCache
 */

/**
 * Cached response metadata, or null when the file cannot be trusted.
 *
 * @param {string} metaPath
 * @returns {{contentType?: string, status?: number} | null}
 */
function readCacheMeta(metaPath) {
  try {
    const parsed = JSON.parse(readFileSync(metaPath, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

/**
 * @param {string} url
 * @param {{cacheDir: string, refresh: boolean, delayMs: number}} opts
 * @returns {Promise<{body: Buffer, contentType: string, status: number, fromCache: boolean, error?: string}>}
 */
async function fetchWithCache(url, opts) {
  const key = cacheKey(url)
  const bodyPath = join(opts.cacheDir, `${key}.body`)
  const metaPath = join(opts.cacheDir, `${key}.meta.json`)
  if (!opts.refresh && existsSync(bodyPath) && existsSync(metaPath)) {
    // A truncated or hand-edited meta file is a cache MISS, not a crash. An
    // interrupted write leaves exactly that, and aborting on it would be the
    // one failure mode this tool exists to avoid — it is worth something only
    // if it finishes and produces a ledger. Falling through refetches.
    const meta = readCacheMeta(metaPath)
    if (meta !== null) {
      return {
        body: readFileSync(bodyPath),
        contentType: meta.contentType ?? '',
        status: meta.status ?? 0,
        fromCache: true,
      }
    }
  }
  await sleep(opts.delayMs)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
        'accept-language': 'en-US,en;q=0.9',
      },
    })
    const body = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') ?? ''
    mkdirSync(opts.cacheDir, { recursive: true })
    writeFileSync(bodyPath, body)
    writeFileSync(
      metaPath,
      `${JSON.stringify({ url, status: response.status, contentType, fetchedAt: new Date().toISOString(), bytes: body.length }, null, 1)}\n`,
    )
    return { body, contentType, status: response.status, fromCache: false }
  } catch (err) {
    return { body: Buffer.alloc(0), contentType: '', status: 0, fromCache: false, error: String(err) }
  }
}

/**
 * @param {string} url
 * @param {{cacheDir: string, refresh: boolean, delayMs: number}} opts
 * @returns {Promise<Source>}
 */
async function loadSource(url, opts) {
  const { body, contentType, status, fromCache, error } = await fetchWithCache(url, opts)
  const base = { url, isPdf: false, variants: [], fromCache }
  if (error) return { ...base, ok: false, problem: `request failed: ${error}` }
  if (status < 200 || status >= 300) return { ...base, ok: false, problem: `HTTP ${status}` }

  const isPdf = contentType.includes('pdf') || body.subarray(0, 4).toString('latin1') === '%PDF'
  if (isPdf) {
    const variants = pdfVariants(body)
    if (variants.length === 0) {
      // The document was fetched; it just cannot be read here. That is a local
      // tooling gap, not a registry defect, so it must not fail the run the way
      // an unreachable source does.
      return {
        ...base,
        isPdf: true,
        ok: false,
        pdfUnreadable: true,
        problem: hasPdfExtractor()
          ? 'pdftotext produced no text (scanned or protected PDF)'
          : 'no PDF text extractor on PATH — install poppler-utils to check PDF-sourced quotes',
      }
    }
    return { ...base, isPdf: true, ok: true, variants }
  }

  const text = body.toString('utf8')
  if (BLOCK_MARKERS.test(text)) {
    return { ...base, ok: false, problem: 'bot challenge or block page returned instead of the document' }
  }
  const variants = htmlVariants(text)
  // Measured on the LONGEST variant, not the first. `htmlVariants` returns two
  // deliberately different joiner strategies, and the one that does not insert
  // spacing between tags is routinely shorter — so testing `variants[0]` alone
  // can condemn a real page as a stub while the other variant holds the whole
  // document. A false UNFETCHABLE is the costlier error here: it hides a usable
  // source behind a verdict that reads like the publisher's fault.
  const longestVariant = variants.reduce((left, right) => (right.length > left.length ? right : left))
  if (longestVariant.length < MIN_SOURCE_TEXT_CHARS) {
    return {
      ...base,
      ok: false,
      problem: `only ${longestVariant.length} characters of text — a shell or error page, not the document`,
    }
  }
  return { ...base, ok: true, variants }
}

// ─── Matching ────────────────────────────────────────────────────────────────
/**
 * First ladder rung at which `needle` is a substring of any source variant.
 * @param {readonly string[]} variants
 * @param {string} needle
 * @returns {number} rung index, or -1 if it never matches
 */
function matchRung(variants, needle) {
  for (let depth = 0; depth < LADDER.length; depth += 1) {
    const target = ladderTo(needle, depth)
    if (variants.some((v) => ladderTo(v, depth).includes(target))) return depth
  }
  return -1
}

/** @param {readonly string[]} variants @param {string} needle */
const matchesStray = (variants, needle) => {
  const target = collapse(strayPunctuation(ladderTo(needle, LADDER_FLOOR)))
  return variants.some((v) => collapse(strayPunctuation(ladderTo(v, LADDER_FLOOR))).includes(target))
}

/** @param {readonly string[]} variants @param {string} needle */
const matchesWords = (variants, needle) => {
  const target = wordsOnly(needle)
  return variants.some((v) => wordsOnly(v).includes(target))
}

/** Split a quote on deliberate elision markers. */
function segmentsOf(quote) {
  return /\.\.\.|…/.test(quote)
    ? quote.split(/\s*(?:\.\.\.|…)\s*/).map((s) => s.trim()).filter(Boolean)
    : [quote]
}

/**
 * Longest word-prefix of the quote present in the source, plus what the source
 * says at the point the quote leaves it. This is diagnosis, not assertion: it
 * is what tells a reader whether a failure is a composed sentence, a dropped
 * clause, or a `$` spelled out as the word "dollars".
 *
 * @param {readonly string[]} variants
 * @param {string} needle
 * @param {(s: string) => string} [norm] Word-preserving normaliser; PDFs pass wordsOnly.
 */
function divergence(variants, needle, norm = (s) => ladderTo(s, DIAGNOSIS_RUNG)) {
  // Whatever normaliser is used must leave words separated, so a prefix can be
  // counted: the ladder one stops one rung short of whitespace removal.
  const normalised = variants.map(norm)
  const words = norm(needle).split(' ')
  const present = (count) => {
    const prefix = words.slice(0, count).join(' ')
    return normalised.some((v) => v.includes(prefix))
  }
  let low = 0
  let high = words.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (present(mid)) low = mid
    else high = mid - 1
  }
  const prefix = words.slice(0, low).join(' ')
  let continuation = ''
  if (low > 0) {
    for (const v of normalised) {
      const at = v.indexOf(prefix)
      if (at >= 0) {
        continuation = v.slice(at + prefix.length, at + prefix.length + 180).trim()
        break
      }
    }
  }
  return { matchedWords: low, totalWords: words.length, continuation }
}

// ─── Verdicts ────────────────────────────────────────────────────────────────
/** Verdicts that mean the registry is wrong, or cannot be shown to be right. */
const SERIOUS = Object.freeze(['ABSENT', 'TRUNCATED', 'ELISION-BROKEN', 'UNFETCHABLE'])
/** Verdicts that mean the quote is faithful but not literally character-exact. */
const ADVISORY = Object.freeze(['PUNCTUATION', 'ELISION-PUNCTUATION'])

/**
 * @param {{id: string, citation: string, url: string, host: string, quotedText: string}} entry
 * @param {Source} source
 */
function verdictFor(entry, source) {
  if (source.pdfUnreadable) {
    return { verdict: 'PDF-NOT-VERIFIABLE', detail: source.problem ?? 'PDF text could not be extracted' }
  }
  if (!source.ok) {
    return { verdict: 'UNFETCHABLE', detail: source.problem ?? 'source unavailable' }
  }

  const quote = collapse(entry.quotedText.replace(INVISIBLE, ''))
  const segments = segmentsOf(quote)
  const elided = segments.length > 1

  // A PDF can never produce a PASS. Extraction loses § (U+FFFD), glues ½ to the
  // preceding digit, and drops every curly character, so certifying that a
  // quote is *character*-exact against extracted text would be an assertion
  // about poppler, not about the registry. The strongest honest claim is that
  // the words are all there. Words that are genuinely *absent* remain a real
  // finding — extraction loss cannot add or remove whole words.
  if (source.isPdf) {
    const missing = segments.filter((s) => matchRung(source.variants, s) < 0)
    if (missing.length === 0) {
      return {
        verdict: 'PDF-WORD-LEVEL',
        detail: elided
          ? `${segments.length} elision segments, all present in the extracted text`
          : 'present in the extracted text; character fidelity is not verifiable from a PDF',
      }
    }
    const trimmed = missing.map((s) => s.replace(/[.;:,]+$/, ''))
    if (
      trimmed.some((s, i) => s !== missing[i]) &&
      trimmed.every((s) => matchesWords(source.variants, s))
    ) {
      return {
        verdict: 'TRUNCATED',
        detail: 'the quote ends with a terminal period the source does not have there',
        diagnosis: divergence(source.variants, missing[0], wordsOnly),
      }
    }
    if (missing.every((s) => matchesWords(source.variants, s))) {
      // Every word is present but no rendering fold explains the remaining
      // difference. On an HTML source that would be a finding; here it is
      // indistinguishable from extraction damage, so it stays undetermined.
      return {
        verdict: 'PDF-NOT-VERIFIABLE',
        detail: 'words all present, but the character difference cannot be separated from extraction loss',
      }
    }
    return {
      verdict: elided ? 'ELISION-BROKEN' : 'ABSENT',
      detail: 'the words do not appear in the document (word-level, so extraction loss does not explain it)',
      diagnosis: divergence(source.variants, missing[0], wordsOnly),
    }
  }

  const rungs = segments.map((s) => matchRung(source.variants, s))

  if (rungs.every((r) => r === 0)) {
    return elided
      ? { verdict: 'ELISION-EXACT', detail: `${segments.length} segments, every one a literal substring` }
      : { verdict: 'EXACT', detail: 'literal substring of the source' }
  }

  if (rungs.every((r) => r >= 0)) {
    const used = [...new Set(rungs.filter((r) => r > 0).map((r) => LADDER[r].name))]
    return {
      verdict: elided ? 'ELISION-PUNCTUATION' : 'PUNCTUATION',
      detail: `matches only after: ${used.join(', ')}`,
    }
  }

  const missing = segments.filter((_, i) => rungs[i] < 0)

  // Unmarked truncation: the quote closes a sentence the source keeps writing.
  const trimmed = missing.map((s) => s.replace(/[.;:,]+$/, ''))
  if (
    trimmed.some((s, i) => s !== missing[i]) &&
    trimmed.every((s) => matchRung(source.variants, s) >= 0)
  ) {
    return {
      verdict: 'TRUNCATED',
      detail: 'the quote ends with a terminal period the source does not have there',
      diagnosis: divergence(source.variants, missing[0]),
    }
  }

  if (missing.every((s) => matchesStray(source.variants, s))) {
    return {
      verdict: elided ? 'ELISION-PUNCTUATION' : 'PUNCTUATION',
      detail: 'matches only after ignoring a comma or period the source does not have',
    }
  }

  return {
    verdict: elided ? 'ELISION-BROKEN' : 'ABSENT',
    detail: elided
      ? `${missing.length} of ${segments.length} elision segments do not appear on the page`
      : 'the passage does not appear on the page',
    diagnosis: divergence(source.variants, missing[0]),
  }
}

/**
 * Apostrophe style against the host's measured convention. Independent of the
 * verdict — a quote can be an exact substring of a *different* host's page and
 * still carry the wrong apostrophe for the page it cites.
 *
 * @param {string} host
 * @param {string} quotedText
 */
function apostropheMismatch(host, quotedText) {
  const convention = HOST_CONVENTIONS[host]
  if (!convention || convention.apostrophe === null) return null
  const wants = convention.apostrophe
  const has = wants === "'" ? /’/ : /'/
  if (!has.test(quotedText)) return null
  return wants === "'"
    ? 'quote uses U+2019 (’) where this host renders U+0027 (\')'
    : "quote uses U+0027 (') where this host renders U+2019 (’)"
}

// ─── Registry extraction ─────────────────────────────────────────────────────
/**
 * Read the registry straight from source. Node 24 strips TypeScript types
 * natively, and the engine's tsconfig sets `erasableSyntaxOnly`, which
 * guarantees the file contains nothing that stripping cannot handle — so this
 * needs no prior `npm run build`, unlike generate-schema.mjs.
 */
async function loadRegistry() {
  const registryPath = join(pkgDir, 'src', 'rules', 'taxRuleRegistry.ts')
  const { TAX_RULE_REGISTRY } = await import(pathToFileURL(registryPath).href)
  /** @type {{id: string, citation: string, kind: string, url: string, host: string, quotedText: string}[]} */
  const entries = []
  for (const [id, rule] of Object.entries(TAX_RULE_REGISTRY)) {
    for (const authority of rule.authority) {
      entries.push({
        id,
        citation: authority.citation,
        kind: authority.kind,
        url: authority.url,
        host: new URL(authority.url).host,
        quotedText: authority.quotedText,
      })
    }
  }
  return { recordCount: Object.keys(TAX_RULE_REGISTRY).length, entries }
}

// ─── Reporting ───────────────────────────────────────────────────────────────
const truncate = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

/** @param {{verdict: string}[]} results */
function tally(results) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const r of results) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1
  return counts
}

function printLedger(results, apostrophes, meta) {
  const counts = tally(results)
  const seriousRows = results.filter((r) => SERIOUS.includes(r.verdict))
  const advisoryRows = results.filter((r) => ADVISORY.includes(r.verdict))

  const line = (n = 78) => console.log('─'.repeat(n))

  console.log('')
  line()
  console.log('QUOTE FIDELITY LEDGER — packages/engine/src/rules/taxRuleRegistry.ts')
  line()
  console.log(
    `${meta.recordCount} records · ${results.length} authority entries · ${meta.urlCount} distinct URLs ` +
      `(${meta.fetched} fetched, ${meta.cached} from cache)`,
  )
  console.log('')

  console.log(`SERIOUS — the registry is wrong here, or cannot be shown to be right   [${seriousRows.length}]`)
  for (const verdict of SERIOUS) {
    const rows = seriousRows.filter((r) => r.verdict === verdict)
    if (rows.length === 0) continue
    console.log('')
    console.log(`  ${verdict}  (${rows.length})`)
    for (const row of rows) {
      console.log(`    ${row.id}`)
      console.log(`      ${row.citation}  ·  ${row.host}`)
      console.log(`      ${row.detail}`)
      if (row.diagnosis) {
        const { matchedWords, totalWords, continuation } = row.diagnosis
        console.log(`      quote:  ${truncate(collapse(row.quotedText), 150)}`)
        console.log(`      ${matchedWords}/${totalWords} words of the quote match, then the source reads:`)
        console.log(`      source: …${truncate(continuation, 150)}`)
      }
    }
  }
  if (seriousRows.length === 0) console.log('  none.')

  console.log('')
  line()
  console.log(`ADVISORY — faithful, but not literally character-exact   [${advisoryRows.length}]`)
  /** @type {Record<string, string[]>} */
  const byDetail = {}
  for (const row of advisoryRows) (byDetail[row.detail] ??= []).push(row.id)
  for (const [detail, ids] of Object.entries(byDetail).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(ids.length).padStart(3)}  ${detail}`)
    console.log(`       ${truncate([...new Set(ids)].join(', '), 140)}`)
  }
  if (advisoryRows.length === 0) console.log('  none.')

  console.log('')
  console.log(`  apostrophe style disagrees with the cited host's convention   [${apostrophes.length}]`)
  for (const row of apostrophes) {
    console.log(`    ${row.id}  ·  ${row.host}  ·  ${row.note}`)
  }

  console.log('')
  line()
  console.log('SUMMARY')
  for (const [verdict, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const bucket = SERIOUS.includes(verdict)
      ? 'serious'
      : ADVISORY.includes(verdict)
        ? 'advisory'
        : verdict.endsWith('NOT-VERIFIABLE')
          ? 'undetermined'
          : 'ok'
    console.log(`  ${String(count).padStart(4)}  ${verdict.padEnd(20)} ${bucket}`)
  }
  line()
  console.log('')
  console.log('How to read this: DOCS/operations/quote-fidelity.md')
  console.log('This script is NOT a CI gate. A mirror that predates an amendment can fail a')
  console.log('correct quote — confirm against the enrolled text before changing anything.')
  console.log('')
}

// ─── Entry point ─────────────────────────────────────────────────────────────
const HELP = `
verify-quotes — check every quotedText in the tax rule registry against its cited source.

Usage: node packages/engine/scripts/verify-quotes.mjs [options] [filter]

  --filter <substring>   Only entries whose rule id, citation or URL contains this.
                         May also be given as a bare argument.
  --refresh              Ignore the cache and refetch every source.
  --cache-dir <path>     Where to keep fetched sources.
                         Default: packages/engine/node_modules/.cache/verify-quotes
  --delay <ms>           Pause between network requests (default ${DEFAULT_DELAY_MS}).
  --json                 Emit the ledger as JSON instead of text.
  --help                 This message.

Exits non-zero when any entry is ABSENT, TRUNCATED, ELISION-BROKEN or UNFETCHABLE.
Not a CI gate — see the header comment for why.
`

async function main() {
  // Positionals are allowed because `npm run verify:quotes -- --filter x` has npm
  // swallow the flag and forward only the bare value; a lone positional is then
  // treated as the filter rather than crashing the run.
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      filter: { type: 'string' },
      refresh: { type: 'boolean', default: false },
      'cache-dir': { type: 'string' },
      delay: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.log(HELP)
    return 0
  }

  const opts = {
    cacheDir: values['cache-dir']
      ? resolve(values['cache-dir'])
      : join(pkgDir, 'node_modules', '.cache', 'verify-quotes'),
    refresh: values.refresh === true,
    delayMs: values.delay ? Number.parseInt(values.delay, 10) : DEFAULT_DELAY_MS,
  }
  if (!Number.isFinite(opts.delayMs) || opts.delayMs < 0) {
    throw new RangeError('--delay must be a non-negative number of milliseconds')
  }

  const { recordCount, entries: allEntries } = await loadRegistry()
  const needle = (values.filter ?? positionals[0])?.toLowerCase()
  const entries = needle
    ? allEntries.filter(
        (e) =>
          e.id.toLowerCase().includes(needle) ||
          e.citation.toLowerCase().includes(needle) ||
          e.url.toLowerCase().includes(needle),
      )
    : allEntries

  const urls = [...new Set(entries.map((e) => e.url))]
  if (!values.json) {
    console.error(
      `Fetching ${urls.length} distinct sources for ${entries.length} authority entries ` +
        `(${opts.delayMs}ms apart; cache: ${opts.cacheDir})`,
    )
  }
  if (!hasPdfExtractor() && !values.json) {
    console.error('Note: pdftotext not found on PATH — PDF-sourced quotes will report NOT-VERIFIABLE.')
  }

  /** @type {Map<string, Source>} */
  const sources = new Map()
  let fetched = 0
  let cached = 0
  for (const [index, url] of urls.entries()) {
    const source = await loadSource(url, opts)
    sources.set(url, source)
    if (source.fromCache) cached += 1
    else fetched += 1
    // Redraw in place on a terminal; stay silent when piped to a file, where
    // carriage returns would leave one line of noise per source.
    if (!values.json && process.stderr.isTTY) {
      const mark = source.ok ? '·' : '!'
      process.stderr.write(`\r  ${mark} ${index + 1}/${urls.length}   `)
    }
  }
  if (!values.json && process.stderr.isTTY) process.stderr.write(`\r${' '.repeat(30)}\r`)

  const results = entries.map((entry) => ({
    ...entry,
    ...verdictFor(entry, sources.get(entry.url)),
  }))

  const apostrophes = entries
    .map((entry) => ({ ...entry, note: apostropheMismatch(entry.host, entry.quotedText) }))
    .filter((row) => row.note !== null)

  const meta = { recordCount, urlCount: urls.length, fetched, cached }

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          ...meta,
          entryCount: results.length,
          counts: tally(results),
          hostConventions: HOST_CONVENTIONS,
          results: results.map((r) => ({
            id: r.id,
            citation: r.citation,
            host: r.host,
            url: r.url,
            verdict: r.verdict,
            detail: r.detail,
            diagnosis: r.diagnosis ?? null,
          })),
          apostropheStyle: apostrophes.map((r) => ({ id: r.id, host: r.host, note: r.note })),
        },
        null,
        2,
      ),
    )
  } else {
    printLedger(results, apostrophes, meta)
  }

  return results.some((r) => SERIOUS.includes(r.verdict)) ? 1 : 0
}

process.exitCode = await main()
