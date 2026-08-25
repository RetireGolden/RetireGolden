import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@retiregolden/planner-ui/index.css'
import { installStaleChunkReloadHandler, PlannerApp } from '@retiregolden/planner-ui'
import { loadImportFeature } from './importFeature'

// Before render: recover from a deploy replacing the hashed chunks under
// this tab (auto-reload once on a failed lazy import instead of erroring).
installStaleChunkReloadHandler()

async function start() {
  const importEnabled = await loadImportFeature()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <PlannerApp importEnabled={importEnabled} />
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()
