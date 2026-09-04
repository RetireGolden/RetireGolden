#!/usr/bin/env node
/**
 * Packs @retiregolden/engine and exercises the resulting tarball the way an
 * external consumer (the Pro desktop app) will: install it into a scratch
 * project and import the published surface from plain Node ESM — no Vite
 * alias, no workspace symlink, no browser globals, no network.
 *
 * The dev loop never touches dist/ (Vite aliases the package to src/), so
 * this is the one check that proves the exports map and the emitted .js/.d.ts
 * actually resolve. Run from anywhere: `node packages/engine/scripts/pack-smoke.mjs`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shell = process.platform === 'win32' // pnpm is pnpm.cmd on Windows
const require = createRequire(import.meta.url)

function collectImportFootprint(entryPath, footprint = {
  modulePaths: new Set(),
  externalSpecifiers: new Set(),
  dynamicSpecifiers: new Set(),
}) {
  const modulePath = resolve(entryPath)
  if (footprint.modulePaths.has(modulePath)) return footprint
  if (!existsSync(modulePath)) {
    throw new Error(
      'schema import-footprint entry or dependency does not exist: ' + modulePath +
        '. Check the package export map and emitted schema files.',
    )
  }
  footprint.modulePaths.add(modulePath)

  const source = readFileSync(modulePath, 'utf8')
  const staticSpecifier = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu
  for (const match of source.matchAll(staticSpecifier)) {
    if (match[1].startsWith('.')) {
      collectImportFootprint(resolve(dirname(modulePath), match[1]), footprint)
    } else {
      footprint.externalSpecifiers.add(match[1])
    }
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
    footprint.dynamicSpecifiers.add(match[1])
  }
  return footprint
}

const smokeScript = `
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Prove "no ambient network / no browser globals": any engine code path that
// reached for these would now throw.
delete globalThis.fetch
assert.equal(typeof globalThis.fetch, 'undefined')
assert.equal(typeof globalThis.window, 'undefined')
assert.equal(typeof globalThis.document, 'undefined')
assert.equal(typeof globalThis.localStorage, 'undefined')

// Representative subpaths: root entry, directory-index exports, a deep
// module, and the testing fixtures.
const { simulatePlan, planSchema, CURRENT_PLAN_SCHEMA_VERSION } = await import('@retiregolden/engine')
const { packForYear } = await import('@retiregolden/engine/params')
const scenarioActionRowsDeepApi = await import('@retiregolden/engine/scenarios/actionRows')
const actionsApi = await import('@retiregolden/engine/actions')
const decisionsApi = await import('@retiregolden/engine/decisions')
const optimizerAllocatedCandidateComparisonDeepApi = await import(
  '@retiregolden/engine/projection/optimizerAllocatedCandidateComparison'
)
const qcdCandidateAdapterDeepApi = await import(
  '@retiregolden/engine/decisions/qcdCandidateAdapter'
)
const candidateIdentityAllocatorDeepApi = await import(
  '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
)
const annualQcdPrerequisiteDeepApi = await import(
  '@retiregolden/engine/actions/annualQcdExecutionPrerequisite'
)
const ordinaryWithdrawalCandidateAdapterDeepApi = await import(
  '@retiregolden/engine/decisions/ordinaryWithdrawalCandidateAdapter'
)
const rothConversionCandidateAdapterDeepApi = await import(
  '@retiregolden/engine/decisions/rothConversionCandidateAdapter'
)
assert.equal(
  typeof optimizerAllocatedCandidateComparisonDeepApi.compareOptimizerAllocatedCandidate,
  'function',
)
// The HSA boundaries lost their own subpaths in 0.3.0; the barrel is now
// the only way in, so this is where their reachability is proven.
assert.equal(
  typeof actionsApi.coordinateAnnualHsaTreatmentBinding,
  'function',
)
assert.equal(
  typeof actionsApi.establishAnnualHsaOpeningAuthority,
  'function',
)
// The complete published ./actions/<name> surface as of 0.3.0. It was 39
// names; 29 of them had no importer anywhere and were pruned in that
// release. Every module they named is still reachable through the
// ./actions barrel -- the loop below proves these ten resolve, and the
// loop after it proves the pruned names no longer do.
const canonicalActionDeepImports = [
  'annualQcdExecutionPrerequisite',
  'civilDate',
  'contract',
  'execution',
  'identity',
  'money',
  'planBalanceAdapter',
  'reasons',
  'retirementActionCandidateIdentityAllocator',
  'retirementActionManualReview',
]
for (const moduleName of canonicalActionDeepImports) {
  const moduleApi = await import('@retiregolden/engine/actions/' + moduleName)
  assert.ok(
    Object.keys(moduleApi).length > 0,
    'canonical public action deep import must resolve: ' + moduleName,
  )
}
// Pruned in 0.3.0. Each of these resolved as its own subpath in 0.2.x and
// must not resolve now: the ./actions/* null blocker is the whole
// enforcement, and a name accidentally left in the export map would keep
// resolving with nothing to notice it.
const prunedActionDeepImports = [
  'annualHsaOpeningAuthority',
  'annualHsaPenaltyEvaluation',
  'annualHsaPhysicalMovementCandidate',
  'annualHsaReimbursementLedger',
  'annualHsaTreatmentBindingCoordinator',
  'annualHsaWithdrawalCharacter',
  'annualIraBasisAllocation',
  'annualOwnedNonRothIraPoolCapacity',
  'annualQcdPhysicalExecution',
  'annualQcdResidualForm8606',
  'annualQcdTaxCharacterPostPass',
  'annualRetirementActionMovementCoordinator',
  'annualRetirementActionPublication',
  'annualRetirementPhysicalEventInventory',
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
  'rothConversionExecution',
  'taxableWithdrawalCharacter',
  'traditionalEmployerPlanPenaltyPrerequisite',
]
for (const moduleName of prunedActionDeepImports) {
  await assert.rejects(
    import('@retiregolden/engine/actions/' + moduleName),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    'pruned action subpath must not resolve: ' + moduleName,
  )
}
const {
  addUsdCents,
  asActionId,
  asAccountId,
  asAllocationId,
  asPersonId,
  asPlanId,
  asPositiveUsdCents,
  asUsdCents,
  allocateRetirementActionCandidateIdentity,
  buildAnnualOwnedNonRothIraPoolCapacity,
  evaluateAnnualQcdExecutionPrerequisites,
  stageAnnualQcdPhysicalExecution,
  stageAnnualQcdResidualForm8606,
  stageAnnualQcdTaxCharacterPostPass,
  buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence,
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
  buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  buildOwnedNonRothIraStagedDistributionDateEvidenceId,
  buildAnnualRetirementPhysicalEventInventory,
  buildPlanOwnedNonRothIraAnnualFilingEvidence,
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  classifyOwnedNonRothIraAnnualWithdrawals,
  classifyIndividuallyOwnedTaxableWithdrawal,
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
  coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  assessConversionLinkedWithdrawalGroups,
  buildConversionTaxFundingAnnualGroupEvidence,
  executeCashOrdinaryWithdrawals,
  executeConversionLinkedWithdrawalGroups,
  executeOrdinaryWithdrawals,
  executeRothConversions,
  ledgerCentsToPlanDollars,
  mergedRetirementActionSchedule,
  parseConversionTaxFundingAnnualGroup,
  parseRetirementActionRequest,
  planDollarsToLedgerCents,
  preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  rothConversionPublicationEligibility,
  rothConversionPublicationSource,
  resolveOwnedNonRothIraAnnualWithdrawalEvidence,
  resolvePlanOwnedNonRothIraAnnualFilingSources,
  reviewAndReplaceRetirementActionManually,
  reconcileOwnedNonRothIraSeppAnnualSchedule,
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  validateOwnedNonRothIraSeppCurrentPaymentCandidate,
} = actionsApi
assert.equal(typeof executeRothConversions, 'function')
// The conversion-linked withdrawal group surface, reachable from the packed
// artifact. It is published through the ./actions barrel rather than as its
// own subpath, so this is the assertion that it is reachable at all — and the
// round trip below is the assertion that the evidence contract travelled with
// it rather than only the function that builds from it.
assert.equal(typeof executeConversionLinkedWithdrawalGroups, 'function')
assert.equal(typeof assessConversionLinkedWithdrawalGroups, 'function')
assert.equal(typeof mergedRetirementActionSchedule, 'function')
assert.equal(typeof buildConversionTaxFundingAnnualGroupEvidence, 'function')
assert.equal(typeof parseConversionTaxFundingAnnualGroup, 'function')
{
  const built = buildConversionTaxFundingAnnualGroupEvidence({
    taxUnit: {
      taxUnitId: 'pack-smoke-unit',
      taxYear: 2030,
      federalFilingStatus: 'single',
      stateFilingStatusId: 'pack-smoke-state',
      taxUnitEvidenceId: 'pack-smoke-unit-evidence',
      taxUnitMemberPersonIds: ['p1'],
    },
    baselineAnnualTaxLiabilityEvidenceId: 'pack-smoke-baseline',
    candidateAnnualTaxLiabilityEvidenceId: 'pack-smoke-candidate',
    baselineAnnualTaxLiability: {
      representation: 'exactRationalMinorUnits',
      numeratorMinorUnits: 1_000,
      denominator: 1,
      intermediateArithmetic: 'bigintRational',
    },
    candidateAnnualTaxLiability: {
      representation: 'exactRationalMinorUnits',
      numeratorMinorUnits: 1_500,
      denominator: 1,
      intermediateArithmetic: 'bigintRational',
    },
    members: [{
      conversionActionId: 'pack-smoke-conversion',
      conversionPersonId: 'p1',
      allocationWeight: 10_000,
      fundedAmount: 500,
    }],
  })
  assert.equal(built.ok, true)
  assert.equal(built.members[0].evaluation, 'satisfied')
  assert.equal(built.members[0].requiredFundingAmount, 500)
  assert.equal(
    parseConversionTaxFundingAnnualGroup(
      JSON.parse(JSON.stringify(built.members)),
    ).ok,
    true,
  )
}
assert.equal(typeof rothConversionPublicationEligibility, 'function')
assert.equal(typeof rothConversionPublicationSource, 'function')
assert.equal(
  candidateIdentityAllocatorDeepApi.allocateRetirementActionCandidateIdentity,
  allocateRetirementActionCandidateIdentity,
)
assert.equal(typeof allocateRetirementActionCandidateIdentity, 'function')
assert.equal(
  annualQcdPrerequisiteDeepApi.evaluateAnnualQcdExecutionPrerequisites,
  evaluateAnnualQcdExecutionPrerequisites,
)
assert.equal(typeof evaluateAnnualQcdExecutionPrerequisites, 'function')
assert.equal(typeof reviewAndReplaceRetirementActionManually, 'function')
// Barrel-only from 0.3.0 on. Their own subpaths were pruned, so a typeof
// through ./actions is now the whole reachability claim for each.
assert.equal(typeof buildAnnualOwnedNonRothIraPoolCapacity, 'function')
assert.equal(typeof stageAnnualQcdPhysicalExecution, 'function')
assert.equal(typeof stageAnnualQcdResidualForm8606, 'function')
assert.equal(typeof stageAnnualQcdTaxCharacterPostPass, 'function')
assert.equal(typeof buildPlanOwnedNonRothIraAnnualFilingEvidence, 'function')
assert.equal(typeof resolvePlanOwnedNonRothIraAnnualFilingSources, 'function')
assert.equal(
  typeof buildOwnedNonRothIraStagedDistributionDateEvidenceId,
  'function',
)
assert.equal(
  typeof coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
  'function',
)
assert.equal(typeof buildAnnualRetirementPhysicalEventInventory, 'function')
assert.equal(
  typeof buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  'function',
)
assert.equal(
  ordinaryWithdrawalCandidateAdapterDeepApi
    .adaptOrdinaryWithdrawalGeneratorCandidate,
  decisionsApi.adaptOrdinaryWithdrawalGeneratorCandidate,
)
assert.equal(
  typeof decisionsApi.adaptOrdinaryWithdrawalGeneratorCandidate,
  'function',
)
assert.equal(
  rothConversionCandidateAdapterDeepApi
    .adaptFillTargetRothConversionGeneratorCandidate,
  decisionsApi.adaptFillTargetRothConversionGeneratorCandidate,
)
assert.equal(
  typeof preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  'function',
)
const moneyDeepApi = await import('@retiregolden/engine/actions/money')
const {
  evaluateRetirementActionEligibility,
} = await import('@retiregolden/engine/strategies/accountEligibility')
const simulate = await import('@retiregolden/engine/projection/simulate')
const { singlePersonPlan, cashAccount, productionTaxCalculator, runPlan } = await import(
  '@retiregolden/engine/testing/planFixtures'
)
// decisionFixtures.ts moved from src/decisions/ to src/testing/ in 0.3.0 (see
// CHANGELOG "One subpath added: ./testing/decisionFixtures"); this proves the
// relocated file is actually packed and reachable at the new subpath, and
// that the old ./decisions/decisionFixtures path -- which the ./decisions/*
// wildcard would otherwise still nominally match against a file the tarball
// no longer contains -- is refused by name instead of failing later with a
// bare module-not-found.
const { assetLocationPlan: packedAssetLocationPlan } = await import(
  '@retiregolden/engine/testing/decisionFixtures'
)
assert.equal(typeof packedAssetLocationPlan, 'function')
await assert.rejects(
  import('@retiregolden/engine/decisions/decisionFixtures'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'relocated decisions/decisionFixtures path must not resolve',
)

// The current-only schema subpath (the MCP's plan-format source), each explicit
// version subpath, the legacy compatibility barrel, and the offline JSON
// artifact must all resolve from the installed tarball. Read the JSON via
// createRequire + fs — not an import attribute — so the smoke test reads the
// installed artifact through a path supported by the package's Node >=24 floor.
// JSON path is derived from PLAN_SCHEMA_VERSION so a future schema-version bump
// retargets it automatically.
const currentSchemaApi = await import('@retiregolden/engine/schema/current')
const { planJsonSchema, PLAN_SCHEMA_VERSION } = currentSchemaApi
assert.deepEqual(
  Object.keys(currentSchemaApi).sort(),
  [
    'PLAN_SCHEMA_ID',
    'PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS',
    'PLAN_SCHEMA_VERSION',
    'planJsonSchema',
  ].sort(),
  'schema/current must resolve through the package export map to the current-only namespace',
)
const schemaV1Api = await import('@retiregolden/engine/schema/v1')
const schemaV2Api = await import('@retiregolden/engine/schema/v2')
const schemaV3Api = await import('@retiregolden/engine/schema/v3')
const schemaV4Api = await import('@retiregolden/engine/schema/v4')
const schemaV5Api = await import('@retiregolden/engine/schema/v5')
const legacySchemaApi = await import('@retiregolden/engine/schema')
const requireFromSmoke = createRequire(import.meta.url)
const shippedPath = requireFromSmoke.resolve(
  '@retiregolden/engine/schema/plan.v' + PLAN_SCHEMA_VERSION + '.json',
)
const shippedSchema = JSON.parse(readFileSync(shippedPath, 'utf8'))

assert.equal(typeof simulatePlan, 'function')
assert.equal(typeof scenarioActionRowsDeepApi.normalizeScenarioActionRows, 'function')
assert.equal(typeof scenarioActionRowsDeepApi.compareScenarioActionRows, 'function')
assert.equal(typeof scenarioActionRowsDeepApi.normalizeScenarioActionScheduleDiagnostics, 'function')
assert.equal(
  qcdCandidateAdapterDeepApi.adaptQcdEfficiencyDetectorCandidate,
  decisionsApi.adaptQcdEfficiencyDetectorCandidate,
)
assert.equal(simulate.simulatePlan, simulatePlan)
assert.equal(asActionId('smoke-action'), 'smoke-action')
assert.equal(moneyDeepApi.asUsdCents, asUsdCents)
assert.equal(
  typeof buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence,
  'function',
)
assert.equal(
  typeof buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
  'function',
)
assert.equal(
  typeof buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  'function',
)
assert.equal(
  'deriveActionStructuralId' in actionsApi,
  false,
  'the general structural hasher is not part of the public actions barrel',
)
await assert.rejects(
  import('@retiregolden/engine/actions/structuralId'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'the wildcard exports map must not reopen the internal structural hasher',
)
await assert.rejects(
  import('@retiregolden/engine/internal/ownedNonRothIraRuntimeSourceSeries'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'the package-wide deny rule must not publish the simulator-owned source-series seam',
)
await assert.rejects(
  import('@retiregolden/engine/internal/ownedNonRothIraAnnualReplayPublication'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'the package-wide deny rule must not publish the replay publication builder',
)
await assert.rejects(
  import('@retiregolden/engine/projection/internal/ownedNonRothIraRuntimeSourceSeries'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'the projection wildcard must not publish stale internal source-series artifacts',
)
await assert.rejects(
  import('@retiregolden/engine/projection/internal/legacyAggregateDecisionCalculation'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'the projection wildcard must not publish the legacy optimizer calculation capability',
)
for (const alternateCase of [
  '@retiregolden/engine/actions/StructuralId',
  '@retiregolden/engine/actions/STRUCTURALID',
  '@retiregolden/engine/Actions/structuralId',
]) {
  await assert.rejects(
    import(alternateCase),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    'alternate-case internal structural path must remain blocked: ' +
      alternateCase,
  )
}
const deprecatedFlatTax = await import('@retiregolden/engine/projection/flatTax')
const relocatedFlatTax = await import('@retiregolden/engine/testing/flatTax')
assert.equal(
  typeof deprecatedFlatTax.createFlatTaxCalculator,
  'function',
  'the deprecated projection/flatTax subpath must keep resolving for pinned consumers',
)
assert.equal(
  deprecatedFlatTax.createFlatTaxCalculator,
  relocatedFlatTax.createFlatTaxCalculator,
  'the deprecated subpath must re-export the relocated test double, not a copy',
)
assert.equal(addUsdCents(asUsdCents(125), asUsdCents(75)), 200)
assert.equal(planDollarsToLedgerCents(1.005), 101)
assert.equal(ledgerCentsToPlanDollars(asUsdCents(101)), 1.01)
assert.equal(CURRENT_PLAN_SCHEMA_VERSION, 5)
assert.ok(packForYear(2026) && typeof packForYear(2026) === 'object')

assert.equal(PLAN_SCHEMA_VERSION, 5)
assert.equal(planJsonSchema.properties.schemaVersion.const, 5)
assert.ok(String(planJsonSchema.$id).includes('/v' + PLAN_SCHEMA_VERSION + '.json'), 'schema carries a versioned $id')
assert.equal(schemaV1Api.planJsonSchema.properties.schemaVersion.const, 1)
assert.equal(schemaV2Api.planJsonSchema.properties.schemaVersion.const, 2)
assert.equal(schemaV3Api.planJsonSchema.properties.schemaVersion.const, 3)
assert.equal(schemaV4Api.planJsonSchema.properties.schemaVersion.const, 4)
assert.equal(schemaV5Api.planJsonSchema, planJsonSchema)
assert.equal(legacySchemaApi.planJsonSchema, planJsonSchema)
assert.equal(legacySchemaApi.planV1JsonSchema, schemaV1Api.planJsonSchema)
assert.equal(legacySchemaApi.planV2JsonSchema, schemaV2Api.planJsonSchema)
assert.equal(legacySchemaApi.planV3JsonSchema, schemaV3Api.planJsonSchema)
assert.equal(legacySchemaApi.planV4JsonSchema, schemaV4Api.planJsonSchema)
assert.deepEqual(shippedSchema, planJsonSchema, 'offline JSON artifact matches the exported constant')
assert.ok(
  Array.isArray(planJsonSchema['x-retiregolden-unrepresentableConstraints']) &&
    planJsonSchema['x-retiregolden-unrepresentableConstraints'].length > 0,
  'offline schema embeds the machine-readable unrepresentable-constraints catalog',
)
assert.equal(
  parseRetirementActionRequest({
    actionId: 'smoke-action',
    kind: 'legacyAggregateQcd',
    year: 2030,
    requestedAmount: 10_000,
    legacyField: 'qcdAnnual',
    provenance: { source: 'migration' },
  }).ok,
  true,
)

const smokeFilingPlan = singlePersonPlan({ planningAge: 100 })
smokeFilingPlan.id = 'smoke-filing-plan'
smokeFilingPlan.household.people[0].id = 'smoke-filing-owner'
smokeFilingPlan.accounts = [{
  id: 'smoke-filing-ira',
  name: 'Smoke filing IRA',
  type: 'traditional',
  kind: 'ira',
  ownerPersonId: 'smoke-filing-owner',
  annualReturnPct: null,
  balance: 10_000,
  annualContribution: 0,
}]
const smokeFilingSource = {
  predicate: 'completePlanOwnedNonRothIraAnnualFilingSourceRecord',
  planId: asPlanId(smokeFilingPlan.id),
  ownerPersonId: asPersonId('smoke-filing-owner'),
  taxYear: 2030,
  evidenceScope: 'realWorldTaxRecordNotProjection',
  sourceRecordId: 'smoke-filing-record',
  sourceEvidenceId: 'smoke-filing-evidence',
  authority: {
    acquisition: 'manual',
    recordKind: 'filedForm8606',
    sourceId: 'smoke-filing-authority',
    finalizedDate: '2031-04-15',
  },
  reviewedSourceAccountIds: [asAccountId('smoke-filing-ira')],
  openingBasis: {
    asOfDate: '2030-01-01',
    openingBasisAmount: asUsdCents(0),
    sourceEvidenceId: 'smoke-filing-basis',
  },
  rolloverFacts: {
    inventoryStatus: 'completeIncludingExplicitEmpty',
    outstandingRolloverAmount: 0,
    rolloverRepaymentAdjustmentAmount: 0,
    sourceEvidenceId: 'smoke-filing-rollovers',
  },
  nondeductibleContributionFacts: {
    inYearInventoryStatus: 'completeExplicitEmpty',
    inYearContributions: [],
    postYearWindowStatus: 'completeThroughOrdinaryDeadline',
    completedThroughDate: '2031-04-15',
    deadlineAuthority: {
      authoritySourceId: 'smoke-filing-deadline',
      designatedTaxYear: 2030,
      deadlineStatus: 'authoritativeFederalDeadlineEstablished',
      deadlineKind: 'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
      calendarAdjustmentStatus:
        'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
      disasterReliefContributionStatus:
        'noPostOrdinaryDeadlineContributionClaimed',
      deadlineDate: '2031-04-15',
    },
    contributions: [],
  },
}
smokeFilingPlan.retirementActionAnnualTaxFacts = {
  ownedNonRothIraAnnualFilingSourceRecords: [smokeFilingSource],
}
const smokeFilingResolution = resolvePlanOwnedNonRothIraAnnualFilingSources({
  plan: smokeFilingPlan,
})
assert.equal(smokeFilingResolution.status, 'resolved')
assert.equal(smokeFilingResolution.sources[0].sourceOrigin, 'plan')
const smokeFilingEvidence = buildPlanOwnedNonRothIraAnnualFilingEvidence({
  plan: smokeFilingPlan,
  ownerPersonId: 'smoke-filing-owner',
  taxYear: 2030,
  ledgerRunId: 'smoke-filing-ledger',
  knowledgeAsOfDate: '2031-04-15',
  sourceRecord: smokeFilingResolution.sources[0].sourceRecord,
})
assert.equal(smokeFilingEvidence.status, 'annualFilingEvidenceBuilt')

const smokePerson = {
  id: 'smoke-person',
  name: 'Smoke Person',
  dob: '1955-08-31',
  sex: 'average',
  retirementAge: 65,
  longevity: { planningAge: 95, source: 'manual' },
}
const smokeCash = {
  id: 'smoke-cash',
  name: 'Smoke Cash',
  type: 'cash',
  ownerPersonId: 'smoke-person',
  annualReturnPct: null,
  balance: 10_000,
  annualContribution: 0,
}
const smokeWithdrawal = {
  actionId: asActionId('smoke-withdrawal'),
  kind: 'ordinaryWithdrawal',
  personId: asPersonId('smoke-person'),
  year: 2030,
  executionSequence: 1,
  requestedAmount: asUsdCents(100),
  allocations: [{
    allocationId: asAllocationId('smoke-allocation'),
    sourceAccountId: asAccountId('smoke-cash'),
    requestedAmount: asUsdCents(100),
  }],
  purpose: { kind: 'spending' },
  provenance: { source: 'manual' },
}
const smokeEligibilityContext = {
  personAliveEvidence: [{
    evidenceId: 'smoke-alive-evidence',
    actionId: smokeWithdrawal.actionId,
    personId: smokeWithdrawal.personId,
    actionYear: smokeWithdrawal.year,
    actionDate: null,
    alive: true,
  }],
}
assert.equal(
  evaluateRetirementActionEligibility(
    smokeWithdrawal,
    { people: [smokePerson], accounts: [smokeCash] },
    smokeEligibilityContext,
  ).status,
  'accepted',
)
const typedRefusal = evaluateRetirementActionEligibility(
  {
    ...smokeWithdrawal,
    allocations: [{
      ...smokeWithdrawal.allocations[0],
      sourceAccountId: asAccountId('missing-account'),
    }],
  },
  { people: [smokePerson], accounts: [smokeCash] },
  smokeEligibilityContext,
)
assert.equal(typedRefusal.status, 'refused')
assert.equal(typedRefusal.reasons[0].code, 'source-account-not-found')

const smokeExecutionPlan = singlePersonPlan({ planningAge: 100 })
smokeExecutionPlan.household.people = [smokePerson]
smokeExecutionPlan.accounts = [smokeCash]
const smokeExecution = executeCashOrdinaryWithdrawals({
  year: 2030,
  plan: smokeExecutionPlan,
  requests: [smokeWithdrawal],
  openingBalances: [{
    accountId: smokeWithdrawal.allocations[0].sourceAccountId,
    openingBalance: asUsdCents(100),
  }],
  runtimeEvidence: smokeEligibilityContext,
})
assert.equal(smokeExecution.committed, true)
assert.equal(smokeExecution.scheduleIssues.length, 0)
assert.equal(smokeExecution.evidence[0].disposition.executedAmount, 100)
assert.equal(smokeExecution.evidence[0].taxCharacter[0].kind, 'cashPrincipal')
assert.equal(smokeExecution.balances[0].closingBalance, 0)

const taxableCharacter = classifyIndividuallyOwnedTaxableWithdrawal({
  actionId: asActionId('smoke-taxable-withdrawal'),
  allocationId: asAllocationId('smoke-taxable-allocation'),
  sourceAccountId: asAccountId('smoke-taxable'),
  actingPersonId: asPersonId('smoke-person'),
  evaluationDate: '2030-12-31',
  executedAmount: asUsdCents(100),
  preExecutionFairMarketValue: asPositiveUsdCents(200),
  remainingCostBasisBeforeExecution: asUsdCents(100),
  ownership: {
    accountOwnerPersonIds: [asPersonId('smoke-person')],
    accountOwnershipEvidenceId: 'smoke-ownership',
    beneficialOwnershipShare: {
      representation: 'exactRational',
      numerator: 1,
      denominator: 1,
      intermediateArithmetic: 'bigintRational',
    },
    attributionEvidenceId: 'smoke-attribution',
  },
  taxUnit: {
    taxUnitId: 'smoke-tax-unit',
    taxUnitMemberPersonIds: [asPersonId('smoke-person')],
    federalFilingStatus: 'single',
    stateFilingStatusId: 'smoke-state-single',
    taxUnitEvidenceId: 'smoke-tax-unit-evidence',
    taxYear: 2030,
  },
})
assert.equal(taxableCharacter.taxCharacter[0].kind, 'basisReturn')
assert.equal(taxableCharacter.taxCharacter[1].kind, 'capitalGain')

const smokeIraMovementInput = {
  ownerPersonId: asPersonId('smoke-person'),
  taxYear: 2030,
  requests: [{
    actionId: asActionId('smoke-ira-withdrawal'),
    kind: 'ordinaryWithdrawal',
    personId: asPersonId('smoke-person'),
    year: 2030,
    executionDate: '2030-12-31',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(2),
    allocations: [{
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      requestedAmount: asPositiveUsdCents(2),
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }],
  openingBalances: [{
    accountId: asAccountId('smoke-traditional-ira'),
    openingBalance: asUsdCents(2),
  }],
  sourceEvidence: [{
    predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
    sourceAccountId: asAccountId('smoke-traditional-ira'),
    ownerPersonId: asPersonId('smoke-person'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype: 'traditional',
    accountOwnershipEvidenceId: 'smoke-ira-ownership',
    iraClassificationEvidenceId: 'smoke-ira-classification',
  }],
}
const smokeIraMovement =
  stageOwnedNonRothIraOrdinaryWithdrawalMovements(smokeIraMovementInput)
assert.equal(smokeIraMovement.status, 'movementCandidateStaged')
assert.equal(smokeIraMovement.movement, 'notCommitted')
assert.equal(
  smokeIraMovement.candidateBalances[0].candidateClosingBalance,
  0,
)
assert.ok(
  smokeIraMovement.movementCandidateId.startsWith(
    'owned-non-roth-ira-movement-candidate:',
  ),
)

const ownedIraCharacter = classifyOwnedNonRothIraAnnualWithdrawals({
  ownerPersonId: asPersonId('smoke-person'),
  ownerWideNonRothIraPoolId: 'smoke-owner-ira-pool',
  completePoolEvidence: {
    predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
    ownerPersonId: asPersonId('smoke-person'),
    ownerWideNonRothIraPoolId: 'smoke-owner-ira-pool',
    taxYear: 2030,
    accountIds: [asAccountId('smoke-traditional-ira')],
    yearEndApplicablePoolBalanceAmount: asUsdCents(2),
    evidenceId: 'smoke-complete-ira-pool',
  },
  annualBasisRecordEvidenceId: 'smoke-ira-basis-record',
  taxYear: 2030,
  poolMembers: [{
    sourceAccountId: asAccountId('smoke-traditional-ira'),
    ownerPersonId: asPersonId('smoke-person'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype: 'traditional',
    yearEndApplicableBalanceAmount: asUsdCents(2),
    iraClassificationEvidenceId: 'smoke-ira-classification',
    accountOwnershipEvidenceId: 'smoke-ira-ownership',
  }],
  annualFacts: {
    openingBasisAmount: asUsdCents(2),
    taxYearNondeductibleContributionAmount: asUsdCents(0),
    postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
    yearEndApplicablePoolBalanceAmount: asUsdCents(2),
    outstandingRolloverAmount: asUsdCents(0),
    rolloverRepaymentAdjustmentAmount: asUsdCents(0),
    form8606Line7DistributionAmount: asUsdCents(2),
    form8606Line8NetConversionAmount: asUsdCents(0),
  },
  line7Distributions: smokeIraMovement.line7Distributions,
  line8Conversions: [],
})
assert.equal(ownedIraCharacter.withdrawals[0].basisRecoveredAmount, 1)
assert.equal(ownedIraCharacter.withdrawals[0].ordinaryIncomeAmount, 1)
assert.deepEqual(
  ownedIraCharacter.withdrawals[0].taxCharacter.map((segment) => segment.kind),
  ['basisReturn', 'ordinaryIncome'],
)
const ownedIraPenaltyPrerequisite =
  evaluateOwnedNonRothIraPenaltyPrerequisites({
    characterization: ownedIraCharacter,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('smoke-person'),
      birthDate: '1980-08-31',
      evidenceId: 'smoke-birth-date',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId('smoke-ira-withdrawal'),
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      subtype: 'traditional',
      evaluationDate: '2030-12-31',
      distributionDateEvidenceId: 'smoke-ira-distribution-date',
      accountOwnershipEvidenceId: 'smoke-ira-ownership',
      iraClassificationEvidenceId: 'smoke-ira-classification',
    }],
    qualifiedDisabilityEvidence: [{
      kind: 'disability',
      disabledPersonId: asPersonId('smoke-person'),
      disabilityQualificationDate: '2030-12-31',
      evaluationDate: '2030-12-31',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'smoke-disability-record',
    }],
    simpleParticipationEvidence: [],
  })
assert.equal(
  ownedIraPenaltyPrerequisite.evaluations[0].outcome,
  'disabilityQualified',
)
assert.equal(
  ownedIraPenaltyPrerequisite.evaluations[0]
    .characterCoverage.ordinaryIncomeExposureAmount,
  1,
)
const smokeSeppCoverage = ownedIraPenaltyPrerequisite.coverage[0]
const smokeSeppOpeningLineage = {
  predicate: 'ownedNonRothIraSeppAnnualOpeningState',
  electionId: 'smoke-sepp-election',
  scheduleId: 'smoke-sepp-schedule',
  participantPersonId: asPersonId('smoke-person'),
  sourceAccountId: asAccountId('smoke-traditional-ira'),
  taxYear: 2030,
  priorHistoryTerminalStateId: 'smoke-prior-year-terminal',
  nextScheduledSequence: 1,
  scheduledGrossAmount: 0,
  actualQualifyingGrossAmount: 0,
}
const smokeSeppOpening = {
  ...smokeSeppOpeningLineage,
  openingStateEvidenceId:
    'owned-ira-sepp-annual-opening-state:' +
    JSON.stringify([smokeSeppOpeningLineage]),
}
const smokeSeppHistoryWithoutId = {
  predicate: 'ownedNonRothIraSeppPriorPaymentHistory',
  electionId: 'smoke-sepp-election',
  scheduleId: 'smoke-sepp-schedule',
  participantPersonId: asPersonId('smoke-person'),
  sourceAccountId: asAccountId('smoke-traditional-ira'),
  taxYear: 2030,
  openingStateEvidenceId: smokeSeppOpening.openingStateEvidenceId,
  completedPaymentCount: 0,
  usedCurrentDistributionEvidenceIds: [],
  lastCompletedSequence: 0,
  lastPaymentDate: null,
  terminalStateEvidenceId: smokeSeppOpening.openingStateEvidenceId,
  scheduledGrossAmountThroughPriorPayments: 0,
  actualQualifyingGrossAmountThroughPriorPayments: 0,
  nextScheduledSequence: 1,
}
const smokeSeppHistory =
  buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence(
    smokeSeppHistoryWithoutId,
  )
const smokeSeppCandidate =
  validateOwnedNonRothIraSeppCurrentPaymentCandidate({
    ownerPersonId: asPersonId('smoke-person'),
    taxYear: 2030,
    actionId: asActionId('smoke-ira-withdrawal'),
    allocationId: asAllocationId('smoke-ira-allocation'),
    characterCoverage: smokeSeppCoverage,
    sourceEvidence: {
      predicate: 'ownedNonRothIraSeppSource',
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: 'traditional',
      accountOwnershipEvidenceId: 'smoke-ira-ownership',
      iraClassificationEvidenceId: 'smoke-ira-classification',
      sourceEvidenceId: 'smoke-sepp-source',
    },
    electionEvidence: {
      predicate: 'ownedNonRothIraSeppElection',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      participantPersonId: asPersonId('smoke-person'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      subtype: 'traditional',
      electionStartDate: '2030-01-01',
      method: 'fixedAmortization',
      electionEvidenceId: 'smoke-sepp-election-evidence',
    },
    annualScheduleEvidence: {
      predicate: 'ownedNonRothIraSeppAnnualSchedule',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      participantPersonId: asPersonId('smoke-person'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      taxYear: 2030,
      annualScheduledGrossAmount: 2,
      annualScheduleEvidenceId: 'smoke-sepp-annual',
    },
    noModificationEvidence: {
      predicate:
        'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      participantPersonId: asPersonId('smoke-person'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      throughDate: '2030-12-31',
      disqualifyingModification: 'none',
      noModificationEvidenceId: 'smoke-sepp-no-modification',
    },
    openingStateEvidence: smokeSeppOpening,
    priorHistoryEvidence: smokeSeppHistory,
    currentPaymentEvidence: {
      predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      actionId: asActionId('smoke-ira-withdrawal'),
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      distributionDate: '2030-12-31',
      currentDistributionEvidenceId: 'smoke-ira-distribution-date',
      paymentSequence: 1,
      previousScheduleStateId: smokeSeppOpening.openingStateEvidenceId,
      currentScheduledGrossAmount: 2,
      paymentScheduleEvidenceId: 'smoke-sepp-payment-schedule',
    },
  })
assert.equal(smokeSeppCandidate.status, 'provisionalCandidate')
assert.equal(smokeSeppCandidate.qualification, 'pendingAnnualReconciliation')
assert.equal(smokeSeppCandidate.penaltyTreatment, 'notEstablished')
assert.equal(smokeSeppCandidate.candidate.actualGrossAmount, 2)
assert.equal(smokeSeppCandidate.candidate.basisReturnExcludedAmount, 1)
assert.equal(smokeSeppCandidate.candidate.prospectiveOrdinaryIncomeAmount, 1)
assert.equal(smokeSeppCandidate.candidate.sourceEvidenceId, 'smoke-sepp-source')
assert.match(
  smokeSeppCandidate.candidate.afterState.stateEvidenceId,
  /^owned-ira-sepp-current-payment-after:[0-9a-f]{64}$/,
)
assert.match(
  smokeSeppCandidate.candidate.candidateId,
  /^owned-ira-sepp-current-payment-candidate:[0-9a-f]{64}$/,
)
const smokeSeppPriorElectionHistoryWithoutId = {
  predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
  electionId: 'smoke-sepp-election',
  scheduleId: 'smoke-sepp-schedule',
  participantPersonId: asPersonId('smoke-person'),
  sourceAccountId: asAccountId('smoke-traditional-ira'),
  historyThroughDate: '2029-12-31',
  terminalStateEvidenceId: 'smoke-prior-year-terminal',
  usedDistributionEvidenceIds: ['smoke-prior-lifetime-distribution'],
}
const smokeSeppPriorElectionHistory =
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence(
    smokeSeppPriorElectionHistoryWithoutId,
  )
const smokeSeppInventoryWithoutId = {
  predicate: 'completeOwnedNonRothIraSeppAnnualDistributionInventory',
  electionId: 'smoke-sepp-election',
  scheduleId: 'smoke-sepp-schedule',
  participantPersonId: asPersonId('smoke-person'),
  sourceAccountId: asAccountId('smoke-traditional-ira'),
  taxYear: 2030,
  characterCoverages: [smokeSeppCoverage],
}
const smokeSeppInventory =
  buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence(
    smokeSeppInventoryWithoutId,
  )
const smokeSeppAnnualRawRouteInput = {
    sourceEvidence: {
      predicate: 'ownedNonRothIraSeppSource',
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: 'traditional',
      accountOwnershipEvidenceId: 'smoke-ira-ownership',
      iraClassificationEvidenceId: 'smoke-ira-classification',
      sourceEvidenceId: 'smoke-sepp-source',
    },
    electionEvidence: {
      predicate: 'ownedNonRothIraSeppElection',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      participantPersonId: asPersonId('smoke-person'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      subtype: 'traditional',
      electionStartDate: '2029-01-01',
      method: 'fixedAmortization',
      electionEvidenceId: 'smoke-sepp-election-evidence',
    },
    annualScheduleEvidence: {
      predicate: 'ownedNonRothIraSeppAnnualSchedule',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      participantPersonId: asPersonId('smoke-person'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      taxYear: 2030,
      annualScheduledGrossAmount: 2,
      annualScheduleEvidenceId: 'smoke-sepp-annual',
    },
    noModificationEvidence: {
      predicate: 'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      participantPersonId: asPersonId('smoke-person'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      throughDate: '2030-12-31',
      disqualifyingModification: 'none',
      noModificationEvidenceId: 'smoke-sepp-no-modification',
    },
    openingStateEvidence: smokeSeppOpening,
    priorElectionHistoryEvidence: smokeSeppPriorElectionHistory,
    payments: [{
      currentPaymentEvidence: {
        predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
        electionId: 'smoke-sepp-election',
        scheduleId: 'smoke-sepp-schedule',
        actionId: asActionId('smoke-ira-withdrawal'),
        allocationId: asAllocationId('smoke-ira-allocation'),
        sourceAccountId: asAccountId('smoke-traditional-ira'),
        distributionDate: '2030-12-31',
        currentDistributionEvidenceId: 'smoke-ira-distribution-date',
        paymentSequence: 1,
        previousScheduleStateId: smokeSeppOpening.openingStateEvidenceId,
        currentScheduledGrossAmount: 2,
        paymentScheduleEvidenceId: 'smoke-sepp-payment-schedule',
      },
    }],
  }
const smokeSeppAnnualReconciliation =
  reconcileOwnedNonRothIraSeppAnnualSchedule({
    ownerPersonId: asPersonId('smoke-person'),
    taxYear: 2030,
    ...smokeSeppAnnualRawRouteInput,
    distributionInventory: smokeSeppInventory,
  })
assert.equal(smokeSeppAnnualReconciliation.status, 'reconciled')
assert.equal(smokeSeppAnnualReconciliation.qualification, 'notEstablished')
assert.equal(smokeSeppAnnualReconciliation.penaltyTreatment, 'notEstablished')
assert.equal(smokeSeppAnnualReconciliation.evidence.paymentCount, 1)
assert.equal(smokeSeppAnnualReconciliation.evidence.reconciledActualGrossAmount, 2)
assert.equal(smokeSeppAnnualReconciliation.evidence.basisReturnExcludedAmount, 1)
assert.equal(smokeSeppAnnualReconciliation.evidence.prospectiveOrdinaryIncomeAmount, 1)
assert.match(
  smokeSeppAnnualReconciliation.evidence.distributionInventory.inventoryEvidenceId,
  /^owned-ira-sepp-annual-distribution-inventory:[0-9a-f]{64}$/,
)
assert.match(
  smokeSeppAnnualReconciliation.evidence.annualReconciliationId,
  /^owned-ira-sepp-annual-reconciliation:[0-9a-f]{64}$/,
)
assert.equal('penaltyRate' in smokeSeppAnnualReconciliation, false)
assert.equal('penaltyAmount' in smokeSeppAnnualReconciliation, false)
const smokeSeppQualifiedPenalty =
  evaluateOwnedNonRothIraPenaltyPrerequisites({
    characterization: ownedIraCharacter,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('smoke-person'),
      birthDate: '1980-08-31',
      evidenceId: 'smoke-birth-date',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId('smoke-ira-withdrawal'),
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      subtype: 'traditional',
      evaluationDate: '2030-12-31',
      distributionDateEvidenceId: 'smoke-ira-distribution-date',
      accountOwnershipEvidenceId: 'smoke-ira-ownership',
      iraClassificationEvidenceId: 'smoke-ira-classification',
    }],
    iraSeppScheduleRoutes: [{
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      annualReconciliationInput: smokeSeppAnnualRawRouteInput,
    }],
    simpleParticipationEvidence: [],
  })
assert.equal(
  smokeSeppQualifiedPenalty.iraSeppScheduleReconciliations[0]
    .reconciliation.status,
  'reconciled',
)
assert.equal(
  smokeSeppQualifiedPenalty.evaluations[0].outcome,
  'iraSeppQualified',
)
assert.equal(smokeSeppQualifiedPenalty.evaluations[0].finalPenaltyAmount, 0)
assert.match(
  smokeSeppQualifiedPenalty.evaluations[0].finalEvidenceId,
  /^owned-ira-sepp-qualified-zero-penalty:/,
)
const smokeAnnualBasis = ownedIraCharacter.annualBasisEvidence
const smokeAnnualFinalizerInput = {
  annualInput: {
    ownerPersonId: smokeAnnualBasis.ownerPersonId,
    ownerWideNonRothIraPoolId: smokeAnnualBasis.ownerWideNonRothIraPoolId,
    completePoolEvidence: smokeAnnualBasis.completePoolEvidence,
    annualBasisRecordEvidenceId:
      smokeAnnualBasis.annualBasisRecordEvidenceId,
    taxYear: smokeAnnualBasis.taxYear,
    poolMembers: smokeAnnualBasis.poolMembers,
    annualFacts: {
      openingBasisAmount: smokeAnnualBasis.openingBasisAmount,
      taxYearNondeductibleContributionAmount:
        smokeAnnualBasis.taxYearNondeductibleContributionAmount,
      postYearNondeductibleContributionExcludedAmount:
        smokeAnnualBasis.postYearNondeductibleContributionExcludedAmount,
      yearEndApplicablePoolBalanceAmount:
        smokeAnnualBasis.yearEndApplicablePoolBalanceAmount,
      outstandingRolloverAmount: smokeAnnualBasis.outstandingRolloverAmount,
      rolloverRepaymentAdjustmentAmount:
        smokeAnnualBasis.rolloverRepaymentAdjustmentAmount,
      form8606Line7DistributionAmount:
        smokeAnnualBasis.form8606Line7DistributionAmount,
      form8606Line8NetConversionAmount:
        smokeAnnualBasis.form8606Line8NetConversionAmount,
    },
    line8Conversions:
      ownedIraCharacter.line8AllocationEvidence.allocations.map((entry) => ({
        actionId: entry.actionId,
        allocationId: entry.allocationId,
        sourceAccountId: entry.sourceAccountId,
        scheduledDate: entry.scheduledDate,
        scheduledSequence: entry.scheduledSequence,
        grossAmount: entry.grossAmount,
      })),
  },
  stagedExecutedWithdrawals:
    ownedIraCharacter.line7AllocationEvidence.allocations.map((entry) => ({
      actionId: entry.actionId,
      allocationId: entry.allocationId,
      sourceAccountId: entry.sourceAccountId,
      scheduledDate: entry.scheduledDate,
      scheduledSequence: entry.scheduledSequence,
      grossAmount: entry.grossAmount,
    })),
  ownerEvidence: {
    predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
    ownerPersonId: asPersonId('smoke-person'),
    birthDate: '1980-08-31',
    evidenceId: 'smoke-birth-date',
  },
  sourceEvidence: [{
    predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
    actionId: asActionId('smoke-ira-withdrawal'),
    allocationId: asAllocationId('smoke-ira-allocation'),
    sourceAccountId: asAccountId('smoke-traditional-ira'),
    ownerPersonId: asPersonId('smoke-person'),
    subtype: 'traditional',
    evaluationDate: '2030-12-31',
    distributionDateEvidenceId: 'smoke-ira-distribution-date',
    accountOwnershipEvidenceId: 'smoke-ira-ownership',
    iraClassificationEvidenceId: 'smoke-ira-classification',
  }],
  qualifiedDisabilityEvidence: [{
    kind: 'disability',
    disabledPersonId: asPersonId('smoke-person'),
    disabilityQualificationDate: '2030-12-31',
    evaluationDate: '2030-12-31',
    qualifiedOnEvaluationDate: true,
    disabilityEvidenceId: 'smoke-disability-record',
  }],
  simpleParticipationEvidence: [],
}
const resolvedOwnedIraAnnual =
  resolveOwnedNonRothIraAnnualWithdrawalEvidence(
    smokeAnnualFinalizerInput,
  )
assert.equal(resolvedOwnedIraAnnual.status, 'annualEvidenceResolved')
assert.equal(resolvedOwnedIraAnnual.movement, 'notCommitted')
assert.equal(
  resolvedOwnedIraAnnual.annualEvidence.predicate,
  'completeOwnedNonRothIraAnnualWithdrawalFinalizationForOwnerAndTaxYear',
)
const blockedOwnedIraAnnual =
  resolveOwnedNonRothIraAnnualWithdrawalEvidence({
    ...smokeAnnualFinalizerInput,
    qualifiedDisabilityEvidence: [],
  })
assert.equal(blockedOwnedIraAnnual.status, 'penaltyEvidenceMissing')
assert.equal(blockedOwnedIraAnnual.annualEvidence, null)
assert.equal(
  blockedOwnedIraAnnual.issues[0].reason.code,
  'withdrawal-penalty-evidence-missing',
)
const boundOwnedIraAnnualCandidate =
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: smokeIraMovementInput,
    annualInput: smokeAnnualFinalizerInput.annualInput,
    ownerEvidence: smokeAnnualFinalizerInput.ownerEvidence,
    qualifiedDisabilityEvidence:
      smokeAnnualFinalizerInput.qualifiedDisabilityEvidence,
    simpleParticipationEvidence: [],
  })
assert.equal(boundOwnedIraAnnualCandidate.status, 'annualEvidenceBound')
assert.equal(boundOwnedIraAnnualCandidate.movement, 'notCommitted')
assert.equal(
  boundOwnedIraAnnualCandidate.actionability,
  'notEstablished',
)
assert.equal(
  boundOwnedIraAnnualCandidate.bindingEvidence.movementCandidateId,
  boundOwnedIraAnnualCandidate.movementCandidate.movementCandidateId,
)
assert.equal(
  boundOwnedIraAnnualCandidate.bindingEvidence.finalizationEvidenceId,
  boundOwnedIraAnnualCandidate.annualEvidence.finalizationEvidenceId,
)
assert.equal(
  boundOwnedIraAnnualCandidate.bindingEvidence.line7AllocationEvidenceId,
  boundOwnedIraAnnualCandidate.annualEvidence.characterization
    .line7AllocationEvidence.allocationEvidenceId,
)
const smokeCoordinatorDistributionDateEvidenceId =
  buildOwnedNonRothIraStagedDistributionDateEvidenceId({
    movementCandidateId: smokeIraMovement.movementCandidateId,
    actionId: asActionId('smoke-ira-withdrawal'),
    allocationId: asAllocationId('smoke-ira-allocation'),
    sourceAccountId: asAccountId('smoke-traditional-ira'),
    executionDate: '2030-12-31',
  })
const smokeSeppBoundCoordinator =
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: smokeIraMovementInput,
    annualInput: smokeAnnualFinalizerInput.annualInput,
    ownerEvidence: smokeAnnualFinalizerInput.ownerEvidence,
    iraSeppScheduleRoutes: [{
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      electionId: 'smoke-sepp-election',
      scheduleId: 'smoke-sepp-schedule',
      annualReconciliationInput: {
        ...smokeSeppAnnualRawRouteInput,
        payments: [{
          currentPaymentEvidence: {
            ...smokeSeppAnnualRawRouteInput.payments[0]
              .currentPaymentEvidence,
            currentDistributionEvidenceId:
              smokeCoordinatorDistributionDateEvidenceId,
          },
        }],
      },
    }],
    simpleParticipationEvidence: [],
  })
assert.equal(smokeSeppBoundCoordinator.status, 'annualEvidenceBound')
assert.equal(
  smokeSeppBoundCoordinator.annualEvidence.penaltyPrerequisites
    .iraSeppScheduleReconciliations[0].reconciliation.status,
  'reconciled',
)
assert.equal(
  smokeSeppBoundCoordinator.annualEvidence.penaltyPrerequisites
    .evaluations[0].outcome,
  'iraSeppQualified',
)
assert.equal(
  smokeSeppBoundCoordinator.annualEvidence.penaltyPrerequisites
    .evaluations[0].finalPenaltyAmount,
  0,
)
const penaltyOwnedIraAnnualCandidate =
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: smokeIraMovementInput,
    annualInput: smokeAnnualFinalizerInput.annualInput,
    ownerEvidence: smokeAnnualFinalizerInput.ownerEvidence,
    qualifiedDisabilityEvidence: [],
    rejectedDisabilityEvidence: [{
      kind: 'disability',
      disabledPersonId: asPersonId('smoke-person'),
      disabilityQualificationDate: null,
      evaluationDate: '2030-12-31',
      qualifiedOnEvaluationDate: false,
      disabilityEvidenceId: 'smoke-rejected-disability',
    }],
    ownerAliveEvidence: [{
      predicate: 'ownerAliveOnOwnedIraDistributionDate',
      actionId: asActionId('smoke-ira-withdrawal'),
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      evaluationDate: '2030-12-31',
      aliveOnEvaluationDate: true,
      ownerAliveEvidenceId: 'smoke-owner-alive',
    }],
    iraSeppStatusEvidence: [{
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
      actionId: asActionId('smoke-ira-withdrawal'),
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      evaluationDate: '2030-12-31',
      status: 'none',
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: 'smoke-no-sepp',
    }],
    noOtherExceptionAttestations: [{
      predicate: 'noOtherStatutoryExceptionClaimed',
      actionId: asActionId('smoke-ira-withdrawal'),
      allocationId: asAllocationId('smoke-ira-allocation'),
      sourceAccountId: asAccountId('smoke-traditional-ira'),
      ownerPersonId: asPersonId('smoke-person'),
      evaluationDate: '2030-12-31',
      attested: true,
      evidenceScope:
        'planningEvidenceNotFilingGradeLegalAdjudication',
      attestationEvidenceId: 'smoke-no-other-exception',
    }],
    simpleParticipationEvidence: [],
  })
assert.equal(penaltyOwnedIraAnnualCandidate.status, 'annualEvidenceBound')
assert.equal(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].outcome,
  'penaltyApplies',
)
assert.equal(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].finalPenaltyAmount,
  0,
)
assert.equal(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].rateBucketEvidence
    .aggregateOrdinaryIncomeExposureAmount,
  1,
)
assert.equal(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].rateBucketEvidence
    .aggregatePenaltyAmount,
  0,
)
assert.equal(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].rateBucketEvidence
    .members[0].allocatedPenaltyAmount,
  0,
)
assert.match(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].rateBucketEvidence
    .members[0].penaltyApplicabilityEvidenceId,
  /^owned-ira-penalty-applicability:/,
)
assert.deepEqual(
  penaltyOwnedIraAnnualCandidate.annualEvidence
    .penaltyPrerequisites.evaluations[0].rejectedExceptions.map(
      (exception) => exception.exception,
    ),
  ['age59Half', 'death', 'iraSepp', 'disability', 'otherStatutoryException'],
)

const smokeTaxable = {
  id: 'smoke-taxable',
  name: 'Smoke Taxable',
  type: 'taxable',
  ownerPersonId: 'smoke-person',
  annualReturnPct: null,
  balance: 2,
  costBasis: 1,
  annualContribution: 0,
}
const smokeTaxablePlan = singlePersonPlan({ planningAge: 100 })
smokeTaxablePlan.household.people = [smokePerson]
smokeTaxablePlan.accounts = [smokeTaxable]
const smokeTaxableWithdrawal = {
  ...smokeWithdrawal,
  actionId: asActionId('smoke-taxable-execution'),
  allocations: [{
    allocationId: asAllocationId('smoke-taxable-execution-allocation'),
    sourceAccountId: asAccountId('smoke-taxable'),
    requestedAmount: asUsdCents(100),
  }],
}
const smokeTaxableExecution = executeOrdinaryWithdrawals({
  year: 2030,
  plan: smokeTaxablePlan,
  requests: [smokeTaxableWithdrawal],
  openingBalances: [{
    accountId: asAccountId('smoke-taxable'),
    openingBalance: asUsdCents(200),
  }],
  taxableAccountSnapshots: [{
    accountId: asAccountId('smoke-taxable'),
    openingCostBasis: asUsdCents(100),
    ownership: {
      accountOwnerPersonIds: [asPersonId('smoke-person')],
      accountOwnershipEvidenceId: 'smoke-execution-ownership',
      beneficialOwnershipShare: {
        representation: 'exactRational',
        numerator: 1,
        denominator: 1,
        intermediateArithmetic: 'bigintRational',
      },
      attributionEvidenceId: 'smoke-execution-attribution',
    },
    taxUnit: {
      taxUnitId: 'smoke-execution-tax-unit',
      taxUnitMemberPersonIds: [asPersonId('smoke-person')],
      federalFilingStatus: 'single',
      stateFilingStatusId: 'smoke-execution-state-single',
      taxUnitEvidenceId: 'smoke-execution-tax-unit-evidence',
      taxYear: 2030,
    },
  }],
  runtimeEvidence: {
    personAliveEvidence: [{
      ...smokeEligibilityContext.personAliveEvidence[0],
      actionId: smokeTaxableWithdrawal.actionId,
    }],
  },
})
assert.equal(smokeTaxableExecution.evidence[0].disposition.executedAmount, 100)
assert.equal(smokeTaxableExecution.evidence[0].taxCharacter[0].actionId, 'smoke-taxable-execution')
assert.equal(smokeTaxableExecution.balances[0].closingBalance, 100)
assert.equal(smokeTaxableExecution.taxableBases[0].closingCostBasis, 50)

const plan = singlePersonPlan({ planningAge: 90 })
plan.accounts = [cashAccount('cash', 500_000)]
plan.expenses.baseAnnual = 40_000
const result = runPlan(planSchema.parse(plan), productionTaxCalculator(), 2026)

assert.ok(Array.isArray(result.years) && result.years.length > 10, 'projection produced a multi-year ledger')
assert.equal(result.years[0].year, 2026)
assert.ok(Number.isFinite(result.endingNetWorth), 'ending net worth is a number')

const replayPlan = singlePersonPlan({ planningAge: 90 })
replayPlan.id = 'packed-replay-publication'
replayPlan.accounts = [{
  id: 'packed-replay-ira',
  name: 'Packed replay IRA',
  type: 'traditional',
  ownerPersonId: 'p1',
  kind: 'ira',
  balance: 100,
  annualReturnPct: 0,
  annualContribution: 0,
  nondeductibleBasis: 20,
}]
const replayResult = runPlan(
  planSchema.parse(replayPlan),
  productionTaxCalculator(),
  2026,
)
assert.equal(
  replayResult.years[0].ownedNonRothIraAnnualReplay?.status,
  'committedOwnedNonRothIraAnnualReplay',
  'packed root result must expose committed annual replay publication',
)

console.log(
  'pack smoke OK: projected ' + result.years.length + ' years (' + result.years[0].year + '-' +
    result.years.at(-1).year + ') from the packed artifact in plain Node ESM',
)
`

/**
 * A consumer declaring the counterfactual annual-pass option by hand.
 *
 * Every type it names is one `SimulateOptions.annualCounterfactual` puts in
 * front of a caller, and each is defined in a module the exports map refuses —
 * `internal/counterfactualAnnualLiability`, `actions/annualLiabilityRunIdentity`,
 * `actions/conversionTaxFundingEvidence` — so this compiles only because
 * `projection/simulate` republishes them. `noUnusedLocals` is on, which is what
 * keeps the imports from being decoration.
 */
const typesSmokeSource = `
import type {
  AnnualLiabilityRunBinding,
  AnnualLiabilityRunIdentity,
  AnnualLiabilityRunTaxInput,
  AnnualLiabilityRunTaxInputValue,
  ConversionTaxFundingExactCentAmount,
  CounterfactualAnnualLiabilityComponents,
  CounterfactualAnnualLiabilityRead,
  CounterfactualAnnualLiabilityRefusalKind,
  CounterfactualAnnualLiabilityRefused,
  CounterfactualAnnualLiabilityResult,
  SimulateAnnualCounterfactualRequest,
  SimulateOptions,
} from '@retiregolden/engine/projection/simulate'
import type { ActionId } from '@retiregolden/engine/actions/identity'
import type { TaxCalculator } from '@retiregolden/engine/projection/types'
import { createFlatTaxCalculator as deprecatedFlatTax } from '@retiregolden/engine/projection/flatTax'
import { createFlatTaxCalculator as relocatedFlatTax } from '@retiregolden/engine/testing/flatTax'
import {
  planJsonSchema as currentPlanJsonSchema,
  type JsonSchemaDocument,
} from '@retiregolden/engine/schema/current'
import { planJsonSchema as planV1JsonSchema } from '@retiregolden/engine/schema/v1'
import { planJsonSchema as planV2JsonSchema } from '@retiregolden/engine/schema/v2'
import { planJsonSchema as planV3JsonSchema } from '@retiregolden/engine/schema/v3'
import { planJsonSchema as planV4JsonSchema } from '@retiregolden/engine/schema/v4'
import { planJsonSchema as planV5JsonSchema } from '@retiregolden/engine/schema/v5'

// The deprecated projection/flatTax subpath has to stay NAMEABLE, not merely
// resolvable at runtime. If stripInternal ever deletes its declaration, the
// packed .js keeps working and every runtime assertion still passes, while
// this import fails to compile — the only place that break is visible.
export const flatTaxDoubles: readonly TaxCalculator[] =
  [deprecatedFlatTax(12), relocatedFlatTax(12)]

export const schemaDocuments: readonly JsonSchemaDocument[] = [
  currentPlanJsonSchema,
  planV1JsonSchema,
  planV2JsonSchema,
  planV3JsonSchema,
  planV4JsonSchema,
  planV5JsonSchema,
]

// The option, spelled out the way a consumer would have to spell it.
const filingStatus: AnnualLiabilityRunTaxInputValue =
  { representation: 'declaredTerm', term: 'single' }
const taxInput: AnnualLiabilityRunTaxInput =
  { inputId: 'federalFilingStatus', value: filingStatus }

function readLiability(read: CounterfactualAnnualLiabilityRead): number {
  const identity: Readonly<AnnualLiabilityRunIdentity> = read.identity
  const binding: Readonly<AnnualLiabilityRunBinding> = identity.liabilityRun
  if (binding.liabilityRunKind !== 'baselineT0') return 0
  const amount: Readonly<ConversionTaxFundingExactCentAmount> = read.liability
  const components: Readonly<CounterfactualAnnualLiabilityComponents> =
    read.liabilityComponents
  return amount.numeratorMinorUnits / amount.denominator +
    components.taxPlanDollars * 0
}

function whyRefused(refused: CounterfactualAnnualLiabilityRefused): CounterfactualAnnualLiabilityRefusalKind {
  return refused.reason
}

const request: SimulateAnnualCounterfactualRequest = {
  omitActionIds: [] as readonly ActionId[],
  taxUnitId: 'tax-unit',
  nonGroupTaxInputs: [taxInput],
  capture: (result: Readonly<CounterfactualAnnualLiabilityResult>) => {
    if (result.status === 'counterfactualAnnualLiabilityRead') readLiability(result)
    else whyRefused(result)
  },
}

export const options: Pick<SimulateOptions, 'annualCounterfactual'> =
  { annualCounterfactual: request }
`

const work = mkdtempSync(join(tmpdir(), 'engine-pack-smoke-'))
try {
  const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', work], {
    cwd: pkgDir,
    encoding: 'utf8',
    shell,
  })
  const packed = packOutput.trim().split('\n').pop().trim()
  const tarball = packed.endsWith('.tgz') ? packed : join(work, packed)

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'engine-pack-smoke', private: true, type: 'module' }))
  execFileSync('pnpm', ['add', tarball], {
    cwd: work,
    stdio: 'inherit',
    shell,
  })

  const installedEngine = join(work, 'node_modules', '@retiregolden', 'engine')
  const requireFromInstalledPackage = createRequire(join(work, 'package.json'))
  const currentSchemaEntryPath = requireFromInstalledPackage.resolve(
    '@retiregolden/engine/schema/current',
  )
  const legacySchemaEntryPath = requireFromInstalledPackage.resolve(
    '@retiregolden/engine/schema',
  )
  const currentSchemaFootprint = collectImportFootprint(currentSchemaEntryPath)
  const legacySchemaFootprint = collectImportFootprint(legacySchemaEntryPath)
  const currentSchemaGraph = currentSchemaFootprint.modulePaths
  const legacySchemaGraph = legacySchemaFootprint.modulePaths
  if (currentSchemaFootprint.externalSpecifiers.size > 0) {
    throw new Error(
      'schema/current statically imports external packages: ' +
        [...currentSchemaFootprint.externalSpecifiers].sort().join(', '),
    )
  }
  if (currentSchemaFootprint.dynamicSpecifiers.size > 0) {
    throw new Error(
      'schema/current contains dynamic imports that the eager footprint cannot prove: ' +
        [...currentSchemaFootprint.dynamicSpecifiers].sort().join(', '),
    )
  }
  const historicalGeneratedPattern = /plan\.v[1-4]\.generated\.js$/u
  const currentHistoricalModules = [...currentSchemaGraph].filter((modulePath) =>
    historicalGeneratedPattern.test(modulePath),
  )
  if (currentHistoricalModules.length > 0) {
    throw new Error(
      'schema/current statically reaches historical generated schema modules: ' +
        currentHistoricalModules
          .map((modulePath) => relative(installedEngine, modulePath).replaceAll('\\', '/'))
          .join(', '),
    )
  }
  if (![...currentSchemaGraph].some((modulePath) => /plan\.v5\.generated\.js$/u.test(modulePath))) {
    throw new Error('schema/current no longer statically reaches the current generated schema module')
  }
  const legacyHistoricalModules = [...legacySchemaGraph].filter((modulePath) =>
    historicalGeneratedPattern.test(modulePath),
  )
  if (legacyHistoricalModules.length !== 4) {
    throw new Error(
      'the legacy schema compatibility barrel must retain all four historical generated modules',
    )
  }
  const graphBytes = (graph) => [...graph].reduce(
    (total, modulePath) => total + Buffer.byteLength(readFileSync(modulePath, 'utf8')),
    0,
  )
  const currentSchemaBytes = graphBytes(currentSchemaGraph)
  const legacySchemaBytes = graphBytes(legacySchemaGraph)
  if (currentSchemaBytes >= legacySchemaBytes) {
    throw new Error(
      'schema/current static source footprint must stay smaller than the legacy barrel: ' +
        currentSchemaBytes + ' >= ' + legacySchemaBytes,
    )
  }
  console.log(
    'schema import footprint OK: ' +
      relative(installedEngine, currentSchemaEntryPath).replaceAll('\\', '/') +
      ' reaches ' + currentSchemaGraph.size +
      ' modules / ' + currentSchemaBytes + ' bytes; legacy schema reaches ' +
      legacySchemaGraph.size + ' modules / ' + legacySchemaBytes + ' bytes',
  )

  const structuralDeclarations = readFileSync(join(
    work,
    'node_modules',
    '@retiregolden',
    'engine',
    'dist',
    'actions',
    'structuralId.d.ts',
  ), 'utf8')
  if (structuralDeclarations.includes('deriveActionStructuralId')) {
    throw new Error('internal structural hasher leaked into packed declarations')
  }

  // The deprecated projection/flatTax shim must keep BOTH halves of its
  // subpath. The runtime half is asserted in smokeScript, but a stripped
  // declaration is invisible there: the .js still resolves and runs while the
  // .d.ts silently degrades to `export {}`. stripInternal is on, and the
  // declaration emitter drops any export whose leading comment merely CONTAINS
  // the internal-only tag as a substring (a raw `comment.includes(...)`, no tag
  // parsing, no word boundary) — so prose mentioning the tag is enough to
  // delete the declaration. types-smoke.ts below imports the subpath by name
  // and is the authoritative check; this read gives that failure a diagnosis
  // instead of a bare TS2305.
  //
  // Comments are stripped BEFORE looking for the symbol. The file-header JSDoc
  // survives stripInternal even when the declaration under it is deleted, so a
  // whole-file substring test would pass on a `export {};` artifact as soon as
  // any surviving comment happened to spell the identifier — which is exactly
  // the header where this file's rules are written down.
  const deprecatedFlatTaxDeclarations = readFileSync(join(
    work,
    'node_modules',
    '@retiregolden',
    'engine',
    'dist',
    'projection',
    'flatTax.d.ts',
  ), 'utf8')
  const deprecatedFlatTaxCode = deprecatedFlatTaxDeclarations
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^[^\S\n]*\/\/.*$/gmu, '')
  if (!deprecatedFlatTaxCode.includes('createFlatTaxCalculator')) {
    throw new Error(
      'the deprecated projection/flatTax subpath lost its type declaration; ' +
        'stripInternal removed it, so consumers pinned to that subpath keep a ' +
        'working runtime import but no types',
    )
  }

  writeFileSync(join(work, 'smoke.mjs'), smokeScript)
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: work, stdio: 'inherit' })

  const ts = require('typescript')

  // Types are erased, so every import above would pass against declarations
  // that resolve to nothing. This compiles a consumer-shaped file against the
  // installed tarball with the repo's own TypeScript — no registry fetch, so
  // the no-network property holds — and is the only thing here that proves a
  // published option's payload can actually be NAMED by the consumer it is
  // handed to, rather than merely received.
  writeFileSync(join(work, 'types-smoke.ts'), typesSmokeSource)
  // Declared once, then used twice: `tsc` compiles under it here, and the
  // language service below reads the same object through
  // `parseJsonConfigFileContent`. A hand-rolled second copy could drift into a
  // program that cannot resolve the packed subpath — and a program that
  // resolves nothing reports no deprecation either, which would trip the
  // marker check below and blame a perfectly healthy shim.
  const smokeTsconfig = {
    compilerOptions: {
      target: 'es2023',
      lib: ['ES2023'],
      module: 'nodenext',
      moduleResolution: 'nodenext',
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      verbatimModuleSyntax: true,
      noUnusedLocals: true,
    },
    files: ['types-smoke.ts'],
  }
  writeFileSync(join(work, 'tsconfig.smoke.json'), JSON.stringify(smokeTsconfig))
  execFileSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.smoke.json'],
    { cwd: work, stdio: 'inherit' },
  )

  // The deprecation marker has to be REPORTED to a consumer, not merely
  // present in the packed text. Nothing above can see that difference:
  // `tsc` never emits deprecation, which is a *suggestion* diagnostic raised
  // by the language service, and a text search for the tag is vacuous here
  // twice over — the shim's file header discusses the tag in prose, and the
  // declaration emitter copies the JSDoc through verbatim even for the bare
  // `export { x } from './y.js'` form that reports nothing.
  //
  // So the alias in src/projection/flatTax.ts could be "cleaned up" into a
  // re-export and every other check in this file would stay green while the
  // marker went dark for every consumer. This asks the language service the
  // question a consumer's editor asks, against the packed declarations.
  const smokeCompilation = ts.parseJsonConfigFileContent(smokeTsconfig, ts.sys, work)
  const smokeEntry = smokeCompilation.fileNames[0]
  const languageServiceHost = {
    getScriptFileNames: () => smokeCompilation.fileNames,
    getScriptVersion: () => '1',
    getScriptSnapshot: (name) => {
      const contents = ts.sys.readFile(name)
      return contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents)
    },
    getCurrentDirectory: () => work,
    getCompilationSettings: () => smokeCompilation.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }
  const languageService = ts.createLanguageService(languageServiceHost, ts.createDocumentRegistry())
  const suggestions = languageService.getSuggestionDiagnostics(smokeEntry)
  const smokeText = readFileSync(smokeEntry, 'utf8')
  const deprecations = suggestions.filter((diagnostic) => diagnostic.reportsDeprecated)
  // types-smoke.ts imports the same symbol from both subpaths. Only the
  // deprecated one may be flagged: if testing/flatTax started reporting too,
  // this check would pass for the wrong reason and the relocation target
  // would be telling consumers to stop using it.
  const flagged = new Set(deprecations.map((d) => smokeText.slice(d.start, d.start + d.length)))
  if (!flagged.has('deprecatedFlatTax')) {
    // A language-service program that failed to build reports no deprecation
    // either, so that state is indistinguishable from a dropped marker unless
    // it is asked about separately. `tsc` already compiled this same file
    // under these same options, so this should be unreachable — but if the
    // service ever disagrees with the compiler, say which failure this is
    // instead of accusing the shim of something it did not do.
    const semantic = languageService.getSemanticDiagnostics(smokeEntry)
    if (semantic.length > 0) {
      throw new Error(
        'the pack-smoke language-service program did not compile, so its silence about ' +
          'deprecation proves nothing about the shim. Fix this first; the marker check ' +
          'below cannot run until the consumer program resolves. Semantic errors: ' +
          semantic
            .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))
            .join(' | '),
      )
    }
    throw new Error(
      'the deprecated projection/flatTax subpath no longer REPORTS its deprecation to consumers. ' +
        'The packed .d.ts may still contain the tag text — that is not the same thing. Either the ' +
        'tag was dropped from the export JSDoc, or the re-declared alias in ' +
        'src/projection/flatTax.ts was collapsed back into `export { x } from \'./y.js\'`, which ' +
        'TypeScript does not report when the target is not itself deprecated. ' +
        'Deprecations actually reported: ' + (JSON.stringify([...flagged]) || 'none'),
    )
  }
  if (flagged.has('relocatedFlatTax')) {
    throw new Error(
      'testing/flatTax reports a deprecation, but it is the relocation TARGET; ' +
        'the projection/flatTax deprecation notice points consumers at it',
    )
  }
  console.log('pack smoke OK: the published option types compile from the packed declarations')
} finally {
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {
    // best-effort cleanup; a locked temp dir must not fail the check
  }
}
