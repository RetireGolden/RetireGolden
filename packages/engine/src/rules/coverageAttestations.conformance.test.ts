import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
  type CoverageAttestationStatus,
} from './coverageAttestations.js'
import { TAX_RULE_REGISTRY } from './taxRuleRegistry.js'

// Vite requires the options to be an inline object literal.
const engineSources = import.meta.glob('../**/*.{ts,mts,cts,tsx}', { query: '?raw', import: 'default', eager: true })
const ATTESTATION_STATUSES: readonly CoverageAttestationStatus[] = ['registered', 'partial', 'rule-free', 'unswept']
const TEST_SOURCE = /\.test\.(ts|mts|cts|tsx)$/u
const DECLARATION_SOURCE = /\.d\.(ts|mts|cts)$/u

/**
 * Glob keys are relative to this directory; attestation paths are
 * source-relative. Vite emits sibling files in this directory as `./name`
 * rather than `../rules/name`, so both prefixes need normalizing.
 */
const sourcePaths = Object.keys(engineSources)
  .filter((path) => !TEST_SOURCE.test(path) && !DECLARATION_SOURCE.test(path))
  .map((path) => path.replace(/^\.\.\//u, '').replace(/^\.\//u, 'rules/'))
  .sort()

function differences(left: readonly string[], right: readonly string[]): readonly string[] {
  const rightSet = new Set(right)
  return left.filter((value) => !rightSet.has(value))
}

describe('coverage attestations', () => {
  it('attests exactly the engine source-file set', () => {
    const attestedPaths = Object.keys(COVERAGE_ATTESTATIONS).sort()
    const missing = differences(sourcePaths, attestedPaths)
    const stale = differences(attestedPaths, sourcePaths)
    expect(
      { missing, stale },
      'missing attestation paths: ' + (missing.join(', ') || 'none') +
        '; stale attestation paths: ' + (stale.join(', ') || 'none'),
    ).toEqual({ missing: [], stale: [] })
  })

  it('keeps each status internally honest', () => {
    const invalidStatuses: string[] = []
    const malformedSweepDates: string[] = []
    const partialWithoutNotes: string[] = []
    for (const [path, attestation] of Object.entries(COVERAGE_ATTESTATIONS)) {
      if (!ATTESTATION_STATUSES.includes(attestation.status)) invalidStatuses.push(path)
      if (attestation.status === 'unswept') {
        if (attestation.sweptOn !== null) malformedSweepDates.push(path)
      } else if (
        attestation.sweptOn === null ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(attestation.sweptOn) ||
        new Date(attestation.sweptOn + 'T00:00:00Z').toISOString().slice(0, 10) !== attestation.sweptOn
      ) {
        malformedSweepDates.push(path)
      }
      if (attestation.status === 'partial' && (typeof attestation.note !== 'string' || attestation.note.trim() === '')) {
        partialWithoutNotes.push(path)
      }
    }
    expect(invalidStatuses, 'unknown attestation statuses').toEqual([])
    expect(malformedSweepDates, 'attestations with an invalid sweep date').toEqual([])
    expect(partialWithoutNotes, 'partial attestations without residual claims').toEqual([])
  })

  it('does not mark registry-named implementers as rule-free', () => {
    const registryNamedPaths = new Set<string>()
    for (const rule of Object.values(TAX_RULE_REGISTRY)) {
      for (const implementedBy of rule.implementedBy) {
        registryNamedPaths.add(implementedBy.replace(/^packages\/engine\/src\//u, ''))
      }
    }
    const ruleFreeButNamed = [...registryNamedPaths]
      .filter((path) => COVERAGE_ATTESTATIONS[path]?.status === 'rule-free')
      .sort()
    expect(
      ruleFreeButNamed,
      'registry-named paths attested as rule-free: ' + (ruleFreeButNamed.join(', ') || 'none'),
    ).toEqual([])
  })

  it('forbids unswept attestations after the baseline sweep', () => {
    expect(BASELINE_UNSWEPT.length).toBe(0)
    const unswept = Object.entries(COVERAGE_ATTESTATIONS)
      .filter(([, attestation]) => attestation.status === 'unswept')
      .map(([path]) => path)
      .sort()
    expect(unswept, 'attestations with status unswept: ' + (unswept.join(', ') || 'none')).toEqual([])
  })

  it('names every registered attestation in the registry implementedBy list', () => {
    const registryNamedPaths = new Set<string>()
    for (const rule of Object.values(TAX_RULE_REGISTRY)) {
      for (const implementedBy of rule.implementedBy) {
        registryNamedPaths.add(implementedBy.replace(/^packages\/engine\/src\//u, ''))
      }
    }
    // The record store never names itself: a record's implementedBy points at
    // the engine code the rule governs, not at the file the record is written
    // in. The store is the composing module plus the per-domain record modules
    // it spreads.
    const isRecordStore = (path: string): boolean =>
      path === 'rules/taxRuleRegistry.ts' || /^rules\/records\/[^/]+\.ts$/u.test(path)
    const registeredButUnnamed = Object.entries(COVERAGE_ATTESTATIONS)
      .filter(([path, attestation]) =>
        attestation.status === 'registered' && !isRecordStore(path) && !registryNamedPaths.has(path))
      .map(([path]) => path)
      .sort()
    expect(
      registeredButUnnamed,
      'registered paths not named by any registry record: ' + (registeredButUnnamed.join(', ') || 'none'),
    ).toEqual([])
  })
})

