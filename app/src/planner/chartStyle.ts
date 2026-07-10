/** Shared recharts tooltip surface, matching the app's card styling. */

import type { CSSProperties } from 'react'

export const chartTooltipStyle: CSSProperties = {
  backgroundColor: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  boxShadow: 'var(--shadow-card)',
}
