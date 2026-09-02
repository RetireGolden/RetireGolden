/**
 * The two promotion surfaces on the Optimize page.
 *
 * `PromotedSchedulePanel` presents an identity-complete schedule: per year, per
 * person, out of a named account and into a named Roth IRA. That table is the
 * evidence the whole workstream exists to produce, and it renders from the plan
 * the recommendation actually installs, not from a summary of it.
 *
 * `PromotionWithheldPanel` presents the three verdicts that publish nothing.
 * The projection's own sentences render verbatim; this file owns only the
 * frames around them, and the one plan-derived note about IRA facts that a
 * household can act on.
 */

import { Link } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { RetirementActionPromotionYear } from '@retiregolden/engine/projection/optimizePlan'

import { fmtMoney } from './format'
import {
  promotedScheduleRepricedNote,
  promotionComparabilityFrame,
  promotionIraFactsGapNote,
  promotionTrimExplanation,
  promotionWithheldFrame,
  PROMOTED_SCHEDULE_EQUIVALENT_NOTE,
  PROMOTED_SCHEDULE_EXPLORATORY_AGGREGATE_HEADING,
  PROMOTED_SCHEDULE_HEADING,
  PROMOTED_SCHEDULE_INTRO,
  PROMOTED_SCHEDULE_UNREADABLE_FRAME,
  PROMOTION_ENGINE_EVIDENCE_FRAME,
  PROMOTION_IRA_FACTS_LINK_PREFIX,
  PROMOTION_IRA_FACTS_LINK_SUFFIX,
  PROMOTION_ISSUE_FRAME,
  PROMOTION_NO_REASON_GIVEN_FRAME,
  PROMOTION_TRIM_FRAME,
  PROMOTION_WITHHELD_HEADING,
} from './retirementActionPromotionCopy'
import {
  promotionTrimmedOwners,
  scheduleConversionTotal,
  unclassifiedIraSourceAccounts,
  type PromotedScheduleRead,
  type PublishedRetirementActionPromotion,
  type RetirementActionPromotionTrim,
  type WithheldRetirementActionPromotion,
} from './optimizePagePromotion'
import { formatPositiveUsdCents } from './retirementActionManualEditor'
import {
  RETIREMENT_ACTION_IRA_FACTS_ANCHOR,
  RETIREMENT_ACTION_IRA_FACTS_HEADING,
} from './sections/RetirementActionEligibilityFactsEditor'
import { ScrollRegion } from './ScrollRegion'

function trimSentences(
  plan: Readonly<Plan>,
  trims: readonly RetirementActionPromotionTrim[],
): readonly { readonly key: string; readonly sentence: string }[] {
  return trims.map((trim) => {
    const person = plan.household.people.find((entry) => entry.id === trim.ownerPersonId)
    return {
      key: `${trim.ownerPersonId}:${trim.reason}`,
      sentence: promotionTrimExplanation(person?.name ?? trim.ownerPersonId, trim.reason),
    }
  })
}

function TrimList({
  plan,
  years,
}: {
  plan: Readonly<Plan>
  years: readonly RetirementActionPromotionYear[]
}) {
  const sentences = trimSentences(plan, promotionTrimmedOwners(years))
  if (sentences.length === 0) return null
  return (
    <div className="callout callout--warn" role="status">
      <strong>{PROMOTION_TRIM_FRAME}</strong>
      <ul>
        {sentences.map((entry) => <li key={entry.key}>{entry.sentence}</li>)}
      </ul>
    </div>
  )
}

/** The facts link, in the same shape the charitable-gift authoring surface uses. */
function IraFactsLink({ plan }: { plan: Readonly<Plan> }) {
  const unclassified = unclassifiedIraSourceAccounts(plan)
  if (unclassified.length === 0) return null
  return (
    <div className="callout callout--warn" role="status">
      <strong>{promotionIraFactsGapNote(unclassified.map((account) => account.name))}</strong>
      <p className="card-hint">
        {PROMOTION_IRA_FACTS_LINK_PREFIX}
        <Link to={`/plan/${plan.id}/strategy#${RETIREMENT_ACTION_IRA_FACTS_ANCHOR}`}>
          {RETIREMENT_ACTION_IRA_FACTS_HEADING}
        </Link>
        {PROMOTION_IRA_FACTS_LINK_SUFFIX}
      </p>
    </div>
  )
}

/**
 * The published schedule, named.
 *
 * `read` is the same materialization Apply installs, passed in rather than
 * recomputed so the table and the button can never describe different plans.
 */
export function PromotedSchedulePanel({
  read,
  promotion,
  winnerConversions,
}: {
  read: PromotedScheduleRead
  promotion: PublishedRetirementActionPromotion
  winnerConversions: readonly { year: number; amount: number }[]
}) {
  if (read.status === 'unreadable') {
    return (
      <div className="card">
        <h2>{PROMOTED_SCHEDULE_HEADING}</h2>
        <div className="callout callout--warn" role="status">
          <strong>{PROMOTED_SCHEDULE_UNREADABLE_FRAME}</strong>
          {read.issues.length > 0 ? (
            <ul>
              {read.issues.map((issue, index) => <li key={`${index}:${issue}`}>{issue}</li>)}
            </ul>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>{PROMOTED_SCHEDULE_HEADING}</h2>
      <p className="card-hint">{PROMOTED_SCHEDULE_INTRO}</p>
      <ScrollRegion label={PROMOTED_SCHEDULE_HEADING}>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Person</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {read.rows.map((row) => (
              <tr key={`${row.actionId}:${row.allocationId}`}>
                <td>{row.year}</td>
                <td>{row.ownerName}</td>
                <td>{row.sourceAccountName}</td>
                <td>{row.destinationAccountName}</td>
                <td>{formatPositiveUsdCents(row.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <p className="field-hint">
        {promotion.outcome === 'equivalent'
          ? PROMOTED_SCHEDULE_EQUIVALENT_NOTE
          : promotedScheduleRepricedNote({
              namedTotal: fmtMoney(scheduleConversionTotal(winnerConversions)),
              aggregateTotal: fmtMoney(scheduleConversionTotal(promotion.aggregateConversions)),
              aggregateYearCount: promotion.aggregateConversions.length,
            })}
      </p>
      {promotion.outcome === 'repriced' ? (
        <p className="field-hint">
          {PROMOTED_SCHEDULE_EXPLORATORY_AGGREGATE_HEADING}:{' '}
          {promotion.aggregateConversions
            .map((conversion) => `${conversion.year} ${fmtMoney(conversion.amount)}`)
            .join(' · ')}
        </p>
      ) : null}
      <TrimList plan={read.plan} years={promotion.years} />
    </div>
  )
}

/** The three verdicts that publish nothing, each with the engine's own reasons. */
export function PromotionWithheldPanel({
  plan,
  promotion,
}: {
  plan: Readonly<Plan>
  promotion: WithheldRetirementActionPromotion
}) {
  const engineSentences = promotion.outcome === 'notComparable'
    ? promotion.diagnostics
    : promotion.outcome === 'notPromoted'
      ? promotion.issues.map((issue) => issue.detail)
      : []
  return (
    <div className="card">
      <h2>{PROMOTION_WITHHELD_HEADING}</h2>
      <p className="muted" style={{ margin: 0 }}>{promotionWithheldFrame(promotion)}</p>
      {promotion.outcome === 'notComparable' ? (
        <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
          {promotionComparabilityFrame(promotion.reason)}
        </p>
      ) : null}
      {engineSentences.length > 0 ? (
        <div className="callout callout--warn" role="status">
          <strong>
            {promotion.outcome === 'notPromoted'
              ? PROMOTION_ISSUE_FRAME
              : PROMOTION_ENGINE_EVIDENCE_FRAME}
          </strong>
          <ul>
            {engineSentences.map((sentence, index) => (
              <li key={`${index}:${sentence}`}>{sentence}</li>
            ))}
          </ul>
        </div>
      ) : promotion.outcome === 'repricedNotRecommended' ? null : (
        <div className="callout callout--warn" role="status">
          {PROMOTION_NO_REASON_GIVEN_FRAME}
        </div>
      )}
      {promotion.outcome === 'repricedNotRecommended' ? (
        <TrimList plan={plan} years={promotion.years} />
      ) : null}
      <IraFactsLink plan={plan} />
    </div>
  )
}
