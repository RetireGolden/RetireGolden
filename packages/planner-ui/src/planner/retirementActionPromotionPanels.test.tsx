/** @vitest-environment jsdom */
/**
 * What each promotion verdict puts on screen.
 *
 * A published verdict has to show the named amounts, because a schedule nobody
 * can trace to an account is the thing this workstream exists to stop shipping.
 * A withheld verdict has to show the projection's own sentences, because the
 * only alternative is a friendlier paraphrase of a refusal nobody can check.
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { asPositiveUsdCents } from '@retiregolden/engine/actions/money'
import type { Account, Plan } from '@retiregolden/engine/model/plan'
import type { RetirementActionPromotion } from '@retiregolden/engine/projection/optimizePlan'
import { cashAccount, couplePlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'

import { PromotedSchedulePanel, PromotionWithheldPanel } from './retirementActionPromotionPanels'
import {
  promotedRecommendationPlan,
  publishedPromotion,
  withheldPromotion,
  type PublishedRetirementActionPromotion,
  type WithheldRetirementActionPromotion,
} from './optimizePagePromotion'
import {
  PROMOTED_SCHEDULE_EQUIVALENT_NOTE,
  PROMOTED_SCHEDULE_UNREADABLE_FRAME,
  PROMOTION_ENGINE_EVIDENCE_FRAME,
  PROMOTION_ISSUE_FRAME,
  PROMOTION_NOT_COMPARABLE_FRAME,
  PROMOTION_NOT_PROMOTED_FRAME,
  PROMOTION_REPRICED_NOT_RECOMMENDED_FRAME,
} from './retirementActionPromotionCopy'
import { RETIREMENT_ACTION_IRA_FACTS_ANCHOR } from './sections/RetirementActionEligibilityFactsEditor'

const ALEX = 'p1'
const SAM = 'p2'

function render(node: React.ReactNode): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<MemoryRouter>{node}</MemoryRouter>)
  })
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function traditionalIra(id: string, name: string, ownerPersonId: string): Account {
  return {
    type: 'traditional',
    id,
    name,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance: 500_000,
    annualContribution: 0,
  }
}

function testPlan(classified: boolean): Plan {
  const built = couplePlan({ p1PlanningAge: 70, p2PlanningAge: 70 })
  built.id = 'plan-under-test'
  built.household.people[0]!.name = 'Alex'
  built.household.people[1]!.name = 'Sam'
  built.accounts = [
    { ...cashAccount('household-cash', 50_000), ownerPersonId: ALEX },
    traditionalIra('alex-ira', 'Alex rollover IRA', ALEX),
    {
      type: 'roth',
      id: 'alex-roth',
      name: 'Alex Roth IRA',
      ownerPersonId: ALEX,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 10_000,
      annualContribution: 0,
    },
  ]
  built.retirementActionEligibilityFacts = {
    iraClassifications: classified
      ? [{
          evidenceId: 'alex-ira-classification',
          provenance: { source: 'manual' },
          sourceAccountId: 'alex-ira',
          subtype: 'traditional',
        }]
      : [],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return validatePlan(built)
}

const REQUEST = {
  actionId: 'promoted-2026',
  kind: 'rothConversion' as const,
  year: 2026,
  executionDate: '2026-12-31',
  executionSequence: 1,
  requestedAmount: asPositiveUsdCents(40_000_00),
  provenance: { source: 'generator' as const, sourceId: 'roth-fill-to-target' },
  personId: ALEX,
  allocations: [{
    allocationId: 'promoted-2026-a',
    sourceAccountId: 'alex-ira',
    requestedAmount: asPositiveUsdCents(40_000_00),
  }],
  destinationRothAccountId: 'alex-roth',
  taxFunding: { kind: 'noneExpected' as const },
}

const PROMOTED_YEARS = [{
  year: 2026,
  askedCents: 60_000_00,
  allocatedCents: 40_000_00,
  trims: [{ ownerPersonId: SAM, reason: 'ownerHoldsNoRothAccount' as const, slicePlanDollars: 20_000 }],
}]

function published(outcome: 'equivalent' | 'repriced'): PublishedRetirementActionPromotion {
  const shared = {
    candidateId: 'promoted-candidate',
    label: 'Explicit schedule after exploring: Fill the 22% bracket',
    actionRequestIds: ['promoted-2026'],
    planPatch: {
      strategies: { rothConversion: { mode: 'none' }, retirementActions: [REQUEST] },
    },
    years: PROMOTED_YEARS,
  }
  const promotion: RetirementActionPromotion = outcome === 'equivalent'
    ? {
        ...shared,
        outcome: 'equivalent',
        evidence: { equality: 'exactMinorUnitByRequiredKey', quantization: 'nearestCentHalfUp' } as never,
        binding: null,
      }
    : {
        ...shared,
        outcome: 'repriced',
        aggregateConversions: [{ year: 2026, amount: 60_000 }],
      }
  return publishedPromotion(promotion)!
}

function withheld(promotion: RetirementActionPromotion): WithheldRetirementActionPromotion {
  return withheldPromotion(promotion)!
}

/** Renders the panel over the same materialization Apply would install. */
function schedulePanel(promotion: PublishedRetirementActionPromotion) {
  return render(
    <PromotedSchedulePanel
      read={promotedRecommendationPlan(testPlan(true), { claimAge: null, promotion })}
      promotion={promotion}
      winnerConversions={[{ year: 2026, amount: 40_000 }]}
    />,
  )
}

describe('PromotedSchedulePanel', () => {
  it('renders the per-year, per-person, per-account named amounts', () => {
    const { container, unmount } = schedulePanel(published('equivalent'))
    const cells = [...container.querySelectorAll('tbody td')].map((cell) => cell.textContent)
    expect(cells).toEqual(['2026', 'Alex', 'Alex rollover IRA', 'Alex Roth IRA', '$40,000.00'])
    unmount()
  })

  it('claims cent-for-cent equality only on the equivalent verdict', () => {
    const equivalent = schedulePanel(published('equivalent'))
    expect(equivalent.container.textContent).toContain(PROMOTED_SCHEDULE_EQUIVALENT_NOTE)
    equivalent.unmount()

    const repriced = schedulePanel(published('repriced'))
    const text = repriced.container.textContent!
    expect(text).not.toContain(PROMOTED_SCHEDULE_EQUIVALENT_NOTE)
    // The aggregate stands beside it, labeled as what it is, with the
    // difference stated rather than explained away.
    expect(text).toContain('$60,000')
    expect(text).toContain('$40,000')
    expect(text).toContain('exploratory schedule it came from')
    expect(text).toContain('not interchangeable')
    repriced.unmount()
  })

  it('names each trimmed owner once, and says which boundary trimmed them', () => {
    const { container, unmount } = schedulePanel(published('equivalent'))
    const text = container.textContent!
    expect(text).toContain('Sam holds no Roth account in this plan')
    expect(text.match(/Sam holds no Roth account/g)).toHaveLength(1)
    unmount()
  })

  it('offers nothing to apply when the patch does not read back onto the plan', () => {
    const { container, unmount } = schedulePanel({
      ...published('equivalent'),
      actionRequestIds: ['promoted-2026', 'promoted-2027'],
    })
    expect(container.textContent).toContain(PROMOTED_SCHEDULE_UNREADABLE_FRAME)
    expect(container.querySelectorAll('tbody td')).toHaveLength(0)
    unmount()
  })
})

describe('PromotionWithheldPanel', () => {
  it('renders the projection’s own diagnostics verbatim for notComparable', () => {
    const diagnostic =
      'Retirement-action request promoted-2026 does not have matching committed, actionable exact-ledger ' +
      'execution evidence. Blocking reasons: conversion-plan-availability-unknown.'
    const { container, unmount } = render(
      <PromotionWithheldPanel
        plan={testPlan(true)}
        promotion={withheld({
          outcome: 'notComparable',
          reason: 'allocatedRankingNotComparable',
          allocatedRecommendationState: 'diagnostic',
          diagnostics: [diagnostic],
        })}
      />,
    )
    const text = container.textContent!
    expect(text).toContain(PROMOTION_NOT_COMPARABLE_FRAME)
    expect(text).toContain(PROMOTION_ENGINE_EVIDENCE_FRAME)
    expect(text).toContain(diagnostic)
    expect(text).toContain('did not execute the named conversions as written')
    unmount()
  })

  it('renders the chooser’s own issue details verbatim for notPromoted', () => {
    const detail =
      'A solver winner needs optimizer provenance whose source ID is the allocated candidate’s own ID, ' +
      'which no adapter-minted request can carry.'
    const { container, unmount } = render(
      <PromotionWithheldPanel
        plan={testPlan(true)}
        promotion={withheld({
          outcome: 'notPromoted',
          issues: [{ kind: 'milpWinnerNotPromotable', field: 'readinessVeto.vetoedCandidateId', detail }],
        })}
      />,
    )
    const text = container.textContent!
    expect(text).toContain(PROMOTION_NOT_PROMOTED_FRAME)
    expect(text).toContain(PROMOTION_ISSUE_FRAME)
    expect(text).toContain(detail)
    unmount()
  })

  it('says a repricing did not rank ahead, and carries its trims', () => {
    const { container, unmount } = render(
      <PromotionWithheldPanel
        plan={testPlan(true)}
        promotion={withheld({
          outcome: 'repricedNotRecommended',
          candidateId: 'promoted-candidate',
          label: 'Explicit schedule after exploring: Fill the 22% bracket',
          allocatedRecommendationState: 'beneficial',
          years: PROMOTED_YEARS,
        })}
      />,
    )
    const text = container.textContent!
    expect(text).toContain(PROMOTION_REPRICED_NOT_RECOMMENDED_FRAME)
    expect(text).toContain('Sam holds no Roth account in this plan')
    unmount()
  })

  it('explains the employer-plan boundary without promising or blaming', () => {
    const { container, unmount } = render(
      <PromotionWithheldPanel
        plan={testPlan(true)}
        promotion={withheld({
          outcome: 'repricedNotRecommended',
          candidateId: 'promoted-candidate',
          label: 'Explicit schedule after exploring: Fill the 22% bracket',
          allocatedRecommendationState: 'beneficial',
          years: [{
            year: 2026,
            askedCents: 60_000_00,
            allocatedCents: 40_000_00,
            trims: [{
              ownerPersonId: SAM,
              reason: 'ownerHoldsOnlyEmployerDesignatedRoth',
              slicePlanDollars: 20_000,
            }],
          }],
        })}
      />,
    )
    const text = container.textContent!
    expect(text).toContain("Sam's only Roth account in this plan sits inside an employer plan")
    expect(text).toContain("landing only in the same person's own Roth IRA")
    unmount()
  })

  it('links the facts editor when an IRA source has no classification on record', () => {
    const promotion = withheld({
      outcome: 'notComparable',
      reason: 'allocatedRankingNotComparable',
      allocatedRecommendationState: 'diagnostic',
      diagnostics: ['Retirement-action request promoted-2026 does not have matching evidence.'],
    })

    const unrecorded = render(<PromotionWithheldPanel plan={testPlan(false)} promotion={promotion} />)
    const link = unrecorded.container.querySelector('a')
    expect(link?.getAttribute('href'))
      .toBe(`/plan/plan-under-test/strategy#${RETIREMENT_ACTION_IRA_FACTS_ANCHOR}`)
    expect(unrecorded.container.textContent).toContain('no IRA classification on record for Alex rollover IRA')
    unrecorded.unmount()

    // Recorded: nothing to point at, so no link and no note.
    const recorded = render(<PromotionWithheldPanel plan={testPlan(true)} promotion={promotion} />)
    expect(recorded.container.querySelector('a')).toBeNull()
    expect(recorded.container.textContent).not.toContain('IRA classification on record')
    recorded.unmount()
  })
})
