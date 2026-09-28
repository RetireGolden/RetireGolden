/**
 * Survivor-transition analysis for two-adult plans (survivor-widowhood-and-
 * irmaa-relief, step 2; moved from planner-ui in B2-P1 slice 5).
 *
 * For each death timing (either spouse first, at a bounded set of ages), run
 * the same deterministic ledger the Results page uses with a
 * `deathAgeByPersonId` override and read the transition facts off the
 * projection years: the filing-status timeline, the tax and MAGI around the
 * death, the survivor's Social Security, survivor spending coverage, the
 * Medicare premium difference with and without SSA-44 relief, and the
 * convert-early lever. Every number agrees exactly with running the same
 * death timing through `simulatePlan` by hand.
 *
 * The lever (owner decision R16) adds Roth conversions that fill the 12%
 * bracket to the plan's own conversions, from the start year through the year
 * of the first death (`SimulateOptions.additionalBracketFill`): each window year
 * converts the larger of the plan's own target and the fill. It never replaces
 * the plan's strategy.
 *
 * @see DOCS/calculations/social-security/survivor-convert-early-lever.md
 * @see DOCS/calculations/social-security/survivor-ssa44-premium-difference.md
 * @see DOCS/calculations/social-security/survivor-shortfall-year-count.md
 */
import type { Plan } from '../model/plan.js'
import { summarizeProjection } from './compare.js'
import {
  AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS,
  ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS,
} from './moneyTolerance.js'
import { simulatePlan } from './simulate.js'
import type { ProjectedFilingStatus, ProjectionResult, TaxCalculator } from './types.js'

export const SURVIVOR_DEATH_AGES = [70, 75, 80, 85, 90] as const

/** The bracket the convert-early lever fills: the 12% bracket, for the year's filing status. */
export const SURVIVOR_LEVER_BRACKET_PCT = 12

export interface SurvivorTransitionOptions {
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
  /** The ledger's required-spending shortfall that year (nominal); non-zero means the plan was already short of required spending. */
  requiredShortfall: number
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

/**
 * What the lever did in one window year, read from executed dollars (the
 * ledger's `rothConversion`) against the year's sizing, the plan's own target
 * capped at the convertible balance ("own") and the 12% fill ("fill"):
 * - 'raised': it converted more than own;
 * - 'covered': it converted something, and at least the fill: the plan's own
 *   conversion already reaches at or past the top of the 12% bracket;
 * - 'short': it converted less than the fill asked (the ledger's notes say
 *   why, e.g. no Roth account for an owner's share to land in);
 * - 'no-balance': no convertible traditional balance (none left, or only an
 *   employer plan not yet distributable);
 * - 'fill-limited': the fill's own sizing cut it to nothing (its notes say
 *   why, e.g. the conversion's tax would breach the taxable safety-net floor);
 * - 'no-room': taxable income already reached the top of the 12% bracket;
 * - 'named-conversions': a conversion the plan names replaced the aggregate
 *   strategy, so the lever sized nothing.
 */
export type SurvivorLeverYearReason =
  | 'raised'
  | 'short'
  | 'covered'
  | 'no-balance'
  | 'fill-limited'
  | 'no-room'
  | 'named-conversions'

export interface SurvivorLeverYear {
  year: number
  reason: SurvivorLeverYearReason
  /**
   * The ledger's own words for the year: the fill's sizing messages on a
   * 'fill-limited' year (AdditionalBracketFillYear.fillNotes), then, on any
   * year, the messages it raised when it converted less than the year's
   * selected target asked (ledgerNotes). Empty when there are none.
   */
  notes: readonly string[]
}

/**
 * The convert-early lever for one death timing: the same death timing run with
 * a 12%-bracket fill added to the plan's own conversions through the death
 * year, against the base run.
 */
export interface SurvivorConversionLever {
  endingAfterTaxEstate: number
  lifetimeTax: number
  /** Lever run minus base run, ending after-tax estate; nominal dollars of the row's `endYear`. */
  estateDelta: number
  /** Lever run minus base run, lifetime taxes and penalties (an undiscounted sum of nominal dollars). */
  lifetimeTaxDelta: number
  /**
   * Window years in which the lever run converted more than the plan's own
   * target capped at the convertible balance (executed dollars, the ledger's
   * `rothConversion`); empty when the lever added nothing. The 'raised' years
   * of `years`.
   */
  raisedYears: number[]
  /**
   * Window years in which the lever run converted something and at least the
   * fill without converting more than the plan's own target: the plan already
   * converts at or past the top of the bracket there (executed dollars). The
   * 'covered' years of `years`.
   */
  coveredYears: number[]
  /** Every window year with what the lever did there and why (#SurvivorLeverYearReason). */
  years: SurvivorLeverYear[]
}

export interface SurvivorTimingRow {
  /** The first-to-die person this row models. */
  deceasedPersonId: string
  deathAge: number
  /** The last year the person is alive (birth year plus the death age). */
  deathYear: number
  /** The timing's last projection year: the year whose dollars its estates are in. */
  endYear: number
  /** Compressed filing-status timeline of the whole projection. */
  filingTimeline: FilingSegment[]
  /** The last joint-filing year (the death year) and the first survivor-filed year. */
  lastJointYear: SurvivorYearFacts
  firstSurvivorYear: SurvivorYearFacts
  /** Household Social Security in the death year and the first survivor year (nominal). */
  ssBeforeDeath: number
  ssAfterDeath: number
  /** SSA-44 relief years (death year + 1, + 2), premiums from two otherwise-identical runs. */
  irmaaYears: SurvivorIrmaaYear[]
  /**
   * Medicare premiums without SSA-44 survivor relief minus with it, summed
   * over every projection year of the two runs (nominal dollars): the relief
   * years plus any later knock-on.
   */
  ssa44PremiumSavings: number
  /** The same difference over the two relief years only. */
  ssa44ReliefYearSavings: number
  /**
   * Years after the death year, with the survivor alive, whose required-
   * spending shortfall exceeds the ledger's funding tolerance
   * (ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS).
   */
  survivorShortfallYears: number
  /** Lowest end-of-year investable balance across survivor years (nominal). */
  minSurvivorInvestable: number
  /** Ending after-tax estate / lifetime tax for this death timing, at the plan's own settings (nominal). */
  baseEndingAfterTaxEstate: number
  baseLifetimeTax: number
  conversionLever: SurvivorConversionLever
}

export interface SurvivorTransitionAnalysis {
  /** False for plans that are not a two-adult married-filing-jointly household. */
  eligible: boolean
  /** Whether the plan itself already models SSA-44 survivor relief. */
  planUsesSsa44: boolean
  rows: SurvivorTimingRow[]
  /** Death timings whose ledger runs threw and were skipped (0 = clean sweep). */
  failedTimings: number
}

const nearZero = (v: number) => Math.abs(v) < 0.5

/**
 * A timing with nothing on either side of the transition: no Social Security
 * before or after the death, no tax or MAGI in the last joint or first
 * survivor year, no surviving balance, no estate, no lifetime tax at all, no
 * premium to relieve. Such a row is exact for its timing but reads as a
 * confident survivor result ("$0 → $0", "no surcharge to relieve") beside a
 * red shortfall count (#513). A plan that runs short of money but still has
 * guaranteed income is NOT degenerate: its filing-status, Social Security,
 * tax, and IRMAA columns are exactly what the survivor page exists to show.
 * Shortfall is checked symmetrically across the transition, on required
 * spending on both sides: a survivor-year shortfall counts as a transition
 * signal only when the last joint year had none, i.e. the death introduced
 * it. Near-zero is symmetric (|v| < 0.5), so a rounding remainder of either
 * sign is still nothing; a real negative figure keeps the row.
 */
export function isDegenerateTiming(row: SurvivorTimingRow): boolean {
  return (
    nearZero(row.ssBeforeDeath) &&
    nearZero(row.ssAfterDeath) &&
    nearZero(row.lastJointYear.tax) &&
    nearZero(row.firstSurvivorYear.tax) &&
    nearZero(row.lastJointYear.magi) &&
    nearZero(row.firstSurvivorYear.magi) &&
    nearZero(row.minSurvivorInvestable) &&
    nearZero(row.ssa44PremiumSavings) &&
    nearZero(row.baseEndingAfterTaxEstate) &&
    nearZero(row.baseLifetimeTax) &&
    (nearZero(row.survivorShortfallYears) || row.lastJointYear.requiredShortfall > 0.5)
  )
}

function dobYearOf(plan: Plan, personId: string): number {
  const p = plan.household.people.find((x) => x.id === personId)!
  return Number(p.dob.slice(0, 4))
}

/** The plan with SSA-44 survivor relief forced on or off (other settings untouched). */
export function withSurvivorSsa44(plan: Plan, on: boolean): Plan {
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

/**
 * The widows-penalty insight's conversion patch for a given last joint year: a
 * 12%-bracket fill that REPLACES the plan's strategy. The insight offers it
 * only to plans that convert nothing (insights/detectors/widowsPenalty.ts),
 * where replacing and adding coincide; the survivor page's lever adds instead
 * (`SimulateOptions.additionalBracketFill`).
 */
export function conversionLeverPatch(startYear: number, lastJointYear: number): Record<string, unknown> {
  return {
    strategies: {
      rothConversion: {
        mode: 'fillToTarget',
        target: 'topOfBracket',
        targetValue: SURVIVOR_LEVER_BRACKET_PCT,
        startYear,
        endYear: lastJointYear,
      },
    },
  }
}

/**
 * Death ages worth sweeping for a person: the default grid clamped to
 * [current age, planning age), so every row is a genuine "dies earlier than
 * planned" scenario. The current attained age is included: dying at the end
 * of this year is a valid earlier-than-planned timing (`lastAliveYear =
 * dobYear + deathAge ≥ startYear`). Empty when no grid age fits.
 */
export function candidateDeathAges(plan: Plan, personId: string, startYear: number, grid: readonly number[]): number[] {
  const person = plan.household.people.find((p) => p.id === personId)!
  const currentAge = startYear - dobYearOf(plan, personId)
  return grid.filter((a) => a >= currentAge && a < person.longevity.planningAge)
}

/**
 * The Medicare premium difference of SSA-44 survivor relief: for each year of
 * the run without relief that the run with relief also has, premiums without
 * minus premiums with, summed in the order of the run without relief over
 * every year (`total`) and over the relief years only (`reliefYears`).
 */
export function ssa44PremiumDifference(
  without: readonly { readonly year: number; readonly medicarePremiums: number }[],
  withRelief: readonly { readonly year: number; readonly medicarePremiums: number }[],
  reliefYears: readonly number[],
): { total: number; reliefYears: number } {
  let total = 0
  let relief = 0
  for (const y of without) {
    const on = withRelief.find((x) => x.year === y.year)
    if (!on) continue
    total += y.medicarePremiums - on.medicarePremiums
    if (reliefYears.includes(y.year)) relief += y.medicarePremiums - on.medicarePremiums
  }
  return { total, reliefYears: relief }
}

/**
 * The years after the death year in which someone is alive and the ledger's
 * required-spending shortfall exceeds ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS.
 */
export function survivorShortfallYearCount(
  years: readonly { readonly year: number; readonly requiredShortfall: number; readonly people: readonly { readonly alive: boolean }[] }[],
  deathYear: number,
): number {
  return years.filter(
    (y) => y.year > deathYear && y.people.some((p) => p.alive) && y.requiredShortfall > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS,
  ).length
}

/**
 * What the lever did in each window year of its run, and why
 * (#SurvivorLeverYearReason), read from executed dollars in this order: a
 * year a named conversion action suppressed; raised when it executed more
 * than the plan's own target capped at the convertible balance (own); covered
 * when it executed something and at least the fill; short when it executed
 * less than the fill; then, with no fill asked, no balance to convert, a fill
 * its own sizing cut to nothing, or no room in the bracket. Every comparison
 * allows the ledger's conversion epsilon.
 */
export function leverYears(lever: ProjectionResult): { raisedYears: number[]; coveredYears: number[]; years: SurvivorLeverYear[] } {
  const eps = AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS
  const executed = new Map(lever.years.map((y) => [y.year, y.rothConversion]))
  const years = (lever.additionalBracketFill ?? []).map((row): SurvivorLeverYear => {
    const own = Math.min(row.ownTargetPlanDollars, row.convertiblePlanDollars)
    const converted = executed.get(row.year) ?? 0
    const reason: SurvivorLeverYearReason = row.suppressedByNamedConversions
      ? 'named-conversions'
      : converted > own + eps
        ? 'raised'
        : converted > eps && converted >= row.fillTargetPlanDollars - eps
          ? 'covered'
          : row.fillTargetPlanDollars > converted + eps
            ? 'short'
            : row.convertiblePlanDollars <= eps
              ? 'no-balance'
              : row.fillNotes.length > 0
                ? 'fill-limited'
                : 'no-room'
    const notes = reason === 'fill-limited' ? [...row.fillNotes, ...row.ledgerNotes] : row.ledgerNotes
    return { year: row.year, reason, notes }
  })
  return {
    raisedYears: years.filter((y) => y.reason === 'raised').map((y) => y.year),
    coveredYears: years.filter((y) => y.reason === 'covered').map((y) => y.year),
    years,
  }
}

/**
 * One death timing = three full ledger runs: the SSA-44 off/on pair (whichever
 * matches the plan's own setting doubles as the base run; the field is
 * engine-identical to absent when off) plus the lever run on the plan as
 * entered. Returns null when the timing yields no survivor year.
 */
function buildTimingRow(
  plan: Plan,
  opts: SurvivorTransitionOptions,
  personId: string,
  deathAge: number,
  planUsesSsa44: boolean,
): SurvivorTimingRow | null {
  const deathYear = dobYearOf(plan, personId) + deathAge
  const simOpts = { startYear: opts.startYear, taxCalculator: opts.taxCalculator, deathAgeByPersonId: { [personId]: deathAge } }

  const without = simulatePlan(withSurvivorSsa44(plan, false), simOpts)
  const withRelief = simulatePlan(withSurvivorSsa44(plan, true), simOpts)
  const base = planUsesSsa44 ? withRelief : without
  const baseSummary = summarizeProjection(plan, base)

  const lastJoint = base.years.find((y) => y.year === deathYear)
  const firstSurvivor = base.years.find((y) => y.year === deathYear + 1)
  if (!lastJoint || !firstSurvivor) return null

  const reliefYears = [deathYear + 1, deathYear + 2]
  const irmaaYears: SurvivorIrmaaYear[] = reliefYears
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
  const { total: ssa44PremiumSavings, reliefYears: ssa44ReliefYearSavings } = ssa44PremiumDifference(without.years, withRelief.years, reliefYears)

  const survivorYears = base.years.filter((y) => y.year > deathYear && y.people.some((p) => p.alive))
  const survivorShortfallYears = survivorShortfallYearCount(base.years, deathYear)
  const minSurvivorInvestable = survivorYears.length > 0 ? Math.min(...survivorYears.map((y) => y.investableTotal)) : 0

  // The lever: the same death timing, the plan as entered (its own SSA-44
  // setting), with a 12%-bracket fill added to its conversions through the
  // death year.
  const leverRun = simulatePlan(plan, {
    ...simOpts,
    additionalBracketFill: { bracketPct: SURVIVOR_LEVER_BRACKET_PCT, startYear: opts.startYear, endYear: deathYear },
  })
  const leverSummary = summarizeProjection(plan, leverRun)

  return {
    deceasedPersonId: personId,
    deathAge,
    deathYear,
    endYear: base.endYear,
    filingTimeline: filingTimeline(base),
    lastJointYear: {
      year: lastJoint.year,
      magi: lastJoint.magi,
      tax: lastJoint.tax,
      requiredShortfall: lastJoint.requiredShortfall,
      filingStatus: lastJoint.filingStatus,
    },
    firstSurvivorYear: {
      year: firstSurvivor.year,
      magi: firstSurvivor.magi,
      tax: firstSurvivor.tax,
      requiredShortfall: firstSurvivor.requiredShortfall,
      filingStatus: firstSurvivor.filingStatus,
    },
    ssBeforeDeath: lastJoint.incomes.socialSecurity,
    ssAfterDeath: firstSurvivor.incomes.socialSecurity,
    irmaaYears,
    ssa44PremiumSavings,
    ssa44ReliefYearSavings,
    survivorShortfallYears,
    minSurvivorInvestable,
    baseEndingAfterTaxEstate: baseSummary.endingAfterTaxEstate,
    baseLifetimeTax: baseSummary.lifetimeTaxesAndPenalties,
    conversionLever: {
      endingAfterTaxEstate: leverSummary.endingAfterTaxEstate,
      lifetimeTax: leverSummary.lifetimeTaxesAndPenalties,
      estateDelta: leverSummary.endingAfterTaxEstate - baseSummary.endingAfterTaxEstate,
      lifetimeTaxDelta: leverSummary.lifetimeTaxesAndPenalties - baseSummary.lifetimeTaxesAndPenalties,
      ...leverYears(leverRun),
    },
  }
}

/**
 * Every earlier-death timing of a two-adult married-filing-jointly plan: for
 * each person, the death ages of #candidateDeathAges whose death year is
 * before the survivor's last year. A timing whose ledger runs throw is skipped
 * and counted in `failedTimings`.
 */
export function survivorTransitionAnalysis(plan: Plan, opts: SurvivorTransitionOptions): SurvivorTransitionAnalysis {
  const eligible = plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2
  const planUsesSsa44 = plan.expenses.healthcare.ssa44?.survivorYears === true
  if (!eligible) return { eligible, planUsesSsa44, rows: [], failedTimings: 0 }

  const grid = opts.deathAges ?? [...SURVIVOR_DEATH_AGES]
  const rows: SurvivorTimingRow[] = []
  let failedTimings = 0

  for (const person of plan.household.people) {
    const survivor = plan.household.people.find((p) => p.id !== person.id)!
    const survivorLastYear = dobYearOf(plan, survivor.id) + survivor.longevity.planningAge
    for (const deathAge of candidateDeathAges(plan, person.id, opts.startYear, grid)) {
      const deathYear = dobYearOf(plan, person.id) + deathAge
      // Only genuine first deaths: the survivor must outlive this timing.
      if (deathYear >= survivorLastYear) continue
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
