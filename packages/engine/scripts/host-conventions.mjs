/**
 * Per-host rendering conventions for the quote-fidelity verifier.
 *
 * Its own module for one reason: `src/rules/quoteFidelityDocs.test.ts` holds the
 * table in DOCS/operations/quote-fidelity.md to this one, and a test cannot
 * import `verify-quotes.mjs` — that file is a program. It carries a `#!` line
 * (which Vitest's `vm.Script` evaluation does not strip, unlike Node's ESM
 * loader) and it runs a hundred-request verification pass on import. Guarding
 * its entry point would work, and would introduce a worse failure than the one
 * it solved: a guard that stops matching turns `npm run verify:quotes` into a
 * silent no-op. A constant that both files import has no such edge.
 *
 * What each publisher actually emits for the characters that quotes trip over.
 * Measured across every page this registry cites (95 documents), not assumed.
 *
 * The `apostrophe` column is the only one the script asserts on, because it is
 * the only one that is unambiguous per host and mechanically fixable: a quote
 * carrying U+2019 against a host that renders U+0027 was copied from somewhere
 * other than the page it cites. The other columns are here because a future fix
 * needs them in order not to guess — they are the reason each ladder rung
 * exists, and they are reproduced in DOCS/operations/quote-fidelity.md, which
 * the test keeps honest.
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
export const HOST_CONVENTIONS = Object.freeze({
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
