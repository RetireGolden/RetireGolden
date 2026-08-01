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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shell = process.platform === 'win32' // npm is npm.cmd on Windows

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
const actionsApi = await import('@retiregolden/engine/actions')
const candidateIdentityAllocatorDeepApi = await import(
  '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
)
const ownedIraCoordinatorDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualCandidateCoordinator'
)
const ownedIraCandidateTransactionDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualCandidateTransaction'
)
const ownedIraPlanCoordinatorDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualPlanCoordinator'
)
const ownedIraAnnualExecutionDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualExecution'
)
const ownedIraAnnualFilingEvidenceDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualFilingEvidence'
)
const ownedIraAnnualFilingSourceResolverDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualFilingSourceResolver'
)
const annualRetirementInventoryDeepApi = await import(
  '@retiregolden/engine/actions/annualRetirementPhysicalEventInventory'
)
const ownedIraPostCandidateEvidenceDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualPostCandidateEvidence'
)
const ownedIraPostCandidateExecutionDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualPostCandidateExecution'
)
const ownedIraAnnualPassProbeDeepApi = await import(
  '@retiregolden/engine/actions/ownedNonRothIraAnnualPassProbe'
)
const canonicalActionDeepImports = [
  'annualIraBasisAllocation',
  'annualRetirementPhysicalEventInventory',
  'civilDate',
  'contract',
  'execution',
  'identity',
  'money',
  'ownedNonRothIraAnnualCandidateCoordinator',
  'ownedNonRothIraAnnualCandidateTransaction',
  'ownedNonRothIraAnnualExecution',
  'ownedNonRothIraAnnualFilingEvidence',
  'ownedNonRothIraAnnualFilingSourceResolver',
  'ownedNonRothIraAnnualPlanCoordinator',
  'ownedNonRothIraAnnualPostCandidateEvidence',
  'ownedNonRothIraAnnualPostCandidateExecution',
  'ownedNonRothIraAnnualPassProbe',
  'ownedNonRothIraAnnualFinalization',
  'ownedNonRothIraMovementCandidate',
  'ownedNonRothIraPenaltyPrerequisite',
  'ownedNonRothIraSeppAnnualReconciliation',
  'ownedNonRothIraSeppCurrentPaymentCandidate',
  'ownedNonRothIraWithdrawalCharacter',
  'planBalanceAdapter',
  'reasons',
  'retirementActionCandidateIdentityAllocator',
  'retirementActionManualReview',
  'taxableWithdrawalCharacter',
]
for (const moduleName of canonicalActionDeepImports) {
  const moduleApi = await import('@retiregolden/engine/actions/' + moduleName)
  assert.ok(
    Object.keys(moduleApi).length > 0,
    'canonical public action deep import must resolve: ' + moduleName,
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
  buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence,
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
  buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  buildOwnedNonRothIraStagedDistributionDateEvidenceId,
  buildAnnualRetirementPhysicalEventInventory,
  buildPlanOwnedNonRothIraAnnualFilingEvidence,
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  buildCompletePlanOwnedNonRothIraAnnualPassEvidence,
  classifyOwnedNonRothIraAnnualWithdrawals,
  classifyIndividuallyOwnedTaxableWithdrawal,
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
  coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  executeCashOrdinaryWithdrawals,
  executeOrdinaryWithdrawals,
  executePlanOwnedNonRothIraAnnualPostCandidate,
  executePlanOwnedNonRothIraAnnualWithdrawals,
  ledgerCentsToPlanDollars,
  parseRetirementActionRequest,
  planDollarsToLedgerCents,
  preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  probePlanOwnedNonRothIraAnnualPass,
  resolveOwnedNonRothIraAnnualWithdrawalEvidence,
  resolvePlanOwnedNonRothIraAnnualFilingSources,
  reviewAndReplaceRetirementActionManually,
  reconcileOwnedNonRothIraSeppAnnualSchedule,
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  validateOwnedNonRothIraSeppCurrentPaymentCandidate,
} = actionsApi
assert.equal(
  candidateIdentityAllocatorDeepApi.allocateRetirementActionCandidateIdentity,
  allocateRetirementActionCandidateIdentity,
)
assert.equal(typeof allocateRetirementActionCandidateIdentity, 'function')
assert.equal(typeof reviewAndReplaceRetirementActionManually, 'function')
assert.equal(
  ownedIraAnnualPassProbeDeepApi
    .buildCompletePlanOwnedNonRothIraAnnualPassEvidence,
  buildCompletePlanOwnedNonRothIraAnnualPassEvidence,
)
assert.equal(
  ownedIraAnnualPassProbeDeepApi.probePlanOwnedNonRothIraAnnualPass,
  probePlanOwnedNonRothIraAnnualPass,
)
assert.equal(
  ownedIraAnnualFilingEvidenceDeepApi
    .buildPlanOwnedNonRothIraAnnualFilingEvidence,
  buildPlanOwnedNonRothIraAnnualFilingEvidence,
)
assert.equal(
  ownedIraAnnualFilingSourceResolverDeepApi
    .resolvePlanOwnedNonRothIraAnnualFilingSources,
  resolvePlanOwnedNonRothIraAnnualFilingSources,
)
assert.equal(
  ownedIraCoordinatorDeepApi
    .buildOwnedNonRothIraStagedDistributionDateEvidenceId,
  buildOwnedNonRothIraStagedDistributionDateEvidenceId,
)
assert.equal(
  ownedIraCandidateTransactionDeepApi
    .preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  preparePlanOwnedNonRothIraAnnualCandidateTransaction,
)
assert.equal(
  typeof preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  'function',
)
assert.equal(
  ownedIraPlanCoordinatorDeepApi
    .coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
  coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
)
assert.equal(
  ownedIraAnnualExecutionDeepApi
    .executePlanOwnedNonRothIraAnnualWithdrawals,
  executePlanOwnedNonRothIraAnnualWithdrawals,
)
assert.equal(
  annualRetirementInventoryDeepApi
    .buildAnnualRetirementPhysicalEventInventory,
  buildAnnualRetirementPhysicalEventInventory,
)
assert.equal(
  ownedIraPostCandidateEvidenceDeepApi
    .buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
)
assert.equal(
  ownedIraPostCandidateExecutionDeepApi
    .executePlanOwnedNonRothIraAnnualPostCandidate,
  executePlanOwnedNonRothIraAnnualPostCandidate,
)
const moneyDeepApi = await import('@retiregolden/engine/actions/money')
const {
  evaluateRetirementActionEligibility,
} = await import('@retiregolden/engine/strategies/accountEligibility')
const simulate = await import('@retiregolden/engine/projection/simulate')
const { singlePersonPlan, cashAccount, productionTaxCalculator, runPlan } = await import(
  '@retiregolden/engine/testing/planFixtures'
)

// The ./schema subpath (the MCP's plan-format source) and the offline JSON
// artifact must both resolve from the installed tarball. Read the JSON via
// createRequire + fs — not an import attribute — so this stays valid on the whole
// supported Node range (engines.node >=20; import attributes need >=20.10). The
// JSON path is derived from PLAN_SCHEMA_VERSION so a future schema-version bump
// retargets it automatically.
const { planJsonSchema, PLAN_SCHEMA_VERSION } = await import('@retiregolden/engine/schema')
const requireFromSmoke = createRequire(import.meta.url)
const shippedPath = requireFromSmoke.resolve(
  '@retiregolden/engine/schema/plan.v' + PLAN_SCHEMA_VERSION + '.json',
)
const shippedSchema = JSON.parse(readFileSync(shippedPath, 'utf8'))

assert.equal(typeof simulatePlan, 'function')
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
assert.equal(addUsdCents(asUsdCents(125), asUsdCents(75)), 200)
assert.equal(planDollarsToLedgerCents(1.005), 101)
assert.equal(ledgerCentsToPlanDollars(asUsdCents(101)), 1.01)
assert.equal(CURRENT_PLAN_SCHEMA_VERSION, 4)
assert.ok(packForYear(2026) && typeof packForYear(2026) === 'object')

assert.equal(PLAN_SCHEMA_VERSION, 4)
assert.equal(planJsonSchema.properties.schemaVersion.const, 4)
assert.ok(String(planJsonSchema.$id).includes('/v' + PLAN_SCHEMA_VERSION + '.json'), 'schema carries a versioned $id')
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

const work = mkdtempSync(join(tmpdir(), 'engine-pack-smoke-'))
try {
  const packOutput = execFileSync('npm', ['pack', '--pack-destination', work], {
    cwd: pkgDir,
    encoding: 'utf8',
    shell,
  })
  const tarball = packOutput.trim().split('\n').pop().trim()

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'engine-pack-smoke', private: true, type: 'module' }))
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(work, tarball)], {
    cwd: work,
    stdio: 'inherit',
    shell,
  })

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

  writeFileSync(join(work, 'smoke.mjs'), smokeScript)
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: work, stdio: 'inherit' })
} finally {
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {
    // best-effort cleanup; a locked temp dir must not fail the check
  }
}
