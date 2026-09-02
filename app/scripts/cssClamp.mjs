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

/** The sheet with every comment removed, so no brace inside one is mistaken for structure. */
function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Bodies of every style rule whose selector list includes `selector`,
 * however the sheet is formatted: a minifier may merge the rule into a
 * selector list, strip spaces around combinators, split its declarations
 * across two rules, or nest it under an at-rule, and none of that changes
 * the answer here. Comments are removed first; at-rule preludes open a
 * nested scope; a style rule's body runs to its closing brace.
 */
export function ruleBodies(css, selector) {
  const src = withoutComments(css)
  const want = normalizeSelector(selector)
  const bodies = []
  let prelude = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '{') {
      const head = prelude.trim()
      prelude = ''
      if (head.startsWith('@')) {
        i++
        continue
      }
      const close = src.indexOf('}', i)
      const body = src.slice(i + 1, close < 0 ? src.length : close)
      if (head.split(',').map(normalizeSelector).includes(want)) bodies.push(body)
      i = close < 0 ? src.length : close + 1
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

/** The message for a sheet with no rule for the selector at all. */
export const NO_RULE = `no ${CLAMP_SELECTOR} rule in the built stylesheet`

/**
 * Problems with the clamp in `css`, empty when every required declaration is
 * present across the rules for the clamp selector (a minifier may split
 * them; what matters is what the cascade ends up with). A sheet with no rule
 * at all reports NO_RULE, which the CLI uses to tell it from a sheet that
 * has the rule but has it wrong.
 */
export function clampProblems(css) {
  const bodies = ruleBodies(css, CLAMP_SELECTOR)
  if (bodies.length === 0) return [NO_RULE]
  const union = bodies.join(';')
  return REQUIRED.filter(([re]) => !re.test(union)).map(([, name]) => `${CLAMP_SELECTOR} lost ${name}`)
}

/** Whether a problem list means the sheet has no clamp rule at all (as opposed to an incomplete one). */
export function lacksRule(problems) {
  return problems.length === 1 && problems[0] === NO_RULE
}
