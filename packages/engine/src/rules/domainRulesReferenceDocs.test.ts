import { describe, expect, it } from 'vitest'
import domainRulesReferenceMarkdown from '../../../../DOCS/domain/domain-rules-reference.md?raw'

/** Bans the two removed count-claim phrasings from returning; sweeps own the general problem. */
describe('DOCS/domain/domain-rules-reference.md count-claim drift guard', () => {
  it('does not retain registry-count claims removed from the generated coverage page', () => {
    expect(domainRulesReferenceMarkdown).not.toMatch(/registry holds\s+\d+\s+records/iu)
    expect(domainRulesReferenceMarkdown).not.toMatch(/records now carry a state jurisdiction/iu)
  })
})
