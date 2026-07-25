# Document parsing — spike findings

What local PDF text extraction actually recovers from retirement documents, measured, and whether OCR
is worth scoping. This is the deliverable of the advisor-intake WS5 spike: a decision, with the numbers
behind it.

**Nothing here is wired into the free import wizard.** `/import` still tells the user "no PDF upload —
you stay in control of what is entered", and that remains true. The extractor ships as the
`@retiregolden/planner-ui/document-text` subpath for the Pro intake workbench to consume, behind an
optional `pdfjs-dist` peer that a host must install deliberately. See
[imports-and-migration.md](imports-and-migration.md) for what the wizard does do.

Code: [`packages/planner-ui/src/import/documentText.ts`](../../packages/planner-ui/src/import/documentText.ts)
(the extractor), [`documentCorpus.ts`](../../packages/planner-ui/src/import/documentCorpus.ts) (the corpus
and its oracle), [`documentBenchmark.ts`](../../packages/planner-ui/src/import/documentBenchmark.ts)
(the scorer), [`pdfFixtures.ts`](../../packages/planner-ui/src/import/pdfFixtures.ts) (the PDF emitter).

```bash
npm run benchmark:documents -w @retiregolden/planner-ui           # the report
npm run benchmark:documents -w @retiregolden/planner-ui -- --json # the same numbers, machine-readable
```

The floors are pinned by
[`documentBenchmark.test.ts`](../../packages/planner-ui/src/import/documentBenchmark.test.ts), so a
regression fails the suite rather than waiting for someone to re-run a script.

## How the numbers are produced

The corpus is **hand-built in code**, not collected. The plan's risk section forbids bundled proprietary
samples ("accept user-provided documents only; no bundled proprietary samples"), and this repo commits no
binary fixtures at all — so eight documents are emitted byte by byte from a declaration that *also states
which field values they contain and which page each one is on*. That declaration is the oracle. It is
written by hand, before any extraction runs, which is what [testing.md](../testing.md) requires: the app
is never its own oracle.

An oracle written by hand can still be wrong, and being wrong in the *generous* direction is the failure
that matters: it can claim a document says something it does not. A test now checks every declared value
against the authored source of its own page, and no value may be declared on a page the generator does
not render at all.

Scoring runs a small set of **deliberately general field detectors** over the extracted text — a money
pattern, a masked-account pattern, a closed vocabulary of account types, a labelled-name pattern — and
compares what they propose against what was planted:

| Term | Meaning |
|---|---|
| Recall | Of the values printed on the page, how many did a detector produce |
| Precision | Of the values a detector produced, how many were actually wanted |
| Citation accuracy | Of the values found, how many were attributed to the page they are printed on |
| `miss:sel` | A miss whose text WAS extracted and the detector failed — a selection defect |
| `miss:ext` | A miss whose text was authored on the page and did not survive extraction |

Neither miss category is an OCR number, and **this benchmark does not produce one** — see
[what it cannot measure](#what-this-benchmark-cannot-measure-ocr). Every planted value sits on a page
that carries text, and a `coverage` block in the report asserts that against what extraction actually
returned, so a recall figure can never again be diluted by values the corpus never printed.

The detectors are not tuned to the corpus. If they were, precision would be 1.0 by construction and the
benchmark would measure nothing. Their false positives are the honest cost of reading a page of prose
that happens to contain numbers.

### Four things this benchmark had to fix about itself

Numbers a benchmark produces about its own author's code are worth exactly as much as the discipline
behind them. Four defects were found and corrected before the results below were taken. **Three moved
numbers down. The fourth moved five recall numbers up, and that one is the most serious of the four** —
it is the only one where the benchmark was asserting something untrue about the documents themselves.

1. **The oracle claimed values that were never printed.** The two scanned documents declared eight
   field values — `ELEANOR J WHITFIELD`, `$214,006.71`, a date, an account number, a type, three more
   amounts — on pages that carry no glyphs at all. `pdfFixtures.ts` renders `image: true` as a 1x1
   constant-grey sample stretched over the page; those strings existed only in the declaration. Counting
   them as false negatives measured their **absence from a document that never contained them**, and the
   resulting eight `miss:img` entries were then reported as the size of the OCR opportunity and used to
   argue the recommendation. The fix is *not* to rasterize the text: a crude bitmap font would produce a
   noise-free, skew-free, perfectly-contrasted raster whose OCR difficulty resembles nothing about a real
   scan, and a recall number taken against it would be optimistic in an unbounded way — worse than no
   number. So the values are gone, the scanned documents stay (they measure image-only *detection*,
   which is real and unaffected), and OCR recoverability is now stated as unmeasured. Recall rose on
   five of six fields; **no extractor code changed, and no precision moved by a single point.** This is a
   correction to the oracle, not an improvement in the product.
2. **The oracle had been fitted to the reader.** Page 2 of the broker statement prints
   `Individual Brokerage`; the corpus declared the value as the bare `Brokerage` — which is precisely the
   token the detector's closed vocabulary emits. That scores a hit while describing a document that does
   not exist, and it is the exact failure [testing.md](../testing.md) forbids ("the app is never its own
   oracle"). Stated as printed, it is a miss: `account_type` precision fell from 66.7% to **55.6%**,
   where it remains. (Its recall fell too at the time, from 85.7% to 71.4%, but that figure was then
   superseded by correction 1 and now reads 83.3% — see the table below, not this line.) Every other
   planted value is now checked against the document's own authored source lines by a test, so this
   class of drift fails the suite rather than flattering a table.
3. **One `balance` field was measuring two different problems.** Half its population came from the 1040,
   where every dot-leader amount (W-2 wages, AGI, standard deduction, taxable income, tax, withholding,
   overpayment) was counted as a planted "balance". A 1040 carries no account balances. The oracle is
   now split into `account_balance` (the stated value OF a named account) and `form_amount` (a numbered
   form line, or a printout's projected total). The **detector is deliberately not split to match**: on
   this corpus any separating signal — a currency sign, a leading form-line number — separates the two
   classes perfectly and would score near 100% while proving nothing, which is the same sin as fitting
   the oracle. One money scanner feeds both fields and is charged for both wrong answers, because asked
   for the balance it answers `$25.00` and asked for the form amount it answers `$25.00`; those are two
   real errors a naive mapper makes. That is why both money precisions are low, and it is the finding.
4. **Citation accuracy was close to unfalsifiable.** The scorer ran a same-page matching pass ahead of
   the value-only pass, so a value appearing on both its planted page and elsewhere was credited to the
   planted page by construction — the number could not fall for any repeated value. Attribution is now
   strict first-occurrence: a planted value claims the first detection of that value in page order, and
   the citation is right only if that is the page it was planted on. See
   [the citation caveat](#what-the-100-citation-number-does-and-does-not-prove) for what the surviving
   100% is actually evidence of.

## Results

Measured 2026-07-25 against `pdfjs-dist` 6.1.200, after the four corrections above.

### Per field

| Field | Planted | TP | FP | FN | Precision | Recall | Citation | Moved |
|---|---|---|---|---|---|---|---|---|
| name | 4 | 3 | 1 | 1 | 75.0% | 75.0% | 100% | recall **corrected up** from 60.0% |
| account_number | 5 | 5 | 2 | 0 | 71.4% | 100% | 100% | recall **corrected up** from 83.3% |
| account_type | 6 | 5 | 4 | 1 | 55.6% | 83.3% | 100% | recall **corrected up** from 71.4% |
| account_balance | 3 | 3 | 15 | 0 | 16.7% | 100% | 100% | recall **corrected up** from 50.0% |
| form_amount | 8 | 8 | 10 | 0 | 44.4% | 100% | 100% | unchanged |
| date | 4 | 4 | 3 | 0 | 57.1% | 100% | 100% | recall **corrected up** from 66.7% |

**Read the "moved" column as a correction, not as progress.** Not one line of `documentText.ts` changed
between the two runs. The eight values removed from the oracle were never printed in the corpus, so all
eight were counted as false negatives against text that did not exist; deleting them removes eight FNs
and nothing else. **Every precision figure is byte-for-byte identical** — 75.0 / 71.4 / 55.6 / 16.7 /
44.4 / 57.1 — because a value nothing detected also claimed no detection, so no numerator or denominator
on the precision side ever contained it. The numbers above are what this extractor was achieving all
along; the earlier table understated it by measuring an absence.

The old single `balance` row read 61.1% / 78.6%. It is not comparable to either row that replaced it and
should not be quoted alongside them: it averaged two detection problems, and both replacements are also
charged for the other's false positives.

The corpus total is **44.4% precision / 93.3% recall** (28 TP, 35 FP, 2 FN over 30 planted values;
recall was 73.7% under the phantom plants). **That number is not the result** and no claim may rest on
it — the plan's test section says so outright ("no launch claim based only on aggregate accuracy"), and
the table above shows why: precision ranges from 16.7% to 75.0% across fields, and the aggregate
double-charges every wrong money amount because a money scanner is asked two questions and gets both
wrong.

### Per document shape

| Shape | Planted | Precision | Recall | Note |
|---|---|---|---|---|
| Broker statement (4pp) | 8 | 22.6% | 87.5% | 24 false positives from the holdings table, the disclosures page, and money amounts offered to both money fields; the one miss is "Individual Brokerage" |
| Old-plan printout (2pp) | 9 | 81.8% | 100% | Including a two-column page whose reading order interleaves |
| Form 1040 (2pp) | 10 | 52.6% | 100% | Dot-leader amount lines with no currency sign, name label on the line above the value; every amount is also proposed as an account balance |
| Scanned statement (2pp) | 0 | n/a | n/a | Plants nothing — the pages carry no glyphs. Scored solely on image-only detection: 2/2 pages, no false positives. Was "6 planted / 0% recall" |
| Typed cover + scanned insert (2pp) | 3 | 100% | 66.7% | Cover page's three values planted and two read; the insert plants nothing and is flagged image-only. Was "5 planted / 40%" |
| Encrypted / corrupt / not-a-PDF | 0 | — | — | Refused, each for the right reason |

The two shapes whose numbers moved are the two with scanned pages, and they moved because the phantom
plants came out — not because anything read better.

### Where the planted values live

| | Count |
|---|---|
| Planted values | 30 |
| On a page extraction returned a text layer for | 30 |
| On a page it did not | **0** |

This replaces a "recall by surface" table that split recall into "where a text layer exists" (28/30) and
"where none does" (0/8) and presented the second column as the OCR decision. Its denominator was the
eight phantom values, so `0/8` was the corpus failing to find things it had never written down. Recall
is meaningful only over pages that carry text; the corpus now plants only there, and the check runs
against what extraction *returned* rather than against the corpus's own declaration, so it also catches
a value planted on a page that failed to read or was never reached.

### Scanned pages, stated as what is actually known

| | Value |
|---|---|
| Image-only pages planted | 3 |
| Image-only pages detected | 3 |
| False positives (a page called scanned that is not) | 0 |
| False negatives (a scanned page reported as blank) | 0 |
| Values recovered from a scanned page | not measured — see below |

Both remaining misses in the whole corpus are on pages that extracted perfectly: `SAMUEL O BRENNAN`
abutting a page counter, and `Individual Brokerage` against a closed account-type vocabulary. **Every
measured miss in this benchmark is a selection defect.**

### What this benchmark cannot measure: OCR

The corpus renders an image-only page as a 1x1 constant-grey sample stretched across the page. There is
no glyph on it, so there is nothing an OCR engine could be scored against, and **no number in this
document is evidence about OCR's accuracy, yield, or value.**

That gap cannot be closed by making the fixture fancier. A crude bitmap font would give a noise-free,
skew-free, perfectly-contrasted raster at a known resolution — the easiest possible input, resembling no
real scan, where real difficulty comes from sensor noise, skew, JPEG artifacts and photocopier gamma. A
recall number taken against such a fixture would be optimistic by an unknown and unmeasurable margin,
and would be quoted as if it were not. That is strictly worse than reporting nothing.

Closing it needs real scanned statements, which the plan's risk section forbids bundling ("accept
user-provided documents only; no bundled proprietary samples"). So it stays open, and the recommendation
below is derived without it.

## How it refuses, and who it blames

Honest refusal is WS5's acceptance criterion, so the reason vocabulary distinguishes not just *what*
went wrong but *whose* problem it is. Nothing here ever throws for a bad document, and nothing blames
the user's file for a fault that is not in it.

| Reason | What it means |
|---|---|
| `encrypted` | Password-protected. |
| `corrupt` | The bytes are not a readable PDF — reported only on pdfjs's own say-so (an allowlist of its document-fault exceptions), never inferred from an unexplained failure. |
| `not_pdf` | No `%PDF-` header in the first kilobyte. |
| `too_large` / `too_many_pages` | A cap fired; the message states the cap that actually fired. |
| `unreadable_input` | The buffer or view was detached before the call, so no byte was ever read — deliberately not `not_pdf`, which would be a guess dressed up as a finding. |
| `extraction_failed` | Reading failed for a reason that is not about the document. The file may be perfectly fine. |
| `pdfjs_unavailable` | The optional `pdfjs-dist` peer is not installed. |
| `pdfjs_worker_unavailable` | pdfjs-dist **is** installed but its main-thread worker module would not load. |
| `pdfjs_incompatible` | The host supplied a pdfjs build that does not expose the API this module drives. |

The last three are host-integration problems and say so; none is ever presented to a user as a
problem with their document. A consumer must treat an unrecognized reason as "could not read this
document" — the union is open by design, and these three were added after review found the original
code reporting all of them as `corrupt`.

A page that throws mid-document no longer discards the pages already read. It is recorded in
`summary.unreadablePages` and left **out** of `pages` entirely, because any entry there would assert
something false: empty `text` reads as blank and `imageOnly` reads as scanned, and the page is
neither. For the same reason `noTextExtracted` — the document-level "this needs OCR" signal — is false
whenever a page could not be read, since it is a claim about pages nobody managed to look at.

## What extraction handles well

- **Getting the characters out — 30 of 30.** Every planted value is present in the extracted text, by
  the benchmark's own text-presence check. Nothing measured here was lost by extraction. (The 93.3%
  reported as *recall* is a different quantity and belongs to the detectors, not the extractor: both of
  its two misses are values whose characters came out intact and whose selection failed, which the
  report labels "text present — selection gap". Quoting 28/30 as extraction coverage would understate
  the extractor by counting detector failures against it — and this document said exactly that before a
  reviewer caught it.) Line breaks survive and multi-column tables come
  back with their cells separated. (Not measured: `TJ` kerning arrays. The corpus emits `Tj` only, so
  whether kerned runs reassemble into whole words is untested here — a real statement is more likely to
  use `TJ` than this corpus is, so treat the numbers as an optimistic bound on that axis.)
- **Page citation, within the limits below.** 100% — no value found was attributed to a page it is not
  printed on, across four-page and two-page documents. `DocumentPage.page` is a 1-based integer and
  nothing has to parse a string to recover it.
- **Layouts that were expected to hurt and did not.** A 1040's dot-leader amount lines (`149,315` with
  no currency sign, preceded by fourteen periods) extract cleanly. A two-column printout interleaves the
  columns on each baseline — the reading order is wrong — but every value still survives with the right
  page.
- **Refusing honestly.** All 8 documents produced the outcome the corpus declared: `encrypted`,
  `corrupt`, and `not_pdf` each named correctly, and no document threw. That is the WS5 acceptance
  criterion ("unsupported documents fail honestly and preserve manual path") and it holds.
- **Telling a scanned page from a blank one.** 3 image-only pages planted, 3 detected, zero false
  positives and zero false negatives — including a blank separator page inside the statement, which is
  reported as empty rather than as scanned. Sending a user to OCR over a blank page would be a
  self-inflicted wound. This is the single most useful thing the scanned documents in the corpus
  establish, and it is the whole of what they establish.

## What extraction does not handle

- **Scanned pages, completely — and by how much is unknown.** A page with no text layer yields no text,
  which is a tautology rather than a measurement; how much of a real scan is *recoverable* by any means
  is not measured here and cannot be (see
  [what this benchmark cannot measure](#what-this-benchmark-cannot-measure-ocr)). What is measured is
  that such a page is always identified as one, so a UI never presents it as an empty result.
- **Precision, everywhere.** No field exceeds 75%. `account_balance` is worst at 16.7%: a money scanner
  proposes a statement's positions, its SIPC limits, its paper-statement fee and every 1040 line, and
  cannot tell which of them is the value of an account. `date` is 57.1% because a statement carries a
  period start as well as a period end, a form revision date, and a copyright year, and all four look
  identical to a date pattern. **Extraction is not the bottleneck; selection is.**
- **Columns set with no gap.** pdfjs inserts a space between two text runs only when the horizontal gap
  warrants one, so a header that abuts a right-aligned page counter comes back as
  `Account holder: SAMUEL O BRENNANPage 1 of 2`. The characters are all there and the value is
  destroyed anyway. It is worth more attention than its count suggests: OCR would not fix it, and it is
  invisible to any check that only asks "does this string appear somewhere".
- **Values that a closed vocabulary can only partly name.** The statement's second account is an
  `Individual Brokerage`; the account-type detector's keyword list can emit `Brokerage` and nothing
  longer, so the value is both a miss and a false positive. The characters survived extraction intact —
  the second of the corpus's two `miss:sel` entries, and another selection problem OCR cannot touch.
- **Reading order.** pdfjs returns content-stream order, not visual order. Side-by-side blocks interleave
  on every baseline. No planted value was lost to this in the corpus, but a mapper that reads
  "label then value on the same line" will pair the wrong ones on a two-column page.
- **Deciding `imageOnly` costs a page decode.** Only text-less pages are checked, but on a fully scanned
  document that is every page. Bounding it with `maxImageSize` would destroy the signal, because pdfjs
  drops paint operators for images it declines to decode.

### What the 100% citation number does and does not prove

Attribution is strict first-occurrence: a planted value claims the first detection of that value in page
order, and the citation counts as correct only if that detection is on the page the value was planted on.
A value found on a page it is not printed on therefore IS reported as mis-cited, and a scorer spec proves
it by planting a value on page 2 of a document that prints it on both pages and asserting 0% citation
accuracy.

But **this corpus prints exactly one planted value on more than one page** — `Roth IRA`, on the
statement's page 1 and again in its page-4 disclosures — and there the first occurrence and the planted
page agree. A test pins that count, so this paragraph goes stale loudly rather than quietly.

So the honest reading of 100% is: *no value was attributed to a page it is not printed on*. It is **not**
evidence that attribution stays right when a document repeats a value across pages, which is the case
that actually bites — a continued holdings table, a repeated account number in a page footer, a total
restated on a summary page. Real statements do all three. Treat the citation mechanism as sound and the
citation *rate* as barely exercised until it has been run against documents that repeat themselves.

### What the corpus does not prove

These are generator-clean PDFs with a base-14 font and uncompressed content streams. They reproduce
layout hazards — columns, abutment, dot leaders, interleaved reading order, scanned inserts, distractor
values — but not a real custodian's font subsetting, ligatures, CID/Identity-H encodings, rotated text,
or tagged-PDF structure. **Every recall number here is an upper bound** on the same number against a real
statement. Nothing in this document supports a launch claim; it supports a build/don't-build decision.

And, stated once more because it used to be stated the other way: **it proves nothing whatever about
OCR.** An image-only page here has no glyphs on it. The corpus can say that such a page is recognised as
such; it cannot say what is on one, and therefore cannot say what recognising it would be worth.

Nor does it exercise the other end of that signal. `imageOnly` means what it measures — no text layer,
and at least one raster paint operator — and it does not weigh how much of the page the raster covers,
so a textless cover or separator page carrying only a logo, watermark or signature is reported as
image-only too. The corpus contains no such page, so the false-positive rate for decorative rasters is
**unmeasured here**. Weighing coverage means reconstructing the CTM across the graphics-state stack and
then picking a threshold, and a threshold is only honest once it has been checked against real scanned
documents — which this corpus cannot contain. Guessed at instead, it would err toward calling a cropped
or low-DPI scan blank, the same failure direction as missing a raster operator entirely. Recorded as
follow-up rather than settled by a number nobody has validated.

## Recommendation: do not scope OCR now — re-derived

The earlier version of this section argued partly from "OCR would buy exactly these eight values." That
argument is **withdrawn**: the eight values were never in the documents, so nobody has ever measured what
OCR would buy, including the version of this note that said it had. What follows rests only on what the
corpus does establish — precision by field, the false-positive load, image-only detection, and honest
refusal — plus the cost side, which is a matter of engineering fact rather than measurement.

The conclusion is unchanged, but the reasoning that supports it is different and weaker in one specific
way: it is now a decision **under acknowledged uncertainty about the benefit**, not a decision that the
benefit is small.

1. **The one defect this benchmark measured is selection, and OCR does not touch it.** 28 true positives
   against **35 false positives**: a naive reader proposes more wrong values than right ones, on every
   document shape including the three that read perfectly. Precision runs 16.7%–75.0%; recall over
   readable pages is 93.3%, and the entire 6.7% shortfall is two values whose characters extracted
   intact. So *every measured failure in the corpus is a selection failure*. OCR would not improve
   precision by a single point — it would add a second document class, with worse character fidelity,
   feeding the same selection stage that is already the weak link. Whatever the next increment is spent
   on, spending it here pays off on documents that already work as well as on ones that do not.
2. **The measured scanned-page behaviour is already a supportable product answer.** 3 image-only pages
   planted, 3 detected, no false positives in either direction — including a blank separator page
   correctly *not* called scanned. With `noTextExtracted` and per-page `imageOnly`, a UI can say "these
   pages are scanned images — type these values in" rather than showing an empty result. That is WS5's
   acceptance criterion ("unsupported documents fail honestly and preserve manual path"), it holds, and
   it holds without OCR. OCR would upgrade this experience; it is not required to make it honest.
3. **The benefit of OCR is unmeasured, the cost is not, and this benchmark cannot close the gap.** A
   local OCR engine is tens of megabytes of WebAssembly plus per-language trained data, running on the
   same thread the extractor already runs on, and the local-only promise means it can never be a service
   call. Against that certain cost sits an accuracy nobody has measured — and, separately, an *incidence*
   nobody has measured either: how often a real advisor's intake pile is scanned rather than digital is
   also not known. Committing a large, permanent, irreversible cost against two unquantified unknowns is
   the wrong order of operations, and it is the same mistake as claiming PDF import on an aggregate.
   Note that this is a weaker claim than "OCR is not worth it" — it is "the evidence to decide is
   missing, the cheaper measured path is not, do that one first."

**What would change this recommendation.** Any one of: a measurement of a candidate engine's recall on
real scanned statements that comes back high; evidence that scanned documents are a large share of real
intake; or a mapper good enough that scanned pages are demonstrably the remaining blocker. None of the
three exists today, and the first two cannot be produced by this benchmark at all — they need real
documents, which the plan forbids bundling and which must therefore be measured against and discarded,
never committed.

### What to do instead, in order

1. **Build the field mapper and measure precision again.** The detectors in `documentBenchmark.ts` are a
   floor, not a design. Label-anchored, per-region selection with a confidence score should move
   precision well above 75%; the benchmark is already the instrument for checking whether it does. The
   money case is the sharpest test: a mapper that can tell an account's stated value from a tax-form line
   turns two 17–44% precisions into something worth quoting, and no amount of OCR does that.
2. **Handle abutment and open-ended vocabularies before anything exotic.** pdfjs exposes per-item
   geometry through `getTextContent`; splitting runs on their x-positions rather than trusting the
   emitted spacing turns the `SAMUEL O BRENNAN` miss into a hit. Matching an account type as a labelled
   phrase rather than against a closed keyword list turns `Individual Brokerage` into a hit. Both are
   bounded changes and between them they are **every miss in the corpus** — after the phantom plants came
   out, these two are the entire recall gap.
3. **Extend the corpus before trusting the citation number.** It contains only one value printed on two
   pages, so page attribution is barely exercised (see the caveat above). Continued tables, repeated
   footers and restated totals are the cases that will break it, and they are cheap to add to a
   generator-built corpus.
4. **Promote page citations into `SourceLocator`** — but after (3), not before. The citation mechanism is
   the strongest part of the spike and the piece worth making a published contract; the *rate* is not yet
   evidence. It is deliberately NOT in the `SourceLocator` union today — see the header of
   `documentText.ts` for why adding a locator kind before the decision was made would have broken older
   consumers' `parseImportProvenance`.
5. **Re-run this benchmark against real, user-supplied documents** — read, measured, and discarded, never
   committed — before any claim about PDF import is made to a user. The synthetic ceiling is not a
   product claim.
6. **Measure OCR before deciding about OCR.** The one thing this spike cannot tell you is the thing the
   OCR question turns on. Running a candidate engine over a handful of real scanned statements — read,
   scored against values typed in by hand, and discarded — is a day of work and it converts the
   recommendation above from a decision under uncertainty into a decision on evidence. Do that before
   either scoping OCR or ruling it out permanently; the current answer is "not now", not "never".
7. **Revisit OCR when** (a) the mapper's precision is good enough that scanned documents are the
   remaining blocker, and (b) (6) has produced a number. Neither condition holds today.
