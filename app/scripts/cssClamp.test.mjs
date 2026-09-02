import { describe, expect, it } from 'vitest'

import { clampProblems, ruleBodies } from './cssClamp.mjs'

const GOOD = '.a{color:red}.plan-card-name{font-size:1.05rem}.plan-card-name{-webkit-line-clamp:2;line-clamp:2;overflow-wrap:anywhere;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}'

describe('cssClamp', () => {
  it('accepts a minified sheet that keeps the whole clamp', () => {
    expect(clampProblems(GOOD)).toEqual([])
  })

  it('accepts the unminified source form too', () => {
    const source = '.plan-card-name {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n  line-clamp: 2;\n  overflow: hidden;\n  overflow-wrap: anywhere;\n}'
    expect(clampProblems(source)).toEqual([])
  })

  it('names the declaration a minifier dropped', () => {
    expect(clampProblems(GOOD.replace('-webkit-box-orient:vertical;', ''))).toEqual(['.plan-card-name lost -webkit-box-orient: vertical'])
    expect(clampProblems(GOOD.replace('display:-webkit-box;', ''))).toEqual(['.plan-card-name lost display: -webkit-box'])
    expect(clampProblems(GOOD.replace('overflow-wrap:anywhere;', ''))).toEqual(['.plan-card-name lost overflow-wrap: anywhere'])
  })

  it('fails closed when the rule or the clamp is missing', () => {
    expect(clampProblems('.a{color:red}')).toEqual(['no .plan-card-name rule in the built stylesheet'])
    expect(clampProblems('.plan-card-name{font-size:1rem}')).toEqual(['no .plan-card-name rule carries -webkit-line-clamp: 2'])
  })

  it('matches the exact selector, not a compound one', () => {
    expect(ruleBodies('.plan-grid h2.plan-card-name{margin:0}.plan-card-name{x:y}', '.plan-card-name')).toEqual(['x:y'])
  })
})
