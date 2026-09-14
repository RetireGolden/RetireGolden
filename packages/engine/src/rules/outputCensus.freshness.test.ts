import { describe, expect, it } from 'vitest'
import { CENSUS_FILE_NAMES, renderCensusModules } from '../../scripts/import-output-census.mjs'

// Vite requires the options to be inline object literals.
const committedModules = import.meta.glob('./output{Families,FieldCoverage}.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const censusCopies = import.meta.glob('./census/*.json', { query: '?raw', import: 'default', eager: true })

const HEADER_COMMIT = /imported from the output-family census at commit ([^\s.]+)\./u

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function committedModule(name: string): string {
  const text = committedModules['./' + name] as string | undefined
  if (text === undefined) throw new Error(name + ' must be found by the glob')
  return normalizeNewlines(text)
}

function censusCopy(name: string): unknown {
  const text = censusCopies['./census/' + name] as string | undefined
  if (text === undefined) throw new Error('src/rules/census/' + name + ' must be found by the glob')
  return JSON.parse(text)
}

function headerCommit(moduleText: string): string {
  const match = HEADER_COMMIT.exec(moduleText)
  if (match === null) throw new Error('generated header names no census commit')
  return match[1]!
}

/**
 * The engine carries its own frozen copy of the Docs output census
 * (src/rules/census/) beside the two modules import-output-census.mjs
 * generates from it. Regenerating the modules from that copy through the
 * importer's own generator, and comparing byte for byte, is what makes the
 * 'DO NOT EDIT BY HAND' header enforceable: a hand edit to either module, or
 * a census copy that advanced without a regeneration, fails here.
 */
describe('output census freshness', () => {
  it('carries exactly the three census files the importer copies', () => {
    const copied = Object.keys(censusCopies)
      .map((key) => key.slice(key.lastIndexOf('/') + 1))
      .sort()
    expect(copied).toEqual([...CENSUS_FILE_NAMES].sort())
  })

  it('names one resolved census commit in both generated headers', () => {
    const families = headerCommit(committedModule('outputFamilies.ts'))
    const coverage = headerCommit(committedModule('outputFieldCoverage.ts'))
    expect(families).toMatch(/^[0-9a-f]{40}$/u)
    expect(coverage).toBe(families)
  })

  it('regenerates outputFamilies.ts and outputFieldCoverage.ts byte for byte from the committed census copy', () => {
    const commit = headerCommit(committedModule('outputFamilies.ts'))
    const modules = renderCensusModules(
      {
        families: censusCopy('output-families.json') as readonly unknown[],
        coverage: censusCopy('output-field-coverage.json') as readonly unknown[],
        exclusions: censusCopy('output-exclusions.json') as readonly unknown[],
      },
      commit,
    )
    expect(normalizeNewlines(modules.outputFamilies)).toBe(committedModule('outputFamilies.ts'))
    expect(normalizeNewlines(modules.outputFieldCoverage)).toBe(committedModule('outputFieldCoverage.ts'))
  })

  it('rejects a coverage row whose familyId names no family', () => {
    expect(() =>
      renderCensusModules(
        {
          families: [{ id: 'real-family', kind: 'engine' }],
          coverage: [{ source: 'engine/src/x.ts', owner: 'X', field: 'y', disposition: 'family', familyId: 'typo-family' }],
          exclusions: [],
        },
        '0'.repeat(40),
      ),
    ).toThrow(/typo-family/u)
    expect(() =>
      renderCensusModules(
        {
          families: [{ id: 'real-family', kind: 'engine' }],
          coverage: [{ source: 'engine/src/x.ts', owner: 'X', field: 'y', disposition: 'family' }],
          exclusions: [],
        },
        '0'.repeat(40),
      ),
    ).toThrow(/no familyId/u)
  })
})
