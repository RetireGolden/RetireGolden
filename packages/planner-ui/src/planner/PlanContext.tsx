/**
 * Plan workspace state: loads a plan by id, applies edits immutably (clone →
 * mutate → Zod re-parse), and autosaves to IndexedDB on a debounce. Edits
 * that fail validation still update the screen (so the user can finish
 * typing) but are not persisted; the issues surface in the save indicator
 * and section forms.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { loadPlanVia, savePlanVia, usePlanStore } from '../data/planStoreContext'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { EXAMPLE_PLAN_ID_PREFIX, isExamplePlanId } from '../data/planOrigin'
import { getExampleById } from './examples/registry'
import { saveFreshDemo } from './examples/loadExample'
import { PlanCtx, type PlanContextValue, type SaveState } from './planContextCore'

const AUTOSAVE_MS = 600

/**
 * Mount with key={planId}: a plan switch remounts the provider, so initial
 * state is naturally "loading" and the load effect only sets state
 * asynchronously.
 */
export function PlanProvider({ planId, children }: { planId: string; children: ReactNode }) {
  const store = usePlanStore()
  const readOnly = useWorkspaceReadOnly()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [issues, setIssues] = useState<string[]>([])
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
    const adopt = (loaded: Plan) => {
      setPlan(loaded)
      latestValid.current = loaded
      setSaveState('saved')
    }
    void (async () => {
      const r = await loadPlanVia(store, planId)
      if (cancelled) return
      if (r.ok) {
        adopt(r.plan)
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
          const seeded = await saveFreshDemo(example)
          if (cancelled) return
          if (seeded.ok) {
            adopt(seeded.plan)
            return
          }
        }
      }
      setLoadError(r.reason)
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
      setPlan((current) => {
        if (!current) return current
        const draft = structuredClone(current)
        mutator(draft)
        const parsed = parsePlan(draft)
        if (parsed.ok) {
          latestValid.current = parsed.plan
          setIssues([])
          // Read-only: reflect the edit on screen (so any still-live control
          // stays responsive) but never mark dirty or schedule a save.
          if (!readOnly) {
            setSaveState('dirty')
            scheduleSave()
          }
          return parsed.plan
        }
        setIssues(parsed.issues)
        if (!readOnly) setSaveState('invalid')
        return draft
      })
    },
    [scheduleSave, readOnly],
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

  if (loadError) {
    // 'not_object' = no record in this browser (cross-device link, stale
    // bookmark). Everything else = a stored plan that exists but failed to
    // open (version/migration mismatch) — telling that user "not stored here"
    // would be wrong and alarming.
    const missing = loadError === 'not_object'
    return (
      <div className="card empty-state">
        <h2>{missing ? 'Plan not found' : 'This plan could not be opened'}</h2>
        <p className="muted">
          {missing ? (
            <>
              This plan isn&apos;t stored in this browser. Plans live only on the device where they were created, so
              a link from another device or an old bookmark won&apos;t open here. You can restore one from a backup
              file via Data &amp; privacy on the planner home.
            </>
          ) : (
            <>
              The plan is stored on this device, but its data doesn&apos;t match what this version of the app can
              read — usually a version mismatch (for example, a backup made by a newer version). Your data has not
              been changed. Try reloading to pick up the latest app version, or restore a backup via Data &amp;
              privacy on the planner home.
            </>
          )}
        </p>
        <div className="picker-actions">
          <Link to="/" className="btn btn-primary">
            Your plans
          </Link>
          <Link to="/examples" className="btn btn-secondary">
            Browse examples
          </Link>
        </div>
        <details className="ss-explainer">
          <summary>Technical details</summary>
          <p className="muted">Load failed with reason code: {loadError}</p>
        </details>
      </div>
    )
  }
  if (!plan) {
    return <div className="skeleton" style={{ height: '14rem', marginTop: '1rem' }} aria-label="Loading plan" />
  }
  const contextValue: PlanContextValue = { plan, update, discardPendingSave, saveState, issues }
  return <PlanCtx.Provider value={contextValue}>{children}</PlanCtx.Provider>
}
