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
  return <DefaultTooltipContent {...props} payload={payload} />
}
