/**
 * Insights detectors from annuity-pension-and-home-equity decisions (step 5):
 * annuitization headroom for longevity-anxious plans, pending pension
 * lump-sum elections, and HECM buffer candidates for house-rich/portfolio-
 * thin households. Screens are pure (no simulate calls); actions are
 * scenario patches the ledger can apply.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { projectPlan } from '../../planner/useProjection'
import { packForYear } from '../params'
import { applyScenarioPatch } from '../scenarios/scenarios'
import { getArticle, isReadable } from '../../learn/learningRegistry'
import { annuitizationHeadroom } from './detectors/annuitizationHeadroom'
import { hecmBufferCandidate } from './detectors/hecmBufferCandidate'
import { pensionElectionPending } from './detectors/pensionElectionPending'
import type { DetectorContext } from './types'

let counter = 0
const testIds = () => `gid-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function makeContext(plan: Plan): DetectorContext {
  const proj = projectPlan(plan, 2026)
  return {
    plan,
    projection: { result: proj.result, summary: proj.summary, startYear: proj.startYear, deflate: proj.deflate },
    params: packForYear(2026).pack,
  }
}

function basePlan(overrides: { dob?: string; planningAge?: number } = {}): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: overrides.dob ?? '1960-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: overrides.planningAge ?? 96, source: 'manual' },
  }
  plan.expenses.baseAnnual = 40_000
  return plan
}

function cash(balance: number): Account {
  return { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance, annualContribution: 0 }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function expectValidPreview(plan: Plan, cardAction: { kind: string; patch?: Record<string, unknown> }) {
  expect(cardAction.kind).toBe('preview-scenario')
  const applied = applyScenarioPatch(plan, cardAction.patch!)
  expect(applied.ok, applied.ok ? undefined : applied.issues.join('; ')).toBe(true)
}

describe('annuitizationHeadroom', () => {
  it('fires for a longevity-anxious plan with liquid savings and no lifetime income', () => {
    const plan = validate({ ...basePlan(), accounts: [cash(300_000)] })
    const card = annuitizationHeadroom.screen(makeContext(plan))
    expect(card).not.toBeNull()
    expect(card!.id).toBe('annuitization-headroom')
    const article = getArticle(card!.learnSlug!)
    expect(article && isReadable(article)).toBe(true)
    expectValidPreview(plan, card!.action)
  })

  it('stays quiet below the longevity-anxiety threshold, or when lifetime income already exists', () => {
    const modest = validate({ ...basePlan({ planningAge: 88 }), accounts: [cash(300_000)] })
    expect(annuitizationHeadroom.screen(makeContext(modest))).toBeNull()

    const pension: Account = {
      type: 'pension',
      id: testIds(),
      name: 'Pension',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 1_500,
      colaPct: 0,
      survivorPct: 50,
    }
    const covered = validate({ ...basePlan(), accounts: [cash(300_000), pension] })
    expect(annuitizationHeadroom.screen(makeContext(covered))).toBeNull()

    const thin = validate({ ...basePlan(), accounts: [cash(50_000)] })
    expect(annuitizationHeadroom.screen(makeContext(thin))).toBeNull()
  })
})

describe('pensionElectionPending', () => {
  const pension = (offer: boolean, elected: boolean): Account => ({
    type: 'pension',
    id: 'pen1',
    name: 'Company pension',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: 2_000,
    colaPct: 0,
    survivorPct: 0,
    lumpSumOffer: offer ? { amount: 300_000, electionYear: 2027 } : undefined,
    lumpSumElection: elected ? { rolloverAccountId: 'trad1' } : undefined,
  })
  const trad: Account = {
    type: 'traditional',
    id: 'trad1',
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance: 200_000,
    annualContribution: 0,
  }

  it('fires for an undecided offer with a rollover preview and the PV framing', () => {
    const plan = validate({ ...basePlan({ planningAge: 90 }), accounts: [trad, cash(50_000), pension(true, false)] })
    const card = pensionElectionPending.screen(makeContext(plan))
    expect(card).not.toBeNull()
    expect(card!.title).toContain('lump sum')
    expect(card!.rationale).toContain('discount')
    const article = getArticle(card!.learnSlug!)
    expect(article && isReadable(article)).toBe(true)
    expectValidPreview(plan, card!.action)
  })

  it('stays quiet without an offer, once elected, or after the election year', () => {
    const noOffer = validate({ ...basePlan({ planningAge: 90 }), accounts: [trad, pension(false, false)] })
    expect(pensionElectionPending.screen(makeContext(noOffer))).toBeNull()

    const elected = validate({ ...basePlan({ planningAge: 90 }), accounts: [trad, pension(true, true)] })
    expect(pensionElectionPending.screen(makeContext(elected))).toBeNull()

    const stalePension = { ...pension(true, false), lumpSumOffer: { amount: 300_000, electionYear: 2024 } }
    const stale = validate({ ...basePlan({ planningAge: 90 }), accounts: [trad, stalePension] })
    expect(pensionElectionPending.screen(makeContext(stale))).toBeNull()
  })
})

describe('hecmBufferCandidate', () => {
  const home = (hecm: boolean, saleYear: number | null = null): Account => ({
    type: 'property',
    id: 'home1',
    name: 'Home',
    ownerPersonId: null,
    annualReturnPct: null,
    value: 600_000,
    plannedSaleYear: saleYear,
    expectedNetProceeds: null,
    primaryResidence: true,
    hecm: hecm ? { openYear: 2026, growthRatePct: 7.5, drawPolicy: 'coordinated' } : undefined,
  })

  it('fires for a house-rich, portfolio-thin household of HECM age', () => {
    const plan = validate({ ...basePlan({ dob: '1962-01-01', planningAge: 90 }), accounts: [cash(300_000), home(false)] })
    const card = hecmBufferCandidate.screen(makeContext(plan))
    expect(card).not.toBeNull()
    expect(card!.id).toBe('hecm-buffer-candidate')
    expect(card!.rationale).toContain('non-recourse')
    expectValidPreview(plan, card!.action)
  })

  it('stays quiet under 62, with a HECM already modeled, a planned sale, or a dominant portfolio', () => {
    const young = validate({ ...basePlan({ dob: '1970-01-01', planningAge: 90 }), accounts: [cash(300_000), home(false)] })
    expect(hecmBufferCandidate.screen(makeContext(young))).toBeNull()

    const modeled = validate({ ...basePlan({ dob: '1962-01-01', planningAge: 90 }), accounts: [cash(300_000), home(true)] })
    expect(hecmBufferCandidate.screen(makeContext(modeled))).toBeNull()

    const selling = validate({ ...basePlan({ dob: '1962-01-01', planningAge: 90 }), accounts: [cash(300_000), home(false, 2032)] })
    expect(hecmBufferCandidate.screen(makeContext(selling))).toBeNull()

    const rich = validate({ ...basePlan({ dob: '1962-01-01', planningAge: 90 }), accounts: [cash(2_000_000), home(false)] })
    expect(hecmBufferCandidate.screen(makeContext(rich))).toBeNull()
  })
})
