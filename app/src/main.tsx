import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@retiregolden/planner-ui/index.css'
import { installStaleChunkReloadHandler, PlannerApp } from '@retiregolden/planner-ui'

// Before render: recover from a deploy replacing the hashed chunks under
// this tab (auto-reload once on a failed lazy import instead of erroring).
installStaleChunkReloadHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PlannerApp />
    </BrowserRouter>
  </StrictMode>,
)
