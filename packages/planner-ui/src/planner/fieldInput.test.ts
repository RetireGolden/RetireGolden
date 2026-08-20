import { describe, expect, it } from 'vitest'

import { capIsoDateYear, editingMoneyText, nextMoneyFieldText } from './fieldInput'

describe('nextMoneyFieldText', () => {
  it('keeps ordinary typing as the target value', () => {
    expect(nextMoneyFieldText({ targetValue: '450', inputType: 'insertText', data: '0' })).toBe('450')
    expect(nextMoneyFieldText({ targetValue: '45', inputType: 'deleteContentBackward', data: null })).toBe('45')
  })

  it('treats Chromium insertReplacementText as a replace, not an append', () => {
    // Hosted walk: typing 450 into a field that already displayed 450 became 450450.
    expect(
      nextMoneyFieldText({
        targetValue: '450450',
        inputType: 'insertReplacementText',
        data: '450',
      }),
    ).toBe('450')
    expect(
      nextMoneyFieldText({
        targetValue: '25002500',
        inputType: 'insertReplacementText',
        data: '2500',
      }),
    ).toBe('2500')
  })

  it('treats insertFromAutocomplete the same way', () => {
    expect(
      nextMoneyFieldText({
        targetValue: '450450',
        inputType: 'insertFromAutocomplete',
        data: '450',
      }),
    ).toBe('450')
  })
})

describe('editingMoneyText', () => {
  it('opens an empty field for zero or null so typing replaces', () => {
    expect(editingMoneyText(0)).toBe('')
    expect(editingMoneyText(null)).toBe('')
  })

  it('shows the raw number for a non-zero value', () => {
    expect(editingMoneyText(450)).toBe('450')
    expect(editingMoneyText(2500)).toBe('2500')
  })
})

describe('capIsoDateYear', () => {
  it('leaves a normal 4-digit year alone', () => {
    expect(capIsoDateYear('1983-04-12')).toBe('1983-04-12')
    expect(capIsoDateYear('1970-01-01')).toBe('1970-01-01')
  })

  it('keeps the last four digits when the year segment overflowed', () => {
    // Hosted walk: typed 1983-04-12, year segment showed 121983 until corrected.
    expect(capIsoDateYear('121983-04-12')).toBe('1983-04-12')
  })
})
