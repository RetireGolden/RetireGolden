/**
 * Explore → Social Security: two views of the claiming decision.
 *  - "In your plan": sweep every claim-age combination through the full
 *    projection, ranked by ending after-tax estate; apply the winner.
 *  - "Benefits only": mortality-weighted expected present value of the
 *    benefits alone (the actuarial / insurance lens).
 */

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { runMonteCarlo } from '../mc/pool'
import { sizeBridge, type BridgeSizing } from '@retiregolden/engine/ladder/bridge'
import { EMBEDDED_REAL_YIELD_CURVE } from '@retiregolden/engine/params'
import type { TipsLadder } from '@retiregolden/engine/model/plan'
import { computeBreakEven } from '../socialSecurity/breakEven'
import { rankSwitchStrategies } from '../socialSecurity/survivorSwitching'
import { survivorBenefitMonthly } from '@retiregolden/engine/socialSecurity/survivorBenefit'
import { ficaOasdiPaidIn } from '../socialSecurity/ficaReturn'
import { expectedPvSingle } from '../socialSecurity/expectedPv'
import { claimFactor } from '@retiregolden/engine/socialSecurity/claimFactor'
import { objectivePolicies, type ObjectivePolicyId } from '@retiregolden/engine/decisions'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from '@retiregolden/engine/socialSecurity/nra'
import { packForYear } from '@retiregolden/engine/params'
import { usePlan } from './planContextCore'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { CheckboxField, HelpTip, SelectField } from './fields'
import { LEARN } from './learnLinks'
import { LearnLink } from '../learn/LearnLink'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoney, fmtMoneyCompact } from './format'
import { currentStartYear, projectPlan, seedFromPlanId } from './useProjection'
import {
  benefitsOnlyRanking,
  candidateClaimAges,
  claimingPeople,
  dobParts,
  planWithClaimAges,
  refineClaimingMonthly,
  sweepClaimingStrategies,
  type MonthlyClaim,
  type MonthlyRefinement,
  type SweepRow,
} from './ssAnalysis'
import { chartTooltipStyle } from './chartStyle'

type Tab = 'plan' | 'benefits' | 'breakeven'

const BREAKEVEN_COLORS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)']

const OBJECTIVE_CHOICES: ReadonlyArray<{ value: ObjectivePolicyId; label: string }> = [
  'max-after-tax-estate',
  'max-spending-durability',
  'min-lifetime-tax-estate-floor',
  'protect-survivor-liquidity',
  'bridge-durability',
].map((id) => ({ value: id as ObjectivePolicyId, label: objectivePolicies[id as ObjectivePolicyId].label }))

function ageLabel(claim: Record<string, number>, ids: string[]): string {
  return ids.map((id) => claim[id]).join(' / ')
}

/** Background tint for a heatmap cell scaled 0 (worst) … 1 (best). */
function heatColor(t: number): string {
  return `color-mix(in srgb, var(--good) ${Math.round(t * 70)}%, var(--surface-1))`
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>No Social Security to analyze yet</h2>
      <p>Add a benefit for at least one person on the Social Security entry form, then come back here.</p>
    </div>
  )
}

export function SsAnalysisPage() {
  const { plan, update } = usePlan()
  const [tab, setTab] = useState<Tab>('plan')
  const people = useMemo(() => claimingPeople(plan), [plan])

  if (people.length === 0) {
    return (
      <section>
        <div className="card">
          <h2>Social Security Optimizer</h2>
          <EmptyState />
        </div>
      </section>
    )
  }

  const personName = (id: string) => plan.household.people.find((p) => p.id === id)?.name ?? id
  const applyStrategy = (claim: Record<string, number>) =>
    update((d) => {
      for (const s of d.incomes) {
        if (s.type === 'socialSecurity' && claim[s.personId] !== undefined) {
          s.claimAge = { years: claim[s.personId]!, months: 0 }
        }
      }
    })

  return (
    <section>
      <div className="card">
        <h2>Social Security Optimizer</h2>
        <div className="seg" role="tablist" style={{ marginBottom: '1rem' }}>
          <button type="button" role="tab" aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>
            In your plan
          </button>
          <button type="button" role="tab" aria-pressed={tab === 'benefits'} onClick={() => setTab('benefits')}>
            Benefits only
          </button>
          <button type="button" role="tab" aria-pressed={tab === 'breakeven'} onClick={() => setTab('breakeven')}>
            Break-even
          </button>
        </div>
        {tab === 'plan' ? (
          <InYourPlanTab personIds={people.map((p) => p.person.id)} personName={personName} applyStrategy={applyStrategy} />
        ) : tab === 'benefits' ? (
          <BenefitsOnlyTab personIds={people.map((p) => p.person.id)} personName={personName} applyStrategy={applyStrategy} />
        ) : (
          <BreakEvenTab personIds={people.map((p) => p.person.id)} personName={personName} />
        )}
      </div>

      <BridgePanel />

      <LearnAboutScreen route="/plan/:planId/social-security-analysis" />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Social Security bridge (social-security-bridge-and-tips-ladder, step 3)
// ---------------------------------------------------------------------------

interface BridgeComparisonRow {
  name: string
  endingAfterTaxEstate: number
  depletionYear: number | null
  successRate: number | null
}

/**
 * Packages the delay-and-bridge strategy as a plan artifact: sizes the bridge
 * from each claimant's own numbers (forgone age-62 benefit × gap years),
 * quotes the TIPS ladder on the embedded curve, adds it to the plan in one
 * click, and prices "bridge + delayed claim" against "claim at 62" on the
 * same deterministic ledger and the same seeded Monte Carlo paths.
 */
function BridgePanel() {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const startYear = currentStartYear()
  const people = useMemo(() => claimingPeople(plan), [plan])

  const existingLadders = plan.incomeFloor?.ladders
  const sized = useMemo(() => {
    const out: Array<{ personId: string; name: string; bridge: BridgeSizing; ladder: TipsLadder }> = []
    for (const { person, stream, pia } of people) {
      const { y, m, d } = dobParts(person)
      const bridge = sizeBridge({
        piaMonthly: pia,
        dob: { year: y, month: m, day: d },
        claimAge: stream.claimAge,
        currentYear: startYear,
        retirementYear: person.retirementAge !== null ? y + person.retirementAge : startYear,
        curve: EMBEDDED_REAL_YIELD_CURVE,
      })
      if (!bridge) continue
      // A plan ladder already covering this whole window means the bridge is
      // bought — offering it again would double-count purchases and flows.
      // Same coverage rule as the ss-bridge-gap detector and the generator
      // (full coverage: one year short is a real unfunded gap year).
      const covered = existingLadders?.some((l) => l.startYear <= bridge.startYear && l.endYear >= bridge.endYear)
      if (covered) continue
      out.push({
        personId: person.id,
        name: person.name,
        bridge,
        ladder: {
          id: `bridge-${person.id}-${bridge.startYear}`,
          name: `SS bridge (${person.name})`,
          purpose: 'bridge',
          startYear: bridge.startYear,
          endYear: bridge.endYear,
          annualRealAmount: bridge.annualRealAmount,
        },
      })
    }
    return out
  }, [people, startYear, existingLadders])

  const fundingOptions = plan.accounts
    .filter((a) => a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp')
    .map((a) => ({ value: a.id, label: a.name }))
  const [fundingId, setFundingId] = useState<string>('')
  const funding = fundingOptions.find((o) => o.value === fundingId) ?? fundingOptions[0]
  const [rows, setRows] = useState<BridgeComparisonRow[] | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const alreadyBridged = (plan.incomeFloor?.ladders ?? []).some((l) => l.purpose === 'bridge')
  if (sized.length === 0) {
    return alreadyBridged ? (
      <div className="card">
        <h2>Social Security bridge</h2>
        <p className="card-hint">
          Your plan already holds a bridge ladder covering the gap years — see it on the Income floor page.{' '}
          <LearnLink {...LEARN.socialSecurityBridge} />
        </p>
      </div>
    ) : null
  }

  // Never append a ladder id the plan already holds: the coverage filter above
  // normally empties `sized` once a bridge is bought, but a user-edited window
  // can re-open the offer while the deterministic id still exists — appending
  // it again would collide ids and double-count flows.
  const laddersWithFunding = (existing: TipsLadder[] | undefined): TipsLadder[] =>
    sized
      .filter(({ ladder }) => !existing?.some((l) => l.id === ladder.id))
      .map(({ ladder }) => ({
        ...ladder,
        purchase: funding ? { year: startYear, fundingAccountId: funding.value } : undefined,
      }))

  const planWithBridge = () => {
    const next = structuredClone(plan)
    const ladders = laddersWithFunding(next.incomeFloor?.ladders)
    if (next.incomeFloor) next.incomeFloor.ladders.push(...ladders)
    else next.incomeFloor = { ladders }
    return next
  }

  const addToPlan = () =>
    update((d) => {
      const ladders = laddersWithFunding(d.incomeFloor?.ladders)
      if (d.incomeFloor) d.incomeFloor.ladders.push(...ladders)
      else d.incomeFloor = { ladders }
    })

  const runComparison = async () => {
    setComparing(true)
    setCompareError(null)
    try {
      const claimEarly = planWithClaimAges(
        plan,
        Object.fromEntries(sized.map((s) => [s.personId, 62])),
      )
      const bridged = planWithBridge()
      const variants: Array<{ name: string; plan: typeof plan }> = [
        { name: 'Claim at 62, no bridge', plan: claimEarly },
        { name: 'Current claim ages, no bridge', plan },
        { name: 'Current claim ages + TIPS bridge', plan: bridged },
      ]
      const out: BridgeComparisonRow[] = []
      for (const v of variants) {
        const projection = projectPlan(v.plan, startYear)
        // Same seed ⇒ identical market paths across variants (same-path delta).
        const mc = await runMonteCarlo(v.plan, {
          startYear,
          pathCount: 500,
          seed: seedFromPlanId(plan.id),
          model: { type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct },
        })
        out.push({
          name: v.name,
          endingAfterTaxEstate: projection.summary.endingAfterTaxEstate,
          depletionYear: projection.summary.depletionYear,
          successRate: mc.successRate,
        })
      }
      setRows(out)
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'The comparison failed.')
    } finally {
      setComparing(false)
    }
  }

  const totalCost = sized.reduce((sum, s) => sum + s.bridge.ladderCost, 0)
  return (
    <div className="card">
      <h2>Social Security bridge</h2>
      <p className="card-hint">
        Delaying is the cheapest inflation-protected annuity you can buy — the bridge pays you the forgone age-62
        benefit until your claim starts, so the delay never cuts lifestyle. Sized from your own plan; quoted on
        Treasury real yields as of {EMBEDDED_REAL_YIELD_CURVE.asOfIso}. <LearnLink {...LEARN.socialSecurityBridge} />
      </p>
      <div className="year-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Bridge pays</th>
              <th>Years</th>
              <th>TIPS ladder cost (today's $)</th>
            </tr>
          </thead>
          <tbody>
            {sized.map((s) => (
              <tr key={s.personId}>
                <td>{s.name}</td>
                <td>
                  {fmtMoney(s.bridge.annualRealAmount)}/yr ({fmtMoney(s.bridge.monthlyAge62Benefit)}/mo, real)
                </td>
                <td>
                  {s.bridge.startYear}–{s.bridge.endYear}
                </td>
                <td>{fmtMoney(s.bridge.ladderCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-grid">
        <SelectField
          label="Fund the bridge from"
          help="The ladder cost is withdrawn from this account in the purchase year — a transfer into the ladder, not spending."
          value={funding?.value ?? ''}
          options={fundingOptions.length > 0 ? fundingOptions : [{ value: '', label: 'No cash/taxable account' }]}
          onCommit={setFundingId}
        />
      </div>
      <div className="add-row">
        <button type="button" className="btn btn-primary btn-small" onClick={addToPlan} disabled={!funding || readOnly}>
          Add bridge ladder{sized.length > 1 ? 's' : ''} to plan ({fmtMoneyCompact(totalCost)})
        </button>{' '}
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => void runComparison()}
          disabled={comparing || !funding}
        >
          {comparing ? 'Comparing…' : 'Compare vs claiming at 62'}
        </button>
      </div>
      {!funding ? (
        <p className="card-hint">
          Add a cash or taxable account to fund the bridge — without one there is nothing to buy the ladder with, so
          the add and compare actions stay off.
        </p>
      ) : null}
      {compareError ? (
        <p className="card-hint" role="alert">
          {compareError}
        </p>
      ) : null}
      {rows ? (
        <div className="year-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Market success</th>
                <th>Money lasts</th>
                <th>Ending after-tax estate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.successRate !== null ? `${Math.round(row.successRate * 100)}%` : '—'}</td>
                  <td>{row.depletionYear === null ? 'full plan' : `until ${row.depletionYear}`}</td>
                  <td>{fmtMoneyCompact(row.endingAfterTaxEstate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="card-hint">
            All three run on the same steady-markets ledger and the same 500 seeded market paths, so every difference
            is the strategy — not luck of the draw.
          </p>
        </div>
      ) : null}
    </div>
  )
}

interface TabProps {
  personIds: string[]
  personName: (id: string) => string
  applyStrategy: (claim: Record<string, number>) => void
}

function currentClaim(plan: ReturnType<typeof usePlan>['plan'], ids: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of plan.incomes) {
    if (s.type === 'socialSecurity' && ids.includes(s.personId)) out[s.personId] = s.claimAge.years
  }
  return out
}

function fmtClaim(c: MonthlyClaim): string {
  return c.months > 0 ? `${c.years}y ${c.months}m` : `${c.years}`
}

function fmtObjectiveDelta(label: string, value: number): string {
  const sign = value >= 0 ? '+' : ''
  if (label.toLowerCase().includes('years')) return `${sign}${value} yr`
  return `${sign}${fmtMoneyCompact(value)}`
}

function InYourPlanTab({ personIds, personName, applyStrategy }: TabProps) {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const startYear = currentStartYear()
  const [objectiveId, setObjectiveId] = useState<ObjectivePolicyId>('max-after-tax-estate')
  const sweep = useMemo(() => sweepClaimingStrategies(plan, startYear, objectiveId), [plan, startYear, objectiveId])
  const [mc, setMc] = useState<Record<string, number> | null>(null)
  const [mcRunning, setMcRunning] = useState(false)
  const [mcError, setMcError] = useState<string | null>(null)
  const [refined, setRefined] = useState<MonthlyRefinement | null>(null)

  const best = sweep.ranked[0]
  const current = currentClaim(plan, personIds)
  const currentRow = sweep.rows.find((r) => personIds.every((id) => r.claimByPersonId[id] === current[id]))
  const keyOf = (r: SweepRow) => personIds.map((id) => r.claimByPersonId[id]).join('-')

  const applyMonthly = (claim: Record<string, MonthlyClaim>) =>
    update((d) => {
      for (const s of d.incomes) {
        if (s.type === 'socialSecurity' && claim[s.personId] !== undefined) s.claimAge = { ...claim[s.personId]! }
      }
    })

  const runRobustness = async () => {
    setMcRunning(true)
    setMcError(null)
    try {
      const top = sweep.ranked.slice(0, 5)
      const out: Record<string, number> = {}
      for (const row of top) {
        const candidate = planWithClaimAges(plan, row.claimByPersonId)
        const summary = await runMonteCarlo(candidate, {
          startYear,
          pathCount: 500,
          seed: seedFromPlanId(plan.id),
          model: { type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct },
        })
        out[keyOf(row)] = summary.successRate
      }
      setMc(out)
    } catch (e: unknown) {
      setMcError(e instanceof Error ? e.message : String(e))
    } finally {
      setMcRunning(false)
    }
  }

  return (
    <div>
      <p className="card-hint">
        Each claim-age combination is run through your full plan — taxes, Roth conversions, IRMAA, ACA, and RMDs
        included — and ranked by the objective you choose{' '}
        <HelpTip text="Ending net worth minus the income tax heirs owe on inherited pre-tax (traditional) balances, at the heir tax rate in Assumptions. This is the deterministic, single-planning-age view; the Benefits-only tab adds the mortality-weighted insurance angle." />.
        Results assume your expected returns; use the robustness check to see how the ranking holds up across markets.
      </p>
      <div className="form-grid" style={{ marginBottom: '0.75rem', maxWidth: '26rem' }}>
        <SelectField
          label="Rank claim ages by"
          help="Every whole-year Social Security claim-age candidate is evaluated on your full year-by-year projection, then those same evaluations are re-ranked by this objective."
          hint={objectivePolicies[objectiveId].description}
          value={objectiveId}
          options={OBJECTIVE_CHOICES}
          onCommit={setObjectiveId}
        />
      </div>

      {best ? (
        <div className="callout callout--info">
          <strong>Best by {objectivePolicies[objectiveId].label.toLowerCase()}: claim at {ageLabel(best.claimByPersonId, personIds)}</strong>
          {personIds.length === 2 ? ` (${personIds.map(personName).join(' / ')})` : ''} — after-tax estate{' '}
          {fmtMoneyCompact(best.summary.endingAfterTaxEstate)}
          {currentRow && keyOf(currentRow) !== keyOf(best) ? (
            <>
              {' '}
              vs {fmtMoneyCompact(currentRow.summary.endingAfterTaxEstate)} at your current{' '}
              {ageLabel(current, personIds)} (
              <span className="delta-pos">
                +{fmtMoneyCompact(best.summary.endingAfterTaxEstate - currentRow.summary.endingAfterTaxEstate)}
              </span>
              ).
            </>
          ) : ' — your current choice.'}
          {objectiveId !== 'max-after-tax-estate' ? (
            <>
              {' '}
              Ranked on {sweep.primaryMetricLabel.toLowerCase()} ({fmtObjectiveDelta(sweep.primaryMetricLabel, best.primaryValue)} vs current);
              estate is shown for context.
            </>
          ) : null}
          {best && keyOf(best) !== keyOf(currentRow ?? best) ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={() => applyStrategy(best.claimByPersonId)}>
                Apply {ageLabel(best.claimByPersonId, personIds)}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {personIds.length === 2 ? <CoupleStrategyPanel personName={personName} best={best} /> : null}

      {personIds.length === 1 ? (
        <SingleSweepTable personIds={personIds} sweep={sweep} current={current} applyStrategy={applyStrategy} />
      ) : (
        <CoupleHeatmap personIds={personIds} personName={personName} sweep={sweep} current={current} applyStrategy={applyStrategy} />
      )}

      <div className="add-row" style={{ marginTop: '1rem' }}>
        {best ? (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setRefined(refineClaimingMonthly(plan, best.claimByPersonId, startYear))}>
            Refine to the month
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary btn-small" disabled={mcRunning} onClick={() => void runRobustness()}>
          {mcRunning ? 'Running…' : 'Check robustness (Monte Carlo, top 5)'}
        </button>
      </div>
      {mcError ? (
        <div className="error-recovery" role="alert">
          <p className="error-text">Robustness check error: {mcError}</p>
          <button type="button" className="btn btn-secondary btn-small" disabled={mcRunning} onClick={() => void runRobustness()}>
            Run again
          </button>
        </div>
      ) : null}

      {refined && best ? (
        <div className="callout callout--info" style={{ marginTop: '0.75rem' }}>
          <strong>To the month: claim at {personIds.map((id) => fmtClaim(refined.claimByPersonId[id]!)).join(' / ')}</strong>
          {personIds.length === 2 ? ` (${personIds.map(personName).join(' / ')})` : ''} — after-tax estate{' '}
          {fmtMoneyCompact(refined.summary.endingAfterTaxEstate)}
          {refined.summary.endingAfterTaxEstate > best.summary.endingAfterTaxEstate ? (
            <>
              {' '}
              (<span className="delta-pos">+{fmtMoneyCompact(refined.summary.endingAfterTaxEstate - best.summary.endingAfterTaxEstate)}</span>{' '}
              over the whole-year pick).
            </>
          ) : ' — the whole-year pick is already optimal to the month.'}
          {personIds.some((id) => refined.claimByPersonId[id]!.months > 0) ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={() => applyMonthly(refined.claimByPersonId)}>
                Apply {personIds.map((id) => fmtClaim(refined.claimByPersonId[id]!)).join(' / ')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {mc ? (
        <table className="claim-table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Strategy (claim ages)</th>
              <th>After-tax estate</th>
              <th>Success %</th>
            </tr>
          </thead>
          <tbody>
            {sweep.ranked.slice(0, 5).map((r) => (
              <tr key={keyOf(r)}>
                <td>{ageLabel(r.claimByPersonId, personIds)}</td>
                <td>{fmtMoneyCompact(r.summary.endingAfterTaxEstate)}</td>
                <td>{mc[keyOf(r)] !== undefined ? `${Math.round(mc[keyOf(r)]! * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

/**
 * Couple primer beside the heatmap: which spouse has the higher benefit, why
 * survivor protection usually argues for delaying that one, and whether the
 * recommended strategy follows the common "lower earlier / higher later" pattern.
 */
function CoupleStrategyPanel({ personName, best }: { personName: (id: string) => string; best?: SweepRow }) {
  const { plan } = usePlan()
  const people = claimingPeople(plan)
  if (people.length !== 2) return null
  const [higher, lower] = [...people].sort((a, b) => b.pia - a.pia)
  if (!higher || !lower) return null
  const samePia = higher.pia === lower.pia
  const higherName = personName(higher.person.id)
  const lowerName = personName(lower.person.id)

  let patternNote = null
  if (best && !samePia) {
    const higherClaim = best.claimByPersonId[higher.person.id]
    const lowerClaim = best.claimByPersonId[lower.person.id]
    if (higherClaim !== undefined && lowerClaim !== undefined) {
      patternNote =
        higherClaim >= lowerClaim ? (
          <>
            {' '}
            The best strategy above follows the common pattern: <strong>{lowerName}</strong> claims at {lowerClaim} and{' '}
            <strong>{higherName}</strong> delays to {higherClaim}, locking in the larger survivor check.
          </>
        ) : (
          <>
            {' '}
            Here the best strategy has <strong>{higherName}</strong> ({higherClaim}) claim before{' '}
            <strong>{lowerName}</strong> ({lowerClaim}) — taxes, longevity, or portfolio assumptions outweigh the usual
            survivor-protection delay.
          </>
        )
    }
  }

  return (
    <div className="callout callout--info">
      {samePia ? (
        <>
          Both benefits are about {fmtMoneyCompact(higher.pia * 12)}/yr. When the first spouse dies the survivor keeps the
          larger of the two checks, so delaying either claim raises the survivor floor.
        </>
      ) : (
        <>
          <strong>{higherName}</strong> has the higher benefit ({fmtMoneyCompact(higher.pia * 12)}/yr vs{' '}
          {fmtMoneyCompact(lower.pia * 12)}/yr for {lowerName}). After the first death the survivor keeps only the larger
          check, so delaying <strong>{higherName}</strong>’s claim protects whoever lives longest.
        </>
      )}
      {patternNote}
    </div>
  )
}

function SingleSweepTable({
  personIds,
  sweep,
  current,
  applyStrategy,
}: {
  personIds: string[]
  sweep: ReturnType<typeof sweepClaimingStrategies>
  current: Record<string, number>
  applyStrategy: (claim: Record<string, number>) => void
}) {
  const readOnly = useWorkspaceReadOnly()
  const id = personIds[0]!
  const byAge = [...sweep.rows].sort((a, b) => a.claimByPersonId[id]! - b.claimByPersonId[id]!)
  const bestKey = sweep.ranked[0]!.claimByPersonId[id]
  return (
    <div className="year-table-wrap" style={{ border: 'none' }}>
      <table className="claim-table">
        <thead>
          <tr>
            <th>Claim at</th>
            <th>After-tax estate</th>
            <th>Lifetime tax</th>
            <th>Depletes</th>
            <th aria-label="apply" />
          </tr>
        </thead>
        <tbody>
          {byAge.map((r) => {
            const age = r.claimByPersonId[id]!
            return (
              <tr key={age} className={(age === bestKey ? 'claim-row--best ' : '') + (age === current[id] ? 'claim-row--current' : '')}>
                <td>{age}</td>
                <td>{fmtMoneyCompact(r.summary.endingAfterTaxEstate)}</td>
                <td>{fmtMoneyCompact(r.summary.lifetimeTaxesAndPenalties)}</td>
                <td>{r.summary.depletionYear ?? 'never'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    disabled={age === current[id] || readOnly}
                    onClick={() => applyStrategy(r.claimByPersonId)}
                  >
                    Use
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CoupleHeatmap({
  personIds,
  personName,
  sweep,
  current,
  applyStrategy,
}: {
  personIds: string[]
  personName: (id: string) => string
  sweep: ReturnType<typeof sweepClaimingStrategies>
  current: Record<string, number>
  applyStrategy: (claim: Record<string, number>) => void
}) {
  const { plan } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const [rowId, colId] = personIds
  const rowAges = candidateClaimAges(plan.household.people.find((p) => p.id === rowId)!, currentStartYear())
  const colAges = candidateClaimAges(plan.household.people.find((p) => p.id === colId)!, currentStartYear())
  const estate = (ra: number, ca: number) =>
    sweep.rows.find((r) => r.claimByPersonId[rowId!] === ra && r.claimByPersonId[colId!] === ca)?.summary.endingAfterTaxEstate ?? 0
  const values = sweep.rows.map((r) => r.summary.endingAfterTaxEstate)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const norm = (v: number) => (max > min ? (v - min) / (max - min) : 1)
  const bestKey = `${sweep.ranked[0]!.claimByPersonId[rowId!]}-${sweep.ranked[0]!.claimByPersonId[colId!]}`

  return (
    <>
      <p className="card-hint" style={{ marginTop: '0.5rem' }}>
        After-tax estate by claim age — rows: {personName(rowId!)}, columns: {personName(colId!)}. Greener is better;
        click a cell to apply it.
      </p>
      <div className="year-table-wrap" style={{ border: 'none' }}>
        <table className="claim-table heatmap">
          <thead>
            <tr>
              <th>{personName(rowId!)} ↓ / {personName(colId!)} →</th>
              {colAges.map((ca) => (
                <th key={ca}>{ca}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowAges.map((ra) => (
              <tr key={ra}>
                <th>{ra}</th>
                {colAges.map((ca) => {
                  const v = estate(ra, ca)
                  const isBest = `${ra}-${ca}` === bestKey
                  const isCurrent = current[rowId!] === ra && current[colId!] === ca
                  return (
                    <td
                      key={ca}
                      style={{ background: heatColor(norm(v)), cursor: readOnly ? 'default' : 'pointer', outline: isCurrent ? '2px solid var(--accent)' : undefined, fontWeight: isBest ? 700 : undefined }}
                      title={`${personName(rowId!)} ${ra} / ${personName(colId!)} ${ca}: ${fmtMoneyCompact(v)}${isBest ? ' (best)' : ''}`}
                      onClick={readOnly ? undefined : () => applyStrategy({ [rowId!]: ra, [colId!]: ca })}
                    >
                      {fmtMoneyCompact(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * Break-even education (V7 phase 2). The simple cumulative-benefit lens for one
 * person's own retirement benefit, with COLA and an optional investment return.
 * Deliberately lean copy — the conceptual narrative is the V9 Learning Center's
 * job; the In-your-plan sweep is the complete answer.
 */
function BreakEvenTab({ personIds, personName }: { personIds: string[]; personName: (id: string) => string }) {
  const { plan } = usePlan()
  const people = claimingPeople(plan)
  const [selectedId, setSelectedId] = useState(personIds[0]!)
  const [growthPct, setGrowthPct] = useState(0)

  const entry = people.find((p) => p.person.id === selectedId) ?? people[0]!
  const { person, pia } = entry
  const { y, m, d } = dobParts(person)
  const fra = fraForBirthYear(effectiveBirthYear(y, m, d))
  const currentAge = currentStartYear() - y
  const throughAge = person.longevity.planningAge
  const cola = plan.assumptions.ssCola.mode === 'fixed' ? plan.assumptions.ssCola.annualPct : plan.assumptions.inflationPct

  const claimAges = Array.from(new Set([62, fra.years, 70]))
    .sort((a, b) => a - b)
    .filter((a) => a >= currentAge)
  const result =
    claimAges.length >= 2
      ? computeBreakEven({ dob: { year: y, month: m, day: d }, piaMonthly: pia, claimAges, colaPct: cola, growthPct, throughAge })
      : null

  const personSelect =
    people.length === 2 ? (
      <div className="seg" role="group" aria-label="Person" style={{ marginBottom: '0.75rem' }}>
        {people.map((p) => (
          <button key={p.person.id} type="button" aria-pressed={selectedId === p.person.id} onClick={() => setSelectedId(p.person.id)}>
            {personName(p.person.id)}
          </button>
        ))}
      </div>
    ) : null

  if (!result) {
    return (
      <div>
        {personSelect}
        <p className="card-hint">
          {personName(selectedId)} is already past most claim ages, so there's nothing left to compare here.
        </p>
      </div>
    )
  }

  const rows = result.series.map((pt) => {
    const row: Record<string, number> = { age: pt.age }
    for (const a of claimAges) row[`a${a}`] = pt.cumulative[a]!
    return row
  })

  return (
    <div>
      <p className="card-hint">
        Claim early and collect sooner, or wait for a bigger check? This compares the cumulative lifetime benefit from{' '}
        {personName(selectedId)}'s own retirement benefit at each claim age — COLA {cola}%, checks invested at the chosen
        return{' '}
        <HelpTip text="Pedagogical view. It ignores spousal/survivor benefits, taxes, and the rest of your portfolio; the In-your-plan sweep is the complete answer. A higher assumed return rewards claiming early, pushing break-even later." />.
        It's the simple lens — the In-your-plan tab is the complete one.
      </p>

      {personSelect}

      <div className="seg" role="group" aria-label="Investment return on benefits" style={{ marginBottom: '1rem' }}>
        {[0, 3, 5, 7].map((g) => (
          <button key={g} type="button" aria-pressed={growthPct === g} onClick={() => setGrowthPct(g)}>
            {g}% return
          </button>
        ))}
      </div>

      <div className="callout callout--info">
        {result.crossings.map((c) => (
          <div key={`${c.early}v${c.late}`}>
            <strong>
              {c.early} vs {c.late}:
            </strong>{' '}
            {c.age === null ? (
              <>claiming at {c.late} never catches up by age {throughAge}{growthPct > 0 ? ` at a ${growthPct}% return` : ''}.</>
            ) : (
              <>
                waiting until {c.late} pulls ahead around age <strong>{c.age}</strong>.
              </>
            )}
          </div>
        ))}
      </div>

      <div className="chart-card">
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 12, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="age" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} labelFormatter={(l) => `Age ${l}`} contentStyle={chartTooltipStyle} />
              <Legend />
              {claimAges.map((a, i) => (
                <Line key={a} dataKey={`a${a}`} name={`Claim ${a}`} stroke={BREAKEVEN_COLORS[i % BREAKEVEN_COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="muted small">
          Cumulative benefits received through each age{growthPct > 0 ? `, with each check invested at ${growthPct}%` : ''}.
        </p>
      </div>
    </div>
  )
}

function BenefitsOnlyTab({ personIds, personName, applyStrategy }: TabProps) {
  const { plan } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const [discountPct, setDiscountPct] = useState(2)
  const ranking = useMemo(
    () => benefitsOnlyRanking(plan, discountPct / 100, currentStartYear()),
    [plan, discountPct],
  )
  const best = ranking.ranked[0]
  const current = currentClaim(plan, personIds)
  const keyOf = (claim: Record<string, number>) => personIds.map((id) => claim[id]).join('-')

  return (
    <div>
      <p className="card-hint">
        The actuarial view: expected lifetime benefits weighted by the chance of being alive to receive them (SSA
        mortality), ignoring your portfolio and taxes{' '}
        <HelpTip text="The standard actuarial method: each future year's benefit is multiplied by the probability of survival and discounted to today. This isolates Social Security's longevity-insurance value — useful alongside the In-your-plan tab, which adds taxes and portfolio growth." />. When this disagrees with the In-your-plan tab, the gap is how much taxes and growth are pulling your answer.
      </p>
      <div className="form-grid" style={{ maxWidth: '22rem' }}>
        <div className="field">
          <span className="field-label-row">
            <span className="field-label">Real discount rate: {discountPct}%</span>
            <HelpTip text="The real (after-inflation) rate used to value future benefits — conventionally near the long-term TIPS yield (~2%). Higher rates favor claiming earlier; a very high personal rate (impatience or poor health) can make 62 optimal." />
          </span>
          <input type="range" min={0} max={8} step={0.5} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} />
        </div>
      </div>

      {best ? (
        <div className="callout callout--info">
          <strong>Highest expected value: claim at {ageLabel(best.claimByPersonId, personIds)}</strong>
          {personIds.length === 2 ? ` (${personIds.map(personName).join(' / ')})` : ''} — expected PV{' '}
          {fmtMoneyCompact(best.expectedPv)}.
          {keyOf(best.claimByPersonId) !== keyOf(current) ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={() => applyStrategy(best.claimByPersonId)}>
                Apply {ageLabel(best.claimByPersonId, personIds)}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="year-table-wrap" style={{ border: 'none' }}>
        <table className="claim-table">
          <thead>
            <tr>
              <th>Claim age{personIds.length === 2 ? 's' : ''}</th>
              <th>Expected PV</th>
              <th aria-label="apply" />
            </tr>
          </thead>
          <tbody>
            {ranking.ranked.slice(0, 10).map((r) => {
              const isCurrent = keyOf(r.claimByPersonId) === keyOf(current)
              return (
                <tr key={keyOf(r.claimByPersonId)} className={isCurrent ? 'claim-row--current' : undefined}>
                  <td>{ageLabel(r.claimByPersonId, personIds)}</td>
                  <td>{fmtMoneyCompact(r.expectedPv)}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-small" disabled={isCurrent || readOnly} onClick={() => applyStrategy(r.claimByPersonId)}>
                      Use
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {ranking.ranked.length > 10 ? <p className="muted small">Showing the top 10 of {ranking.ranked.length} combinations.</p> : null}

      <SurvivorSwitchingPanel discountPct={discountPct} />
      <FicaReturnPanel discountPct={discountPct} />
    </div>
  )
}

/**
 * "What you paid in vs. what you get back" — an education/context readout (no
 * engine-tax change). Paid-in = OASDI payroll tax over the entered earnings
 * history (employee 6.2% / self-employed 12.4%, capped at the wage base); get-back
 * = the survival-weighted expected PV of lifetime benefits at the chosen claim age
 * (reusing the tested `expectedPvSingle` path). Only renders when an earnings
 * history is present; Quick-PIA plans get a note.
 */
function FicaReturnPanel({ discountPct }: { discountPct: number }) {
  const { plan } = usePlan()
  const [selfEmployed, setSelfEmployed] = useState(false)
  const people = claimingPeople(plan)
  const startYear = currentStartYear()
  const { pack } = packForYear(startYear)
  const discountRate = discountPct / 100

  const withEarnings = people.filter((p) => p.stream.earnings && p.stream.earnings.length > 0)

  return (
    <details className="ss-explainer" style={{ marginTop: '1.5rem' }}>
      <summary>What you paid in vs. what you get back</summary>
      <p className="card-hint">
        An illustrative "return on your Social Security taxes": the OASDI payroll tax you paid over your earnings
        history, beside the survival-weighted expected value of your lifetime benefits at your current claim age. This
        is an individual-level illustration, not the program's actuarial return, and it excludes the insurance value of
        disability/survivor benefits, spousal benefits, and Medicare.{' '}
        <LearnLink {...LEARN.ssTaxesVsBenefits} variant="inline" />
      </p>
      <div className="form-grid" style={{ maxWidth: '24rem' }}>
        <CheckboxField
          label="Self-employed (12.4% OASDI)"
          help="Toggles the OASDI rate from the employee share (6.2%) to the self-employed total (12.4%). A simplification applied uniformly to your earnings history."
          value={selfEmployed}
          onCommit={setSelfEmployed}
        />
      </div>
      {withEarnings.length === 0 ? (
        <p className="muted small">Enter an earnings history on the Social Security step to see what you paid in.</p>
      ) : (
        withEarnings.map(({ person, stream, pia }) => {
          const { y, m, d } = dobParts(person)
          const paidIn = ficaOasdiPaidIn(stream.earnings ?? [], {
            oasdiEmployeeRatePct: pack.socialSecurity.oasdiEmployeeRatePct,
            selfEmployed,
          })
          const getBack = expectedPvSingle(
            {
              currentAge: Math.max(0, startYear - y),
              dob: { year: y, month: m, day: d },
              sex: person.sex,
              piaMonthly: pia,
              claimAge: stream.claimAge,
            },
            { discountRate },
          )
          const ratio = paidIn.paidIn > 0 ? getBack / paidIn.paidIn : 0
          return (
            <div key={person.id} className="callout callout--info" style={{ marginTop: '0.6rem' }}>
              <strong>{person.name}</strong>
              <div className="year-table-wrap" style={{ border: 'none' }}>
                <table className="claim-table">
                  <tbody>
                    <tr><td>Paid in (OASDI)</td><td>{fmtMoney(paidIn.paidIn)}</td></tr>
                    {paidIn.employerPaid > 0 ? (
                      <tr><td className="muted small">Employer paid (context)</td><td className="muted small">{fmtMoney(paidIn.employerPaid)}</td></tr>
                    ) : null}
                    <tr><td>Expected lifetime benefits (PV)</td><td>{fmtMoneyCompact(getBack)}</td></tr>
                    <tr><td>Ratio (get back ÷ paid in)</td><td>{ratio > 0 ? `${ratio.toFixed(2)}×` : '—'}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="muted small" style={{ marginTop: '0.3rem' }}>
                At a {discountPct}% real discount rate. Excludes Medicare tax, disability/survivor insurance value, and
                spousal benefits; the OASDI rate is applied uniformly over your career.
              </p>
            </div>
          )
        })
      )}
    </details>
  )
}

/**
 * Survivor ↔ personal switching for a widowed single user: rank strategies that
 * sequence the survivor benefit and the person's own benefit. Shown only when the
 * single person has a deceased former spouse whose survivor benefit is preserved.
 */
function SurvivorSwitchingPanel({ discountPct }: { discountPct: number }) {
  const { plan } = usePlan()
  const people = claimingPeople(plan)
  if (plan.household.people.length !== 1 || people.length !== 1) return null
  const { person, pia, stream } = people[0]!
  const eligible = (stream.formerSpouses ?? []).filter(
    (r) => r.relationship === 'deceased' && r.marriageYears >= 0.75 && (r.remarriedAtAge === null || r.remarriedAtAge >= 60),
  )
  if (eligible.length === 0) return null
  // Pick the deceased ex whose **payable** survivor benefit is highest (not raw
  // PIA): after RIB-LIM + the deceased's claim-age factor, a lower-PIA ex who
  // delayed can beat a higher-PIA ex who claimed early. Each ex's payable is
  // computed at the claimant's survivor FRA (the maximum survivor benefit each
  // record can provide), mirroring how the ledger's `bestMaritalBenefit` picks
  // the largest candidate.
  const { y, m, d } = dobParts(person)
  const claimantEffYear = effectiveBirthYear(y, m, d)
  const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(claimantEffYear))
  const survivorFraClaimAge = { years: Math.floor(survivorFraMonths / 12), months: survivorFraMonths % 12 }
  let bestEx = eligible[0]!
  let bestPayable = 0
  for (const r of eligible) {
    const exDobYear = Number(r.dob.slice(0, 4))
    const exDobMonth = Number(r.dob.slice(5, 7))
    const exDobDay = Number(r.dob.slice(8, 10))
    const exFra = fraForBirthYear(effectiveBirthYear(exDobYear, exDobMonth, exDobDay))
    const exClaimAge = r.deceasedClaimAge ?? { years: exFra.years, months: exFra.extraMonths }
    const actual = r.piaMonthly * claimFactor(exDobYear, exDobMonth, exDobDay, exClaimAge)
    const payable = survivorBenefitMonthly({
      deceasedPiaMonthly: r.piaMonthly,
      deceasedActualMonthly: actual,
      survivorClaimAge: survivorFraClaimAge,
      survivorFraMonths,
    })
    if (payable > bestPayable) {
      bestPayable = payable
      bestEx = r
    }
  }
  const exDobYear = Number(bestEx.dob.slice(0, 4))
  const exDobMonth = Number(bestEx.dob.slice(5, 7))
  const exDobDay = Number(bestEx.dob.slice(8, 10))
  const exFra = fraForBirthYear(effectiveBirthYear(exDobYear, exDobMonth, exDobDay))
  const exClaimAge = bestEx.deceasedClaimAge ?? { years: exFra.years, months: exFra.extraMonths }
  const survivorMonthly = bestEx.piaMonthly * claimFactor(exDobYear, exDobMonth, exDobDay, exClaimAge)
  if (survivorMonthly <= 0) return null

  const ranked = rankSwitchStrategies(
    {
      dob: { year: y, month: m, day: d },
      sex: person.sex,
      currentAge: currentStartYear() - y,
      ownPiaMonthly: pia,
      survivorMonthly,
      deceasedPiaMonthly: bestEx.piaMonthly,
    },
    { discountRate: discountPct / 100 },
  ).slice(0, 5)

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3>Survivor vs. personal timing</h3>
      <p className="card-hint">
        As a widow(er) you can hold both a survivor benefit and your own, and switch between them. Survivor benefits stop
        growing at your full retirement age while your own grows to 70, so the order matters. Ranked by expected value at{' '}
        {discountPct}%{' '}
        <HelpTip text="Illustrative: the survivor base is the deceased's actual (claim-age-adjusted) benefit, the RIB-LIM widow's-limit caps it at 82.5% of the deceased's PIA when they claimed early, and the early-claim widow(er) reduction (up to 28.5% at 60) applies before the survivor's FRA — the same computation the projection ledger uses. Only one benefit is paid at a time — the larger of those claimed." />.
      </p>
      <div className="year-table-wrap" style={{ border: 'none' }}>
        <table className="claim-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Expected PV</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.label} className={i === 0 ? 'claim-row--best' : undefined}>
                <td>{r.label}</td>
                <td>{fmtMoneyCompact(r.expectedPv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
