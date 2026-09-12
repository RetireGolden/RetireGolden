import { describe, expect, it } from 'vitest'
import type { Account } from '../../model/plan.js'
import { gateSpousalElectionFromInheritedAccount } from './beneficiarySpousalElectionGateAdapter.js'

type Ira = Extract<Account, { type: 'traditional' | 'roth' }>
function account(distributedAmount: number): Ira {
  return {
    type: 'traditional', id: 'ira', name: 'Inherited IRA', ownerPersonId: 'spouse',
    kind: 'ira', balance: 100000, annualContribution: 0, annualReturnPct: 0,
    inherited: {
      decedentId: 'decedent', ownerDeathYear: 2024, ownerDeathDate: '2024-03-01',
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual', edbCategory: 'surviving-spouse',
        beneficiaryBirthYear: 1960, election: 'remain-beneficiary',
        provenance: { source: 'Custodian beneficiary designation', asOf: '2025-12-31' },
        soleBeneficiary: true, spouseUnlimitedWithdrawalRight: true,
        spousalElectionFacts: {
          directSpouseNamedOnIra: 'verifiedYes', affirmativeElectionYear: null,
          affirmativeElectionDate: null, nonRolloverContributionYears: [],
          nonRolloverContributionEvents: [], lateElectionCatchUp: null,
          provenance: { source: 'Custodian observed history', asOf: '2025-12-31' },
        },
      },
      annualDistributionHistory: [{
        taxYear: 2025, requiredAmount: 5000, distributedAmount,
        legalDistributionDeadline: '2025-12-31', observedAsOfDate: '2025-12-31',
        provenance: { source: 'Custodian observed history', asOf: '2025-12-31' },
      }],
    },
  }
}
describe('dated observed spouse election adapter', () => {
  it('does not require spouse identity facts for a non-spouse inherited account', () => {
    const ira = account(5000)
    ira.inherited!.beneficiary!.edbCategory = 'none'
    delete ira.inherited!.decedentId
    expect(gateSpousalElectionFromInheritedAccount({ account: ira, taxYear: 2026 })).toBeNull()
  })
  it('returns missing facts rather than throwing or fabricating a spouse decedent identity', () => {
    const ira = account(5000)
    delete ira.inherited!.decedentId
    const result = gateSpousalElectionFromInheritedAccount({ account: ira, taxYear: 2026 })
    expect(result?.status).toBe('missingFacts')
    if (result?.status === 'missingFacts') expect(result.missing).toContain('decedentId')
  })
  // 26 CFR 1.408-8(c)(2): an actual unmet post-death beneficiary requirement
  // triggers deemed election; a projection recommendation cannot do so.
  it('uses a finalized $1,000 shortfall at the next annual opening', () => {
    const result = gateSpousalElectionFromInheritedAccount({ account: account(4000), taxYear: 2026 })
    expect(result?.status).toBe('evaluated')
    if (result?.status !== 'evaluated') return
    expect(result.routeToOwnerTreatment).toBe(true)
    expect(result.evaluator.status).toBe('spousalOwnerTreatmentBegun')
  })
  it('does not treat an incomplete observation as a completed deadline shortfall', () => {
    const ira = account(4000)
    ira.inherited!.annualDistributionHistory![0]!.observedAsOfDate = '2025-12-15'
    const result = gateSpousalElectionFromInheritedAccount({ account: ira, taxYear: 2026 })
    expect(result?.status).toBe('missingFacts')
  })
  it('ignores an upcoming contribution when determining opening treatment', () => {
    const ira = account(5000)
    ira.inherited!.beneficiary!.spousalElectionFacts!.nonRolloverContributionEvents = [{
      executionDate: '2026-05-01', observedAsOfDate: '2026-05-01',
      provenance: { source: 'Subsequently observed event', asOf: '2026-05-01' },
    }]
    const result = gateSpousalElectionFromInheritedAccount({ account: ira, taxYear: 2026 })
    expect(result?.status).toBe('evaluated')
    if (result?.status !== 'evaluated') return
    expect(result.routeToOwnerTreatment).toBe(false)
  })
})

// Exact opening-date execution is distinct from a future recommendation.
describe('adapter January1 observed execution', () => {
  it('carries a January1 redesignation to the gate using prior completed history', () => {
    const value = account(5000)
    const facts = value.inherited!.beneficiary!.spousalElectionFacts!
    facts.affirmativeElectionYear = 2026
    facts.affirmativeElectionDate = '2026-01-01'
    facts.preElectionDistributionMethod = 'lifeExpectancyRule'
    facts.provenance = { source: 'Executed custodian redesignation', asOf: '2026-01-01' }
    facts.section402c2j4Inputs = {
      transaction: 'affirmativeTreatAsOwnElection', spouseBirthDate: '1960-01-01',
      decedentBirthDate: '1950-01-01', distributionYear: 2026,
      currentYearRmdReferenceBalance: 100000, actualPriorYearDistributions: [],
      actualPreElectionDistributionsCurrentYear: 0, currentDistributionOrRemainingInterest: 100000,
      provenance: facts.provenance,
    }
    expect(gateSpousalElectionFromInheritedAccount({ account: value, taxYear: 2026 }))
      .toMatchObject({ status: 'evaluated', routeToOwnerTreatment: true })
    facts.affirmativeElectionDate = '2026-01-02'
    facts.provenance.asOf = '2026-01-02'
    expect(gateSpousalElectionFromInheritedAccount({ account: value, taxYear: 2026 }))
      .toMatchObject({ status: 'evaluated', routeToOwnerTreatment: false })
  })
})
