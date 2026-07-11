/** Strategy section: withdrawal order, Roth conversions, rebalancing. */

import { useId } from 'react'

import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, SelectField } from '../fields'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { fmtMoney } from '../format'
import { provenanceSource } from '../provenanceLinks'
import { Issues } from './shared'

/**
 * Full account-order detail for each withdrawal mode, shown as a hint under
 * the Order select. The option labels stay short so the closed control reads
 * cleanly at the default column width (the long labels used to clip).
 */
const WITHDRAWAL_ORDER_HINTS = {
  sequential: 'Drains cash → taxable → vested equity comp → traditional → Roth, keeping HSA for last.',
  proportional: 'Draws pro-rata across cash, taxable, vested equity comp, traditional, and Roth; HSA last.',
  bracketTargeted:
    'Fills traditional up to the target bracket first, then cash → taxable → vested equity comp → Roth, then traditional again; HSA last.',
} as const

export function StrategySection() {
  const { plan, update } = usePlan()
  const w = plan.strategies.withdrawalOrder
  const rc = plan.strategies.rothConversion
  const orderDetailId = useId()
  const thisYear = new Date().getFullYear()
  return (
    <section>
      <div className="card">
        <h2>Withdrawal strategy</h2>
        <p className="card-hint">How the engine drains accounts when spending exceeds income. RMDs always come first.</p>
        <div className="form-grid">
          <SelectField
            label="Order"
            help="Sets which accounts fund spending that income doesn't cover. The order changes when taxes fall due: pre-tax withdrawals add ordinary income now, while Roth and cash come out tax-free."
            learn={LEARN.withdrawalOrder}
            describedBy={orderDetailId}
            value={w.mode}
            options={[
              { value: 'sequential', label: 'Sequential' },
              { value: 'proportional', label: 'Proportional' },
              { value: 'bracketTargeted', label: 'Bracket-targeted' },
            ]}
            onCommit={(v) =>
              update((d) => {
                d.strategies.withdrawalOrder = v === 'bracketTargeted' ? { mode: v, bracketPct: 22 } : { mode: v }
              })
            }
          />
          {w.mode === 'bracketTargeted' ? (
            <NumberField
              label="Target bracket"
              help="Higher brackets tax each extra dollar more; this caps how much ordinary income the strategy realizes each year."
              hint="Fill ordinary income to the top of this bracket."
              learn={LEARN.marginalVsEffective}
              value={w.bracketPct}
              suffix="%"
              onCommit={(v) => update((d) => void (d.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: v ?? 22 }))}
            />
          ) : null}
          <MoneyField
            label="Taxable safety-net floor"
            help="An optional minimum cash + taxable reserve (today's dollars) the plan tries to keep liquid. Spending is funded from other accounts first so this cushion stays intact, and fill-to-target Roth conversions are trimmed so their tax bill never forces you below the floor. It is only dipped into as a last resort. Leave blank for no floor."
            hint="Blank = no floor."
            value={plan.strategies.taxableSafetyNetFloor ?? null}
            allowNull
            onCommit={(v) => update((d) => void (d.strategies.taxableSafetyNetFloor = v ?? undefined))}
          />
          {plan.household.people.length === 2 ? (
            <MoneyField
              label="Survivor reserve target (today's $)"
              help="The minimum investable balance the surviving spouse should have in the first survivor year, in today's dollars (deflated by inflation). Used as a hard constraint by the decision engine's protect-survivor-liquidity objective — candidates whose survivor-year investable falls below this target are disqualified. Leave blank for no reserve constraint."
              hint="Blank = no survivor reserve constraint."
              value={plan.strategies.survivorReserveTarget ?? null}
              allowNull
              onCommit={(v) => update((d) => void (d.strategies.survivorReserveTarget = v ?? undefined))}
            />
          ) : null}
        </div>
        {/* Always-visible account-order detail for the selected mode: the option
            labels are short so the closed select never clips, and this line keeps
            the full order on screen without opening the ⓘ bubble. The select
            points here via aria-describedby so the detail is announced on focus,
            not only when it changes. */}
        <p className="card-hint" id={orderDetailId} aria-live="polite">
          {WITHDRAWAL_ORDER_HINTS[w.mode]}
        </p>
      </div>

      <div className="card">
        <h2>Roth conversions</h2>
        <p className="card-hint">
          Taxes on conversions ride the normal withdrawal flow (cash/taxable first). Watch the IRMAA and ACA effects in
          Results. <LearnLink {...LEARN.whyConversionsRaiseCosts} />
        </p>
        <div className="form-grid">
          <SelectField
            label="Mode"
            help="Roth conversions move money from a pre-tax account into Roth, adding taxable income now to cut future taxes and RMDs."
            learn={LEARN.rothConversionBasics}
            value={rc.mode}
            options={[
              { value: 'none', label: 'No conversions' },
              { value: 'manual', label: 'Manual amounts per year' },
              { value: 'fillToTarget', label: 'Fill to a target each year' },
              // Display-only: set from the Optimize tab. Picking any other mode
              // takes manual control and discards the optimized schedule.
              ...(rc.mode === 'optimized' ? [{ value: 'optimized', label: 'Optimized (from the Optimize tab)' }] : []),
            ]}
            onCommit={(v) =>
              update((d) => {
                if (v === 'optimized') return // no-op; optimized is produced in the Optimize tab
                d.strategies.rothConversion =
                  v === 'none'
                    ? { mode: 'none' }
                    : v === 'manual'
                      ? { mode: 'manual', conversions: [{ year: thisYear + 1, amount: 50_000 }] }
                      : { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: thisYear + 1, endYear: thisYear + 10 }
              })
            }
          />
        </div>
        {rc.mode === 'optimized' ? (
          <div className="callout callout--info">
            This {rc.conversions.length}-year schedule (
            {fmtMoney(rc.conversions.reduce((a, c) => a + c.amount, 0))} total) was produced by the{' '}
            <strong>Optimize</strong> tab. Re-run or tune it there, choose <em>Accept as manual</em> to edit the amounts
            here, or pick another mode above to take manual control.
          </div>
        ) : null}
        {rc.mode === 'manual' ? (
          <>
            {rc.conversions.map((c, i) => (
              <div className="item-row" key={i}>
                <div className="item-row-head">
                  <span className="item-row-title"><span className="type-chip">Convert</span>{c.year}</span>
                  <button
                    type="button"
                    className="btn-ghost btn-ghost-danger"
                    onClick={() =>
                      update((d) => {
                        const m = d.strategies.rothConversion
                        if (m.mode === 'manual') m.conversions.splice(i, 1)
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="form-grid">
                  <NumberField
                    label="Year"
                    value={c.year}
                    min={1900}
                    max={2200}
                    onCommit={(v) =>
                      update((d) => {
                        const m = d.strategies.rothConversion
                        if (m.mode === 'manual') m.conversions[i]!.year = Math.round(v ?? c.year)
                      })
                    }
                  />
                  <MoneyField
                    label="Amount"
                    value={c.amount}
                    onCommit={(v) =>
                      update((d) => {
                        const m = d.strategies.rothConversion
                        if (m.mode === 'manual') m.conversions[i]!.amount = v ?? 0
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <div className="add-row">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  update((d) => {
                    const m = d.strategies.rothConversion
                    if (m.mode === 'manual') {
                      const last = m.conversions[m.conversions.length - 1]
                      m.conversions.push({ year: (last?.year ?? thisYear) + 1, amount: last?.amount ?? 50_000 })
                    }
                  })
                }
              >
                + Year
              </button>
            </div>
          </>
        ) : null}
        {rc.mode === 'fillToTarget' ? (
          <div className="form-grid">
            <SelectField
              label="Target"
              help="Each year, convert just enough to reach this ceiling — a bracket top, an IRMAA tier, the ACA cliff, or a fixed MAGI."
              learn={LEARN.fillingTaxBracket}
              source={provenanceSource(
                rc.target === 'irmaaTier' ? 'medicare-irmaa' : rc.target === 'acaCliff' ? 'aca-ptc' : 'federal-brackets',
              )}
              value={rc.target}
              options={[
                { value: 'topOfBracket', label: 'Top of tax bracket' },
                { value: 'irmaaTier', label: 'IRMAA tier edge' },
                { value: 'acaCliff', label: 'ACA 400% FPL cliff' },
                { value: 'fixedMagi', label: 'Fixed MAGI' },
              ]}
              onCommit={(v) =>
                update((d) => {
                  const m = d.strategies.rothConversion
                  if (m.mode === 'fillToTarget') {
                    m.target = v
                    m.targetValue = v === 'topOfBracket' ? 22 : v === 'irmaaTier' ? 1 : v === 'fixedMagi' ? 150_000 : null
                  }
                })
              }
            />
            {rc.target !== 'acaCliff' ? (
              <NumberField
                label={rc.target === 'topOfBracket' ? 'Bracket (%)' : rc.target === 'irmaaTier' ? 'Tier index' : 'MAGI ($)'}
                value={rc.targetValue}
                allowNull
                onCommit={(v) =>
                  update((d) => {
                    const m = d.strategies.rothConversion
                    if (m.mode === 'fillToTarget') m.targetValue = v
                  })
                }
              />
            ) : null}
            <NumberField
              label="Start year"
              value={rc.startYear}
              min={1900}
              max={2200}
              onCommit={(v) =>
                update((d) => {
                  const m = d.strategies.rothConversion
                  if (m.mode === 'fillToTarget') m.startYear = Math.round(v ?? thisYear)
                })
              }
            />
            <NumberField
              label="End year"
              value={rc.endYear}
              min={1900}
              max={2200}
              onCommit={(v) =>
                update((d) => {
                  const m = d.strategies.rothConversion
                  if (m.mode === 'fillToTarget') m.endYear = Math.round(v ?? thisYear + 10)
                })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Charitable giving</h2>
        <div className="form-grid">
          <MoneyField
            label="QCD per year (today's $)"
            help="A qualified charitable distribution sends IRA money straight to charity from age 70½. It counts toward your RMD but never appears in taxable income — usually better than a deductible cash gift once you take the standard deduction."
            learn={LEARN.qcd}
            source={provenanceSource('rmd-qcd')}
            hint="Routed out of RMDs from age 70½; excluded from income."
            value={plan.strategies.qcdAnnual}
            onCommit={(v) => update((d) => void (d.strategies.qcdAnnual = v ?? 0))}
          />
        </div>
        <Issues />
      </div>

      <div className="card">
        <h2>Itemized deductions</h2>
        <p className="card-hint">
          Federal tax uses the larger of these and the standard deduction. Most retirees take the standard deduction —
          turn this on only if your deductible taxes, mortgage interest, and charitable gifts together exceed it. Enter
          today's dollars.
        </p>
        <div className="form-grid">
          <CheckboxField
            label="Itemize deductions"
            help="When on, the projection compares your itemized total (SALT capped at the current-law limit) against the standard deduction each year and uses whichever is larger. The OBBBA senior deduction still applies on top either way."
            learn={LEARN.itemizedDeductions}
            value={plan.strategies.itemizedDeductions !== undefined}
            onCommit={(v) =>
              update((d) => void (d.strategies.itemizedDeductions = v ? { stateAndLocalTaxes: 0, mortgageInterest: 0, charitable: 0 } : undefined))
            }
          />
        </div>
        {plan.strategies.itemizedDeductions ? (
          <div className="form-grid">
            <MoneyField
              label="State & local taxes (SALT)"
              hint="State income + property tax; capped at the current-law SALT limit."
              value={plan.strategies.itemizedDeductions.stateAndLocalTaxes}
              onCommit={(v) => update((d) => { if (d.strategies.itemizedDeductions) d.strategies.itemizedDeductions.stateAndLocalTaxes = v ?? 0 })}
            />
            <MoneyField
              label="Mortgage interest"
              value={plan.strategies.itemizedDeductions.mortgageInterest}
              onCommit={(v) => update((d) => { if (d.strategies.itemizedDeductions) d.strategies.itemizedDeductions.mortgageInterest = v ?? 0 })}
            />
            <MoneyField
              label="Charitable gifts"
              value={plan.strategies.itemizedDeductions.charitable}
              onCommit={(v) => update((d) => { if (d.strategies.itemizedDeductions) d.strategies.itemizedDeductions.charitable = v ?? 0 })}
            />
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Capital loss carryforward</h2>
        <p className="card-hint">
          Net capital losses you're carrying from prior years' tax returns (Schedule D line 16). The plan nets them
          against future realized gains first, then deducts up to $3,000/yr against other income, until used up —
          lowering tax and AGI (and the IRMAA/ACA costs AGI drives) in early-retirement years spent drawing down a
          brokerage. Most users leave this at $0. <LearnLink {...LEARN.lossHarvesting} />
        </p>
        <div className="form-grid">
          <MoneyField
            label="Capital loss carryforward"
            help="The net capital loss carried into this plan's first year, in today's dollars. Treated as flat nominal (capital losses don't index). Nets against realized gains first, then up to $3,000/yr against other income."
            value={plan.household.capitalLossCarryforward}
            onCommit={(v) => update((d) => void (d.household.capitalLossCarryforward = Math.max(0, v ?? 0)))}
          />
        </div>
      </div>

      <LearnAboutScreen route="/plan/:planId/strategy" />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

