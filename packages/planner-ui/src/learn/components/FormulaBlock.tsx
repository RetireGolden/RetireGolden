/**
 * Renders a `formula` block: the expression, a "where" list defining each
 * symbol, whether the dollars are nominal or in today's dollars, and a note on
 * what the simple formula ignores (spec §8.5).
 */

import type { FormulaBlockData } from '../learningRegistry'

const BASIS_LABEL: Record<NonNullable<FormulaBlockData['basis']>, string> = {
  nominal: 'Amounts are in future (nominal) dollars.',
  today: "Amounts are in today's dollars.",
}

export function FormulaBlock({ block }: { block: FormulaBlockData }) {
  return (
    <div className="learn-formula" role="group" aria-label="Formula">
      <p className="learn-formula-expr">{block.expression}</p>

      {block.where && block.where.length > 0 && (
        <dl className="learn-formula-where">
          {block.where.map((v) => (
            <div key={v.symbol} className="learn-formula-row">
              <dt>{v.symbol}</dt>
              <dd>{v.meaning}</dd>
            </div>
          ))}
        </dl>
      )}

      {block.basis && <p className="learn-formula-note muted small">{BASIS_LABEL[block.basis]}</p>}
      {block.note && <p className="learn-formula-note muted small">{block.note}</p>}
    </div>
  )
}
