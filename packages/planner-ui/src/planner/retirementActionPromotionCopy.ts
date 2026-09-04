/**
 * Shared user-facing copy for the promoted-schedule verdicts.
 *
 * Same idiom as `retirementActionReadinessVetoCopy.ts` and `acaVetoCopy.ts`:
 * exported strings and builders, no component, so the page, the explainer and
 * the report tell one story.
 *
 * THREE RULES, carried over from the charitable-gift authoring surface:
 *
 * 1. The engine's sentences render as the engine wrote them. Everything here is
 *    a frame that introduces one, or a statement about data the engine
 *    published (a trimmed owner, a per-year figure), never a restatement of a
 *    refusal in friendlier words.
 * 2. Nothing predicts a tax outcome and nothing says what to do with money.
 *    A verdict is reported; the household decides what to make of it.
 * 3. A withheld schedule is explained, not apologised for. The aggregate
 *    schedule stays on screen with its exact figures, and the copy says which
 *    side declined and what it declined about.
 */

import type {
  AggregateConversionPromotionComparabilityReason,
} from '@retiregolden/engine/projection/optimizerAggregateConversionPromotionRun'
import type {
  RetirementActionPromotion,
  RetirementActionPromotionYear,
} from '@retiregolden/engine/projection/optimizePlan'

export type RetirementActionPromotionTrimReason =
  RetirementActionPromotionYear['trims'][number]['reason']

// ---------------------------------------------------------------------------
// The published schedule
// ---------------------------------------------------------------------------

export const PROMOTED_SCHEDULE_HEADING = 'This schedule, account by account'

export const PROMOTED_SCHEDULE_INTRO =
  'Every conversion below names the person it belongs to, the account it comes out of, and the Roth IRA it ' +
  'lands in. Applying installs these named conversions on your plan.'

/**
 * Only sayable because the equality evidence backs it: the promoted candidate
 * and the aggregate winner are the same projection to the cent, every account,
 * every year. Nothing weaker may borrow this sentence.
 */
export const PROMOTED_SCHEDULE_EQUIVALENT_NOTE =
  'Naming the accounts changed nothing your projection does. This schedule and the exploratory schedule it ' +
  'came from produce the same year-by-year projection, to the cent, in every account and every year.'

/**
 * The repricing, stated as what it is. It names neither a cause nor a culprit:
 * the two schedules are different, they were priced separately, and the page
 * reports the named one's own figures.
 */
export function promotedScheduleRepricedNote(args: {
  readonly namedTotal: string
  readonly aggregateTotal: string
  readonly aggregateYearCount: number
}): string {
  const years = `${args.aggregateYearCount} year${args.aggregateYearCount === 1 ? '' : 's'}`
  return (
    "The figures on this page are this named schedule's own, from its own run of your full year-by-year " +
    `projection. The exploratory schedule it came from converts ${args.aggregateTotal} across ${years}; this ` +
    `one converts ${args.namedTotal}. They are two different schedules, so their figures are not ` +
    'interchangeable.'
  )
}

export const PROMOTED_SCHEDULE_EXPLORATORY_AGGREGATE_HEADING =
  'The exploratory schedule it came from'

export function promotedScheduleApplyHint(requestCount: number): string {
  const requests = `${requestCount} named conversion${requestCount === 1 ? '' : 's'}`
  return (
    `Apply installs ${requests} on your plan, each one naming its person, source account and Roth ` +
    'destination. Accept as manual is not offered for this schedule, because an aggregate manual schedule ' +
    'cannot carry those names.'
  )
}

/**
 * The patch is the recommendation. When it does not read back onto the plan
 * there is nothing to install, and the page says so instead of offering an
 * Apply that would install something else.
 */
export const PROMOTED_SCHEDULE_UNREADABLE_FRAME =
  'This schedule could not be read back onto your plan, so it is not offered for applying.'

// ---------------------------------------------------------------------------
// Trimmed owners
// ---------------------------------------------------------------------------

/**
 * One owner whose share no lawful Roth IRA could receive.
 *
 * The employer-plan wording is the harder of the two, and it is the shipped
 * example couple's own shape. It states the boundary RetireGolden models and
 * stops: it does not promise the share would convert under some other reading,
 * and it does not fault the household for how its accounts are arranged.
 */
export function promotionTrimExplanation(
  ownerName: string,
  reason: RetirementActionPromotionTrimReason,
): string {
  return reason === 'ownerHoldsOnlyEmployerDesignatedRoth'
    ? `${ownerName}'s only Roth account in this plan sits inside an employer plan. RetireGolden models a ` +
      `Roth conversion landing only in the same person's own Roth IRA, so ${ownerName}'s share is not part ` +
      'of this schedule.'
    : `${ownerName} holds no Roth account in this plan. A Roth conversion has to land in the same person's ` +
      `own Roth IRA, so ${ownerName}'s share is not part of this schedule.`
}

export const PROMOTION_TRIM_FRAME = 'Not everyone in this household has a share in this schedule:'

// ---------------------------------------------------------------------------
// The withheld verdicts
// ---------------------------------------------------------------------------

export const PROMOTION_WITHHELD_HEADING = 'Why this schedule stays exploratory'

export const PROMOTION_NOT_COMPARABLE_FRAME =
  'RetireGolden named the people, source IRAs and Roth destinations this schedule implies, ran the result ' +
  'through your full year-by-year projection, and your plan did not execute it as written. The schedule ' +
  'above keeps its exact figures and stays exploratory.'

export const PROMOTION_NOT_PROMOTED_FRAME =
  'RetireGolden could not name the people, source IRAs and Roth destinations this schedule implies, so ' +
  'there was nothing to run. The schedule above keeps its exact figures and stays exploratory.'

export const PROMOTION_REPRICED_NOT_RECOMMENDED_FRAME =
  'Naming the people, source IRAs and Roth destinations produced a different schedule, and on its own run ' +
  'of your full year-by-year projection it did not rank ahead of what it would have replaced. The schedule ' +
  'above keeps its exact figures and stays exploratory.'

export function promotionWithheldFrame(
  promotion: Exclude<RetirementActionPromotion, { outcome: 'equivalent' | 'repriced' }>,
): string {
  if (promotion.outcome === 'notComparable') return PROMOTION_NOT_COMPARABLE_FRAME
  if (promotion.outcome === 'notPromoted') return PROMOTION_NOT_PROMOTED_FRAME
  return PROMOTION_REPRICED_NOT_RECOMMENDED_FRAME
}

/**
 * Which side of the comparison declined, in one sentence per reason code. The
 * engine publishes a code here and no message, so this is the frame the code
 * gets; the projection's own diagnostics render verbatim underneath it.
 */
export function promotionComparabilityFrame(
  reason: AggregateConversionPromotionComparabilityReason,
): string {
  switch (reason) {
    case 'allocatedRankingNotComparable':
      return 'Your projection did not execute the named conversions as written.'
    case 'acaEvidenceNonActionable':
      return 'At least one year could not be priced as executable under the ACA evidence on record, on one ' +
        'side of the comparison or the other.'
    case 'horizonMismatch':
      return 'The two projections do not cover the same years.'
    case 'aggregateProjectionNotComparable':
      return 'The exploratory projection falls outside what a cent-for-cent comparison can hold.'
    case 'allocatedProjectionNotComparable':
      return 'The named projection falls outside what a cent-for-cent comparison can hold.'
  }
}

export const PROMOTION_ENGINE_EVIDENCE_FRAME = 'What your projection reported:'

export const PROMOTION_ISSUE_FRAME = 'What could not be named:'

/**
 * The frame stands over a list, so it may only render when there is a list to
 * introduce. An engine that gave no sentence is its own finding.
 */
export const PROMOTION_NO_REASON_GIVEN_FRAME =
  'Your projection recorded no reason for this.'

// ---------------------------------------------------------------------------
// The IRA facts a named conversion needs
// ---------------------------------------------------------------------------

function formatAccountList(names: readonly string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/**
 * States what is not on record and what needs it. It does not claim that
 * recording the facts would produce a recommendation: the projection decides
 * that, and a promise here would be one this surface cannot keep.
 */
export function promotionIraFactsGapNote(accountNames: readonly string[]): string {
  if (accountNames.length === 0) {
    throw new RangeError('The IRA facts gap note needs at least one account to name')
  }
  const list = formatAccountList(accountNames)
  const subject = accountNames.length === 1 ? 'this account' : 'these accounts'
  return (
    `RetireGolden has no IRA classification on record for ${list}. A named conversion needs one for the ` +
    `account it comes out of, so ${subject} cannot be named as a source.`
  )
}

export const PROMOTION_IRA_FACTS_LINK_PREFIX = 'Record what an IRA needs under '

export const PROMOTION_IRA_FACTS_LINK_SUFFIX = ', then re-run the optimizer.'

// ---------------------------------------------------------------------------
// Shared with the explainer and the report
// ---------------------------------------------------------------------------

/**
 * One clause naming what the promotion loop made of a withheld winner, for
 * surfaces that already carry the veto's own sentence and have room for one
 * more. Null for a published promotion and for a plan that never ran the loop.
 */
export function promotionWithheldClause(
  promotion: RetirementActionPromotion | null | undefined,
): string | null {
  if (!promotion) return null
  switch (promotion.outcome) {
    case 'notComparable':
      return 'Naming the people, source IRAs and Roth destinations produced a schedule your projection did ' +
        'not execute as written.'
    case 'notPromoted':
      return 'The people, source IRAs and Roth destinations this schedule implies could not be named from ' +
        'what the plan records.'
    case 'repricedNotRecommended':
      return 'Naming the people, source IRAs and Roth destinations produced a different schedule, and it ' +
        'did not rank ahead of what it would have replaced.'
    default:
      return null
  }
}

/** Marks a published winner as the named schedule, for the report's winner line. */
export function promotedWinnerLabelSuffix(
  promotion: RetirementActionPromotion | null | undefined,
): string {
  if (promotion?.outcome === 'equivalent') return ' (named account schedule)'
  if (promotion?.outcome === 'repriced') {
    return ' (named account schedule, priced on its own projection)'
  }
  return ''
}
