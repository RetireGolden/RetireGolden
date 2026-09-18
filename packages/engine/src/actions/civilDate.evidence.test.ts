import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { addCalendarMonths, formatCivilDate, parseCivilIsoDate } from './civilDate.js'

describeCalculation('civil-date-parse-format-and-month-shift', {
  example: {
    inputs: { date: '2024-01-31', months: 1 },
    expected: { parsed: { year: 2024, month: 1, day: 31 }, shifted: '2024-02-29' },
    tolerance: 'exact',
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/civil-date-parse-format-and-month-shift.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/civil-date-parse-format-and-month-shift.mutation.md',
}, ({ example }) => {
  it('parses January 31 and clamps one calendar month to leap-day February 29', () => {
    const parsed = parseCivilIsoDate(example.inputs.date as string)!
    const expected = example.expected.parsed as typeof parsed
    expect(parsed.year).toBe(expected.year)
    expect(parsed.month).toBe(expected.month)
    expect(parsed.day).toBe(expected.day)
    expect(formatCivilDate(parsed)).toBe(example.inputs.date)
    expect(addCalendarMonths(example.inputs.date as string, example.inputs.months as number)).toBe(example.expected.shifted)
  })
})
