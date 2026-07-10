/**
 * Open a library example from a Learning Center article.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDialogs } from '../dialogs'
import { getExampleById } from './registry'
import { openExampleExisting, openExampleFresh, prepareExampleOpen } from './loadExample'
import { EXAMPLE_LOAD_FRESH_DESC, EXAMPLE_OPEN_EXISTING_DESC } from './exampleCopy'

export function OpenExampleButton({ exampleId }: { exampleId: string }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const { choice, dialogs } = useDialogs()
  const example = getExampleById(exampleId)
  if (!example) return null

  const open = async (chosen?: 'open-existing' | 'load-fresh') => {
    setBusy(true)
    try {
      if (chosen === 'open-existing') {
        const r = await openExampleExisting(exampleId)
        if (r.ok) navigate(`/plan/${r.planId}/results`)
        return
      }
      if (chosen === 'load-fresh') {
        const r = await openExampleFresh(exampleId)
        if (r.ok) navigate(`/plan/${r.planId}/results`)
        return
      }
      const prepared = await prepareExampleOpen(exampleId)
      if (!prepared.ok) return
      if (prepared.needsChoice) {
        const picked = await choice({
          title: 'Open example',
          body: `"${example.title}" was opened before. Which version would you like?`,
          choices: [
            { value: 'open-existing', label: 'Open my version', description: EXAMPLE_OPEN_EXISTING_DESC },
            { value: 'load-fresh', label: 'Load a fresh copy', description: EXAMPLE_LOAD_FRESH_DESC },
          ],
        })
        if (picked !== null) await open(picked)
        return
      }
      navigate(`/plan/${prepared.planId}/results`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void open()}>
        Open this example in the planner
      </button>
      {dialogs}
    </>
  )
}
