/**
 * Renders a `scenario` block: a named example household with its assumptions
 * laid out as label/value rows, plus an optional plain-language takeaway.
 */

import { renderInline } from '../inlineMarkdown'
import type { ScenarioBlockData } from '../learningRegistry'

export function ScenarioCard({ block }: { block: ScenarioBlockData }) {
  return (
    <aside className="learn-scenario" aria-label={`Scenario: ${block.name}`}>
      <p className="learn-scenario-name">{block.name}</p>
      <dl className="learn-scenario-grid">
        {block.assumptions.map((a) => (
          <div key={a.label} className="learn-scenario-row">
            <dt>{a.label}</dt>
            <dd>{a.value}</dd>
          </div>
        ))}
      </dl>
      {block.summary && <p className="learn-scenario-summary">{renderInline(block.summary)}</p>}
    </aside>
  )
}
