/**
 * No committed evidence points at one person's disk (decision
 * D-LOCAL-PATHS-IN-EVIDENCE).
 *
 * Evidence is rerunnable only by someone who can reach what it cites. A
 * mutation receipt whose vitest banner names the author's worktree, a ledger
 * note that says a source was "saved under" a folder on the author's drive, or
 * a worksheet that cites a script by its path on that drive, each points a
 * reader at a place they cannot open. Every tracked text file under DOCS/,
 * packages/<name>/src/, packages/<name>/scripts/, app/src/ and scripts/ is read,
 * and any drive-letter path, home directory, Git Bash or WSL drive mount, or
 * path through the program's worktree root fails this suite, unless ALLOWED
 * names it with the reason it is not evidence.
 *
 * Cite what a reader can reach instead: a path from the repository root, a
 * RetireGolden-Docs file, a URL, or a file's name and SHA-256.
 */
import { describe, expect, it } from 'vitest'
import { findLocalPaths, listScopedFiles, scanForLocalPaths } from '../../scripts/local-paths.mjs'

const THIS_FILE = 'packages/engine/src/rules/localPaths.conformance.test.ts'

interface Allowed {
  readonly path: string
  /** The path tokens allowed in that file, exactly as findLocalPaths reports them; every token when absent. */
  readonly tokens?: readonly string[]
  readonly reason: string
}

const ALLOWED: readonly Allowed[] = [
  {
    path: 'packages/engine/src/rules/mutationReceipts.conformance.test.ts',
    tokens: [
      'C:/work/repo/DOCS/calculations/taxes/x.mutation.md',
      String.raw`C:\\work\\repo\\DOCS\\calculations\\taxes\\x.mutation.md`,
    ],
    reason: 'asserts a receipt is labelled from its DOCS/ marker whatever absolute prefix a Windows glob key carries',
  },
  {
    path: THIS_FILE,
    reason: "this guard's own examples of the paths it refuses",
  },
]

const isAllowed = (hit: { path: string; token: string }): boolean =>
  ALLOWED.some((entry) => entry.path === hit.path && (entry.tokens === undefined || entry.tokens.includes(hit.token)))

describe('findLocalPaths', () => {
  it.each([
    [' RUN  v5.0.0 C:/rgwt/engine9/packages/engine', 'C:/rgwt/engine9/packages/engine'],
    ['saved under C:/rgwt/staging/2027-figures/sources/ (dc-act-26-416.html', 'C:/rgwt/staging/2027-figures/sources/'],
    ['RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine', 'C:/TEMP/rg-rehearse2/packages/engine'],
    [String.raw`"cwd": "C:\\Users\\Nathan\\x.md",`, String.raw`C:\\Users\\Nathan\\x.md`],
    [String.raw`at C:\TEMP\rg-s5\packages\engine`, String.raw`C:\TEMP\rg-s5\packages\engine`],
    ['(`d:/work/repo/run.mjs`)', 'd:/work/repo/run.mjs'],
    ['file:///C:/Users/nathan/report.html', 'C:/Users/nathan/report.html'],
    ['cloned to /Users/nathan/src/RetireGolden', '/Users/nathan/src/RetireGolden'],
    ['"/home/runner/work/RetireGolden/x"', '/home/runner/work/RetireGolden/x'],
    ['bash /c/Users/Nathan/run.sh', '/c/Users/Nathan/run.sh'],
    ['cd /mnt/c/TEMP/claude', '/mnt/c/TEMP/claude'],
    ['the worktree ~/rgwt/engine20', 'rgwt/engine20'],
  ])('finds the local path in %j', (line, token) => {
    expect(findLocalPaths(line)).toEqual([{ line: 1, token }])
  })

  it.each([
    'https://code.dccouncil.gov/us/dc/council/acts/26-416',
    'RUN  v5.0.0 packages/engine',
    "import { YourPlans } from '../planner/home/YourPlans'",
    "import { useHomeData } from './home/useHomeData'",
    'https://example.org/Users/guide and https://example.org/home/',
    'reachable only through /Home/FTPDocument?path=%2FACTS%2F',
    'a 3:1 ratio at 12:30, and the rgwt root named in prose',
  ])('finds none in %j', (line) => {
    expect(findLocalPaths(line)).toEqual([])
  })

  it('reports each occurrence on its own line number, across CRLF and LF', () => {
    const text = ['clean', 'C:/rgwt/a and /home/b/c', 'clean'].join('\r\n') + '\n/Users/d/e\n'
    expect(findLocalPaths(text)).toEqual([
      { line: 2, token: 'C:/rgwt/a' },
      { line: 2, token: '/home/b/c' },
      { line: 4, token: '/Users/d/e' },
    ])
  })
})

describe('local machine paths in committed files', () => {
  const scan = scanForLocalPaths()

  it('reads the covered trees, this file included', () => {
    expect(scan.paths.length).toBeGreaterThan(1000)
    expect(scan.paths).toContain(THIS_FILE)
    expect(scan.paths).toContain('DOCS/operations/quote-fidelity-ledger.json')
    expect(scan.paths.some((path) => path.endsWith('.mutation.md'))).toBe(true)
    expect(scan.paths.filter((path) => !/^(?:DOCS|scripts|app\/src|packages\/[^/]+\/(?:src|scripts))\//u.test(path))).toEqual([])
  })

  it('lists the same trees from the disk when there is no repository to ask', () => {
    const disk = listScopedFiles(undefined, { disk: true })
    expect(disk.source).toBe('disk')
    expect(disk.paths).toContain(THIS_FILE)
    expect(disk.paths).toContain('DOCS/operations/quote-fidelity-ledger.json')
    expect(disk.paths.filter((path) => path.includes('/node_modules/'))).toEqual([])
  })

  it('finds no local path outside the allowed list', () => {
    expect(scan.found.filter((hit) => !isAllowed(hit)).map((hit) => `${hit.path}:${hit.line}: ${hit.token}`)).toEqual([])
  })

  it('keeps no allowance that nothing uses', () => {
    const unused = ALLOWED.flatMap((entry) =>
      entry.tokens === undefined
        ? scan.found.some((hit) => hit.path === entry.path)
          ? []
          : [entry.path]
        : entry.tokens
            .filter((token) => !scan.found.some((hit) => hit.path === entry.path && hit.token === token))
            .map((token) => `${entry.path}: ${token}`),
    )
    expect(unused).toEqual([])
  })
})
