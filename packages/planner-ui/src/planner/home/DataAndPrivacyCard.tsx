import type { RefObject } from 'react'

import type { PlanSummary } from '../../data/planStoreContext'
import { useWorkspaceReadOnly } from '../../data/workspaceReadOnly'

type DataAndPrivacyCardProps = {
  plans: PlanSummary[] | null
  fileInput: RefObject<HTMLInputElement | null>
  onExportAll: () => void
  onImportFile: (file: File) => void
  onClearAll: () => void
}

export function DataAndPrivacyCard({
  plans,
  fileInput,
  onExportAll,
  onImportFile,
  onClearAll,
}: DataAndPrivacyCardProps) {
  const readOnly = useWorkspaceReadOnly()
  return (
    <div className="card home-privacy-card">
      <h2>Your data stays on your device, not on our servers</h2>
      <p className="card-hint">
        RetireGolden has no accounts and no server storage. Everything you enter stays on this device, which means we
        can never see it — and we can never recover it either. To keep a plan safe or move it to another device,
        download a plan backup and take it with you.
      </p>
      <div className="picker-actions" style={{ margin: 0 }}>
        {/* Download backup is an export (read) path — always available.
            Import (writes plans) and Clear all (deletes) are hidden when
            read-only. */}
        <button type="button" className="btn btn-secondary" onClick={() => void onExportAll()} disabled={!plans || plans.length === 0}>
          Download plan backup
        </button>
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
