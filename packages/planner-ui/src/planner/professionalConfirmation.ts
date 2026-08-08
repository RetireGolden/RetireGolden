/**
 * True when an inherited-account evidence row carries anything a household
 * cannot rely on without professional confirmation: an unsettled reading, a
 * typed limitation, a disclosure, or facts the model does not cover. Kept
 * separate from the marker component so the file with JSX stays
 * component-only (react-refresh) and report-model code can share the rule.
 */
export function needsProfessionalConfirmation(row: {
  classification?: 'settled' | 'unsettled'
  limitation?: string
  disclosures?: readonly string[]
  refusalReason?: string
}): boolean {
  if (row.classification === 'unsettled') return true
  if (row.limitation) return true
  if (row.refusalReason) return true
  if (row.disclosures && row.disclosures.length > 0) return true
  return false
}
