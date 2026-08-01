import type { ScenarioPlanComparison } from '@retiregolden/engine/scenarios/comparison'

type ActionComparisonRow = ScenarioPlanComparison['actionRows'][number]
type ActionSide = NonNullable<ActionComparisonRow['baseline']>
type ScheduleDiagnostic = ActionComparisonRow['baselineScheduleDiagnostics'][number]

function formatCents(cents: number): string {
  const minorUnits = BigInt(cents)
  const negative = minorUnits < 0n
  const absolute = negative ? -minorUnits : minorUnits
  const dollars = absolute / 100n
  const remainder = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '−' : ''}$${dollars.toLocaleString('en-US')}.${remainder}`
}

function IdentityList({ action }: { action: ActionSide }) {
  return (
    <dl className="small" style={{ margin: 0 }}>
      <dt>Person ID</dt>
      <dd>{action.personId ?? '—'}</dd>
      <dt>Destination account ID</dt>
      <dd>{action.destinationAccountId ?? '—'}</dd>
      <dt>Charity designation ID</dt>
      <dd>{action.charityDesignationId ?? '—'}</dd>
    </dl>
  )
}

function SourceAllocations({ action }: { action: ActionSide }) {
  if (action.sourceAllocations.length === 0) return <span>—</span>
  return (
    <ul className="small" style={{ margin: 0, paddingInlineStart: '1rem' }}>
      {action.sourceAllocations.map((allocation) => (
        <li key={allocation.allocationId}>
          <strong>{allocation.sourceAccountId}</strong>
          {' · allocation '}{allocation.allocationId}
          {' · '}{allocation.resolution}
          <br />
          Requested {formatCents(allocation.requestedAmountCents)}; executed{' '}
          {formatCents(allocation.executedAmountCents)}; unexecuted{' '}
          {formatCents(allocation.unexecutedAmountCents)}
        </li>
      ))}
    </ul>
  )
}

function Reasons({ action }: { action: ActionSide }) {
  if (action.reasons.length === 0) return <span>—</span>
  return (
    <ul className="small" style={{ margin: 0, paddingInlineStart: '1rem' }}>
      {action.reasons.map((reason, index) => (
        <li key={`${reason.code}:${reason.personId ?? ''}:${reason.accountId ?? ''}:${reason.allocationId ?? ''}:${index}`}>
          <strong>{reason.code}</strong>: {reason.message}
          {reason.personId ? <> Person ID {reason.personId}.</> : null}
          {reason.accountId ? <> Account ID {reason.accountId}.</> : null}
          {reason.allocationId ? <> Allocation ID {reason.allocationId}.</> : null}
        </li>
      ))}
    </ul>
  )
}

function diagnosticText(diagnostic: ScheduleDiagnostic): string {
  if (diagnostic.kind === 'actionYearMismatch') {
    return `actionYearMismatch: expected year ${diagnostic.expectedYear}; request year ${diagnostic.actualYear}.`
  }
  if (diagnostic.kind === 'duplicateActionId') {
    return `duplicateActionId: input indexes ${diagnostic.inputIndexes.join(', ')}.`
  }
  return `${diagnostic.reason.code}: ${diagnostic.reason.message} Scheduled date ${diagnostic.scheduledDate ?? '—'}, sequence ${diagnostic.executionSequence}; colliding action IDs ${diagnostic.collidingActionIds.join(', ')}.`
}

function ScheduleDiagnostics({ diagnostics }: { diagnostics: readonly ScheduleDiagnostic[] }) {
  if (diagnostics.length === 0) return <span>—</span>
  return (
    <ul className="small" style={{ margin: 0, paddingInlineStart: '1rem' }}>
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.kind}:${index}`}>{diagnosticText(diagnostic)}</li>
      ))}
    </ul>
  )
}

function ActionSideCells({
  action,
  diagnostics,
  absentLabel,
}: {
  action: ActionSide | null
  diagnostics: readonly ScheduleDiagnostic[]
  absentLabel: string
}) {
  if (action === null) {
    return (
      <td colSpan={8}>
        <span className="small">{absentLabel}</span>
        {diagnostics.length > 0 ? <ScheduleDiagnostics diagnostics={diagnostics} /> : null}
      </td>
    )
  }

  return (
    <>
      <td>{action.year}</td>
      <td><code>{action.kind}</code></td>
      <td><IdentityList action={action} /></td>
      <td><SourceAllocations action={action} /></td>
      <td>
        Requested {formatCents(action.requestedAmountCents)}<br />
        Executed {formatCents(action.executedAmountCents)}<br />
        Unexecuted {formatCents(action.unexecutedAmountCents)}
      </td>
      <td>{action.readiness}<br />{action.outcome}</td>
      <td><Reasons action={action} /></td>
      <td><ScheduleDiagnostics diagnostics={diagnostics} /></td>
    </>
  )
}

export function ScenarioActionComparisonTable({
  actionRows,
}: {
  actionRows: ScenarioPlanComparison['actionRows']
}) {
  if (actionRows.length === 0) {
    return (
      <details>
        <summary>Retirement action execution (0 actions)</summary>
        <p className="small">Neither scenario published identity-bearing retirement actions.</p>
      </details>
    )
  }

  return (
    <details>
      <summary>Retirement action execution ({actionRows.length} actions)</summary>
      <p className="small">
        Exact execution evidence from the canonical scenario ledger. IDs are shown so each action,
        person, source, destination, and charity designation can be traced without inferring identity.
      </p>
      <div className="year-table-wrap">
        <table className="compare-table">
          <caption>Identity-bearing retirement actions (exact dollars and cents)</caption>
          <thead>
            <tr>
              <th scope="col">Action ID</th>
              <th scope="col">Scenario</th>
              <th scope="col">Year</th>
              <th scope="col">Kind</th>
              <th scope="col">Identity</th>
              <th scope="col">Source allocations</th>
              <th scope="col">Amounts</th>
              <th scope="col">Status</th>
              <th scope="col">Reasons</th>
              <th scope="col">Schedule diagnostics</th>
            </tr>
          </thead>
          <tbody>
            {actionRows.flatMap((row) => [
              <tr key={`${row.actionId}:baseline`}>
                <th scope="rowgroup" rowSpan={2}><code>{row.actionId}</code></th>
                <th scope="row">Baseline</th>
                <ActionSideCells
                  action={row.baseline}
                  diagnostics={row.baselineScheduleDiagnostics}
                  absentLabel="Not present in baseline"
                />
              </tr>,
              <tr key={`${row.actionId}:proposal`}>
                <th scope="row">Proposal</th>
                <ActionSideCells
                  action={row.proposal}
                  diagnostics={row.proposalScheduleDiagnostics}
                  absentLabel="Not present in proposal"
                />
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
    </details>
  )
}
