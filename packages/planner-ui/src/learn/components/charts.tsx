/**
 * Chart registry for `figure` blocks. Articles reference a chart by id; this
 * helper maps the id to the right (internal) chart component. Defining no
 * component of its own keeps this module off the Fast Refresh boundary.
 */

import type { ReactNode } from 'react'
import { PurchasingPowerChart } from './PurchasingPowerChart'

/** Chart ids articles may reference; used by the registry-integrity test. */
export const LEARN_CHART_IDS = ['purchasing-power'] as const

/** Render the chart registered under `chartId`, or null if there is no match. */
export function renderLearnChart(chartId: string): ReactNode {
  switch (chartId) {
    case 'purchasing-power':
      return <PurchasingPowerChart />
    default:
      return null
  }
}
