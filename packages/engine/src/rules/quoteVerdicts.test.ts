import { describe, expect, it } from 'vitest'
import { fallbackEligible, htmlVariants, verdictFor, type QuoteVerdictSource } from '../../scripts/verify-quotes.mjs'

/**
 * Pins the suspect-stub verdict contract introduced with the drift sweep: a
 * page shorter than the shell threshold keeps its variants and is judged per
 * quote. A match on a tiny page is real (a repealed chapter's page is one
 * line of repeal history); a fixable defect still earns its diagnostic rung;
 * only the final absence claim becomes UNFETCHABLE, so a shell page never
 * accuses the registry.
 */
const REPEAL_PAGE = '<html><body><p>Chapter 77 Repealed. Secs. 65, 70(1), Ch. 503, L. 2021.</p></body></html>'

function stubSource(html: string): QuoteVerdictSource {
  return {
    url: 'https://example.gov/tiny',
    ok: true,
    isPdf: false,
    suspectStub: true,
    problem: 'only 60 characters of text - a shell or error page, not the document',
    variants: htmlVariants(html),
    fromCache: true,
  }
}

describe('suspect-stub verdict contract', () => {
  it('verifies an exact quote found on a genuinely tiny page', () => {
    const { verdict, detail } = verdictFor(
      { quotedText: 'Repealed. Secs. 65, 70(1), Ch. 503, L. 2021.' },
      stubSource(REPEAL_PAGE),
    )
    expect(verdict).toBe('EXACT')
    // A verified match on a flagged-short page is disclosed, not hidden.
    expect(detail).toContain('below the shell-length threshold')
  })

  it('keeps the diagnostic rungs ahead of the stub guard', () => {
    // Same words, quote carries a trailing semicolon the page does not:
    // a short page with a fixable defect reports the defect, not the shell.
    const { verdict } = verdictFor(
      { quotedText: 'Repealed. Secs. 65, 70(1), Ch. 503, L. 2021;' },
      stubSource(REPEAL_PAGE),
    )
    expect(['PUNCTUATION', 'TRUNCATED']).toContain(verdict)
  })

  it('reports a genuine miss on a stub as UNFETCHABLE, never ABSENT', () => {
    const { verdict, detail } = verdictFor(
      { quotedText: 'This passage exists in no shell page anywhere.' },
      stubSource(REPEAL_PAGE),
    )
    expect(verdict).toBe('UNFETCHABLE')
    expect(detail).toContain('shell or error page')
  })

  it('still reports ABSENT for a miss against a full-size trusted page', () => {
    const source: QuoteVerdictSource = {
      ...stubSource('<html><body>' + '<p>filler sentence for bulk. </p>'.repeat(200) + '</body></html>'),
      suspectStub: false,
    }
    const { verdict } = verdictFor({ quotedText: 'This passage exists in no shell page anywhere.' }, source)
    expect(verdict).toBe('ABSENT')
  })
})

describe('fetch identity ladder gate', () => {
  it('retries only refused statuses on allowlisted hosts', () => {
    expect(fallbackEligible('www.ssa.gov', 403)).toBe(true)
    expect(fallbackEligible('www.ssa.gov', 401)).toBe(true)
    expect(fallbackEligible('www.ssa.gov', 406)).toBe(true)
  })
  it('never retries a served or errored response', () => {
    expect(fallbackEligible('www.ssa.gov', 200)).toBe(false)
    expect(fallbackEligible('www.ssa.gov', 404)).toBe(false)
    expect(fallbackEligible('www.ssa.gov', 500)).toBe(false)
  })
  it('never retries hosts outside the allowlist, jct.gov included', () => {
    expect(fallbackEligible('www.jct.gov', 403)).toBe(false)
    expect(fallbackEligible('www.nysenate.gov', 403)).toBe(false)
    expect(fallbackEligible('uscode.house.gov', 403)).toBe(false)
  })
})
