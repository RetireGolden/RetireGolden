import type { AnnualPensionAndAnnuityIncomeResult } from './annualPensionAndAnnuityIncome.js'
import type { AnnualRailroadBenefit } from './annualStateHouseholdFacts.js'
import type { StateRetirementDistributionFactInput } from '../types.js'

function railroadKind(source: string): AnnualRailroadBenefit['kind'] | undefined {
  if (source === 'railroadTier1') return 'tier1'
  if (source === 'railroadTier2') return 'tier2'
  if (source === 'railroadRetirementAct') return 'otherRra'
  return undefined
}

/** Actual producer ledger, independent of optional cash-flow capture.
 * annualPensionAndAnnuityIncome adds its gross pension payment to ordinary
 * income and writes that same amount to the characterized row. This specific
 * producer contract establishes gross; arbitrary taxable source facts do not.
 */
export function deriveAnnualStateRailroadBenefits(
  pension: Pick<AnnualPensionAndAnnuityIncomeResult, 'characterizedRetirementDistributions'>,
  additionalEvents: readonly StateRetirementDistributionFactInput[] = [],
): readonly AnnualRailroadBenefit[] | undefined {
  const benefits: AnnualRailroadBenefit[] = []
  for (const row of pension.characterizedRetirementDistributions) {
    const kind = railroadKind(row.source)
    if (kind === undefined) continue
    if (!Number.isFinite(row.federallyIncludedAmount) || row.federallyIncludedAmount < 0) return undefined
    benefits.push({ ownerPersonId: row.ownerPersonId, kind,
      grossAmount: row.federallyIncludedAmount, federallyIncludedAmount: row.federallyIncludedAmount })
  }
  // This argument contains additional, disjoint non-pension events, never the
  // phase's own mirrored stateRetirementDistributionFacts a second time.
  for (const event of additionalEvents) {
    const kind = railroadKind(event.sourceKind)
    if (kind === undefined) continue
    if (event.grossDistribution === undefined || !Number.isFinite(event.grossDistribution) || event.grossDistribution < 0) return undefined
    benefits.push({ ownerPersonId: event.ownerPersonId, kind, grossAmount: event.grossDistribution,
      federallyIncludedAmount: event.federallyIncludedAmount })
  }
  return benefits
}
