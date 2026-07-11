/**
 * Persistent banner when viewing a library example in the workspace.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LearnLink } from '../../learn/LearnLink'
import { usePlanStore } from '../../data/planStoreContext'
import { useDialogs } from '../dialogs'
import { usePlan } from '../planContextCore'
import { getExampleById } from './registry'
import { saveExampleToMyPlans } from './loadExample'
import { EXAMPLE_BANNER_PERSISTENCE } from './exampleCopy'

export function ExamplePreviewBanner() {
  const { plan, discardPendingSave } = usePlan()
  const store = usePlanStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const { alert, dialogs } = useDialogs()

  if (plan.origin !== 'example') return null

  const example = plan.exampleSourceId ? getExampleById(plan.exampleSourceId) : undefined
  const learnHook = example
    ? { slug: example.learnSlug, label: 'Learn about this example' }
    : null

  const handleSave = async () => {
    setBusy(true)
    try {
      discardPendingSave()
      const r = await saveExampleToMyPlans(plan, { store })
      if (r.ok) navigate(`/plan/${r.plan.id}/results`)
      else await alert({ title: 'Save example', body: `Could not save: ${r.issues.join('; ')}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="callout callout--info example-preview-banner" role="status">
      <p>
        <strong>You&apos;re viewing an example.</strong> {EXAMPLE_BANNER_PERSISTENCE}
        {example?.lookFor ? ` ${example.lookFor}` : ''}
      </p>
      <div className="picker-actions" style={{ margin: 0 }}>
        <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void handleSave()}>
          Save to my plans
        </button>
        {learnHook ? <LearnLink {...learnHook} variant="button" className="btn btn-secondary btn-small" /> : null}
      </div>
      {dialogs}
    </div>
  )
}
