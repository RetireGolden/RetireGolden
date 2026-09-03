/**
 * planner-ui composes and presents engine results; it must not restate law, so a
 * rule id it mentions must exist in the registry, and it may only consume the
 * engine through its public subpaths.
 *
 * This scan is DELIBERATELY STRICTER than taxRuleRegistry.conformance.test.ts:
 * the engine suite admits backticked bare statute-section prefixes; consumers
 * may cite only full registered rule ids.
 */

import { describe, expect, it } from 'vitest'
import { taxRuleIds } from '@retiregolden/engine/rules'

// Vite requires the options to be an inline object literal.
const packageSources = import.meta.glob('./**/*.{ts,tsx,mts,cts}', { query: '?raw', import: 'default', eager: true })

const SELF = 'engineRuleReferences.test.ts'
const registeredRuleIds = new Set<string>(taxRuleIds)
const registryPrefixes = new Set(taxRuleIds.map((ruleId) => ruleId.split('-')[0]))

/** Authority-anchored ids only — full registered rule ids, not bare statute prefixes. */
const authorityShaped = /`([A-Za-z0-9]+(?:-[A-Za-z0-9]+){3,})`/gu
/** "registered as `x`" — any kebab token after the phrase is a registry citation. */
const citedAsRegistered =
  /[Rr]egistered(?:,[^`]{0,80})? as[\s*/]*`([A-Za-z0-9][A-Za-z0-9-]*)`/gu

const DEEP_IMPORT_PATTERNS: ReadonlyArray<{ pattern: RegExp, label: string }> = [
  { pattern: /@retiregolden\/engine\/(?:src|dist)\//u, label: '@retiregolden/engine src/dist path' },
  { pattern: /engine\/params\/(?:data|state\/data)\//u, label: 'engine parameter data table' },
  { pattern: /\.\.\/.*(?:packages\/)?engine\/(?:src|dist)\//u, label: 'relative escape into engine internals' },
]

/** packages/engine/package.json "exports" keys — do not read at runtime. */
const ENGINE_PACKAGE_EXPORT_KEYS: readonly string[] = [
  '.',
  './actions',
  './decisions',
  './params',
  './params/state',
  './rules',
  './schema',
  './schema/current',
  './schema/v1',
  './schema/v2',
  './schema/v3',
  './schema/v4',
  './schema/v5',
  './schema/plan.v1.json',
  './schema/plan.v2.json',
  './schema/plan.v3.json',
  './schema/plan.v4.json',
  './schema/plan.v5.json',
  './actions/*',
  './actions/annualHsaOpeningAuthority',
  './actions/annualHsaPenaltyEvaluation',
  './actions/annualHsaPhysicalMovementCandidate',
  './actions/annualHsaReimbursementLedger',
  './actions/annualHsaTreatmentBindingCoordinator',
  './actions/annualHsaWithdrawalCharacter',
  './actions/annualIraBasisAllocation',
  './actions/annualOwnedNonRothIraPoolCapacity',
  './actions/annualQcdExecutionPrerequisite',
  './actions/annualQcdPhysicalExecution',
  './actions/annualQcdResidualForm8606',
  './actions/annualQcdTaxCharacterPostPass',
  './actions/annualRetirementActionMovementCoordinator',
  './actions/annualRetirementActionPublication',
  './actions/annualRetirementPhysicalEventInventory',
  './actions/civilDate',
  './actions/contract',
  './actions/execution',
  './actions/identity',
  './actions/money',
  './actions/ownedNonRothIraAnnualCandidateCoordinator',
  './actions/ownedNonRothIraAnnualCandidateTransaction',
  './actions/ownedNonRothIraAnnualFilingEvidence',
  './actions/ownedNonRothIraAnnualFilingSourceResolver',
  './actions/ownedNonRothIraAnnualFinalization',
  './actions/ownedNonRothIraAnnualPlanCoordinator',
  './actions/ownedNonRothIraAnnualPostCandidateEvidence',
  './actions/ownedNonRothIraMovementCandidate',
  './actions/ownedNonRothIraPenaltyPrerequisite',
  './actions/ownedNonRothIraSeppAnnualReconciliation',
  './actions/ownedNonRothIraSeppCurrentPaymentCandidate',
  './actions/ownedNonRothIraWithdrawalCharacter',
  './actions/planBalanceAdapter',
  './actions/reasons',
  './actions/retirementActionCandidateIdentityAllocator',
  './actions/retirementActionManualReview',
  './actions/rothConversionExecution',
  './actions/taxableWithdrawalCharacter',
  './actions/traditionalEmployerPlanPenaltyPrerequisite',
  './allocation/*',
  './decisions/*',
  './insights/*',
  './ladder/*',
  './longevity/*',
  './model/*',
  './montecarlo/*',
  './params/*',
  './projection/internal/*',
  './projection/*',
  './rmd/*',
  './scenarios/*',
  './schema/*',
  './socialSecurity/*',
  './spending/*',
  './strategies/*',
  './tax/*',
  './testing/*',
  './version',
  './*',
  './package.json',
]

const NULL_EXPORT_WILDCARDS = new Set(['./actions/*', './projection/internal/*', './*'])

function exportKeyMatchesSubpath(exportKey: string, subpath: string): boolean {
  if (exportKey === '.') return subpath === ''
  const keyPath = exportKey.slice(2)
  if (exportKey.endsWith('/*')) {
    const prefix = keyPath.slice(0, -2)
    return subpath === prefix || subpath.startsWith(prefix + '/')
  }
  return subpath === keyPath
}

function isAllowedEngineExportSpecifier(specifier: string): boolean {
  if (!specifier.startsWith('@retiregolden/engine')) return true
  const subpath = specifier === '@retiregolden/engine' ? '' : specifier.slice('@retiregolden/engine/'.length)
  if (NULL_EXPORT_WILDCARDS.size > 0) {
    for (const blocked of NULL_EXPORT_WILDCARDS) {
      if (!exportKeyMatchesSubpath(blocked, subpath)) continue
      const rescued = ENGINE_PACKAGE_EXPORT_KEYS.some(
        (key) => !NULL_EXPORT_WILDCARDS.has(key) && !key.endsWith('/*') && exportKeyMatchesSubpath(key, subpath),
      )
      if (!rescued) return false
    }
  }
  return ENGINE_PACKAGE_EXPORT_KEYS.some(
    (key) => !NULL_EXPORT_WILDCARDS.has(key) && exportKeyMatchesSubpath(key, subpath),
  )
}

/** ES module specifiers only — import.meta.glob patterns are out of scope. */
function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gmu)) {
    specifiers.push(match[1]!)
  }
  for (const match of source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/gu)) {
    specifiers.push(match[1]!)
  }
  for (const match of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
    specifiers.push(match[1]!)
  }
  return specifiers
}

function citedRuleIdsInSource(source: string): string[] {
  const cited: string[] = []
  for (const match of source.matchAll(authorityShaped)) {
    const token = match[1]
    if (!registryPrefixes.has(token!.split('-')[0])) continue
    cited.push(token!)
  }
  for (const match of source.matchAll(citedAsRegistered)) {
    cited.push(match[1]!)
  }
  return cited
}

describe('engine consumer boundaries', () => {
  it('cites only rule ids that exist in the registry', () => {
    const unknown: string[] = []
    for (const [path, source] of Object.entries(packageSources)) {
      if (path.endsWith(SELF)) continue
      for (const token of citedRuleIdsInSource(source)) {
        if (!registeredRuleIds.has(token)) unknown.push(`${path}: ${token}`)
      }
    }
    expect([...new Set(unknown)].sort()).toEqual([])
  })

  it('never deep-imports engine internals or parameter data tables', () => {
    const offenders: string[] = []
    for (const [path, source] of Object.entries(packageSources)) {
      if (path.endsWith(SELF)) continue
      for (const specifier of moduleSpecifiers(source)) {
        for (const { pattern, label } of DEEP_IMPORT_PATTERNS) {
          if (pattern.test(specifier)) offenders.push(`${path}: ${specifier} (${label})`)
        }
        if (!isAllowedEngineExportSpecifier(specifier)) {
          offenders.push(`${path}: ${specifier} (not a public @retiregolden/engine export subpath)`)
        }
      }
    }
    expect([...new Set(offenders)].sort()).toEqual([])
  })
})
