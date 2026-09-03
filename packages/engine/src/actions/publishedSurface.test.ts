import { describe, expect, it } from 'vitest'

import packageJsonRaw from '../../package.json?raw'
import barrelSource from './index.ts?raw'

// Module reachability from the published package is governed by two
// hand-maintained lists that nothing checked against each other or against the
// files on disk: the `./actions/<name>` subpaths in package.json (guarded by a
// `"./actions/*": null` blocker so only the listed ones resolve) and the
// re-export blocks in `actions/index.ts`. Forgetting one list silently makes a
// module internal, or makes it public API that a semver bump then has to
// honour. This suite is the guard.
//
// It deliberately does not require the two lists to agree. They do not today,
// and pruning a subpath is a breaking change for external consumers; that is a
// deliberate versioned pass, not a test failure. What it does is make the
// current split explicit, so adding or moving a module shows up as a diff in
// the table below rather than as silence.

const packageJson = JSON.parse(packageJsonRaw) as {
  exports: Record<string, unknown>
}

/** Every `src/actions/*.ts` that is not a test file and not the barrel. */
// Vite requires the options to be inline object literals; the package's
// ImportMeta declaration allows only the eager raw form.
const sourceModules = Object.keys(
  import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }),
)
  .map((filePath) => filePath.replace(/^\.\//, '').replace(/\.ts$/, ''))
  .filter((name) => !name.includes('.test') && name !== 'index')
  .sort()

/** Every `./actions/<name>` key in the package's export map. */
const subpathModules = Object.keys(packageJson.exports)
  .filter((key) => key.startsWith('./actions/') && key !== './actions/*')
  .map((key) => key.slice('./actions/'.length))
  .sort()

/** Every module the barrel re-exports from. */
const barrelModules = [
  ...new Set(
    [...barrelSource.matchAll(/from '\.\/([A-Za-z0-9_]+)\.js'/g)].map((match) => match[1]!),
  ),
].sort()

function categorize(name: string): 'both' | 'barrelOnly' | 'subpathOnly' | 'neither' {
  const inBarrel = barrelModules.includes(name)
  const inSubpaths = subpathModules.includes(name)
  if (inBarrel && inSubpaths) return 'both'
  if (inBarrel) return 'barrelOnly'
  if (inSubpaths) return 'subpathOnly'
  return 'neither'
}

/**
 * The current reachability split, one row per `src/actions/*.ts`.
 *
 * - `both` — reachable as `@retiregolden/engine/actions` and as its own
 *   `@retiregolden/engine/actions/<name>` subpath.
 * - `barrelOnly` — reachable only through the barrel.
 * - `subpathOnly` — reachable only by its own subpath. Empty, and it should
 *   stay empty: a module worth publishing belongs in the barrel too.
 * - `neither` — internal. Nothing outside the package can import it.
 *
 * Adding a module lands it in `neither` until one of the lists is edited, and
 * that lands here as a diff to review rather than a decision made by omission.
 */
const EXPECTED_REACHABILITY: Readonly<Record<string, readonly string[]>> = {
  both: [
    'annualHsaOpeningAuthority',
    'annualHsaPenaltyEvaluation',
    'annualHsaPhysicalMovementCandidate',
    'annualHsaReimbursementLedger',
    'annualHsaTreatmentBindingCoordinator',
    'annualHsaWithdrawalCharacter',
    'annualIraBasisAllocation',
    'annualOwnedNonRothIraPoolCapacity',
    'annualQcdExecutionPrerequisite',
    'annualQcdPhysicalExecution',
    'annualQcdResidualForm8606',
    'annualQcdTaxCharacterPostPass',
    'annualRetirementActionMovementCoordinator',
    'annualRetirementActionPublication',
    'annualRetirementPhysicalEventInventory',
    'civilDate',
    'contract',
    'execution',
    'identity',
    'money',
    'ownedNonRothIraAnnualCandidateCoordinator',
    'ownedNonRothIraAnnualCandidateTransaction',
    'ownedNonRothIraAnnualFilingEvidence',
    'ownedNonRothIraAnnualFilingSourceResolver',
    'ownedNonRothIraAnnualFinalization',
    'ownedNonRothIraAnnualPlanCoordinator',
    'ownedNonRothIraAnnualPostCandidateEvidence',
    'ownedNonRothIraMovementCandidate',
    'ownedNonRothIraPenaltyPrerequisite',
    'ownedNonRothIraSeppAnnualReconciliation',
    'ownedNonRothIraSeppCurrentPaymentCandidate',
    'ownedNonRothIraWithdrawalCharacter',
    'planBalanceAdapter',
    'reasons',
    'retirementActionCandidateIdentityAllocator',
    'retirementActionManualReview',
    'rothConversionExecution',
    'taxableWithdrawalCharacter',
    'traditionalEmployerPlanPenaltyPrerequisite',
  ],
  barrelOnly: [
    'annualQcdActionExecutionEvidence',
    'annualQcdDeductionTreatmentCoordinator',
    'annualQcdDerivedTaxCharacter',
    'annualQcdExecution',
    'annualQcdItemizedLiabilityReconciliation',
    'annualQcdItemizedSection170Ledger',
    'annualQcdStandardSection170pLedger',
    'annualSection68ItemizedDeduction',
    'beneficiaryTraditionalIraAnnualFinalization',
    'beneficiaryTraditionalIraAnnualPhysicalTransaction',
    'beneficiaryTraditionalIraAnnualPlanApplication',
    'beneficiaryTraditionalIraAnnualRuntimeCoordinator',
    'beneficiaryTraditionalIraAnnualSimulatorDelta',
    'beneficiaryTraditionalIraDeathPenalty',
    'beneficiaryTraditionalIraMovementCandidate',
    'beneficiaryTraditionalIraResidualRmdActionIdentity',
    'beneficiaryTraditionalIraResidualRmdAllocation',
    'beneficiaryTraditionalIraResidualRmdAnnualRefinalization',
    'beneficiaryTraditionalIraResidualRmdMovementCandidate',
    'beneficiaryTraditionalIraResidualRmdPhysicalTransaction',
    'beneficiaryTraditionalIraWithdrawalCharacter',
    'conversionLinkedWithdrawalGroup',
    'conversionLinkedWithdrawalGroupExecution',
    'conversionTaxFundingEvidence',
    'qcdDeductibleContributionOffset',
    'traditionalEmployerPlanWithdrawalCharacter',
  ],
  subpathOnly: [],
  neither: [
    'aggregateRothConversionOwnerAllocation',
    'annualLiabilityRunIdentity',
    'annualQcdUnifiedTransactionFinalization',
    'beneficiarySpousalElectionStatus',
    'beneficiaryTraditionalIraResidualRmdChronology',
    'exactCentProRata',
    'freeze',
    'ownedNonRothIraAnnualPhysicalTransaction',
    'plainData',
    'structuralId',
  ],
}

describe('published actions surface', () => {
  it('resolves every listed ./actions/<name> subpath to a source module', () => {
    expect(subpathModules.length).toBeGreaterThan(0)
    for (const name of subpathModules) {
      expect(sourceModules, `./actions/${name} has no src/actions/${name}.ts`)
        .toContain(name)
    }
  })

  it('points every subpath at the compiled output of its own module', () => {
    for (const name of subpathModules) {
      expect(packageJson.exports[`./actions/${name}`]).toEqual({
        types: `./dist/actions/${name}.d.ts`,
        default: `./dist/actions/${name}.js`,
      })
    }
  })

  it('blocks unlisted subpaths with the ./actions/* null entry', () => {
    // Without this, `./actions/<anything>` would resolve and every module in
    // the folder would be public API.
    expect(packageJson.exports['./actions/*']).toBeNull()
    const keys = Object.keys(packageJson.exports)
    expect(keys.indexOf('./actions/*')).toBeLessThan(
      Math.min(...subpathModules.map((name) => keys.indexOf(`./actions/${name}`))),
    )
  })

  it('re-exports only modules that exist', () => {
    for (const name of barrelModules) {
      expect(sourceModules, `index.ts re-exports a missing ./${name}.js`).toContain(name)
    }
  })

  it('matches the recorded reachability of every source module', () => {
    const actual: Record<string, string[]> = {
      both: [], barrelOnly: [], subpathOnly: [], neither: [],
    }
    for (const name of sourceModules) actual[categorize(name)]!.push(name)
    expect(actual).toEqual(EXPECTED_REACHABILITY)
  })

  it('accounts for every source module exactly once', () => {
    const recorded = Object.values(EXPECTED_REACHABILITY).flat()
    expect(new Set(recorded).size).toBe(recorded.length)
    expect([...recorded].sort()).toEqual(sourceModules)
  })
})
