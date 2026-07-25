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

Scoring runs a small set of **deliberately general field detectors** over the extracted text — a money
pattern, a masked-account pattern, a closed vocabulary of account types, a labelled-name pattern — and
compares what they propose against what was planted:

| Term | Meaning |
|---|---|
| Recall | Of the values printed on the page, how many did a detector produce |
| Precision | Of the values a detector produced, how many were actually wanted |
| Citation accuracy | Of the values found, how many were attributed to the page they are printed on |
| `miss:img` | A miss whose text was never in any text layer — **only OCR can fix this** |
| `miss:txt` | A miss whose text WAS extracted and the detector failed — a mapper defect; OCR is irrelevant |

The detectors are not tuned to the corpus. If they were, precision would be 1.0 by construction and the
benchmark would measure nothing. Their false positives are the honest cost of reading a page of prose
that happens to contain numbers.

### Three things this benchmark had to fix about itself

Numbers a benchmark produces about its own author's code are worth exactly as much as the discipline
behind them. Three defects were found and corrected before the results below were taken, and **all three
moved numbers down**:

1. **The oracle had been fitted to the reader.** Page 2 of the broker statement prints
   `Individual Brokerage`; the corpus declared the value as the bare `Brokerage` — which is precisely the
   token the detector's closed vocabulary emits. That scores a hit while describing a document that does
   not exist, and it is the exact failure [testing.md](../testing.md) forbids ("the app is never its own
   oracle"). Stated as printed, it is a miss, and `account_type` fell from 66.7%/85.7% to 55.6%/71.4%.
   Every other planted value is now checked against the document's own authored source lines by a test,
   so this class of drift fails the suite rather than flattering a table.
2. **One `balance` field was measuring two different problems.** Half its population came from the 1040,
   where every dot-leader amount (W-2 wages, AGI, standard deduction, taxable income, tax, withholding,
   overpayment) was counted as a planted "balance". A 1040 carries no account balances. The oracle is
   now split into `account_balance` (the stated value OF a named account) and `form_amount` (a numbered
   form line, or a printout's projected total). The **detector is deliberately not split to match**: on
   this corpus any separating signal — a currency sign, a leading form-line number — separates the two
   classes perfectly and would score near 100% while proving nothing, which is the same sin as fitting
   the oracle. One money scanner feeds both fields and is charged for both wrong answers, because asked
   for the balance it answers `$25.00` and asked for the form amount it answers `$25.00`; those are two
   real errors a naive mapper makes. That is why both money precisions are low, and it is the finding.
3. **Citation accuracy was close to unfalsifiable.** The scorer ran a same-page matching pass ahead of
   the value-only pass, so a value appearing on both its planted page and elsewhere was credited to the
   planted page by construction — the number could not fall for any repeated value. Attribution is now
   strict first-occurrence: a planted value claims the first detection of that value in page order, and
   the citation is right only if that is the page it was planted on. See
   [the citation caveat](#what-the-100-citation-number-does-and-does-not-prove) for what the surviving
   100% is actually evidence of.

## Results

Measured 2026-07-25 against `pdfjs-dist` 6.1.200, after the three corrections above.

### Per field

| Field | Planted | TP | FP | FN | Precision | Recall | Citation | Moved |
|---|---|---|---|---|---|---|---|---|
| name | 5 | 3 | 1 | 2 | 75.0% | 60.0% | 100% | unchanged |
| account_number | 6 | 5 | 2 | 1 | 71.4% | 83.3% | 100% | unchanged |
| account_type | 7 | 5 | 4 | 2 | 55.6% | 71.4% | 100% | **down** from 66.7% / 85.7% — the fitted oracle |
| account_balance | 6 | 3 | 15 | 3 | 16.7% | 50.0% | 100% | new — split out of `balance` |
| form_amount | 8 | 8 | 10 | 0 | 44.4% | 100% | 100% | new — split out of `balance` |
| date | 6 | 4 | 3 | 2 | 57.1% | 66.7% | 100% | unchanged |

The old single `balance` row read 61.1% / 78.6%. It is not comparable to either row that replaced it and
should not be quoted alongside them: it averaged two detection problems, and both replacements are also
charged for the other's false positives.

The corpus total is 44.4% precision / 73.7% recall, down from 64.4% / 76.3%. **That number is not the
result** and no claim may rest on it — the plan's test section says so outright ("no launch claim based
only on aggregate accuracy"), and the table above shows why: the aggregate averages together a document
class where recall is 100% and one where it is 0%, and it now double-charges every wrong money amount
because a money scanner is asked two questions and gets both wrong.

### Per document shape

| Shape | Planted | Precision | Recall | Note |
|---|---|---|---|---|
| Broker statement (4pp) | 8 | 22.6% | 87.5% | 24 false positives from the holdings table, the disclosures page, and money amounts offered to both money fields; the one miss is "Individual Brokerage" |
| Old-plan printout (2pp) | 9 | 81.8% | 100% | Including a two-column page whose reading order interleaves |
| Form 1040 (2pp) | 10 | 52.6% | 100% | Dot-leader amount lines with no currency sign, name label on the line above the value; every amount is also proposed as an account balance |
| Scanned statement (2pp) | 6 | n/a | **0%** | No text layer on any page |
| Typed cover + scanned insert (2pp) | 5 | 100% | 40% | Cover page readable, insert not |
| Encrypted / corrupt / not-a-PDF | 0 | — | — | Refused, each for the right reason |

### The OCR decision, stated as two numbers

| Field | Recall where a text layer exists | Recall where none does |
|---|---|---|
| name | 75.0% (3/4) | 0% (0/1) |
| account_number | 100% (5/5) | 0% (0/1) |
| account_type | 83.3% (5/6) | 0% (0/1) |
| account_balance | 100% (3/3) | 0% (0/3) |
| form_amount | 100% (8/8) | n/a (0/0) |
| date | 100% (4/4) | 0% (0/2) |
| **all fields** | **93.3% (28/30)** | **0% (0/8)** |

Eight of the ten total misses are values on scanned pages. The other two are not, and both are worth
more than their count: `SAMUEL O BRENNAN` abutting a page counter, and `Individual Brokerage` against a
closed account-type vocabulary. OCR would move neither.

## What extraction handles well

- **Getting the characters out.** Where a text layer exists, 28 of 30 planted values came back and 8 of
  10 misses were on pages that had no text layer at all. Line breaks survive, multi-column tables come
  back with their cells separated, and `TJ` kerning arrays reassemble into whole words.
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
  self-inflicted wound.

## What extraction does not handle

- **Scanned pages, completely.** 0 of 8 values on image-only pages recovered — not a low number, a zero.
  Both the fully scanned statement and the scanned insert behind a typed cover page.
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
  the second `miss:txt` in the corpus, and another mapper problem OCR cannot touch.
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

## Recommendation: do not scope OCR

**Not now, and not on the strength of these numbers.** Three reasons, in order of weight:

1. **The bottleneck is selection, not extraction.** Where a text layer exists, recall is 93.3% and no
   value was mis-cited — the characters and their page numbers are already there. Precision is 17–75%,
   meaning a naive reader proposes several wrong values for every right one, and both misses that were
   NOT on a scanned page are selection failures over text that extracted perfectly. OCR does not improve
   precision by a single point; it adds a second document class with *worse* character fidelity to the
   same selection problem. Spending the next increment on field selection and on a confirm-every-value
   review step buys more than OCR does, on every document type, including the ones that already work.
2. **The honest-refusal path already preserves the manual route.** A scanned document is detected
   exactly (3/3 pages, no false positives either way) and reported as `noTextExtracted` with per-page
   `imageOnly` flags. The user gets "these pages are scanned images — type these values in" instead of a
   silent empty result. That is a supportable product answer today, and it is what WS5 asked the spike to
   guarantee.
3. **OCR is a large, permanent commitment for an unmeasured payoff.** A local OCR engine is tens of
   megabytes of WebAssembly plus per-language trained data, it would run on the same main thread the
   extractor already runs on, and the local-only promise means it can never be a service call. Its
   accuracy on a scanned statement is currently **unknown** — this spike measured extraction, not
   recognition — so scoping it now would be committing the cost before measuring the benefit, which is
   the same mistake as claiming PDF import on an aggregate.

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
   bounded changes and between them they are every non-scanned miss in the corpus.
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
6. **Revisit OCR only when** (a) the mapper's precision is good enough that scanned documents are the
   remaining blocker, and (b) someone has measured a candidate OCR engine's recall on a scanned
   statement. Neither condition holds today.
