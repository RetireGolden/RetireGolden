/**
 * What a Plan already says about its named charitable gifts, plus the copy the
 * two charitable controls have to share.
 *
 * Kept free of the projection so the Charitable-giving card can state the
 * stand-down without pulling the simulator into its bundle, and so the
 * eligibility-facts editor can surface a gift's year without depending on the
 * authoring form.
 */

import type {
  QualifiedCharitableDistributionRequest,
} from '@retiregolden/engine/actions/contract'
import type { Plan } from '@retiregolden/engine/model/plan'

export const QCD_SECTION_HEADING = 'Charitable gifts from an IRA'

/**
 * The #199 stand-down, written once and shown wherever the two charitable
 * controls appear. It states what the projection does, not what the law
 * requires.
 */
export const QCD_NAMED_STANDS_DOWN_SCALAR =
  'In any year with a gift scheduled here, the recurring “QCD per year” amount under Charitable giving gives nothing.'

/**
 * Why a recurring amount and a scheduled gift do not simply coexist. The
 * simulator cannot attribute a scalar gift to a donor, so it will not claim to
 * know how much of that donor's post-70½ contribution offset the scalar spent.
 */
export const QCD_SCALAR_HISTORY_NOTE =
  'RetireGolden keeps no record of which donor a recurring gift came from, so a donor who gives that way in an earlier projected year cannot have the post-70½ contribution history a scheduled gift needs. Set the recurring amount to $0 to schedule gifts one at a time.'

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** The named gifts a Plan carries, in schedule order. */
export function namedQcdActions(
  plan: Readonly<Plan>,
): readonly Readonly<QualifiedCharitableDistributionRequest>[] {
  return plan.strategies.retirementActions
    .filter(
      (action): action is QualifiedCharitableDistributionRequest => action.kind === 'qcd',
    )
    .slice()
    .sort((left, right) =>
      left.year - right.year ||
      compareStrings(left.executionDate ?? '', right.executionDate ?? '') ||
      left.executionSequence - right.executionSequence ||
      compareStrings(left.actionId, right.actionId))
}

function distinctSortedYears(years: readonly number[]): readonly number[] {
  return [...new Set(years)].sort((left, right) => left - right)
}

/** Every tax year this Plan schedules a gift in. */
export function namedQcdYears(plan: Readonly<Plan>): readonly number[] {
  return distinctSortedYears(namedQcdActions(plan).map((action) => action.year))
}

/** The tax years a source IRA is asked to fund a gift in. */
export function namedQcdYearsForSource(
  plan: Readonly<Plan>,
  sourceAccountId: string,
): readonly number[] {
  return distinctSortedYears(
    namedQcdActions(plan)
      .filter((action) => action.allocation.sourceAccountId === sourceAccountId)
      .map((action) => action.year),
  )
}

/** The tax years a donor is asked to give in. */
export function namedQcdYearsForDonor(
  plan: Readonly<Plan>,
  donorPersonId: string,
): readonly number[] {
  return distinctSortedYears(
    namedQcdActions(plan)
      .filter((action) => action.donorPersonId === donorPersonId)
      .map((action) => action.year),
  )
}
