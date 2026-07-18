/**
 * Curated example plan registry — single source of truth for library demos.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { buildBracketFillRoth } from './buildBracketFillRoth'
import { buildEarlyRetireeAca } from './buildEarlyRetireeAca'
import { buildExampleCouple } from './buildExampleCouple'
import { buildLtcShock } from './buildLtcShock'
import { buildMovingStateTax } from './buildMovingStateTax'
import { buildRmdIrmaa } from './buildRmdIrmaa'
import { buildSurvivorYears } from './buildSurvivorYears'
import { buildUnderSavedSingle } from './buildUnderSavedSingle'
import { buildEarlyCareerMatch } from './buildEarlyCareerMatch'
import { buildAggressiveSaver } from './buildAggressiveSaver'
import { buildCoastFire } from './buildCoastFire'
import { buildBaristaFire } from './buildBaristaFire'
import { buildBridgeEarlyRetirement } from './buildBridgeEarlyRetirement'
import { buildLeanFatFire } from './buildLeanFatFire'
import { buildHsaStealthRetirement } from './buildHsaStealthRetirement'
import { buildSalaryGrowthEscalation } from './buildSalaryGrowthEscalation'
import { buildGuardrailsFlex } from './buildGuardrailsFlex'
import { buildAnnuityEstate } from './buildAnnuityEstate'
import { buildGlidepathAllocation } from './buildGlidepathAllocation'
import { buildHsaPropertyDepth } from './buildHsaPropertyDepth'
import { buildFixedTargetSpending } from './buildFixedTargetSpending'
import { buildNoAnnuityBrokerage } from './buildNoAnnuityBrokerage'
import { buildStaticAllocationControl } from './buildStaticAllocationControl'
import { buildBrokerageNoHsa } from './buildBrokerageNoHsa'
import { buildAll401kNoBridge } from './buildAll401kNoBridge'
import { buildBrokerageBridge401k } from './buildBrokerageBridge401k'
import { buildNoHeadStartGrad } from './buildNoHeadStartGrad'
import { buildTrumpAccountHeadStart } from './buildTrumpAccountHeadStart'

export type ExampleTheme =
  | 'overview'
  | 'shortfall'
  | 'roth-conversions'
  | 'aca'
  | 'rmd-irmaa'
  | 'survivor'
  | 'state-tax'
  | 'ltc'
  | 'fire'
  | 'accumulation'
  | 'coast-fire'
  | 'barista-fire'
  | 'guardrails'
  | 'annuity-estate'
  | 'allocation'
  | 'hsa-depth'

export interface ExamplePlan {
  id: string
  title: string
  summary: string
  teaches: string
  themeTags: ExampleTheme[]
  learnSlug: string
  /** Optional in-preview hint — phrased qualitatively to survive parameter updates. */
  lookFor?: string
  build: () => Plan
}

export const EXAMPLE_PLANS: ExamplePlan[] = [
  {
    id: 'example-couple',
    title: 'Example couple',
    summary: 'Married couple two years from retirement with diversified accounts.',
    teaches: 'The full picture — accounts, Social Security, Roth strategy, insurance, and scenarios.',
    themeTags: ['overview'],
    learnSlug: 'example-couple',
    lookFor: 'How Roth conversions, RMDs, and LTC care interact across a long horizon.',
    build: buildExampleCouple,
  },
  {
    id: 'under-saved-single',
    title: 'Under-saved single retiree',
    summary: 'Single retiree with modest savings and steady spending.',
    teaches: 'When spending outpaces savings — watch the depletion year and shortfall warnings.',
    themeTags: ['shortfall'],
    learnSlug: 'example-under-saved-single',
    lookFor: 'The year investable assets run out and how Social Security changes the cash-flow picture.',
    build: buildUnderSavedSingle,
  },
  {
    id: 'bracket-fill-roth',
    title: 'Bracket-fill Roth conversions',
    summary: 'Retired couple with large traditional balances and a fill-to-bracket strategy.',
    teaches: 'Converting up to a bracket top — lifetime tax vs ending Roth balance.',
    themeTags: ['roth-conversions'],
    learnSlug: 'example-bracket-fill-roth',
    lookFor: 'Annual conversion amounts, RMDs, and how QCDs offset taxable income.',
    build: buildBracketFillRoth,
  },
  {
    id: 'early-retiree-aca',
    title: 'Early retiree & the ACA cliff',
    summary: 'Pre-65 retiree with consulting income and marketplace coverage.',
    teaches: 'How MAGI affects ACA credits — and why a Roth conversion can cost more than the tax bill.',
    themeTags: ['aca'],
    learnSlug: 'example-early-retiree-aca',
    lookFor: 'Healthcare premiums before Medicare and warnings when MAGI crosses the subsidy cliff.',
    build: buildEarlyRetireeAca,
  },
  {
    id: 'rmd-irmaa',
    title: 'High balances: RMDs & IRMAA',
    summary: 'High-net-worth single retiree with a large IRA.',
    teaches: 'Large traditional balances drive RMDs that can push MAGI into IRMAA tiers.',
    themeTags: ['rmd-irmaa'],
    learnSlug: 'example-rmd-irmaa',
    lookFor: 'RMD amounts, QCD relief, and Medicare surcharge years in the results ledger.',
    build: buildRmdIrmaa,
  },
  {
    id: 'survivor-years',
    title: 'Survivor years (widow\'s penalty)',
    summary: 'Couple with unequal Social Security and a pension with survivor benefits.',
    teaches: 'After the first death, single tax brackets and survivor benefits can raise taxes.',
    themeTags: ['survivor'],
    learnSlug: 'example-survivor-years',
    lookFor: 'The tax year when filing status effectively shifts and survivor Social Security steps up.',
    build: buildSurvivorYears,
  },
  {
    id: 'moving-state-tax',
    title: 'Moving in retirement (state tax)',
    summary: 'Consultant relocating from Florida to Kentucky mid-plan.',
    teaches: 'A state move changes lifetime tax even when federal income stays the same.',
    themeTags: ['state-tax'],
    learnSlug: 'example-moving-state-tax',
    lookFor: 'Compare the base plan vs scenarios for state-tax differences after the move year.',
    build: buildMovingStateTax,
  },
  {
    id: 'ltc-shock',
    title: 'Long-term-care shock',
    summary: 'Retiree with LTC insurance facing a multi-year care episode.',
    teaches: 'How a care shock drains assets — and how insurance offsets the hit.',
    themeTags: ['ltc'],
    learnSlug: 'example-ltc-shock',
    lookFor: 'Care-event years in Results and the difference insurance makes to ending net worth.',
    build: buildLtcShock,
  },
  {
    id: 'early-career-match',
    title: 'Just getting started',
    summary: 'Young professional beginning their career with employer match capture and Roth IRA savings.',
    teaches: 'Capturing employer match, compounding over time, and basic tax diversification.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-early-career-match',
    lookFor: 'Capture the employer 401(k) match, fund a Roth IRA, and watch wages grow.',
    build: buildEarlyCareerMatch,
  },
  {
    id: 'aggressive-saver',
    title: 'Aggressive saver to early retirement',
    summary: 'High-income saver achieving early retirement in 15 years with a 50% savings rate.',
    teaches: 'The power of a high savings rate, FI targets, and escalating contribution schedules.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-aggressive-saver',
    lookFor: 'FI target progress and escalating taxable brokerage contributions.',
    build: buildAggressiveSaver,
  },
  {
    id: 'coast-fire',
    title: 'Coast FIRE',
    summary: 'Front-loading retirement savings early, then letting compounding carry the plan without contributions.',
    teaches: 'Front-loaded contributions and Coast-FIRE portfolio growth over time.',
    themeTags: ['fire', 'coast-fire'],
    learnSlug: 'example-coast-fire',
    lookFor: 'Active contribution phase ending early, while traditional IRA balance coasts to goal.',
    build: buildCoastFire,
  },
  {
    id: 'barista-fire',
    title: 'Barista FIRE',
    summary: 'Transitioning to part-time work at age 40, using partial wages and ACA subsidies to bridge to retirement.',
    teaches: 'Modeling part-time wages, bridging early retirement, and utilizing ACA healthcare credits.',
    themeTags: ['fire', 'barista-fire'],
    learnSlug: 'example-barista-fire',
    lookFor: 'Wages transition to barista work at age 40, alongside ACA healthcare premium credits.',
    build: buildBaristaFire,
  },
  {
    id: 'bridge-early-retirement',
    title: 'Bridge to 59½ (SEPP)',
    summary: 'Retiring at age 45 and using a 72(t) SEPP program to access retirement accounts penalty-free.',
    teaches: 'Substantially Equal Periodic Payments (SEPP) to access pre-tax IRAs before 59½.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-bridge-early-retirement',
    lookFor: 'Deterministic 72(t) distributions from the traditional account starting at age 45.',
    build: buildBridgeEarlyRetirement,
  },
  {
    id: 'lean-fat-fire',
    title: 'Lean vs. Fat FIRE',
    summary: 'Comparing Lean FIRE vs. Fat FIRE spending levels for a single household.',
    teaches: 'Comparing different target retirement lifestyles and FI numbers side by side.',
    themeTags: ['fire'],
    learnSlug: 'example-lean-fat-fire',
    lookFor: 'Compare base plan (Lean FIRE) vs Scenario (Fat FIRE) for FI years and balances.',
    build: buildLeanFatFire,
  },
  {
    id: 'hsa-stealth-retirement',
    title: 'HSA as a stealth account',
    summary: 'Using a triple-tax-advantaged HSA as a primary investment vehicle for early retirement.',
    teaches: 'Maximizing HSA contributions and investing them for long-term tax-free growth.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-hsa-stealth-retirement',
    lookFor: 'Stealth HSA account contributions and growth alongside a traditional 401(k).',
    build: buildHsaStealthRetirement,
  },
  {
    id: 'salary-growth-escalation',
    title: 'Salary growth & escalation',
    summary: 'Visualizing how annual raises and auto-escalating savings change retirement trajectories.',
    teaches: 'The combined compounding effect of wage growth and escalating contribution schedules.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-salary-growth-escalation',
    lookFor: 'Compounded raise factor on wages and annual escalation on pre-tax contributions.',
    build: buildSalaryGrowthEscalation,
  },
  {
    id: 'guardrails-flex-goals',
    title: 'Guardrails and flexible goals',
    summary: 'Single retiree with layered spending (required floor + ideal/excess) and adaptive one-time goals under withdrawal-rate guardrails.',
    teaches: 'Required floor is always protected; discretionary spending and flexible goals (movable/skippable/partial) are rationed in weak markets. MC reports separate required vs target success.',
    themeTags: ['guardrails', 'shortfall'],
    learnSlug: 'example-guardrails-flex-goals',
    lookFor: 'Guardrail actions and factors in Results, required/targetShortfall split, flexibleGoals counters, and layered success rates in Monte Carlo.',
    build: buildGuardrailsFlex,
  },
  {
    id: 'annuity-purchases-estate',
    title: 'Annuity ladder and estate beneficiaries',
    summary: 'Couple purchasing SPIA (non-qualified) and QLAC (qualified) with differentiated per-account estate beneficiaries (spouse, charity, non-spouse).',
    teaches: 'Annuity purchase events create guaranteed income streams (exclusion ratio or taxable); QLAC reduces future RMDs; estate uses account-specific destination rules (rollover, untaxed charity, heir tax class).',
    themeTags: ['annuity-estate', 'survivor'],
    learnSlug: 'example-annuity-purchases-estate',
    lookFor: 'Annuity income and purchase cash-flows in Results ledger; RMD reduction from QLAC; after-tax estate differences driven by beneficiary designations.',
    build: buildAnnuityEstate,
  },
  {
    id: 'glidepath-allocation',
    title: 'Glidepath allocation and rebalancing',
    summary: 'Near-retiree using 4-class allocations with glidepaths, staged targets, annual rebalancing, and class yields on taxable.',
    teaches: 'Accounts grow at blended class returns with drift + rebalance (realization in taxable); MC applies class-correlated shocks; asset location opportunities visible in Insights.',
    themeTags: ['allocation', 'rmd-irmaa'],
    learnSlug: 'example-glidepath-allocation',
    lookFor: 'Allocation editor and glide targets on Accounts; class returns/drag; MC frontiers + historical stress + downside percentiles vs the single-return scenario.',
    build: buildGlidepathAllocation,
  },
  {
    id: 'hsa-property-depth',
    title: 'HSA medical sub-ledger and home sale',
    summary: 'HSA with medical-expense cap + reimburse-later strategy alongside a primary residence sale using cost basis, §121 exclusion, and recapture.',
    teaches: 'HSA qualified withdrawals capped by modeled medical + accumulated reimburse pool; property sales compute exact gain after selling costs and exclusion (with ordinary recapture). Nondeductible basis applies pro-rata on IRA conversions.',
    themeTags: ['hsa-depth', 'shortfall'],
    learnSlug: 'example-hsa-property-depth',
    lookFor: 'HSA withdrawalTreatment and reimburseLater fields; qualified vs taxable HSA flows in Results; property sale tax line items and net proceeds.',
    build: buildHsaPropertyDepth,
  },
  // A-B control variants for side-by-side Plan Compare (same starting dollars / household where possible)
  {
    id: 'fixed-target-spending',
    title: 'Fixed target spending (no guardrails)',
    summary: 'Control version of the guardrails example: same balances and target lifestyle but classic fixed spending (no required floor or guardrail policy).',
    teaches: 'A-B comparison: load both this and "Guardrails and flexible goals", then use Compare Plans to see how guardrails affect required success rate, depletion, and goal funding.',
    themeTags: ['guardrails', 'shortfall'],
    learnSlug: 'example-fixed-target-spending',
    lookFor: 'Compare depletion year and MC success rates (especially requiredFloorSuccessRate) against the guardrails version.',
    build: buildFixedTargetSpending,
  },
  {
    id: 'no-annuity-brokerage',
    title: 'Brokerage only (no annuity purchases)',
    summary: 'Control version: same couple and starting capital, but the annuity premiums stay invested in cash + traditional instead of being used to buy SPIA/QLAC.',
    teaches: 'A-B comparison: load with "Annuity ladder and estate beneficiaries". Compare income stability, RMDs, and after-tax estate when money stays liquid vs annuitized.',
    themeTags: ['annuity-estate', 'survivor'],
    learnSlug: 'example-no-annuity-brokerage',
    lookFor: 'Higher liquid balances early, no guaranteed income stream, different estate math. Use Compare to quantify the trade-off.',
    build: buildNoAnnuityBrokerage,
  },
  {
    id: 'static-allocation-control',
    title: 'Static allocation (no glidepath)',
    summary: 'Control version with identical starting dollar amounts and accounts, but no allocation policies or rebalancing (single default return).',
    teaches: 'A-B comparison with "Glidepath allocation and rebalancing". Same starting balances — see the impact of glide + rebalancing + class-correlated MC on risk metrics and outcomes.',
    themeTags: ['allocation', 'rmd-irmaa'],
    learnSlug: 'example-static-allocation-control',
    lookFor: 'Run Monte Carlo on both and compare 10th-percentile estate, success curves, and depletion probability in the Compare view.',
    build: buildStaticAllocationControl,
  },
  {
    id: 'brokerage-no-hsa',
    title: 'Brokerage instead of HSA',
    summary: 'Control version: the HSA dollars and contribution rate are held in taxable brokerage instead. Same property sale and other accounts.',
    teaches: 'A-B comparison with "HSA medical sub-ledger and home sale". See the difference between triple-tax-advantaged HSA (with medical cap) vs ordinary brokerage growth and withdrawals.',
    themeTags: ['hsa-depth', 'shortfall'],
    learnSlug: 'example-brokerage-no-hsa',
    lookFor: 'Compare tax drag on withdrawals, qualified medical treatment, and ending balances. Great for showing HSA advantage in Results.',
    build: buildBrokerageNoHsa,
  },
  // A-B decision pairs (same engine features both sides; the savings strategy is the variable)
  {
    id: 'all-401k-no-bridge',
    title: 'All-in 401(k) (no bridge)',
    summary: 'Control version of "401(k) plus brokerage bridge": same couple retiring at 52, same wages and $45,000/yr gross savings budget, but every dollar saved goes into pre-tax 401(k)s.',
    teaches: 'A-B comparison: load with "401(k) plus brokerage bridge" and Compare. With nearly all wealth pre-tax at 52, the bridge years to 59½ force penalized traditional withdrawals (or a SEPP program — see "Bridge to 59½"), and the MAGI those withdrawals create wipes out ACA premium credits — so identical savings drain years earlier.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-all-401k-no-bridge',
    lookFor: 'Early-withdrawal penalties in Results once cash and the small brokerage run dry, marketplace premiums jumping when MAGI clears the ACA cliff, and a depletion year the bridge version avoids.',
    build: buildAll401kNoBridge,
  },
  {
    id: 'brokerage-bridge-401k',
    title: '401(k) plus brokerage bridge',
    summary: 'Same couple and gross savings budget as the control, but 401(k) contributions stop near the employer-match cap and the rest builds a taxable brokerage bridge for retiring at 52.',
    teaches: 'The brokerage basis funds ages 52–59½ at low capital-gains rates and low MAGI, so ACA credits survive and no penalties apply. The gross budget is held constant, so this plan pays more tax during accumulation — and still outlives the control by years. Load with "All-in 401(k) (no bridge)" and Compare.',
    themeTags: ['fire', 'accumulation'],
    learnSlug: 'example-brokerage-bridge-401k',
    lookFor: 'Penalty-free bridge years with tiny net marketplace premiums while the control pays full price, and no depletion where the control runs dry. Then try the conversion scenario: even 12%-bracket conversions can backfire when the bridge fund is also the spending money.',
    build: buildBrokerageBridge401k,
  },
  {
    id: 'no-head-start-grad',
    title: 'Starting from zero (no head start)',
    summary: 'Control version of "Trump account IRA head start": identical 22-year-old, wages, spending, and ongoing savings; retirement wealth starts at $0.',
    teaches: 'A-B comparison: load with "Trump account IRA head start" — the only difference is the seeded IRA. Load both and Compare to see what an 18-year head start compounds into with zero additional behavior.',
    themeTags: ['accumulation'],
    learnSlug: 'example-no-head-start-grad',
    lookFor: 'Where the 401(k)-only trajectory lands by 60, then Compare ending assets and depletion against the head-start version.',
    build: buildNoHeadStartGrad,
  },
  {
    id: 'trump-account-head-start',
    title: 'Trump account IRA head start',
    summary: 'Illustrative: a 22-year-old whose childhood Trump account (seed + $2,500/yr family contributions) became a traditional IRA at 18 and reaches ≈$115,800 at 22 — with $45,000 of nondeductible basis.',
    teaches: 'The head start compounds into a dramatically larger estate with zero extra saving by Nova. The converted account is just a traditional IRA: the $45,000 of after-tax family contributions is Form 8606 basis, so the pro-rata rule prices any withdrawal or Roth conversion. Illustrative framing — the library clock is 2026, so this shows what a child born under the program will experience at 22.',
    themeTags: ['accumulation'],
    learnSlug: 'example-trump-account-head-start',
    lookFor: 'The seeded IRA compounding untouched to 60, and the "Convert to Roth in low-income years" scenario where the basis converts tax-free and the pre-tax portion fills the 12% bracket cheaply.',
    build: buildTrumpAccountHeadStart,
  },
]

const BY_ID = new Map(EXAMPLE_PLANS.map((e) => [e.id, e]))

export function getExampleById(id: string): ExamplePlan | undefined {
  return BY_ID.get(id)
}

export function getExampleByLearnSlug(slug: string): ExamplePlan | undefined {
  return EXAMPLE_PLANS.find((e) => e.learnSlug === slug)
}
