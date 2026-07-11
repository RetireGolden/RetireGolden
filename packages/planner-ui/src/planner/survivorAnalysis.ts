/**
 * Survivor-transition analysis for two-adult plans (survivor-widowhood-and-
 * irmaa-relief, step 2).
 *
 * For each death-timing scenario (either spouse first, at a bounded set of
 * ages), run the SAME deterministic ledger the Results page uses with a
 * `deathAgeByPersonId` override and read the transition facts straight off the
 * projection years: the filing-status timeline, the tax/MAGI shift around the
 * death, the survivor's Social Security outcome, survivor spending coverage,
 * the IRMAA difference with and without SSA-44 relief, and the pre-death
 * Roth-conversion lever priced as an ordinary scenario patch. Nothing here is
 * a separate model — every number must agree exactly with running the
 * equivalent scenario by hand (guarded by tests).
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { summarizeProjection } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { ProjectedFilingStatus, ProjectionResult, TaxCalculator } from '@retiregolden/engine/projection/types'

export const SURVIVOR_DEATH_AGES = [70, 75, 80, 85, 90] as const

export interface SurvivorAnalysisOptions {
  startYear: number
  taxCalculator: TaxCalculator
  /** Death-age grid per first-to-die person; defaults to {@link SURVIVOR_DEATH_AGES}, clamped to plausible ages. */
  deathAges?: number[]
}

/** One contiguous run of a filing status in the projection. */
export interface FilingSegment {
  fromYear: number
  toYear: number
  status: ProjectedFilingStatus
}

export interface SurvivorYearFacts {
  year: number
  magi: number
  tax: number
  filingStatus: ProjectedFilingStatus
}

export interface SurvivorIrmaaYear {
  year: number
  /** IRMAA tier / annual Medicare premiums under the plain two-year lookback. */
  tierWithoutSsa44: number
  premiumsWithoutSsa44: number
  /** … and with SSA-44 survivor-year redetermination modeled. */
  tierWithSsa44: number
  premiumsWithSsa44: number
}

export interface SurvivorScenarioRow {
  /** The first-to-die person this row models. */
  deceasedPersonId: string
  deathAge: number
  deathYear: number
  /** Compressed filing-status timeline of the whole projection. */
  filingTimeline: FilingSegment[]
  /** The last joint-filing year (the death year) vs the first survivor-filed year. */
  lastJointYear: SurvivorYearFacts
  firstSurvivorYear: SurvivorYearFacts
  /** Household Social Security in the death year vs the first survivor year (nominal). */
  ssBeforeDeath: number
  ssAfterDeath: number
  /** SSA-44 window years (death year + 1, + 2), premiums from two otherwise-identical runs. */
  irmaaYears: SurvivorIrmaaYear[]
  /** Total nominal Medicare premium saved by SSA-44 across all survivor years. */
  ssa44PremiumSavings: number
  /** Survivor years (after the death year) with any required-spending shortfall. */
  survivorShortfallYears: number
  /** Lowest end-of-year investable balance across survivor years (nominal). */
  minSurvivorInvestable: number
  /** Ending after-tax estate / lifetime tax for this death timing, at the plan's own settings (nominal). */
  baseEndingAfterTaxEstate: number
  baseLifetimeTax: number
  /**
   * The pre-death conversion lever: the same death timing with conversions
   * filling the 12% bracket through the last joint year (the widows-penalty
   * detector's preview patch), priced on the same ledger. Null when the patch
   * fails validation (never expected).
   */
  conversionLever: {
    endingAfterTaxEstate: number
    lifetimeTax: number
    estateDelta: number
    lifetimeTaxDelta: number
  } | null
}

export interface SurvivorAnalysis {
  /** False for plans that are not a two-adult married-filing-jointly household. */
  eligible: boolean
  /** Whether the plan itself already models SSA-44 survivor relief. */
  planUsesSsa44: boolean
  rows: SurvivorScenarioRow[]
  /** Death timings whose ledger runs threw and were skipped (0 = clean sweep). */
  failedTimings: number
  /** Set by the page when the whole sweep threw — render an error state, not tables. */
  error?: boolean
}

function dobYearOf(plan: Plan, personId: string): number {
  const p = plan.household.people.find((x) => x.id === personId)!
  return Number(p.dob.slice(0, 4))
}

/** The plan with SSA-44 survivor relief forced on/off (other settings untouched). */
function withSurvivorSsa44(plan: Plan, on: boolean): Plan {
  return {
    ...plan,
    expenses: {
      ...plan.expenses,
      healthcare: {
        ...plan.expenses.healthcare,
        ssa44: { survivorYears: on, retirementYears: plan.expenses.healthcare.ssa44?.retirementYears ?? false },
      },
    },
  }
}

function filingTimeline(result: ProjectionResult): FilingSegment[] {
  const segments: FilingSegment[] = []
  for (const y of result.years) {
    const last = segments[segments.length - 1]
    if (last && last.status === y.filingStatus) last.toYear = y.year
    else segments.push({ fromYear: y.year, toYear: y.year, status: y.filingStatus })
  }
  return segments
}

/** The widows-penalty detector's conversion-acceleration patch for a given last joint year. */
export function conversionLeverPatch(startYear: number, lastJointYear: number): Record<string, unknown> {
  return {
    strategies: {
      rothConversion: {
        mode: 'fillToTarget',
        target: 'topOfBracket',
        targetValue: 12,
        startYear,
        endYear: lastJointYear,
      },
    },
  }
}

/**
 * Death ages worth sweeping for a person: the default grid clamped to
 * [current age, planning age), so every row is a genuine "dies earlier than
 * planned" scenario. The current attained age is included — dying at the end
 * of this year is a valid earlier-than-planned timing (`lastAliveYear =
 * dobYear + deathAge ≥ startYear`). Empty when no grid age fits.
 */
export function candidateDeathAges(plan: Plan, personId: string, startYear: number, grid: number[]): number[] {
  const person = plan.household.people.find((p) => p.id === personId)!
  const currentAge = startYear - dobYearOf(plan, personId)
  return grid.filter((a) => a >= currentAge && a < person.longevity.planningAge)
}

/**
 * One death timing = three full ledger runs: the SSA-44 off/on pair (whichever
 * matches the plan's own setting doubles as the base run — the field is
 * engine-identical to absent when off, and summarize ignores it) plus the
 * conversion-lever run. Returns null when the timing yields no survivor phase.
 */
function buildTimingRow(
  plan: Plan,
  opts: SurvivorAnalysisOptions,
  personId: string,
  deathAge: number,
  planUsesSsa44: boolean,
): SurvivorScenarioRow | null {
  const deathYear = dobYearOf(plan, personId) + deathAge
  const simOpts = { startYear: opts.startYear, taxCalculator: opts.taxCalculator, deathAgeByPersonId: { [personId]: deathAge } }

  const without = simulatePlan(withSurvivorSsa44(plan, false), simOpts)
  const withRelief = simulatePlan(withSurvivorSsa44(plan, true), simOpts)
  const base = planUsesSsa44 ? withRelief : without
  const baseSummary = summarizeProjection(plan, base)

  const lastJoint = base.years.find((y) => y.year === deathYear)
  const firstSurvivor = base.years.find((y) => y.year === deathYear + 1)
  if (!lastJoint || !firstSurvivor) return null

  const irmaaYears: SurvivorIrmaaYear[] = [deathYear + 1, deathYear + 2]
    .map((year) => {
      const off = without.years.find((y) => y.year === year)
      const on = withRelief.years.find((y) => y.year === year)
      if (!off || !on) return null
      return {
        year,
        tierWithoutSsa44: off.irmaaTier,
        premiumsWithoutSsa44: off.medicarePremiums,
        tierWithSsa44: on.irmaaTier,
        premiumsWithSsa44: on.medicarePremiums,
      }
    })
    .filter((x): x is SurvivorIrmaaYear => x !== null)
  let ssa44PremiumSavings = 0
  for (const y of without.years) {
    const on = withRelief.years.find((x) => x.year === y.year)
    if (on) ssa44PremiumSavings += y.medicarePremiums - on.medicarePremiums
  }

  const survivorYears = base.years.filter((y) => y.year > deathYear && y.people.some((p) => p.alive))
  const survivorShortfallYears = survivorYears.filter((y) => y.requiredShortfall > 0.005).length
  const minSurvivorInvestable = survivorYears.length > 0 ? Math.min(...survivorYears.map((y) => y.investableTotal)) : 0

  // The conversion lever, priced as an ordinary scenario patch on the same
  // death timing (agrees exactly with adding the scenario by hand).
  let conversionLever: SurvivorScenarioRow['conversionLever'] = null
  const patched = applyScenarioPatch(plan, conversionLeverPatch(opts.startYear, deathYear))
  if (patched.ok) {
    const leverSummary = summarizeProjection(patched.plan, simulatePlan(patched.plan, simOpts))
    conversionLever = {
      endingAfterTaxEstate: leverSummary.endingAfterTaxEstate,
      lifetimeTax: leverSummary.lifetimeTaxesAndPenalties,
      estateDelta: leverSummary.endingAfterTaxEstate - baseSummary.endingAfterTaxEstate,
      lifetimeTaxDelta: leverSummary.lifetimeTaxesAndPenalties - baseSummary.lifetimeTaxesAndPenalties,
    }
  }

  return {
    deceasedPersonId: personId,
    deathAge,
    deathYear,
    filingTimeline: filingTimeline(base),
    lastJointYear: { year: lastJoint.year, magi: lastJoint.magi, tax: lastJoint.tax, filingStatus: lastJoint.filingStatus },
    firstSurvivorYear: {
      year: firstSurvivor.year,
      magi: firstSurvivor.magi,
      tax: firstSurvivor.tax,
      filingStatus: firstSurvivor.filingStatus,
    },
    ssBeforeDeath: lastJoint.incomes.socialSecurity,
    ssAfterDeath: firstSurvivor.incomes.socialSecurity,
    irmaaYears,
    ssa44PremiumSavings,
    survivorShortfallYears,
    minSurvivorInvestable,
    baseEndingAfterTaxEstate: baseSummary.endingAfterTaxEstate,
    baseLifetimeTax: baseSummary.lifetimeTaxesAndPenalties,
    conversionLever,
  }
}

export function buildSurvivorAnalysis(plan: Plan, opts: SurvivorAnalysisOptions): SurvivorAnalysis {
  const eligible = plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2
  const planUsesSsa44 = plan.expenses.healthcare.ssa44?.survivorYears === true
  if (!eligible) return { eligible, planUsesSsa44, rows: [], failedTimings: 0 }

  const grid = opts.deathAges ?? [...SURVIVOR_DEATH_AGES]
  const rows: SurvivorScenarioRow[] = []
  let failedTimings = 0

  for (const person of plan.household.people) {
    const survivor = plan.household.people.find((p) => p.id !== person.id)!
    const survivorLastYear = dobYearOf(plan, survivor.id) + survivor.longevity.planningAge
    for (const deathAge of candidateDeathAges(plan, person.id, opts.startYear, grid)) {
      const deathYear = dobYearOf(plan, person.id) + deathAge
      // Only genuine first deaths: the survivor must outlive this timing.
      if (deathYear >= survivorLastYear) continue
      // A throwing timing is skipped (and counted) rather than sinking the
      // whole sweep — the page reports partial results honestly.
      try {
        const row = buildTimingRow(plan, opts, person.id, deathAge, planUsesSsa44)
        if (row) rows.push(row)
      } catch {
        failedTimings += 1
      }
    }
  }

  return { eligible, planUsesSsa44, rows, failedTimings }
}
