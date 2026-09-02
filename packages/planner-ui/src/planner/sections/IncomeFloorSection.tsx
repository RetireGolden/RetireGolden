/**
 * Income floor section (social-security-bridge-and-tips-ladder): TIPS ladders
 * as plan artifacts — build a level real income floor or a Social Security
 * bridge, see its buy-list and quoted cost on the embedded real-yield curve,
 * read the funded ratio, and (opt-in only) sanity-check against live Treasury
 * FedInvest prices.
 */

import { useMemo, useState } from 'react'

import type { TipsLadder } from '@retiregolden/engine/model/plan'
import { EMBEDDED_REAL_YIELD_CURVE } from '@retiregolden/engine/params'
import { buildLadder, type LadderBuild } from '@retiregolden/engine/ladder/ladderMath'
import { computeFundedRatio } from '@retiregolden/engine/ladder/fundedRatio'
import {
  FEDINVEST_PAGE_URL,
  latestPriceDateIso,
  nearestTipsForYear,
  type FedInvestSnapshot,
} from '@retiregolden/engine/ladder/fedInvest'
import { fetchFedInvestTips, importFedInvestCsv, readFedInvestCache } from '../../data/fedInvestClient'
import {
  IMPORT_PENDING_MESSAGE,
  IMPORT_UNAVAILABLE_MESSAGE,
  useImportAvailability,
} from '../../import/importAvailability'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { usePlan } from '../planContextCore'
import { provenanceSource } from '../provenanceLinks'
import { CheckboxField, MoneyField, NumberField, SelectField, TextField } from '../fields'
import { fmtMoney, fmtMoneyCompact } from '../format'
import { currentStartYear, useProjection } from '../useProjection'
import { IssueSectionsSentence, Issues } from './shared'
import { hasIssueAt, hasIssueUnder, withoutIssuesBeyond } from '../validationIssues'
import { ScrollRegion } from '../ScrollRegion'

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

function LadderRow({ ladder, startYear }: { ladder: TipsLadder; startYear: number }) {
  const { plan, update, issues } = usePlan()
  // The ladder is addressed by id, not by the position it was mapped at: the
  // issue paths carry the index this ladder holds in the plan the issues
  // were computed from, which is the plan in hand, so the lookup is made
  // against that same plan at render time.
  const ladders = plan.incomeFloor?.ladders ?? []
  const ladderIndex = ladders.findIndex((l) => l.id === ladder.id)
  // Belt and braces for the index coupling: an issue whose ladder index the
  // current list does not have is ignored rather than matched to any row.
  const ladderIssues = withoutIssuesBeyond(issues, ['incomeFloor', 'ladders'], ladders.length)
  // An invalid edit (last payout year before the first) used to swap the
  // quote for the empty-state hint as if nothing had been entered; the quote
  // pauses and says why instead (#512). Scoped to this ladder: the quote
  // prices the ladder's rungs on the embedded curve and reads nothing else
  // from the plan, so another entry's issue does not touch it. An issue on
  // the ladder list itself (or on incomeFloor) pauses every ladder.
  const ownIssue = ladderIndex >= 0 && hasIssueUnder(ladderIssues, ['incomeFloor', 'ladders', String(ladderIndex)])
  const listIssue = ladderIndex < 0 || hasIssueAt(ladderIssues, ['incomeFloor']) || hasIssueAt(ladderIssues, ['incomeFloor', 'ladders'])
  const onHold = ownIssue || listIssue
  // The path an issue for this row's fields is reported at, from the same
  // index the lookups above use; a row the plan does not hold has no path.
  const fieldPath = (leaf: string) => (ladderIndex >= 0 ? `incomeFloor.ladders.${ladderIndex}.${leaf}` : undefined)
  const quote = useMemo(() => (onHold ? null : quoteLadder(ladder, startYear)), [ladder, startYear, onHold])
  const fundingOptions = plan.accounts
    .filter((a) => a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp')
    .map((a) => ({ value: a.id, label: a.name }))
  const edit = (fn: (l: TipsLadder) => void) =>
    update((d) => {
      const l = d.incomeFloor?.ladders.find((candidate) => candidate.id === ladder.id)
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
          onClick={() =>
            update((d) => {
              const at = d.incomeFloor?.ladders.findIndex((l) => l.id === ladder.id) ?? -1
              if (at >= 0) d.incomeFloor?.ladders.splice(at, 1)
            })
          }
        >
          Remove
        </button>
      </div>
      <div className="form-grid">
        <TextField label="Name" path={fieldPath('name')} value={ladder.name} onCommit={(v) => edit((l) => void (l.name = v || 'TIPS ladder'))} />
        <SelectField
          label="Purpose"
          help="Labeling only: a bridge covers the years until a delayed Social Security claim; a floor covers essential spending. The math is the same."
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
          path={fieldPath('annualRealAmount')}
          value={ladder.annualRealAmount}
          onCommit={(v) => edit((l) => void (l.annualRealAmount = Math.max(0, v ?? 0)))}
        />
        <NumberField
          label="First payout year"
          path={fieldPath('startYear')}
          value={ladder.startYear}
          onCommit={(v) => edit((l) => void (l.startYear = Math.round(v ?? l.startYear)))}
        />
        <NumberField
          label="Last payout year"
          path={fieldPath('endYear')}
          value={ladder.endYear}
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
              path={fieldPath('purchase.year')}
              value={ladder.purchase.year}
              onCommit={(v) => edit((l) => void (l.purchase && (l.purchase.year = Math.round(v ?? l.purchase.year))))}
            />
          </>
        ) : null}
      </div>
      {onHold ? (
        <div className="callout callout--warn" role="status">
          {ownIssue ? (
            <>
              Quote paused: an entry on this ladder is invalid, so it cannot be priced yet. The issue list at the end of
              this section names the field; the last quoted cost no longer applies.
            </>
          ) : (
            <>
              Quote paused: the ladder list itself has an issue to fix before any ladder can be priced; this ladder's
              own entries may be fine. The issue list at the end of this section names it; the last quoted cost no
              longer applies.
            </>
          )}
        </div>
      ) : quote ? (
        <>
          <p className="card-hint">
            Quoted cost <strong>{fmtMoney(quote.totalCost)}</strong> (today's $) for {quote.rungs.length} rung
            {quote.rungs.length === 1 ? '' : 's'}, real yields as of {CURVE.asOfIso}. That's{' '}
            {((ladder.annualRealAmount / quote.totalCost) * 100).toFixed(2)}% of cost per year, inflation-protected.
          </p>
          <details>
            <summary>Buy-list (planning-grade)</summary>
            <ScrollRegion label={`Buy-list: ${ladder.name}`}>
              <table className="year-table">
                <thead>
                  <tr>
                    <th scope="col">Matures</th>
                    <th scope="col">Face (today's $)</th>
                    <th scope="col">Coupon</th>
                    <th scope="col">Est. cost</th>
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
            </ScrollRegion>
            <p className="card-hint">
              Execute at your brokerage or TreasuryDirect. RetireGolden never places orders. Annual coupons and par-rung
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

function FundedRatioIntro() {
  return (
    <>
      <h2>Funded ratio</h2>
      <p className="card-hint">
        Pension accounting for your household: essential spending valued on the TIPS curve vs. the guaranteed income
        dedicated to it. <LearnLink {...LEARN.fundedRatio} />
      </p>
    </>
  )
}

/**
 * Funded-ratio card, shared with the Results page (step 4 of the plan).
 *
 * The ratio is read off a full projection, so while any entry in the plan is
 * invalid (a ladder's, or one on another page) that projection would run on a
 * plan the engine has refused to store. The card then pauses without
 * projecting at all: the readout component, which owns the projection hook,
 * is not mounted, so an invalid draft can neither throw out of the card nor
 * leave it empty (#512). Shared with Results, where no issue list renders,
 * so the copy names and links the sections the failing entries live on.
 */
export function FundedRatioCard() {
  const { issues } = usePlan()
  if (issues.length === 0) return <FundedRatioReadout />
  return (
    <div className="card">
      <FundedRatioIntro />
      <div className="callout callout--warn" role="status">
        Paused while the plan has {issues.length === 1 ? 'an issue' : `${issues.length} issues`} to fix, which may be
        anywhere in the plan: the ratio is read off a full projection, and a projection is not re-run on a plan the
        engine will not store, so the last readout no longer applies. <IssueSectionsSentence />
      </div>
    </div>
  )
}

/** The live readout: projects the (valid) plan and renders nothing when it has no measurable essential spending. */
function FundedRatioReadout() {
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
      <FundedRatioIntro />
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

export function LivePricesCard() {
  const { plan } = usePlan()
  const { enabled: importEnabled, resolved: importResolved } = useImportAvailability()
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
        the app's only cross-origin request, sends nothing but a date, and is cached on this device for the day.
      </p>
      {snapshot === null ? (
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch live prices from Treasury FedInvest'}
        </button>
      ) : (
        <>
          <p className="card-hint">
            {snapshot.priceDateIso === null
              ? `${snapshot.tips.length} TIPS from an imported file, dated by your download (the FedInvest CSV carries no date)`
              : `${snapshot.tips.length} TIPS priced ${snapshot.priceDateIso}`}. Prices are per $100 face, before the
            inflation index ratio.
          </p>
          {/* An imported or previous-day snapshot is not fresh: keep the fetch available. */}
          {snapshot.source === 'import' || snapshot.priceDateIso !== latestPriceDateIso() ? (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void load()} disabled={loading}>
              {loading ? 'Fetching…' : 'Fetch the latest prices from Treasury FedInvest'}
            </button>
          ) : null}
          <ScrollRegion label="Nearest real TIPS per rung" grow style={{ border: 'none' }}>
            <table className="year-table">
              <thead>
                <tr>
                  <th scope="col">Rung year</th>
                  <th scope="col" className="year-table-text">Nearest real TIPS (CUSIP)</th>
                  <th scope="col">Coupon</th>
                  <th scope="col" className="year-table-text">Matures</th>
                  <th scope="col">End-of-day price</th>
                </tr>
              </thead>
              <tbody>
                {rungYears.map((year) => {
                  const match = nearestTipsForYear(snapshot.tips, year)
                  return (
                    <tr key={year}>
                      <td>{year}</td>
                      <td className="year-table-text">{match ? match.cusip : '— none matures nearby —'}</td>
                      <td>{match ? `${match.ratePct.toFixed(3)}%` : ''}</td>
                      <td className="year-table-text">{match ? match.maturityIso : ''}</td>
                      <td>{match ? match.endOfDayPrice.toFixed(2) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollRegion>
        </>
      )}
      {error ? (
        <>
          <p className="card-hint" role="alert">
            {error} Your plan still works on the embedded curve.
          </p>
          {importEnabled ? (
            <>
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
          ) : importResolved ? (
            <p className="card-hint" role="status">
              {IMPORT_UNAVAILABLE_MESSAGE}
            </p>
          ) : (
            <p className="card-hint" role="status">
              {IMPORT_PENDING_MESSAGE}
            </p>
          )}
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
          A TIPS ladder turns a lump sum into guaranteed, inflation-adjusted income: a DIY real pension for a Social
          Security bridge or an essential-spending floor. Cash flows run through your full ledger with real TIPS
          taxation (federally ordinary, state-exempt, accretion taxed as it accrues).{' '}
          <LearnLink {...LEARN.tipsLadders} />
        </p>
        {ladders.map((ladder) => (
          <LadderRow key={ladder.id} ladder={ladder} startYear={startYear} />
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
        <Issues section="income-floor" />
      </div>

      <FundedRatioCard />
      <LivePricesCard />
      <LearnAboutScreen route="/plan/:planId/income-floor" />
    </section>
  )
}
