/** Recovery links are shown only when the evaluated result identifies the component. */
import { Link } from 'react-router'
import type { Plan } from '@retiregolden/engine/model/plan'
import { STATE_TAX_WORKSHEET_ANCHOR } from './stateTaxFactsActions'
import { stateTaxIncompleteGuidance, type IncompleteComputationEvidence } from './stateTaxIncompleteGuidanceModel'

export function StateTaxIncompleteGuidancePanel({
  plan,
  incompleteYears,
  evidence,
}: {
  plan: Plan
  incompleteYears: readonly number[]
  evidence?: readonly IncompleteComputationEvidence[]
}) {
  const guidance = stateTaxIncompleteGuidance(incompleteYears, evidence)
  if (guidance === null) return null
  return (
    <div className="field-hint mt-sm" data-testid="state-tax-incomplete-guidance">
      <p>{guidance.summary}</p>
      {guidance.details.length > 0 && <ul>{guidance.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
      {guidance.worksheetLinkLabel && (
        <p><Link to={`/plan/${plan.id}/assumptions#${STATE_TAX_WORKSHEET_ANCHOR}`}>
          {guidance.worksheetLinkLabel}
        </Link></p>
      )}
      {guidance.accountsLinkLabel && (
        <p><Link to={`/plan/${plan.id}/accounts`}>{guidance.accountsLinkLabel}</Link></p>
      )}
    </div>
  )
}
