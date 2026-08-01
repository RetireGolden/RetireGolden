import type { ExactLedgerValidation } from '@retiregolden/engine/projection/optimizePlan'
import { fmtMoney, fmtMoneyCompact } from './format'

export function recommendationHeading(validation: ExactLedgerValidation): string {
  switch (validation.recommendationState) {
    case 'beneficial':
      return `Up to ${fmtMoney(validation.afterTaxEstateDelta)} more for your heirs.`
    case 'neutral':
      return 'The optimizer matches your current strategy.'
    case 'rejected':
      return 'This lower-tax schedule is not recommended.'
    case 'unexecutable':
      return 'This conversion schedule is mostly theoretical.'
    case 'identityIncomplete':
      return 'This schedule still needs account allocation.'
  }
}

export function recommendationBody(validation: ExactLedgerValidation): string {
  const requested = fmtMoney(validation.requestedConversionTotal)
  const executed = fmtMoney(validation.executedConversionTotal)
  const from = fmtMoneyCompact(validation.baseline.endingAfterTaxEstate)
  const to = fmtMoneyCompact(validation.candidate.endingAfterTaxEstate)
  const taxPhrase =
    validation.lifetimeTaxDelta < 0
      ? `lowers lifetime tax by ${fmtMoney(Math.abs(validation.lifetimeTaxDelta))}`
      : validation.lifetimeTaxDelta > 0
        ? `raises lifetime tax by ${fmtMoney(validation.lifetimeTaxDelta)}`
        : 'leaves lifetime tax unchanged'

  switch (validation.recommendationState) {
    case 'beneficial':
      return `Converting ${requested} raises your projected after-tax estate from ${from} to ${to}.`
    case 'neutral':
      return `Converting ${requested} leaves your projected after-tax estate essentially unchanged at ${to}.`
    case 'rejected':
      return `Converting ${requested} ${taxPhrase}, but your projected after-tax estate moves from ${from} to ${to}.`
    case 'unexecutable':
      return `The optimizer proposed converting ${requested}, but only ${executed} could actually be converted. The traditional balance it counted on is not available in the plan years shown.`
    case 'identityIncomplete':
      return `The exact ledger priced and executed ${executed}, but stable owner, source IRA, and Roth destination identities are still required before this aggregate schedule can be recommended.`
  }
}
