/**
 * Wraps a plan-editing region so every descendant form control disables at
 * once when the workspace is read-only. A native `<fieldset disabled>` is the
 * reliable way to do this — the browser propagates `disabled` to all contained
 * inputs, selects, and buttons — so entry-section forms need no per-control
 * wiring. The `.editable-region` class strips the fieldset's default box
 * styling (border/margin/padding) so it lays out transparently.
 *
 * Used only for pure plan-editing pages (the "Enter" sections). Read/explore
 * surfaces (Results, Monte Carlo, Report, Compare) and their export controls
 * are deliberately left outside any fieldset so they keep working read-only.
 */

import type { ReactNode } from 'react'

import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'

export function EditableFieldset({ children }: { children: ReactNode }) {
  const readOnly = useWorkspaceReadOnly()
  return (
    <fieldset className="editable-region" disabled={readOnly}>
      {children}
    </fieldset>
  )
}
