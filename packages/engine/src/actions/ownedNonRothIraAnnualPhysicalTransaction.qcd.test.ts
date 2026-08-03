import { describe, expect, it, vi } from 'vitest'
import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import { buildAnnualRetirementPhysicalEventInventory } from './annualRetirementPhysicalEventInventory.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId, asPlanId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { preparePlanOwnedNonRothIraAnnualPhysicalTransaction, type PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput } from './ownedNonRothIraAnnualPhysicalTransaction.js'
import * as structuralId from './structuralId.js'

const year = 2026; const owner = asPersonId('owner'); const source = asAccountId('traditional-a')
const sibling = asAccountId('traditional-b'); const roth = asAccountId('roth')
const charity = { designationId: 'charity', name: 'Public charity', designationKind: 'eligiblePublicCharity' as const, directFromCustodianAttested: true,
  eligibleOrganizationAttested: true, notDonorAdvisedFundOrSupportingOrganizationAttested: true, notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true }
function qcd(id: string, date: string, sequence: number): QualifiedCharitableDistributionRequest {
  return { actionId: asActionId(id), kind: 'qcd', year, executionDate: date, executionSequence: sequence, requestedAmount: asPositiveUsdCents(5_000),
    provenance: { source: 'manual' }, donorPersonId: owner, allocation: { allocationId: asAllocationId(`allocation-${id}`), sourceAccountId: source,
      requestedAmount: asPositiveUsdCents(5_000) }, charity: { ...charity, designationId: `charity-${id}` } }
}
function planAndRequests(): { plan: Plan; requests: readonly QualifiedCharitableDistributionRequest[] } {
  const first = qcd('qcd-first', '2026-04-01', 20); const second = qcd('qcd-second', '2026-08-01', 40)
  const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 100 }); plan.id = asPlanId('qcd-unified-plan'); plan.household.people[0]!.id = owner
  plan.accounts = [traditionalAccount(source, 300, owner), traditionalAccount(sibling, 200, owner), { type: 'roth', id: roth, name: 'Roth', ownerPersonId: owner,
    annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 }]
  plan.strategies.retirementActions = [{ actionId: asActionId('withdrawal'), kind: 'ordinaryWithdrawal', year, executionDate: '2026-02-01', executionSequence: 10,
    requestedAmount: asPositiveUsdCents(4_000), provenance: { source: 'manual' }, personId: owner,
    allocations: [{ allocationId: asAllocationId('withdrawal-a'), sourceAccountId: source, requestedAmount: asPositiveUsdCents(4_000) }], purpose: { kind: 'spending' } },
  first, { actionId: asActionId('conversion'), kind: 'rothConversion', year, executionDate: '2026-06-01', executionSequence: 30,
    requestedAmount: asPositiveUsdCents(3_000), provenance: { source: 'manual' }, personId: owner,
    allocations: [{ allocationId: asAllocationId('conversion-a'), sourceAccountId: source, requestedAmount: asPositiveUsdCents(3_000) }],
    destinationRothAccountId: roth, taxFunding: { kind: 'noneExpected' } }, second]
  plan.retirementActionEligibilityFacts = { iraClassifications: [{ sourceAccountId: source, subtype: 'traditional', evidenceId: 'classification', provenance: { source: 'manual' } }],
    sepSimpleActivities: [], deductibleIraContributions: [{ donorPersonId: owner, taxYear: 2025, amountCents: asUsdCents(0), evidenceId: 'contribution-2025', provenance: { source: 'manual', sourceId: 'contribution-ledger-2025' } },
      { donorPersonId: owner, taxYear: year, amountCents: asUsdCents(0), evidenceId: 'contribution-2026', provenance: { source: 'manual', sourceId: 'contribution-ledger-2026' } }] }
  return { plan, requests: [first, second] }
}
function fixture(): PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput {
  const { plan, requests } = planAndRequests()
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = { personAliveEvidence: requests.map((request) => ({ evidenceId: `alive-${request.actionId}`,
    actionId: request.actionId, personId: owner, actionYear: year, actionDate: request.executionDate!, alive: true })),
  priorQcdOffsetEvidence: requests.map((request) => ({ evidenceId: `offset-${request.actionId}`, actionId: request.actionId, donorPersonId: owner,
    actionYear: year, actionDate: request.executionDate!, priorOffsetApplied: asUsdCents(0) })) }
  const inventoryBase = { plan, taxYear: year, runtimeRecords: [], runtimeInventoryAttestation: { predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
    planId: asPlanId(plan.id), taxYear: year, ledgerRunId: 'ledger-2026', inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    resolvedEventIds: [], unresolvedActivityIds: [], evidenceId: 'inventory-evidence', upstreamEvidenceId: 'inventory-upstream' } }
  const inventory = buildAnnualRetirementPhysicalEventInventory(inventoryBase); if (inventory.status !== 'annualPhysicalEventInventoryBuilt') throw new Error('fixture inventory failed')
  const event = (actionId: string) => inventory.events.find((candidate) => candidate.origin === 'planAction' && candidate.actionId === actionId)!
  return { ...inventoryBase, ownerPersonId: owner, openingBalances: [{ accountId: source, openingBalance: asUsdCents(30_000) },
    { accountId: sibling, openingBalance: asUsdCents(20_000) }], actualApplications: [
      { inventoryEventId: event('withdrawal').eventId, sourceBalanceBefore: asUsdCents(30_000), executedAmount: asUsdCents(4_000), sourceBalanceAfter: asUsdCents(26_000), stagingEvidenceId: 'withdrawal-staging' },
      { inventoryEventId: event('conversion').eventId, sourceBalanceBefore: asUsdCents(21_000), executedAmount: asUsdCents(3_000), sourceBalanceAfter: asUsdCents(18_000), stagingEvidenceId: 'conversion-staging' }],
    settledContributionApplications: [], qcdPrerequisiteInput: { taxYear: year, plan, requests, runtimeEvidence } }
}
function result(input: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) { return preparePlanOwnedNonRothIraAnnualPhysicalTransaction(input) }
function issueKinds(input: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput): string[] { return result(input).issues.map((entry) => entry.kind) }

describe('unified annual QCD physical transaction arm', () => {
  it('owns mixed chronology, debits each QCD once, and stages one charity credit per event', () => {
    const prepared = result(fixture()); if (prepared.status !== 'unifiedAnnualPhysicalTransactionPrepared') throw new Error(JSON.stringify(prepared.issues))
    expect(prepared.applications.map((entry) => [entry.actionId, entry.lineScope, entry.sourceBalanceBefore, entry.executedAmount, entry.sourceBalanceAfter]))
      .toEqual([['withdrawal', 'form8606Line7Distributions', 30_000, 4_000, 26_000], ['qcd-first', 'qcdCharitableDistributions', 26_000, 5_000, 21_000],
        ['conversion', 'form8606Line8NetConversions', 21_000, 3_000, 18_000], ['qcd-second', 'qcdCharitableDistributions', 18_000, 5_000, 13_000]])
    expect(prepared.stagedQcdCharityCredits.map((credit) => [credit.actionId, credit.stagedCreditAmount]))
      .toEqual([['qcd-first', 5_000], ['qcd-second', 5_000]])
    expect(prepared.line7Entries).toMatchObject([{ actionId: 'withdrawal', grossAmount: 4_000 }]); expect(prepared.line8Entries).toMatchObject([{ actionId: 'conversion', grossAmount: 3_000 }])
    expect(prepared.sourceBalanceTransitions.find((entry) => entry.sourceAccountId === source)).toMatchObject({ requestedAmount: 17_000,
      executedAmount: 17_000, detachedClosingBalance: 13_000 })
    const qcdApplications = prepared.applications.filter((entry) => entry.lineScope === 'qcdCharitableDistributions')
    expect(qcdApplications).toHaveLength(2); expect(qcdApplications.every((entry) => entry.qcdPrerequisiteEvidence.request.actionId === entry.actionId &&
      entry.qcdPrerequisiteEvidenceId === entry.stagingEvidenceId && entry.charityCreditEvidenceId.length > 0)).toBe(true)
    expect(prepared).toMatchObject({ movement: 'notCommitted', actionability: 'notEstablished', transactionStatus: 'appliedToDetachedSnapshotOnly' })
  })

  it('rejects missing/foreign/drifted preflight and duplicate generic QCD debit input', () => {
    const missing = fixture(); missing.qcdPrerequisiteInput = { ...missing.qcdPrerequisiteInput!, requests: missing.qcdPrerequisiteInput!.requests.slice(0, 1) }
    expect(issueKinds(missing)).toContain('qcdApplicationMissing')
    const drift = fixture(); drift.qcdPrerequisiteInput = { ...drift.qcdPrerequisiteInput!, requests: [{ ...drift.qcdPrerequisiteInput!.requests[0]!, executionSequence: 99 }, drift.qcdPrerequisiteInput!.requests[1]!] }
    expect(issueKinds(drift)).toEqual(expect.arrayContaining(['qcdApplicationMismatch', 'qcdApplicationMissing']))
    const duplicate = fixture(); const inventory = buildAnnualRetirementPhysicalEventInventory(duplicate); if (inventory.status !== 'annualPhysicalEventInventoryBuilt') throw new Error('fixture drift')
    const qcdEvent = inventory.events.find((event) => event.origin === 'planAction' && event.kind === 'qcd')!
    duplicate.actualApplications = [...duplicate.actualApplications, { inventoryEventId: qcdEvent.eventId, sourceBalanceBefore: asUsdCents(26_000), executedAmount: asUsdCents(5_000), sourceBalanceAfter: asUsdCents(21_000), stagingEvidenceId: 'duplicate-qcd' }]
    expect(issueKinds(duplicate)).toContain('actualApplicationForeign')
  })

  it('reserves nested preflight evidence IDs against derived-ID collisions', () => {
    const original = structuralId.deriveActionStructuralId; const spy = vi.spyOn(structuralId, 'deriveActionStructuralId').mockImplementation((prefix, parts) =>
      prefix === 'owned-ira-unified-annual-qcd-charity-credit' ? 'alive-qcd-first' : original(prefix, parts))
    try { expect(issueKinds(fixture())).toContain('identifierCollision') } finally { spy.mockRestore() }
  })

  it('is account/input-order invariant, detached, deeply frozen, and input-immutable', () => {
    const input = fixture(); const before = structuredClone(input); const canonical = result(input)
    const permutedPlan = structuredClone(input.plan) as Plan; permutedPlan.accounts.reverse()
    const permuted = { ...input, plan: permutedPlan, openingBalances: [...input.openingBalances].reverse(), actualApplications: [...input.actualApplications].reverse() }
    expect(result(permuted)).toEqual(canonical); expect(input).toEqual(before); expect(Object.isFrozen(canonical)).toBe(true)
    if (canonical.status !== 'unifiedAnnualPhysicalTransactionPrepared') throw new Error('fixture drift')
    const qcdApplication = canonical.applications.find((entry) => entry.lineScope === 'qcdCharitableDistributions')!
    expect(Object.isFrozen(qcdApplication.qcdPrerequisiteEvidence)).toBe(true); expect(Object.isFrozen(canonical.stagedQcdCharityCredits[0])).toBe(true)
  })
})
