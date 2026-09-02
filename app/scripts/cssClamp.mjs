/**
 * The plan-card name clamp (#533) needs `display: -webkit-box` together with
 * `-webkit-box-orient: vertical` in the stylesheet that ships; a minifier can
 * drop the pair as obsolete. This checks the built sheet itself — whatever
 * transformer, minifier, and target set the Vite config resolves to — so it
 * assumes nothing about the pipeline. Pure functions; the CLI is
 * ./check-css-clamp.mjs and the fixture tests are ./cssClamp.test.mjs.
 */

/** The rules the clamp needs, as they appear minified or not. */
export const CLAMP_SELECTOR = '.plan-card-name'
const REQUIRED = [
  [/display\s*:\s*-webkit-box\b/, 'display: -webkit-box'],
  [/-webkit-box-orient\s*:\s*vertical\b/, '-webkit-box-orient: vertical'],
  [/-webkit-line-clamp\s*:\s*2\b/, '-webkit-line-clamp: 2'],
  [/\boverflow\s*:\s*hidden\b/, 'overflow: hidden'],
]

/** Bodies of every rule whose selector list is exactly `selector`. */
export function ruleBodies(css, selector) {
  const bodies = []
  let from = 0
  for (;;) {
    const at = css.indexOf(selector, from)
    if (at < 0) break
    from = at + selector.length
    let open = from
    while (open < css.length && /\s/.test(css[open])) open++
    if (css[open] !== '{') continue
    let before = at - 1
    while (before >= 0 && /\s/.test(css[before])) before--
    if (!(before < 0 || css[before] === '}' || css.slice(before - 1, before + 1) === '*/')) continue
    const close = css.indexOf('}', open)
    bodies.push(css.slice(open + 1, close < 0 ? css.length : close))
  }
  return bodies
}

/**
 * Problems with the clamp in `css`, empty when every required declaration is
 * present in some `.plan-card-name` rule that carries the line clamp.
 */
export function clampProblems(css) {
  const bodies = ruleBodies(css, CLAMP_SELECTOR)
  if (bodies.length === 0) return [`no ${CLAMP_SELECTOR} rule in the built stylesheet`]
  const clamp = bodies.find((b) => REQUIRED[2][0].test(b))
  if (clamp === undefined) return [`no ${CLAMP_SELECTOR} rule carries -webkit-line-clamp: 2`]
  return REQUIRED.filter(([re]) => !re.test(clamp)).map(([, name]) => `${CLAMP_SELECTOR} lost ${name}`)
}
