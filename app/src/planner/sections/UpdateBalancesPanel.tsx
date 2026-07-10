/**
 * "Update balances from a broker CSV" — the returning-user path of the broker
 * import (onboarding-import-and-migration step 2, annual-checkup posture).
 * Parses a Schwab/Fidelity/Vanguard positions CSV on-device and lets the user
 * assign each account found in the file to a plan account before applying.
 */

import { useRef, useState } from 'react'

import {
  applyBrokerBalance,
  BROKER_LABEL,
  isBalanceUpdatable,
  parseBrokerPositionsCsv,
  type BrokerAccountBalance,
  type BrokerId,
} from '../../import/brokerCsv'
import type { ImportReviewItem } from '../../import/reviewChecklist'
import { ReviewChecklist } from '../../import/ReviewChecklistView'
import { usePlan } from '../planContextCore'
import { fmtMoney } from '../format'

interface ParsedFile {
  broker: BrokerId
  accounts: BrokerAccountBalance[]
  /** Selected plan-account id (or '') per parsed account, by index. */
  targets: string[]
  /** The parser's honesty checklist (partial basis, skipped rows, …). */
  review: ImportReviewItem[]
}

/** Prefer a plan account whose name shares words with the broker label. */
function guessTarget(label: string, candidates: Array<{ id: string; name: string }>): string {
  const l = label.toLowerCase()
  const hit = candidates.find((c) => l.includes(c.name.toLowerCase()) || c.name.toLowerCase().split(/\s+/).some((w) => w.length > 2 && l.includes(w)))
  return hit?.id ?? ''
}

export function UpdateBalancesPanel() {
  const { plan, update } = usePlan()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const updatable = plan.accounts.filter(isBalanceUpdatable).map((a) => ({ id: a.id, name: a.name }))

  const handleFile = async (file: File) => {
    setMessage(null)
    const r = parseBrokerPositionsCsv(await file.text())
    if (!r.ok) {
      setParsed(null)
      setMessage(r.message)
      return
    }
    setParsed({
      broker: r.broker,
      accounts: r.accounts,
      targets: r.accounts.map((acc) => guessTarget(acc.accountLabel, updatable)),
      review: r.review,
    })
  }

  // Two file accounts pointed at one plan account would silently last-write-win.
  const duplicateTargets = parsed
    ? [...new Set(parsed.targets.filter((t, i) => t !== '' && parsed.targets.indexOf(t) !== i))]
    : []
  const duplicateNames = duplicateTargets.map((id) => updatable.find((a) => a.id === id)?.name ?? id)

  const apply = () => {
    if (!parsed || duplicateTargets.length > 0) return
    let applied = 0
    update((d) => {
      parsed.accounts.forEach((source, i) => {
        const targetId = parsed.targets[i]
        if (!targetId) return
        const idx = d.accounts.findIndex((a) => a.id === targetId)
        if (idx === -1) return
        d.accounts[idx] = applyBrokerBalance(d.accounts[idx]!, source)
        applied++
      })
    })
    setParsed(null)
    setMessage(
      applied === 0
        ? 'No accounts were assigned, so nothing changed.'
        : `Updated ${applied} account${applied === 1 ? '' : 's'} from the ${BROKER_LABEL[parsed.broker]} file — balances, plus cost basis where the file carried it. Review taxable accounts whose basis the file lacked.`,
    )
  }

  return (
    <div className="card">
      <h2>Update balances from a broker CSV</h2>
      <p className="card-hint">
        Download the positions/holdings CSV from Schwab, Fidelity, or Vanguard and refresh your account
        balances (and cost basis where the file has it) without retyping. The file is read on this device
        only. To start a whole new plan from a file, use Import &amp; migrate on the home screen.
      </p>
      {message ? (
        <div className="callout callout--info" role="status">
          {message}
        </div>
      ) : null}
      {parsed ? (
        <>
          <div className="year-table-wrap">
            <table className="year-table">
              <thead>
                <tr>
                  <th scope="col">In the {BROKER_LABEL[parsed.broker]} file</th>
                  <th scope="col">Value</th>
                  <th scope="col">Cost basis</th>
                  <th scope="col">Apply to plan account</th>
                </tr>
              </thead>
              <tbody>
                {parsed.accounts.map((acc, i) => (
                  <tr key={`${acc.accountLabel}-${i}`}>
                    <td>{acc.accountLabel}</td>
                    <td>{fmtMoney(acc.totalValue)}</td>
                    <td>{acc.costBasis === null ? '—' : fmtMoney(acc.costBasis)}</td>
                    <td>
                      <select
                        aria-label={`Plan account for ${acc.accountLabel}`}
                        value={parsed.targets[i] ?? ''}
                        onChange={(e) =>
                          setParsed((prev) =>
                            prev ? { ...prev, targets: prev.targets.map((t, j) => (j === i ? e.target.value : t)) } : prev,
                          )
                        }
                      >
                        <option value="">Don&apos;t update</option>
                        {updatable.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {duplicateNames.length > 0 ? (
            <div className="callout callout--warn" role="alert">
              Two rows are assigned to the same plan account ({duplicateNames.join(', ')}) — the second would silently
              overwrite the first. Assign each plan account at most once.
            </div>
          ) : null}
          <ReviewChecklist items={parsed.review} />
          <div className="picker-actions">
            <button type="button" className="btn btn-primary" onClick={apply} disabled={duplicateNames.length > 0}>
              Apply selected balances
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setParsed(null)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="picker-actions" style={{ margin: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
            Choose broker CSV
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
