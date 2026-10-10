/** @vitest-environment jsdom */
/**
 * The Optimize page's claim-age card when the co-optimization refuses
 * (B2-P1 slice 5): a plan with a Marketplace year whose premium credit cannot
 * be priced gets the Social Security page's plain-words refusal, each year
 * with its reason, and a plan whose claims were all made before it starts is
 * told who claimed and when. Neither offers a claim change to apply.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { ClaimAgeCoOptimization } from '@retiregolden/engine/projection/optimizePlan'
import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'

vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))

import { runOptimize } from '../optimize/runner'
import type { OptimizeResult } from '../optimize/messages'
import { OptimizePage } from './OptimizePage'

const mockedRunOptimize = vi.mocked(runOptimize)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function mount(plan: Plan) {
  const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>
          <OptimizePage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
}

function resultWith(claimAge: ClaimAgeCoOptimization): OptimizeResult {
  return {
    schedule: { status: 'infeasible', endingAfterTax: null, lifetimeTax: null, schedule: [], conversions: [], conversionTotal: 0, solveMs: 1, projectionDepletionYear: null },
    postProcessed: null,
    tournament: {
      policyId: 'max-after-tax-estate',
      winnerSource: 'none',
      winnerCandidateId: null,
      winnerLabel: '',
      winnerConversions: [],
      winnerValidation: null,
      marginOverMilpDollars: 0,
      candidates: [],
      retirementActionReadinessVeto: null,
      retirementActionPromotion: null,
      acaActionabilityVeto: null,
      searchRefined: false,
      searchSimulations: 0,
    },
    convergence: {},
    claimAge,
  } as unknown as OptimizeResult
}

const base = { enabled: true, combinationsEvaluated: 1, winningClaimLabel: null, winningClaimPatch: null, jointExactEstate: 1_000_000, currentClaimExactEstate: 1_000_000, claimChangeEstateGain: 0, estateYear: 2060 }
const text = () => (container.textContent ?? '').replace(/\s+/gu, ' ')

describe('the claim-age card when the co-optimization refuses', () => {
  it('names each unpriced credit year with its own reason', async () => {
    mockedRunOptimize.mockResolvedValue(resultWith({
      ...base,
      outcome: 'aca-unpriced',
      unpricedAca: [
        { year: 2026, reasons: ['below-100-fpl-exception-unsupported'] },
        { year: 2027, reasons: ['fixed-point-nonconvergent'] },
        { year: 2028, reasons: ['tax-year-parameters-unsupported'] },
        { year: 2029, reasons: ['tax-year-parameters-unsupported'] },
      ],
      alreadyClaimed: [],
    }))
    await mount(createSamplePlan())
    const page = text()
    expect(page).toContain(
      "Social Security claim age not searched. Your plan's premium tax credit can't be priced in 2026 (income is below the poverty line, where there is generally no credit and Medicaid may apply); 2027 (the credit and the income it depends on didn't settle on one value in that year); 2028 and 2029 (RetireGolden doesn't have the credit's figures for those years yet). " +
        'All of your Social Security counts in the income that credit depends on, in the years it is paid, so a credit left unpriced there could change which claim age comes out ahead, in either direction.',
    )
    expect(page).not.toContain('Recommended claim change')
    expect(page).not.toContain('none beat your current claim ages')
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'Apply claim change')).toBe(false)
  })

  it('says who claimed and when when every claim was already made', async () => {
    const plan = createSamplePlan()
    const person = plan.household.people[0]!
    mockedRunOptimize.mockResolvedValue(resultWith({
      ...base,
      outcome: 'already-claimed',
      unpricedAca: [],
      alreadyClaimed: [{ personId: person.id, streamId: 'ss', claimAge: { years: 67, months: 0 }, claimYear: 2020 }],
    }))
    await mount(plan)
    expect(text()).toContain(`Social Security claim age not searched: ${person.name} claimed at 67 in 2020, before the plan starts`)
    expect(text()).not.toContain('none beat your current claim ages')
  })

  it('says no claim age was left to try, never "1 claim combinations" (L7)', async () => {
    mockedRunOptimize.mockResolvedValue(resultWith({ ...base, outcome: 'no-age-left', unpricedAca: [], alreadyClaimed: [] }))
    await mount(createSamplePlan())
    const card = container.querySelector('[data-claim-age-outcome="no-age-left"]')?.textContent?.replace(/\s+/gu, ' ') ?? ''
    expect(card).toContain('Social Security claim age not searched: none of the ages it tries (62, full retirement age and 70) is both different from your current claim and still ahead in')
    expect(card).toContain('so there is no claim age left to try.')
    expect(text()).not.toContain('claim combinations were each fully re-optimized')
    expect(text()).not.toContain('none beat your current claim ages')
  })
})

describe('the claim-age checkbox hint', () => {
  const year = new Date().getFullYear()
  function couple(firstClaimMade: boolean, secondClaimMade: boolean): Plan {
    const plan = createSamplePlan()
    const [a, b] = [plan.household.people[0]!, { ...plan.household.people[0]!, id: 'partner', name: 'Partner' }]
    plan.household.filingStatus = 'marriedFilingJointly'
    // Born 70 years ago and claiming at 62 is a claim made eight years back; born 60 years ago and claiming at 67 is open.
    a.dob = `${year - (firstClaimMade ? 70 : 60)}-06-15`
    b.dob = `${year - (secondClaimMade ? 70 : 60)}-06-15`
    plan.household.people = [a, b]
    plan.incomes = [
      { type: 'socialSecurity', id: 'ss-a', personId: a.id, piaMonthly: 2_000, earnings: null, claimAge: { years: firstClaimMade ? 62 : 67, months: 0 } },
      { type: 'socialSecurity', id: 'ss-b', personId: b.id, piaMonthly: 1_500, earnings: null, claimAge: { years: secondClaimMade ? 62 : 67, months: 0 } },
    ]
    return plan
  }
  const allMade = 'Every Social Security claim in this plan was made before it starts, so there is no claim age to move.'

  it('says every claim was made only when both were (OG2)', async () => {
    mockedRunOptimize.mockResolvedValue(resultWith({ ...base, outcome: 'searched', unpricedAca: [], alreadyClaimed: [] }))
    await mount(couple(true, false))
    expect(text()).not.toContain(allMade)
    expect(text()).toContain('Re-runs the full optimizer once per claim combination')
    await mount(couple(true, true))
    expect(text()).toContain(allMade)
  })
})
