# Authority sufficiency: whether a rule's quotes support its statement

[quote-fidelity.md](quote-fidelity.md) answers one question about the tax rule registry: **does the quoted
text match the source it cites?** This answers the other one: **does the quoted text support the sentence the
record writes above it?**

They are independent, and only the first has a checker. A `statement` can rest on quotations that are
character-exact, fetched from a primary publisher, and correctly attributed, and still assert something no
span on the record establishes. `npm run verify:quotes` passes it. `taxRuleRegistry.conformance.test.ts`
passes it — the guard there checks quote *presence* and publisher tier, not entailment. A reader skimming
the record passes it too, because a fluent sentence sitting directly above four verbatim statutory
quotations reads as though it were derived from them.

The registry's contract is that a preparer can be shown the quote as the reason a number came out the way it
did. A statement that outruns its quotes breaks that contract in a way a paraphrase does not: the quote is
real, so the claim inherits the quote's authority without ever having earned it.

## What this is calibrated against

PR #201 registered the first fifteen state records across twelve states. It took six rounds of review
findings. The largest single class was this one: **eight of the fifteen records had a statement claiming more
than the text quoted in their `authority` array supported, and review caught exactly one of the eight.** The
rest surfaced only when someone read all fifteen statement by statement, after the one finding prompted a
sweep. (Treat eight as the order of magnitude rather than a tally: the sweep's own
write-ups enumerate nine records if you count a tightened North Dakota phrase, which was fixed in the same
pass and reported as housekeeping. That the count is soft by one is itself the point — nobody was in a
position to be sure without re-reading every record.)

The failures were not exotic. Every one of them is a sentence a careful person wrote while looking at the
right law, having quoted the wrong part of it — or the right part, and not enough of it. The shapes:

| Record | What outran the quotes |
|---|---|
| `mrs-36-5124-c-1-b-decoupled-standard-deduction` | The record is *named for* Maine's decoupling from the federal standard deduction. The IRC 63(c)(3) link is in subsection (1-B)(B) and the decoupling itself is in (1-A); **neither was quoted.** The worst gap in the set — the provision the record exists to report was absent from its own authority array. |
| `tx-const-8-24-a-…` and `tx-const-8-24-b-…` | Both asserted a constitutional adoption date that appeared in no quoted span. |
| `tx-const-8-24-b-capital-gains-tax-prohibited` | Also asserted that "Texas enacted no such tax" through tax year 2025 — an unquoted legislative negative with no source behind it. |
| `fl-const-7-5-a-income-tax-prohibited` | Claimed that no Florida individual income tax exists. The quotes supported only that *chapter 220* stops at the corporate boundary. |
| `wv-code-11-21-12-…` (the one review caught), plus the Iowa, North Dakota and Pennsylvania records | A limb of the statement sat past the end of the quote, or rested on a subdivision that was cited nowhere in the array. |

And the counter-example, which is the model: `il-ita-203-a-2-F-retirement-income-subtraction` quotes the
**whole subparagraph**. Its claim that the provision "states no age, no dollar cap, and no retirement-status
condition" is checkable by reading the span on the record — you do not have to go anywhere else, and you do
not have to trust that nothing was cut.

## 1. Quote the complete provision, not the minimum span

Quote the whole subdivision the rule turns on, including its lead-in and its closing punctuation, even when
the sentence you are writing today needs only a clause of it.

The reason is drift, not thoroughness. A span cut to the minimum supports exactly the sentence it was cut
for. The statement then grows — a reviewer asks a question, an adjacent rule gets registered, the pack gains
a field — and the next clause added to it silently outruns a span that was only ever sized for the first.
Nothing fails. The record still passes fidelity, still cites a primary publisher, still reads as sourced.

The Iowa and Pennsylvania findings are both this shape at one remove: the statement named something real and
correct, and the quote stopped just short of it. Widening the span costs a few lines of a file nobody reads
linearly. Discovering later that a record has been asserting an unsourced limb for a year costs a sweep of
every sibling, which is what it cost here.

Where the provision genuinely is too long to carry whole, quote the operative limbs in full and mark the
cut with `...` so the elision is declared — `verify:quotes` checks each segment independently and will tell
you if a segment is not in the source. What it cannot tell you is whether the material you elided was the
material your sentence needed.

## 2. Supporting a negative

Two of the failures were negatives, and the model record makes a negative claim too — but not the same kind.
The distinction is what decides whether a quotation can carry the claim at all.

**The negative a complete quote does establish** is a statement about the provision in the span: *this
provision imposes no such condition*. It is verifiable by reading the span, because the span is the whole
provision and the condition is not in it. That is the Illinois record — "no age, no dollar cap, no
retirement-status condition" is a claim about 35 ILCS 5/203(a)(2)(F), and the record quotes 203(a)(2)(F)
end to end. This works **only** when rule 1 was followed. A minimum span cannot support it: absence from an
excerpt is not absence from the provision.

**The negative no quotation can establish** is a statement about the corpus: *nothing anywhere does this*.
"No Florida individual income tax exists" requires ruling out every chapter of the Florida code. "Texas
enacted no such tax in those years" requires ruling out every session of the Legislature. No finite set of
quotations gets there, because each quotation is evidence about the text it comes from and about nothing
else.

**A corpus-wide negative is not registrable as `settled` on a quotation.** Say that plainly rather than
hedging it, because the failure mode is a quotation that looks like support: the Florida record cited the
constitutional cap and chapter 220's imposition, both real, both exactly quoted, and neither of them
evidence about chapter 212 or chapter 199.

What to do instead is **narrow the statement to what the spans show**, which is what the Florida record now
does. It no longer asserts the absence of a Florida income tax. It asserts a ceiling above and an imposition
that stops at the corporate boundary below, names both, and says that those two together are what leave a
Florida retiree with nothing to compute. The engine behaviour it explains is identical; the claim is now the
size of the evidence. Texas 24-b took the same route — the sentence about years before 2026 was removed
outright, and the record now claims nothing about them.

If the corpus-wide negative is genuinely the thing the engine relies on, it is not a `settled` record resting
on quotations. It is either a narrower `settled` record about the provisions you can quote, or a record whose
classification says what it actually is.

## 3. Dates and adoption facts belong inside a quoted span

An adoption date, an effective date, an enactment reference or a repeal note is an operative claim whenever a
record's `effectiveFrom` or its statement depends on it. It has to come from inside a `quotedText`, not from
the page around it.

Both Texas records failed here, and the way they failed is why this rule is stated separately rather than
folded into rule 1. Each date was on the page — in a history note (`(Added Nov. 5, 2019.)` for section 24-a,
`(Added Nov. 4, 2025.)` for 24-b) that the publisher sets below the section text. Neither was in a
`quotedText`, neither was in a `citation`, and the two records share a `url`, so there was no field on either
record where a mechanical scan could have found the date and nothing for a checker to compare against. Both
now extend their span to carry their own "(Added …)" note, which puts the date under the same fidelity check
as everything else on the record.

The general form: **if a fact is doing work in the statement, it is on the record or it is not claimed.**
Page furniture — history notes, breadcrumbs, sidebars, "current through" banners — is not on the record
until you quote it.

## 4. The self-check before proposing a record

Walk the `statement` sentence by sentence. For each operative claim in it, name the span that establishes it
— out loud, or in the PR body, or in a scratch file; the point is that naming it is a different act from
believing it.

An operative claim is anything a reader could be wrong about: a threshold, a rate, a date, a scope, a
condition, an absence, a "therefore". Prose that describes what the engine does with the rule is not an
operative claim about the law and does not need a span, but it does need to follow from the ones that do.

Three outcomes, and only the first is done:

- **A span establishes it.** Move to the next claim.
- **A span nearly establishes it** — the right provision, quoted too narrowly, or the right statute with the
  operative subdivision missing from the array. **Widen the quote, or add and quote the subdivision.** Most
  of #201's eight were fixed this way, without the statement changing at all.
- **No span establishes it.** This is a defect, not a judgement call. **Narrow the statement** to what the
  spans do show, or add and quote the authority that supports it. If neither is possible, the claim is a
  corpus-wide negative or an inference, and section 2 applies.

Do this before proposing the record, not after review asks. Six rounds on #201 established that review finds
one of these at a time, and each one is worth a sweep of the siblings — the sweep is where seven of the eight
came from.

## 5. There is no checker for this, and there is unlikely to be one

One of #201's finding classes turned out to be mechanically checkable, and exactly one guard came out of it:
`taxRuleRegistry.conformance.test.ts` now requires a `state:` record's `implementedBy` to name at least one
path under `packages/engine/src/params/state/`, because `tax/stateTax.ts` is generic and a state record
pointing only there claims the engine implements a state-specific rule in code that cannot tell one state
from another. Even that guard states its own limit in the comment above it: it cannot see a trail that names
*some* file under the directory and omits another that matters. The `effectiveFrom` finding — a record dated
2020 while the provision it cited was adopted in 2025 — was fixed by splitting the Texas record in two, one
per constitutional section, and **no guard was added for it**.

Sufficiency is further out of reach than either of those. "Does this sentence follow from these spans" is a
reading task. A test can assert that `quotedText` is non-empty, that the host is a primary publisher, that a cited
subdivision string appears somewhere in the array — and every one of the eight defects passed checks of
exactly that kind, because in every case the quotes were real, exact, and from the right publisher. The gap
was between the quotes and the sentence, and nothing in the repository can read a sentence.

So this document is a convention for a reader, and its enforcement is a reviewer who follows section 4.
Do not read the existence of a conformance suite, a fidelity checker and this page as coverage. Together
they still leave the registry's central claim — that the quote is the reason — resting on someone having
checked.

## Related

- [quote-fidelity.md](quote-fidelity.md) — `npm run verify:quotes`, the other half: whether the quote matches
  the source.
- [../domain/state-tax-research/TEMPLATE.md](../domain/state-tax-research/TEMPLATE.md) — the sourcing rules
  for the research a state record is built from. An aggregator is admissible for finding a figure and never
  as the authority a record cites.
- [../maintenance-schedule.md](../maintenance-schedule.md) — the annual re-verification pass. Section 4 is
  worth re-running on any record whose authorities move.
