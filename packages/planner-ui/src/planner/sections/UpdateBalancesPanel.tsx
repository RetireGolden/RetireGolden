/**
 * "Update balances from a broker CSV" — the returning-user path of the broker
 * import (onboarding-import-and-migration step 2, annual-checkup posture).
 * Parses a Schwab/Fidelity/Vanguard positions CSV on-device and lets the user
 * assign each account found in the file to a plan account before applying.
 *
 * Matching, preview and apply are the browser-free WS4 refresh engine
 * (`../../import/refresh`): the panel only turns its candidates into pre-selected
 * dropdowns, renders the before→after delta it computes, and routes apply through
 * `applyRefresh` inside the plan `update` seam so `parsePlan` still gates saves.
 *
 * Protection comes from the ambient `RefreshProtectionProvider` (the Pro/Advisor
 * host feeds the accounts its intake decisions froze; the public planner mounts
 * no provider and gets an empty set — unchanged behaviour). A protected row can
 * be released transiently with "Allow this refresh": that only frees the path for
 * THIS panel instance and never touches the advisor's stored override record.
 */

import { useMemo, useRef, useState } from 'react'

import {
  BROKER_LABEL,
  isBalanceUpdatable,
  parseBrokerPositionsCsv,
  type BrokerAccountBalance,
  type BrokerId,
} from '../../import/brokerCsv'
import {
  classifyRefresh,
  buildRefreshDelta,
  applyRefresh,
  type RefreshCandidate,
} from '../../import/refresh'
import type { ImportReviewItem } from '../../import/reviewChecklist'
import { ReviewChecklist } from '../../import/ReviewChecklistView'
import { usePlan } from '../planContextCore'
import { useRefreshProtection } from '../refreshProtectionContext'
import { fmtMoney } from '../format'

interface ParsedFile {
  broker: BrokerId
  /**
   * The raw parsed broker accounts. Classification is DERIVED from these plus the
   * effective protected set each render (not stored), so releasing a protected
   * row re-runs classification against the smaller set — a released account flips
   * from protected to a normal, applicable match without a stale verdict.
   */
  accounts: BrokerAccountBalance[]
  /** Selected plan-account id (or '') per parsed account, by index. */
  targets: string[]
  /** The parser's honesty checklist (partial basis, skipped rows, …). */
  review: ImportReviewItem[]
}

/** exact/likely default their select ON; ambiguous/unmatched/protected default OFF. */
function defaultTarget(candidate: RefreshCandidate): string {
  if (candidate.isProtected) return ''
  if (candidate.match === 'exact' || candidate.match === 'likely') return candidate.targetAccountId ?? ''
  return ''
}

export function UpdateBalancesPanel() {
  const { plan, update } = usePlan()
  const protectedTargets = useRefreshProtection()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Paths (the `accounts[i]` record path) the user has transiently released from
  // protection for THIS panel instance via "Allow this refresh". This is UI-local
  // and deliberately does not touch the advisor's stored override — it only
  // subtracts from the effective set the three engine calls see, and is cleared
  // whenever a new file is parsed or the panel resets.
  const [released, setReleased] = useState<ReadonlySet<string>>(() => new Set())
  const fileInput = useRef<HTMLInputElement>(null)

  const updatable = plan.accounts.filter(isBalanceUpdatable).map((a) => ({ id: a.id, name: a.name }))
  const accountName = (id: string) => updatable.find((a) => a.id === id)?.name ?? id

  // The effective protected set = the host's set MINUS the released paths, where
  // releasing an account (`accounts[i]`) also frees any protected field of it
  // (`accounts[i].costBasis`). This one set feeds all three engine calls.
  const effective = useMemo<ReadonlySet<string>>(() => {
    if (protectedTargets.size === 0) return protectedTargets
    const next = new Set<string>()
    for (const p of protectedTargets) {
      const freed = [...released].some((r) => p === r || p.startsWith(`${r}.`))
      if (!freed) next.add(p)
    }
    return next
  }, [protectedTargets, released])

  // Is `path` protected by the effective set — as the account itself, a field of
  // it, or an ancestor of it (the same three-way test the engine applies)?
  const pathProtected = (path: string | null): boolean => {
    if (!path || effective.size === 0) return false
    for (const p of effective) {
      if (p === path || p.startsWith(`${path}.`) || path.startsWith(`${p}.`)) return true
    }
    return false
  }

  const resetPanel = () => {
    setParsed(null)
    setReleased(new Set())
  }

  const handleFile = async (file: File) => {
    setMessage(null)
    const r = parseBrokerPositionsCsv(await file.text())
    if (!r.ok) {
      resetPanel()
      setMessage(r.message)
      return
    }
    // A fresh file starts with protection fully restored, so seed the selection
    // from a classification computed against the host's full set.
    setReleased(new Set())
    const classification = classifyRefresh(plan, r.accounts, { protectedTargets })
    setParsed({
      broker: r.broker,
      accounts: r.accounts,
      targets: classification.candidates.map(defaultTarget),
      review: r.review,
    })
  }

  // Classification is DERIVED from the raw parse result and the current effective
  // set — never stored — so releasing a row re-runs it against the smaller set.
  // Keyed on the raw accounts (stable across target edits) and `effective`, so a
  // selection change alone does not re-classify.
  const rawAccounts = parsed?.accounts ?? null
  const classification = useMemo(
    () => (rawAccounts ? classifyRefresh(plan, rawAccounts, { protectedTargets: effective }) : null),
    [plan, rawAccounts, effective],
  )

  // The current selection, as the engine's index→account-id map (empty = skip).
  const selection = new Map<number, string>()
  parsed?.targets.forEach((t, i) => {
    if (t !== '') selection.set(i, t)
  })

  // One preview of what apply would do, recomputed from the live selection. The
  // panel never applies balances itself — it renders exactly what `applyRefresh`
  // would write, because both go through `buildRefreshDelta`'s single primitive.
  // The effective set is threaded into all three calls so protection (minus any
  // released rows) is enforced identically at classify, preview, and apply.
  const delta = parsed && classification ? buildRefreshDelta(plan, classification, selection, effective) : null
  const candidates = classification?.candidates ?? []

  // The plan-account index each selected row resolves to, so the row can show
  // that account's before→after from the delta's field writes.
  const changeByPath = new Map<string, { before: number; after: number; clamped: boolean }>()
  for (const c of delta?.changes ?? []) changeByPath.set(c.path, c)
  const rowPreview = (i: number) => {
    const targetId = parsed?.targets[i]
    if (!targetId) return null
    const idx = plan.accounts.findIndex((a) => a.id === targetId)
    if (idx === -1) return null
    const balance = changeByPath.get(`accounts[${idx}].balance`)
    if (!balance) return null // not selected, protected, or a blocked duplicate — nothing lands
    return { balance, basis: changeByPath.get(`accounts[${idx}].costBasis`) ?? null }
  }

  const duplicateNames = (delta?.duplicateGroups ?? []).map((g) => accountName(g.accountId))
  const blocked = duplicateNames.length > 0
  const staleNames = (delta?.staleAccountIds ?? []).map(accountName)

  // Release a protected row: free its account path for THIS panel only (never the
  // stored override) and pre-select the account so it applies like any match.
  const allowRefresh = (i: number, path: string, accountId: string | null) => {
    setReleased((prev) => new Set(prev).add(path))
    if (accountId) {
      setParsed((prev) => (prev ? { ...prev, targets: prev.targets.map((t, j) => (j === i ? accountId : t)) } : prev))
    }
  }

  const apply = () => {
    if (!parsed || !delta || blocked) return
    let applied = 0
    update((d) => {
      applied = applyRefresh(d, delta, selection, effective)
    })
    resetPanel()
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
        balances (and cost basis where the file has it) without retyping. Only balance and cost basis change —
        your return, yield, contribution, and beneficiary settings are left alone. The file is read on this
        device only. To start a whole new plan from a file, use Import &amp; migrate on the home screen.
      </p>
      {message ? (
        <div className="callout callout--info" role="status">
          {message}
        </div>
      ) : null}
      {parsed && delta ? (
        <>
          <div className="year-table-wrap">
            <table className="year-table">
              <thead>
                <tr>
                  <th scope="col">In the {BROKER_LABEL[parsed.broker]} file</th>
                  <th scope="col">Value</th>
                  <th scope="col">Cost basis</th>
                  <th scope="col">Apply to plan account</th>
                  <th scope="col">Plan balance: now → after</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, i) => {
                  const acc = candidate.source
                  const preview = rowPreview(i)
                  // The row is protected when its guessed target is off-limits, or
                  // when the user has pointed it at a protected account. Either way
                  // the account whose path we'd release is that protected target.
                  const chosenId = parsed.targets[i] ?? ''
                  const chosenIdx = chosenId ? plan.accounts.findIndex((a) => a.id === chosenId) : -1
                  const chosenPath = chosenIdx >= 0 ? `accounts[${chosenIdx}]` : null
                  const isProtectedRow = candidate.isProtected || pathProtected(chosenPath)
                  const protectedAccountId = candidate.isProtected ? candidate.targetAccountId : chosenId || null
                  const protectedPath = candidate.isProtected ? candidate.targetPath : chosenPath
                  return (
                    <tr key={`${acc.accountLabel}-${i}`}>
                      <td>{acc.accountLabel}</td>
                      <td>{fmtMoney(acc.totalValue)}</td>
                      <td>{acc.costBasis === null ? '—' : fmtMoney(acc.costBasis)}</td>
                      <td>
                        <select
                          aria-label={`Plan account for ${acc.accountLabel}`}
                          value={parsed.targets[i] ?? ''}
                          disabled={isProtectedRow}
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
                        {isProtectedRow ? (
                          <div className="refresh-protected" role="note">
                            <span className="muted">Protected — advisor override</span>
                            {protectedPath ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                aria-label={`Allow this refresh for ${accountName(protectedAccountId ?? '')}`}
                                onClick={() => allowRefresh(i, protectedPath, protectedAccountId)}
                              >
                                Allow this refresh
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="refresh-preview">
                        {preview ? (
                          <>
                            <span className="muted">{fmtMoney(preview.balance.before)}</span>
                            <span className="muted" aria-hidden="true"> → </span>
                            <strong>{fmtMoney(preview.balance.after)}</strong>
                            {preview.balance.clamped ? <span className="muted"> (clamped to $0)</span> : null}
                            {preview.basis ? (
                              <div className="muted">
                                basis {fmtMoney(preview.basis.before)} → {fmtMoney(preview.basis.after)}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {staleNames.length > 0 ? (
            <div className="callout callout--info" role="status">
              These plan accounts aren&apos;t in the file, so their balances stay as they are (going stale):{' '}
              {staleNames.join(', ')}. Update them from their own broker download when you have it.
            </div>
          ) : null}
          {blocked ? (
            <div className="callout callout--warn" role="alert">
              Two rows are assigned to the same plan account ({duplicateNames.join(', ')}) — the second would silently
              overwrite the first, so nothing is applied. Assign each plan account at most once.
            </div>
          ) : null}
          {/* The parser's file-level honesty items ride alongside the refresh's
              field-level ones — one checklist, so "no cost basis in the file" and
              "refreshed the balance to $X" are read together. */}
          <ReviewChecklist items={[...delta.review, ...parsed.review]} />
          <div className="picker-actions">
            <button type="button" className="btn btn-primary" onClick={apply} disabled={blocked}>
              Apply selected balances
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetPanel}>
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
