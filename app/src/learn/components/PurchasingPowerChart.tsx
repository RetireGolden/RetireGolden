/**
 * Illustrative chart: the buying power of a fixed $50,000 over 30 years at about
 * 3% inflation a year. A teaching aid with simple, round numbers — not a
 * plan-specific result — kept evergreen (no current-year figures).
 */

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoney, fmtMoneyCompact } from '../../planner/format'
import { chartTooltipStyle } from '../../planner/chartStyle'

export function PurchasingPowerChart() {
  const start = 50_000
  const inflation = 0.03
  const data = Array.from({ length: 31 }, (_, year) => ({
    year,
    value: Math.round(start / (1 + inflation) ** year),
  }))

  return (
    <div className="learn-chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            label={{ value: 'Years from now', position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 12 }}
            height={40}
          />
          <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} />
          <Tooltip
            formatter={(v: unknown) => [fmtMoney(Number(v)), 'Buying power']}
            labelFormatter={(l) => `Year ${l}`}
            contentStyle={chartTooltipStyle}
          />
          <Line dataKey="value" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
