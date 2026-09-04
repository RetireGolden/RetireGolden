import { describe, expect, it } from 'vitest'

import { singlePersonPlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { pensionElectionPending } from './pensionElectionPending.js'

/**
 * Engine-local coverage for the pension-election detector.
 *
 * The module states its condition: it "Fires when a pension carries a lump-sum
 * offer with no election and the election year hasn't passed." Each clause of
 * that sentence gets a fixture on both sides, including the election-year
 * boundary (an offer due in the start year is still live; one due the year
 * before is not).
 *
 * The present value and the curve-anchored discount rate are quoted from
 * `analyzePensionElections`, which owns their arithmetic and its own tests, so
 * nothing here pins those numbers. What this suite pins is which plan shapes
 * reach the card at all, and that the preview patch comes from the shared
 * `pensionTakeLumpSumPatch` builder rather than being rebuilt in the detector
 * (the module's stated reason: "the insight and the decision engine can never
 * disagree about mechanics").
 */
function pensionAccount(extra: Record<string, unknown> = {}): unknown {
  return {
    type: 'pension',
    id: 'pen',
    name: 'State pension',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: 2_000,
    colaPct: 0,
    survivorPct: 0,
    lumpSumOffer: { amount: 300_000, electionYear: 2026 },
    ...extra,
  }
}

function context(accounts: unknown[] = [pensionAccount()]): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 90 })
  plan.accounts = accounts as never
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

describe('pensionElectionPending', () => {
  it('fires on an undecided lump-sum offer and previews taking it', () => {
    const card = pensionElectionPending.screen(context())
    expect(card?.id).toBe('pension-election-pending')
    expect(card?.category).toBe('longevity-insurance-geography')
    expect(card?.severity).toBe('attention')
    expect(card?.title).toBe('Pension election pending: $300,000 lump sum vs lifetime annuity')
    expect(card?.evidence).toContainEqual({ label: 'Lump-sum offer', value: '$300,000', year: 2026 })
    expect(card?.evidence).toContainEqual({ label: 'Election year', value: '2026', year: 2026 })
    // The verdict stays a tradeoff, never advice.
    expect(card?.rationale).toMatch(/tradeoffs, not a verdict/i)
    expect(card?.action.kind).toBe('preview-scenario')
  })

  it('rolls the lump sum into the owner\'s existing traditional account when there is one', () => {
    const ctx = context([pensionAccount(), traditionalAccount('ira', 400_000, 'p1')])
    const card = pensionElectionPending.screen(ctx)
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    const accounts = (card.action.patch as { accounts: Array<Record<string, unknown>> }).accounts
    const elected = accounts.find((a) => a.id === 'pen')
    expect(elected?.lumpSumElection).toEqual({ rolloverAccountId: 'ira' })
    // No synthetic rollover account is invented when a real one exists.
    expect(accounts.filter((a) => a.type === 'traditional')).toHaveLength(1)
  })

  it('stays silent once the election has been made', () => {
    expect(
      pensionElectionPending.screen(
        context([pensionAccount({ lumpSumElection: { rolloverAccountId: 'ira' } })]),
      ),
    ).toBeNull()
  })

  it('holds the election-year boundary on both sides', () => {
    // "the election year hasn't passed": due this year is still live.
    expect(
      pensionElectionPending.screen(
        context([pensionAccount({ lumpSumOffer: { amount: 300_000, electionYear: 2026 } })]),
      )?.id,
    ).toBe('pension-election-pending')
    expect(
      pensionElectionPending.screen(
        context([pensionAccount({ lumpSumOffer: { amount: 300_000, electionYear: 2025 } })]),
      ),
    ).toBeNull()
  })

  it('stays silent when there is no offer to decide', () => {
    expect(pensionElectionPending.screen(context([pensionAccount({ lumpSumOffer: undefined })]))).toBeNull()
    expect(pensionElectionPending.screen(context([]))).toBeNull()
  })

  it('stays silent for a zero-dollar offer', () => {
    // A $0 lump sum is not a decision; the analysis gate refuses it.
    expect(
      pensionElectionPending.screen(
        context([pensionAccount({ lumpSumOffer: { amount: 0, electionYear: 2026 } })]),
      ),
    ).toBeNull()
  })

  it('evaluate() refuses a plan with no pending election', () => {
    expect(() => pensionElectionPending.evaluate!(context([]))).toThrow(/not eligible/i)
  })
})
