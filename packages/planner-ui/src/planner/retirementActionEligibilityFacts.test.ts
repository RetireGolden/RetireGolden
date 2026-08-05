import { describe, expect, it } from 'vitest'

import {
  evaluateAnnualQcdExecutionPrerequisites,
} from '@retiregolden/engine/actions/annualQcdExecutionPrerequisite'
import {
  parseRetirementActionRequest,
  type QualifiedCharitableDistributionRequest,
} from '@retiregolden/engine/actions/contract'
import { asUsdCents } from '@retiregolden/engine/actions/money'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../testSupport/samplePlan'
import {
  bulkContributionConflictMessage,
  classifiableIraAccounts,
  conflictingContributionYears,
  contributionDonors,
  deductibleContributionYears,
  ELIGIBILITY_EVIDENCE_ID_CONFLICT,
  eligibilityEvidenceIdConflict,
  mintEligibilityEvidenceId,
  nonnegativeDollarsToCents,
  recordDeductibleContribution,
  recordDeductibleContributionZeros,
  recordIraClassification,
  recordSepSimpleActivity,
  removeIraClassification,
  sepSimpleActivityYears,
} from './retirementActionEligibilityFacts'

const DONOR_DOB = '1950-03-01'
const ACTION_YEAR = 2026
const THRESHOLD_YEAR = 2020

function factsPlan(): Plan {
  const plan = createSamplePlan()
  const donor = plan.household.people[0]!
  donor.dob = DONOR_DOB
  plan.accounts = [
    {
      type: 'cash', id: 'source-cash', name: 'Cash', ownerPersonId: donor.id,
      annualReturnPct: null, balance: 200_000, annualContribution: 0,
    },
    {
      type: 'traditional', id: 'source-ira', name: 'Traditional IRA', ownerPersonId: donor.id,
      annualReturnPct: null, kind: 'ira', balance: 500_000, annualContribution: 0,
    },
    {
      type: 'traditional', id: 'second-ira', name: 'Second IRA', ownerPersonId: donor.id,
      annualReturnPct: null, kind: 'ira', balance: 100_000, annualContribution: 0,
    },
  ]
  plan.incomes = []
  plan.insurance = []
  plan.careEvents = []
  plan.strategies.rothConversion = { mode: 'none' }
  plan.strategies.retirementActions = []
  return plan
}

function namedQcd(plan: Plan): QualifiedCharitableDistributionRequest {
  const parsed = parseRetirementActionRequest({
    actionId: 'qcd-action',
    kind: 'qcd',
    year: ACTION_YEAR,
    executionDate: `${ACTION_YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount: 20_000_00,
    provenance: { source: 'manual' },
    donorPersonId: plan.household.people[0]!.id,
    allocation: {
      allocationId: 'qcd-allocation',
      sourceAccountId: 'source-ira',
      requestedAmount: 20_000_00,
    },
    charity: {
      designationId: 'charity-1',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  if (parsed.request.kind !== 'qcd') throw new Error('expected a named QCD')
  return parsed.request
}

function allEvidenceIds(plan: Plan): readonly string[] {
  const facts = plan.retirementActionEligibilityFacts
  return [
    ...(facts?.iraClassifications ?? []).map((record) => record.evidenceId),
    ...(facts?.sepSimpleActivities ?? []).map((record) => record.evidenceId),
    ...(facts?.deductibleIraContributions ?? []).map((record) => record.evidenceId),
  ]
}

describe('eligibility evidence ID minting', () => {
  it('mints the same ID for the same fact every time', () => {
    expect(mintEligibilityEvidenceId({
      role: 'iraClassification',
      sourceAccountId: 'source-ira',
    })).toBe(mintEligibilityEvidenceId({
      role: 'iraClassification',
      sourceAccountId: 'source-ira',
    }))
    expect(mintEligibilityEvidenceId({
      role: 'deductibleContribution',
      donorPersonId: 'p1',
      taxYear: 2024,
    })).toBe('planner-eligibility-deductible-contribution:["p1",2024]')
  })

  it('never mints one ID for two different facts', () => {
    const minted = [
      mintEligibilityEvidenceId({ role: 'iraClassification', sourceAccountId: 'a' }),
      mintEligibilityEvidenceId({ role: 'iraClassification', sourceAccountId: 'a"' }),
      mintEligibilityEvidenceId({ role: 'iraClassification', sourceAccountId: 'a",2026]' }),
      mintEligibilityEvidenceId({
        role: 'sepSimpleActivity', sourceAccountId: 'a', actionTaxYear: 2026,
      }),
      mintEligibilityEvidenceId({
        role: 'sepSimpleActivity', sourceAccountId: 'a', actionTaxYear: 2027,
      }),
      mintEligibilityEvidenceId({
        role: 'sepSimpleActivity', sourceAccountId: 'a"', actionTaxYear: 2026,
      }),
      mintEligibilityEvidenceId({
        role: 'deductibleContribution', donorPersonId: 'a', taxYear: 2026,
      }),
      mintEligibilityEvidenceId({
        role: 'deductibleContribution', donorPersonId: 'a', taxYear: 2027,
      }),
    ]
    expect(new Set(minted).size).toBe(minted.length)
  })

  it('keeps every minted ID out of the runtime evidence namespaces', () => {
    const minted = [
      mintEligibilityEvidenceId({ role: 'iraClassification', sourceAccountId: 'x' }),
      mintEligibilityEvidenceId({
        role: 'sepSimpleActivity', sourceAccountId: 'x', actionTaxYear: 2026,
      }),
      mintEligibilityEvidenceId({
        role: 'deductibleContribution', donorPersonId: 'x', taxYear: 2026,
      }),
    ]
    for (const id of minted) {
      expect(id.startsWith('projection-')).toBe(false)
      expect(id.startsWith('planner-preview-')).toBe(false)
    }
  })

  it('refuses a fact whose minted ID another Plan identifier already claims', () => {
    const plan = factsPlan()
    plan.accounts.push({
      type: 'cash',
      id: mintEligibilityEvidenceId({
        role: 'iraClassification',
        sourceAccountId: 'source-ira',
      }),
      name: 'Collision',
      ownerPersonId: plan.household.people[0]!.id,
      annualReturnPct: null,
      balance: 1,
      annualContribution: 0,
    })

    expect(eligibilityEvidenceIdConflict(plan, {
      role: 'iraClassification',
      sourceAccountId: 'source-ira',
    })).toBe(ELIGIBILITY_EVIDENCE_ID_CONFLICT)
    expect(eligibilityEvidenceIdConflict(plan, {
      role: 'iraClassification',
      sourceAccountId: 'second-ira',
    })).toBeNull()
  })

  it('names every bulk contribution year whose minted ID is already claimed', () => {
    const plan = factsPlan()
    const donor = plan.household.people[0]!
    const years = deductibleContributionYears(DONOR_DOB, ACTION_YEAR)
    expect(conflictingContributionYears(plan, donor.id, years)).toEqual([])

    plan.accounts.push(
      {
        type: 'cash',
        id: mintEligibilityEvidenceId({
          role: 'deductibleContribution', donorPersonId: donor.id, taxYear: 2022,
        }),
        name: 'Collision one', ownerPersonId: donor.id, annualReturnPct: null,
        balance: 1, annualContribution: 0,
      },
      {
        type: 'cash',
        id: mintEligibilityEvidenceId({
          role: 'deductibleContribution', donorPersonId: donor.id, taxYear: 2025,
        }),
        name: 'Collision two', ownerPersonId: donor.id, annualReturnPct: null,
        balance: 1, annualContribution: 0,
      },
    )

    expect(conflictingContributionYears(plan, donor.id, years)).toEqual([2022, 2025])
    expect(bulkContributionConflictMessage([2022, 2025])).toContain('2022 and 2025')
    expect(bulkContributionConflictMessage([2022])).toContain('files 2022 under')
    expect(bulkContributionConflictMessage([2022, 2024, 2025]))
      .toContain('2022, 2024, and 2025')
  })

  it('does not treat a fact re-record as a conflict with itself', () => {
    const plan = factsPlan()
    recordIraClassification(plan, 'source-ira', 'traditional', null)

    expect(eligibilityEvidenceIdConflict(plan, {
      role: 'iraClassification',
      sourceAccountId: 'source-ira',
    })).toBeNull()
  })

  it('refuses when an imported fact already holds the ID a different fact would mint', () => {
    const plan = factsPlan()
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        evidenceId: mintEligibilityEvidenceId({
          role: 'iraClassification',
          sourceAccountId: 'second-ira',
        }),
        provenance: { source: 'import', sourceId: 'custodian-file' },
        sourceAccountId: 'source-ira',
        subtype: 'traditional',
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    }

    expect(eligibilityEvidenceIdConflict(plan, {
      role: 'iraClassification',
      sourceAccountId: 'second-ira',
    })).toBe(ELIGIBILITY_EVIDENCE_ID_CONFLICT)
  })

  it('keeps a UI-authored plan clear of the whole-batch evidence-ID block', () => {
    const plan = factsPlan()
    const request = namedQcd(plan)
    plan.strategies.retirementActions = [request]
    recordIraClassification(plan, 'source-ira', 'traditional', null)
    recordIraClassification(plan, 'second-ira', 'sep', null)
    recordSepSimpleActivity(plan, 'second-ira', ACTION_YEAR, `${ACTION_YEAR}-12-31`, false)
    recordDeductibleContributionZeros(
      plan,
      plan.household.people[0]!.id,
      deductibleContributionYears(DONOR_DOB, ACTION_YEAR),
    )
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    const evaluated = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: ACTION_YEAR,
      plan: parsed.plan,
      requests: [request],
      runtimeEvidence: {
        personAliveEvidence: [{
          evidenceId: `projection-alive:${JSON.stringify([request.actionId])}`,
          actionId: request.actionId,
          personId: request.donorPersonId,
          actionYear: ACTION_YEAR,
          actionDate: `${ACTION_YEAR}-08-01`,
          alive: true,
        }],
      },
    })

    expect(evaluated.issues.some((issue) => issue.kind === 'evidenceIdReused')).toBe(false)
    expect(new Set(allEvidenceIds(parsed.plan)).size).toBe(allEvidenceIds(parsed.plan).length)
  })
})

describe('eligibility fact writers', () => {
  it('creates the durable root only when a fact is recorded', () => {
    const plan = factsPlan()
    expect(plan.retirementActionEligibilityFacts).toBeUndefined()

    recordIraClassification(plan, 'source-ira', 'traditional', null)

    expect(plan.retirementActionEligibilityFacts).toEqual({
      iraClassifications: [{
        evidenceId: 'planner-eligibility-ira-classification:["source-ira"]',
        provenance: { source: 'manual' },
        sourceAccountId: 'source-ira',
        subtype: 'traditional',
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('carries a SIMPLE participation start date only when one was entered', () => {
    const plan = factsPlan()
    recordIraClassification(plan, 'source-ira', 'simple', '2019-03-01')
    recordIraClassification(plan, 'second-ira', 'simple', null)

    expect(plan.retirementActionEligibilityFacts?.iraClassifications).toEqual([
      expect.objectContaining({ sourceAccountId: 'second-ira', subtype: 'simple' }),
      expect.objectContaining({
        sourceAccountId: 'source-ira',
        subtype: 'simple',
        simpleParticipationStartDate: '2019-03-01',
      }),
    ])
    expect(
      plan.retirementActionEligibilityFacts?.iraClassifications
        .find((record) => record.sourceAccountId === 'second-ira'),
    ).not.toHaveProperty('simpleParticipationStartDate')
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('removes employer-contribution years a traditional classification cannot carry', () => {
    const plan = factsPlan()
    recordIraClassification(plan, 'source-ira', 'sep', null)
    recordSepSimpleActivity(plan, 'source-ira', ACTION_YEAR, `${ACTION_YEAR}-12-31`, true)
    expect(sepSimpleActivityYears(plan, 'source-ira')).toEqual([ACTION_YEAR])

    recordIraClassification(plan, 'source-ira', 'traditional', null)

    expect(sepSimpleActivityYears(plan, 'source-ira')).toEqual([])
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('removes employer-contribution years with the classification they hang from', () => {
    const plan = factsPlan()
    recordIraClassification(plan, 'source-ira', 'simple', null)
    recordSepSimpleActivity(plan, 'source-ira', ACTION_YEAR, `${ACTION_YEAR}-06-30`, false)

    removeIraClassification(plan, 'source-ira')

    expect(plan.retirementActionEligibilityFacts?.iraClassifications).toEqual([])
    expect(sepSimpleActivityYears(plan, 'source-ira')).toEqual([])
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('writes one record per named year for a bulk zero statement', () => {
    const plan = factsPlan()
    const donor = plan.household.people[0]!
    const years = deductibleContributionYears(DONOR_DOB, ACTION_YEAR)
    expect(years).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026])

    recordDeductibleContributionZeros(plan, donor.id, years)

    const records = plan.retirementActionEligibilityFacts!.deductibleIraContributions
    expect(records).toHaveLength(years.length)
    expect(records.map((record) => record.taxYear)).toEqual([...years])
    expect(records.every((record) => record.amountCents === 0)).toBe(true)
    expect(new Set(records.map((record) => record.evidenceId)).size).toBe(years.length)
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('overwrites a single year without disturbing the others', () => {
    const plan = factsPlan()
    const donor = plan.household.people[0]!
    recordDeductibleContributionZeros(
      plan,
      donor.id,
      deductibleContributionYears(DONOR_DOB, ACTION_YEAR),
    )

    recordDeductibleContribution(plan, donor.id, 2023, asUsdCents(6_500_00))

    const records = plan.retirementActionEligibilityFacts!.deductibleIraContributions
    expect(records).toHaveLength(7)
    expect(records.find((record) => record.taxYear === 2023)?.amountCents).toBe(6_500_00)
    expect(
      records.filter((record) => record.taxYear !== 2023)
        .every((record) => record.amountCents === 0),
    ).toBe(true)
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('lists no contribution years before a donor reaches the threshold year', () => {
    expect(deductibleContributionYears('1990-01-01', ACTION_YEAR)).toEqual([])
    expect(deductibleContributionYears('1955-07-02', ACTION_YEAR)).toEqual([2026])
    expect(deductibleContributionYears('1955-06-30', ACTION_YEAR)).toEqual([2025, 2026])
    expect(deductibleContributionYears('not-a-date', ACTION_YEAR)).toEqual([])
  })

  it('accepts a stated zero and refuses an unstated amount', () => {
    expect(nonnegativeDollarsToCents(0)).toBe(0)
    expect(nonnegativeDollarsToCents(6_500.25)).toBe(650_025)
    expect(nonnegativeDollarsToCents(null)).toBeNull()
    expect(nonnegativeDollarsToCents(-1)).toBeNull()
    expect(nonnegativeDollarsToCents(Number.NaN)).toBeNull()
  })

  it('offers only owned, non-inherited traditional IRAs for classification', () => {
    const plan = factsPlan()
    const owner = plan.household.people[0]!
    plan.accounts.push(
      {
        type: 'traditional', id: 'employer-plan', name: '401(k)', ownerPersonId: owner.id,
        annualReturnPct: null, kind: 'employer', balance: 10_000, annualContribution: 0,
      },
      {
        type: 'traditional', id: 'inherited-ira', name: 'Inherited IRA',
        ownerPersonId: owner.id, annualReturnPct: null, kind: 'ira', balance: 10_000,
        annualContribution: 0,
        inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: false },
      },
      {
        type: 'roth', id: 'roth-ira', name: 'Roth IRA', ownerPersonId: owner.id,
        annualReturnPct: null, kind: 'ira', balance: 10_000, annualContribution: 0,
      },
    )

    expect(classifiableIraAccounts(plan).map((account) => account.id))
      .toEqual(['second-ira', 'source-ira'])
  })

  it('asks only donors who own a classifiable IRA or already have records', () => {
    const plan = factsPlan()
    const donor = plan.household.people[0]!
    const other = plan.household.people[1]!
    other.dob = DONOR_DOB

    expect(contributionDonors(plan, ACTION_YEAR).map((entry) => entry.person.id))
      .toEqual([donor.id])

    recordDeductibleContribution(plan, other.id, ACTION_YEAR, asUsdCents(0))
    expect(contributionDonors(plan, ACTION_YEAR).map((entry) => entry.person.id))
      .toEqual([donor.id, other.id])

    plan.household.people[0]!.dob = '1990-01-01'
    expect(contributionDonors(plan, ACTION_YEAR).map((entry) => entry.person.id))
      .toEqual([other.id])
  })

  it('keeps the threshold year the Plan itself enforces', () => {
    const plan = factsPlan()
    const donor = plan.household.people[0]!
    recordDeductibleContribution(plan, donor.id, THRESHOLD_YEAR, asUsdCents(0))
    expect(parsePlan(plan).ok).toBe(true)

    recordDeductibleContribution(plan, donor.id, THRESHOLD_YEAR - 1, asUsdCents(0))
    expect(parsePlan(plan).ok).toBe(false)
  })
})
