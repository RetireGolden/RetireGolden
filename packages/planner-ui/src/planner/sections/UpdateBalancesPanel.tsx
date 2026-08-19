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
 *
 * A host that resolves protection asynchronously reports `pending` through the
 * same context, and the panel then refuses BOTH the file chooser and Apply.
 *
 * Apply is the SAFETY gate. The chooser is a HONESTY one, and the distinction is
 * worth keeping straight: nothing about the preview is unsafe while protection is
 * unknown, because every protection-derived value here — `hostProtectedIds`,
 * `effective`, `classification`, `safeSelection`, `delta` — is recomputed from the
 * live context on every render, and the row seeding in `handleFile` never consults
 * protection at all (see `defaultTarget`, which defaults a protected guess ON on
 * purpose so its row renders blocked). What a preview built during the window
 * WOULD do is assert something false: every row drawn as unprotected, no
 * "Protected — advisor override" notes, and then the table silently rewriting
 * itself when the real set lands. Refusing the file until protection is known
 * means the panel never makes a claim it is about to retract.
 *
 * This is a DIFFERENT cause from the duplicate-collision block below (`blocked`,
 * two rows on one plan account), and the two say so separately.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
  captureRefreshSnapshot,
  normalizeBrokerAccountLabel,
  revertToSnapshot,
  type RefreshCandidate,
  type RefreshFieldDelta,
  type RefreshSnapshot,
} from '../../import/refresh'
import {
  deleteRefreshManualMapping,
  listRefreshManualMappings,
  listRefreshSnapshots,
  refreshHistoryAvailable,
  saveRefreshManualMapping,
  saveRefreshSnapshot,
} from '../../import/refreshHistory'
import type { ImportReviewItem } from '../../import/reviewChecklist'
import { ReviewChecklist } from '../../import/ReviewChecklistView'
import { digestSource } from '../../import/sourceHash'
import { usePlan } from '../planContextCore'
import {
  useRefreshProtection,
  useRefreshProtectionPending,
  type RefreshProtectionEntry,
} from '../refreshProtectionContext'
import { fmtMoney } from '../format'

// The reconciliation identity is exact to the cent; rounding its display to
// whole dollars would show 0 for a real 1-cent remainder.
const fmtCents = (value: number): string =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_PROTECTED: ReadonlySet<string> = new Set()
const EMPTY_REMEMBERED: ReadonlyMap<string, string> = new Map()

/**
 * The one explanation for the protection-pending gate, shared by the visible
 * callout and the `title` on both gated controls, so the tooltip and the prose
 * can never drift. Deliberately worded around the CAUSE (protection is still
 * being looked up) rather than the symptom, and distinct from the
 * duplicate-collision wording so the user can tell the two blocks apart.
 */
const PENDING_EXPLANATION =
  'Checking which accounts your advisor has protected. Balance updates are paused until that finishes, so a refresh cannot overwrite a protected account by mistake.'

/** The duplicate-collision cause, as a `title` for the same disabled Apply control. */
const DUPLICATE_EXPLANATION =
  'Two rows are assigned to the same plan account, so nothing is applied until each plan account is assigned at most once.'
/** A stable empty release map for the fresh-file seed (no allocation per parse). */
const EMPTY_RELEASED: ReadonlyMap<string, number> = new Map()

interface ParsedFile {
  broker: BrokerId
  sourceLabel: string
  sourceSha256: string
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
  /** Per-plan manual assignments loaded from the local refresh-history store. */
  rememberedMappings: ReadonlyMap<string, string>
  /** Row indexes the user explicitly assigned in this panel session. */
  manualTargetIndexes: ReadonlySet<number>
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
  if (candidate.match === 'exact' || candidate.match === 'remembered' || candidate.match === 'likely') return candidate.targetAccountId ?? ''
  return ''
}

async function sourceIdentity(file: File): Promise<{ sha256: string; bytes: number }> {
  const arrayBuffer = (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer
  if (!arrayBuffer) return { sha256: '', bytes: file.size }
  try {
    return await digestSource(await arrayBuffer.call(file))
  } catch {
    return { sha256: '', bytes: file.size }
  }
}

function restoreDeltas(plan: Plan, snapshot: RefreshSnapshot): RefreshFieldDelta[] {
  const deltas: RefreshFieldDelta[] = []
  for (const change of snapshot.changes) {
    const index = plan.accounts.findIndex((account) => account.id === change.accountId)
    const account = plan.accounts[index]
    if (index < 0 || !account || !isBalanceUpdatable(account)) continue
    deltas.push({
      path: `accounts[${index}].balance`,
      field: 'balance',
      before: account.balance,
      after: change.before.balance,
      clamped: false,
    })
    if ((account.type === 'taxable' || account.type === 'equityComp') && change.before.costBasis !== null) {
      deltas.push({
        path: `accounts[${index}].costBasis`,
        field: 'costBasis',
        before: account.costBasis,
        after: change.before.costBasis,
        clamped: false,
      })
    }
  }
  return deltas
}

function snapshotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function UpdateBalancesPanel() {
  const { plan, update } = usePlan()
  const protectedAccounts = useRefreshProtection()
  // The host has not resolved its protected set yet, so `protectedAccounts` is
  // not yet trustworthy — an empty list here would mean "unknown", not "nothing".
  const protectionPending = useRefreshProtectionPending()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<RefreshSnapshot[]>([])
  // Accounts the user has transiently released from protection for THIS panel
  // instance via "Allow this refresh", keyed by account id → the broker-row index
  // that requested the release. This is UI-local and deliberately does not touch
  // the advisor's stored override — it only frees the account from the effective
  // set the three engine calls see, and scopes the unlock to the requesting row
  // (a sibling row still cannot reach the account). Cleared whenever a new file is
  // parsed or the panel resets.
  const [released, setReleased] = useState<ReadonlyMap<string, number>>(() => new Map())
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let current = true
    void listRefreshSnapshots(plan.id)
      .then((stored) => {
        if (current) setSnapshots(stored)
      })
      .catch(() => {
        if (current) setSnapshots([])
      })
    return () => {
      current = false
    }
  }, [plan.id])

  // The workspace reuses this one panel instance across `/plan/:id` navigation, so
  // the transient file state (parsed table, row-scoped releases, status message)
  // would otherwise survive into a DIFFERENT plan. Cloned plans share account ids,
  // so a stale release could bypass protection cross-plan. Reset everything back to
  // its seed the moment the plan IDENTITY changes, tracked by the render-phase
  // "adjust state while rendering" pattern (not an effect — the reset must land
  // before this render derives anything from `parsed`, and React discards the
  // interrupted render without an extra commit).
  const [seenPlanId, setSeenPlanId] = useState(plan.id)
  // One epoch guarding every async file read against a NEWER read (a second file
  // chosen while the first is outstanding). It is bumped ONLY inside event handlers —
  // at the very start of `handleFile`, before its await — never during render. A
  // read captures the epoch before awaiting `file.text()` and discards its parse if
  // the epoch moved while the read was outstanding, so a stale continuation cannot
  // overwrite a newer selection. Keeping the bump out of render is load-bearing: a
  // ref mutation does NOT roll back when React discards a concurrent render, so a
  // render-phase bump could invalidate a legitimate read that belongs to the STILL-
  // VISIBLE plan the discarded render never replaced. Handlers only ever run for a
  // committed tree, so an epoch bumped there is always real.
  const readEpoch = useRef(0)
  // Plan identity guard, separate from the read epoch. `committedPlanId` tracks the
  // plan whose render actually COMMITTED, updated in a layout effect. Layout effects
  // run synchronously inside the commit task, so a pending `file.text()` microtask
  // cannot interleave between commit and this ref update (the flaw of an earlier
  // passive-effect version), and a discarded render never runs effects — so the ref
  // is only ever advanced by a real plan swap, never by a render React threw away.
  // `handleFile` captures `plan.id` before its await and discards its parse if the
  // committed plan identity changed while the read was outstanding — the id-based
  // half of the guard that a plain (same-plan) re-render leaves untouched.
  const committedPlanId = useRef(plan.id)
  useLayoutEffect(() => {
    committedPlanId.current = plan.id
  }, [plan.id])
  // The same commit-synchronous treatment for protection going back to UNKNOWN
  // mid-read — tracked as a GENERATION, not as the current value. A read started
  // while protection was known lands in a microtask that closed over the OLD
  // `protectionPending`, so the handler's entry check cannot see the flip; and a
  // read slow enough to span a whole false→true→false cycle would find only the
  // final `false`, then call `setParsed` and restore the very preview the pending
  // transition deliberately cleared. Counting the false→true EDGES instead means a
  // token captured before the await answers "did protection go unknown while I was
  // reading?" rather than "is it unknown right now?".
  //
  // Advanced in a layout effect for the same reason as `committedPlanId`: layout
  // effects run synchronously inside the commit task, so a pending `file.text()`
  // microtask cannot interleave between the commit and this update, and a render
  // React discards never runs effects — so a discarded concurrent render can
  // neither mis-arm the counter nor invalidate a legitimate read.
  const committedProtectionPending = useRef(protectionPending)
  const protectionUnknownEpoch = useRef(0)
  useLayoutEffect(() => {
    if (protectionPending && !committedProtectionPending.current) protectionUnknownEpoch.current += 1
    committedProtectionPending.current = protectionPending
  }, [protectionPending])
  if (seenPlanId !== plan.id) {
    // Render-phase STATE reset on a plan-identity change: this is the sanctioned
    // "adjust state while rendering" pattern (rollback-safe — React discards the
    // interrupted render and re-runs with the reset state, no extra commit). Only
    // STATE is touched here; the read epoch is deliberately NOT bumped in render (a
    // ref mutation would not roll back on a discarded render). The in-flight-read
    // discard across a plan swap is handled by the commit-synchronous
    // `committedPlanId` ref instead.
    setSeenPlanId(plan.id)
    setParsed(null)
    setReleased(new Map())
    setMessage(null)
    setSnapshots([])
  }

  // Protection going back to UNKNOWN gets the same render-phase reset. Anything
  // already parsed had its row selections seeded — and its classification,
  // preview and delta derived — from the set that was known a moment ago; keeping
  // that table on screen would show a preview computed against a protection set
  // that no longer applies, and it would silently change when the host's answer
  // lands. Only the false→true edge resets: true→false (the host finishing its
  // load) simply re-enables an already-empty panel.
  const [seenPending, setSeenPending] = useState(protectionPending)
  if (seenPending !== protectionPending) {
    setSeenPending(protectionPending)
    if (protectionPending) {
      setParsed(null)
      setReleased(new Map())
      setMessage(null)
    }
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
    // Belt against a file arriving while protection is unknown (the chooser is
    // disabled, but the hidden input can still be driven directly). Parsing here
    // would seed row selections from a protected set the host has not resolved.
    if (protectionPending) return
    setMessage(null)
    // Clear the transient state SYNCHRONOUSLY, before the async read. `file.text()`
    // can take a while for a large file; if the old parsed table and its releases
    // survived the read, the previous table would stay interactive with a stale
    // release still in effect, so Apply could write the protected account from the
    // OLD file — contradicting "choosing a new file restores protection". Tearing
    // the table and releases down first makes the restore immediate.
    setParsed(null)
    setReleased(new Map())
    // Claim the read epoch SYNCHRONOUSLY (in this handler, never in render): each file
    // selection supersedes any prior in-flight read, so two files chosen back-to-back
    // can't let the OLDER read win. Also snapshot the plan identity and the
    // protection-unknown epoch this read belongs to. After the await, discard if ANY of
    // three things moved: the read epoch (a newer file choice), the committed plan
    // identity (a `/plan/:id` navigation swap) — cloned plans share account ids, so a
    // read started under the old plan must not repopulate the panel after the swap — or
    // the protection-unknown epoch, because a read that began while protection was known
    // must not seed a table if the host has said, at any point since, that it no longer
    // knows. Every one of the three refs is advanced in an event handler or a layout
    // effect, so this microtask cannot slip in before the change is recorded.
    const token = ++readEpoch.current
    const capturedPlanId = plan.id
    const capturedProtectionEpoch = protectionUnknownEpoch.current
    const [text, source, storedMappings] = await Promise.all([
      file.text(),
      sourceIdentity(file),
      listRefreshManualMappings(capturedPlanId),
    ])
    if (
      token !== readEpoch.current ||
      committedPlanId.current !== capturedPlanId ||
      protectionUnknownEpoch.current !== capturedProtectionEpoch
    ) {
      return // a newer file choice, a plan swap, or protection going unknown — drop it
    }
    const r = parseBrokerPositionsCsv(text)
    if (!r.ok) {
      resetPanel()
      setMessage(r.message)
      return
    }
    const rememberedMappings = new Map<string, string>()
    const currentAccountIds = new Set(plan.accounts.map((account) => account.id))
    for (const mapping of storedMappings) {
      if (!currentAccountIds.has(mapping.accountId)) {
        // A stale operational preference must not point a future row at a
        // deleted account. Drop it quietly: the file is still valid to review.
        void deleteRefreshManualMapping(mapping.planId, mapping.normalizedBrokerLabel)
        continue
      }
      if (mapping.normalizedBrokerLabel !== '') rememberedMappings.set(mapping.normalizedBrokerLabel, mapping.accountId)
    }
    // A fresh file starts with protection fully restored (no releases) — already
    // cleared above — so seed the selection from a classification against the
    // host's full set resolved to current positions.
    const seedProtected = positionalProtectedSet(plan, protectedAccounts, EMPTY_RELEASED)
    const classification = classifyRefresh(plan, r.accounts, { protectedTargets: seedProtected, rememberedMappings })
    setParsed({
      broker: r.broker,
      sourceLabel: `${BROKER_LABEL[r.broker]} — ${file.name}`,
      sourceSha256: source.sha256,
      accounts: r.accounts,
      targets: classification.candidates.map(defaultTarget),
      review: r.review,
      rememberedMappings,
      manualTargetIndexes: new Set(),
    })
  }

  // Classification is DERIVED from the raw parse result and the current effective
  // set — never stored — so releasing a row re-runs it against the smaller set.
  // Keyed on the raw accounts (stable across target edits) and `effective`, so a
  // selection change alone does not re-classify.
  const rawAccounts = parsed?.accounts ?? null
  const rememberedMappings = parsed?.rememberedMappings ?? EMPTY_REMEMBERED
  const classification = useMemo(
    () => (rawAccounts ? classifyRefresh(plan, rawAccounts, { protectedTargets: effective, rememberedMappings }) : null),
    [plan, rawAccounts, effective, rememberedMappings],
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
            ? `Its selected plan account (${accountName(accId)}) is protected by an advisor override released to a different row. Only that row may refresh it this time.`
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
  const delta = parsed && classification ? buildRefreshDelta(plan, classification, safeSelection, effective, () => new Date()) : null
  const candidates = classification?.candidates ?? []
  const dateFlagBySourceIndex = new Map((delta?.dateFlags ?? []).map((flag) => [flag.sourceIndex, flag]))

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
    setParsed((prev) => {
      if (!prev) return prev
      const manualTargetIndexes = new Set(prev.manualTargetIndexes)
      manualTargetIndexes.add(i)
      return { ...prev, targets: prev.targets.map((t, j) => (j === i ? next : t)), manualTargetIndexes }
    })
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

  const apply = async () => {
    const targetPlanId = plan.id
    // `protectionPending` joins `blocked` as a refusal: applying against a set the
    // host has not resolved is exactly the overwrite the seam exists to prevent.
    if (!parsed || !delta || blocked || protectionPending) return
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
    // Derive the apply outcome SYNCHRONOUSLY from the already-built delta — do NOT read
    // it back from the `update()` mutator. PlanContext queues the mutator through a
    // `setPlan` updater that React may DEFER, so a post-update read of a variable the
    // mutator assigns can still see 0 while the write actually lands later — which would
    // wrongly report "held back by protection" for a refresh that succeeds. The number
    // of accounts `applyRefresh` will write equals the unique account indices in
    // `delta.changes` (every write emits a `.balance` change for its account), and by
    // the preview-agreement design — same primitive, same sanitized selection, same
    // effective set — that is exactly what the mutator does; a non-empty
    // `delta.duplicateGroups` blocks everything, so zero. Every UI decision below reads
    // this derived count, never the mutator's timing.
    const applied =
      delta.duplicateGroups.length > 0
        ? 0
        : new Set(delta.changes.map((c) => c.path.slice(0, c.path.lastIndexOf('.')))).size
    if (applied > 0) {
      const snapshot = captureRefreshSnapshot(plan, delta, {
        id: snapshotId(),
        appliedAtIso: new Date().toISOString(),
        sourceLabel: parsed.sourceLabel,
        sourceSha256: parsed.sourceSha256,
      })
      // Durability ordering is the acceptance criterion: the undo record and
      // the remembered mappings must be on disk BEFORE the plan mutates, so a
      // crash or reload between the two still leaves them recoverable. Hosts
      // without IndexedDB have no durable store and stay synchronous.
      if (refreshHistoryAvailable()) {
        try {
          await saveRefreshSnapshot(snapshot)
        } catch {
          // A failed history write must not block the refresh itself; the
          // in-session restore list below still works for this session.
        }
      } else {
        void saveRefreshSnapshot(snapshot)
      }
      setSnapshots((previous) =>
        [...previous.filter((item) => item.id !== snapshot.id), snapshot]
          .sort((left, right) => right.appliedAtIso.localeCompare(left.appliedAtIso) || right.id.localeCompare(left.id))
          .slice(0, 10),
      )

      const appliedAccountIds = new Set<string>()
      for (const change of delta.changes) {
        if (change.field !== 'balance') continue
        const index = /^accounts\[(\d+)\]\.balance$/.exec(change.path)
        const account = index ? plan.accounts[Number(index[1])] : undefined
        if (account) appliedAccountIds.add(account.id)
      }
      for (const index of parsed.manualTargetIndexes) {
        const accountId = safeSelection.get(index)
        const normalizedBrokerLabel = normalizeBrokerAccountLabel(parsed.accounts[index]?.accountLabel ?? '')
        if (!accountId || !appliedAccountIds.has(accountId) || normalizedBrokerLabel === '') continue
        const mapping = {
          planId: plan.id,
          normalizedBrokerLabel,
          accountId,
          assignedAtIso: new Date().toISOString(),
        }
        // Remembered overrides share the durability ordering: on disk before
        // the mutation when a durable store exists.
        if (refreshHistoryAvailable()) {
          try {
            await saveRefreshManualMapping(mapping)
          } catch {
            // Best-effort; classification simply re-derives next time.
          }
        } else {
          void saveRefreshManualMapping(mapping)
        }
      }
    }
    // The mutator still performs the real write; its return value drives no UI decision
    // (it may run after this function returns), so it is intentionally not captured.
    // The awaits above yield; if the user navigated to a different plan in
    // that window, mutating whatever is now current would corrupt it.
    if (plan.id !== targetPlanId) return
    update((d) => {
      if (d.id !== targetPlanId) return
      applyRefresh(d, delta, safeSelection, effective)
    })
    // Keep the table and releases intact when the ONLY reason nothing landed is
    // protection: the zero-write message points the user at the "Allow this refresh"
    // controls, which must still be on screen to act on. A genuine nothing-selected
    // zero-write — and any successful apply — tears the panel down as before.
    const heldBackByProtection = applied === 0 && protectionBlocked > 0
    if (!heldBackByProtection) resetPanel()
    setMessage(
      applied > 0
        ? `Updated ${applied} account${applied === 1 ? '' : 's'} from the ${BROKER_LABEL[parsed.broker]} file: balances, plus cost basis where the file carried it. Review taxable accounts whose basis the file lacked.` +
          // A partial apply tears the table (and its skipped-item audit) down, so
          // the held-back accounts must be named here or the user never learns a
          // selected account was deliberately left unchanged.
          (protectionBlocked > 0
            ? ` ${protectionBlocked} selected account${protectionBlocked === 1 ? ' was' : 's were'} left unchanged, protected by advisor overrides.`
            : '')
        : protectionBlocked > 0
          ? // Nothing landed, but the visible selections weren't ignored — they were
            // held back by advisor overrides. Say so, and point at the escape hatch.
            `No balances were applied. ${protectionBlocked} selected account${protectionBlocked === 1 ? ' is' : 's are'} protected by advisor overrides. Use “Allow this refresh” to update one deliberately.`
          : 'No accounts were assigned, so nothing changed.',
    )
  }

  const restoreSnapshot = async (snapshot: RefreshSnapshot) => {
    if (snapshot.planId !== plan.id) return
    const targetPlanId = plan.id
    const beforeRestore = restoreDeltas(plan, snapshot)
    const outcome = revertToSnapshot(plan, snapshot)
    if (beforeRestore.length > 0) {
      const undoSnapshot = captureRefreshSnapshot(plan, beforeRestore, {
        id: snapshotId(),
        appliedAtIso: new Date().toISOString(),
        sourceLabel: `Restore previous balances (${snapshot.sourceLabel})`,
        sourceSha256: snapshot.sourceSha256,
      })
      if (undoSnapshot.changes.length > 0) {
        // Same durability ordering as apply: the undo record must be on disk
        // before the plan mutates so restore stays undoable across a reload.
        if (refreshHistoryAvailable()) {
          try {
            await saveRefreshSnapshot(undoSnapshot)
          } catch {
            // Best-effort: the in-session list below still works.
          }
        } else {
          void saveRefreshSnapshot(undoSnapshot)
        }
        setSnapshots((previous) =>
          [...previous.filter((item) => item.id !== undoSnapshot.id), undoSnapshot]
            .sort((left, right) => right.appliedAtIso.localeCompare(left.appliedAtIso) || right.id.localeCompare(left.id))
            .slice(0, 10),
        )
      }
    }
    // The await above yields; if the user navigated to a different plan in
    // that window, mutating whatever is now current would corrupt it.
    if (plan.id !== targetPlanId) return
    update((draft) => {
      if (draft.id !== targetPlanId) return
      const reverted = revertToSnapshot(draft, snapshot)
      const restoredById = new Map(reverted.plan.accounts.map((account) => [account.id, account]))
      for (const account of draft.accounts) {
        const restored = restoredById.get(account.id)
        if (!restored || !isBalanceUpdatable(account) || !isBalanceUpdatable(restored)) continue
        account.balance = restored.balance
        if (
          (account.type === 'taxable' || account.type === 'equityComp') &&
          (restored.type === 'taxable' || restored.type === 'equityComp')
        ) {
          account.costBasis = restored.costBasis
        }
      }
    })
    resetPanel()
    const restoredCount = snapshot.changes.length - outcome.skippedAccountIds.length
    setMessage(
      restoredCount > 0
        ? `Restored previous balances for ${restoredCount} account${restoredCount === 1 ? '' : 's'} from ${snapshot.sourceLabel}.` +
          (outcome.skippedAccountIds.length > 0
            ? ` Skipped ${outcome.skippedAccountIds.length} deleted account${outcome.skippedAccountIds.length === 1 ? '' : 's'}.`
            : '')
        : `No balances were restored from ${snapshot.sourceLabel}; ${outcome.skippedAccountIds.length} account${outcome.skippedAccountIds.length === 1 ? ' is' : 's are'} no longer in this plan.`,
    )
  }

  return (
    <div className="card">
      <h2>Update balances from a broker CSV</h2>
      <p className="card-hint">
        Download the positions/holdings CSV from Schwab, Fidelity, or Vanguard and refresh your account
        balances (and cost basis where the file has it) without retyping. Only balance and cost basis change.
        Your return, yield, contribution, and beneficiary settings are left alone. The file is read on this
        device only. To start a whole new plan from a file, use Import &amp; migrate on the home screen.
      </p>
      {snapshots.length > 0 ? (
        <details className="refresh-history">
          <summary>Restore previous balances</summary>
          <p className="card-hint">Saved refresh snapshots stay on this device and do not travel with the plan file.</p>
          <ul>
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <span>
                  {snapshot.appliedAtIso.slice(0, 10)} — {snapshot.sourceLabel} — {snapshot.changes.length} account
                  {snapshot.changes.length === 1 ? '' : 's'}
                </span>{' '}
                <button type="button" className="btn btn-secondary btn-small" onClick={() => restoreSnapshot(snapshot)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {message ? (
        <div className="callout callout--info" role="status">
          {message}
        </div>
      ) : null}
      {/* The protection-pending explanation. Named by its own class so it is
          addressable separately from the apply-status callout, and worded around
          its own cause so it can never be mistaken for the duplicate-collision
          alert further down. */}
      {protectionPending ? (
        <div className="callout callout--info refresh-protection-pending" role="status">
          {PENDING_EXPLANATION}
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
                  const dateFlag = dateFlagBySourceIndex.get(i)
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
                      <td>
                        {acc.accountLabel}
                        {candidate.match === 'remembered' ? <div className="muted">Remembered match</div> : null}
                        {dateFlag ? (
                          <div className="muted">
                            {dateFlag.kind === 'staleDate'
                              ? `Stale file date: ${dateFlag.ageDays} days old`
                              : 'File date unavailable'}
                          </div>
                        ) : null}
                      </td>
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
                            <span className="muted">Protected: advisor override</span>
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
          <div className="callout callout--info" role="status">
            Reconciliation: file total {fmtCents(delta.reconciliation.fileTotal)}; matched total{' '}
            {fmtCents(delta.reconciliation.matchedTotal)}; unmatched remainder{' '}
            {fmtCents(delta.reconciliation.unmatchedRemainder)}; plan balances {fmtCents(delta.reconciliation.planTotalBefore)}{' '}
            → {fmtCents(delta.reconciliation.planTotalAfter)}.
          </div>
          {staleNames.length > 0 ? (
            <div className="callout callout--info" role="status">
              These plan accounts aren&apos;t in the file, so their balances stay as they are (going stale):{' '}
              {staleNames.join(', ')}. Update them from their own broker download when you have it.
            </div>
          ) : null}
          {blocked ? (
            <div className="callout callout--warn" role="alert">
              Two rows are assigned to the same plan account ({duplicateNames.join(', ')}). The second would silently
              overwrite the first, so nothing is applied. Assign each plan account at most once.
            </div>
          ) : null}
          {/* The parser's file-level honesty items ride alongside the refresh's
              field-level ones — one checklist, so "no cost basis in the file" and
              "refreshed the balance to $X" are read together. */}
          <ReviewChecklist items={[...delta.review, ...strippedAudit, ...parsed.review]} />
          <div className="picker-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={apply}
              disabled={blocked || protectionPending}
              // Two distinct causes can disable Apply; name whichever fired so the
              // control never sits greyed out without saying why. Protection-pending
              // wins the label because it also removed the table this button acts on.
              title={protectionPending ? PENDING_EXPLANATION : blocked ? DUPLICATE_EXPLANATION : undefined}
            >
              Apply selected balances
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetPanel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="picker-actions" style={{ margin: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInput.current?.click()}
            disabled={protectionPending}
            title={protectionPending ? PENDING_EXPLANATION : undefined}
          >
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
