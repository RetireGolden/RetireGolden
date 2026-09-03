import { csvCell } from '../csvCell'

/** Inherited ledger column headers for CSV export (account ids escaped). */
export function inheritedCsvColumnHeaders(ids: readonly string[]): string[] {
  return ids.flatMap((id) => [
    csvCell(`inherited_${id}_requiredAmount`),
    csvCell(`inherited_${id}_executedRequiredAmount`),
    csvCell(`inherited_${id}_voluntaryAmount`),
    csvCell(`inherited_${id}_requirementKind`),
    csvCell(`inherited_${id}_confirmWithProfessional`),
    csvCell(`inherited_${id}_note`),
  ])
}
