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
import { importErrorMessage } from './importErrorMessage'

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
  const undoTimer = useRef<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const { confirm, prompt, dialogs } = useDialogs()

  const refresh = useCallback(() => {
    void listPlansVia(store).then(setPlans)
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
    const r = await savePlanVia(store, plan)
    if (r.ok) openPlan(r.plan.id)
    else setNotice(`Could not save the new plan: ${r.issues.join('; ')}`)
  }

  const handleExportAll = async () => {
    const summaries = await listPlansVia(store)
    const loaded: Plan[] = []
    for (const s of summaries) {
      const r = await loadPlanVia(store, s.id)
      if (r.ok) loaded.push(r.plan)
    }
    const blob = new Blob([serializeV2Backup(loaded)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `retiregolden-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImportFile = async (file: File) => {
    const r = parseV2Backup(await file.text())
    if (!r.ok) {
      setNotice(importErrorMessage(r.reason))
      return
    }
    const normalized = await normalizePlansForImport(r.plans, await listKnownPlanIdsVia(store))
    for (const p of normalized) await savePlanVia(store, p)
    setNotice(
      `Imported ${normalized.length} plan${normalized.length === 1 ? '' : 's'}.` +
        (r.warnings.length > 0 ? ` Skipped: ${r.warnings.join('; ')}` : ''),
    )
    refresh()
  }

  const handleDuplicate = async (s: PlanSummary) => {
    const name = await prompt({
      title: 'Duplicate plan',
      label: 'Name for the duplicated plan',
      defaultValue: `Copy of ${s.name}`,
      confirmLabel: 'Duplicate',
    })
    if (name === null) return
    const r = await duplicatePlanVia(store, s.id, { name })
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
    const loaded = await loadPlanVia(store, s.id)
    await deletePlanVia(store, s.id)
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
      const r = await savePlanVia(store, restored)
      if (r.ok) {
        undoPlanRef.current = null
        setUndoPlan(null)
        refresh()
      } else {
        setNotice(`Could not restore "${restored.name}": ${r.issues.join('; ')}`)
      }
    } catch {
      setNotice(`Could not restore "${restored.name}". Storage is unavailable in this browser right now.`)
    }
  }

  const dismissUndo = () => {
    finalizePendingDelete()
  }

  const handleClearAll = async () => {
    const ok = await confirm({
      title: 'Clear all data',
      body:
        'This erases ALL RetireGolden data from this browser: every plan, plus Social Security and ' +
        'life-expectancy entries. It cannot be undone. Download a plan backup first if you want to keep anything.',
      confirmLabel: 'Erase everything',
      danger: true,
      typedConfirmation: 'delete',
      extraAction: { label: 'Download backup', onClick: () => void handleExportAll() },
    })
    if (!ok) return
    // A pending delete-undo would let "Undo" resurrect a plan after the
    // erasure — drop it before clearing so "erases ALL data" stays true.
    dismissUndo()
    // With a host-provided store, this surface's plan list lives there —
    // honor the dialog's "every plan" promise through the seam before the
    // device-local wipe. (The default web path is untouched: clearAllPlans
    // already clears the browser database in one call.)
    if (store !== indexedDbPlanStore) {
      for (const s of await store.listPlans()) await deletePlanVia(store, s.id)
    }
    await clearAllPlans()
    // Refresh snapshots and remembered broker mappings live in their own
    // database; "erases ALL data" must cover them too.
    await clearAllRefreshHistory()
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('retiregolden.')) localStorage.removeItem(key)
      }
    } catch {
      /* localStorage unavailable — IndexedDB is already cleared */
    }
    setNotice('All RetireGolden data has been erased from this browser.')
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
