import { describe, expect, it } from 'vitest'

import { socialSecurityDobParts } from './annualTiming.js'

describe('annual Social Security timing primitives', () => {
  it('parses the validated ISO civil date without timezone conversion', () => {
    expect(socialSecurityDobParts({ dob: '1964-07-09' })).toEqual({
      y: 1964,
      m: 7,
      d: 9,
    })
  })
})
