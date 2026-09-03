import type { RefObject } from 'react'

import type { PlanSummary } from '../../data/planStoreContext'
import { useWorkspaceReadOnly } from '../../data/workspaceReadOnly'

type DataAndPrivacyCardProps = {
  plans: PlanSummary[] | null
  /** The last list read failed, so an empty `plans` does not mean an empty library. */
  listUnavailable?: boolean
  fileInput: RefObject<HTMLInputElement | null>
  onExportAll: () => void
  onImportFile: (file: File) => void
  onClearAll: () => void
}

export function DataAndPrivacyCard({
  plans,
  listUnavailable = false,
  fileInput,
  onExportAll,
  onImportFile,
  onClearAll,
}: DataAndPrivacyCardProps) {
  const readOnly = useWorkspaceReadOnly()
  const listReady = plans !== null
  // A failed list must not disable the backup and claim there is nothing to
  // export: that is the moment the user most wants a copy, and the export
  // re-reads the store, so pressing it is a real retry that reports its own
  // outcome either way.
  const canExport = listReady && (plans.length > 0 || listUnavailable)
  const emptyLibrary = listReady && !listUnavailable && plans.length === 0
  return (
    <div className="card home-privacy-card">
      <h2>Your data stays on your device, not on our servers</h2>
      <p className="card-hint">
        RetireGolden has no accounts and no server storage. Everything you enter stays on this device, which means we
        can never see it, and we can never recover it either. To keep a plan safe or move it to another device,
        download a plan backup and take it with you.
      </p>
      <div className="picker-actions" style={{ margin: 0 }}>
        {/* Download backup is an export (read) path — always available.
            Import (writes plans) and Clear all (deletes) are hidden when
            read-only. Disabled until a plan exists; the hint names why. */}
        <div className="home-export-action">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onExportAll()}
            disabled={!canExport}
            aria-describedby={emptyLibrary ? 'home-export-why' : undefined}
          >
            Download plan backup
          </button>
          {emptyLibrary ? (
            <p id="home-export-why" className="field-hint home-export-why">
              No plan to export yet
            </p>
          ) : null}
        </div>
        {readOnly ? null : (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
              Import previous backup
            </button>
            <button type="button" className="btn btn-secondary btn-danger" onClick={() => void onClearAll()}>
              Clear all data
            </button>
          </>
        )}
      </div>
      {/* Reached only through the visible "Import previous backup" button;
          keeping it out of the tab order stops an invisible tab stop. */}
      {readOnly ? null : (
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImportFile(f)
            e.target.value = ''
          }}
        />
      )}
    </div>
  )
}
