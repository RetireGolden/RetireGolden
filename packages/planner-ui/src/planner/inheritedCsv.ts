/** Quote a CSV cell when it contains commas, quotes, or newlines. */
export function csvEscape(value: string): string {
  if (value === '') return value
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Inherited ledger column headers for CSV export (account ids escaped). */
export function inheritedCsvColumnHeaders(ids: readonly string[]): string[] {
  return ids.flatMap((id) => [
    csvEscape(`inherited_${id}_requiredAmount`),
    csvEscape(`inherited_${id}_executedRequiredAmount`),
    csvEscape(`inherited_${id}_voluntaryAmount`),
    csvEscape(`inherited_${id}_requirementKind`),
    csvEscape(`inherited_${id}_confirmWithProfessional`),
    csvEscape(`inherited_${id}_note`),
  ])
}