import type { CSSProperties } from 'react'

/**
 * Height for a shared `.chart-frame` wrapper, passed via the custom property the
 * class reads (UI/UX round 2, Step 5). Keeps the reusable width:100% frame in
 * CSS while the per-chart height stays a value token, not an inline style block.
 */
export const frameH = (px: number): CSSProperties => ({ ['--chart-frame-h']: `${px}px` }) as CSSProperties
