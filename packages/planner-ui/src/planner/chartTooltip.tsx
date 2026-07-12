/**
 * Default tooltip content, minus ~$0 rows. For stacked charts with many series
 * this keeps "HSA: $0" noise out of the tooltip. Filter here, not by nulling
 * zeros in the data: a null in a stacked Area breaks that series' polygon while
 * the series above still ramp their baseline across the gap, punching
 * background-colored wedges into the stack.
 */

import { DefaultTooltipContent, type TooltipContentProps } from 'recharts'

export function NonZeroTooltipContent(props: TooltipContentProps) {
  const payload = props.payload?.filter((entry) => typeof entry.value === 'number' && entry.value > 0.5)
  // Recharts gates tooltip visibility on the unfiltered payload, so when every
  // series is ~$0 (e.g. post-depletion years) render nothing rather than a
  // floating card holding only the year label.
  if (!payload || payload.length === 0) return null
  return <DefaultTooltipContent {...props} payload={payload} />
}
