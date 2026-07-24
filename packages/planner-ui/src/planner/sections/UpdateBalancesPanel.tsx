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
 * no provider and gets an empty list — unchanged behaviour). The host names those
 * accounts by STABLE ID as STRUCTURED entries (`{ accountId, field? }`), never by
 * array position: this panel resolves each entry's `accountId` to its CURRENT
 * `accounts[i]` index fresh on every render, so protection tracks the account even
 * after the plan array is reordered. Entries carry the account/field split
 * explicitly, so nested or dotted ids need no parsing and stay unambiguous.
 * Protected accounts stay SELECTABLE in every row (marked
 * "(protected)"); selecting one blocks that row — the "Protected — advisor
 * override" note with an "Allow this refresh" button — rather than being refused,
 * so even an unmatched row has a path to deliberately refresh a frozen account.
 * "Allow this refresh" frees the account for THIS panel instance and only for the
 * ROW that asked (a sibling row cannot then reach the same account), and it never
 * touches the advisor's stored override record.
 */

import { useMemo, useRef, useState } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
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
import { useRefreshProtection, type RefreshProtectionEntry } from '../refreshProtectionContext'
import { fmtMoney } from '../format'

const EMPTY_PROTECTED: ReadonlySet<string> = new Set()
/** A stable empty release map for the fresh-file seed (no allocation per parse). */
const EMPTY_RELEASED: ReadonlyMap<string, number> = new Map()

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

/**
 * Translate the host's STABLE account-id protection entries into the engine's
 * POSITIONAL `accounts[i]` set against the live plan order, dropping any account
 * a row has released. This is the one place ids become indices: an entry whose
 * `accountId` names no live account is skipped (a stale protection cannot protect
 * a phantom index), and a released id is omitted so the engine treats it as fair
 * game. No parsing happens — the entry already carries the account/field split.
 * Cheap and allocation-free when nothing is protected — the empty-provider path
 * returns the shared empty set without touching `released`.
 *
 * A field-scoped entry emits `accounts[i].<field>`, but note the engine's
 * `isProtectedPath` treats any protected field of an account as locking the whole
 * account's refresh write (balance and basis apply as a unit) — so a field entry
 * currently blocks the account entirely. See the module and README docs.
 */
function positionalProtectedSet(
  plan: Plan,
  protectedAccounts: readonly RefreshProtectionEntry[],
  released: ReadonlyMap<string, number>,
): ReadonlySet<string> {
  if (protectedAccounts.length === 0) return EMPTY_PROTECTED
  const out = new Set<string>()
  for (const entry of protectedAccounts) {
    if (released.has(entry.accountId)) continue // released for this panel instance — not off-limits
    const index = plan.accounts.findIndex((a) => a.id === entry.accountId)
    if (index === -1) continue // stale entry: no live account, nothing to protect
    out.add(entry.field === undefined ? `accounts[${index}]` : `accounts[${index}].${entry.field}`)
  }
  return out
}

/**
 * exact/likely default their select ON; ambiguous/unmatched default OFF. A
 * protected exact/likely guess still defaults to its account so the row renders
 * BLOCKED (note + "Allow this refresh") rather than silently unselected — the
 * belt and the blocked-row render keep it out of the delta/apply until released,
 * so a defaulted-on protected account writes nothing until the user allows it.
 */
function defaultTarget(candidate: RefreshCandidate): string {
  if (candidate.match === 'exact' || candidate.match === 'likely') return candidate.targetAccountId ?? ''
  return ''
}

export function UpdateBalancesPanel() {
  const { plan, update } = usePlan()
  const protectedAccounts = useRefreshProtection()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Accounts the user has transiently released from protection for THIS panel
  // instance via "Allow this refresh", keyed by account id → the broker-row index
  // that requested the release. This is UI-local and deliberately does not touch
  // the advisor's stored override — it only frees the account from the effective
  // set the three engine calls see, and scopes the unlock to the requesting row
  // (a sibling row still cannot reach the account). Cleared whenever a new file is
  // parsed or the panel resets.
  const [released, setReleased] = useState<ReadonlyMap<string, number>>(() => new Map())
  const fileInput = useRef<HTMLInputElement>(null)

  // The workspace reuses this one panel instance across `/plan/:id` navigation, so
  // the transient file state (parsed table, row-scoped releases, status message)
  // would otherwise survive into a DIFFERENT plan. Cloned plans share account ids,
  // so a stale release could bypass protection cross-plan. Reset everything back to
  // its seed the moment the plan IDENTITY changes, tracked by the render-phase
  // "adjust state while rendering" pattern (not an effect — the reset must land
  // before this render derives anything from `parsed`, and React discards the
  // interrupted render without an extra commit).
  const [seenPlanId, setSeenPlanId] = useState(plan.id)
  // One synchronous epoch guarding every async file read. It is bumped SYNCHRONOUSLY
  // both here (on a plan-identity reset) and at the very start of `handleFile` (each
  // file selection supersedes any prior in-flight read). A read captures the epoch
  // before awaiting `file.text()` and discards its parse if the epoch moved while the
  // read was outstanding — so neither a navigation reset nor a newer file choice can
  // be overwritten by a stale continuation. A synchronous ref (not a passive effect)
  // is required: a `file.text()` that settles before an effect could run must still
  // see the up-to-date epoch. Bumping the ref twice under a StrictMode double-render
  // is harmless — a stale read is discarded either way, and no render output depends
  // on the ref.
  const readEpoch = useRef(0)
  if (seenPlanId !== plan.id) {
    // Bumping the ref here — during the render-phase reset — is the deliberate,
    // load-bearing part of the guard: a `file.text()` still outstanding from the old
    // plan captured the pre-bump epoch, and its continuation closed over the OLD plan,
    // so it MUST be discarded once the identity changed. No render output reads this
    // ref, so the "no refs during render" rule does not apply to this mutation.
    // eslint-disable-next-line react-hooks/refs -- intentional: discard in-flight reads across a plan swap; render output never reads readEpoch
    readEpoch.current++
    setSeenPlanId(plan.id)
    setParsed(null)
    setReleased(new Map())
    setMessage(null)
  }

  const updatable = plan.accounts.filter(isBalanceUpdatable).map((a) => ({ id: a.id, name: a.name }))
  const accountName = (id: string) => updatable.find((a) => a.id === id)?.name ?? id

  // The account ids the host protects, taken straight from the structured entries
  // and independent of release state — the panel's per-option, blocked-row, and
  // belt checks read this so a field-scoped protection still marks the account in
  // the dropdowns. Entries naming no live account are dropped, matching
  // `positionalProtectedSet`.
  const planAccountIds = useMemo(() => new Set(plan.accounts.map((a) => a.id)), [plan])
  const hostProtectedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of protectedAccounts) {
      if (planAccountIds.has(entry.accountId)) ids.add(entry.accountId)
    }
    return ids
  }, [protectedAccounts, planAccountIds])

  // The effective POSITIONAL protected set the engine sees: the host's id set
  // resolved to current `accounts[i]` paths, minus every account a row released.
  // Recomputed here so it tracks live plan order and the release map; the empty
  // provider / no-release path returns the shared empty set with no work.
  const effective = useMemo<ReadonlySet<string>>(
    () => positionalProtectedSet(plan, protectedAccounts, released),
    [plan, protectedAccounts, released],
  )

  // User-initiated reset (Cancel, or a parse error): tear the table and releases down
  // AND clear the status message — a message left behind would point the user at
  // controls the reset just removed.
  const resetPanel = () => {
    setParsed(null)
    setReleased(new Map())
    setMessage(null)
  }

  const handleFile = async (file: File) => {
    setMessage(null)
    // Clear the transient state SYNCHRONOUSLY, before the async read. `file.text()`
    // can take a while for a large file; if the old parsed table and its releases
    // survived the read, the previous table would stay interactive with a stale
    // release still in effect, so Apply could write the protected account from the
    // OLD file — contradicting "choosing a new file restores protection". Tearing
    // the table and releases down first makes the restore immediate.
    setParsed(null)
    setReleased(new Map())
    // Claim the read epoch SYNCHRONOUSLY: each file selection supersedes any prior
    // in-flight read (so two files chosen back-to-back can't let the OLDER read win),
    // and a `/plan/:id` navigation reset bumps the same epoch (so a read started under
    // the old plan can't repopulate the panel after the reset ran — cloned plans share
    // account ids, so an old file could otherwise be applied to the new plan). After
    // the await, a moved epoch means this read was superseded, so discard it.
    const token = ++readEpoch.current
    const text = await file.text()
    if (token !== readEpoch.current) {
      return // a newer file choice or a plan swap landed during the read — drop it
    }
    const r = parseBrokerPositionsCsv(text)
    if (!r.ok) {
      resetPanel()
      setMessage(r.message)
      return
    }
    // A fresh file starts with protection fully restored (no releases) — already
    // cleared above — so seed the selection from a classification against the
    // host's full set resolved to current positions.
    const seedProtected = positionalProtectedSet(plan, protectedAccounts, EMPTY_RELEASED)
    const classification = classifyRefresh(plan, r.accounts, { protectedTargets: seedProtected })
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

  // The raw selection, as the engine's index→account-id map (empty = skip).
  const selection = new Map<number, string>()
  parsed?.targets.forEach((t, i) => {
    if (t !== '') selection.set(i, t)
  })

  // Before any engine call, strip EVERY (row → account) pairing where the account
  // is host-protected and NOT released to THIS row — both the unreleased case and
  // the released-to-a-DIFFERENT-row case. The engine never sees a protected
  // selection at all.
  //
  // Why strip the unreleased case too (a change from keeping it so the engine could
  // emit the skip item): two rows selecting the SAME unreleased protected account
  // are a duplicate under `buildRefreshDelta`, and any duplicate disables Apply
  // GLOBALLY — so a pair of blocked-anyway rows would prevent unrelated rows from
  // refreshing. Removing protected pairings before the engine sees them keeps a
  // collision that never lands from blocking the rows that do.
  //
  // Stripping erases the engine's audit trail (a stripped account is absent from
  // the effective set, so the engine emits neither a protected nor a duplicate skip
  // for it), so synthesize the skipped checklist item HERE: an unreleased protected
  // account reads like the engine's own protected-skip item; a released-elsewhere
  // account gets the row-scope wording. A no-protection plan keeps the selection
  // untouched. The released-to-THIS-row pairing is kept — it is the one the user
  // deliberately freed, and the effective set already omits it so it applies.
  const strippedAudit: ImportReviewItem[] = []
  const safeSelection = (() => {
    if (hostProtectedIds.size === 0) return selection
    const out = new Map<number, string>()
    for (const [i, accId] of selection) {
      if (hostProtectedIds.has(accId) && released.get(accId) !== i) {
        const releasedElsewhere = released.get(accId) !== undefined
        strippedAudit.push({
          status: 'skipped',
          source: parsed?.accounts[i]?.accountLabel ?? `Row ${i + 1}`,
          detail: releasedElsewhere
            ? `Its selected plan account (${accountName(accId)}) is protected by an advisor override released to a different row — only that row may refresh it this time.`
            : `Its selected plan account (${accountName(accId)}) is protected by an advisor override, so the refresh left its balance unchanged.`,
          locator: {
            kind: 'none',
            note: releasedElsewhere
              ? 'protected account released to another broker row'
              : 'target account is protected from refresh',
          },
          confidence: 'unmapped',
        })
        continue
      }
      out.set(i, accId)
    }
    return out
  })()

  // One preview of what apply would do, recomputed from the live (sanitized)
  // selection. The panel never applies balances itself — it renders exactly what
  // `applyRefresh` would write, because both go through `buildRefreshDelta`'s
  // single primitive with the same sanitized selection and effective set.
  const delta = parsed && classification ? buildRefreshDelta(plan, classification, safeSelection, effective) : null
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
  // Stripping a protected pairing before the engine sees it (see `safeSelection`)
  // means the engine, blind to that selection, reports the account as stale ("not in
  // the file"). But the user DID assign a file row to it — it is blocked by an
  // override, not absent. Exclude any account named in the RAW (pre-strip) selection
  // so the panel never simultaneously says "blocked by an advisor override" and
  // "isn't in the file" about the same account.
  const rawSelectedIds = new Set(selection.values())
  const staleNames = (delta?.staleAccountIds ?? []).filter((id) => !rawSelectedIds.has(id)).map(accountName)

  // Point row `i` at plan account `next` (or '' for "Don't update"). Re-targeting a
  // row that had RELEASED an account revokes that release: a release is scoped to
  // the exact (row, account) pairing that asked for it, so once the row no longer
  // selects that account its release is meaningless — protection is restored, and
  // another row may then select the account, see it blocked, and release it itself.
  // Selecting the SAME account again is a no-op and keeps any existing release.
  const changeTarget = (i: number, next: string) => {
    setParsed((prev) => (prev ? { ...prev, targets: prev.targets.map((t, j) => (j === i ? next : t)) } : prev))
    setReleased((prev) => {
      let out: Map<string, number> | null = null
      for (const [accId, row] of prev) {
        if (row === i && accId !== next) {
          if (out === null) out = new Map(prev)
          out.delete(accId)
        }
      }
      return out ?? prev
    })
  }

  // Release the account THIS row has selected: free it for THIS panel and only for
  // THIS row (never the stored override). The account is already the row's
  // selection (that is what made the row blocked), so this only records the
  // release; the target assignment is kept idempotently for robustness. Keyed by
  // account id → row index so sibling rows stay locked out of the same account.
  const allowRefresh = (i: number, accId: string) => {
    setReleased((prev) => new Map(prev).set(accId, i))
    setParsed((prev) => (prev ? { ...prev, targets: prev.targets.map((t, j) => (j === i ? accId : t)) } : prev))
  }

  const apply = () => {
    if (!parsed || !delta || blocked) return
    // The UNIQUE protected accounts a selected-but-blocked row points at — the
    // accounts the user sees blocked. Counted before the apply so a zero-write result
    // can name protection as the cause instead of falsely claiming nothing was
    // assigned. Counted by account id (not by row) so two rows on one protected
    // account report one protected account, matching the message's "accounts" phrasing.
    const blockedAccountIds = new Set<string>()
    for (const [i, accId] of selection) {
      if (hostProtectedIds.has(accId) && released.get(accId) !== i) blockedAccountIds.add(accId)
    }
    const protectionBlocked = blockedAccountIds.size
    let applied = 0
    update((d) => {
      applied = applyRefresh(d, delta, safeSelection, effective)
    })
    // Keep the table and releases intact when the ONLY reason nothing landed is
    // protection: the zero-write message points the user at the "Allow this refresh"
    // controls, which must still be on screen to act on. A genuine nothing-selected
    // zero-write — and any successful apply — tears the panel down as before.
    const heldBackByProtection = applied === 0 && protectionBlocked > 0
    if (!heldBackByProtection) resetPanel()
    setMessage(
      applied > 0
        ? `Updated ${applied} account${applied === 1 ? '' : 's'} from the ${BROKER_LABEL[parsed.broker]} file — balances, plus cost basis where the file carried it. Review taxable accounts whose basis the file lacked.`
        : protectionBlocked > 0
          ? // Nothing landed, but the visible selections weren't ignored — they were
            // held back by advisor overrides. Say so, and point at the escape hatch.
            `No balances were applied — ${protectionBlocked} selected account${protectionBlocked === 1 ? ' is' : 's are'} protected by advisor overrides. Use “Allow this refresh” to update one deliberately.`
          : 'No accounts were assigned, so nothing changed.',
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
                  // Blocking is driven by the row's CURRENT SELECTION, not the
                  // classifier's guess: any row (even an unmatched one) may select a
                  // host-protected account, and doing so never auto-releases — the row
                  // renders BLOCKED (note + "Allow this refresh" for THAT account) and
                  // contributes nothing to the delta/apply until released. A row whose
                  // selection is released to a DIFFERENT row stays blocked with no
                  // button (one releasing row per account).
                  const selectedId = parsed.targets[i] || null
                  const selectionProtected = selectedId != null && hostProtectedIds.has(selectedId)
                  const releasedRow = selectedId != null ? released.get(selectedId) : undefined
                  const rowBlocked = selectionProtected && releasedRow !== i
                  // Offer a release only when no row has claimed the account yet —
                  // a sibling can never steal an already-released account.
                  const canRelease = selectionProtected && releasedRow === undefined
                  return (
                    <tr key={`${acc.accountLabel}-${i}`}>
                      <td>{acc.accountLabel}</td>
                      <td>{fmtMoney(acc.totalValue)}</td>
                      <td>{acc.costBasis === null ? '—' : fmtMoney(acc.costBasis)}</td>
                      <td>
                        <select
                          aria-label={`Plan account for ${acc.accountLabel}`}
                          value={parsed.targets[i] ?? ''}
                          onChange={(e) => changeTarget(i, e.target.value)}
                        >
                          <option value="">Don&apos;t update</option>
                          {updatable.map((a) => {
                            // Host-protected accounts are SELECTABLE in every row —
                            // selecting one blocks the row rather than being refused —
                            // but still carry a "(protected)" marker everywhere they
                            // are not already released to THIS row, so the user sees
                            // which choices will need "Allow this refresh".
                            const optionProtected = hostProtectedIds.has(a.id) && released.get(a.id) !== i
                            return (
                              <option key={a.id} value={a.id}>
                                {a.name}
                                {optionProtected ? ' (protected)' : ''}
                              </option>
                            )
                          })}
                        </select>
                        {rowBlocked ? (
                          <div className="refresh-protected" role="note">
                            <span className="muted">Protected — advisor override</span>
                            {canRelease && selectedId ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                aria-label={`Allow this refresh for ${accountName(selectedId)}`}
                                onClick={() => allowRefresh(i, selectedId)}
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
          <ReviewChecklist items={[...delta.review, ...strippedAudit, ...parsed.review]} />
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
