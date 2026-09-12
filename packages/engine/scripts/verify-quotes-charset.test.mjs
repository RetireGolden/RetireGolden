import { describe, expect, it } from 'vitest'

import { decodeHtmlBody, htmlVariants, verdictFor } from './verify-quotes.mjs'

/** cp1252 left/right double quotation marks (bytes 0x93 / 0x94). */
const CP1252_LDQUO = 0x93
const CP1252_RDQUO = 0x94

/**
 * Minimal HTML whose smart quotes are genuine windows-1252 bytes, mirroring
 * www.oregonlegislature.gov ORS pages (`charset=windows-1252` in `<meta>`).
 *
 * @param {string} phrase
 */
function cp1252QuotedPage(phrase) {
  const prefix = Buffer.from(
    '<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"></head><body><p>',
    'latin1',
  )
  const suffix = Buffer.from(' means any individual.</p></body></html>', 'latin1')
  const quoted = Buffer.concat([
    Buffer.from([CP1252_LDQUO]),
    Buffer.from(phrase, 'latin1'),
    Buffer.from([CP1252_RDQUO]),
  ])
  return Buffer.concat([prefix, quoted, suffix])
}

/**
 * @param {string} headExtra raw head markup before the cp1252 body paragraph
 * @param {string} phrase
 */
function cp1252QuotedPageWithHead(headExtra, phrase) {
  const prefix = Buffer.from(`<html><head>${headExtra}</head><body><p>`, 'latin1')
  const suffix = Buffer.from(' means any individual.</p></body></html>', 'latin1')
  const quoted = Buffer.concat([
    Buffer.from([CP1252_LDQUO]),
    Buffer.from(phrase, 'latin1'),
    Buffer.from([CP1252_RDQUO]),
  ])
  return Buffer.concat([prefix, quoted, suffix])
}

describe('decodeHtmlBody charset handling', () => {
  it('decodes windows-1252 smart quotes declared in a meta Content-Type', () => {
    const body = cp1252QuotedPage('Eligible individual')
    expect(body.toString('utf8')).toContain('\ufffd')
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('keeps UTF-8 as the default when no charset is declared', () => {
    const html = '<html><body><p>\u201cEligible individual\u201d means test.</p></body></html>'
    const body = Buffer.from(html, 'utf8')
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
  })

  it('honours a UTF-8 BOM before a conflicting meta charset', () => {
    const html =
      '<html><head><meta charset="windows-1252"></head><body><p>\u201celigible\u201d</p></body></html>'
    const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(html, 'utf8')])
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201celigible\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('ignores charset text inside HTML comments', () => {
    const body = cp1252QuotedPageWithHead(
      '<!-- <meta charset="utf-8"> -->' +
        '<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">',
      'Eligible individual',
    )
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('ignores charset= inside unrelated meta content attributes', () => {
    const body = cp1252QuotedPageWithHead(
      '<meta name="description" content="charset=windows-1252">' +
        '<meta charset="windows-1252">',
      'Eligible individual',
    )
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('continues past an invalid charset declaration to a later valid one', () => {
    const body = cp1252QuotedPageWithHead(
      '<meta charset="not-a-real-charset">' + '<meta charset="windows-1252">',
      'Eligible individual',
    )
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('prefers the HTTP Content-Type charset over a later meta declaration', () => {
    const html =
      '<html><head><meta charset="windows-1252"></head><body><p>\u201cEligible individual\u201d</p></body></html>'
    const body = Buffer.from(html, 'utf8')
    const text = decodeHtmlBody(body, 'text/html; charset=utf-8')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('ignores a meta-x custom element before a real meta declaration', () => {
    const body = cp1252QuotedPageWithHead(
      '<meta-x charset="utf-8"><meta charset="windows-1252">',
      'Eligible individual',
    )
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('ignores tag-looking text inside another element attribute', () => {
    const body = cp1252QuotedPageWithHead(
      '<div title="<meta charset=utf-8>"><meta charset="windows-1252">',
      'Eligible individual',
    )
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('finds a meta tag end after a quoted attribute containing >', () => {
    const body = cp1252QuotedPageWithHead(
      '<meta data-note=">" charset="windows-1252">',
      'Eligible individual',
    )
    const text = decodeHtmlBody(body, 'text/html')
    expect(text).toContain('\u201cEligible individual\u201d')
    expect(text).not.toContain('\ufffd')
  })

  it('lets a repaired ORS-style quote verify once cp1252 bytes are decoded', () => {
    const body = cp1252QuotedPage('Eligible individual')
    const source = {
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      ok: true,
      isPdf: false,
      fromCache: true,
      variants: htmlVariants(decodeHtmlBody(body, 'text/html')),
    }
    const { verdict } = verdictFor(
      { quotedText: '\u201cEligible individual\u201d means any individual.' },
      source,
    )
    expect(verdict).toBe('EXACT')
  })
})
