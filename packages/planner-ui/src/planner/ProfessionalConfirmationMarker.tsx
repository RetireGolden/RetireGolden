/**
 * Shared "confirm with a tax professional" marker for inherited-account
 * schedules whose facts carry an unsettled reading, a limitation, a
 * disclosure, or anything the model does not cover. One component so Results
 * and Report never drift into per-case wording; the predicate lives in
 * professionalConfirmation.ts so this file stays component-only.
 */
export function ProfessionalConfirmationMarker({ compact = false }: { compact?: boolean }) {
  const text = compact
    ? 'Confirm with a tax professional.'
    : 'Confirm this schedule with a tax professional before acting on it. Planning illustration only, not tax advice.'
  return (
    <p className="callout callout--warn professional-confirmation-marker" role="note">
      {text}
    </p>
  )
}
