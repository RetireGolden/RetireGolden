/**
 * The plain-text rule for every record field the public methodology site
 * renders.
 *
 * A member of the public reads these fields, so they must read as plain
 * words: no dashes used as punctuation, and none of the internal test and
 * tooling vocabulary a reader cannot be expected to know.
 *
 * For a tax rule, the site's rule page (retiregolden.org
 * `src/pages/methodology/tax-rules.astro`) renders the `title`, the
 * `conventionRationale`, and each authority's `citation` and `url`.
 * `publicText.conformance.test.ts` holds exactly these fields to this list:
 *
 * - a tax rule's `title`, `conventionRationale`, `contraryReading` (skipped
 *   when null; five rules carry one today) and each authority's
 *   `citation` (a `url` is an address, not text);
 * - an approximated rule's entry in `APPROXIMATION_KINDS`: `missingInput`
 *   for a needs-fact entry, `reason` for a convention entry (a fix entry
 *   publishes no text of its own);
 * - a calculation record's `title`, `purpose`, `statement`, every `limits`
 *   entry, its formula's `expression`, `timing` and `rounding` and each
 *   variable's `symbol`, `meaning`, `unit` and `domain`, and its dataset
 *   source's `citation`, `asOf` and `retrievedOn` or its assumption's
 *   `rationale`, `intendedUse` and `errorBound`.
 *
 * Not covered: an authority's `quotedText`, which is the source's own words;
 * a tax rule's `statement`, which stays in the registry (the rule ledger
 * does not publish it); and the rule ledger's evidence entries (each test
 * file's `note` and the titles of its tests, the tests that name the
 * candidate `readings`), which the ledger JSON publishes but the site does
 * not render. A field that starts being rendered joins the list in the
 * conformance suite.
 *
 * A formula's expression and a variable's symbol are code-like: they keep
 * identifiers and arithmetic, so only the dash bans that cannot be
 * arithmetic apply to them.
 */

/** One banned form: what a violation says, whether code-like fields are held to it, and the test. */
export interface PublicTextBan {
  readonly label: string
  readonly inCode: boolean
  readonly test: (text: string) => boolean
}

function pattern(label: string, regex: RegExp, inCode = false): PublicTextBan {
  return Object.freeze({ label, inCode, test: (text: string) => regex.test(text) })
}

/** A token that can stand beside a minus sign: a number, a one-letter symbol, an identifier or a bracketed term. */
function isOperand(token: string, next: string): boolean {
  const bare = token.replace(/^[`"']+|[`"'.,;:]+$/gu, '')
  if (bare === '') return false
  if (/^[$€£]?[−-]?\d[\d,.]*%?$/u.test(bare)) return true
  // "a" before a word is the article ("by 2100 - a one-step stand-in"), not a symbol.
  if (/^[A-Za-z]$/u.test(bare)) return !(bare === 'a' && /^[A-Za-z]/u.test(next))
  if (/^[([{|]|[)\]}|]$/u.test(bare)) return true
  return /[a-z][A-Z]|_|\w\.\w|\w\(/u.test(bare)
}

const CLAUSE_BREAK = /[.;:,]\s/gu
// The middle dot is not an arithmetic sign here: the planner uses it as a
// separator in prose ("Pat · Wages"), so a clause holding one can still carry
// a dash. A product written with it, such as "100·G/E", has another sign.
const ARITHMETIC_SIGN = /[=+*/^<>×≤≥−]/u

/**
 * Whether `text` uses a spaced hyphen (" - ") as a dash. The records also
 * write subtraction that way, so a spaced hyphen counts as a dash only when
 * nothing marks it as arithmetic: it is not inside brackets, absolute-value
 * bars or a backtick code span; its clause (the text between the nearest
 * ". ", "; ", ": " or ", " on either side) carries no arithmetic sign; and its
 * two neighbours are not both operands, so a range such as "ages 62 - 70" and
 * a difference such as "1 - guardrailFactor" pass. Subtraction written between
 * two plain words with nothing else around it ("income - deduction") still
 * reads as a dash and fails; write "minus" or state the formula.
 */
export function usesSpacedHyphenAsDash(text: string): boolean {
  for (const match of text.matchAll(/ - /gu)) {
    const at = match.index
    const before = text.slice(0, at)
    let depth = 0
    for (const character of before) {
      if (character === '(' || character === '[' || character === '{') depth += 1
      else if (character === ')' || character === ']' || character === '}') depth -= 1
    }
    const inBars = (before.match(/\|/gu)?.length ?? 0) % 2 === 1
    const inCode = (before.match(/`/gu)?.length ?? 0) % 2 === 1
    if (depth > 0 || inBars || inCode) continue
    const clauseStart = Math.max(0, ...[...before.matchAll(CLAUSE_BREAK)].map((m) => m.index + m[0].length))
    const after = text.slice(at + 3)
    const clauseEnd = after.search(CLAUSE_BREAK)
    const clause = before.slice(clauseStart) + ' ' + (clauseEnd < 0 ? after : after.slice(0, clauseEnd))
    if (ARITHMETIC_SIGN.test(clause)) continue
    const left = before.slice(before.lastIndexOf(' ') + 1)
    const [right = '', next = ''] = after.split(' ')
    if (isOperand(left, '') && isOperand(right, next)) continue
    return true
  }
  return false
}

/**
 * Every banned form, in the order a violation lists them. Whole words in any
 * case unless noted: "exact ledger" is matched as a phrase so "ledger" alone
 * stays usable, "registry slice" as a phrase so a Roth taxable slice stays
 * usable, and DEFECT only in capitals so "a known defect" stays usable.
 */
export const PUBLIC_TEXT_BANS: readonly PublicTextBan[] = Object.freeze([
  pattern('an em dash', /—/u, true),
  pattern('a spaced en dash', / – /u, true),
  pattern('a double hyphen used as a dash', /(?:^|\s)--(?:\s|$)/u, true),
  Object.freeze({ label: 'a spaced hyphen as a dash', inCode: false, test: usesSpacedHyphenAsDash }),
  pattern('"fixture"', /\bfixtures?\b/iu),
  pattern('"golden"', /\bgolden\b/iu),
  pattern('"regression"', /\bregressions?\b/iu),
  pattern('"harness"', /\bharness(?:es)?\b/iu),
  pattern('"exact ledger"', /\bexact[\s-]+ledger\b/iu),
  pattern('"pack"', /\bpacks?\b/iu),
  pattern('"vintage"', /\bvintages?\b/iu),
  pattern('"registry slice"', /\b(?:registry|registration) slices?\b/iu),
  pattern('"DEFECT"', /\bDEFECT\b/u),
  pattern('"fail closed"', /\bfail(?:s|ed|ing)?[\s-]closed\b/iu),
  pattern('"scenario patch"', /\b(?:scenario|candidate)[\s-]+patch(?:es)?\b/iu),
  pattern('"detector"', /\bdetectors?\b/iu),
  pattern('"no-op"', /\bno-ops?\b/iu),
  pattern('"MAGI cascade"', /\bMAGI cascade\b/iu),
  pattern('"feature-off"', /\bfeature-off\b/iu),
  pattern('"Web Worker"', /\bweb[\s-]?workers?\b/iu),
])

/**
 * Every public-text problem in one string, empty when it reads as plain
 * words. `code` marks a code-like field (a formula expression or a variable
 * symbol), which is held only to the dash bans that cannot be arithmetic.
 */
export function publicTextProblems(text: string, options: { readonly code?: boolean } = {}): readonly string[] {
  return PUBLIC_TEXT_BANS.filter((ban) => !options.code || ban.inCode)
    .filter((ban) => ban.test(text))
    .map((ban) => 'uses ' + ban.label)
}
