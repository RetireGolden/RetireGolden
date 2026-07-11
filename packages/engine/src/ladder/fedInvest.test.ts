import { describe, expect, it } from 'vitest'

import { latestPriceDate, nearestTipsForYear, parseFedInvestCsv } from './fedInvest.js'

// Real FedInvest securityprice.csv shape (verified 2026-07-08): no header,
// rate as a decimal fraction, maturity MM/DD/YYYY, prices per $100 face.
const sampleCsv = [
  '912797UN5,MARKET BASED BILL,0.0,07/07/2026,,0.000000,99.990083,100.000000',
  '912828S50,TIPS,0.00125,07/15/2026,,0.000000,100.031250,100.062500',
  '912828V49,TIPS,0.00375,01/15/2027,,98.687500,98.656250,98.687500',
  '912810TE8,TIPS,0.00125,02/15/2052,,62.200000,62.000000,62.100000',
  '912810QV3,TIPS,0.00750,02/15/2042,,bad,,not-a-number',
  'garbage line',
].join('\n')

describe('parseFedInvestCsv', () => {
  it('extracts only well-formed TIPS rows, sorted by maturity, rates in percent', () => {
    const tips = parseFedInvestCsv(sampleCsv)
    expect(tips).toHaveLength(3)
    expect(tips[0]).toEqual({ cusip: '912828S50', ratePct: 0.125, maturityIso: '2026-07-15', endOfDayPrice: 100.0625 })
    expect(tips[1]!.cusip).toBe('912828V49')
    expect(tips[1]!.ratePct).toBeCloseTo(0.375, 9)
    expect(tips[2]!.cusip).toBe('912810TE8')
  })

  it('returns an empty list for non-CSV content', () => {
    expect(parseFedInvestCsv('<html><body>maintenance</body></html>')).toEqual([])
  })
})

describe('latestPriceDate', () => {
  it('steps back to the most recent business day', () => {
    // Monday → previous Friday (yesterday = Sunday, then back past Saturday).
    const monday = new Date('2026-07-06T12:00:00')
    expect(latestPriceDate(monday).getDay()).toBe(5)
    // Wednesday → Tuesday.
    const wednesday = new Date('2026-07-08T12:00:00')
    expect(latestPriceDate(wednesday).getDay()).toBe(2)
  })
})

describe('nearestTipsForYear', () => {
  const tips = parseFedInvestCsv(sampleCsv)
  it('matches a rung year to the closest maturity within a year', () => {
    expect(nearestTipsForYear(tips, 2027)!.cusip).toBe('912828V49')
    expect(nearestTipsForYear(tips, 2051)!.cusip).toBe('912810TE8')
  })
  it('returns null when nothing matures near the year', () => {
    expect(nearestTipsForYear(tips, 2035)).toBeNull()
  })
})
