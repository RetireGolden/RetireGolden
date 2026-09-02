/**
 * The plan-card name clamp (#533) needs `display: -webkit-box` together with
 * `-webkit-box-orient: vertical` in the stylesheet that ships; a minifier can
 * drop the pair as obsolete. This checks the built sheet itself — whatever
 * transformer, minifier, and target set the Vite config resolves to — so it
 * assumes nothing about the pipeline. Pure functions; the CLI is
 * ./check-css-clamp.mjs and the fixture tests are ./cssClamp.test.mjs.
 */

/** The rule the clamp lives on: the name inside the Your-plans open button. */
export const CLAMP_SELECTOR = '.plan-card-open > .plan-card-name'
const REQUIRED = [
  [/display\s*:\s*-webkit-box\b/, 'display: -webkit-box'],
  [/-webkit-box-orient\s*:\s*vertical\b/, '-webkit-box-orient: vertical'],
  [/-webkit-line-clamp\s*:\s*2\b/, '-webkit-line-clamp: 2'],
  [/\boverflow\s*:\s*hidden\b/, 'overflow: hidden'],
  // A 182-character run with no spaces must still break inside the card.
  [/overflow-wrap\s*:\s*anywhere\b/, 'overflow-wrap: anywhere'],
]

/** A selector with combinator and comma spacing normalised, so minified and source forms compare equal. */
export function normalizeSelector(selector) {
  return selector.replace(/\s*([>+~,])\s*/g, '$1').replace(/\s+/g, ' ').trim()
}

/**
 * Bodies of every style rule whose selector list includes `selector`,
 * however the sheet is formatted: a minifier may merge the rule into a
 * selector list, strip spaces around combinators, or nest it under an
 * at-rule, and none of that changes the answer here. Comments are skipped;
 * at-rule preludes open a nested scope; a style rule's body runs to its
 * closing brace.
 */
export function ruleBodies(css, selector) {
  const want = normalizeSelector(selector)
  const bodies = []
  let prelude = ''
  let i = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      continue
    }
    if (ch === '{') {
      const head = prelude.trim()
      prelude = ''
      if (head.startsWith('@')) {
        i++
        continue
      }
      const close = css.indexOf('}', i)
      const body = css.slice(i + 1, close < 0 ? css.length : close)
      if (head.split(',').map(normalizeSelector).includes(want)) bodies.push(body)
      i = close < 0 ? css.length : close + 1
      continue
    }
    if (ch === '}') {
      prelude = ''
      i++
      continue
    }
    prelude += ch
    i++
  }
  return bodies
}

/**
 * Problems with the clamp in `css`, empty when every required declaration is
 * present in some rule for the clamp selector that carries the line clamp.
 * A missing rule is reported as one problem starting with "no ", which the
 * CLI uses to tell a sheet that lacks the rule from one that has it wrong.
 */
export function clampProblems(css) {
  const bodies = ruleBodies(css, CLAMP_SELECTOR)
  if (bodies.length === 0) return [`no ${CLAMP_SELECTOR} rule in the built stylesheet`]
  const clamp = bodies.find((b) => REQUIRED[2][0].test(b))
  if (clamp === undefined) return [`no ${CLAMP_SELECTOR} rule carries -webkit-line-clamp: 2`]
  return REQUIRED.filter(([re]) => !re.test(clamp)).map(([, name]) => `${CLAMP_SELECTOR} lost ${name}`)
}

/** Whether a problem list means the sheet has no clamp rule at all. */
export function lacksRule(problems) {
  return problems.length === 1 && problems[0].startsWith('no ')
}
