/**
 * The seam guard for a prediction the funding phase makes about state it does
 * not own.
 *
 * `needBasedOwnedIraCharacter` has to know each need-based owned-IRA draw's
 * Form 8606 character BEFORE the draw is applied, because the character sizes
 * the draw. The character is looked up by a replay allocation identity, and
 * that identity is derived in part from the runtime mutation ordinal the
 * application WILL be recorded with -- so the phase predicts it, counting
 * forward one per aggregated IRA from the live counter.
 *
 * When the prediction is wrong, `resolveAssumedCharacter` finds no matching
 * assumed effect and returns null, and the draw is priced on the pre-distribution
 * pro-rata state instead. That is the registered legacy fallback of
 * `irc-408-d-2-C-projection-pro-rata-measurement-instant`, above which the
 * attempt driver re-runs the annual pass until the characters it assumed are
 * the ones the run produced -- so a drift is a fallback, not a wrong answer.
 * It is still a silent one, and nothing pinned the prediction.
 *
 * This is a characterization test of that arithmetic, not an oracle test: it
 * asserts that the ordinals the phase predicts are the ordinals the applications
 * actually receive, and no dollar figure here is independently derived.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import type {
  AnnualFundingApplicationAndClosePhaseInput,
  AnnualFundingApplicationAndClosePhaseResult,
} from './internal/annualFundingApplicationAndClosePhase.js'
import type { SimulatorRetirementRuntimeApplication } from './types.js'

interface PredictedCharacter {
  readonly occurrenceKind: string
  readonly sourceAccountId: string
  readonly mutationOrdinal: number
}

const seam = vi.hoisted(() => ({
  predictions: [] as PredictedCharacter[],
  applicationJournals: [] as SimulatorRetirementRuntimeApplication[][],
}))

vi.mock(
  './internal/annualFundingApplicationAndClosePhase.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualFundingApplicationAndClosePhase.js')
    >()
    return {
      ...original,
      annualFundingApplicationAndClosePhase: (
        input: AnnualFundingApplicationAndClosePhaseInput,
      ): AnnualFundingApplicationAndClosePhaseResult => {
        seam.applicationJournals.push(
          input.ledger.annualRetirementRuntimeApplications,
        )
        // Wrap the character resolver the phase consults, recording exactly
        // what identity it asked about. The wrapper is transparent: it returns
        // the original's answer untouched.
        return original.annualFundingApplicationAndClosePhase(Object.freeze({
          ...input,
          callbacks: Object.freeze({
            ...input.callbacks,
            resolveAssumedCharacter: (
              request: Parameters<
                AnnualFundingApplicationAndClosePhaseInput['callbacks']['resolveAssumedCharacter']
              >[0],
            ) => {
              seam.predictions.push({
                occurrenceKind: request.occurrenceKind,
                sourceAccountId: request.sourceAccountId,
                mutationOrdinal: request.mutationOrdinal,
              })
              return input.callbacks.resolveAssumedCharacter(request)
            },
          }),
        }))
      },
    }
  },
)

import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026

/**
 * One owner, three aggregated traditional IRAs and no cash, so the year's
 * spending has to come out of all of them and each produces its own need-based
 * withdrawal application.
 */
function multiAccountOwnerPlan(): Plan {
  const result = singlePersonPlan({
    dob: '1955-01-01',
    retirementAge: null,
    planningAge: 95,
  })
  result.assumptions.inflationPct = 0
  result.assumptions.defaultReturnPct = 0
  result.expenses.baseAnnual = 300_000
  result.accounts = [
    cashAccount('cash', 0),
    traditionalAccount('ira-a', 200_000),
    traditionalAccount('ira-b', 150_000),
    traditionalAccount('ira-c', 120_000),
  ]
  result.strategies.rothConversion = { mode: 'none' }
  return validatePlan(result)
}

function needBasedApplications(
  journal: readonly SimulatorRetirementRuntimeApplication[],
): SimulatorRetirementRuntimeApplication[] {
  return journal.filter((entry) =>
    entry.simulatorPhase === 'legacyNeedBasedWithdrawal')
}

beforeEach(() => {
  seam.predictions.length = 0
  seam.applicationJournals.length = 0
})

describe('need-based owned-IRA character ordinal prediction', () => {
  it('predicts the ordinals the applications actually receive, for a multi-account owner', () => {
    simulatePlan(multiAccountOwnerPlan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0.2),
    })

    expect(seam.applicationJournals.length).toBeGreaterThan(0)
    const journal = seam.applicationJournals[seam.applicationJournals.length - 1]!
    const applied = needBasedApplications(journal)
    // The fixture has to actually reach the path, or the assertion below is
    // vacuous: more than one drawn IRA is what makes the counting matter.
    expect(applied.length).toBeGreaterThan(1)

    const predictedByAccount = new Map<string, number>()
    for (const prediction of seam.predictions) {
      if (prediction.occurrenceKind !== 'legacyNeedBasedWithdrawal') continue
      // Last prediction wins: the phase probes the character while sizing the
      // draw and asks again once the draw is settled, and it is the settled
      // ask whose identity the application has to match.
      predictedByAccount.set(prediction.sourceAccountId, prediction.mutationOrdinal)
    }
    expect(predictedByAccount.size).toBe(applied.length)

    for (const application of applied) {
      expect(application.sourceAccountId).not.toBeNull()
      expect(
        predictedByAccount.get(application.sourceAccountId!),
        `predicted ordinal for ${String(application.sourceAccountId)}`,
      ).toBe(application.mutationOrdinal)
    }
  })

  it('predicts one consecutive ordinal per drawn aggregated IRA', () => {
    simulatePlan(multiAccountOwnerPlan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0.2),
    })

    const journal = seam.applicationJournals[seam.applicationJournals.length - 1]!
    const ordinals = needBasedApplications(journal)
      .map((entry) => entry.mutationOrdinal)
      .sort((left, right) => left - right)

    // The prediction is "one per drawn account, counting up from here". That is
    // only true while nothing else records an application in between, which is
    // the assumption this pins.
    for (let index = 1; index < ordinals.length; index++) {
      expect(ordinals[index]).toBe(ordinals[index - 1]! + 1)
    }
  })

  it('asks about every drawn aggregated IRA, and only about drawn ones', () => {
    simulatePlan(multiAccountOwnerPlan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0.2),
    })

    const journal = seam.applicationJournals[seam.applicationJournals.length - 1]!
    const drawnAccountIds = new Set(
      needBasedApplications(journal).map((entry) => entry.sourceAccountId),
    )
    const askedAccountIds = new Set(
      seam.predictions
        .filter((prediction) => prediction.occurrenceKind === 'legacyNeedBasedWithdrawal')
        .map((prediction) => prediction.sourceAccountId),
    )

    expect([...askedAccountIds].sort()).toEqual(
      [...drawnAccountIds].map(String).sort(),
    )
  })
})
