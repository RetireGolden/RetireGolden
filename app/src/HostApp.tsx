import { useEffect, useState } from 'react'
import { PlannerApp } from '@retiregolden/planner-ui'
import { loadImportFeature } from './importFeature'

// Start the request once, but mount the recovery-capable shell immediately in
// its fail-closed state. StrictMode may remount effects in development; sharing
// this promise avoids duplicate bootstrap requests.
const importFeature = loadImportFeature()

export function HostApp() {
  const [importEnabled, setImportEnabled] = useState(false)
  useEffect(() => {
    let mounted = true
    void importFeature.then((enabled) => {
      if (mounted) setImportEnabled(enabled)
    })
    return () => {
      mounted = false
    }
  }, [])
  return <PlannerApp importEnabled={importEnabled} />
}
