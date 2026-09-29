/**
 * Explore → Social Security: two views of the claiming decision.
 *  - "In your plan": the engine's whole-plan sweep
 *    (decisions/claimAgeSweep.ts#sweepClaimAges) runs every whole-year
 *    claim-age combination of the plan's open claims through the full
 *    projection and ranks the rows by the objective the reader chooses (the
 *    after-tax estate by default). It refuses, and the page says why, when
 *    every claim was already made, when every open claim is a disability
 *    benefit, and when a Marketplace year's premium tax credit cannot be
 *    priced; a claim already made or a disability benefit beside an open claim
 *    is held as it is. A best claim age is crowned, offered to apply and
 *    refined to the month only on verdict 'winner'; a flat ranking, a current
 *    claim that already leads and a refusal get a note instead. Changes are
 *    signed against the plan as entered, claim months included.
 *  - "Benefits only": mortality-weighted expected present value of the
 *    benefits alone (the actuarial / insurance lens), with claims already made
 *    held at their own age.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
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
import type { Person, Plan, TipsLadder } from '@retiregolden/engine/model/plan'
import { DEFAULT_MONTE_CARLO_SEED } from '@retiregolden/engine/montecarlo/rng'
import { breakEvenClaimAges, claimBreakEven } from '@retiregolden/engine/socialSecurity/analysis/breakEven'
import { earningsTestReach } from '@retiregolden/engine/socialSecurity/analysis/earningsTestReach'
import {
  benefitsOnlyClaimAges,
  benefitsOnlyRanking,
  disabilityReplacesClaimAge,
} from '@retiregolden/engine/socialSecurity/analysis/expectedValue'
import { socialSecurityStreamFor } from '@retiregolden/engine/socialSecurity/analysis/claimants'
import { oasdiPaidIn, oasdiReturnForPerson, type OasdiPaidIn } from '@retiregolden/engine/socialSecurity/analysis/oasdiReturn'
import { resolveStreamPiaMonthly } from '@retiregolden/engine/socialSecurity/piaFromEarnings'
import {
  rankSwitchStrategies,
  survivorSwitchingInputs,
  type SwitchStrategy,
} from '@retiregolden/engine/socialSecurity/analysis/survivorSwitching'
import { hasSurvivorYears, objectivePolicies, type ObjectivePolicyId } from '@retiregolden/engine/decisions'
import {
  refineClaimAgeMonthly,
  sweepClaimAges,
  type ClaimAgeRefinement,
  type ClaimAgeSweep,
  type ClaimAgeSweepRow,
  type ClaimAgeValue,
} from '@retiregolden/engine/decisions/claimAgeSweep'
import { earliestOpenClaimAge } from '@retiregolden/engine/socialSecurity/openClaims'
import { moneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import { moneyLastsValue } from './format'
import { usePlan } from './planContextCore'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { CheckboxField, HelpTip, SelectField } from './fields'
import { LEARN } from './learnLinks'
import { LearnLink } from '../learn/LearnLink'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoney, fmtMoneyCompact } from './format'
import { currentStartYear, projectPlan, taxCalculatorFor, useProjection } from './useProjection'
import { claimingPeople, dobParts, piaAsOfPlan, planWithClaimAges } from './ssAnalysis'
import { claimAgeUnpricedCreditReason } from './acaVetoCopy'
import { ALREADY_CLAIMED_LIMITS, alreadyClaimedText, fmtClaimAge } from './claimAgeCopy'
import { chartTooltipStyle } from './chartStyle'
import { ScrollRegion } from './ScrollRegion'
import { canRunAgain } from './engineRefusalCopy'

/** Off the keystroke path, the same interval the survivor-transition sweep uses. */
const SWEEP_DEBOUNCE_MS = 200

type Tab = 'plan' | 'benefits' | 'breakeven'

const BREAKEVEN_COLORS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)']

const OBJECTIVE_CHOICES: ReadonlyArray<{ value: ObjectivePolicyId; label: string }> = [
  'max-after-tax-estate',
  'max-spending-durability',
  'min-lifetime-tax-estate-floor',
  'protect-survivor-liquidity',
  'bridge-durability',
].map((id) => ({ value: id as ObjectivePolicyId, label: objectivePolicies[id as ObjectivePolicyId].label }))

function ageLabel(claim: Readonly<Record<string, number>>, ids: readonly string[]): string {
  return ids.map((id) => claim[id]).join(' / ')
}

/** Background tint for a heatmap cell scaled 0 (worst) … 1 (best). */
function heatColor(t: number): string {
  return `color-mix(in srgb, var(--good) ${Math.round(t * 70)}%, var(--surface-1))`
}

function EmptyState({ plan }: { plan: Plan }) {
  const planId = plan.id
  // An earnings history that gives no benefit estimate is said by name, with the resolver's reason.
  const unresolved = plan.household.people.flatMap((person) => {
    const stream = socialSecurityStreamFor(plan, person.id)
    return stream?.earnings && stream.earnings.length > 0 ? [noBenefitEstimateReason(person, stream, piaAsOfPlan(plan))] : []
  })
  return (
    <div className="empty-state">
      <h2>No Social Security to analyze yet</h2>
      {/* claimingPeople() needs a resolved PIA above zero; a freshly added
          benefit starts at $0, so say what actually clears this state. */}
      <p>
        Add a benefit for at least one person on the Social Security entry form and enter its monthly benefit (PIA)
        or earnings record, then come back here. A benefit of $0 has nothing to analyze.
      </p>
      {unresolved.map((reason) => (
        <p key={reason}>{reason}</p>
      ))}
      {/* The recovery path is a chrome control, not a hunt through the rail (#427). */}
      <p>
        <Link to={`/plan/${planId}/social-security`} className="btn btn-secondary btn-small">
          Add a Social Security benefit
        </Link>
      </p>
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
          <EmptyState plan={plan} />
        </div>
      </section>
    )
  }

  const personName = (id: string) => plan.household.people.find((p) => p.id === id)?.name ?? id
  const applyStrategy = (claim: Readonly<Record<string, number>>) =>
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
        <div className="seg mb-md" role="tablist">
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
          <InYourPlanTab personName={personName} applyStrategy={applyStrategy} />
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
  /** The engine's last fully funded year for the run (projection/moneyLasts.ts). */
  lastFundedYear: number
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
  const people = useMemo(() => claimingPeople(plan, startYear), [plan, startYear])

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
  // Held with the plan it was computed for, like the sweep: an edit retires it.
  const [rowsFor, setRowsFor] = useState<{ plan: typeof plan; rows: BridgeComparisonRow[] } | null>(null)
  const rows = rowsFor !== null && rowsFor.plan === plan ? rowsFor.rows : null
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const alreadyBridged = (plan.incomeFloor?.ladders ?? []).some((l) => l.purpose === 'bridge')
  if (sized.length === 0) {
    return alreadyBridged ? (
      <div className="card">
        <h2>Social Security bridge</h2>
        <p className="card-hint">
          Your plan already holds a bridge ladder covering the gap years, see it on the Income floor page.{' '}
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

  // The earliest claim each bridged person can still make: 62, or the age
  // reached this year when later (a claim at an age already passed would be
  // backdated; socialSecurity/openClaims.ts, the claim-age searches' own test).
  const earliestClaims = sized.map((s) => {
    const person = plan.household.people.find((p) => p.id === s.personId)!
    return { personId: s.personId, name: s.name, age: earliestOpenClaimAge(person, startYear) ?? 70 }
  })
  const earliestLabel = earliestClaims.every((c) => c.age === 62)
    ? 'Claim at 62, no bridge'
    : `Claim at the earliest age still open (${earliestClaims.map((c) => `${c.name} ${c.age}`).join(', ')}), no bridge`

  const runComparison = async () => {
    const forPlan = plan
    setComparing(true)
    setCompareError(null)
    try {
      const claimEarly = planWithClaimAges(
        plan,
        Object.fromEntries(earliestClaims.map((c) => [c.personId, c.age])),
      )
      const bridged = planWithBridge()
      const variants: Array<{ name: string; plan: typeof plan }> = [
        { name: earliestLabel, plan: claimEarly },
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
          seed: DEFAULT_MONTE_CARLO_SEED,
          model: { type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct },
        })
        out.push({
          name: v.name,
          endingAfterTaxEstate: projection.summary.endingAfterTaxEstate,
          depletionYear: projection.summary.depletionYear,
          lastFundedYear: moneyLasts(projection.result).lastFundedYear,
          successRate: mc.successRate,
        })
      }
      setRowsFor({ plan: forPlan, rows: out })
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
        Delaying is the cheapest inflation-protected annuity you can buy. The bridge pays you the forgone age-62
        benefit until your claim starts, so the delay never cuts lifestyle. Sized from your own plan; quoted on
        Treasury real yields as of {EMBEDDED_REAL_YIELD_CURVE.asOfIso}. <LearnLink {...LEARN.socialSecurityBridge} />
      </p>
      <ScrollRegion label="Social Security bridge">
        <table>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Bridge pays</th>
              <th scope="col">Years</th>
              <th scope="col">TIPS ladder cost (today's $)</th>
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
      </ScrollRegion>
      <div className="form-grid">
        <SelectField
          label="Fund the bridge from"
          help="The ladder cost is withdrawn from this account in the purchase year, a transfer into the ladder, not spending."
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
          {comparing ? 'Comparing…' : earliestClaims.every((c) => c.age === 62) ? 'Compare vs claiming at 62' : 'Compare vs claiming at the earliest open age'}
        </button>
      </div>
      {!funding ? (
        <p className="card-hint">
          Add a cash or taxable account to fund the bridge, without one there is nothing to buy the ladder with, so
          the add and compare actions stay off.
        </p>
      ) : null}
      {compareError ? (
        <p className="card-hint" role="alert">
          {compareError}
        </p>
      ) : null}
      {rows ? (
        <ScrollRegion label="Claiming strategies">
          <table>
            <thead>
              <tr>
                <th scope="col">Strategy</th>
                <th scope="col">Market success</th>
                <th scope="col">Money lasts</th>
                <th scope="col">Ending after-tax estate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.successRate !== null ? `${Math.round(row.successRate * 100)}%` : '—'}</td>
                  <td>{moneyLastsValue(row, startYear)}</td>
                  <td>{fmtMoneyCompact(row.endingAfterTaxEstate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="card-hint">
            All three run on the same steady-markets ledger and the same 500 seeded market paths, so every difference
            is the strategy, not luck of the draw.
          </p>
        </ScrollRegion>
      ) : null}
    </div>
  )
}

interface TabProps {
  personIds: string[]
  personName: (id: string) => string
  applyStrategy: (claim: Readonly<Record<string, number>>) => void
}

const fmtClaim = fmtClaimAge

function claimsLabel(claim: Readonly<Record<string, ClaimAgeValue>>, ids: readonly string[]): string {
  return ids.map((id) => fmtClaim(claim[id]!)).join(' / ')
}

/**
 * A signed dollar change whose sign follows the printed magnitude: "+$19k"
 * in the positive colour, "−$68k" in the negative one, and a change that
 * prints as $0 with no sign and no colour.
 */
function SignedMoney({ value }: { value: number }) {
  const printed = fmtMoneyCompact(Math.abs(value))
  if (printed === fmtMoneyCompact(0)) return <span>{printed}</span>
  return <span className={value > 0 ? 'delta-pos' : 'delta-neg'}>{value > 0 ? '+' : '−'}{printed}</span>
}

/** An objective's own difference, signed the same way ("+1 yr", "+$2,519", "$0"). */
function fmtObjectiveDelta(label: string, value: number): string {
  if (label.toLowerCase().includes('years')) return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)} yr`
  const printed = fmtMoneyCompact(Math.abs(value))
  if (printed === fmtMoneyCompact(0)) return printed
  return `${value > 0 ? '+' : '−'}${printed}`
}


/** What an objective's fallback rows lack: the years it ranks on. */
function fallbackYearsNoun(objectiveId: ObjectivePolicyId): string {
  return objectiveId === 'bridge-durability' ? 'bridge years' : 'survivor years'
}

function InYourPlanTab({ personName, applyStrategy }: Omit<TabProps, 'personIds'>) {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const startYear = currentStartYear()
  const { result: baselineProjection } = useProjection(plan)
  // Survivor liquidity ranks on the years exactly one spouse is alive; a plan
  // with none (one adult, or both people reaching the plan's end) would be
  // ranked by it on the estate alone, so it is not offered under its name.
  const survivorYears = hasSurvivorYears(baselineProjection)
  const objectiveChoices = OBJECTIVE_CHOICES.filter((c) => survivorYears || c.value !== 'protect-survivor-liquidity')
  const [chosenObjectiveId, setObjectiveId] = useState<ObjectivePolicyId>('max-after-tax-estate')
  const objectiveId = objectiveChoices.some((c) => c.value === chosenObjectiveId) ? chosenObjectiveId : 'max-after-tax-estate'
  /**
   * The sweep, off the render path.
   *
   * 81 full ledger simulations for a couple (139 ms measured) ran synchronously
   * inside a `useMemo`, so every plan edit froze the tab with no loading state
   * at all. This is the shape `SurvivorTransitionPage` already uses: debounce
   * into state, hold the result WITH the inputs it was computed for so a stale
   * sweep can never render against an edited plan, and absorb a throw into an
   * error card rather than a stuck skeleton.
   */
  const [snapshot, setSnapshot] = useState<{
    plan: typeof plan
    objectiveId: ObjectivePolicyId
    sweep: ClaimAgeSweep | null
    /**
     * `sweep === null` has exactly one cause: the catch below. A sweep that
     * ranks nothing is a real `ClaimAgeSweep` whose verdict says why, so this
     * carries the caught error's own message and the card can say what
     * actually happened instead of guessing.
     */
    sweepError: string | null
  } | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSnapshot({
          plan,
          objectiveId,
          sweep: sweepClaimAges(plan, { startYear, taxCalculator: taxCalculatorFor(plan), objectivePolicyId: objectiveId }),
          sweepError: null,
        })
      } catch (err) {
        // Logged the way the error boundaries above this tab do
        // (ShellErrorBoundary, RouteErrorBoundary), so this is never silent
        // to the console even though the card's wording stays neutral about
        // the cause.
        console.error('Claim-age sweep failed:', err)
        setSnapshot({ plan, objectiveId, sweep: null, sweepError: err instanceof Error ? err.message : String(err) })
      }
    }, SWEEP_DEBOUNCE_MS)
    // Cancellation: a plan or ranking change before the timer fires drops the
    // sweep that was queued for the old inputs.
    return () => window.clearTimeout(timer)
  }, [plan, startYear, objectiveId])
  const settled = snapshot !== null && snapshot.plan === plan && snapshot.objectiveId === objectiveId ? snapshot : null
  const sweep = settled?.sweep ?? null
  // The refinement and the robustness table are held, like the sweep, with the
  // plan and ranking they were computed for: an edit or a ranking change
  // retires them, so neither mixes two plans nor applies an old claim.
  const [refinedFor, setRefinedFor] = useState<{ plan: typeof plan; objectiveId: ObjectivePolicyId; refinement: ClaimAgeRefinement } | null>(null)
  const refinement = refinedFor !== null && refinedFor.plan === plan && refinedFor.objectiveId === objectiveId ? refinedFor.refinement : null
  const [mcFor, setMcFor] = useState<{ plan: typeof plan; objectiveId: ObjectivePolicyId; rates: Record<string, number> } | null>(null)
  const mc = mcFor !== null && mcFor.plan === plan && mcFor.objectiveId === objectiveId ? mcFor.rates : null
  const [mcRunning, setMcRunning] = useState(false)
  const [mcErrorFor, setMcErrorFor] = useState<{ plan: typeof plan; objectiveId: ObjectivePolicyId; message: string } | null>(null)
  const mcError = mcErrorFor !== null && mcErrorFor.plan === plan && mcErrorFor.objectiveId === objectiveId ? mcErrorFor.message : null

  // Only the engine's winner is ever crowned (banner, Apply, refine, table and
  // heatmap highlights). A flat objective, a current claim that already leads,
  // or a refusal gets a note instead (#454).
  const best = sweep?.verdict === 'winner' ? (sweep.winner ?? undefined) : undefined
  const personIds = [...(sweep?.personIds ?? [])]
  const keyOf = (r: { claimByPersonId: Readonly<Record<string, number>> }) => personIds.map((id) => r.claimByPersonId[id]).join('-')

  const applyMonthly = (claim: Readonly<Record<string, ClaimAgeValue>>) =>
    update((d) => {
      for (const s of d.incomes) {
        if (s.type === 'socialSecurity' && claim[s.personId] !== undefined) s.claimAge = { ...claim[s.personId]! }
      }
    })

  const runRobustness = async () => {
    if (sweep === null) return
    const forPlan = plan
    const forObjective = objectiveId
    setMcRunning(true)
    setMcErrorFor(null)
    try {
      const top = sweep.ranked.slice(0, 5)
      const out: Record<string, number> = {}
      for (const row of top) {
        const candidate = planWithClaimAges(forPlan, row.claimByPersonId)
        const summary = await runMonteCarlo(candidate, {
          startYear,
          pathCount: 500,
          seed: DEFAULT_MONTE_CARLO_SEED,
          model: { type: 'lognormal', inflationMeanPct: forPlan.assumptions.inflationPct },
        })
        out[keyOf(row)] = summary.successRate
      }
      setMcFor({ plan: forPlan, objectiveId: forObjective, rates: out })
    } catch (e: unknown) {
      setMcErrorFor({ plan: forPlan, objectiveId: forObjective, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setMcRunning(false)
    }
  }

  const objectiveLabel = objectivePolicies[objectiveId].label.toLowerCase()
  // The header stays on screen in every state, so the ranking can be changed
  // while the previous one is still being swept.
  const header = (
    <>
      <p className="card-hint">
        Each whole-year claim-age combination, from 62 (or the age reached this year, if later) to 70, is run through your full plan:
        taxes, Roth conversions, IRMAA, ACA, and RMDs included, and ranked by the objective you choose{' '}
        <HelpTip text="Ending net worth minus the income tax heirs owe on inherited pre-tax (traditional) balances, at the heir tax rate in Assumptions, in dollars of the plan's last year. This is the deterministic, single-planning-age view; the Benefits-only tab adds the mortality-weighted insurance angle." />.
        Your plan's own Roth conversion strategy stays as it is for every claim age: a bracket fill resizes itself, a
        fixed schedule does not. The Optimize page's claim-age option searches differently. It re-optimizes the
        conversions, but tries only 62, full retirement age and 70, one person at a time, compares on after-tax
        estate alone and needs a $1,000 margin, so the two pages can pick different ages. Results assume your expected
        returns; use the robustness check to see how the ranking holds up across markets.
      </p>
      <div className="form-grid" style={{ marginBottom: '0.75rem', maxWidth: '26rem' }}>
        <div className="field-span-full">
        <SelectField
          label="Rank claim ages by"
          help="Every whole-year Social Security claim-age candidate is evaluated on your full year-by-year projection, then those same evaluations are re-ranked by this objective. Survivor liquidity is offered only when your plan has years with one spouse surviving."
          hint={objectivePolicies[objectiveId].description}
          value={objectiveId}
          options={objectiveChoices}
          onCommit={setObjectiveId}
        />
        </div>
      </div>
    </>
  )

  if (sweep === null) {
    return (
      <div>
        {header}
        {settled === null ? (
          <div className="skeleton" style={{ height: '12rem' }} aria-label="Comparing claim ages" />
        ) : (
          // sweep === null here is always the catch above, never a refusal
          // (that is a real ClaimAgeSweep with its verdict). The copy stays
          // neutral about the cause — it can be a plan combination the sweep
          // does not handle, or a bug — rather than telling the household this
          // is a validation problem they should go find on the Enter screens
          // (#598).
          <div className="callout callout--warn" role="alert">
            <p>
              The claim-age comparison hit an error and could not run. The rest of the planner is unaffected.
              Reloading usually clears a one-off error; if it keeps happening on this plan, that points to a bug
              rather than something you entered.
            </p>
            {settled.sweepError ? <p className="muted small">Comparison error: {settled.sweepError}</p> : null}
          </div>
        )}
      </div>
    )
  }

  const current = sweep.current
  const fallbackRows = sweep.rows.filter((r) => r.rankedOn !== 'objective').length
  const planHasNoFallbackYears = sweep.rows.some((r) => r.rankedOn === 'estate-fallback-plan')
  // The ranking is refused (no row eligible, or an unpriced credit), so its
  // order is not a ranking to check for robustness (L6).
  const ranksRows = sweep.verdict === 'winner' || sweep.verdict === 'current-best' || sweep.verdict === 'flat'
  const heldDisability =
    sweep.disabilityPersonIds.length > 0 && sweep.rows.length > 0 ? (
      <p className="card-hint" data-sweep-held="disability">
        {sweep.disabilityPersonIds.map((id) => `${disabilityNote(personName(id))} It stays as your plan pays it in every claim age below.`).join(' ')}
      </p>
    ) : null
  const heldFixed =
    sweep.alreadyClaimed.length > 0 && sweep.personIds.length > 0 && sweep.rows.length > 0 ? (
      <p className="card-hint">
        {alreadyClaimedText(sweep.alreadyClaimed, personName)}, before the plan starts in {startYear}, so{' '}
        {sweep.alreadyClaimed.length === 1 ? 'that claim is held as it is' : 'those claims are held as they are'} in every
        claim age below.
      </p>
    ) : null

  return (
    <div>
      {header}

      {sweep.verdict === 'already-claimed' ? (
        <div className="callout callout--note" role="note">
          <strong>Every claim here is already made.</strong> {alreadyClaimedText(sweep.alreadyClaimed, personName)},
          before the plan starts in {startYear}, so there is no claim age left to compare. {ALREADY_CLAIMED_LIMITS}
        </div>
      ) : sweep.verdict === 'disability' ? (
        <div className="callout callout--note" role="note" data-sweep-refusal="disability">
          {sweep.disabilityPersonIds.map((id) => disabilityNote(personName(id))).join(' ')}
          {sweep.alreadyClaimed.length > 0
            ? ` ${alreadyClaimedText(sweep.alreadyClaimed, personName)}, before the plan starts in ${startYear}, so no claim age is left to compare there either.`
            : ''}
        </div>
      ) : sweep.verdict === 'empty' ? (
        <div className="callout callout--note" role="note">
          No Social Security claim with a benefit to compare.
        </div>
      ) : sweep.verdict === 'aca-unpriced' ? (
        <div className="callout callout--note" role="note">
          <strong>No claim age is ranked.</strong> {claimAgeUnpricedCreditReason(sweep.unpricedAca, plan.expenses.healthcare)} The table below
          shows each claim age without the credit in those years.
        </div>
      ) : sweep.verdict === 'flat' || sweep.verdict === 'current-best' || sweep.verdict === 'ineligible' ? (
        <div className="callout callout--note" role="note">
          {sweep.verdict === 'flat' ? (
            <>
              <strong>No best claim age to recommend.</strong> Every claim age scores the same on {objectiveLabel}, so
              this ranking cannot separate them. Try another ranking, or compare the claim ages in the table below.
            </>
          ) : sweep.verdict === 'current-best' ? (
            <>
              <strong>Your current claim age already leads.</strong> No other claim age improves on it by{' '}
              {objectiveLabel}; the table below shows how the others compare.
            </>
          ) : (
            <>
              <strong>No claim age meets this ranking's constraints.</strong> Try another ranking, or review the
              table below for what each claim age would do.
            </>
          )}
        </div>
      ) : best && current ? (
        <div className="callout callout--info">
          <strong>Best by {objectiveLabel}: claim at {ageLabel(best.claimByPersonId, personIds)}</strong>
          {personIds.length === 2 ? ` (${personIds.map(personName).join(' / ')})` : ''}, after-tax estate{' '}
          {fmtMoneyCompact(best.endingAfterTaxEstate)}
          {!best.isCurrent ? (
            <>
              {' '}
              vs {fmtMoneyCompact(current.endingAfterTaxEstate)} at your current{' '}
              {claimsLabel(current.claimByPersonId, personIds)} (<SignedMoney value={sweep.winnerEstateChangeVsCurrent!} />
              ), in {sweep.estateYear} dollars.
            </>
          ) : `, your current choice (${sweep.estateYear} dollars).`}
          {objectiveId !== 'max-after-tax-estate' ? (
            best.rankedOn === 'estate-fallback-plan' ? (
              <>
                {' '}
                Your plan as entered has no {fallbackYearsNoun(objectiveId)} to compare against, so this claim age was
                ranked on the after-tax estate change ({fmtObjectiveDelta('estate', best.primaryValue)} vs current).
              </>
            ) : best.rankedOn === 'estate-fallback-row' ? (
              <>
                {' '}
                This claim age leaves no {fallbackYearsNoun(objectiveId)}, so it was ranked on the after-tax estate
                change ({fmtObjectiveDelta('estate', best.primaryValue)} vs current).
              </>
            ) : (
              <>
                {' '}
                Ranked on {sweep.primaryMetricLabel.toLowerCase()} ({fmtObjectiveDelta(sweep.primaryMetricLabel, best.primaryValue)} vs current);
                estate is shown for context.
              </>
            )
          ) : null}
          {!best.isCurrent ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={() => applyStrategy(best.claimByPersonId)}>
                Apply {ageLabel(best.claimByPersonId, personIds)}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {heldFixed}
      {heldDisability}

      {fallbackRows > 0 && sweep.rows.length > 0 ? (
        <p className="card-hint" data-ranked-on={planHasNoFallbackYears ? 'estate-fallback-plan' : 'estate-fallback-row'}>
          {planHasNoFallbackYears
            ? `Your plan as entered has no ${fallbackYearsNoun(objectiveId)} to compare against, so this ranking compares every claim age on the after-tax estate change.`
            : fallbackRows === sweep.rows.length
              ? `None of these claim ages leaves ${fallbackYearsNoun(objectiveId)} to rank on, so this ranking compares them on the after-tax estate change.`
              : `${fallbackRows} of the ${sweep.rows.length} claim ages leave no ${fallbackYearsNoun(objectiveId)}, so this ranking compares those on the after-tax estate change, and the rest on the lowest balance in those years.`}
        </p>
      ) : null}

      {personIds.length === 2 ? <CoupleStrategyPanel personName={personName} best={best} /> : null}

      {sweep.rows.length === 0 ? null : personIds.length === 1 ? (
        <SingleSweepTable sweep={sweep} applyStrategy={applyStrategy} />
      ) : (
        <>
          <a className="skip-link" href="#ss-claim-age-heatmap-actions">
            Skip claim-age choices
          </a>
          <CoupleHeatmap personName={personName} sweep={sweep} applyStrategy={applyStrategy} />
        </>
      )}

      {sweep.rows.length > 0 ? (
        <div id="ss-claim-age-heatmap-actions" className="add-row mt-md">
          {best ? (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                const result = refineClaimAgeMonthly(plan, sweep, { startYear, taxCalculator: taxCalculatorFor(plan) })
                if (result !== null) setRefinedFor({ plan, objectiveId, refinement: result })
              }}
            >
              Refine to the month
            </button>
          ) : null}
          {ranksRows ? (
            <button type="button" className="btn btn-secondary btn-small" disabled={mcRunning} onClick={() => void runRobustness()}>
              {mcRunning ? 'Running…' : 'Check robustness (Monte Carlo, top 5)'}
            </button>
          ) : null}
        </div>
      ) : null}
      {mcError ? (
        <div className="error-recovery" role="alert">
          <p className="error-text">Robustness check error: {mcError}</p>
          {canRunAgain(mcError) ? (
            <button type="button" className="btn btn-secondary btn-small" disabled={mcRunning} onClick={() => void runRobustness()}>
              Run again
            </button>
          ) : null}
        </div>
      ) : null}

      {refinement && best ? (
        <div className="callout callout--info mt-ms">
          {refinement.moved ? (
            <>
              <strong>To the month: claim at {claimsLabel(refinement.claimByPersonId, personIds)}</strong>
              {personIds.length === 2 ? ` (${personIds.map(personName).join(' / ')})` : ''}, after-tax estate{' '}
              {fmtMoneyCompact(refinement.endingAfterTaxEstate)} (<SignedMoney value={refinement.estateChangeVsWinner} /> over
              the whole-year pick
              {objectiveId !== 'max-after-tax-estate'
                ? `; ${fmtObjectiveDelta(sweep.primaryMetricLabel, refinement.primaryChangeVsWinner)} on ${sweep.primaryMetricLabel.toLowerCase()}`
                : ''}
              ), in {sweep.estateYear} dollars.
            </>
          ) : (
            <>
              <strong>No month within a year of the whole-year pick ranks higher</strong> on {objectiveLabel}: each
              claim month from a year below to a year above {ageLabel(best.claimByPersonId, personIds)} was tried, one
              person at a time, and none improved on it while meeting this ranking's constraints.
            </>
          )}
          {personIds.some((id) => refinement.claimByPersonId[id]!.months > 0) ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={() => applyMonthly(refinement.claimByPersonId)}>
                Apply {claimsLabel(refinement.claimByPersonId, personIds)}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {mc ? (
        <table className="claim-table mt-ms">
          <thead>
            <tr>
              <th scope="col">Strategy (claim ages)</th>
              <th scope="col">After-tax estate</th>
              <th scope="col">Success %</th>
            </tr>
          </thead>
          <tbody>
            {sweep.ranked.slice(0, 5).map((r) => (
              <tr key={keyOf(r)}>
                <td>{ageLabel(r.claimByPersonId, personIds)}</td>
                <td>{fmtMoneyCompact(r.endingAfterTaxEstate)}</td>
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
 * recommended strategy follows the common "lower earlier / higher later"
 * pattern. It credits the ranking only to the objective chosen: the pattern
 * is described, never given as the ranking's reason.
 */
function CoupleStrategyPanel({ personName, best }: { personName: (id: string) => string; best?: ClaimAgeSweepRow }) {
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
            The top-ranked strategy above follows the common pattern: <strong>{lowerName}</strong> claims at{' '}
            {lowerClaim} and <strong>{higherName}</strong> at {higherClaim}, which also keeps the larger check for the
            survivor. It ranks first on the objective you chose, not on survivor protection alone.
          </>
        ) : (
          <>
            {' '}
            Here the top-ranked strategy has <strong>{higherName}</strong> ({higherClaim}) claim before{' '}
            <strong>{lowerName}</strong> ({lowerClaim}), the reverse of the common pattern: on the objective you chose,
            this plan's taxes and balances rank it first.
          </>
        )
    }
  }

  return (
    <div className="callout callout--info">
      {samePia ? (
        <>
          Both full-retirement-age benefits (PIA) are about {fmtMoneyCompact(higher.pia * 12)}/yr. When the first spouse
          dies the survivor keeps the larger of the two checks, so delaying either claim raises the survivor floor.
        </>
      ) : (
        <>
          <strong>{higherName}</strong> has the larger full-retirement-age benefit (PIA):{' '}
          {fmtMoneyCompact(higher.pia * 12)}/yr against {fmtMoneyCompact(lower.pia * 12)}/yr for {lowerName}. After the
          first death the survivor keeps only the larger check, so delaying <strong>{higherName}</strong>’s claim protects
          whoever lives longest.
        </>
      )}
      {patternNote}
    </div>
  )
}

function SingleSweepTable({
  sweep,
  applyStrategy,
}: {
  sweep: ClaimAgeSweep
  applyStrategy: (claim: Readonly<Record<string, number>>) => void
}) {
  const readOnly = useWorkspaceReadOnly()
  const id = sweep.personIds[0]!
  const byAge = [...sweep.rows].sort((a, b) => a.claimByPersonId[id]! - b.claimByPersonId[id]!)
  const bestKey = sweep.winner?.claimByPersonId[id] ?? null
  return (
    <ScrollRegion label="Claim-age sweep" style={{ border: 'none' }}>
      <table className="claim-table">
        <thead>
          <tr>
            <th scope="col">Claim at</th>
            <th scope="col">After-tax estate</th>
            <th scope="col">Lifetime tax</th>
            <th scope="col">Depletes</th>
            <th scope="col" aria-label="apply" />
          </tr>
        </thead>
        <tbody>
          {byAge.map((r) => {
            const age = r.claimByPersonId[id]
            return (
              <tr key={age} className={(age === bestKey ? 'claim-row--best ' : '') + (r.isCurrent ? 'claim-row--current' : '')}>
                <td>{age}</td>
                <td>{fmtMoneyCompact(r.endingAfterTaxEstate)}</td>
                <td>{fmtMoneyCompact(r.lifetimeTaxesAndPenalties)}</td>
                <td>{r.depletionYear ?? 'never'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    disabled={r.isCurrent || readOnly}
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
    </ScrollRegion>
  )
}

function CoupleHeatmap({
  personName,
  sweep,
  applyStrategy,
}: {
  personName: (id: string) => string
  sweep: ClaimAgeSweep
  applyStrategy: (claim: Readonly<Record<string, number>>) => void
}) {
  const readOnly = useWorkspaceReadOnly()
  const rowId = sweep.personIds[0]!
  const colId = sweep.personIds[1]!
  // The axes are the ages the engine swept, so every cell names a row it ran.
  const rowAges = sweep.agesByPersonId[rowId] ?? []
  const colAges = sweep.agesByPersonId[colId] ?? []
  const byKey = new Map(sweep.rows.map((r) => [`${r.claimByPersonId[rowId]}-${r.claimByPersonId[colId]}`, r]))
  const missing = rowAges.flatMap((ra) => colAges.filter((ca) => !byKey.has(`${ra}-${ca}`)).map((ca) => `${ra} / ${ca}`))
  if (missing.length > 0) {
    // A cell with no row is a bug in the sweep, never a $0 estate.
    return (
      <div className="callout callout--warn" role="alert">
        The claim-age comparison is missing {missing.length === 1 ? 'a combination' : `${missing.length} combinations`} (
        {missing.join(', ')}), so the heatmap is not shown. That points to a bug rather than something you entered.
      </div>
    )
  }
  const values = sweep.rows.map((r) => r.endingAfterTaxEstate)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const norm = (v: number) => (max > min ? (v - min) / (max - min) : 1)
  const bestKey = sweep.winner ? `${sweep.winner.claimByPersonId[rowId]}-${sweep.winner.claimByPersonId[colId]}` : null

  return (
    <>
      <p className="card-hint mt-sm">
        After-tax estate by claim age, rows: {personName(rowId)}, columns: {personName(colId)}. Greener is better;
        {readOnly ? ' claim-age choices are read-only in this workspace.' : ' use Enter or Space on a cell to apply it.'}
      </p>
      <ScrollRegion label="Claim-age heatmap" style={{ border: 'none' }}>
        <table className="claim-table heatmap">
          <thead>
            <tr>
              <th scope="col">{personName(rowId)} ↓ / {personName(colId)} →</th>
              {colAges.map((ca) => (
                <th scope="col" key={ca}>{ca}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowAges.map((ra) => (
              <tr key={ra}>
                <th scope="row">{ra}</th>
                {colAges.map((ca) => {
                  const row = byKey.get(`${ra}-${ca}`)!
                  const v = row.endingAfterTaxEstate
                  const isBest = `${ra}-${ca}` === bestKey
                  const isCurrent = row.isCurrent
                  const actionLabel = `Apply claim ages: ${personName(rowId)} at ${ra}, ${personName(colId)} at ${ca}; after-tax estate ${fmtMoneyCompact(v)}${isCurrent ? ', current plan selection' : ''}${isBest ? ', best strategy' : ''}`
                  const tooltip = `${personName(rowId)} ${ra} / ${personName(colId)} ${ca}: ${fmtMoneyCompact(v)}${isCurrent ? ' (current)' : ''}${isBest ? ' (best)' : ''}`
                  return (
                    <td
                      key={ca}
                      style={{ background: heatColor(norm(v)), outline: isCurrent ? '2px solid var(--accent)' : undefined, fontWeight: isBest ? 700 : undefined }}
                      title={tooltip}
                    >
                      <button
                        type="button"
                        className="heatmap-cell-button"
                        aria-label={actionLabel}
                        aria-current={isCurrent ? 'true' : undefined}
                        disabled={readOnly}
                        onClick={() => applyStrategy({ [rowId]: ra, [colId]: ca })}
                      >
                        {fmtMoneyCompact(v)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </>
  )
}

/**
 * Break-even education (V7 phase 2). The simple cumulative-benefit lens for one
 * person's own retirement benefit, with an optional investment return. The
 * engine accumulates the benefits in the plan's own dollars (the ledger's
 * cost-of-living factor and benefit cut for each year) and finds the
 * crossings; the page rounds them for display. Deliberately lean copy. The
 * conceptual narrative is the V9 Learning Center's job; the In-your-plan sweep
 * is the complete answer.
 */
function BreakEvenTab({ personIds, personName }: { personIds: string[]; personName: (id: string) => string }) {
  const { plan } = usePlan()
  const startYear = currentStartYear()
  const people = claimingPeople(plan, startYear)
  const [selectedId, setSelectedId] = useState(personIds[0]!)
  const [growthPct, setGrowthPct] = useState(0)

  const entry = people.find((p) => p.person.id === selectedId) ?? people[0]!
  const { person, pia, stream } = entry
  const { y, m, d } = dobParts(person)
  const dob = { year: y, month: m, day: d }
  const throughAge = person.longevity.planningAge
  const disability = disabilityReplacesClaimAge(stream, person)
  const claimAges = breakEvenClaimAges(dob, startYear)
  const result =
    !disability && claimAges.length >= 2
      ? claimBreakEven({ dob, piaMonthly: pia, claimAges, startYear, assumptions: plan.assumptions, growthPct, throughAge })
      : null

  const personSelect =
    people.length === 2 ? (
      <div className="seg mb-ms" role="group" aria-label="Person">
        {people.map((p) => (
          <button key={p.person.id} type="button" aria-pressed={selectedId === p.person.id} onClick={() => setSelectedId(p.person.id)}>
            {personName(p.person.id)}
          </button>
        ))}
      </div>
    ) : null

  if (disability) {
    return (
      <div>
        {personSelect}
        <p className="card-hint">{disabilityNote(personName(entry.person.id))}</p>
      </div>
    )
  }

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
  const { ssCola, ssHaircut, inflationPct } = plan.assumptions
  const colaText =
    ssCola.mode === 'fixed'
      ? `a ${ssCola.annualPct}% yearly cost-of-living increase`
      : `cost-of-living increases that match the plan's ${inflationPct}% inflation`
  const cutText = ssHaircut ? ` and the plan's ${ssHaircut.cutPct}% benefit cut from ${ssHaircut.fromYear}` : ''

  return (
    <div>
      <p className="card-hint">
        Claim early and collect sooner, or wait for a bigger check? This compares the cumulative lifetime benefit from{' '}
        {personName(selectedId)}'s own retirement benefit at each claim age, in the plan's dollars for each year ({colaText}
        {cutText}), with checks invested at the chosen return{' '}
        <HelpTip text="Pedagogical view. It ignores spousal and survivor benefits, the earnings test, taxes, and the rest of your portfolio; the In-your-plan sweep is the complete answer. Each year's benefit is the amount the projection pays that year. A higher assumed return rewards claiming early, pushing break-even later." />.
        It's the simple lens. The In-your-plan tab is the complete one.
      </p>

      {personSelect}

      <EarningsTestNotice claimAgesByPersonId={{ [person.id]: claimAges }} personName={personName} />

      <div className="seg mb-md" role="group" aria-label="Investment return on benefits">
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
                waiting until {c.late} pulls ahead around age <strong>{Math.round(c.age * 10) / 10}</strong>.
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
              <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} labelFormatter={(l) => `Age ${typeof l === 'number' || typeof l === 'string' ? l : ''}`} contentStyle={chartTooltipStyle} />
              <Legend />
              {claimAges.map((a, i) => (
                <Line key={a} dataKey={`a${a}`} name={`Claim ${a}`} stroke={BREAKEVEN_COLORS[i % BREAKEVEN_COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="muted small">
          Cumulative benefits received through each age, in each year's dollars{growthPct > 0 ? `, with each check invested at ${growthPct}%` : ''}.
        </p>
      </div>
    </div>
  )
}

/** Why a claim-age analysis leaves out a person whose benefit is a disability benefit from its onset. */
function disabilityNote(name: string): string {
  return `${name}'s benefit is a disability benefit, paid from the onset of the disability rather than from a claim age, so there is no claim age to compare here.`
}

/**
 * The benefits-only ranking's refusal when a claimant's benefit is a
 * disability benefit: it names each such person as the cause and, for a
 * couple whose other claim is an ordinary one, gives the ranking's own reason
 * for leaving that claim unranked too: it prices the couple's claims as pairs
 * of claim ages and cannot place a disability benefit on that grid. (The
 * In-your-plan sweep holds the disability benefit and ranks the other claim.)
 */
function benefitsOnlyDisabilityRefusal(
  disabilityPersonIds: readonly string[],
  claimantIds: readonly string[],
  personName: (id: string) => string,
): string {
  const others = claimantIds.filter((id) => !disabilityPersonIds.includes(id))
  return [
    ...disabilityPersonIds.map((id) => disabilityNote(personName(id))),
    ...(others.length > 0
      ? [
          `This ranking prices the couple's claims as pairs of claim ages and cannot place a disability benefit on that grid, so it ranks no claim age for ${others.map(personName).join(' or ')} either.`,
        ]
      : []),
  ].join(' ')
}

/** Whole-year ages in words: runs of consecutive ages as "62 to 66", the rest listed with "or". */
function ageListText(ages: readonly number[]): string {
  const runs: string[] = []
  let first = ages[0]!
  let last = first
  for (const age of [...ages.slice(1), Number.NaN]) {
    if (age === last + 1) {
      last = age
      continue
    }
    runs.push(first === last ? `${first}` : last === first + 1 ? `${first} or ${last}` : `${first} to ${last}`)
    first = age
    last = age
  }
  return runs.length <= 2 ? runs.join(' or ') : `${runs.slice(0, -1).join(', ')} or ${runs[runs.length - 1]}`
}

/**
 * Names each person whose wages in the plan would have part of their benefit
 * withheld under the earnings test at a claim age this tab shows. The
 * benefits-only views count those benefits as paid; the engine tests each year
 * with the ledger's own earnings-test function.
 */
function EarningsTestNotice({
  claimAgesByPersonId,
  personName,
}: {
  claimAgesByPersonId: Readonly<Record<string, readonly number[]>>
  personName: (id: string) => string
}) {
  const { plan } = usePlan()
  const reach = earningsTestReach(plan, claimAgesByPersonId, currentStartYear())
  if (reach.length === 0) return null
  return (
    <div className="callout callout--note" role="note">
      {reach.map(({ personId, claimAges }) => (
        <p key={personId} style={{ margin: 0 }}>
          {personName(personId)}'s wages in this plan would have part of their benefit held back under the earnings test
          if they claimed at {ageListText(claimAges)}. This view counts those benefits as paid; the In-your-plan tab holds
          them back.
        </p>
      ))}
    </div>
  )
}

/**
 * The key of the ranking's whole-year row that is the plan's own claim, or null
 * when a claim carries months: a 67y 6m claim is not the 67 row, so no row is
 * current and every row can be applied (as the In-your-plan tab compares with
 * the plan as entered, claim months included).
 */
function currentClaimKey(plan: ReturnType<typeof usePlan>['plan'], ids: readonly string[]): string | null {
  const claims = ids.map((id) => plan.incomes.find((s) => s.type === 'socialSecurity' && s.personId === id))
  if (claims.some((s) => s === undefined || s.type !== 'socialSecurity' || s.claimAge.months !== 0)) return null
  return claims.map((s) => (s!.type === 'socialSecurity' ? s!.claimAge.years : 0)).join('-')
}

function BenefitsOnlyTab({ personIds, personName, applyStrategy }: TabProps) {
  const { plan } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const [discountPct, setDiscountPct] = useState(2)
  const ranking = useMemo(
    () => benefitsOnlyRanking(plan, discountPct / 100, currentStartYear()),
    [plan, discountPct],
  )
  // The ranking's own people: its open claims (a claim already made is held
  // at its own age and not ranked).
  const rankedIds = ranking.personIds
  const best = ranking.ranked[0]
  const currentKey = currentClaimKey(plan, rankedIds)
  const keyOf = (claim: Readonly<Record<string, number>>) => rankedIds.map((id) => claim[id]).join('-')
  // The ranking prices a living ex's record only for a claimant living alone:
  // a couple's model does not read former-spouse records, and a lone claimant
  // in a two-person household is not single. The note is shown only when the
  // record is priced.
  const rankingPricesDivorcedRecord =
    plan.household.people.length === 1 &&
    rankedIds.length === 1 &&
    plan.incomes.some(
      (s) =>
        s.type === 'socialSecurity' &&
        s.personId === rankedIds[0] &&
        (s.formerSpouses ?? []).some((r) => r.relationship === 'divorced'),
    )

  return (
    <div>
      <p className="card-hint">
        The actuarial view: expected lifetime benefits weighted by the chance of being alive to receive them (SSA
        mortality), ignoring your portfolio and taxes{' '}
        <HelpTip text="The standard actuarial method: each future year's benefit is multiplied by the probability of survival and discounted to today. This isolates Social Security's longevity-insurance value, useful alongside the In-your-plan tab, which adds taxes and portfolio growth. Benefits are in today's dollars; a cost-of-living increase below inflation, or a benefit cut in the plan's assumptions, lowers the later years." />. It uses most of the In-your-plan tab's Social Security rules, but not all of them. There is no earnings test, so benefits the plan would hold back while someone is still working are counted as paid. A former spouse's record is not counted for a person in a couple. And each person has one claim age. Beyond those, the two tabs differ by taxes, portfolio growth, and the plan's fixed planning ages, which this view replaces with the chance of being alive.
      </p>
      {personIds.length === 2 ? (
        <p className="card-hint">
          For couples, benefits are priced year by year. While both are alive, the lower earner receives their own
          benefit plus a reduced spousal top-up once both have claimed. After the first death, the survivor keeps the
          larger of their own benefit and the survivor benefit, which is reduced if it starts before their survivor full
          retirement age. Each person has one claim age, so a survivor cannot take the survivor benefit first and switch
          to their own later.
        </p>
      ) : null}
      <div className="form-grid" style={{ maxWidth: '22rem' }}>
        <div className="field">
          <span className="field-label-row">
            <span className="field-label">Real discount rate: {discountPct}%</span>
            <HelpTip text="The real (after-inflation) rate used to value future benefits, conventionally near the long-term TIPS yield (~2%). Higher rates favor claiming earlier; a very high personal rate (impatience or poor health) can make 62 optimal." />
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={discountPct}
            aria-label="Real discount rate"
            aria-valuetext={`${discountPct}%`}
            onChange={(e) => setDiscountPct(Number(e.target.value))}
          />
        </div>
      </div>

      <EarningsTestNotice
        claimAgesByPersonId={Object.fromEntries(
          plan.household.people
            .filter((person) => personIds.includes(person.id))
            .map((person) => [person.id, benefitsOnlyClaimAges(person, currentStartYear())]),
        )}
        personName={personName}
      />

      {rankingPricesDivorcedRecord ? (
        <div className="callout callout--note" role="note">
          With a living ex-spouse, this ranking pays what the plan pays once the spouse benefit starts: your own benefit
          plus the part of half the ex&apos;s PIA above your own PIA, reduced for your age in the first month the ex is 62
          throughout. As in the In-your-plan tab, it pays that from the year that month falls in, and only while you are
          unmarried after a marriage of at least ten years; neither tab checks the full SSA entitlement rules.
        </div>
      ) : null}

      {ranking.disabilityPersonIds.length > 0 ? (
        <p className="card-hint" data-benefits-only-refusal="disability">
          {benefitsOnlyDisabilityRefusal(ranking.disabilityPersonIds, personIds, personName)}
        </p>
      ) : null}

      {ranking.alreadyClaimed.length > 0 && ranking.disabilityPersonIds.length === 0 ? (
        <div className="callout callout--note" role="note">
          {rankedIds.length === 0 ? <strong>Every claim here is already made. </strong> : null}
          {alreadyClaimedText(ranking.alreadyClaimed, personName)}, before the plan starts in {currentStartYear()}
          {rankedIds.length === 0
            ? `, so there is no claim age left to compare. ${ALREADY_CLAIMED_LIMITS}`
            : `, so ${ranking.alreadyClaimed.length === 1 ? 'that claim is held as it is' : 'those claims are held as they are'} below.`}
        </div>
      ) : null}

      {best ? (
        <div className="callout callout--info">
          <strong>Highest expected value: claim at {ageLabel(best.claimByPersonId, rankedIds)}</strong>
          {rankedIds.length === 2 ? ` (${rankedIds.map(personName).join(' / ')})` : ''}, expected PV{' '}
          {fmtMoneyCompact(best.expectedPv)}.
          {keyOf(best.claimByPersonId) !== currentKey ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={() => applyStrategy({ ...best.claimByPersonId })}>
                Apply {ageLabel(best.claimByPersonId, rankedIds)}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {ranking.ranked.length > 0 ? (
        <ScrollRegion label="Expected value by claim age" style={{ border: 'none' }}>
          <table className="claim-table">
            <thead>
              <tr>
                <th scope="col">Claim age{rankedIds.length === 2 ? 's' : ''}</th>
                <th scope="col">Expected PV</th>
                <th scope="col" aria-label="apply" />
              </tr>
            </thead>
            <tbody>
              {ranking.ranked.slice(0, 10).map((r) => {
                const isCurrent = keyOf(r.claimByPersonId) === currentKey
                return (
                  <tr key={keyOf(r.claimByPersonId)} className={isCurrent ? 'claim-row--current' : undefined}>
                    <td>{ageLabel(r.claimByPersonId, rankedIds)}</td>
                    <td>{fmtMoneyCompact(r.expectedPv)}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-small" disabled={isCurrent || readOnly} onClick={() => applyStrategy({ ...r.claimByPersonId })}>
                        Use
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>
      ) : null}
      {ranking.ranked.length > 10 ? <p className="muted small">Showing the top 10 of {ranking.ranked.length} combinations.</p> : null}

      <SurvivorSwitchingPanel discountPct={discountPct} />
      <FicaReturnPanel discountPct={discountPct} />
    </div>
  )
}

/**
 * "What you paid in vs. what you get back": an education and context readout
 * (the projection taxes no working-years wages). The engine restates the OASDI
 * tax paid over the entered earnings history, and the tax the projected work
 * the PIA counts will pay, in today's dollars at each year's rate and wage
 * cap, and prices the benefits the person is paid (on their own record, or a
 * former spouse's when larger): those already received and the
 * survival-weighted expected value of the rest at the current claim age. Only
 * renders when an earnings history is present; Quick-PIA plans get a note, and
 * a disability benefit from its onset gets the same sentence as the ranking.
 */
function FicaReturnPanel({ discountPct }: { discountPct: number }) {
  const { plan } = usePlan()
  const [selfEmployed, setSelfEmployed] = useState(false)
  const startYear = currentStartYear()
  const discountRate = discountPct / 100
  // Everyone with an earnings history, whether or not it gives a benefit
  // estimate: the tax paid so far needs only the rows, the rates and CPI-U.
  const withEarnings = plan.household.people.flatMap((person) => {
    const stream = socialSecurityStreamFor(plan, person.id)
    return stream?.earnings && stream.earnings.length > 0 ? [{ person, stream }] : []
  })

  return (
    <details className="ss-explainer mt-lg">
      <summary>What you paid in vs. what you get back</summary>
      <p className="card-hint">
        An illustrative "return on your Social Security taxes": the OASDI payroll tax you paid over your earnings
        history and the tax your projected work will pay, in today's dollars, beside the benefits you are paid (on your
        record, or a former spouse's when larger): those already received and the survival-weighted expected value of
        the rest at your current claim age. This is an individual-level illustration,
        not the program's actuarial return, and it excludes the insurance value of disability and survivor benefits,
        benefits paid to others on your record, and Medicare.{' '}
        <LearnLink {...LEARN.ssTaxesVsBenefits} variant="inline" />
      </p>
      <div className="form-grid" style={{ maxWidth: '24rem' }}>
        <CheckboxField
          label="Self-employed"
          help="Uses each year's self-employment tax rate, both halves of the tax (12.4% today), instead of the employee's share (6.2% today)."
          value={selfEmployed}
          onCommit={setSelfEmployed}
        />
      </div>
      {withEarnings.length === 0 ? (
        <p className="muted small">Enter an earnings history on the Social Security step to see what you paid in.</p>
      ) : (
        withEarnings.map(({ person, stream }) => {
          if (disabilityReplacesClaimAge(stream, person)) {
            return (
              <p key={person.id} className="card-hint">
                {disabilityNote(person.name)}
              </p>
            )
          }
          const result = oasdiReturnForPerson(plan, person.id, { startYear, discountRate, selfEmployed })
          if (result === null) {
            // No benefit estimate from this history: the tax paid so far, and why the rest is missing.
            const paid = oasdiPaidIn(stream.earnings ?? [], { selfEmployed, startYear, inflationPct: plan.assumptions.inflationPct })
            return (
              <div key={person.id} className="callout callout--info" style={{ marginTop: '0.6rem' }}>
                <strong>{person.name}</strong>
                <ScrollRegion label={`Paid in: ${person.name}`} style={{ border: 'none' }}>
                  <table className="claim-table">
                    <tbody>
                      <PaidInSoFarRows paid={paid} startYear={startYear} />
                    </tbody>
                  </table>
                </ScrollRegion>
                <ExcludedYearsNote paid={paid} />
                <p className="muted small mt-xs">
                  {noBenefitEstimateReason(person, stream, piaAsOfPlan(plan, startYear))} So the benefits and the ratio are
                  not shown.
                </p>
              </div>
            )
          }
          const { paid } = result
          return (
            <div key={person.id} className="callout callout--info" style={{ marginTop: '0.6rem' }}>
              <strong>{person.name}</strong>
              <ScrollRegion label={`Paid in vs. received: ${person.name}`} style={{ border: 'none' }}>
                <table className="claim-table">
                  <tbody>
                    <PaidInSoFarRows paid={paid} startYear={startYear} />
                    {paid.projectedYears.length > 0 ? (
                      <tr>
                        <td>What your projected work will pay ({paid.projectedYears[0]}–{paid.projectedYears[paid.projectedYears.length - 1]}, {startYear} dollars)</td>
                        <td>{fmtMoney(paid.projectedToday)}</td>
                      </tr>
                    ) : null}
                    {paid.projectedEmployerToday > 0 ? (
                      <tr><td className="muted small">Employer's share of the projected work (context)</td><td className="muted small">{fmtMoney(paid.projectedEmployerToday)}</td></tr>
                    ) : null}
                    {result.receivedBeforeStart > 0 ? (
                      <tr><td>Benefits already received ({startYear} dollars)</td><td>{fmtMoney(result.receivedBeforeStart)}</td></tr>
                    ) : null}
                    <tr><td>Expected lifetime benefits from {startYear} (PV)</td><td>{fmtMoneyCompact(result.getBackPv)}</td></tr>
                    <tr><td>Ratio (get back ÷ paid in)</td><td>{result.ratio === null ? '—' : `${result.ratio.toFixed(2)}×`}</td></tr>
                  </tbody>
                </table>
              </ScrollRegion>
              <ExcludedYearsNote paid={paid} />
              <p className="muted small mt-xs">
                At a {discountPct}% real discount rate. Paid in uses each year's tax rate and wage cap, adjusted to{' '}
                {startYear} dollars for price inflation with no interest added. The projected work is the earnings your
                benefit estimate assumes, taxed the same way (today's rate and wage cap for a year not yet set). The ratio
                divides by both. Excludes Medicare tax,
                disability and survivor insurance value, and benefits paid to others on your record.
              </p>
            </div>
          )
        })
      )}
    </details>
  )
}

/** The tax paid so far and the employer's share beside it, in the start year's dollars. */
function PaidInSoFarRows({ paid, startYear }: { paid: OasdiPaidIn; startYear: number }) {
  return (
    <>
      <tr><td>Paid in so far (OASDI, {startYear} dollars)</td><td>{fmtMoney(paid.paidInToday)}</td></tr>
      {paid.employerToday > 0 ? (
        <tr><td className="muted small">Employer paid so far (context)</td><td className="muted small">{fmtMoney(paid.employerToday)}</td></tr>
      ) : null}
    </>
  )
}

function ExcludedYearsNote({ paid }: { paid: OasdiPaidIn }) {
  return paid.excludedYears.length > 0 ? (
    <p className="muted small mt-xs">
      Not counted: earnings in {paid.excludedYears.join(', ')}, from a year before Social Security taxed this kind of
      work.
    </p>
  ) : null
}

/**
 * Why a person with an earnings history has no benefit estimate, from the one
 * PIA resolver's own result: the benefit formula it models starts with people
 * who turned 62 in 1979, a history can give a PIA of $0, and an entered PIA
 * of $0 wins over the history.
 */
function noBenefitEstimateReason(
  person: Person,
  stream: Extract<Plan['incomes'][number], { type: 'socialSecurity' }>,
  asOf: ReturnType<typeof piaAsOfPlan>,
): string {
  const resolved = resolveStreamPiaMonthly(stream, person, asOf)
  if (resolved.status === 'earningsError') {
    return resolved.error.code === 'eligibility_before_1979'
      ? `${person.name} turned 62 before 1979, and benefits for people who did use an older formula the planner does not compute. Entering the benefit (PIA) from a Social Security statement gives the benefit side.`
      : `The benefit formula could not use ${person.name}'s earnings history: ${resolved.error.message}`
  }
  if (resolved.status === 'entered') return `${person.name}'s entered benefit (PIA) is $0, and it is used instead of the earnings history.`
  return `${person.name}'s earnings history gives no benefit (a PIA of $0).`
}

/** A switching strategy in words, e.g. "Survivor at 60, switch to own at 70". */
function switchStrategyLabel(strategy: SwitchStrategy): string {
  const { survivorClaimAge: s, ownClaimAge: o } = strategy
  if (s !== null && o !== null) {
    return s <= o ? `Survivor at ${s}, switch to own at ${o}` : `Own at ${o}, switch to survivor at ${s}`
  }
  if (s !== null) return `Survivor only, at ${s}`
  if (o !== null) return `Own only, at ${o}`
  return 'Claim nothing'
}

/**
 * Survivor ↔ personal switching for a widowed single user: rank strategies that
 * sequence the survivor benefit and the person's own benefit. Shown only when the
 * single person has a deceased former spouse whose survivor benefit is preserved.
 * The engine picks the record and ranks the strategies; the page labels them.
 */
function SurvivorSwitchingPanel({ discountPct }: { discountPct: number }) {
  const { plan } = usePlan()
  const startYear = currentStartYear()
  const people = claimingPeople(plan, startYear)
  if (plan.household.people.length !== 1 || people.length !== 1) return null
  const input = survivorSwitchingInputs(plan, people[0]!.person.id, startYear)
  if (input === null) return null
  const ranked = rankSwitchStrategies(input, { discountRate: discountPct / 100, assumptions: plan.assumptions }).slice(0, 5)

  return (
    <div className="mt-lg">
      <h3>Survivor vs. personal timing</h3>
      <p className="card-hint">
        As a widow(er) you can hold both a survivor benefit and your own, and switch between them. Survivor benefits stop
        growing at your full retirement age while your own grows to 70, so the order matters. Ranked by expected value in
        today's dollars at {discountPct}%, with the plan's cost-of-living increases and any benefit cut{' '}
        <HelpTip text="Illustrative: the survivor benefit starts from the deceased's full benefit (their PIA, or more if they delayed), is reduced for claiming before your survivor full retirement age (up to 28.5% at 60), and, if the deceased claimed early, is then held to the larger of what they were receiving and 82.5% of their PIA: the same computation the projection ledger uses. Only one benefit is paid at a time, the larger of those claimed, and strategies that pay the same benefits are shown once." />.
      </p>
      <ScrollRegion label="Survivor vs. personal timing" style={{ border: 'none' }}>
        <table className="claim-table">
          <thead>
            <tr>
              <th scope="col">Strategy</th>
              <th scope="col">Expected PV</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const label = switchStrategyLabel(r.strategy)
              return (
                <tr key={label} className={i === 0 ? 'claim-row--best' : undefined}>
                  <td>{label}</td>
                  <td>{fmtMoneyCompact(r.expectedPv)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  )
}
