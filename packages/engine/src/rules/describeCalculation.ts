import { describe } from 'vitest'
import {
  CALCULATION_REGISTRY,
  type CalculationId,
  type CalculationRecord,
} from './calculationRegistry.js'

const calculationDocs = import.meta.glob('../../../../DOCS/calculations/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface CalculationExample {
  readonly inputs: Readonly<Record<string, unknown>>
  readonly expected: Readonly<Record<string, unknown>>
  readonly tolerance: { readonly abs?: number; readonly rel?: number } | 'exact'
}

export interface CalculationFixtureSpec {
  readonly example: CalculationExample
  readonly worksheet: string
  readonly mutation: string
}

export interface CalculationFixtureContext<Id extends CalculationId> {
  readonly example: CalculationExample
  readonly record: (typeof CALCULATION_REGISTRY)[Id]
}

function docText(repoPath: string): string | undefined {
  const key = '../../../../' + repoPath.replace(/\\/gu, '/')
  return calculationDocs[key]
}

function requireDoc(kind: 'worksheet' | 'mutation', repoPath: string): void {
  const text = docText(repoPath)
  if (text === undefined || text.trim().length === 0) {
    throw new RangeError(
      `Calculation ${kind} is missing or empty at ${repoPath} (resolved from the repository root)`,
    )
  }
}

function integerLeaves(value: unknown, path: string, found: string[]): void {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) found.push(path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => integerLeaves(entry, `${path}[${index}]`, found))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      integerLeaves(entry, path === '' ? key : `${path}.${key}`, found)
    }
  }
}

export function describeCalculation<const Id extends CalculationId>(
  id: Id,
  spec: CalculationFixtureSpec,
  suite: (context: CalculationFixtureContext<Id>) => void,
): void {
  const record: CalculationRecord | undefined = CALCULATION_REGISTRY[id]
  if (record === undefined) {
    throw new RangeError(`Unknown calculation: ${id}`)
  }
  requireDoc('worksheet', spec.worksheet)
  requireDoc('mutation', spec.mutation)
  if (spec.example.tolerance === 'exact') {
    const nonIntegers: string[] = []
    integerLeaves(spec.example.expected, '', nonIntegers)
    if (nonIntegers.length > 0) {
      throw new RangeError(
        `Calculation ${id} uses tolerance 'exact' with a non-integer expected value at ${nonIntegers.join(', ')}`,
      )
    }
  }
  describe(`${id} — ${record.title}`, () => {
    // `Id` is generic inside the body, so the checker cannot narrow the registry
    // lookup to this record's own type; the guard above makes the cast sound.
    suite({ example: spec.example, record: record as (typeof CALCULATION_REGISTRY)[Id] })
  })
}
