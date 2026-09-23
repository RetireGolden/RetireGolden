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
 * a rounding step, so a numeric row is compared to half a cent.
 */
export interface WalkthroughRow {
  /** Stable key, unique within the table; the site keys rows on it. */
  readonly key: string
  /** The figure's name as the page shows it. */
  readonly label: string
  /** The hand value: a dollar amount, a count, or a published string or year. */
  readonly hand: number | string
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
  /** Reads the engine's figure off the year row (and the plan, for account ids). */
  readonly select: (year: YearResult, plan: Plan) => number | string | undefined
}

/** The ledger's own tolerance: ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS, half a cent. */
export const WALKTHROUGH_DEFAULT_TOLERANCE = 0.005

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
  readonly hand: number | string
  readonly engine: number | string | undefined
  /** The absolute tolerance the test applies to this row (numbers only). */
  readonly tolerance: number
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
      rows: table.rows.map((row) => ({
        key: row.key,
        label: row.label,
        hand: row.hand,
        engine: row.select(year, plan),
        tolerance: row.tolerance ?? WALKTHROUGH_DEFAULT_TOLERANCE,
        derivation: row.derivation,
        contract: row.contract,
      })),
    }
  })
  return { plan, tables }
}

/** Account id by type, for rows that read `balances`; throws if the type is absent. */
export function accountIdOfType(plan: Plan, type: Plan['accounts'][number]['type']): string {
  const account = plan.accounts.find((candidate) => candidate.type === type)
  if (!account) throw new Error(`no ${type} account in the plan`)
  return account.id
}
