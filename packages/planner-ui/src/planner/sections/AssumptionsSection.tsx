/** Assumptions section: inflation, returns, taxes, asset classes. */

import { Link } from 'react-router-dom'

import type { AssetClassId } from '@retiregolden/engine/model/plan'
import { ASSET_CLASS_IDS } from '@retiregolden/engine/model/plan'
import { DEFAULT_ASSET_CLASS_PARAMS, resolveAssetClassParams } from '@retiregolden/engine/allocation/assetClasses'
import { LATEST_PACK_YEAR, TRUSTEES_DEFAULT_SS_HAIRCUT } from '@retiregolden/engine/params'
import { usePlan } from '../planContextCore'
import { provenanceSource } from '../provenanceLinks'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField } from '../fields'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LEARN } from '../learnLinks'
import { Issues } from './shared'

/**
 * Assumptions-level asset-class table: return / volatility / yield per class,
 * shown with the sourced defaults and editable as overrides. Only accounts
 * that opt into "Model asset classes" use these numbers.
 */
function AssetClassAssumptions() {
  const { plan, update } = usePlan()
  const resolved = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const hasOverrides = plan.assumptions.assetClassParams !== undefined
  type OverrideKey = 'returnPct' | 'volatilityPct' | 'interestYieldPct' | 'dividendYieldPct' | 'qualifiedRatioPct'
  const setParam = (id: AssetClassId, key: OverrideKey, v: number) =>
    update((d) => {
      const overrides = d.assumptions.assetClassParams ?? {}
      overrides[id] = { ...overrides[id], [key]: v }
      d.assumptions.assetClassParams = overrides
    })
  return (
    <>
      <h3>Asset classes</h3>
      <p className="card-hint">
        Used by accounts with "Model asset classes" turned on: growth blends these returns, Monte Carlo shocks each
        class with long-horizon historical volatility and correlations, and brokerage yields drive annual tax drag.
        Defaults are documented planning assumptions — edit them to match your own outlook.
        {hasOverrides ? (
          <>
            {' '}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => update((d) => void (d.assumptions.assetClassParams = undefined))}
            >
              Reset to defaults
            </button>
          </>
        ) : null}
      </p>
      {ASSET_CLASS_IDS.map((id) => {
        const p = resolved[id]
        const stockLike = id === 'usStocks' || id === 'intlStocks'
        return (
          <div key={id} className="nested-form-section" data-testid={`asset-class-${id}`}>
            <h4>{p.label}</h4>
            <div className="form-grid nested-control-grid">
              <PercentField label="Expected return" value={p.returnPct} onCommit={(v) => setParam(id, 'returnPct', v ?? DEFAULT_ASSET_CLASS_PARAMS[id].returnPct)} />
              <PercentField label="Volatility" help="Annual standard deviation of returns; drives the size of this class's Monte Carlo shocks." value={p.volatilityPct} min={0} onCommit={(v) => setParam(id, 'volatilityPct', v ?? DEFAULT_ASSET_CLASS_PARAMS[id].volatilityPct)} />
              {stockLike ? (
                <>
                  <PercentField label="Dividend yield" help="Distributed as dividends each year; taxable in a brokerage account." value={p.dividendYieldPct} min={0} onCommit={(v) => setParam(id, 'dividendYieldPct', v ?? DEFAULT_ASSET_CLASS_PARAMS[id].dividendYieldPct)} />
                  <PercentField label="Qualified share" help="Share of this class's dividends taxed at long-term capital-gain rates." value={p.qualifiedRatioPct} min={0} max={100} onCommit={(v) => setParam(id, 'qualifiedRatioPct', v ?? DEFAULT_ASSET_CLASS_PARAMS[id].qualifiedRatioPct)} />
                </>
              ) : (
                <PercentField label="Interest yield" help="Distributed as taxable interest each year in a brokerage account." value={p.interestYieldPct} min={0} onCommit={(v) => setParam(id, 'interestYieldPct', v ?? DEFAULT_ASSET_CLASS_PARAMS[id].interestYieldPct)} />
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

export function AssumptionsSection() {
  const { plan, update } = usePlan()
  const a = plan.assumptions
  return (
    <section>
      <div className="card">
        <h2>Assumptions</h2>
        <p className="card-hint">Sensible defaults; every projection is only as good as these. Monte Carlo varies returns and inflation around them.</p>
        <div className="form-grid">
          <PercentField
            label="Inflation"
            help="How fast prices rise each year. Results are shown in today's dollars, so this sets how much future dollars are discounted back."
            learn={LEARN.generalInflation}
            value={a.inflationPct}
            onCommit={(v) => update((d) => void (d.assumptions.inflationPct = v ?? 2.5))}
          />
          <PercentField
            label="Healthcare extra inflation"
            hint="On top of general inflation."
            help="Additional inflation applied to healthcare and Medicare costs."
            learn={LEARN.healthcareInflation}
            value={a.healthcareExtraInflationPct}
            onCommit={(v) => update((d) => void (d.assumptions.healthcareExtraInflationPct = v ?? 3))}
          />
          <PercentField
            label="Default return"
            hint="For accounts without their own."
            help="Assumed long-term nominal return rate for investment accounts."
            learn={LEARN.investmentReturns}
            value={a.defaultReturnPct}
            onCommit={(v) => update((d) => void (d.assumptions.defaultReturnPct = v ?? 5.5))}
          />
          <PercentField
            label="State effective tax (override)"
            help="Leave at 0 to use the modeled per-state brackets for your state(s) of residence. Set a flat rate above 0 to override the model everywhere — useful to correct a state, or to approximate a state that isn't modeled yet."
            hint="0 = use modeled state brackets."
            learn={LEARN.stateTaxOverride}
            source={provenanceSource('state-income-tax')}
            value={a.stateEffectiveTaxPct}
            min={0}
            max={20}
            onCommit={(v) => update((d) => void (d.assumptions.stateEffectiveTaxPct = v ?? 0))}
          />
          <PercentField
            label="Local income tax"
            help="Optional flat city/county income tax. When modeled state brackets are active, this applies to state taxable income; with the state override, it adds to the same flat override base."
            hint="For MD counties, NYC, OH municipalities."
            value={a.localIncomeTaxPct}
            min={0}
            max={10}
            onCommit={(v) => update((d) => void (d.assumptions.localIncomeTaxPct = v ?? 0))}
          />
          <MoneyField
            label="Recent annual MAGI"
            hint="Seeds IRMAA's two-year lookback."
            help="Used to seed the two-year lookback for Medicare premium calculations during your first two years."
            learn={LEARN.recentMagi}
            source={provenanceSource('medicare-irmaa')}
            value={a.recentAnnualMagi}
            onCommit={(v) => update((d) => void (d.assumptions.recentAnnualMagi = v ?? 0))}
          />
          <PercentField
            label="Safe withdrawal rate (SWR)"
            help="The percentage of your portfolio you assume is safe to withdraw in the first year of retirement, adjusted for inflation thereafter. For example, 4% is the common rule-of-thumb lens."
            learn={LEARN.fiNumber}
            value={a.safeWithdrawalRatePct ?? 4}
            min={0.1}
            onCommit={(v) => update((d) => void (d.assumptions.safeWithdrawalRatePct = v ?? 4))}
          />
          <SelectField
            label="Social Security COLA"
            help="How the annual cost-of-living adjustment is modeled: matched to general inflation, or set at a fixed rate."
            learn={LEARN.ssCola}
            value={a.ssCola.mode}
            options={[
              { value: 'matchInflation', label: 'Match inflation' },
              { value: 'fixed', label: 'Fixed rate' },
            ]}
            onCommit={(v) =>
              update((d) => {
                d.assumptions.ssCola = v === 'fixed' ? { mode: 'fixed', annualPct: 2 } : { mode: 'matchInflation' }
              })
            }
          />
          {a.ssCola.mode === 'fixed' ? (
            <PercentField
              label="COLA rate"
              help="The annual cost-of-living adjustment rate."
              learn={LEARN.ssCola}
              value={a.ssCola.annualPct}
              onCommit={(v) => update((d) => void (d.assumptions.ssCola = { mode: 'fixed', annualPct: v ?? 2 }))}
            />
          ) : null}
          <PercentField
            label="Heir tax rate"
            help="Assumed tax rate heirs pay on inherited traditional pre-tax balances, used for the after-tax estate metric."
            learn={LEARN.heirTaxRate}
            value={a.heirTaxRatePct}
            min={0}
            max={50}
            onCommit={(v) => update((d) => void (d.assumptions.heirTaxRatePct = v ?? 25))}
          />
          <CheckboxField
            label="Override heir tax by account class"
            help="Set different heir tax rates for traditional and HSA accounts instead of applying the flat rate to all pre-tax balances. For example, a higher-income heir might face a 32% marginal rate on inherited traditional IRA distributions but only 22% on a modest HSA."
            value={a.heirTaxByClass !== undefined}
            onCommit={(v) =>
              update((d) => void (d.assumptions.heirTaxByClass = v ? { traditional: d.assumptions.heirTaxRatePct, hsa: d.assumptions.heirTaxRatePct } : undefined))
            }
          />
          {a.heirTaxByClass !== undefined ? (
            <>
              <PercentField
                label="Traditional heir tax"
                help="Tax rate heirs pay on inherited traditional IRA/401(k) balances. Overrides the flat heir tax rate for this account class."
                value={a.heirTaxByClass.traditional ?? a.heirTaxRatePct}
                min={0}
                max={50}
                onCommit={(v) =>
                  update((d) => {
                    if (!d.assumptions.heirTaxByClass) return
                    d.assumptions.heirTaxByClass.traditional = v ?? undefined
                  })
                }
              />
              <PercentField
                label="HSA heir tax"
                help="Tax rate heirs pay on inherited HSA balances (non-spouse beneficiary). Overrides the flat heir tax rate for this account class."
                value={a.heirTaxByClass.hsa ?? a.heirTaxRatePct}
                min={0}
                max={50}
                onCommit={(v) =>
                  update((d) => {
                    if (!d.assumptions.heirTaxByClass) return
                    d.assumptions.heirTaxByClass.hsa = v ?? undefined
                  })
                }
              />
            </>
          ) : null}
        </div>

        <AssetClassAssumptions />

        <h3>Social Security trust fund</h3>
        <div className="form-grid">
          <CheckboxField
            label="Model a benefit cut"
            hint="Trustees project depletion around 2034 absent action."
            help="Model a benefit cut if the Social Security trust fund exhausts reserves."
            learn={LEARN.ssTrustFund}
            source={provenanceSource('social-security')}
            value={a.ssHaircut !== null}
            onCommit={(v) => update((d) => void (d.assumptions.ssHaircut = v ? { ...TRUSTEES_DEFAULT_SS_HAIRCUT } : null))}
          />
          {a.ssHaircut ? (
            <>
              <NumberField label="From year" value={a.ssHaircut.fromYear} min={1900} max={2200} onCommit={(v) => update((d) => void (d.assumptions.ssHaircut!.fromYear = Math.round(v ?? TRUSTEES_DEFAULT_SS_HAIRCUT.fromYear)))} />
              <PercentField label="Cut" value={a.ssHaircut.cutPct} min={0} max={100} onCommit={(v) => update((d) => void (d.assumptions.ssHaircut!.cutPct = v ?? TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct))} />
            </>
          ) : null}
        </div>

        <p className="card-hint">
          Tax brackets, contribution limits, RMD factors, Medicare/IRMAA, and per-state rules come from published{' '}
          {LATEST_PACK_YEAR} figures. <Link to="/disclaimer">See where the numbers come from →</Link>{' '}
          <Link to={`/plan/${plan.id}/assumptions-card`}>See every live assumption on one card →</Link>
        </p>
        <Issues />

        <LearnAboutScreen route="/plan/:planId/assumptions" limit={10} />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Insurance (roadmap V6)
// ---------------------------------------------------------------------------

