import { describe, expect, it } from 'vitest'
import domainRulesReferenceMarkdown from '../../../../DOCS/domain/domain-rules-reference.md?raw'

/** The generated coverage page owns counts so prose claims cannot rot. */
describe('DOCS/domain/domain-rules-reference.md', () => {
  it('does not retain registry-count claims', () => {
    expect(domainRulesReferenceMarkdown).not.toMatch(/registry holds\s+\d+\s+records/iu)
    expect(domainRulesReferenceMarkdown).not.toMatch(/records now carry a state jurisdiction/iu)
  })
})

