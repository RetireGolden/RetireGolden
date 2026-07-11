/**
 * Bucket reporting lens card (spending-paths & SWR-lenses plan, Goal 5): an
 * opt-in re-reading of the same ledger balances as time-segmented buckets —
 * "the next N years of net spending", then growth. Reporting only: nothing
 * feeds back into the engine, and the honest evidence note stays attached
 * because the bucket literature (Estrada; Kitces) finds no systematic benefit
 * over total-return investing — the comfort is the product, not extra return.
 */

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { bucketLens, BUCKET_PRESETS } from './bucketLens'
import { chartTooltipStyle } from './chartStyle'
import { frameH } from './chartFrame'
import { fmtMoney, fmtMoneyCompact } from './format'
import { SelectField } from './fields'

const BUCKET_COLORS = ['var(--chart-5)', 'var(--chart-2)', 'var(--chart-1)']

export function BucketLensCard({
  result,
  adj,
}: {
  result: ProjectionResult
  /** Dollar-mode adapter from ResultsPage: (year, nominal) → displayed dollars. */
  adj: (year: number, v: number) => number
}) {
  const [presetId, setPresetId] = useState<'off' | 'three' | 'two'>('off')
  const preset = BUCKET_PRESETS.find((p) => p.id === presetId) ?? null

  const rows = useMemo(() => {
    if (!preset) return []
    return bucketLens(result, preset.spans).map((row) => ({
      year: row.year,
      ...Object.fromEntries(row.buckets.map((b, i) => [`b${i}`, adj(row.year, b)])),
    }))
  }, [result, preset, adj])

  return (
    <div className="chart-card">
      <h2>Bucket view (a reporting lens)</h2>
      <p className="card-hint">
        Many retirees think in buckets: a couple of years of spending in cash, several more in stable assets, the
        rest invested for growth. This view reads the same projected balances that way — bucket 1 holds the next
        years of <em>net</em> spending (spending plus taxes, minus that year&apos;s income), and so on — without
        changing how the plan is invested or simulated. The buckets sum exactly to the investable total every year.
      </p>
      <div className="form-grid">
        <SelectField
          label="Bucket definition"
          help="Purely presentational: pick how the projected balances are segmented. Bucket studies (Estrada; Kitces) find no systematic return or safety benefit from actually managing money as buckets versus a rebalanced total-return portfolio — the value is legibility, so RetireGolden reports buckets but never invests by them."
          value={presetId}
          options={[
            { value: 'off', label: 'Off' },
            ...BUCKET_PRESETS.map((p) => ({ value: p.id, label: p.label })),
          ]}
          onCommit={(v) => setPresetId(v as 'off' | 'three' | 'two')}
        />
      </div>
      {preset ? (
        <>
          <div className="chart-frame" style={frameH(280)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={rows}
                margin={{ left: 12, right: 8, top: 8 }}
                aria-label="Bucket view: projected balances segmented into spending buckets, year by year"
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
                <Legend />
                {preset.bucketLabels.map((label, i) => (
                  <Area
                    key={label}
                    dataKey={`b${i}`}
                    stackId="buckets"
                    name={label}
                    stroke={BUCKET_COLORS[i % BUCKET_COLORS.length]}
                    fill={BUCKET_COLORS[i % BUCKET_COLORS.length]}
                    fillOpacity={0.55}
                  />
                ))}
                <Tooltip
                  formatter={(v: unknown) => fmtMoney(Number(v))}
                  contentStyle={chartTooltipStyle}
                  wrapperStyle={{ zIndex: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="field-hint" style={{ marginTop: '0.5rem' }}>
            Honest labeling: the research record (Estrada&apos;s bucket studies; Kitces) finds bucket{' '}
            <em>management</em> adds no systematic benefit over a rebalanced total-return portfolio — refilling rules
            are market-timing in disguise. RetireGolden therefore simulates your plan total-return and offers buckets
            only as this view. Years where income covers spending show an empty bucket 1; near the end of the plan
            the leading buckets drain because fewer spending years remain.
          </p>
        </>
      ) : null}
    </div>
  )
}
