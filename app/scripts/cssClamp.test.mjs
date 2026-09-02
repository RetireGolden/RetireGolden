import { describe, expect, it } from 'vitest'

import { CLAMP_SELECTOR, clampProblems, lacksRule, normalizeSelector, ruleBodies } from './cssClamp.mjs'

const CLAMP = '-webkit-line-clamp:2;line-clamp:2;min-width:0;overflow-wrap:anywhere;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden'
const GOOD = `.a{color:red}.plan-card-name{font-size:1.05rem}.plan-card-open>.plan-card-name{${CLAMP}}`

describe('cssClamp', () => {
  it('accepts a minified sheet that keeps the whole clamp', () => {
    expect(clampProblems(GOOD)).toEqual([])
  })

  it('accepts the unminified source form too', () => {
    const source = '.plan-card-open > .plan-card-name {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n  line-clamp: 2;\n  min-width: 0;\n  overflow: hidden;\n  overflow-wrap: anywhere;\n}'
    expect(clampProblems(source)).toEqual([])
  })

  it('finds the rule inside a merged selector list and under an at-rule', () => {
    expect(clampProblems(`.x,.plan-card-open>.plan-card-name,.y{${CLAMP}}`)).toEqual([])
    expect(clampProblems(`@media (min-width:1px){.plan-card-open>.plan-card-name{${CLAMP}}}`)).toEqual([])
    expect(clampProblems(`@supports (display:grid){.z{a:b}.plan-card-open > .plan-card-name{${CLAMP}}}`)).toEqual([])
  })

  it('names the declaration a minifier dropped', () => {
    expect(clampProblems(GOOD.replace('-webkit-box-orient:vertical;', ''))).toEqual([`${CLAMP_SELECTOR} lost -webkit-box-orient: vertical`])
    expect(clampProblems(GOOD.replace('display:-webkit-box;', ''))).toEqual([`${CLAMP_SELECTOR} lost display: -webkit-box`])
    expect(clampProblems(GOOD.replace('overflow-wrap:anywhere;', ''))).toEqual([`${CLAMP_SELECTOR} lost overflow-wrap: anywhere`])
  })

  it('fails closed when the rule or the clamp is missing, and says which', () => {
    const none = clampProblems('.a{color:red}.plan-card-name{font-size:1rem}')
    expect(none).toEqual([`no ${CLAMP_SELECTOR} rule in the built stylesheet`])
    expect(lacksRule(none)).toBe(true)
    const noClamp = clampProblems('.plan-card-open>.plan-card-name{font-size:1rem}')
    expect(noClamp).toEqual([`no ${CLAMP_SELECTOR} rule carries -webkit-line-clamp: 2`])
    expect(lacksRule(noClamp)).toBe(true)
    expect(lacksRule([`${CLAMP_SELECTOR} lost overflow: hidden`])).toBe(false)
  })

  it('matches the exact selector, not a compound or bare one', () => {
    const css = '.plan-grid h2.plan-card-name{margin:0}.plan-card-name{font-weight:650}.plan-card-open>.plan-card-name{x:y}'
    expect(ruleBodies(css, CLAMP_SELECTOR)).toEqual(['x:y'])
    expect(normalizeSelector('.plan-card-open  >  .plan-card-name')).toBe('.plan-card-open>.plan-card-name')
  })

  it('skips comments that contain braces', () => {
    expect(clampProblems(`/* not a rule { } */.plan-card-open>.plan-card-name{${CLAMP}}`)).toEqual([])
  })
})
