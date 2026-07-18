import { describe, expect, it } from 'vitest'

import type { Account, IncomeStream, Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  socialSecurityIncome,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { buildHouseholdGraph, UNSUPPORTED_RELATIONSHIPS } from './householdGraph.js'

function nodeById(graph: ReturnType<typeof buildHouseholdGraph>, id: string) {
  const node = graph.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`node ${id} not found in [${graph.nodes.map((n) => n.id).join(', ')}]`)
  return node
}

function edgeIds(graph: ReturnType<typeof buildHouseholdGraph>): string[] {
  return graph.edges.map((e) => e.id)
}

// --- fixtures ---------------------------------------------------------------

function singleFixture(): Plan {
  const plan = singlePersonPlan({ retirementAge: 66, planningAge: 90 })
  plan.accounts = [cashAccount('cash', 20_000), traditionalAccount('ira', 400_000, 'p1')]
  plan.incomes = [socialSecurityIncome('ss1', 2_000, 67, 'p1')]
  plan.expenses.baseAnnual = 40_000
  return validatePlan(plan)
}

function coupleFixture(): Plan {
  const plan = couplePlan({ p1RetirementAge: 65, p2RetirementAge: 65, p1PlanningAge: 92, p2PlanningAge: 94 })
  const pension: Account = {
    type: 'pension',
    id: 'pen',
    name: 'State pension',
    ownerPersonId: 'p2',
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: 1_500,
    colaPct: 0,
    survivorPct: 50,
  }
  plan.accounts = [
    taxableAccount('brokerage', 250_000, 100_000),
    traditionalAccount('ira1', 300_000, 'p1'),
    traditionalAccount('ira2', 150_000, 'p2'),
    pension,
  ]
  plan.incomes = [socialSecurityIncome('ss1', 2_400, 67, 'p1'), socialSecurityIncome('ss2', 1_100, 67, 'p2')]
  plan.expenses.baseAnnual = 60_000
  return validatePlan(plan)
}

/**
 * Blended-family-like: a couple where one member carries former-spouse records
 * (divorced + deceased), accounts pass to non-spouse heirs and charity, and a
 * life policy names the other member as beneficiary.
 */
function blendedFixture(): Plan {
  const plan = coupleFixture()
  const ss1 = plan.incomes.find((s) => s.id === 'ss1') as Extract<IncomeStream, { type: 'socialSecurity' }>
  ss1.formerSpouses = [
    { id: 'fs1', relationship: 'divorced', dob: '1963-04-01', piaMonthly: 2_800, marriageYears: 12, remarriedAtAge: null },
    { id: 'fs2', relationship: 'deceased', dob: '1960-09-01', piaMonthly: 2_200, marriageYears: 11, remarriedAtAge: 61 },
  ]
  const ira1 = plan.accounts.find((a) => a.id === 'ira1')!
  ira1.estateBeneficiary = { destination: 'nonSpouse' }
  const brokerage = plan.accounts.find((a) => a.id === 'brokerage')!
  brokerage.estateBeneficiary = { destination: 'charity', charityPct: 30 }
  plan.insurance = [
    {
      kind: 'permanentLife',
      id: 'life1',
      name: 'Whole life',
      insured: 'p1',
      beneficiary: 'p2',
      annualPremium: 3_000,
      premiumMode: 'lifetime',
      deathBenefit: 250_000,
      cashValue: 40_000,
      cashValueMode: 'flatRate',
      cashValueGrowthPct: 3,
    },
  ]
  return validatePlan(plan)
}

function propertiesFixture(): Plan {
  const plan = coupleFixture()
  const home: Account = {
    type: 'property',
    id: 'home',
    name: 'Primary home',
    ownerPersonId: null,
    annualReturnPct: 3,
    value: 500_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
  }
  const rental: Account = {
    type: 'property',
    id: 'rental',
    name: 'Rental duplex',
    ownerPersonId: 'p1',
    annualReturnPct: 3,
    value: 320_000,
    plannedSaleYear: 2035,
    expectedNetProceeds: null,
  }
  const mortgage: Account = {
    type: 'debt',
    id: 'mortgage',
    name: 'Mortgage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 180_000,
    interestPct: 4.5,
    monthlyPayment: 1_400,
  }
  plan.accounts = [...plan.accounts, home, rental, mortgage]
  return validatePlan(plan)
}

// --- tests ------------------------------------------------------------------

describe('buildHouseholdGraph', () => {
  it('is deterministic: identical plans produce deep-equal graphs', () => {
    expect(buildHouseholdGraph(blendedFixture())).toEqual(buildHouseholdGraph(blendedFixture()))
  })

  it('single: stable ids, ownership edges, and entered-value totals', () => {
    const graph = buildHouseholdGraph(singleFixture())
    expect(nodeById(graph, 'person:p1').label).toBe('Pat')
    expect(nodeById(graph, 'acct:ira').kind).toBe('account')
    // Joint (ownerPersonId null) cash in a single household: one edge from the sole person.
    expect(edgeIds(graph)).toContain('owns:person:p1->acct:cash')
    expect(edgeIds(graph)).toContain('owns:person:p1->acct:ira')
    expect(edgeIds(graph)).toContain('receives:person:p1->inc:ss1')
    expect(graph.totals).toEqual({ investable: 420_000, property: 0, assets: 420_000, liabilities: 0, netWorth: 420_000 })
  })

  it('couple: joint ownership emits one flagged edge per member', () => {
    const graph = buildHouseholdGraph(coupleFixture())
    const jointEdges = graph.edges.filter((e) => e.kind === 'owns' && e.to === 'acct:brokerage')
    expect(jointEdges.map((e) => e.from).sort()).toEqual(['person:p1', 'person:p2'])
    expect(jointEdges.every((e) => e.joint === true)).toBe(true)
    // Individually owned IRA: exactly one un-flagged edge.
    const iraEdges = graph.edges.filter((e) => e.kind === 'owns' && e.to === 'acct:ira1')
    expect(iraEdges).toEqual([{ id: 'owns:person:p1->acct:ira1', kind: 'owns', from: 'person:p1', to: 'acct:ira1' }])
  })

  it('couple: a >0% survivor pension emits a categorical survivor edge, never a person edge', () => {
    const graph = buildHouseholdGraph(coupleFixture())
    const survivor = graph.edges.filter((e) => e.kind === 'survivor')
    expect(survivor).toEqual([{ id: 'survivor:acct:pen->estate:spouse', kind: 'survivor', from: 'acct:pen', to: 'estate:spouse', label: '50%' }])
    expect(nodeById(graph, 'estate:spouse').kind).toBe('estate')
  })

  it('blended-family-like: former spouses, charity split, and a named life beneficiary', () => {
    const graph = buildHouseholdGraph(blendedFixture())
    // Former spouses are unnamed benefit-source records attached to the claimant.
    expect(nodeById(graph, 'fs:ss1:fs1').label).toBe('Former spouse (living)')
    expect(nodeById(graph, 'fs:ss1:fs2').subtype).toBe('deceased')
    expect(edgeIds(graph)).toContain('formerSpouseOf:fs:ss1:fs1->person:p1')
    // Charity destination splits: pct to charity, remainder to heirs.
    const charity = graph.edges.find((e) => e.id === 'beneficiary:acct:brokerage->estate:charity')
    expect(charity?.label).toBe('30%')
    expect(edgeIds(graph)).toContain('beneficiary:acct:brokerage->estate:heir')
    expect(edgeIds(graph)).toContain('beneficiary:acct:ira1->estate:heir')
    // Life policy: covers the insured, beneficiary edge to the named household person.
    expect(edgeIds(graph)).toContain('covers:ins:life1->person:p1')
    expect(edgeIds(graph)).toContain('beneficiary:ins:life1->person:p2')
    expect(nodeById(graph, 'ins:life1').amount).toBe(250_000)
    expect(nodeById(graph, 'ins:life1').amountKind).toBe('deathBenefit')
  })

  it('multiple properties: values and debts land in totals as entered', () => {
    const graph = buildHouseholdGraph(propertiesFixture())
    expect(nodeById(graph, 'acct:home').kind).toBe('property')
    expect(nodeById(graph, 'acct:mortgage').amountKind).toBe('owed')
    expect(graph.totals.investable).toBe(700_000)
    expect(graph.totals.property).toBe(820_000)
    expect(graph.totals.liabilities).toBe(180_000)
    expect(graph.totals.netWorth).toBe(700_000 + 820_000 - 180_000)
    // A planned sale with neither basis nor proceeds estimate is flagged.
    expect(nodeById(graph, 'acct:rental').completeness).toEqual({
      state: 'partial',
      missing: ['Planned sale has no cost basis or net-proceeds estimate'],
    })
    // The home has no planned sale — nothing to flag.
    expect(nodeById(graph, 'acct:home').completeness.state).toBe('complete')
  })

  it('missing beneficiary: investable accounts without an estate destination are partial', () => {
    const graph = buildHouseholdGraph(coupleFixture())
    expect(nodeById(graph, 'acct:ira1').completeness).toEqual({
      state: 'partial',
      missing: ['No estate destination set — the legacy default applies'],
    })
    // Setting a destination clears the flag (blended fixture sets ira1 + brokerage).
    const blended = buildHouseholdGraph(blendedFixture())
    expect(nodeById(blended, 'acct:ira1').completeness.state).toBe('complete')
    // Non-investable kinds (pension) are never asked for an estate destination.
    expect(nodeById(graph, 'acct:pen').completeness.state).toBe('complete')
  })

  it('social security without PIA or earnings is unknown, not guessed', () => {
    const plan = singleFixture()
    const ss = plan.incomes.find((s) => s.id === 'ss1') as Extract<IncomeStream, { type: 'socialSecurity' }>
    ss.piaMonthly = null
    ss.earnings = null
    const graph = buildHouseholdGraph(plan)
    const node = nodeById(graph, 'inc:ss1')
    expect(node.completeness.state).toBe('unknown')
    expect(node.amount).toBeNull()
  })

  it('a person with no social security record is flagged', () => {
    const plan = coupleFixture()
    plan.incomes = plan.incomes.filter((s) => !(s.type === 'socialSecurity' && s.personId === 'p2'))
    const graph = buildHouseholdGraph(validatePlan(plan))
    expect(nodeById(graph, 'person:p2').completeness.missing).toContain('No Social Security record entered')
    expect(nodeById(graph, 'person:p1').completeness.state).toBe('complete')
  })

  it('funding edges: annuity purchase and TIPS ladder purchase point from the funding account', () => {
    const plan = coupleFixture()
    const annuity: Account = {
      type: 'annuity',
      id: 'spia',
      name: 'SPIA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 70,
      monthlyAmount: 900,
      colaPct: 0,
      taxablePct: 60,
      purchase: { year: 2030, premium: 150_000, fundingAccountId: 'brokerage', taxQualification: 'nonQualified' },
    }
    plan.accounts = [...plan.accounts, annuity]
    plan.incomeFloor = {
      ladders: [
        {
          id: 'lad1',
          name: 'SS bridge ladder',
          purpose: 'bridge',
          startYear: 2031,
          endYear: 2035,
          annualRealAmount: 24_000,
          purchase: { year: 2030, fundingAccountId: 'brokerage' },
        },
      ],
    }
    const graph = buildHouseholdGraph(validatePlan(plan))
    expect(edgeIds(graph)).toContain('funds:acct:brokerage->acct:spia')
    expect(edgeIds(graph)).toContain('funds:acct:brokerage->ladder:lad1')
    expect(nodeById(graph, 'ladder:lad1').editSurface).toBe('incomeFloor')
    // A purchased annuity is guaranteed income, not part of investable totals.
    expect(graph.totals.investable).toBe(700_000)
  })

  it('estate nodes appear only when referenced', () => {
    const single = buildHouseholdGraph(singleFixture())
    expect(single.nodes.filter((n) => n.kind === 'estate')).toEqual([])
    const blended = buildHouseholdGraph(blendedFixture())
    expect(blended.nodes.filter((n) => n.kind === 'estate').map((n) => n.subtype)).toEqual(['spouse', 'heir', 'charity'])
  })

  it('every node carries provenance and an edit surface', () => {
    const graph = buildHouseholdGraph(blendedFixture())
    for (const node of graph.nodes) {
      expect(node.source.length).toBeGreaterThan(0)
      expect(node.editSurface.length).toBeGreaterThan(0)
    }
    expect(nodeById(graph, 'person:p1').source).toBe('household.people[0]')
    expect(nodeById(graph, 'acct:brokerage').source).toBe('accounts[0]')
  })

  it('states its unsupported relationships — the full audit-table set, in order', () => {
    const graph = buildHouseholdGraph(singleFixture())
    expect(graph.unsupported).toBe(UNSUPPORTED_RELATIONSHIPS)
    // One entry per row of the not-expressible table in
    // DOCS/features/household-map.md — keep the two in lockstep.
    expect(graph.unsupported.map((u) => u.id)).toEqual([
      'dependents',
      'trusts-entities',
      'named-beneficiaries',
      'contingent-beneficiaries',
      'household-size',
      'partner-legal-relationship',
      'former-spouses-as-people',
      'other-insurance',
      'debt-collateral',
      'income-asset-linkage',
      'estate-documents',
    ])
  })

  it('edge ids are globally unique in every fixture', () => {
    for (const plan of [singleFixture(), coupleFixture(), blendedFixture(), propertiesFixture()]) {
      const ids = edgeIds(buildHouseholdGraph(plan))
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('spouse destination + sole-beneficiary assertion emits one labeled edge, not two colliding ids', () => {
    const plan = coupleFixture()
    const ira1 = plan.accounts.find((a) => a.id === 'ira1')!
    ira1.estateBeneficiary = { destination: 'spouse' }
    if (ira1.type === 'traditional') ira1.spouseSoleBeneficiary = true
    const graph = buildHouseholdGraph(validatePlan(plan))
    const spouseEdges = graph.edges.filter((e) => e.from === 'acct:ira1' && e.to === 'estate:spouse')
    expect(spouseEdges).toEqual([
      {
        id: 'beneficiary:acct:ira1->estate:spouse',
        kind: 'beneficiary',
        from: 'acct:ira1',
        to: 'estate:spouse',
        label: 'sole beneficiary',
      },
    ])
    const ids = edgeIds(graph)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a sole-beneficiary assertion still shows when the estate destination points elsewhere', () => {
    const plan = coupleFixture()
    const ira1 = plan.accounts.find((a) => a.id === 'ira1')!
    ira1.estateBeneficiary = { destination: 'nonSpouse' }
    if (ira1.type === 'traditional') ira1.spouseSoleBeneficiary = true
    const graph = buildHouseholdGraph(validatePlan(plan))
    expect(edgeIds(graph)).toContain('beneficiary:acct:ira1->estate:heir')
    const sole = graph.edges.find((e) => e.id === 'beneficiary:acct:ira1->estate:spouse')
    expect(sole?.label).toBe('sole beneficiary')
  })

  it('single-person plans never draw a spouse: stale survivor/beneficiary fields are flagged instead', () => {
    const plan = singleFixture()
    const cash = plan.accounts.find((a) => a.id === 'cash')!
    cash.estateBeneficiary = { destination: 'spouse' }
    const ira = plan.accounts.find((a) => a.id === 'ira')!
    if (ira.type === 'traditional') ira.spouseSoleBeneficiary = true
    const pension: Account = {
      type: 'pension',
      id: 'solo-pen',
      name: 'Old employer pension',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 800,
      colaPct: 0,
      survivorPct: 50,
    }
    plan.accounts = [...plan.accounts, pension]
    const graph = buildHouseholdGraph(validatePlan(plan))
    // No spouse node, no survivor or spouse-beneficiary edges.
    expect(graph.nodes.filter((n) => n.kind === 'estate')).toEqual([])
    expect(graph.edges.filter((e) => e.kind === 'survivor' || e.to === 'estate:spouse')).toEqual([])
    // Each stale field surfaces as an attention fact.
    expect(nodeById(graph, 'acct:cash').completeness.missing).toContain(
      'Estate destination is the surviving spouse, but the plan has no second person',
    )
    expect(nodeById(graph, 'acct:ira').completeness.missing).toContain(
      'Marked spouse-as-sole-beneficiary, but the plan has no second person',
    )
    expect(nodeById(graph, 'acct:solo-pen').completeness.missing).toContain(
      'Survivor continuation recorded (50%) but the plan has no second person',
    )
  })

  it('an empty earnings array counts as no earnings record (mirrors simulate)', () => {
    const plan = singleFixture()
    const ss = plan.incomes.find((s) => s.id === 'ss1') as Extract<IncomeStream, { type: 'socialSecurity' }>
    ss.piaMonthly = null
    ss.earnings = []
    const graph = buildHouseholdGraph(validatePlan(plan))
    expect(nodeById(graph, 'inc:ss1').completeness.state).toBe('unknown')
  })

  it('estate destination nodes carry the provenance of what referenced them', () => {
    // 'estate' is only reachable via a permanent-life beneficiary.
    const plan = coupleFixture()
    plan.insurance = [
      {
        kind: 'permanentLife',
        id: 'life-estate',
        name: 'Legacy policy',
        insured: 'p1',
        beneficiary: 'estate',
        annualPremium: 1_000,
        premiumMode: 'lifetime',
        deathBenefit: 100_000,
        cashValue: 0,
        cashValueMode: 'flatRate',
        cashValueGrowthPct: 0,
      },
    ]
    const graph = buildHouseholdGraph(validatePlan(plan))
    const estate = nodeById(graph, 'estate:estate')
    expect(estate.editSurface).toBe('insurance')
    expect(estate.source).toBe('insurance[0].beneficiary')
    // Account-referenced destinations point back at account fields.
    const spouse = nodeById(graph, 'estate:spouse') // via the pension's survivorPct
    expect(spouse.editSurface).toBe('accounts')
    expect(spouse.source).toBe('accounts[3].survivorPct')
    const blended = buildHouseholdGraph(blendedFixture())
    expect(nodeById(blended, 'estate:charity').source).toBe('accounts[0].estateBeneficiary')
  })

  it('a HECM line of credit surfaces as a note on its property node', () => {
    const plan = propertiesFixture()
    const home = plan.accounts.find((a) => a.id === 'home')!
    if (home.type === 'property') {
      home.hecm = { openYear: 2032, growthRatePct: 7, drawPolicy: 'coordinated' }
    }
    const graph = buildHouseholdGraph(validatePlan(plan))
    expect(nodeById(graph, 'acct:home').notes).toEqual(['HECM line of credit (opened 2032)'])
    // Properties without one carry no notes.
    expect(nodeById(graph, 'acct:rental').notes).toEqual([])
  })
})
