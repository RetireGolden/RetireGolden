# Quote fidelity: verifying the tax rule registry against its sources

Every rule in [`packages/engine/src/rules/taxRuleRegistry.ts`](../../packages/engine/src/rules/taxRuleRegistry.ts)
carries an `authority[]` array, and every entry in it carries a `url` and a `quotedText`. The field's
contract is **character-exact operative language, quoted rather than paraphrased**. That contract is the
registry's whole value: the quote is what a preparer is shown when they ask why a number came out the way
it did, and a paraphrase is exactly where a dropped qualifier hides.

Nothing in the test suite could check it. `taxRuleRegistry.conformance.test.ts` verifies publisher tier,
quote *presence*, and error direction — but it cannot fetch a source, so quote *fidelity* had no guard at
all. A fluent sentence assembled from three rows of a Rev. Proc. table passes conformance and human review
alike, because it reads exactly like a quotation.

`npm run verify:quotes` is that guard.

It answers one of the two questions a cited record has to survive. Fidelity is *does the quote match the
source*; **sufficiency** is *does the quote support the statement written above it* — a separate failure
mode, with no checker, covered in [authority-sufficiency.md](authority-sufficiency.md). A quote can pass
everything on this page and still be evidence for a claim the record does not make, or no evidence for the
claim it does.

```bash
npm run verify:quotes                      # from the repo root
npm run verify:quotes -w @retiregolden/engine
node packages/engine/scripts/verify-quotes.mjs --help
```

Useful flags: `--filter <substring>` (one rule, one citation, or one host), `--refresh` (ignore the cache),
`--json`, `--delay <ms>`, `--cache-dir <path>`. Sources are cached under
`packages/engine/node_modules/.cache/verify-quotes`, so a second run costs no network.

## Why this is not in CI

Two reasons, either one disqualifying:

- **It needs the network.** The engine is deliberately network-free — `eslint.config.js` bans `fetch`
  inside `src/**`. The verifier lives in `packages/engine/scripts/` for that reason, and never ships.
- **The sources are mirrors, and mirrors lag.** `uscode.house.gov` and `law.cornell.edu` publish the U.S.
  Code on their own schedule. A red build would sometimes mean *Congress moved faster than the mirror*,
  which is not a signal a build should carry. When a quote fails only because the mirror predates an
  amendment, the fix is to wait or re-cite — **not** to change the quote to match a stale page.

Run it by hand after touching the registry, and as part of the annual re-verification pass
([maintenance-schedule.md](../maintenance-schedule.md)). It exits non-zero when anything serious is found,
so it composes into a shell chain; it is just never a gate.

## What it asserts

Exactly three things, plus two free checks. Everything else it reports without asserting.

1. **Every segment of an elided quote is present.** A quote containing `...` or `…` is split on the
   markers and each segment checked independently. Honest elision is legitimate and common here; what this
   catches is a quote that dropped text *without saying so*.
2. **After the punctuation ladder, the quote is still a substring of the source.** The ladder folds away
   differences in how a publisher *renders* a character. What survives it is a difference in the words.
3. **A source that cannot be fetched fails loudly.** Never skipped, never silently passed. A page that
   returns 200 but only a few hundred characters of text — a shell, a bot challenge, an error page in
   disguise — counts as unfetchable, because treating it as a source would report every quote on it as
   absent.

Free, because the fetch already happened:

- **Apostrophe style** is checked against the cited host's measured convention (table below). A quote
  carrying U+2019 against a host that renders U+0027 was copied from somewhere other than the page it
  cites.
- **PDF sources never PASS.** See below.

### What it deliberately does *not* do

It does not fold away the registry's own rewrites of the source text — `$6,000` written as
"6,000 dollar amount", a possessive `'s` deleted, `doesn't` expanded to "does not", a table flattened into prose.
Those are alterations of the words, not differences in rendering, and the field's contract forbids them.
They are reported as `ABSENT`, with a diagnosis showing the point at which the quote leaves the source, so
you can tell a de-symbolised quote from a composed one at a glance.

If the project ever decides those rewrites are acceptable, the right move is a declared convention field on
the authority entry — not a quieter checker.

## Reading the output

The ledger is split into three buckets so the serious findings are not buried under punctuation noise.

### SERIOUS — the registry is wrong here, or cannot be shown to be right (exit code 1)

| Verdict | Means | What to do |
|---|---|---|
| `ABSENT` | No arrangement of rendering differences makes the quote a substring of the cited page. The diagnosis prints how many words matched before divergence and what the source actually says at that point. | Read the diagnosis. Three common shapes: a **composed** sentence assembled from a table or an enumerated list (the dangerous one — it reads like a quotation and is not); a **rewritten** sentence in the registry's own words; a **de-symbolised** quote where only `$`, `%`, `§` or a possessive was changed. Re-quote from the source. |
| `TRUNCATED` | The quote matches once the terminal punctuation it ends with is removed — i.e. the quote closes a sentence the source keeps writing. The mark is stripped from the quote only, never from the source, so this one *is* directional; the ledger names which mark it was (period, semicolon, colon or comma). | Check what was cut. This has hidden operative limbs before (`…is taken into account.` where the regulation reads `…is taken into account **in determining whether section 401(a)(9) is satisfied**`). Either restore the full sentence or mark the cut with `...`. |
| `ELISION-BROKEN` | A quote uses `...` markers, but at least one segment between them is not in the source. | The elision is not the problem; the segment is. Treat as `ABSENT` for that segment. |
| `UNFETCHABLE` | The page could not be retrieved, or returned a challenge/stub instead of the document. Only the network request can produce this — a cache or temp-directory failure warns and carries on, because it is a fact about your machine and this verdict is an accusation against a publisher. | Not a registry defect on its own, but the citation is unverified until it resolves. `www.jct.gov` sits behind a Cloudflare challenge and is expected here; the script does not attempt to defeat it. Consider citing a mirror that serves the same text. |

### ADVISORY — faithful, but not literally character-exact

`PUNCTUATION` and `ELISION-PUNCTUATION` mean the quote matched only after one or more ladder rungs, and the
report names which. These are real deviations from "character-exact" and are worth fixing in bulk, but none
of them changes what the authority says. The apostrophe-style list is reported here too.

### Informational

| Verdict | Means |
|---|---|
| `EXACT` | Literal substring of the source once whitespace is normalised — see the baseline note under the ladder. Nothing else folded. The contract, met. |
| `ELISION-EXACT` | Every segment between elision markers is a literal substring. The correct way to shorten a quote. |
| `PDF-WORD-LEVEL` | The quote is a substring of the extracted PDF text once the punctuation ladder has been applied — the same test an HTML source would have to pass, but reported one grade lower because extraction, not the registry, may be what the ladder is absorbing. **Not a pass** — see below. |
| `PDF-NOT-VERIFIABLE` | The PDF could not be read; or every word is present but **no ladder rung** accounts for the remaining difference, so a real defect cannot be told apart from extraction damage. |

The two PDF verdicts are not "words present" versus "words absent" — a quote whose words are all
absent is `ABSENT`, on a PDF as anywhere else. They differ by **whether the punctuation ladder
explains the difference**. `PDF-WORD-LEVEL` means it did and the result is a substring;
`PDF-NOT-VERIFIABLE` means it did not, which on an HTML source would be a finding and here is
undetermined.

## Why PDF sources never PASS

Nine of the cited sources are PDFs (IRS notices, revenue procedures, form instructions). Extracting text
from them is lossy in exactly the places this check cares about: `§` comes out as U+FFFD, `½` is glued to
the preceding digit (`701/2`), and every curly character is gone. Certifying a quote as *character*-exact
against that text would be an assertion about poppler, not about the registry.

So a PDF yields `PDF-WORD-LEVEL` at best — the strongest honest claim available. Words that are genuinely
**absent** are still reported as `ABSENT`, because extraction loss cannot add or remove whole words; that
is how a table-derived sentence in a Rev. Proc. is still caught.

Extraction uses `pdftotext` (poppler) if it is on `PATH`. It is deliberately not a dependency: without it,
PDF-sourced quotes report `PDF-NOT-VERIFIABLE` and everything else still runs.

## The punctuation ladder

Cumulative, weakest first. A quote is tested at each rung in order and reported at the **first** rung that
matches, so the reported rung is the minimal transformation needed — which is the diagnosis. Every rung
exists because of a specific host convention, listed in the next section.

**Every rung, including the first, sits on a whitespace baseline**: runs of whitespace are collapsed
to a single space and both strings are trimmed before any comparison. That is not a concession to
sloppy quoting — source text is reconstructed from markup, where a newline and an indent between two
tags carry no meaning, and refusing to collapse would fail every quote that happens to span a line
break in the HTML. So `EXACT` means *"a literal substring once whitespace is normalised"*, not
*"byte-for-byte"*. Nothing else is folded at that rung.

| Rung | Folds | Because |
|---|---|---|
| `exact` | nothing beyond the whitespace baseline above | The contract the field states. |
| `apostrophe` | U+2019 U+02BC U+2032 → U+0027 | LII and most irs.gov pages render the possessive U+2019; uscode, govinfo and eCFR render U+0027. |
| `quote-marks` | U+201C U+201D → U+0022 | LII wraps statutory defined terms in curly quotes; the other hosts use straight. |
| `dashes` | U+2014 U+2013 U+2212 U+2010 U+2011 → `-` | The same structural dash is an em dash on LII/govinfo/eCFR and a plain hyphen-minus on uscode. |
| `dash-spacing` | whitespace around `-` | Sources set the structural dash tight (`the sum of—(A)`); registry quotes commonly write ` - `. |
| `spaces` | U+00A0 and friends → space | HTML sources emit no-break spaces inside statutory text; they survive entity decoding. |
| `fractions` | `½` `1⁄2` `701/2` → `70 1/2` | uscode sets `age 59½` tight, eCFR sets `age 70 1⁄2` with U+2044, PDFs yield `701/2`. |
| `section-sign` | `§`/`§§` → "section"/"sections", **PDF sources only** | PDF extraction destroys `§` (it comes out U+FFFD). On an HTML source every host emits `§`, so a quote that spells it out has rewritten a word — that is a registry rewrite and stays `ABSENT`, not a rendering difference. |
| `case` | lowercase | A quote beginning mid-sentence is commonly lowercased to fit its lead-in. |
| `whitespace` | all whitespace | Tag stripping and PDF reflow insert or drop spaces that were never in the text. Applied last, when spacing is the only remaining noise. |

One check runs *after* the ladder and after the truncation probe: **stray punctuation** — a comma, period,
semicolon or colon on which the quote and the source disagree. The mark is stripped from both texts, so the
check cannot tell which side carries the extra one; in practice it is the quote, but the verdict does not
claim that. It runs last on purpose, because deleting terminal punctuation earlier would hide an unmarked
truncation, and a truncation is a finding, not noise.

## Per-host rendering conventions

Measured across every page this registry cites, not assumed. This is the table a fix needs in order not to
guess. It is also encoded in `HOST_CONVENTIONS` in the script, and
`packages/engine/src/rules/quoteFidelityDocs.test.ts` holds the two together: it parses the table below,
imports `HOST_CONVENTIONS`, and fails if they name different hosts or disagree on an apostrophe, a
structural dash or a section sign. So the drift is caught by `npm test`, not by a reader noticing. The
notes column is prose and is not compared.

| Host | Possessive apostrophe | Structural dash | Section sign | Also worth knowing |
|---|---|---|---|---|
| `uscode.house.gov` | **U+0027** (straight), exclusively | **U+002D** plain hyphen, set tight: `the excess of-(I)` | `§` in notes; the statutory body spells out "section" | Straight U+0022 double quotes around amended text. `½` is U+00BD set tight (`age 59½`). U+2013 appears only inside Pub. L. numbers, never as a structural dash. |
| `www.govinfo.gov` | **U+0027** | **U+2014** em dash, tight: `paragraph (1)—(A)` | `§` | Straight double quotes. Embeds `<!-- PDFPage:NNNN -->` comments *inside words*, so tag stripping must not insert a space. |
| `www.law.cornell.edu` | **U+2019** (curly) | **U+2014** em dash | `§` | Curly U+201C/U+201D double quotes around defined terms. Some CFR pages use the U+2044 fraction slash (`70 1⁄2`). LII's CFR pages carry far less text than the eCFR original — **prefer eCFR when citing a regulation**. |
| `www.ecfr.gov` | **U+0027** | **U+2014** em dash | `§` | Renders halves as `70 1⁄2` with U+2044 *and surrounding spaces*. Straight double quotes. |
| `www.irs.gov` (HTML) | **inconsistent** — no assertion made | U+2014 | `§` | P969 and the Form 5329 instructions use U+2019 (`doesn’t`); P590-B uses U+0027 (`decedent's`). Contractions are the publication's own voice and must be quoted as written. |
| `www.irs.gov` (PDF) | not recoverable | not recoverable | extracts as U+FFFD | Word-level matching only. See "Why PDF sources never PASS". |
| `www.jct.gov` | unknown | unknown | unknown | Behind a Cloudflare challenge; the script reports it `UNFETCHABLE` rather than working around it. |

## Caveats

- **A failure is not automatically a registry defect.** Confirm against the enrolled text before changing a
  quote — especially for recent legislation, where the mirrors lag.
- **The cache does not expire.** Pass `--refresh` when re-verifying against sources that may have moved.
- **The cache is a convenience, never evidence.** A cache that cannot be written, cannot be read, or holds a
  corrupt entry degrades to a refetch and prints one warning on stderr. It never produces a verdict: a
  read-only or full disk is a fact about your machine, and `UNFETCHABLE` is a claim about a publisher. The
  same rule covers the temp directory used to stage PDFs for extraction.
- **Requests are serialised** with a delay (default 1200 ms) because these are public government servers.
  A full run is roughly one hundred requests.
