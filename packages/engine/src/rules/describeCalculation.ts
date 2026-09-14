import { describe } from 'vitest'
import {
  CALCULATION_REGISTRY,
  mutationReceiptPathOf,
  type CalculationId,
  type CalculationRecord,
} from './calculationRegistry.js'

const calculationDocs = import.meta.glob('../../../../DOCS/calculations/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * How an evidence value is compared with the worksheet's expectation: 'exact'
 * is strict equality (integers only; the helper rejects anything else), and an
 * object bound is absolute (`abs`), relative to |expected| (`rel`), or both.
 */
export type CalculationTolerance = { readonly abs?: number; readonly rel?: number } | 'exact'

export interface CalculationExample {
  readonly inputs: Readonly<Record<string, unknown>>
  readonly expected: Readonly<Record<string, unknown>>
  readonly tolerance: CalculationTolerance
}

/**
 * Whether `actual` matches `expected` under the fixture's tolerance contract.
 * 'exact' is strict equality. An object bound passes when |actual − expected|
 * is within `abs`, or within `rel` × |expected|, whichever is larger — so a
 * fixture that names only `rel` is compared relatively rather than as an
 * absolute zero, and one that names neither is compared exactly. Every
 * evidence suite goes through this one helper, so the contract cannot be
 * re-implemented differently per file.
 */
export function withinTolerance(actual: number, expected: number, tolerance: CalculationTolerance): boolean {
  if (tolerance === 'exact') return actual === expected
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return actual === expected
  const bound = Math.max(tolerance.abs ?? 0, (tolerance.rel ?? 0) * Math.abs(expected))
  return Math.abs(actual - expected) <= bound
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
  // A derivation record's fixture is bound to the record's own worksheet and
  // to that worksheet's receipt, by the same convention the coverage gate
  // derives the receipt path from, so the catalog card, the fixture, and the
  // published gate can never name three different documents.
  if (record.justification.kind === 'derivation') {
    const { worksheet } = record.justification
    if (spec.worksheet !== worksheet) {
      throw new RangeError(
        `Calculation ${id} fixture names worksheet ${spec.worksheet}, but the record's justification.worksheet is ${worksheet}`,
      )
    }
    const receipt = mutationReceiptPathOf(worksheet)
    if (spec.mutation !== receipt) {
      throw new RangeError(
        `Calculation ${id} fixture names mutation ${spec.mutation}, but the worksheet's mutation receipt is ${receipt}`,
      )
    }
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
