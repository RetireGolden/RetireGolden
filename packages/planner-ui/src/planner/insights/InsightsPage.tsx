import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { usePlan } from '../planContextCore'
import { useProjection } from '../useProjection'
import { packForYear } from '@retiregolden/engine/params'
import { runScreen } from '@retiregolden/engine/insights/runInsights'
import type { InsightCard, InsightCategory } from '@retiregolden/engine/insights/types'
import { readLocal, STORAGE_KEYS, writeLocal } from '../../data/localStore'
import { CATEGORY_LABELS } from './categoryLabels'
import { InsightCardView } from './InsightCardView'
import { LiveStatus } from '../LiveStatus'

function insightRenderKey(card: InsightCard): string {
  return `${card.id}:${card.rationale}:${JSON.stringify(card.action)}`
}

function isDismissedCardIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((cardId) => typeof cardId === 'string')
}

function dismissedInsightsMap(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const map: Record<string, string[]> = {}
  for (const [planId, dismissed] of Object.entries(value)) {
    if (isDismissedCardIds(dismissed)) map[planId] = dismissed
  }
  return map
}

function readDismissedInsights(): Record<string, string[]> {
  const stored = readLocal(STORAGE_KEYS.insightsDismissed)
  if (!stored) return {}
  try {
    const parsed: unknown = JSON.parse(stored)
    return dismissedInsightsMap(parsed)
  } catch {
    return {}
  }
}

export function InsightsPage() {
  const { plan } = usePlan()
  const projectionView = useProjection(plan)

  // Manage dismissed cards state loaded from localStorage
  const [dismissedMap, setDismissedMap] = useState<Record<string, string[]>>(readDismissedInsights)

  // State for collapsible category groups (default expanded: true)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  // Screen-reader announcement for dismiss/restore (visual change is otherwise silent).
  const [liveMessage, setLiveMessage] = useState('')

  // Dismissing unmounts the control that had focus, which dropped keyboard
  // focus to <body> (#505). Record where focus should land before the card
  // goes, then move it once the new list has rendered: the next card in
  // reading order (across groups, so the last card of a group hands off to
  // the next group's first card), else the previous one; a neighbour that
  // sits in a collapsed group is unmounted, so its group's heading toggle
  // stands in — the dismissed card's own group first, if it survived — and
  // Restore is the target only when no group is left at all.
  const pageRef = useRef<HTMLElement>(null)
  const pendingFocus = useRef<{
    next: InsightCard | null
    prev: InsightCard | null
    category: InsightCategory
  } | null>(null)

  // Save dismissed cards to localStorage
  const dismissCard = (card: InsightCard, inReadingOrder: InsightCard[]) => {
    const at = inReadingOrder.findIndex((c) => c.id === card.id)
    pendingFocus.current = {
      next: inReadingOrder[at + 1] ?? null,
      prev: at > 0 ? (inReadingOrder[at - 1] ?? null) : null,
      category: card.category,
    }
    const nextMap = {
      ...dismissedMap,
      [plan.id]: [...(dismissedMap[plan.id] ?? []), card.id],
    }
    setDismissedMap(nextMap)
    writeLocal(STORAGE_KEYS.insightsDismissed, JSON.stringify(nextMap))
    setLiveMessage(`Insight dismissed. ${nextMap[plan.id]!.length} dismissed on this plan.`)
  }

  useLayoutEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    const page = pageRef.current
    if (!page) return
    const escape = (value: string) =>
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
    const dismissOf = (card: InsightCard | null) =>
      card ? page.querySelector<HTMLElement>(`[data-insight-id="${escape(card.id)}"] .insight-dismiss`) : null
    const headingOf = (category: InsightCategory | null | undefined) =>
      category
        ? page.querySelector<HTMLElement>(`[data-insight-category="${escape(category)}"] .insight-category-header`)
        : null
    const target =
      dismissOf(pending.next) ??
      dismissOf(pending.prev) ??
      headingOf(pending.category) ??
      headingOf(pending.next?.category) ??
      headingOf(pending.prev?.category) ??
      page.querySelector<HTMLElement>('[data-insight-restore]')
    target?.focus()
  }, [dismissedMap])

  // Restore all dismissed cards for this plan
  const restoreDismissed = () => {
    const restoredCount = dismissedMap[plan.id]?.length ?? 0
    const nextMap = { ...dismissedMap }
    delete nextMap[plan.id]
    setDismissedMap(nextMap)
    writeLocal(STORAGE_KEYS.insightsDismissed, JSON.stringify(nextMap))
    setLiveMessage(
      `Restored ${restoredCount} dismissed insight${restoredCount === 1 ? '' : 's'}.`,
    )
  }

  // Run detectors synchronously
  const allCards = useMemo(() => {
    const paramsLookup = packForYear(projectionView.startYear)
    const ctx = {
      plan,
      projection: {
        result: projectionView.result,
        summary: projectionView.summary,
        startYear: projectionView.startYear,
        deflate: projectionView.deflate,
      },
      params: paramsLookup.pack,
    }
    return runScreen(ctx)
  }, [plan, projectionView])

  // Filter out dismissed cards
  const planDismissed = useMemo(() => dismissedMap[plan.id] ?? [], [dismissedMap, plan.id])
  const visibleCards = useMemo(() => {
    return allCards.filter((card) => !planDismissed.includes(card.id))
  }, [allCards, planDismissed])

  // Group visible cards by category
  const groupedCards = useMemo(() => {
    const groups: Partial<Record<InsightCategory, InsightCard[]>> = {}
    for (const card of visibleCards) {
      if (!groups[card.category]) {
        groups[card.category] = []
      }
      groups[card.category]!.push(card)
    }
    return groups
  }, [visibleCards])
  // The cards as the page lays them out, group by group.
  const cardsInReadingOrder = useMemo(() => Object.values(groupedCards).flat(), [groupedCards])

  const toggleCategory = (cat: InsightCategory) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }))
  }

  return (
    <section ref={pageRef}>
      <LiveStatus message={liveMessage} />
      <div className="card">
        <h2>Insights</h2>
        <p className="card-hint">
          RetireGolden scans your plan for modeled opportunities worth comparing. These findings update live as you
          edit, and each one can be previewed as a scenario before anything in your plan changes.
        </p>
        <div className="callout callout--info">
          <strong>Educational only.</strong> These findings are for educational purposes based on the rules and assumptions modeled. They do not constitute financial, tax, or legal advice.
        </div>
      </div>

      <div className="insight-optimizer-row">
        <div className="card">
          <h2>Roth & Tax Optimizer</h2>
          <p className="card-hint">
            Compare candidate Roth-conversion schedules on your full year-by-year projection, ranked by the objective you select.
          </p>
          <Link to={`/plan/${plan.id}/optimize`} className="btn btn-primary btn-small">
            Run optimizer →
          </Link>
        </div>

        {plan.incomes.some((i) => i.type === 'socialSecurity') && (
          <div className="card">
            <h2>Social Security Optimizer</h2>
            <p className="card-hint">
              Run every claiming-age combination through your full plan and rank them by the objective you choose.
            </p>
            <Link to={`/plan/${plan.id}/social-security-analysis`} className="btn btn-secondary btn-small">
              Run SS sweep →
            </Link>
          </div>
        )}
      </div>

      {visibleCards.length === 0 ? (
        <div className="card empty-state">
          <h2>No opportunities found right now</h2>
          <p className="muted insight-empty-note">
            Your plan already covers the big levers or no new opportunities were detected. Try adjusting your strategy or assumptions.
          </p>
          {planDismissed.length > 0 && (
            <button type="button" className="btn btn-secondary btn-small" data-insight-restore onClick={restoreDismissed}>
              Restore dismissed insights
            </button>
          )}
        </div>
      ) : (
        <div>
          {Object.entries(groupedCards).map(([cat, cards]) => {
            const category = cat as InsightCategory
            const isCollapsed = collapsedCategories[category] ?? false
            return (
              <div key={category} className="insight-category-group" data-insight-category={category}>
                <h2 className="insight-category-heading">
                  <button
                    type="button"
                    className="insight-category-header"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleCategory(category)}
                  >
                    <span>
                      {CATEGORY_LABELS[category]} ({cards.length})
                    </span>
                    <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points={isCollapsed ? '6 9 12 15 18 9' : '6 15 12 9 18 15'} />
                    </svg>
                  </button>
                </h2>
                {!isCollapsed && (
                  <div className="insight-cards-list">
                    {cards.map((card) => (
                      <InsightCardView key={insightRenderKey(card)} card={card} onDismiss={() => dismissCard(card, cardsInReadingOrder)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {planDismissed.length > 0 && (
            <div className="insight-restore-row">
              <button type="button" className="btn btn-secondary btn-small" data-insight-restore onClick={restoreDismissed}>
                Restore dismissed insights ({planDismissed.length})
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
