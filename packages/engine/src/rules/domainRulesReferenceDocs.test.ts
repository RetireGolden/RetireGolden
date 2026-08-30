import { describe, expect, it } from 'vitest'
import domainRulesReferenceMarkdown from '../../../../DOCS/domain/domain-rules-reference.md?raw'

// The reference is one file per section under domain-rules-reference/, with the
// old path kept as the index. Vite requires an inline object literal.
const shardSources = import.meta.glob('../../../../DOCS/domain/domain-rules-reference/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Shard text keyed by file name (`06-rmds-secure-20.md`). */
const shards = new Map(
  Object.entries(shardSources).map(([path, source]) => [
    path.slice(path.lastIndexOf('/') + 1),
    source as string,
  ]),
)

/** Bans the two removed count-claim phrasings from returning; sweeps own the general problem. */
describe('DOCS/domain/domain-rules-reference count-claim drift guard', () => {
  it('does not retain registry-count claims removed from the generated coverage page', () => {
    // Every shard is checked, not only the index: the prose the ban is about
    // lives in the sections, which is where it would come back.
    for (const [name, markdown] of [['index', domainRulesReferenceMarkdown] as const, ...shards]) {
      expect(markdown, name).not.toMatch(/registry holds\s+\d+\s+records/iu)
      expect(markdown, name).not.toMatch(/records now carry a state jurisdiction/iu)
    }
  })
})

describe('DOCS/domain/domain-rules-reference index', () => {
  it('links every shard on disk, and links nothing that is not one', () => {
    // A section added as a file but never linked is invisible to a reader
    // arriving at the index; a link to a deleted or renamed section is a 404.
    // Both directions are checked, so neither can pass quietly.
    const linked = [...domainRulesReferenceMarkdown.matchAll(/\(domain-rules-reference\/([^)]+\.md)\)/gu)]
      .map((match) => match[1]!)
    expect(shards.size).toBeGreaterThan(0)
    expect([...new Set(linked)].sort()).toEqual([...shards.keys()].sort())
  })

  it('keeps the section numbering contiguous, each shard opening on its own section heading', () => {
    // The file name's numeric prefix is what orders the directory, so it has to
    // agree with the heading the file actually opens on — otherwise the index
    // reads in one order and the sections number in another.
    const numbers: number[] = []
    for (const [name, markdown] of [...shards].sort(([left], [right]) => (left < right ? -1 : 1))) {
      const heading = markdown.split('\n')[0]!.trimEnd()
      const match = /^## (\d+)\. /u.exec(heading)
      expect(match, name + ' should open on a numbered section heading, got: ' + heading).not.toBeNull()
      const number = Number(match![1])
      expect(name.startsWith(String(number).padStart(2, '0') + '-'), name).toBe(true)
      numbers.push(number)
    }
    expect(numbers).toEqual(numbers.map((_, index) => index + 1))
  })

  // The split shipped with a bare CR sitting mid-row in all 20 table rows: the
  // section headings were sliced out of a CRLF file without stripping the CR,
  // so every row broke in two and the table did not render at all. Rendering is
  // the index's entire job, so the row shape is pinned here.
  it('renders every section row as one table row carrying both title and link', () => {
    const lines = domainRulesReferenceMarkdown.split('\n')
    const header = lines.findIndex((line) => line.replace(/\r/gu, '') === '| Section | File |')
    expect(header, 'index should carry a Section/File table').toBeGreaterThanOrEqual(0)
    expect(lines[header + 1]!.replace(/\r/gu, '')).toBe('| --- | --- |')

    const rows = lines
      .slice(header + 2)
      .map((line) => line.replace(/\r$/u, ''))
      .filter((line) => line.startsWith('|'))
    expect(rows.length).toBe(shards.size)
    for (const row of rows) {
      // A stray CR anywhere inside the row is the exact defect: CommonMark ends
      // the row there and the remainder becomes a separate paragraph.
      expect(row, row).not.toMatch(/\r/u)
      const cells = row.split('|').slice(1, -1).map((cell) => cell.trim())
      expect(cells.length, row).toBe(2)
      expect(cells[0], row).toMatch(/^\d+\. \S/u)
      const link = /^\[([^\]]+)\]\(domain-rules-reference\/([^)]+)\)$/u.exec(cells[1]!)
      expect(link, 'second cell should link to a section file: ' + row).not.toBeNull()
      expect(link![1]).toBe(link![2])
      expect(shards.has(link![2]!), link![2]).toBe(true)
    }
  })

  it('names section files without a dangling connective word', () => {
    // Long headings are truncated to keep the checked-out path short on
    // Windows; the numeric prefix identifies the section and the index table
    // carries the full title. Truncation must still stop on a whole word rather
    // than leaving a name ending in "-and" or "-the", which reads as corrupted.
    for (const name of shards.keys()) {
      // `(opt-in)` closes several headings and slugs to a trailing `-opt-in`;
      // it is a whole word, not a truncation, so it is peeled before the check.
      const slug = name.replace(/\.md$/u, '').replace(/-opt-in$/u, '')
      const last = slug.slice(slug.lastIndexOf('-') + 1)
      expect(['and', 'the', 'of', 'a', 'an', 'to', 'for', 'with'], name).not.toContain(last)
    }
  })

  it('states the split in the index rather than leaving the sections unexplained', () => {
    expect(domainRulesReferenceMarkdown).toContain('[`domain-rules-reference/`](domain-rules-reference/)')
    // The preamble is the part the split had to preserve: it carries the
    // record-citation convention every section depends on. Wrapped prose, so
    // the newline form of a Windows checkout must not decide the assertion.
    expect(domainRulesReferenceMarkdown.replace(/\r\n/gu, '\n'))
      .toContain('cite the record\nID here rather than restating its authority')
  })
})
