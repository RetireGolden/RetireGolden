import { describe, expect, it } from 'vitest'

import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId, asPlanId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import { preparePlanOwnedNonRothIraAnnualPhysicalTransaction } from '../actions/ownedNonRothIraAnnualPhysicalTransaction.js'
import { parsePlan, type Plan } from '../model/plan.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  beginSimulatorAnnualRetirementRuntimeJournal,
  recordSimulatorAnnualRetirementRuntimeOccurrence,
  sealSimulatorAnnualRetirementRuntimeJournal,
  type SimulatorAnnualRetirementRuntimeOccurrence,
} from './annualRetirementRuntimeJournal.js'
import { buildOwnedIraAnnualPhysicalTransactionInputs } from './ownedIraAnnualPhysicalTransactionInputs.js'

const year = 2026
const planId = asPlanId('plan-qcd-translator')
const donor = asPersonId('donor')
const ira = asAccountId('owned-ira')
const otherIra = asAccountId('owned-ira-2')
const context = { planId, taxYear: year, ledgerRunId: 'qcd-translator-ledger-run' }

const charity = {
  designationId: 'charity-a', name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}

function occurrence(
  overrides: Partial<SimulatorAnnualRetirementRuntimeOccurrence> = {},
): SimulatorAnnualRetirementRuntimeOccurrence {
  return {
    producerOccurrenceKey: 'rmd:owned-ira', kind: 'ownedIraRmd',
    grossAmountPlanDollars: 100, ownerPersonId: donor, sourceAccountId: ira,
    // A runtime record only resolves into a physical event when it carries all
    // three of these. NOTE: no producer in `simulate.ts` supplies any of them
    // today -- every occurrence it records is unresolved, and one unresolved
    // record makes the whole inventory refuse. These fixtures therefore
    // describe the chronology the annual pass does not yet model; see this
    // module's docblock.
    executionDate: `${year}-03-01`, executionSequence: 1,
    movementAuthorityId: 'rmd-authority',
    ...overrides,
  }
}

function sealed(...occurrences: SimulatorAnnualRetirementRuntimeOccurrence[]) {
  let journal = beginSimulatorAnnualRetirementRuntimeJournal(context)
  for (const item of occurrences) {
    journal = recordSimulatorAnnualRetirementRuntimeOccurrence(journal, item)
  }
  const result = sealSimulatorAnnualRetirementRuntimeJournal(journal)
  if (result.status !== 'runtimeJournalSealed') throw new Error('fixture journal blocked')
  return result
}

interface PlanOptions {
  readonly extraAction?: Plan['strategies']['retirementActions'][number]
  readonly secondAccount?: boolean
}

function basePlan(options: PlanOptions = {}): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  plan.id = planId
  plan.household.people[0]!.id = donor
  plan.accounts = [
    traditionalAccount(ira, 100_000, donor),
    ...(options.secondAccount === true ? [traditionalAccount(otherIra, 100_000, donor)] : []),
  ]
  plan.strategies.retirementActions = [{
    actionId: asActionId('qcd-a'), kind: 'qcd', year,
    executionDate: `${year}-08-01`, executionSequence: 1,
    requestedAmount: asPositiveUsdCents(500_000), provenance: { source: 'manual' },
    donorPersonId: donor,
    allocation: {
      allocationId: asAllocationId('allocation-qcd-a'),
      sourceAccountId: ira, requestedAmount: asPositiveUsdCents(500_000),
    },
    charity,
  }, ...(options.extraAction === undefined ? [] : [options.extraAction])]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: plan.accounts.map((account) => ({
      sourceAccountId: asAccountId(account.id), subtype: 'traditional' as const,
      evidenceId: `classification-${account.id}`, provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: Array.from({ length: year - 2019 }, (_, index) => ({
      donorPersonId: donor, taxYear: 2020 + index, amountCents: asUsdCents(0),
      evidenceId: `contribution-${2020 + index}`,
      provenance: { source: 'manual' as const, sourceId: `ledger-${2020 + index}` },
    })),
  }
  return plan
}

function prerequisiteInput(plan: Plan) {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error('invalid fixture Plan')
  const requests = parsed.plan.strategies.retirementActions.filter(
    (entry): entry is QualifiedCharitableDistributionRequest =>
      entry.kind === 'qcd' && entry.year === year,
  )
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
      personId: donor, actionYear: year, actionDate: entry.executionDate ?? null, alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: donor, actionYear: year, actionDate: entry.executionDate ?? null,
      priorOffsetApplied: asUsdCents(0),
    })),
  }
  return { taxYear: year, plan: parsed.plan, requests, runtimeEvidence }
}

interface BuildOptions extends PlanOptions {
  readonly occurrences?: readonly SimulatorAnnualRetirementRuntimeOccurrence[]
  readonly openingCents?: number
}

function build(options: BuildOptions = {}) {
  const plan = basePlan(options)
  const journal = sealed(...(options.occurrences ?? [occurrence()]))
  return buildOwnedIraAnnualPhysicalTransactionInputs({
    plan,
    taxYear: year,
    runtimeInventoryAttestation: journal.runtimeInventoryAttestation,
    runtimeRecords: journal.runtimeRecords,
    openingBalances: [
      { accountId: ira, openingBalance: asUsdCents(options.openingCents ?? 10_000_000) },
      { accountId: otherIra, openingBalance: asUsdCents(2_000_000) },
    ],
    qcdPrerequisiteInput: prerequisiteInput(plan),
  })
}

describe('buildOwnedIraAnnualPhysicalTransactionInputs', () => {
  it('stages one owner input the unified transaction preparer accepts end to end', () => {
    const result = build()
    if (result.status !== 'ownedIraAnnualPhysicalTransactionInputsBuilt') {
      throw new Error(result.issues[0].detail)
    }
    expect(result.inputs).toHaveLength(1)
    const only = result.inputs[0]!
    expect(only.ownerPersonId).toBe(donor)
    // The RMD is the year's only line-7 event, so one staged application, and
    // its detached chain starts at the year's opening balance.
    expect(only.actualApplications).toHaveLength(1)
    expect(only.actualApplications[0]).toMatchObject({
      sourceBalanceBefore: 10_000_000, executedAmount: 10_000, sourceBalanceAfter: 9_990_000,
    })
    expect(only.settledContributionApplications).toEqual([])
    // The gift is never staged here: the preparer synthesizes it from the
    // rebuilt prerequisite, which is the whole reason that input is threaded.
    expect(only.qcdPrerequisiteInput).toBeDefined()

    // The real proof is that the far side accepts it without complaint.
    const prepared = preparePlanOwnedNonRothIraAnnualPhysicalTransaction(only)
    if (prepared.status !== 'unifiedAnnualPhysicalTransactionPrepared') {
      throw new Error(prepared.issues.map((entry) => `${entry.kind}: ${entry.detail}`).join(' | '))
    }
  })

  it('walks past the gift so later events start where the preparer agrees they do', () => {
    // A second distribution after the August gift. The preparer debits the gift
    // from its own chain, so this event's `sourceBalanceBefore` has to be net of
    // it -- copying the simulator's mutation-order balance would not be.
    const result = build({
      occurrences: [
        occurrence(),
        occurrence({ producerOccurrenceKey: 'legacy-withdrawal:owned-ira', kind: 'legacyNeedBasedWithdrawal', grossAmountPlanDollars: 200, executionDate: `${year}-10-01`, executionSequence: 2, movementAuthorityId: 'legacy-withdrawal-authority' }),
      ],
    })
    if (result.status !== 'ownedIraAnnualPhysicalTransactionInputsBuilt') {
      throw new Error(result.issues[0].detail)
    }
    const staged = result.inputs[0]!.actualApplications
    expect(staged).toHaveLength(2)
    const totalDebited = staged.reduce((sum, entry) => sum + entry.executedAmount, 0)
    expect(totalDebited).toBe(30_000)
    expect(preparePlanOwnedNonRothIraAnnualPhysicalTransaction(result.inputs[0]!).status)
      .toBe('unifiedAnnualPhysicalTransactionPrepared')
  })

  it('includes an unchanged sibling source with no events of its own', () => {
    const result = build({ secondAccount: true })
    if (result.status !== 'ownedIraAnnualPhysicalTransactionInputsBuilt') {
      throw new Error(result.issues[0].detail)
    }
    // The preparer refuses `openingBalanceMissing` for a silent sibling, so the
    // pool's whole source set has to be present even where nothing happened.
    expect(result.inputs[0]!.openingBalances.map((entry) => entry.accountId).sort())
      .toEqual([ira, otherIra].sort())
  })

  it('emits nothing for a year with no gift rather than staging an idle pool', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = []
    const journal = sealed(occurrence())
    const result = buildOwnedIraAnnualPhysicalTransactionInputs({
      plan, taxYear: year,
      runtimeInventoryAttestation: journal.runtimeInventoryAttestation,
      runtimeRecords: journal.runtimeRecords,
      openingBalances: [{ accountId: ira, openingBalance: asUsdCents(10_000_000) }],
      qcdPrerequisiteInput: { taxYear: year, plan, requests: [], runtimeEvidence: {} },
    })
    expect(result).toMatchObject({ status: 'ownedIraAnnualPhysicalTransactionInputsBuilt', inputs: [] })
  })

  it('refuses a year carrying owned-IRA activity the runtime ledger cannot resolve', () => {
    // A rollover inflow, annuity funding transfer, or other traditional
    // transfer is not a resolvable runtime kind, so it never becomes a physical
    // event at all and the whole inventory refuses before any pool is walked.
    // The refusal is therefore `inventoryUnavailable`, not the pool walk's own
    // `unsupportedPoolActivity` -- which stays as defence for a caller that
    // supplies records some other way. Worth pinning either way: what matters
    // is that such a year cannot produce a staged gift.
    const result = build({
      occurrences: [occurrence(), occurrence({
        producerOccurrenceKey: 'rollover:owned-ira', kind: 'otherTraditionalTransfer',
        grossAmountPlanDollars: 50, movementAuthorityId: 'rollover-authority', executionDate: `${year}-04-01`, executionSequence: 1,
      })],
    })
    expect(result).toMatchObject({
      status: 'ownedIraAnnualPhysicalTransactionInputsBlocked',
      issues: [{ kind: 'inventoryUnavailable' }],
    })
  })

  it('refuses a Plan-declared distribution scheduled beside the gift', () => {
    // The inventory derives this event from the Plan while the journal records
    // what actually executed. Nothing here joins the two, so the same movement
    // would be presented twice with no authoritative amount.
    const result = build({
      extraAction: {
        actionId: asActionId('withdrawal-a'), kind: 'ordinaryWithdrawal', year,
        executionDate: `${year}-09-01`, executionSequence: 1,
        requestedAmount: asPositiveUsdCents(100_000), provenance: { source: 'manual' },
        personId: donor,
        allocations: [{
          allocationId: asAllocationId('allocation-withdrawal-a'),
          sourceAccountId: ira, requestedAmount: asPositiveUsdCents(100_000),
        }],
        purpose: { kind: 'spending' },
      },
    })
    expect(result).toMatchObject({
      status: 'ownedIraAnnualPhysicalTransactionInputsBlocked',
      issues: [{ kind: 'planDeclaredPoolMovement', inventoryEventId: expect.any(String) }],
    })
  })

  it('refuses when the opening balances and the journal disagree about the year', () => {
    // A resolved runtime event is an observation of a movement that already
    // happened. If it overdraws the year's opening balance, one of the two is
    // wrong, and guessing which would put a fabricated balance into evidence.
    const result = build({ openingCents: 5_000 })
    expect(result).toMatchObject({
      status: 'ownedIraAnnualPhysicalTransactionInputsBlocked',
      issues: [{ kind: 'detachedChainUnrepresentable', sourceAccountId: ira }],
    })
  })

  it('refuses a pool source with no opening balance rather than assuming zero', () => {
    const plan = basePlan()
    const journal = sealed(occurrence())
    const result = buildOwnedIraAnnualPhysicalTransactionInputs({
      plan, taxYear: year,
      runtimeInventoryAttestation: journal.runtimeInventoryAttestation,
      runtimeRecords: journal.runtimeRecords,
      openingBalances: [],
      qcdPrerequisiteInput: prerequisiteInput(plan),
    })
    expect(result).toMatchObject({
      status: 'ownedIraAnnualPhysicalTransactionInputsBlocked',
      issues: [{ kind: 'openingBalanceMissing', sourceAccountId: ira }],
    })
  })

  it('is deterministic and does not mutate its input', () => {
    const first = build()
    const repeat = build()
    expect(JSON.stringify(repeat)).toBe(JSON.stringify(first))
  })
})
