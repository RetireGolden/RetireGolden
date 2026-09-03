/**
 * Plan workspace state: loads a plan by id, applies edits immutably (clone →
 * mutate → Zod re-parse), and autosaves to IndexedDB on a debounce. Edits
 * that fail validation still update the screen (so the user can finish
 * typing) but are not persisted; the issues surface in the save indicator
 * and section forms.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { PlanLoadRepair } from '@retiregolden/engine/model/migrations'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { loadPlanVia, savePlanVia, usePlanStore } from '../data/planStoreContext'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { EXAMPLE_PLAN_ID_PREFIX, isExamplePlanId } from '../data/planOrigin'
import { getExampleById } from './examples/registry'
import { saveFreshDemo } from './examples/loadExample'
import { ParsedIssuesCtx, PlanCtx, parsedIssuesOf, type PlanContextValue, type SaveState } from './planContextCore'
import { PlanRepairCtx } from './planRepairContext'
import { usePlannerEdition } from './editionContext'

const AUTOSAVE_MS = 600

/**
 * Reused across a planId change, not remounted. Both callers (PlanWorkspace and
 * ReportPage) render this from a route whose `:planId` param changes, and
 * neither passes a key, so a plan switch updates the prop and leaves every piece
 * of state exactly as the previous plan left it. State that describes one
 * particular document — the load repairs, the load error — is therefore tagged
 * with the plan it describes and read back only on a tag match, so a previous
 * plan's news cannot sit over the next plan for the whole fetch. Tagging also
 * keeps the reset out of the load effect's body, where a synchronous setState is
 * what react-hooks/set-state-in-effect forbids. `plan`, `saveState`, `issues`,
 * and any pending autosave do still carry across; see the load effect.
 */
/**
 * The `loadError.reason` for a store that never answered, as opposed to a
 * record that answered badly. Every other reason here comes from the
 * migration; this one is the read itself failing, and it is a different thing
 * to tell the household: nothing is wrong with their plan.
 */
export const PLAN_LOAD_STORAGE_UNAVAILABLE = 'storage_unavailable'

export function PlanProvider({ planId, children }: { planId: string; children: ReactNode }) {
  const store = usePlanStore()
  const readOnly = useWorkspaceReadOnly()
  const { homeLabel } = usePlannerEdition()
  const [plan, setPlan] = useState<Plan | null>(null)
  // Why the load failed, and for which plan. Tagged for the same reason the
  // repair list is: this provider is reused across a planId change, so an
  // untagged error would keep "This plan could not be opened" over the next plan
  // for its whole fetch — a household that opened a broken plan and then picked a
  // good one was told the good one could not be opened, permanently, because
  // nothing ever cleared it. Read during render on a tag match rather than reset
  // from inside the load effect.
  const [loadError, setLoadError] = useState<{ planId: string; reason: string } | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [issues, setIssues] = useState<string[]>([])
  // Parsed once per (plan, issues) pair and shared through ParsedIssuesCtx: a
  // field asking for its own issue must not re-parse the whole list, and the
  // card lists read the same objects (r3-7).
  const parsedIssues = useMemo(() => (plan ? parsedIssuesOf(issues, plan) : null), [issues, plan])
  // What the load changed in the stored document. Set from the load result and
  // never from an edit, so the notice describes the document as it was found.
  //
  // Tagged with the plan it describes rather than cleared on a switch. This
  // provider stays mounted across a planId change (see the note above the
  // component), so an untagged list would sit over the next plan for the whole
  // fetch — as would
  // its dismissal, which is the same state. Tagging makes that unrepresentable
  // instead of merely handled, and it reads during render rather than resetting
  // state from inside the load effect.
  const [loadRepairs, setLoadRepairs] = useState<{ planId: string; repairs: readonly PlanLoadRepair[] }>({
    planId,
    repairs: [],
  })
  const timer = useRef<number | null>(null)
  const latestValid = useRef<Plan | null>(null)
  // Latest read-only value, read inside the debounced save. A save can be
  // scheduled while writable and fire ~600 ms later; if the host flips
  // read-only in that window (an entitlement gate trips mid-session), the
  // captured closure must still see the current value and not write. Synced in
  // an effect (never mutate a ref during render); the debounce fires long after
  // commit, so the ref is always current by the time runSave reads it.
  const readOnlyRef = useRef(readOnly)

  useEffect(() => {
    let cancelled = false
    // Every adoption states its own repairs and its own (absent) error, so no
    // path can inherit a previous load's by saying nothing. Clearing the error
    // here is what the tag alone cannot do: a reload of the *same* planId that
    // failed once and now succeeds keeps a matching tag, so the card would
    // outlive the plan it described. `plan`, `saveState`, `issues`, and any
    // pending autosave all still carry across a planId change, which is this
    // provider's pre-existing behavior and not this change's to move.
    const adopt = (loaded: Plan, repairs: readonly PlanLoadRepair[]) => {
      setPlan(loaded)
      latestValid.current = loaded
      setLoadRepairs({ planId, repairs })
      setLoadError(null)
      setSaveState('saved')
    }
    void (async () => {
      // A REJECTED read is not a reason code the migration produced: the store
      // never answered. Left uncaught it holds the workspace on its loading
      // skeleton forever, with no `loadError` to render and an unhandled
      // rejection as the only trace.
      let r
      try {
        r = await loadPlanVia(store, planId)
      } catch {
        if (cancelled) return
        setLoadError({ planId, reason: PLAN_LOAD_STORAGE_UNAVAILABLE })
        return
      }
      if (cancelled) return
      if (r.ok) {
        adopt(r.plan, r.repairs)
        return
      }
      // A shared or bookmarked example URL can reference a demo that was never
      // seeded in this browser (plans are per-device). Seed a fresh copy from
      // the registry instead of dead-ending the advertised on-ramp — but ONLY
      // when the record is missing ('not_object'). Other reasons (bad_version,
      // newer_than_app, …) mean a record EXISTS and failed to open; seeding
      // over it would silently discard the on-device edits the product copy
      // promises are kept.
      if (isExamplePlanId(planId) && r.reason === 'not_object') {
        const example = getExampleById(planId.slice(EXAMPLE_PLAN_ID_PREFIX.length))
        if (example) {
          // The seed is a WRITE, and it can be refused for the same reasons
          // the read can. Treat that as the storage failure it is rather than
          // reporting the record as merely missing.
          const seeded = await saveFreshDemo(example).catch(() => null)
          if (cancelled) return
          if (seeded === null) {
            setLoadError({ planId, reason: PLAN_LOAD_STORAGE_UNAVAILABLE })
            return
          }
          if (seeded.ok) {
            // A seed is built from the registry, not read from storage, so
            // nothing was repaired. Said explicitly rather than left to the
            // reset above, so every adoption states its own repairs.
            adopt(seeded.plan, [])
            return
          }
        }
      }
      setLoadError({ planId, reason: r.reason })
    })()
    return () => {
      cancelled = true
    }
  }, [planId, store])

  // savePlanVia resolves { ok: false } on validation failure, but the store
  // write itself can still reject (quota, private mode) — degrade to 'error'
  // instead of leaving 'saving' stuck plus an unhandled rejection.
  //
  // Read-only is enforced here, at the single point that touches the store:
  // no write is even attempted, so the host's `savePlan` throw (its
  // authoritative gate) is never reached. `update` already avoids scheduling
  // when read-only; this guard is the belt-and-suspenders backstop for any
  // other path (flush on pagehide, a stray caller, or a debounce scheduled
  // just before the flip). It reads the ref so the check is never stale, and
  // the callback stays store-stable so pending timers point at one function.
  const runSave = useCallback((toSave: Plan) => {
    if (readOnlyRef.current) return
    setSaveState('saving')
    void savePlanVia(store, toSave)
      .then((r) => {
        setSaveState(r.ok ? 'saved' : 'error')
      })
      .catch(() => {
        setSaveState('error')
      })
  }, [store])

  const scheduleSave = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      const toSave = latestValid.current
      if (toSave) runSave(toSave)
    }, AUTOSAVE_MS)
  }, [runSave])

  /** Runs a debounced save immediately; no-op when nothing is pending. */
  const flushPendingSave = useCallback(() => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
    const toSave = latestValid.current
    if (toSave) runSave(toSave)
  }, [runSave])

  // Dismissal is state here rather than inside the notice so it survives the
  // notice unmounting (a section change that swaps the workspace subtree). It
  // is tagged like the list itself, so dismissing one plan's notice cannot
  // dismiss the next plan's before the household has seen it.
  const dismissLoadRepairs = useCallback(() => {
    setLoadRepairs({ planId, repairs: [] })
  }, [planId])

  const discardPendingSave = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    latestValid.current = null
  }, [])

  // Track the latest read-only value for the debounced save, and if the host
  // flips read-only on mid-session, cancel any debounce already in flight so it
  // doesn't fire a late (no-op) save. `runSave`'s ref guard is the correctness
  // backstop; this keeps the ref current and stops the stale timer promptly.
  useEffect(() => {
    readOnlyRef.current = readOnly
    if (readOnly && timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [readOnly])

  const update = useCallback(
    (mutator: (draft: Plan) => void) => {
      // Read-only means the plan cannot mutate — not merely that it isn't
      // saved. Dropping the mutation entirely (no on-screen change, no
      // latestValid update) keeps read-only from producing a confusing
      // half-mode where KPIs/strategy shift as if edited and then evaporate on
      // reload, and stops a later re-enable from persisting that in-memory
      // change. The editing controls are disabled and the explore-page apply/
      // add actions are gated on `useWorkspaceReadOnly()`; this is the backstop
      // for any mutate path that slips the UI gate. Uses the ref so a flip
      // mid-render can't leave a stale-writable window.
      if (readOnlyRef.current) return
      setPlan((current) => {
        if (!current) return current
        const draft = structuredClone(current)
        mutator(draft)
        const parsed = parsePlan(draft)
        if (parsed.ok) {
          latestValid.current = parsed.plan
          setIssues([])
          setSaveState('dirty')
          scheduleSave()
          return parsed.plan
        }
        setIssues(parsed.issues)
        setSaveState('invalid')
        return draft
      })
    },
    [scheduleSave],
  )

  // Flush pending saves when the page is hidden or torn down. The unmount
  // cleanup alone is not enough: it never runs on tab close, and a mobile OS
  // can kill a hidden PWA without any unmount — so `pagehide` and
  // `visibilitychange → hidden` both flush too.
  useEffect(() => {
    const onPageHide = () => flushPendingSave()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSave()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flushPendingSave()
    }
  }, [flushPendingSave])

  // An error tagged for a different plan belongs to the plan being navigated
  // away from, so it says nothing about this one.
  const staleError = loadError !== null && loadError.planId !== planId
  if (loadError !== null && !staleError) {
    // 'not_object' = no record in this browser (cross-device link, stale
    // bookmark). Everything else = a stored plan that exists but failed to
    // open (version/migration mismatch) — telling that user "not stored here"
    // would be wrong and alarming.
    // A third case: the store never answered, so nothing is known to be wrong
    // with the plan itself. Saying "could not be opened" there would blame the
    // household's data for a browser that refused to talk.
    const unavailable = loadError.reason === PLAN_LOAD_STORAGE_UNAVAILABLE
    const missing = loadError.reason === 'not_object'
    return (
      <div className="card empty-state">
        <h2>{unavailable ? 'Your plans could not be read' : missing ? 'Plan not found' : 'This plan could not be opened'}</h2>
        <p className="muted">
          {unavailable ? (
            <>
              Storage is unavailable in this browser right now, so this plan could not be read. Your data has not
              been changed. Reloading the page tries again.
            </>
          ) : missing ? (
            <>
              This plan isn&apos;t stored in this browser. Plans live only on the device where they were created, so
              a link from another device or an old bookmark won&apos;t open here. You can restore one from a backup
              file via Data &amp; privacy on the planner home.
            </>
          ) : (
            <>
              The plan is stored on this device, but its data doesn&apos;t match what this version of the app can
              read, usually a version mismatch (for example, a backup made by a newer version). Your data has not
              been changed. Try reloading to pick up the latest app version, or restore a backup via Data &amp;
              privacy on the planner home.
            </>
          )}
        </p>
        <div className="picker-actions">
          <Link to="/" className="btn btn-primary">
            {homeLabel}
          </Link>
          <Link to="/examples" className="btn btn-secondary">
            Browse examples
          </Link>
        </div>
        <details className="ss-explainer">
          <summary>Technical details</summary>
          <p className="muted">Load failed with reason code: {loadError.reason}</p>
        </details>
      </div>
    )
  }
  // A stale tag means the switch away from the failed plan has started and the
  // next load has not resolved: the skeleton, same as any other unresolved load.
  // Not the plan still sitting in `plan` — a plan that carried across generally
  // does stay on screen while the next one loads (pre-existing, and left alone),
  // but here the household was last shown the error card, not that plan, so
  // putting it back would resurrect a plan they had already navigated away from.
  if (staleError || !plan) {
    return <div className="skeleton" style={{ height: '14rem', marginTop: '1rem' }} aria-label="Loading plan" />
  }
  const contextValue: PlanContextValue = { plan, update, discardPendingSave, saveState, issues }
  return (
    <ParsedIssuesCtx.Provider value={parsedIssues}>
      <PlanCtx.Provider value={contextValue}>
      {/* A list tagged for a different plan belongs to the one being navigated
          away from, so it reads as empty here rather than as that plan's news. */}
      <PlanRepairCtx.Provider
        value={{
          repairs: loadRepairs.planId === planId ? loadRepairs.repairs : [],
          dismiss: dismissLoadRepairs,
        }}
      >
        {children}
      </PlanRepairCtx.Provider>
      </PlanCtx.Provider>
    </ParsedIssuesCtx.Provider>
  )
}
