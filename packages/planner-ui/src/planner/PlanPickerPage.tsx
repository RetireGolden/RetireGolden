/**
 * Planner home: adaptive welcome for newcomers, plans-first for returning users.
 * Composes section components from ./home/.
 */

import { Link, useNavigate } from 'react-router'

import { createEmptyPlan } from '@retiregolden/engine/model/plan'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { DataAndPrivacyCard } from './home/DataAndPrivacyCard'
import { GettingStartedPaths } from './home/GettingStartedPaths'
import { GettingStartedReopener } from './home/GettingStartedReopener'
import { StartHereLinks } from './home/StartHereLinks'
import { useHomeData } from './home/useHomeData'
import { useHomeMode } from './home/useHomeMode'
import { WelcomeHero } from './home/WelcomeHero'
import { YourPlans } from './home/YourPlans'

const GETTING_STARTED_PANEL_ID = 'home-getting-started-panel'

export function PlanPickerPage() {
  const navigate = useNavigate()
  const {
    plans,
    listUnavailable,
    notice,
    undoPlan,
    undoDelete,
    dismissUndo,
    fileInput,
    createAndOpen,
    handleExportAll,
    handleImportFile,
    handleDuplicate,
    handleDelete,
    handleClearAll,
    openPlan,
    dialogs,
  } = useHomeData()

  // A list that could not be read is not a library that is empty. Rendering
  // the newcomer welcome over someone's plans, on the one screen that offers
  // the backup, is the worst available reading of a failed read — so the mode
  // is derived from "unknown" (null), exactly as it is while the list loads.
  const { mode, welcomeExpanded, dismissWelcome, showWelcome } = useHomeMode(listUnavailable ? null : plans)
  const readOnly = useWorkspaceReadOnly()
  const isLoading = plans === null
  const isFirstRun = !isLoading && mode === 'first-run'

  const gettingStartedBlock = (
    <>
      <WelcomeHero
        onTryExample={() => void navigate('/examples')}
        onDismiss={dismissWelcome}
        showDismiss={mode === 'returning'}
        headingLevel={mode === 'returning' ? 'h2' : 'h1'}
      />
      <GettingStartedPaths onCreatePlan={(plan) => void createAndOpen(plan)} />
      <StartHereLinks />
    </>
  )

  return (
    <section className="page picker-page">
      {/* Outside the polite status region below: this is the state of the
          list itself, not the outcome of an action, and it stays on screen
          until a read succeeds. */}
      {listUnavailable ? (
        <div className="callout callout--warn" role="alert">
          Your saved plans could not be read, so this page cannot list them. Storage is unavailable in this browser
          right now. Reloading the page tries again.
        </div>
      ) : null}
      <div role="status" aria-live="polite">
        {notice ? <div className="callout callout--info">{notice}</div> : null}
        {undoPlan ? (
          <div className="undo-toast">
            <span>
              Deleted “{undoPlan.name}”.
            </span>
            <div className="undo-toast-actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => void undoDelete()}>
                Undo
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={dismissUndo} aria-label="Dismiss">
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <>
          <div className="skeleton" style={{ height: '2rem', marginBottom: '1rem' }} aria-hidden="true" />
          <div className="skeleton" style={{ height: '8rem' }} aria-label="Loading plans" />
        </>
      ) : isFirstRun ? (
        gettingStartedBlock
      ) : (
        <>
          <GettingStartedReopener
            expanded={welcomeExpanded}
            onToggle={() => (welcomeExpanded ? dismissWelcome() : showWelcome())}
            panelId={GETTING_STARTED_PANEL_ID}
          >
            {gettingStartedBlock}
          </GettingStartedReopener>

          <YourPlans
            plans={plans}
            headingLevel="h1"
            actions={
              <>
                {readOnly ? null : (
                  <button type="button" className="btn btn-primary" onClick={() => void createAndOpen(createEmptyPlan())}>
                    New plan
                  </button>
                )}
                <Link to="/compare" className="btn btn-secondary">
                  Compare plans
                </Link>
              </>
            }
            onOpenPlan={(id) => void openPlan(id)}
            onDuplicate={(s) => void handleDuplicate(s)}
            onDelete={(s) => void handleDelete(s)}
          />
        </>
      )}

      <DataAndPrivacyCard
        plans={plans}
        listUnavailable={listUnavailable}
        fileInput={fileInput}
        onExportAll={() => void handleExportAll()}
        onImportFile={(file) => void handleImportFile(file)}
        onClearAll={() => void handleClearAll()}
      />
      {dialogs}
    </section>
  )
}
