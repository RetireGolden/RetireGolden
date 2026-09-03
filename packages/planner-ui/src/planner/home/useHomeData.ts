import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { clearAllPlans } from '../../data/planStore'
import { clearAllRefreshHistory, clearRefreshHistoryForPlan } from '../../import/refreshHistory'
import {
  deletePlanVia,
  duplicatePlanVia,
  indexedDbPlanStore,
  listKnownPlanIdsVia,
  listPlansVia,
  loadPlanVia,
  savePlanVia,
  usePlanStore,
  type PlanSummary,
} from '../../data/planStoreContext'
import { normalizePlansForImport, parseV2Backup, serializeV2Backup } from '../../data/v2Backup'
import { type Plan } from '@retiregolden/engine/model/plan'
import { useDialogs } from '../dialogs'
import { duplicateNameDefault, duplicateNameFor, PLAN_NAME_MAX_LENGTH } from '../planName'
import { importErrorMessage } from './importErrorMessage'

/** What a "Download backup" attempt actually produced, for the caller that has to act on it. */
export interface ExportAllOutcome {
  /** A backup file was handed to the browser. False when the plan list itself could not be read. */
  downloaded: boolean
  /** Plans the store listed but could not return a valid plan for. They are NOT in the file. */
  unreadable: number
}

/**
 * The one place the storage-unavailable wording is written. The plan list, the
 * backup download, and the restore loop all reach the same browser database,
 * so they say the same thing when it refuses them.
 */
const STORAGE_UNAVAILABLE = 'Storage is unavailable in this browser right now.'

export function useHomeData() {
  const navigate = useNavigate()
  const store = usePlanStore()
  const [plans, setPlans] = useState<PlanSummary[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // A just-deleted plan, held in memory for a brief undo window. The delete is
  // already committed to storage, so an expired or navigated-away toast never
  // leaves a plan half-deleted; Undo simply re-saves the in-memory copy.
  const [undoPlan, setUndoPlan] = useState<Plan | null>(null)
  const undoPlanRef = useRef<Plan | null>(null)
  // True while an Undo restore save is in flight; finalize must not purge.
  const undoRestoreInFlight = useRef(false)
  const undoTimer = useRef<number | null>(null)
  // Whether "Clear all data" has already stopped once to disclose a backup it
  // could not complete. It stops once, not every time.
  const backupShortfallDisclosed = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const { confirm, prompt, dialogs } = useDialogs()

  // A rejected list must not leave the skeleton spinning forever, and it must
  // not read as "you have no plans" either. Show the empty list the page can
  // actually render, and say why it is empty. `planStore.db()` no longer
  // caches a rejected open, so the next refresh really can succeed.
  const refresh = useCallback(() => {
    void listPlansVia(store).then(setPlans, () => {
      setPlans([])
      setNotice(
        `Your saved plans could not be read. ${STORAGE_UNAVAILABLE} None are listed here. Reloading the page tries again.`,
      )
    })
  }, [store])

  const clearUndoTimer = () => {
    if (undoTimer.current !== null) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
  }

  // A plan's refresh snapshots and remembered assignments stay available for
  // exactly as long as its delete can still be undone. Once the toast expires
  // (or the user dismisses it), that plan cannot return through this flow, so
  // its operational history is safe to erase.
  const finalizePendingDelete = (clearVisibleToast = true) => {
    // While an Undo restore is saving, the deletion is being REVERSED, not
    // finalized: purging here would destroy the returning plan's snapshots.
    // A save that later fails after an unmount leaks that history rather
    // than losing it - the safe side of the trade.
    if (undoRestoreInFlight.current) return
    const deleted = undoPlanRef.current
    if (deleted === null) return
    clearUndoTimer()
    undoPlanRef.current = null
    if (clearVisibleToast) setUndoPlan(null)
    void clearRefreshHistoryForPlan(deleted.id)
  }

  useEffect(() => {
    refresh()
  }, [refresh])

  // The unmount finalizer must observe the LATEST pending delete while the
  // cleanup registers exactly once; the ref is written inside an effect (refs
  // must not be written during render) and read only in the cleanup.
  const finalizePendingDeleteRef = useRef(finalizePendingDelete)
  useEffect(() => {
    finalizePendingDeleteRef.current = finalizePendingDelete
  })
  useEffect(
    () => () => {
      // Leaving this screen removes the only Undo affordance, so the delete is
      // final at unmount too.
      finalizePendingDeleteRef.current(false)
    },
    [],
  )

  const openPlan = (id: string) => navigate(`/plan/${id}`)

  const createAndOpen = async (plan: Plan) => {
    let r
    try {
      r = await savePlanVia(store, plan)
    } catch {
      setNotice(`Could not save the new plan. ${STORAGE_UNAVAILABLE}`)
      return
    }
    if (r.ok) openPlan(r.plan.id)
    else setNotice(`Could not save the new plan: ${r.issues.join('; ')}`)
  }

  /**
   * Download every readable plan as one backup file, and report what did not
   * fit in it. A record that fails migration or validation (written by a newer
   * deploy in another tab, or corrupt) cannot go in the envelope, and this is
   * the file the user measures "safe to erase everything" against — so the
   * count of what was left out is surfaced rather than dropped. The symmetric
   * import path already returns `warnings[]` for exactly this reason.
   */
  const handleExportAll = async (): Promise<ExportAllOutcome> => {
    let summaries: PlanSummary[]
    try {
      summaries = await listPlansVia(store)
    } catch {
      setNotice(`No backup was downloaded. ${STORAGE_UNAVAILABLE}`)
      return { downloaded: false, unreadable: 0 }
    }
    const loaded: Plan[] = []
    let unreadable = 0
    for (const s of summaries) {
      const r = await loadPlanVia(store, s.id).catch(() => null)
      if (r?.ok) loaded.push(r.plan)
      else unreadable++
    }
    const blob = new Blob([serializeV2Backup(loaded)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `retiregolden-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    if (unreadable > 0) {
      setNotice(
        `Backup downloaded with ${loaded.length} plan${loaded.length === 1 ? '' : 's'}. ` +
          `${unreadable} plan${unreadable === 1 ? '' : 's'} could not be read, so ${unreadable === 1 ? 'it is' : 'they are'} not in the file.`,
      )
    }
    return { downloaded: true, unreadable }
  }

  const handleImportFile = async (file: File) => {
    let text: string
    try {
      text = await file.text()
    } catch {
      setNotice('That backup file could not be read. It may have moved or changed since you chose it.')
      return
    }
    const r = parseV2Backup(text)
    if (!r.ok) {
      setNotice(importErrorMessage(r.reason))
      return
    }
    const skipped = r.warnings.length > 0 ? ` Skipped: ${r.warnings.join('; ')}` : ''
    let normalized: Plan[]
    try {
      normalized = await normalizePlansForImport(r.plans, await listKnownPlanIdsVia(store))
    } catch {
      setNotice(`No plans were imported. ${STORAGE_UNAVAILABLE}${skipped}`)
      return
    }
    // The store can reject part-way through (quota, private mode). Counting
    // both sides and refreshing regardless is what keeps the notice honest:
    // the plans written before the failure are really there, and a thrown
    // loop would have told the user nothing happened at all.
    let saved = 0
    let failed = 0
    for (const p of normalized) {
      try {
        const result = await savePlanVia(store, p)
        if (result.ok) saved++
        else failed++
      } catch {
        failed++
      }
    }
    setNotice(
      failed === 0
        ? `Imported ${saved} plan${saved === 1 ? '' : 's'}.${skipped}`
        : `Imported ${saved} of ${normalized.length} plans. ${failed} could not be saved to this browser.${skipped}`,
    )
    refresh()
  }

  const handleDuplicate = async (s: PlanSummary) => {
    const name = await prompt({
      title: 'Duplicate plan',
      label: 'Name for the duplicated plan',
      defaultValue: duplicateNameDefault(s.name),
      maxLength: PLAN_NAME_MAX_LENGTH,
      confirmLabel: 'Duplicate',
    })
    if (name === null) return
    let r
    try {
      r = await duplicatePlanVia(store, s.id, { name: duplicateNameFor(name, s.name) })
    } catch {
      setNotice(`Could not duplicate "${s.name}". ${STORAGE_UNAVAILABLE}`)
      return
    }
    if (r.ok) {
      setNotice(`Duplicated "${s.name}" as "${r.plan.name}".`)
      refresh()
    } else {
      setNotice(`Could not duplicate "${s.name}": ${r.issues.join('; ')}`)
    }
  }

  const handleDelete = async (s: PlanSummary) => {
    const ok = await confirm({
      title: 'Delete plan',
      body: `Delete "${s.name}"? You'll have a few seconds to undo.`,
      confirmLabel: 'Delete plan',
      danger: true,
    })
    if (!ok) return
    let loaded
    try {
      loaded = await loadPlanVia(store, s.id)
      await deletePlanVia(store, s.id)
    } catch {
      // The delete did not land reliably, so no undo window may arm: say so
      // rather than offering an Undo for a state nobody knows.
      setNotice(`Could not delete "${s.name}". ${STORAGE_UNAVAILABLE}`)
      return
    }
    refresh()
    if (!loaded.ok) {
      // No undo window can arm (the plan could not be loaded), so nothing can
      // resurrect it - purge its refresh history now rather than leaking
      // balances and source hashes until a later clear-all.
      void clearRefreshHistoryForPlan(s.id)
    }
    if (loaded.ok) {
      // Replacing an earlier undo toast makes that earlier deletion final.
      finalizePendingDelete()
      clearUndoTimer()
      undoPlanRef.current = loaded.plan
      setUndoPlan(loaded.plan)
      undoTimer.current = window.setTimeout(() => {
        undoTimer.current = null
        finalizePendingDelete()
      }, 5000)
    }
  }

  const undoDelete = async () => {
    const restored = undoPlanRef.current
    if (!restored) return
    clearUndoTimer()
    // Keep the in-memory plan (and the toast) until the restore actually
    // lands — if the save fails, the user must not lose both the plan and
    // the affordance at once.
    try {
    undoRestoreInFlight.current = true
      const r = await savePlanVia(store, restored)
      if (r.ok) {
        undoPlanRef.current = null
        setUndoPlan(null)
        refresh()
      } else {
        setNotice(`Could not restore "${restored.name}": ${r.issues.join('; ')}`)
      }
    } catch {
      setNotice(`Could not restore "${restored.name}". ${STORAGE_UNAVAILABLE}`)
    } finally {
      undoRestoreInFlight.current = false
    }
  }

  const dismissUndo = () => {
    finalizePendingDelete()
  }

  const handleClearAll = async () => {
    // The dialog's backup action cannot close the dialog and cannot render a
    // message inside it, so a notice set while the backup runs would sit
    // behind the dialog and be read only after the erasure. Instead the
    // outcome is held here: the FIRST incomplete backup stops this pass,
    // leaving the disclosure on screen. Choosing "Clear all data" again then
    // erases, incomplete backup and all - the user has been told once, and a
    // second refusal would be an unclearable store rather than a safeguard.
    const backup: { attempt: Promise<ExportAllOutcome> | null } = { attempt: null }
    const ok = await confirm({
      title: 'Clear all data',
      body:
        'This erases ALL RetireGolden data from this browser: every plan, plus Social Security and ' +
        'life-expectancy entries. It cannot be undone. Download a plan backup first if you want to keep anything.',
      confirmLabel: 'Erase everything',
      danger: true,
      typedConfirmation: 'delete',
      extraAction: {
        label: 'Download backup',
        onClick: () => {
          backup.attempt = handleExportAll()
        },
      },
    })
    if (!ok) return
    let shortfall: string | null = null
    if (backup.attempt !== null) {
      const outcome = await backup.attempt
      shortfall = !outcome.downloaded
        ? `The backup could not be downloaded. ${STORAGE_UNAVAILABLE}`
        : outcome.unreadable > 0
          ? `${outcome.unreadable} plan${outcome.unreadable === 1 ? '' : 's'} could not be read, so ` +
            `${outcome.unreadable === 1 ? 'it is' : 'they are'} not in the backup you just downloaded.`
          : null
      if (shortfall !== null && !backupShortfallDisclosed.current) {
        backupShortfallDisclosed.current = true
        setNotice(`Nothing was erased. ${shortfall} Choose "Clear all data" again to erase anyway.`)
        return
      }
    }
    // A pending delete-undo would let "Undo" resurrect a plan after the
    // erasure — drop it before clearing so "erases ALL data" stays true.
    dismissUndo()
    // With a host-provided store, this surface's plan list lives there —
    // honor the dialog's "every plan" promise through the seam before the
    // device-local wipe. (The default web path is untouched: clearAllPlans
    // already clears the browser database in one call.)
    try {
      if (store !== indexedDbPlanStore) {
        for (const s of await store.listPlans()) await deletePlanVia(store, s.id)
      }
      await clearAllPlans()
    } catch {
      // "Erases ALL data" is a promise this pass could not keep. Say which
      // half is uncertain instead of ending on the success notice below.
      refresh()
      setNotice(`Some data could not be erased. ${STORAGE_UNAVAILABLE}`)
      return
    }
    // Refresh snapshots and remembered broker mappings live in their own
    // database; "erases ALL data" must cover them too. Every write helper
    // there is best-effort by policy, so this call does not reject.
    await clearAllRefreshHistory()
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('retiregolden.')) localStorage.removeItem(key)
      }
    } catch {
      /* localStorage unavailable — IndexedDB is already cleared */
    }
    setNotice(
      shortfall === null
        ? 'All RetireGolden data has been erased from this browser.'
        : `All RetireGolden data has been erased from this browser. ${shortfall}`,
    )
    refresh()
  }

  return {
    plans,
    notice,
    setNotice,
    undoPlan,
    undoDelete,
    dismissUndo,
    fileInput,
    refresh,
    createAndOpen,
    handleExportAll,
    handleImportFile,
    handleDuplicate,
    handleDelete,
    handleClearAll,
    openPlan,
    dialogs,
  }
}
