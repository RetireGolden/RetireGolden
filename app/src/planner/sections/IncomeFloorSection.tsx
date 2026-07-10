/**
 * Income floor section (social-security-bridge-and-tips-ladder): TIPS ladders
 * as plan artifacts — build a level real income floor or a Social Security
 * bridge, see its buy-list and quoted cost on the embedded real-yield curve,
 * read the funded ratio, and (opt-in only) sanity-check against live Treasury
 * FedInvest prices.
 */

import { useMemo, useState } from 'react'

import type { TipsLadder } from '../../engine/model/plan'
import { EMBEDDED_REAL_YIELD_CURVE } from '../../engine/params'
import { buildLadder, type LadderBuild } from '../../engine/ladder/ladderMath'
import { computeFundedRatio } from '../../engine/ladder/fundedRatio'
import {
  FEDINVEST_PAGE_URL,
  fetchFedInvestTips,
  importFedInvestCsv,
  latestPriceDateIso,
  nearestTipsForYear,
  readFedInvestCache,
  type FedInvestSnapshot,
} from '../../engine/ladder/fedInvest'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { usePlan } from '../planContextCore'
import { provenanceSource } from '../provenanceLinks'
import { CheckboxField, MoneyField, NumberField, SelectField, TextField } from '../fields'
import { fmtMoney, fmtMoneyCompact } from '../format'
import { currentStartYear, useProjection } from '../useProjection'
import { Issues } from './shared'

const CURVE = EMBEDDED_REAL_YIELD_CURVE

/** Quote a ladder exactly the way the ledger prices it (same anchor rules). */
function quoteLadder(ladder: TipsLadder, startYear: number): LadderBuild | null {
  const anchorYear = ladder.purchase ? ladder.purchase.year : startYear - 1
  const effectiveStartYear = Math.max(ladder.startYear, anchorYear + 1)
  if (ladder.endYear < effectiveStartYear || ladder.annualRealAmount <= 0) return null
  return buildLadder({
    annualRealIncome: ladder.annualRealAmount,
    firstPayoutOffset: effectiveStartYear - anchorYear,
    payoutYears: ladder.endYear - effectiveStartYear + 1,
    curve: CURVE,
  })
}

function LadderRow({ ladder, index, startYear }: { ladder: TipsLadder; index: number; startYear: number }) {
  const { plan, update } = usePlan()
  const quote = useMemo(() => quoteLadder(ladder, startYear), [ladder, startYear])
  const fundingOptions = plan.accounts
    .filter((a) => a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp')
    .map((a) => ({ value: a.id, label: a.name }))
  const edit = (fn: (l: TipsLadder) => void) =>
    update((d) => {
      const l = d.incomeFloor?.ladders[index]
      if (l) fn(l)
    })

  return (
    <div className="item-row">
      <div className="item-row-head">
        <span className="item-row-title">
          <span className="type-chip">{ladder.purpose === 'bridge' ? 'Bridge' : 'Floor'}</span>
          {ladder.name}
        </span>
        <button
          type="button"
          className="btn-ghost btn-ghost-danger"
          onClick={() => update((d) => void d.incomeFloor?.ladders.splice(index, 1))}
        >
          Remove
        </button>
      </div>
      <div className="form-grid">
        <TextField label="Name" value={ladder.name} onCommit={(v) => edit((l) => void (l.name = v || 'TIPS ladder'))} />
        <SelectField
          label="Purpose"
          help="Labeling only — a bridge covers the years until a delayed Social Security claim; a floor covers essential spending. The math is the same."
          value={ladder.purpose}
          options={[
            { value: 'floor', label: 'Essential-spending floor' },
            { value: 'bridge', label: 'Social Security bridge' },
          ]}
          onCommit={(v) => edit((l) => void (l.purpose = v))}
        />
        <MoneyField
          label="Annual real income (today's $)"
          help="The level inflation-adjusted income the ladder pays in each payout year. TIPS index to CPI, so this stays constant in today's dollars. Quotes price each rung on the embedded Treasury real-yield curve."
          source={provenanceSource('real-yield-curve')}
          value={ladder.annualRealAmount}
          onCommit={(v) => edit((l) => void (l.annualRealAmount = Math.max(0, v ?? 0)))}
        />
        <NumberField
          label="First payout year"
          value={ladder.startYear}
          min={1900}
          max={2200}
          onCommit={(v) => edit((l) => void (l.startYear = Math.round(v ?? l.startYear)))}
        />
        <NumberField
          label="Last payout year"
          value={ladder.endYear}
          min={1900}
          max={2200}
          onCommit={(v) => edit((l) => void (l.endYear = Math.round(v ?? l.endYear)))}
        />
        <CheckboxField
          label="Purchase in the plan"
          help="When on, the quoted cost is withdrawn from the funding account in the purchase year (realizing capital gains pro-rata if it sells appreciated holdings). When off, the ladder is treated as already owned."
          value={ladder.purchase !== undefined}
          onCommit={(v) =>
            edit((l) => {
              l.purchase = v
                ? { year: Math.min(startYear, l.startYear - 1), fundingAccountId: fundingOptions[0]?.value ?? '' }
                : undefined
            })
          }
        />
        {ladder.purchase ? (
          <>
            <SelectField
              label="Funded from"
              value={ladder.purchase.fundingAccountId}
              options={fundingOptions.length > 0 ? fundingOptions : [{ value: '', label: 'No cash/taxable account' }]}
              onCommit={(v) => edit((l) => void (l.purchase && (l.purchase.fundingAccountId = v)))}
            />
            <NumberField
              label="Purchase year"
              hint="Must be before the first payout year."
              value={ladder.purchase.year}
              min={1900}
              max={2200}
              onCommit={(v) => edit((l) => void (l.purchase && (l.purchase.year = Math.round(v ?? l.purchase.year))))}
            />
          </>
        ) : null}
      </div>
      {quote ? (
        <>
          <p className="card-hint">
            Quoted cost <strong>{fmtMoney(quote.totalCost)}</strong> (today's $) for {quote.rungs.length} rung
            {quote.rungs.length === 1 ? '' : 's'} — real yields as of {CURVE.asOfIso}. That's{' '}
            {((ladder.annualRealAmount / quote.totalCost) * 100).toFixed(2)}% of cost per year, inflation-protected.
          </p>
          <details>
            <summary>Buy-list (planning-grade)</summary>
            <div className="year-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matures</th>
                    <th>Face (today's $)</th>
                    <th>Coupon</th>
                    <th>Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.rungs.map((rung) => (
                    <tr key={rung.maturityOffset}>
                      <td>{(ladder.purchase ? ladder.purchase.year : startYear - 1) + rung.maturityOffset}</td>
                      <td>{fmtMoney(rung.face)}</td>
                      <td>{rung.couponRatePct.toFixed(3)}%</td>
                      <td>{fmtMoney(rung.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="card-hint">
              Execute at your brokerage or TreasuryDirect — RetireGolden never places orders. Annual coupons and par-rung
              pricing are planning simplifications; real quotes differ slightly.
            </p>
          </details>
        </>
      ) : (
        <p className="card-hint">Set an amount and a payout window (after the purchase year) to see a quote.</p>
      )}
    </div>
  )
}

/** Funded-ratio card — shared with the Results page (step 4 of the plan). */
export function FundedRatioCard() {
  const { plan } = usePlan()
  const { result, deflate } = useProjection(plan)
  const startYear = result.startYear
  const fr = useMemo(() => {
    const primary = plan.household.people[0]
    const retirementYear =
      primary && primary.retirementAge !== null ? Number(primary.dob.slice(0, 4)) + primary.retirementAge : startYear
    return computeFundedRatio({
      years: result.years,
      startYear,
      deflate,
      curve: CURVE,
      fromYear: Math.max(retirementYear, startYear),
    })
  }, [plan, result, deflate, startYear])

  if (!fr) return null
  return (
    <div className="card">
      <h2>Funded ratio</h2>
      <p className="card-hint">
        Pension accounting for your household: essential spending valued on the TIPS curve vs. the guaranteed income
        dedicated to it. <LearnLink {...LEARN.fundedRatio} />
      </p>
      <div className="stat-grid">
        <div>
          <div className={`stat-value ${fr.fundedRatioPct >= 100 ? 'stat-value--good' : 'stat-value--neutral'}`}>
            {Math.round(fr.fundedRatioPct)}%
          </div>
          <div className="muted">of the essential floor is funded by guaranteed income</div>
        </div>
        <div>
          <div className="stat-value stat-value--sm">{fmtMoneyCompact(fr.essentialSpendingPv)}</div>
          <div className="muted">essential spending, valued today</div>
        </div>
        <div>
          <div className="stat-value stat-value--sm">{fmtMoneyCompact(fr.guaranteedIncomePv)}</div>
          <div className="muted">guaranteed income, valued today</div>
        </div>
        <div>
          <div className="stat-value stat-value--sm">{fmtMoneyCompact(fr.unfundedPv)}</div>
          <div className="muted">gap riding on the portfolio</div>
        </div>
      </div>
      <p className="card-hint">
        {plan.expenses.requiredAnnual === undefined
          ? 'Tip: you have not separated required spending from lifestyle on the Spending page, so the "floor" here is your whole budget and the ratio reads low.'
          : `Counted from ${fr.fromYear} through ${fr.toYear}, discounted at Treasury real yields as of ${CURVE.asOfIso}.`}
      </p>
    </div>
  )
}

function LivePricesCard() {
  const { plan } = usePlan()
  const startYear = currentStartYear()
  // Cache-first with zero network: a previously fetched/imported day shows
  // immediately; the fetch button only appears for a fresh look.
  const [snapshot, setSnapshot] = useState<FedInvestSnapshot | null>(() => readFedInvestCache())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ladders = plan.incomeFloor?.ladders
  const rungYears = useMemo(() => {
    const years = new Set<number>()
    for (const ladder of ladders ?? []) {
      for (let y = Math.max(ladder.startYear, startYear + 1); y <= ladder.endYear; y++) years.add(y)
    }
    return [...years].sort((a, b) => a - b)
  }, [ladders, startYear])

  if (!ladders || ladders.length === 0) return null

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await fetchFedInvestTips())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The price fetch failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Live TIPS prices (optional)</h2>
      <p className="card-hint">
        Your plan always works offline on the embedded yield curve. If you want to sanity-check the quote against real
        securities, this button asks the U.S. Treasury's FedInvest service for the latest end-of-day TIPS prices. It is
        the app's only network request, sends nothing but a date, and is cached on this device for the day.
      </p>
      {snapshot === null ? (
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch live prices from Treasury FedInvest'}
        </button>
      ) : (
        <>
          <p className="card-hint">
            {snapshot.priceDateIso === null
              ? `${snapshot.tips.length} TIPS from an imported file — dated by your download (the FedInvest CSV carries no date)`
              : `${snapshot.tips.length} TIPS priced ${snapshot.priceDateIso}`}{' '}
            — per $100 face, before inflation index ratio.
          </p>
          {/* An imported or previous-day snapshot is not fresh: keep the fetch available. */}
          {snapshot.source === 'import' || snapshot.priceDateIso !== latestPriceDateIso() ? (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void load()} disabled={loading}>
              {loading ? 'Fetching…' : 'Fetch the latest prices from Treasury FedInvest'}
            </button>
          ) : null}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rung year</th>
                  <th>Nearest real TIPS (CUSIP)</th>
                  <th>Coupon</th>
                  <th>Matures</th>
                  <th>End-of-day price</th>
                </tr>
              </thead>
              <tbody>
                {rungYears.map((year) => {
                  const match = nearestTipsForYear(snapshot.tips, year)
                  return (
                    <tr key={year}>
                      <td>{year}</td>
                      <td>{match ? match.cusip : '— none matures nearby —'}</td>
                      <td>{match ? `${match.ratePct.toFixed(3)}%` : ''}</td>
                      <td>{match ? match.maturityIso : ''}</td>
                      <td>{match ? match.endOfDayPrice.toFixed(2) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error ? (
        <>
          <p className="card-hint" role="alert">
            {error} Your plan still works on the embedded curve.
          </p>
          <p className="card-hint">
            Treasury's service does not allow direct browser requests from other sites (CORS), so the fetch can be
            blocked even when you are online. Zero-network alternative: download <code>securityprice.csv</code>{' '}
            yourself from{' '}
            <a href={FEDINVEST_PAGE_URL} target="_blank" rel="noreferrer">
              FedInvest
            </a>{' '}
            (pick the latest date, CSV format) and import it here.
          </p>
          <label className="btn btn-secondary btn-small">
            Import securityprice.csv
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void file.text().then(
                  (text) => {
                    try {
                      setSnapshot(importFedInvestCsv(text))
                      setError(null)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'That file could not be read.')
                    }
                  },
                  () => setError('That file could not be read.'),
                )
              }}
            />
          </label>
        </>
      ) : null}
    </div>
  )
}

export function IncomeFloorSection() {
  const { plan, update } = usePlan()
  const startYear = currentStartYear()
  const ladders = plan.incomeFloor?.ladders ?? []

  return (
    <section>
      <div className="card">
        <h2>TIPS ladders</h2>
        <p className="card-hint">
          A TIPS ladder turns a lump sum into guaranteed, inflation-adjusted income — a DIY real pension for a Social
          Security bridge or an essential-spending floor. Cash flows run through your full ledger with real TIPS
          taxation (federally ordinary, state-exempt, accretion taxed as it accrues).{' '}
          <LearnLink {...LEARN.tipsLadders} />
        </p>
        {ladders.map((ladder, i) => (
          <LadderRow key={ladder.id} ladder={ladder} index={i} startYear={startYear} />
        ))}
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const ladder: TipsLadder = {
                  id: crypto.randomUUID(),
                  name: 'Income floor ladder',
                  purpose: 'floor',
                  startYear: startYear + 1,
                  endYear: startYear + 20,
                  annualRealAmount: 12_000,
                }
                if (d.incomeFloor) d.incomeFloor.ladders.push(ladder)
                else d.incomeFloor = { ladders: [ladder] }
              })
            }
          >
            + TIPS ladder
          </button>
        </div>
        <p className="card-hint">
          Curve provenance: {CURVE.source}, as of {CURVE.asOfIso}. Looking for a bridge sized from your own benefit?
          The Social Security Optimizer has a one-click bridge panel. <LearnLink {...LEARN.socialSecurityBridge} />
        </p>
        <Issues />
      </div>

      <FundedRatioCard />
      <LivePricesCard />
      <LearnAboutScreen route="/plan/:planId/income-floor" />
    </section>
  )
}
