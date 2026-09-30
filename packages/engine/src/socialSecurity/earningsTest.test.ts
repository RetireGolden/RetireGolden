import { describe, expect, it } from 'vitest'

import { earningsTestYear, excessEarnings, type EarningsTestMonthlyDue } from './earningsTest.js'

const limits = { belowFraExemptAnnual: 24_480, fraYearExemptAnnual: 65_160 }
/** A person born 1964-03-10 reaches full retirement age (67) in March 2031. */
const march2031 = 2031 * 12 + 2

describe('excessEarnings (42 U.S.C. 403(f)(3), (f)(1)(B))', () => {
  it('is half the wages above the lower exempt amount before the full-retirement-age year, reduced to the next lower dollar', () => {
    expect(excessEarnings({ wages: 40_000, fraMonthIndex: march2031, year: 2026, ...limits })).toBe(7_760)
    // 40,001: (40,001 − 24,480) / 2 = 7,760.50, reduced to 7,760.
    expect(excessEarnings({ wages: 40_001, fraMonthIndex: march2031, year: 2026, ...limits })).toBe(7_760)
    expect(excessEarnings({ wages: 20_000, fraMonthIndex: march2031, year: 2026, ...limits })).toBe(0)
    expect(excessEarnings({ wages: 0, fraMonthIndex: march2031, year: 2026, ...limits })).toBe(0)
  })

  it('counts only the months before the full-retirement-age month in its year, a third above the higher exempt amount', () => {
    // FRA month July 2027: six months before it, 150,000 × 6/12 = 75,000; (75,000 − 65,160) / 3 = 3,280.
    const july2027 = 2027 * 12 + 6
    expect(excessEarnings({ wages: 150_000, fraMonthIndex: july2027, year: 2027, ...limits })).toBe(3_280)
    // 100,000 × 6/12 = 50,000 is below 65,160: nothing, where the whole year's wages would withhold 11,613.33.
    expect(excessEarnings({ wages: 100_000, fraMonthIndex: july2027, year: 2027, ...limits })).toBe(0)
    // An FRA month in January leaves no month before it.
    expect(excessEarnings({ wages: 500_000, fraMonthIndex: 2027 * 12, year: 2027, ...limits })).toBe(0)
    expect(excessEarnings({ wages: 500_000, fraMonthIndex: july2027, year: 2028, ...limits })).toBe(0)
  })
})

describe('earningsTestYear (403(b)(1), (f)(1); 20 CFR 404.434, 404.439, 404.440)', () => {
  const due = (own: number, auxiliary = 0, auxiliaryWorkerId: string | null = null): EarningsTestMonthlyDue => ({
    own,
    auxiliary,
    auxiliaryWorkerId,
    ownEntitled: true,
    auxiliaryEntitled: true,
    ownInReductionPeriod: true,
    auxiliaryInReductionPeriod: auxiliary > 0,
  })

  it('charges one person\'s excess month by month from January, a partial month counting as a crediting month', () => {
    const credits: string[] = []
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'p', excess: 7_760, fraMonthIndex: march2031 }],
      workerId: null,
      due: () => new Map([['p', due(1_400)]]),
      credit: (month, personId, benefit) => credits.push(`${month}:${personId}:${benefit}`),
    })
    // January-May 7,000; June 760 of 1,400, so June pays 640.
    expect(result.paidByMonth.get('p')).toEqual([0, 0, 0, 0, 0, 640, 1_400, 1_400, 1_400, 1_400, 1_400, 1_400])
    expect(result.withheldByPerson.get('p')).toBe(7_760)
    expect(credits).toEqual(['0:p:own', '1:p:own', '2:p:own', '3:p:own', '4:p:own', '5:p:own'])
  })

  it('does not charge a month before the benefit\'s first month of entitlement, which the claim-year convention pays (403(f)(1)(A))', () => {
    const credits: number[] = []
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'p', excess: 7_760, fraMonthIndex: march2031 }],
      workerId: null,
      // Entitled from March: January and February are paid under the claim-year convention.
      due: (month) => new Map([['p', { ...due(1_400), ownEntitled: month >= 2, ownInReductionPeriod: month >= 2 }]]),
      credit: (month) => credits.push(month),
    })
    // March-July 7,000; August 760 of 1,400, so August pays 640.
    expect(result.paidByMonth.get('p')).toEqual([1_400, 1_400, 0, 0, 0, 0, 0, 640, 1_400, 1_400, 1_400, 1_400])
    expect(credits).toEqual([2, 3, 4, 5, 6, 7])
  })

  it('credits no month outside the benefit\'s reduction period', () => {
    const credits: number[] = []
    earningsTestYear({
      year: 2026,
      people: [{ id: 'p', excess: 17_760, fraMonthIndex: 2027 * 12 }],
      workerId: null,
      // A widow(er) benefit whose reduction period ends at the survivor full-retirement-age month, September.
      due: (month) => new Map([['p', { ...due(0, 1_601), auxiliaryInReductionPeriod: month < 8 }]]),
      credit: (month) => credits.push(month),
    })
    expect(credits).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('charges the worker first against the family benefit on his record and shares a partial month two to one (worksheet E5)', () => {
    const credits: string[] = []
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'W', excess: 17_760, fraMonthIndex: 2031 * 12 }, { id: 'S', excess: 0, fraMonthIndex: 2031 * 12 }],
      workerId: 'W',
      due: () => new Map([['W', due(1_400)], ['S', due(280, 390, 'W')]]),
      credit: (month, personId, benefit) => credits.push(`${month}:${personId}:${benefit}`),
    })
    // 1,790 a month on W's record: January-September 16,110; October 1,650, leaving 140 shared 93.33 : 46.67.
    const w = result.paidByMonth.get('W')!
    const s = result.paidByMonth.get('S')!
    expect(w.slice(0, 9)).toEqual(new Array(9).fill(0))
    expect(w[9]).toBeCloseTo(280 / 3, 10)
    expect(s[9]).toBeCloseTo(280 + 140 / 3, 10)
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(2_893.333333, 5)
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(4_186.666667, 5)
    // W's own benefit and S's spouse benefit are credited January-October; S's own benefit, on her record, is not.
    expect(credits.filter((c) => c.endsWith('W:own'))).toHaveLength(10)
    expect(credits.filter((c) => c.endsWith('S:auxiliary'))).toHaveLength(10)
    expect(credits.filter((c) => c.endsWith('S:own'))).toHaveLength(0)
  })

  it('caps a share at what the person is due and gives the rest to the other (20 CFR 404.440)', () => {
    // 60 left of a 1,400 + 30 family month: 2:1 would give her 20 of a 30 spouse benefit, within it;
    // with a 10 spouse benefit, 2:1 gives her 23.33, so she is paid her 10 and he the other 50.
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'W', excess: 1_410 - 60, fraMonthIndex: 2031 * 12 }],
      workerId: 'W',
      due: (month) => new Map(month === 0 ? [['W', due(1_400)], ['S', due(0, 10, 'W')]] : []),
      credit: () => {},
    })
    expect(result.paidByMonth.get('S')![0]).toBeCloseTo(10, 10)
    expect(result.paidByMonth.get('W')![0]).toBeCloseTo(50, 10)
  })

  it('charges her own excess against her own old-age benefit in months the worker\'s excess took her whole spouse benefit (E7b; POMS RS 02501.150 A.1)', () => {
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'W', excess: 17_760, fraMonthIndex: 2031 * 12 }, { id: 'S', excess: 5_760, fraMonthIndex: 2031 * 12 }],
      workerId: 'W',
      due: () => new Map([['W', due(1_400)], ['S', due(280, 390, 'W')]]),
      credit: () => {},
    })
    expect(result.paidByMonth.get('S')!.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9)
    expect(result.excessChargedByPerson.get('S')).toBeCloseTo(280 * 12 + 140 / 3 + 390 * 2, 9)
  })

  it('does not charge a month from the full-retirement-age month on, and lets the excess lapse at December', () => {
    const result = earningsTestYear({
      year: 2027,
      people: [{ id: 'p', excess: 50_000, fraMonthIndex: 2027 * 12 + 6 }],
      workerId: null,
      due: () => new Map([['p', due(1_400)]]),
      credit: () => {},
    })
    expect(result.paidByMonth.get('p')).toEqual([0, 0, 0, 0, 0, 0, 1_400, 1_400, 1_400, 1_400, 1_400, 1_400])
    expect(result.excessChargedByPerson.get('p')).toBe(8_400)
  })

  it('charges a partial month of a person paid on two records to both, so each benefit has a crediting month (PR #769 review issue 1; RS 02501.145 B.2, RS 00615.482 B.3 note)', () => {
    // Her own 280 and 390 on W's record, $100 of her excess in January, none of
    // his: 100 x 390/670 = 58.21 falls on the spouse benefit and 41.79 on her
    // own, so both are credited. Charging the spouse benefit first would credit
    // only it, and her own benefit first only her own.
    const credits: string[] = []
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'W', excess: 0, fraMonthIndex: 2031 * 12 }, { id: 'S', excess: 100, fraMonthIndex: 2031 * 12 }],
      workerId: 'W',
      due: () => new Map([['W', due(1_400)], ['S', due(280, 390, 'W')]]),
      credit: (month, personId, benefit) => credits.push(`${month}:${personId}:${benefit}`),
    })
    expect(result.paidByMonth.get('S')![0]).toBeCloseTo(570, 9)
    expect(credits).toEqual(['0:S:own', '0:S:auxiliary'])
  })

  it('charges the worker\'s partial month to each record in proportion to what it pays him, then shares his own record two to one (POMS RS 02501.145 C)', () => {
    // RS 02501.145's example: the number holder's excess is 400; on his record
    // he is paid 132.30 and a child 66.20 (two shares to one), and he is paid
    // 66.20 as a parent on another record. January takes all 264.70. February's
    // 135.30 falls 135.30 x 66.20/264.70 = 33.84 on the other record and 101.46
    // on his own, and the 97.04 left there is shared 64.69 to him and 32.35 to
    // the child. (The POMS rounds the apportioned part down to 33.80, which the
    // engine does not: its figures are 101.50, 64.70 and 32.40.)
    const credits: string[] = []
    const result = earningsTestYear({
      year: 2026,
      people: [{ id: 'NH', excess: 400, fraMonthIndex: 2031 * 12 }],
      workerId: 'NH',
      due: () => new Map([['NH', due(132.3, 66.2)], ['C', due(0, 66.2, 'NH')]]),
      credit: (month, personId, benefit) => credits.push(`${month}:${personId}:${benefit}`),
    })
    const february = 400 - 264.7
    const onOtherRecord = (february * 66.2) / 264.7
    const leftOnHisRecord = 198.5 - (february - onOtherRecord)
    expect(onOtherRecord).toBeCloseTo(33.838, 3)
    expect(result.paidByMonth.get('NH')![0]).toBe(0)
    expect(result.paidByMonth.get('NH')![1]).toBeCloseTo((leftOnHisRecord * 2) / 3 + 66.2 - onOtherRecord, 9)
    expect(result.paidByMonth.get('NH')![1]).toBeCloseTo(97.0541, 4)
    expect(result.paidByMonth.get('C')![1]).toBeCloseTo(32.3459, 4)
    expect(result.paidByMonth.get('NH')![2]).toBeCloseTo(198.5, 9)
    // Two to one over everything he is paid would leave the child 43.13.
    expect(result.paidByMonth.get('C')![1]).not.toBeCloseTo((264.7 - february) / 3, 2)
    expect(credits).toEqual(['0:NH:own', '0:NH:auxiliary', '0:C:auxiliary', '1:NH:own', '1:NH:auxiliary', '1:C:auxiliary'])
  })
})
