/**
 * Assumptions snapshot: every live assumption behind a plan's projections —
 * economy, per-account returns/allocations, longevity, law toggles, and the
 * parameter-pack provenance — each tagged with where it comes from (user-set,
 * app default, or a published source). Feeds the "Your assumptions" card and
 * its copy-export, whose purpose is answering "why do tools disagree?": hand
 * the exported assumptions to another tool (or a human) to see exactly where
 * the inputs differ.
 *
 * Pure module (no React) so the snapshot and both export renderings are unit
 * testable, including the JSON round-trip guarantee. Scope: the export carries
 * the *assumptions* (what this card shows) — incomes, expenses, goals, and the
 * rest of the plan's inputs travel in the full plan backup, not here.
 */

import {
  accountAllocation,
  expectedAccountReturnPct,
  resolveAssetClassParams,
  DEFAULT_ASSET_CLASS_PARAMS,
} from '@retiregolden/engine/allocation/assetClasses'
import { knownLifeTableEdition, type KnownLifeTableEdition } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import type { LifeTableEdition } from '@retiregolden/engine/longevity/types'
import { createEmptyPlan, ASSET_CLASS_IDS, type Account, type Plan } from '@retiregolden/engine/model/plan'
import {
  LATEST_PACK_YEAR,
  PARAMETER_DATA_AS_OF,
  PARAMETER_PROVENANCE,
} from '@retiregolden/engine/params'
import { conversionScheduleTotal } from '@retiregolden/engine/strategies/conversionScheduleTotal'
import { SINGLE_WITH_PARTNER_NOTE } from './filingStatusNotice'
import { fmtMoney } from './format'
import { projectedParametersSentence, projectedParametersFrom } from './projectedParameters'

/** Where a shown value comes from. */
export type AssumptionProvenance = 'user-set' | 'app-default' | 'published-source'

export interface AssumptionRow {
  /** Stable id, unique within its group. */
  id: string
  label: string
  /** Human-readable value as shown on the card. */
  value: string
  provenance: AssumptionProvenance
  /** `PARAMETER_PROVENANCE` entry id when a citable source backs the row. */
  sourceId?: string
}

export interface AssumptionGroup {
  id: string
  label: string
  rows: AssumptionRow[]
  /**
   * A reading the engine gives the group's rows, printed under the heading.
   * Not a row: a row is a value someone or some source set, with a
   * provenance chip, and an engine fact is neither.
   */
  note?: string
}

/**
 * A questionnaire result saved in this browser for a person slot (index 0 is
 * the primary person, 1 the partner): the planning age it gives the plan
 * (longevity/storage.ts#questionnairePlanningAge) and the table edition it was
 * computed on (absent on a result saved before the field existed, which was
 * made on the 2022 table).
 */
export interface SavedQuestionnaireAge {
  readonly planningAge: number
  readonly tableEdition?: LifeTableEdition
}

export interface AssumptionsSnapshot {
  planName: string
  /** The year the published tax, limit and benefit figures below apply to. */
  packYear: number
  dataAsOf: string
  /** The year the plan's projection starts (`projectionStartYear`). */
  startYear: number
  /**
   * The plan's projected figures, by publisher, from the year each is first
   * projected: what the engine grows at the plan's inflation (Medicare at its
   * healthcare inflation) until RetireGolden loads the agency's figures
   * (decision D-2027-ROLLOVER). Empty when nothing is.
   */
  projectedParameters: readonly { fromYear: number; figures: string; projectedFrom: number }[]
  /** The same in one sentence, or null. */
  projectedParametersNote: string | null
  groups: AssumptionGroup[]
  /**
   * Machine-readable section: the raw assumptions object plus the per-account
   * return model. Round-trips: `JSON.parse` of the JSON export returns these
   * values exactly as the plan holds them. This is the card's contents, not a
   * full plan export — replicating Results/Monte Carlo/optimizer numbers also
   * needs the incomes, expenses, and goals from a plan backup.
   */
  machine: {
    assumptions: Plan['assumptions']
    household: {
      filingStatus: Plan['household']['filingStatus']
      state: string
      stateMoves: Plan['household']['stateMoves']
      people: { name: string; dob: string; retirementAge: number | null; planningAge: number; longevitySource: string }[]
    }
    accounts: {
      name: string
      type: Account['type']
      balance: number
      annualReturnPct: number | null
      allocation: unknown
    }[]
    strategies: Plan['strategies']
  }
}

const PROVENANCE_LABEL: Record<AssumptionProvenance, string> = {
  'user-set': 'you set this',
  'app-default': 'app default',
  'published-source': 'published source',
}

/** Canonical app defaults, taken from the same factory that seeds new plans. */
function defaultAssumptions(): Plan['assumptions'] {
  return createEmptyPlan({ newId: () => 'defaults' }).assumptions
}

const pct = (v: number) => `${v}%`

function userOrDefault(current: unknown, fallback: unknown): AssumptionProvenance {
  return JSON.stringify(current) === JSON.stringify(fallback) ? 'app-default' : 'user-set'
}

function economyGroup(plan: Plan, defaults: Plan['assumptions']): AssumptionGroup {
  const a = plan.assumptions
  return {
    id: 'economy',
    label: 'Economy & rates',
    rows: [
      { id: 'inflation', label: 'General inflation', value: `${pct(a.inflationPct)}/yr`, provenance: userOrDefault(a.inflationPct, defaults.inflationPct) },
      { id: 'healthcare-inflation', label: 'Healthcare extra inflation', value: `+${pct(a.healthcareExtraInflationPct)}/yr on top of general`, provenance: userOrDefault(a.healthcareExtraInflationPct, defaults.healthcareExtraInflationPct) },
      { id: 'default-return', label: 'Default nominal return', value: `${pct(a.defaultReturnPct)}/yr (accounts without their own)`, provenance: userOrDefault(a.defaultReturnPct, defaults.defaultReturnPct) },
      { id: 'swr', label: 'Safe withdrawal rate (FI lens)', value: `${pct(a.safeWithdrawalRatePct ?? 4)}/yr`, provenance: userOrDefault(a.safeWithdrawalRatePct ?? 4, defaults.safeWithdrawalRatePct ?? 4) },
    ],
  }
}

/** Return-bearing account types the card enumerates (income streams, property, and debt live elsewhere). */
const INVESTABLE_TYPE_LABEL = {
  cash: 'Cash',
  taxable: 'Taxable brokerage',
  equityComp: 'Equity comp',
  traditional: 'Traditional',
  roth: 'Roth',
  hsa: 'HSA',
} as const

type InvestableAccount = Extract<Account, { type: keyof typeof INVESTABLE_TYPE_LABEL }>

function investableAccounts(plan: Plan): InvestableAccount[] {
  return plan.accounts.filter((acct): acct is InvestableAccount => acct.type in INVESTABLE_TYPE_LABEL)
}

function allocationSummary(account: Account): string | null {
  const policy = accountAllocation(account)
  if (!policy) return null
  switch (policy.mode) {
    case 'static': {
      const parts = ASSET_CLASS_IDS.filter((id) => policy.weights[id] > 0).map(
        (id) => `${policy.weights[id]}% ${DEFAULT_ASSET_CLASS_PARAMS[id].label.toLowerCase()}`,
      )
      return `static ${parts.join(' / ')}${policy.rebalancing === 'annual' ? ', rebalanced annually' : ''}`
    }
    case 'linear':
      return `linear glidepath ${policy.startYear}–${policy.endYear}`
    case 'staged':
      return `staged glidepath (${policy.stages.length} stages)`
    case 'custom':
      return `custom glidepath (${policy.targets.length} targets)`
  }
}

function accountsGroup(plan: Plan, startYear: number): AssumptionGroup {
  const rows: AssumptionRow[] = investableAccounts(plan).map((acct, i) => {
    const allocation = allocationSummary(acct)
    const own = acct.annualReturnPct
    const returnPct = expectedAccountReturnPct(acct, plan.assumptions, startYear)
    const value = allocation
      ? `${pct(Math.round(returnPct * 100) / 100)}/yr blended, ${allocation}`
      : `${pct(returnPct)}/yr${own === null ? ' (plan default)' : ''}`
    return {
      id: `account-${i}`,
      label: `${acct.name} (${INVESTABLE_TYPE_LABEL[acct.type]}, ${fmtMoney(acct.balance)})`,
      value,
      provenance: (allocation || own !== null ? 'user-set' : 'app-default'),
    }
  })
  return { id: 'accounts', label: 'Account returns', rows }
}

function assetClassGroup(plan: Plan): AssumptionGroup | null {
  const usesAllocation = plan.accounts.some((acct) => accountAllocation(acct) !== undefined)
  if (!usesAllocation && plan.assumptions.assetClassParams === undefined) return null
  const resolved = resolveAssetClassParams(plan.assumptions.assetClassParams)
  return {
    id: 'asset-classes',
    label: 'Asset-class parameters',
    rows: ASSET_CLASS_IDS.map((id) => {
      const p = resolved[id]
      const overridden = plan.assumptions.assetClassParams?.[id] !== undefined
      return {
        id,
        label: p.label,
        value: `${pct(p.returnPct)}/yr return · ${pct(p.volatilityPct)} volatility · yields ${pct(p.interestYieldPct)} interest / ${pct(p.dividendYieldPct)} dividends (${p.qualifiedRatioPct}% qualified)`,
        provenance: (overridden ? 'user-set' : 'published-source'),
      }
    }),
  }
}

function longevityGroup(plan: Plan, savedQuestionnaire: readonly (SavedQuestionnaireAge | null)[]): AssumptionGroup {
  return {
    id: 'longevity',
    label: 'Household & longevity',
    // Two people under Single is a legal plan shape; wherever the filing
    // status is echoed above both people's rows, the same reading Household
    // and the report give travels with it (#555) — as a note on the group,
    // since it is how the engine reads the rows, not a setting anyone made.
    ...(plan.household.filingStatus === 'single' && plan.household.people.length === 2
      ? { note: `Two people on a Single-filing plan: ${SINGLE_WITH_PARTNER_NOTE}` }
      : {}),
    rows: [
      {
        id: 'filing',
        label: 'Filing status & state',
        value: `${plan.household.filingStatus === 'marriedFilingJointly' ? 'Married filing jointly' : 'Single'} · ${plan.household.state}${plan.household.stateMoves.length > 0 ? ` (moves: ${plan.household.stateMoves.map((m) => `${m.state} in ${m.fromYear}`).join(', ')})` : ''}`,
        provenance: 'user-set',
      },
      ...plan.household.people.map((p, i): AssumptionRow => {
        const origin = longevityOrigin(p.longevity, savedQuestionnaire[i] ?? null)
        return {
          id: `person-${i}`,
          label: `${p.name}: retirement & planning age`,
          value: `${p.retirementAge !== null ? `retires at ${p.retirementAge}, ` : ''}plan runs to age ${p.longevity.planningAge}${origin.text}`,
          // 'model' and 'percentile' both derive from SSA's period life table.
          provenance: p.longevity.source === 'manual' ? 'user-set' : 'published-source',
          ...(origin.sourceId ? { sourceId: origin.sourceId } : {}),
        }
      }),
    ],
  }
}

function lawTogglesGroup(plan: Plan, defaults: Plan['assumptions']): AssumptionGroup {
  const a = plan.assumptions
  const heirByClass = a.heirTaxByClass
  return {
    id: 'law-toggles',
    label: 'Law & policy toggles',
    rows: [
      {
        id: 'ss-cola',
        label: 'Social Security COLA',
        value: a.ssCola.mode === 'matchInflation' ? 'matches general inflation' : `fixed ${pct(a.ssCola.annualPct)}/yr`,
        provenance: userOrDefault(a.ssCola, defaults.ssCola),
        sourceId: 'social-security',
      },
      {
        id: 'ss-haircut',
        label: 'Social Security trust-fund cut',
        value: a.ssHaircut ? `${pct(a.ssHaircut.cutPct)} cut from ${a.ssHaircut.fromYear}` : 'not modeled (scheduled benefits)',
        provenance: userOrDefault(a.ssHaircut, defaults.ssHaircut),
        sourceId: 'social-security',
      },
      {
        id: 'state-tax',
        label: 'State income tax',
        value: a.stateEffectiveTaxPct > 0 ? `flat ${pct(a.stateEffectiveTaxPct)} override (modeled brackets bypassed)` : `modeled ${plan.household.state} brackets`,
        provenance: a.stateEffectiveTaxPct > 0 ? 'user-set' : 'published-source',
        sourceId: 'state-income-tax',
      },
      {
        id: 'local-tax',
        label: 'Local income tax',
        value: a.localIncomeTaxPct > 0 ? `flat ${pct(a.localIncomeTaxPct)}` : 'none',
        provenance: userOrDefault(a.localIncomeTaxPct, defaults.localIncomeTaxPct),
      },
      {
        id: 'recent-magi',
        label: 'Recent annual MAGI (IRMAA lookback seed)',
        value: a.recentAnnualMagi > 0 ? fmtMoney(a.recentAnnualMagi) : 'not set',
        provenance: userOrDefault(a.recentAnnualMagi, defaults.recentAnnualMagi),
        sourceId: 'medicare-irmaa',
      },
      {
        id: 'heir-tax',
        label: 'Heir tax on inherited pre-tax balances',
        value: heirByClass
          ? `traditional ${pct(heirByClass.traditional ?? a.heirTaxRatePct)} / HSA ${pct(heirByClass.hsa ?? a.heirTaxRatePct)}`
          : pct(a.heirTaxRatePct),
        provenance: heirByClass ? 'user-set' : userOrDefault(a.heirTaxRatePct, defaults.heirTaxRatePct),
      },
    ],
  }
}

function strategyGroup(plan: Plan): AssumptionGroup {
  const rc = plan.strategies.rothConversion
  const conversionValue =
    rc.mode === 'none'
      ? 'none'
      : rc.mode === 'manual' || rc.mode === 'optimized'
        ? `${rc.mode} schedule (${rc.conversions.length} year${rc.conversions.length === 1 ? '' : 's'}, ${fmtMoney(conversionScheduleTotal(rc.conversions))} total)`
        : `fill to ${rc.target} through ${rc.endYear}`
  return {
    id: 'strategy',
    label: 'Strategy settings',
    rows: [
      {
        id: 'withdrawal-order',
        label: 'Withdrawal order',
        value: plan.strategies.withdrawalOrder.mode,
        provenance: plan.strategies.withdrawalOrder.mode === 'sequential' ? 'app-default' : 'user-set',
      },
      { id: 'roth-conversion', label: 'Roth conversions', value: conversionValue, provenance: rc.mode === 'none' ? 'app-default' : 'user-set' },
      { id: 'qcd', label: 'Qualified charitable distributions', value: plan.strategies.qcdAnnual > 0 ? `${fmtMoney(plan.strategies.qcdAnnual)}/yr` : 'none', provenance: plan.strategies.qcdAnnual > 0 ? 'user-set' : 'app-default' },
    ],
  }
}

/** The catalog entry citing a known edition: the one at SSA's page for it. */
function lifeTableSourceId(known: KnownLifeTableEdition): string | undefined {
  return PARAMETER_PROVENANCE.find((s) => s.url === known.url)?.id
}

/** The table a planning age was computed on, in the row text, and the catalog entry citing it. */
function editionOrigin(stored: LifeTableEdition | undefined): { text: string; sourceId?: string } {
  const known = knownLifeTableEdition(stored)
  if (!known) return { text: 'SSA period life table, table edition not recognized' }
  const sourceId = lifeTableSourceId(known)
  return {
    text: `SSA ${known.edition.periodYear} period life table, ${known.edition.trusteesReportYear} Trustees Report`,
    ...(sourceId ? { sourceId } : {}),
  }
}

/**
 * How a planning age that is not typed in was set, and the life table entry
 * it cites: the edition the age was computed on, never the current table by
 * default (PR #759 review 1). A percentile pick names its own edition (a pick
 * stored before the edition was recorded was made on the 2022 table). The
 * plan does not store the questionnaire's edition, so a questionnaire age
 * takes the edition of the result saved in this browser for that person when
 * that result gives the plan's age; otherwise the row says the edition is not
 * recorded and cites no table. An edition outside the known set is named as
 * not recognized and cites no table.
 */
function longevityOrigin(
  longevity: Plan['household']['people'][number]['longevity'],
  saved: SavedQuestionnaireAge | null,
): { text: string; sourceId?: string } {
  if (longevity.source === 'percentile' && longevity.percentile) {
    const { pct, joint, tableEdition } = longevity.percentile
    const edition = editionOrigin(tableEdition)
    return { ...edition, text: ` (${pct}% survival percentile${joint ? ', joint' : ''}, ${edition.text})` }
  }
  if (longevity.source === 'model') {
    if (!saved || saved.planningAge !== longevity.planningAge) {
      return { text: ' (life-expectancy questionnaire estimate, table edition not recorded)' }
    }
    const edition = editionOrigin(saved.tableEdition)
    return { ...edition, text: ` (life-expectancy questionnaire estimate, ${edition.text})` }
  }
  return { text: '' }
}

function taxParametersGroup(): AssumptionGroup {
  return {
    id: 'tax-parameters',
    label: `Tax & benefit parameters (published for ${LATEST_PACK_YEAR})`,
    rows: PARAMETER_PROVENANCE.map((s) => ({
      id: s.id,
      label: s.label,
      value: s.figures,
      provenance: 'published-source',
      sourceId: s.id,
    })),
  }
}

/**
 * The snapshot of a plan's assumptions. `savedQuestionnaire` holds the
 * questionnaire results saved in this browser, by person slot, which date a
 * questionnaire planning age's table (none: those rows say the edition is not
 * recorded).
 */
export function buildAssumptionsSnapshot(
  plan: Plan,
  startYear: number,
  savedQuestionnaire: readonly (SavedQuestionnaireAge | null)[] = [],
): AssumptionsSnapshot {
  const defaults = defaultAssumptions()
  const groups = [
    economyGroup(plan, defaults),
    accountsGroup(plan, startYear),
    assetClassGroup(plan),
    longevityGroup(plan, savedQuestionnaire),
    lawTogglesGroup(plan, defaults),
    strategyGroup(plan),
    taxParametersGroup(),
  ].filter((g): g is AssumptionGroup => g !== null && g.rows.length > 0)

  return {
    planName: plan.name,
    packYear: LATEST_PACK_YEAR,
    dataAsOf: PARAMETER_DATA_AS_OF,
    startYear,
    projectedParameters: projectedParametersFrom(startYear).map(({ fromYear, figures, projectedFrom }) => ({ fromYear, figures, projectedFrom })),
    projectedParametersNote: projectedParametersSentence(startYear, plan.assumptions),
    groups,
    machine: {
      assumptions: plan.assumptions,
      household: {
        filingStatus: plan.household.filingStatus,
        state: plan.household.state,
        stateMoves: plan.household.stateMoves,
        people: plan.household.people.map((p) => ({
          name: p.name,
          dob: p.dob,
          retirementAge: p.retirementAge,
          planningAge: p.longevity.planningAge,
          longevitySource: p.longevity.source,
        })),
      },
      accounts: investableAccounts(plan).map((acct) => ({
        name: acct.name,
        type: acct.type,
        balance: acct.balance,
        annualReturnPct: acct.annualReturnPct,
        allocation: accountAllocation(acct) ?? null,
      })),
      strategies: plan.strategies,
    },
  }
}

/** Human-readable export: every card row, grouped, with provenance tags and sources. */
export function assumptionsExportText(snapshot: AssumptionsSnapshot): string {
  const sourceById = new Map(PARAMETER_PROVENANCE.map((s) => [s.id, s]))
  const lines: string[] = [
    `RetireGolden assumptions, ${snapshot.planName}`,
    `Tax parameters: published for ${snapshot.packYear}, compiled ${snapshot.dataAsOf}. The plan starts in ${snapshot.startYear}.`,
    ...(snapshot.projectedParametersNote === null ? [] : [snapshot.projectedParametersNote]),
    '',
  ]
  for (const group of snapshot.groups) {
    lines.push(`## ${group.label}`)
    if (group.note) lines.push(group.note)
    for (const row of group.rows) {
      const source = row.sourceId ? sourceById.get(row.sourceId) : undefined
      const sourceNote = source ? ` [${source.publisher}: ${source.url}]` : ''
      lines.push(`- ${row.label}: ${row.value} (${PROVENANCE_LABEL[row.provenance]})${sourceNote}`)
    }
    lines.push('')
  }
  lines.push(
    'Replication notes: deterministic results apply these returns and inflation every year;',
    'Monte Carlo varies markets around them (model, path count, and seed are chosen on the',
    'Monte Carlo page). Success = investable assets never deplete before the end of the plan.',
  )
  return lines.join('\n')
}

/** Machine-readable export; parses back to the exact values the plan holds. */
export function assumptionsExportJson(snapshot: AssumptionsSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}
