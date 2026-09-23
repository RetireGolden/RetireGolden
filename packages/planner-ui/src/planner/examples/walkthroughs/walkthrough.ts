import type { Plan } from '@retiregolden/engine/model/plan'

import { projectPlan } from '../../../projection'
import { EXAMPLE_FIXED_YEAR } from '../buildContext'

/** One year row of the projection the planner displays. */
export type YearResult = ReturnType<typeof projectPlan>['result']['years'][number]

/**
 * A walkthrough is one curated example plan whose chosen projection years are
 * worked out by hand from the plan's inputs and the engine's documented
 * contracts, without running the engine. Each row names a published figure,
 * the hand value with the arithmetic that produced it, and the contract the
 * arithmetic follows. The walkthrough test holds the engine to every row; the
 * walkthrough exporter publishes the rows beside the engine's values so the
 * site can render them.
 *
 * The hand values are written as the expressions the derivation states
 * (`1_850_000 / 26.5`, not `69811.32`), so the test compares exact values and
 * the reader can redo the arithmetic. No contract used by a walkthrough states
 * a rounding step, so a numeric row is compared to half a cent unless the
 * figure's own contract promises less: a value sized by bisection "to $0.01"
 * states that tolerance, and where the bisection returns the lower bound the
 * row says so with `bound: 'below'`, which makes the comparison one-sided.
 */
export interface WalkthroughRow {
  /** Stable key, unique within the table; the site keys rows on it. */
  readonly key: string
  /** The figure's name as the page shows it. */
  readonly label: string
  /**
   * The hand value: a dollar amount, a count, a published string or year, or
   * null when the contract says the engine publishes the field as null in
   * this year (a credit that cannot be priced, for example); the row then
   * proves the absence, and `unit` says what the figure would have been.
   */
  readonly hand: number | string | null
  /** The arithmetic, in words and numbers, that produces `hand` from the inputs. */
  readonly derivation: string
  /** The contract the derivation follows: a worksheet family, a doc comment path, a parameter. */
  readonly contract: string
  /**
   * Absolute tolerance for a numeric row. Absent means half a cent, the
   * ledger's own tolerance; a figure whose contract promises less (a value
   * sized by bisection "to $0.01") states its contract's tolerance here.
   */
  readonly tolerance?: number
  /**
   * `'below'` when the contract returns a lower bound: the engine's figure is
   * then held to the half-open band (hand − tolerance, hand], never above the
   * hand value. Absent means the two-sided band |engine − hand| ≤ tolerance.
   */
  readonly bound?: 'below'
  /**
   * What the figure is: dollars (the default for a number), a count, a
   * percentage or a calendar year; a string row is text. The site formats on it.
   */
  readonly unit?: 'dollars' | 'count' | 'percent' | 'year'
  /**
   * Reads the engine's figure off the year row (and the plan, for account
   * ids). null is a published null, which a null hand value expects;
   * undefined means the engine published no figure at all, which no row
   * accepts.
   */
  readonly select: (year: YearResult, plan: Plan) => number | string | null | undefined
}

/** The ledger's own tolerance: ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS, half a cent. */
export const WALKTHROUGH_DEFAULT_TOLERANCE = 0.005

export type WalkthroughUnit = 'dollars' | 'count' | 'percent' | 'year' | 'text'

export interface WalkthroughTable {
  /** The projection year worked by hand. */
  readonly year: number
  /** Why this year: what it shows that the others do not. */
  readonly why: string
  readonly rows: readonly WalkthroughRow[]
}

export interface Walkthrough {
  /** Matches the walkthrough test file's name and the example's id. */
  readonly id: string
  readonly title: string
  /** The curated example this walks through, by its `exampleId`. */
  readonly exampleId: string
  /** Repo path of the independent check of the derivation, DOCS/walkthroughs/REVIEW-<date>.md. */
  readonly review: string
  /** One-paragraph statement of the plan as built, for the page. */
  readonly inputs: string
  /** Reading choices the contracts leave open, each with the reading used. */
  readonly contractNotes: readonly string[]
  /** The years worked by hand, in order; the first is the projection's first year. */
  readonly tables: readonly WalkthroughTable[]
  readonly build: () => Plan
}

export interface WalkthroughRowResult {
  readonly key: string
  readonly label: string
  readonly hand: number | string | null
  readonly engine: number | string | null | undefined
  /** The absolute tolerance the test applies to this row (numbers only). */
  readonly tolerance: number
  /** Present when the band is one-sided: the engine figure is at or below the hand value. */
  readonly bound?: 'below'
  readonly unit: WalkthroughUnit
  readonly derivation: string
  readonly contract: string
}

export interface WalkthroughTableResult {
  readonly year: number
  readonly why: string
  readonly rows: readonly WalkthroughRowResult[]
}

/** Runs the walkthrough's example at the fixed start year and reads every row of every table. */
export function runWalkthrough(walkthrough: Walkthrough): {
  readonly plan: Plan
  readonly tables: readonly WalkthroughTableResult[]
} {
  const plan = walkthrough.build()
  const { result } = projectPlan(plan, { startYear: EXAMPLE_FIXED_YEAR })
  const tables = walkthrough.tables.map((table) => {
    const year = result.years.find((row) => row.year === table.year)
    if (!year) throw new Error(`walkthrough ${walkthrough.id}: no ${table.year} row`)
    return {
      year: table.year,
      why: table.why,
      rows: table.rows.map((row): WalkthroughRowResult => {
        const result: WalkthroughRowResult = {
          key: row.key,
          label: row.label,
          hand: row.hand,
          engine: row.select(year, plan),
          tolerance: row.tolerance ?? WALKTHROUGH_DEFAULT_TOLERANCE,
          unit: typeof row.hand === 'string' ? 'text' : (row.unit ?? 'dollars'),
          derivation: row.derivation,
          contract: row.contract,
        }
        return row.bound === 'below' ? { ...result, bound: 'below' } : result
      }),
    }
  })
  return { plan, tables }
}

/**
 * Whether the engine's figure holds the hand value: a published null
 * exactly; strings exactly; numbers within the row's tolerance, one-sided
 * (at or below the hand value, and above hand − tolerance) when the row says
 * `bound: 'below'`. Returns a message naming the row when it does not, null
 * when it does.
 */
export function walkthroughRowProblem(row: WalkthroughRowResult, at: string): string | null {
  if (row.hand === null) {
    return row.engine === null ? null : `${at}: engine published ${String(row.engine)}, not the null the contract promises`
  }
  if (typeof row.hand === 'string') {
    return row.engine === row.hand ? null : `${at}: engine ${String(row.engine)} is not the hand value ${row.hand}`
  }
  if (typeof row.engine !== 'number') return `${at}: engine published ${String(row.engine)}, not a number`
  const gap = row.engine - row.hand
  if (row.bound === 'below') {
    return gap <= 0 && gap > -row.tolerance
      ? null
      : `${at}: engine ${row.engine} is not within (${row.hand} − ${row.tolerance}, ${row.hand}]`
  }
  return Math.abs(gap) <= row.tolerance ? null : `${at}: engine ${row.engine} is more than ${row.tolerance} from the hand value ${row.hand}`
}

/** Account id by type, for rows that read `balances`; throws if the type is absent. */
export function accountIdOfType(plan: Plan, type: Plan['accounts'][number]['type']): string {
  const account = plan.accounts.find((candidate) => candidate.type === type)
  if (!account) throw new Error(`no ${type} account in the plan`)
  return account.id
}
