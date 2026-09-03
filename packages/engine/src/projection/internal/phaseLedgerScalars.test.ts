/**
 * The seam guard for bound phase scalars.
 *
 * These are characterization-free plumbing tests: they assert that a phase's
 * write reaches the caller's own local with no copy step in between, which is
 * the property the deleted copy-out blocks in `simulatePlan` used to supply by
 * hand and the compiler never checked.
 */
import { describe, expect, it } from 'vitest'

import type { AnnualFundingApplicationAndClosePhaseScalars } from
  './annualFundingApplicationAndClosePhase.js'
import type { AnnualOwnedNonRothIraSettlementPhaseScalars } from
  './annualOwnedNonRothIraSettlementPhase.js'
import type { PhaseLedgerScalarBindings } from './phaseLedgerScalars.js'
import { readPhaseLedgerScalars, writePhaseLedgerScalars } from './phaseLedgerScalars.js'

/**
 * A stand-in for `simulatePlan`'s year-loop locals: ten separate mutable
 * variables, bound one by one exactly as the simulator binds them.
 */
function fundingScalarLocals(): {
  readonly bindings:
    PhaseLedgerScalarBindings<AnnualFundingApplicationAndClosePhaseScalars>
  readonly current: () => AnnualFundingApplicationAndClosePhaseScalars
} {
  let healthcare = 1
  let qualifiedMedicalThisYear = 2
  let hsaQualifiedCap = 3
  let requiredSpendingBase = 4
  let targetSpendingBase = 5
  let capitalLossPool = 6
  let hsaReimbursablePool = 7
  let depletionYear: number | null = null
  let conversionNontaxable = 8
  let priorYearPortfolioReturnPct = 9
  return {
    bindings: {
      healthcare: { read: () => healthcare, write: (v) => { healthcare = v } },
      qualifiedMedicalThisYear: {
        read: () => qualifiedMedicalThisYear,
        write: (v) => { qualifiedMedicalThisYear = v },
      },
      hsaQualifiedCap: { read: () => hsaQualifiedCap, write: (v) => { hsaQualifiedCap = v } },
      requiredSpendingBase: {
        read: () => requiredSpendingBase,
        write: (v) => { requiredSpendingBase = v },
      },
      targetSpendingBase: {
        read: () => targetSpendingBase,
        write: (v) => { targetSpendingBase = v },
      },
      capitalLossPool: { read: () => capitalLossPool, write: (v) => { capitalLossPool = v } },
      hsaReimbursablePool: {
        read: () => hsaReimbursablePool,
        write: (v) => { hsaReimbursablePool = v },
      },
      depletionYear: { read: () => depletionYear, write: (v) => { depletionYear = v } },
      conversionNontaxable: {
        read: () => conversionNontaxable,
        write: (v) => { conversionNontaxable = v },
      },
      priorYearPortfolioReturnPct: {
        read: () => priorYearPortfolioReturnPct,
        write: (v) => { priorYearPortfolioReturnPct = v },
      },
    },
    // Reads the ten locals directly, not through the bindings, so a binding
    // that writes nowhere cannot make this pass.
    current: () => ({
      healthcare,
      qualifiedMedicalThisYear,
      hsaQualifiedCap,
      requiredSpendingBase,
      targetSpendingBase,
      capitalLossPool,
      hsaReimbursablePool,
      depletionYear,
      conversionNontaxable,
      priorYearPortfolioReturnPct,
    }),
  }
}

const CLOSING: AnnualFundingApplicationAndClosePhaseScalars = {
  healthcare: 11,
  qualifiedMedicalThisYear: 12,
  hsaQualifiedCap: 13,
  requiredSpendingBase: 14,
  targetSpendingBase: 15,
  capitalLossPool: 16,
  hsaReimbursablePool: 17,
  depletionYear: 2041,
  conversionNontaxable: 18,
  priorYearPortfolioReturnPct: 19,
}

describe('phase ledger scalars', () => {
  it('reads every bound cell into the opening record', () => {
    const { bindings } = fundingScalarLocals()
    expect(readPhaseLedgerScalars(bindings)).toEqual({
      healthcare: 1,
      qualifiedMedicalThisYear: 2,
      hsaQualifiedCap: 3,
      requiredSpendingBase: 4,
      targetSpendingBase: 5,
      capitalLossPool: 6,
      hsaReimbursablePool: 7,
      depletionYear: null,
      conversionNontaxable: 8,
      priorYearPortfolioReturnPct: 9,
    })
  })

  it('makes a phase write to each bound scalar visible to the caller with no copy step', () => {
    const { bindings, current } = fundingScalarLocals()

    writePhaseLedgerScalars(bindings, CLOSING)

    // No assignment from a returned ledger happened between the write and this
    // read: the caller's ten locals are what changed.
    expect(current()).toEqual(CLOSING)
  })

  it('writes each key to its own cell rather than sharing one', () => {
    const { bindings, current } = fundingScalarLocals()

    for (const key of Object.keys(CLOSING) as (keyof typeof CLOSING)[]) {
      const only = { ...readPhaseLedgerScalars(bindings), [key]: CLOSING[key] }
      writePhaseLedgerScalars(bindings, only as AnnualFundingApplicationAndClosePhaseScalars)
      expect(current()[key]).toEqual(CLOSING[key])
    }
    expect(current()).toEqual(CLOSING)
  })

  it('round-trips a null through a nullable cell', () => {
    const { bindings, current } = fundingScalarLocals()

    writePhaseLedgerScalars(bindings, { ...CLOSING, depletionYear: 2030 })
    expect(current().depletionYear).toBe(2030)
    writePhaseLedgerScalars(bindings, { ...CLOSING, depletionYear: null })
    expect(current().depletionYear).toBeNull()
  })

  it('carries a boolean latch home for the settlement phase', () => {
    let rolledBack = false
    const bindings:
      PhaseLedgerScalarBindings<AnnualOwnedNonRothIraSettlementPhaseScalars> = {
        ownedNonRothIraSettlementRolledBackHousehold: {
          read: () => rolledBack,
          write: (v) => { rolledBack = v },
        },
      }

    expect(readPhaseLedgerScalars(bindings))
      .toEqual({ ownedNonRothIraSettlementRolledBackHousehold: false })
    bindings.ownedNonRothIraSettlementRolledBackHousehold.write(true)
    expect(rolledBack).toBe(true)
  })
})
