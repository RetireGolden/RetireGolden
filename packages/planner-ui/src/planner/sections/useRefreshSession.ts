/**
 * The concurrency session behind "Update balances from a broker CSV"
 * (`UpdateBalancesPanel`). Every long-running thing the panel starts — a
 * `file.text()` read, an apply suspended on its durable undo record, a restore
 * suspended on its own — resumes in a continuation that closed over the world as
 * it was when it started. This hook is the one place that decides whether that
 * world still holds, so the panel body is left with rendering.
 *
 * ## What can move under a continuation
 *
 * Four independent things, tracked by four counters and compared through an
 * opaque token the caller takes at the start and re-checks after every await:
 *
 * 1. **A newer file selection** (`readEpoch`). Two files chosen back-to-back
 *    carry the same plan identity and the same protection state, so nothing else
 *    here distinguishes them: only a per-read epoch makes the OLDER read lose.
 *    Every selection claims one — including a selection the panel refuses on size
 *    before it reads a byte, which is still a newer selection and must still
 *    supersede the read it replaced.
 * 2. **Anything that changes what the preview promises** (`panelEpoch`): Cancel,
 *    a re-target, a release, a new file. The panel's standing rule is that apply
 *    writes exactly what the preview showed, so an apply suspended on its undo
 *    record when the preview changes underneath it is abandoned rather than
 *    landing a selection the user can no longer see.
 * 3. **A plan swap** (`committedPlanId`). The workspace reuses one panel instance
 *    across `/plan/:id` navigation, and cloned plans share account ids — so a
 *    read, apply, or restore that began under the old plan must not land on the
 *    new one, where it would look entirely plausible.
 * 4. **Protection going back to UNKNOWN** (`protectionUnknownEpoch`, whose
 *    false→true edges `committedProtectionPending` counts). A continuation closed
 *    over the OLD `pending` value, so it cannot see the host withdraw its
 *    protected set by sampling the flag; and a read slow enough to span a whole
 *    false→true→false cycle would find only the final `false`, then restore the
 *    very preview the pending transition deliberately cleared. Counting EDGES
 *    means a token answers "did protection go unknown while I was working?"
 *    rather than "is it unknown right now?". Counting the false→true edge
 *    rather than every transition is not observable through this surface today
 *    — a caller only ever takes a token while protection is KNOWN, so the first
 *    transition it can see is false→true either way — but it is the honest
 *    statement of what the counter means, and it stays right if a future caller
 *    is ever allowed to start work inside the window.
 *
 * ## Why the counters advance where they do
 *
 * `readEpoch` and `panelEpoch` are bumped ONLY from event handlers, never during
 * render. A ref mutation does not roll back when React discards a concurrent
 * render, so a render-phase bump could invalidate a legitimate read belonging to
 * the STILL-VISIBLE plan that the discarded render never replaced. Handlers only
 * ever run for a committed tree, so an epoch bumped there is always real.
 *
 * `committedPlanId` and `protectionUnknownEpoch` are advanced in LAYOUT effects,
 * which run synchronously inside the commit task: a pending `file.text()`
 * microtask cannot interleave between the commit and the update (the flaw of an
 * earlier passive-effect version), and a render React discards never runs
 * effects, so a discarded concurrent render can neither mis-arm a counter nor
 * invalidate a legitimate read.
 *
 * ## The render-phase reset flags
 *
 * `planChanged` and `protectionWentUnknown` are the panel's cue to drop its
 * transient state (parsed table, row-scoped releases, status message) while
 * RENDERING — the sanctioned "adjust state while rendering" pattern, not an
 * effect: the reset must land before this render derives anything from the
 * parsed file, and React discards the interrupted render and re-runs with the
 * reset state rather than committing twice. Only STATE is touched that way; the
 * epochs above stay out of render for the rollback reason already given, which
 * is why the in-flight discard rides on the commit-synchronous refs instead.
 *
 * `protectionWentUnknown` fires on the false→true edge only: true→false (the
 * host finishing its load) simply re-enables an already-empty panel.
 *
 * ## Serialising the durable writes
 *
 * Apply and restore each persist an undo record BEFORE they mutate, and those
 * writes yield to the event loop. Two clicks would otherwise both capture the
 * same before-state, so at most one durable write runs at a time — across BOTH
 * operations, not per operation: a restore must not start while an apply is
 * suspended either. `beginApply`/`beginRestore` return `null` when one is
 * already in flight; the caller pairs a non-null token with `endWrite()` in a
 * `finally`.
 */
import { useLayoutEffect, useRef, useState } from 'react'

/**
 * What a caller captured when it started. Opaque on purpose: the caller re-hands
 * it to `isCurrent` rather than comparing counters itself, so a new dimension can
 * be added here without every await site learning about it.
 *
 * `planId` is deliberately readable — the async work needs the plan it belongs
 * to (to load its remembered mappings, to address its snapshot store, to guard
 * the mutator), and reading it off the token is what keeps that value and the
 * identity check from ever disagreeing.
 */
export interface RefreshSessionToken {
  /** The plan this work belongs to. */
  readonly planId: string
  /** The protection-unknown generation when the work started. */
  readonly protectionEpoch: number
  /** Set for reads, which a newer selection supersedes; `null` otherwise. */
  readonly readEpoch: number | null
  /**
   * Set for an apply, which the preview changing underneath invalidates. `null`
   * for reads (a read IS the newer selection) and for a restore, which reverts
   * to a stored snapshot and so does not depend on the preview at all.
   */
  readonly panelEpoch: number | null
}

export interface RefreshSession {
  /**
   * The plan identity changed on this render. The caller drops its transient
   * state during render; the in-flight discard is handled by the tokens.
   */
  readonly planChanged: boolean
  /** Protection went from known to UNKNOWN on this render (the false→true edge). */
  readonly protectionWentUnknown: boolean
  /**
   * "What the preview promises has changed" — Cancel, a re-target, a release.
   * Invalidates any suspended apply. Event handlers only, never render.
   */
  invalidate: () => void
  /**
   * Claim a new file read. Supersedes any outstanding read AND invalidates a
   * suspended apply, because the preview that apply was authorised against is
   * being torn down. Call it before the first await, never during render.
   */
  beginRead: () => RefreshSessionToken
  /** Start an apply, or `null` when a durable write is already in flight. */
  beginApply: () => RefreshSessionToken | null
  /** Start a restore, or `null` when a durable write is already in flight. */
  beginRestore: () => RefreshSessionToken | null
  /** Release the durable-write slot. Pair with a non-null begin, in a `finally`. */
  endWrite: () => void
  /** Does the world the token captured still hold? */
  isCurrent: (token: RefreshSessionToken) => boolean
}

/**
 * @param planId the plan the panel is currently rendering
 * @param protectionPending whether the host says its protected set is unknown
 */
export function useRefreshSession(planId: string, protectionPending: boolean): RefreshSession {
  const readEpoch = useRef(0)
  const panelEpoch = useRef(0)
  const committedPlanId = useRef(planId)
  const committedProtectionPending = useRef(protectionPending)
  const protectionUnknownEpoch = useRef(0)
  // Which durable write owns the slot, or null. One flag rather than one per
  // operation: apply and restore each refuse to start while EITHER is in flight,
  // so the two are exactly one mutual-exclusion slot.
  const writing = useRef<'apply' | 'restore' | null>(null)

  useLayoutEffect(() => {
    committedPlanId.current = planId
  }, [planId])

  useLayoutEffect(() => {
    if (protectionPending && !committedProtectionPending.current) protectionUnknownEpoch.current += 1
    committedProtectionPending.current = protectionPending
  }, [protectionPending])

  const [seenPlanId, setSeenPlanId] = useState(planId)
  const planChanged = seenPlanId !== planId
  if (planChanged) setSeenPlanId(planId)

  const [seenPending, setSeenPending] = useState(protectionPending)
  if (seenPending !== protectionPending) setSeenPending(protectionPending)
  const protectionWentUnknown = seenPending !== protectionPending && protectionPending

  return {
    planChanged,
    protectionWentUnknown,
    invalidate: () => {
      panelEpoch.current += 1
    },
    beginRead: () => {
      const read = ++readEpoch.current
      panelEpoch.current += 1
      return { planId, protectionEpoch: protectionUnknownEpoch.current, readEpoch: read, panelEpoch: null }
    },
    beginApply: () => {
      if (writing.current !== null) return null
      writing.current = 'apply'
      return { planId, protectionEpoch: protectionUnknownEpoch.current, readEpoch: null, panelEpoch: panelEpoch.current }
    },
    beginRestore: () => {
      if (writing.current !== null) return null
      writing.current = 'restore'
      return { planId, protectionEpoch: protectionUnknownEpoch.current, readEpoch: null, panelEpoch: null }
    },
    endWrite: () => {
      writing.current = null
    },
    isCurrent: (token) =>
      (token.readEpoch === null || token.readEpoch === readEpoch.current) &&
      (token.panelEpoch === null || token.panelEpoch === panelEpoch.current) &&
      committedPlanId.current === token.planId &&
      protectionUnknownEpoch.current === token.protectionEpoch,
  }
}
