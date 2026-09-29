/**
 * Plan schema v6 -> v7 (decision D-PEOPLE-ORDER, 2026-09-25): no figure may
 * depend on the order a plan lists its people in. v7 names the person whose
 * age the spending phases follow (`expenses.phasesAgeOf`), the person whose age
 * a joint account's contribution schedule follows (`contributionScheduleAgeOf`),
 * and the owner of every pension and annuity. A stored plan is given the
 * person it listed first, which is whose age and life its figures already
 * followed, so an unedited plan projects to the same figures; a qualified
 * annuity takes the owner of the account that paid for it. Every naming is
 * reported, and the load repairs run for a v7 document too.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from './plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { createScenarioPatch } from '../scenarios/patch.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { migratePlanToCurrent, migratePlanV6ToV7, type PlanLoadRepair } from './migrations.js'

const fixedNow = () => new Date('2026-06-29T12:00:00.000Z')
let counter = 0
const ids = () => `v7-${++counter}`

/** A two-person household, Alex listed first and older, as a stored v6 document. */
function couple(): Record<string, unknown> {
  const plan = createEmptyPlan({ newId: ids, now: fixedNow })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'alex', name: 'Alex', dob: '1962-04-15', sex: 'male', retirementAge: 66, longevity: { planningAge: 92, source: 'manual' } },
    { id: 'sam', name: 'Sam', dob: '1964-09-02', sex: 'female', retirementAge: 64, longevity: { planningAge: 95, source: 'manual' } },
  ]
  plan.expenses.baseAnnual = 60_000
  plan.accounts = [
    { type: 'cash', id: 'cash', name: 'Savings', ownerPersonId: null, annualReturnPct: 2, balance: 400_000, annualContribution: 0 },
    { type: 'traditional', id: 'alex-ira', name: 'Alex IRA', ownerPersonId: 'alex', annualReturnPct: null, kind: 'ira', balance: 500_000, annualContribution: 0 },
    { type: 'traditional', id: 'sam-ira', name: 'Sam IRA', ownerPersonId: 'sam', annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0 },
  ]
  const doc = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
  doc['schemaVersion'] = 6
  return doc
}

function load(doc: Record<string, unknown>) {
  const result = migratePlanToCurrent(JSON.parse(JSON.stringify(doc)))
  if (!result.ok) throw new Error(JSON.stringify(result))
  return result
}

const accountsOf = (doc: Record<string, unknown>) => doc['accounts'] as Record<string, unknown>[]
const expensesOf = (doc: Record<string, unknown>) => doc['expenses'] as Record<string, unknown>
const run = (plan: Plan) =>
  simulatePlan(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0.15) })

describe('migratePlanV6ToV7', () => {
  it('changes nothing but the version: the namings are load repairs every document passes', () => {
    const doc = couple()
    expect(migratePlanV6ToV7(doc)).toBe(doc)
    const loaded = load(doc)
    expect(loaded.plan.schemaVersion).toBe(7)
  })
})

describe('spending phases name the person whose age they follow', () => {
  it('names the person listed first, reports it, and moves no figure', () => {
    const doc = couple()
    expensesOf(doc)['phases'] = [{ fromAge: 75, multiplier: 0.9 }]
    const loaded = load(doc)
    expect(loaded.plan.expenses.phasesAgeOf).toBe('alex')
    expect(loaded.repairs).toContainEqual({ kind: 'spendingPhasesPersonNamed', personId: 'alex' })
    // Alex turns 75 in 2037: the phase starts there, on Alex's clock.
    const years = run(loaded.plan).years
    expect(years.find((y) => y.year === 2036)!.expenses.baseSpending).toBeCloseTo(60_000 * Math.pow(1.025, 10), 6)
    expect(years.find((y) => y.year === 2037)!.expenses.baseSpending).toBeCloseTo(60_000 * Math.pow(1.025, 11) * 0.9, 6)
  })

  it('writes the person for every couple but reports it only when there are phases', () => {
    const loaded = load(couple())
    expect(loaded.plan.expenses.phasesAgeOf).toBe('alex')
    expect(loaded.repairs.filter((r) => r.kind === 'spendingPhasesPersonNamed')).toEqual([])
  })

  it('writes nothing for a one-person plan', () => {
    const doc = couple()
    ;(doc['household'] as Record<string, unknown>)['people'] = [
      ((doc['household'] as Record<string, unknown>)['people'] as unknown[])[0],
    ]
    ;(doc['household'] as Record<string, unknown>)['filingStatus'] = 'single'
    accountsOf(doc).splice(2, 1)
    expensesOf(doc)['phases'] = [{ fromAge: 75, multiplier: 0.9 }]
    const loaded = load(doc)
    expect(loaded.plan.expenses.phasesAgeOf).toBeUndefined()
    expect(loaded.repairs).toEqual([])
  })

  it('keeps a named person, and the parse refuses a couple with phases and no person', () => {
    const doc = couple()
    expensesOf(doc)['phases'] = [{ fromAge: 75, multiplier: 0.9 }]
    expensesOf(doc)['phasesAgeOf'] = 'sam'
    expect(load(doc).plan.expenses.phasesAgeOf).toBe('sam')
    const loaded = load(couple()).plan
    const unnamed = { ...loaded, expenses: { ...loaded.expenses, phases: [{ fromAge: 75, multiplier: 0.9 }], phasesAgeOf: undefined } }
    const parsed = parsePlan(unnamed)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues).toContain('expenses.phasesAgeOf: spending phases must name the person whose age they follow')
  })
})

describe('pensions and annuities name an owner', () => {
  it('gives an owner-less pension the person listed first, whose age and life it was already paid on', () => {
    const doc = couple()
    accountsOf(doc).push({ type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: null, annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50 })
    const loaded = load(doc)
    expect(loaded.plan.accounts.find((a) => a.id === 'pension')!.ownerPersonId).toBe('alex')
    expect(loaded.repairs).toContainEqual({
      kind: 'guaranteedIncomeOwnerBackFilled', accountId: 'pension', accountName: 'Pension', accountType: 'pension',
      ownerPersonId: 'alex', basis: 'firstPerson', movesFigures: false,
    })
  })

  it('gives an owner-less qualified annuity the owner of the IRA that paid for it, and says the figures move', () => {
    const doc = couple()
    accountsOf(doc).push({
      type: 'annuity', id: 'qlac', name: 'QLAC', ownerPersonId: null, annualReturnPct: null, startAge: 80, monthlyAmount: 900, colaPct: 0, taxablePct: 100,
      purchase: { year: 2027, premium: 100_000, fundingAccountId: 'sam-ira', taxQualification: 'qualified', qlac: true },
    })
    const loaded = load(doc)
    expect(loaded.plan.accounts.find((a) => a.id === 'qlac')!.ownerPersonId).toBe('sam')
    expect(loaded.repairs).toContainEqual(expect.objectContaining({
      kind: 'guaranteedIncomeOwnerBackFilled', accountId: 'qlac', ownerPersonId: 'sam', basis: 'fundingAccountOwner', movesFigures: true,
    }))
  })

  it('gives an owner-less non-qualified annuity the person listed first', () => {
    const doc = couple()
    accountsOf(doc).push({
      type: 'annuity', id: 'spia', name: 'SPIA', ownerPersonId: null, annualReturnPct: null, startAge: 66, monthlyAmount: 1_000, colaPct: 0, taxablePct: 40,
      purchase: { year: 2027, premium: 150_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
    })
    const loaded = load(doc)
    expect(loaded.plan.accounts.find((a) => a.id === 'spia')!.ownerPersonId).toBe('alex')
    expect(loaded.repairs).toContainEqual(expect.objectContaining({ kind: 'guaranteedIncomeOwnerBackFilled', basis: 'firstPerson', movesFigures: false }))
  })

  it('re-names a qualified annuity bought from the other person’s IRA, and the parse refuses the stored shape', () => {
    const doc = couple()
    accountsOf(doc).push({
      type: 'annuity', id: 'cross', name: 'Cross annuity', ownerPersonId: 'alex', annualReturnPct: null, startAge: 70, monthlyAmount: 800, colaPct: 0, taxablePct: 100,
      purchase: { year: 2027, premium: 90_000, fundingAccountId: 'sam-ira', taxQualification: 'qualified' },
    })
    const loaded = load(doc)
    expect(loaded.plan.accounts.find((a) => a.id === 'cross')!.ownerPersonId).toBe('sam')
    expect(loaded.repairs).toContainEqual({
      kind: 'annuityOwnerMatchedToFundingAccount', accountId: 'cross', accountName: 'Cross annuity',
      fromOwnerPersonId: 'alex', toOwnerPersonId: 'sam', fundingAccountId: 'sam-ira', fundingAccountName: 'Sam IRA',
    })
    const stored = { ...loaded.plan, accounts: loaded.plan.accounts.map((a) => (a.id === 'cross' ? { ...a, ownerPersonId: 'alex' } : a)) }
    const parsed = parsePlan(stored)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('; ')).toContain("an annuity bought from an IRA or 401(k) belongs to that account's owner: make Sam its annuitant, or buy it from one of Alex's own accounts")
    }
  })

  it('keeps a surviving spouse’s purchase from the dead owner’s IRA, and never names the dead (review M2)', () => {
    // Alex's planning age 68 ends in 2030; the purchase from Alex's IRA is in
    // 2032, after Alex's death, so the living purchaser is Sam.
    const purchase = { year: 2032, premium: 120_000, fundingAccountId: 'alex-ira', taxQualification: 'qualified' }
    const withContract = (ownerPersonId: string | null) => {
      const doc = couple()
      ;((doc['household'] as Record<string, unknown>)['people'] as Record<string, unknown>[])[0]!['longevity'] = { planningAge: 68, source: 'manual' }
      accountsOf(doc).push({
        type: 'annuity', id: 'after', name: 'After-death annuity', ownerPersonId, annualReturnPct: null, startAge: 70, monthlyAmount: 1_500, colaPct: 0, taxablePct: 100, purchase,
      })
      return load(doc)
    }
    // Named for Sam, as the base build accepted it: no repair, and it parses.
    const named = withContract('sam')
    expect(named.plan.accounts.find((a) => a.id === 'after')!.ownerPersonId).toBe('sam')
    expect(named.repairs.filter((r) => 'accountId' in r && r.accountId === 'after')).toEqual([])
    // Named for Alex, who has died: re-named to Sam, and the notice says figures change.
    const dead = withContract('alex')
    expect(dead.plan.accounts.find((a) => a.id === 'after')!.ownerPersonId).toBe('sam')
    expect(dead.repairs).toContainEqual({
      kind: 'annuityOwnerNamedSurvivingSpouse', accountId: 'after', accountName: 'After-death annuity',
      fromOwnerPersonId: 'alex', toOwnerPersonId: 'sam', fundingAccountId: 'alex-ira', fundingAccountName: 'Alex IRA', purchaseYear: 2032,
    })
    // Owner-less: the surviving spouse, never the dead funding owner.
    const unnamed = withContract(null)
    expect(unnamed.plan.accounts.find((a) => a.id === 'after')!.ownerPersonId).toBe('sam')
    expect(unnamed.repairs).toContainEqual(expect.objectContaining({
      kind: 'guaranteedIncomeOwnerBackFilled', accountId: 'after', ownerPersonId: 'sam', basis: 'survivingSpouse', movesFigures: true,
    }))
  })

  it('removes a purchase nobody is alive to buy, keeps the premium, and says the figures change (review N1)', () => {
    // Both planning ages end before the 2032 purchase (Alex's in 2030, Sam's
    // in 2031): a qualified purchase from Alex's IRA has no living buyer.
    const doc = couple()
    const people = (doc['household'] as Record<string, unknown>)['people'] as Record<string, unknown>[]
    people[0]!['longevity'] = { planningAge: 68, source: 'manual' }
    people[1]!['longevity'] = { planningAge: 67, source: 'manual' }
    const without = load(doc)
    accountsOf(doc).push({
      type: 'annuity', id: 'nobody', name: 'Nobody annuity', ownerPersonId: 'alex', annualReturnPct: null, startAge: 70, monthlyAmount: 1_500, colaPct: 0, taxablePct: 100,
      purchase: { year: 2032, premium: 120_000, fundingAccountId: 'alex-ira', taxQualification: 'qualified' },
    })
    const loaded = load(doc)
    expect(loaded.plan.accounts.map((a) => a.id)).not.toContain('nobody')
    expect(loaded.repairs).toContainEqual({
      kind: 'annuityPurchaseDropped', accountId: 'nobody', accountName: 'Nobody annuity', annuitantPersonId: 'alex',
      annuitantLastYearAlive: 2030, purchaseYear: 2032, fundingAccountId: 'alex-ira', fundingAccountName: 'Alex IRA',
    })
    // The premium stays in the IRA: the ledger is the plan without the contract.
    expect(JSON.stringify(run(loaded.plan).years)).toBe(JSON.stringify(run(without.plan).years))
  })

  it('gives a non-qualified purchase made after its annuitant’s death to the living spouse, the only one who could buy it (review N1)', () => {
    // The review's case: Alex's planning age 68 ends in 2030, and a SPIA bought
    // in 2032 from the joint cash is named for Alex. The previous build opened
    // it and paid nothing on it; the parse now refuses that shape, so the load
    // names Sam, alive in 2032.
    const withSpia = (ownerPersonId: string | null) => {
      const doc = couple()
      ;((doc['household'] as Record<string, unknown>)['people'] as Record<string, unknown>[])[0]!['longevity'] = { planningAge: 68, source: 'manual' }
      accountsOf(doc).push({
        type: 'annuity', id: 'late-spia', name: 'Late SPIA', ownerPersonId, annualReturnPct: null, startAge: 68, monthlyAmount: 700, colaPct: 0, taxablePct: 40,
        purchase: { year: 2032, premium: 100_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
      })
      return doc
    }
    const raw = migratePlanToCurrent(JSON.parse(JSON.stringify(withSpia('alex'))))
    expect(raw.ok ? 'opens' : JSON.stringify(raw)).toBe('opens')
    const named = load(withSpia('alex'))
    expect(named.plan.accounts.find((a) => a.id === 'late-spia')!.ownerPersonId).toBe('sam')
    expect(named.repairs).toContainEqual({
      kind: 'annuityOwnerNamedLivingPerson', accountId: 'late-spia', accountName: 'Late SPIA',
      fromOwnerPersonId: 'alex', toOwnerPersonId: 'sam', purchaseYear: 2032, fromOwnerLastYearAlive: 2030,
    })
    // Sam (born 1964) is 68 in 2032: the contract pays from its purchase.
    const years = run(named.plan).years
    expect(years.find((y) => y.year === 2031)!.incomes.annuity).toBe(0)
    expect(years.find((y) => y.year === 2032)!.incomes.annuity).toBeGreaterThan(0)
    // Owner-less, the person listed first is dead at the purchase: Sam again.
    const unnamed = load(withSpia(null))
    expect(unnamed.plan.accounts.find((a) => a.id === 'late-spia')!.ownerPersonId).toBe('sam')
    expect(unnamed.repairs).toContainEqual({
      kind: 'guaranteedIncomeOwnerBackFilled', accountId: 'late-spia', accountName: 'Late SPIA', accountType: 'annuity',
      ownerPersonId: 'sam', basis: 'livingPerson', purchaseYear: 2032, movesFigures: true,
    })
    // Named for Sam, who is alive: nothing to repair.
    expect(load(withSpia('sam')).repairs.filter((r) => 'accountId' in r && r.accountId === 'late-spia')).toEqual([])
  })

  it('removes a one-person plan’s purchase made after its only person’s death (review N1)', () => {
    const doc = couple()
    const household = doc['household'] as Record<string, unknown>
    household['filingStatus'] = 'single'
    household['people'] = [{ ...(household['people'] as Record<string, unknown>[])[0]!, longevity: { planningAge: 68, source: 'manual' } }]
    doc['accounts'] = accountsOf(doc).filter((a) => a['id'] !== 'sam-ira')
    accountsOf(doc).push({
      type: 'annuity', id: 'late', name: 'Late SPIA', ownerPersonId: 'alex', annualReturnPct: null, startAge: 70, monthlyAmount: 700, colaPct: 0, taxablePct: 40,
      purchase: { year: 2031, premium: 50_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
    })
    const loaded = load(doc)
    expect(loaded.plan.accounts.map((a) => a.id)).not.toContain('late')
    expect(loaded.repairs).toContainEqual(expect.objectContaining({ kind: 'annuityPurchaseDropped', accountId: 'late', fundingAccountName: 'Savings' }))
  })

  it('drops a pension lump sum rolled into the spouse’s IRA, keeps the offer, and the parse refuses it', () => {
    const doc = couple()
    doc['updatedAtIso'] = '2026-06-29T12:00:00.000Z'
    accountsOf(doc).push({
      type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'alex', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50,
      lumpSumOffer: { amount: 300_000, electionYear: 2027 },
      lumpSumElection: { rolloverAccountId: 'sam-ira' },
    })
    const loaded = load(doc)
    const pension = loaded.plan.accounts.find((a) => a.id === 'pension')!
    expect(pension.type === 'pension' && pension.lumpSumElection).toBeFalsy()
    expect(pension.type === 'pension' && pension.lumpSumOffer).toBeTruthy()
    expect(loaded.repairs).toContainEqual({
      kind: 'lumpSumElectionDroppedSpouseTarget', accountId: 'pension', accountName: 'Pension',
      targetAccountId: 'sam-ira', targetAccountName: 'Sam IRA', ownerPersonId: 'alex', targetOwnerPersonId: 'sam',
    })
    const elected = { ...loaded.plan, accounts: loaded.plan.accounts.map((a) => (a.id === 'pension' ? { ...a, lumpSumElection: { rolloverAccountId: 'sam-ira' } } : a)) }
    const parsed = parsePlan(elected)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('; ')).toContain("a pension lump sum rolls over only into an IRA or 401(k) of the person who earned it: choose one of Alex's own traditional accounts")
    }
  })

  it('repairs an owner-less annuity in a v7 document too, since the repairs run at every load', () => {
    const doc = couple()
    doc['schemaVersion'] = 7
    accountsOf(doc).push({ type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: null, annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50 })
    expect(load(doc).plan.accounts.find((a) => a.id === 'pension')!.ownerPersonId).toBe('alex')
  })

  it('retargets an inherited-IRA premium only to the annuitant’s own IRA, and otherwise stands the purchase down', () => {
    const inherited = {
      type: 'traditional', id: 'inherited', name: 'Inherited IRA', ownerPersonId: 'alex', annualReturnPct: null, kind: 'ira', balance: 200_000, annualContribution: 0,
      inherited: { decedentId: 'mom', ownerBirthYear: 1935, ownerDeathYear: 2024, decedentHadStartedRmds: true, beneficiaryClass: 'designated-individual', beneficiaryBirthYear: 1962, soleBeneficiary: true, edbCategory: 'none' },
    }
    const contract = {
      type: 'annuity', id: 'contract', name: 'Contract', ownerPersonId: 'alex', annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 100,
      purchase: { year: 2027, premium: 50_000, fundingAccountId: 'inherited', taxQualification: 'qualified' },
    }
    const withOwn = couple()
    accountsOf(withOwn).push(inherited, contract)
    const own = load(withOwn)
    expect(own.repairs).toContainEqual(expect.objectContaining({ kind: 'annuityPremiumRetargeted', toAccountId: 'alex-ira' }))
    const onlySpouse = couple()
    accountsOf(onlySpouse).splice(1, 1)
    accountsOf(onlySpouse).push(inherited, contract)
    const stood = load(onlySpouse)
    expect(stood.repairs).toContainEqual(expect.objectContaining({ kind: 'annuityPurchaseStoodDown', accountId: 'contract' }))
  })
})

describe('a joint account’s contribution schedule names whose age it follows', () => {
  it('names the person listed first in a couple, reports it, and not in a one-person plan', () => {
    const doc = couple()
    accountsOf(doc).push({
      type: 'taxable', id: 'brk', name: 'Joint brokerage', ownerPersonId: null, annualReturnPct: null, balance: 10_000, costBasis: 10_000, annualContribution: 0,
      contributionSchedule: [{ annualAmount: 5_000, fromAge: 60, toAge: 65, escalationPct: 0 }],
    })
    const loaded = load(doc)
    const brk = loaded.plan.accounts.find((a) => a.id === 'brk')!
    expect(brk.type === 'taxable' && brk.contributionScheduleAgeOf).toBe('alex')
    expect(loaded.repairs).toContainEqual({ kind: 'contributionSchedulePersonNamed', accountId: 'brk', accountName: 'Joint brokerage', personId: 'alex' })
  })
})

describe('stored scenarios follow the naming', () => {
  it('names the owner in a scenario’s account lists, so a scenario written before the naming still applies', () => {
    const base = couple()
    base['schemaVersion'] = 7
    accountsOf(base).push({ type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'alex', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50 })
    const basePlan = load(base).plan
    const edited = structuredClone(basePlan)
    edited.accounts = edited.accounts.map((a) => (a.id === 'cash' ? { ...a, balance: 450_000 } : a))
    const envelope = createScenarioPatch(basePlan, edited, { title: 'More cash', createdAtIso: '2026-06-29T12:00:00.000Z', actor: { kind: 'user' } })
    if (!envelope.ok) throw new Error(envelope.issues.join('; '))
    // The stored document as it was before v7: the pension and the scenario's
    // copies of it carry no owner.
    const stored = JSON.parse(JSON.stringify({ ...basePlan, scenarios: [{ id: 's1', name: 'More cash', patch: envelope.patch }] })) as Record<string, unknown>
    stored['schemaVersion'] = 6
    const unown = (list: unknown) => (list as Record<string, unknown>[]).map((a) => (a['id'] === 'pension' ? { ...a, ownerPersonId: null } : a))
    stored['accounts'] = unown(stored['accounts'])
    const op = ((stored['scenarios'] as Record<string, unknown>[])[0]!['patch'] as Record<string, unknown>)['operations'] as Record<string, unknown>[]
    const accountsOp = op.find((o) => o['path'] === '/accounts')!
    accountsOp['value'] = unown(accountsOp['value'])
    ;(accountsOp['before'] as Record<string, unknown>)['value'] = unown((accountsOp['before'] as Record<string, unknown>)['value'])
    const loaded = load(stored)
    const applied = applyScenarioPatch(loaded.plan, loaded.plan.scenarios[0]!.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.accounts.find((a) => a.id === 'pension')!.ownerPersonId).toBe('alex')
  })
})

describe('what the repairs report', () => {
  it('reports every naming as facts a host can phrase', () => {
    const doc = couple()
    expensesOf(doc)['phases'] = [{ fromAge: 75, multiplier: 0.9 }]
    accountsOf(doc).push({ type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: null, annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50 })
    const kinds = load(doc).repairs.map((r: PlanLoadRepair) => r.kind)
    expect(kinds).toEqual(['guaranteedIncomeOwnerBackFilled', 'spendingPhasesPersonNamed'])
  })
})
