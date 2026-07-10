import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAllPlans,
  duplicatePlan,
  listUserPlanSummaries,
  loadPlan,
  savePlan,
  deletePlan,
  type PlanSummary,
} from '../../data/planStore'
import { normalizePlansForImport, parseV2Backup, serializeV2Backup } from '../../data/v2Backup'
import { type Plan } from '../../engine/model/plan'
import { useDialogs } from '../dialogs'
import { importErrorMessage } from './importErrorMessage'

export function useHomeData() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanSummary[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // A just-deleted plan, held in memory for a brief undo window. The delete is
  // already committed to storage, so an expired or navigated-away toast never
  // leaves a plan half-deleted; Undo simply re-saves the in-memory copy.
  const [undoPlan, setUndoPlan] = useState<Plan | null>(null)
  const undoTimer = useRef<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const { confirm, prompt, dialogs } = useDialogs()

  const refresh = useCallback(() => {
    void listUserPlanSummaries().then(setPlans)
  }, [])

  const clearUndoTimer = () => {
    if (undoTimer.current !== null) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
  }

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => () => clearUndoTimer(), [])

  const openPlan = (id: string) => navigate(`/plan/${id}`)

  const createAndOpen = async (plan: Plan) => {
    const r = await savePlan(plan)
    if (r.ok) openPlan(r.plan.id)
    else setNotice(`Could not save the new plan: ${r.issues.join('; ')}`)
  }

  const handleExportAll = async () => {
    const summaries = await listUserPlanSummaries()
    const loaded: Plan[] = []
    for (const s of summaries) {
      const r = await loadPlan(s.id)
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
    const normalized = await normalizePlansForImport(r.plans)
    for (const p of normalized) await savePlan(p)
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
    const r = await duplicatePlan(s.id, { name })
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
    const loaded = await loadPlan(s.id)
    await deletePlan(s.id)
    refresh()
    if (loaded.ok) {
      clearUndoTimer()
      setUndoPlan(loaded.plan)
      undoTimer.current = window.setTimeout(() => setUndoPlan(null), 5000)
    }
  }

  const undoDelete = async () => {
    if (!undoPlan) return
    clearUndoTimer()
    const restored = undoPlan
    // Keep the in-memory plan (and the toast) until the restore actually
    // lands — if the save fails, the user must not lose both the plan and
    // the affordance at once.
    try {
      const r = await savePlan(restored)
      if (r.ok) {
        setUndoPlan(null)
        refresh()
      } else {
        setNotice(`Could not restore "${restored.name}": ${r.issues.join('; ')}`)
      }
    } catch {
      setNotice(`Could not restore "${restored.name}" — storage is unavailable in this browser right now.`)
    }
  }

  const dismissUndo = () => {
    clearUndoTimer()
    setUndoPlan(null)
  }

  const handleClearAll = async () => {
    const ok = await confirm({
      title: 'Clear all data',
      body:
        'This erases ALL RetireGolden data from this browser — every plan, plus Social Security and ' +
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
    await clearAllPlans()
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
