/**
 * Renders a `table` block: a small comparison table with a caption and proper
 * header scopes. The first column is a row header; cells support inline markdown.
 */

import { renderInline } from '../inlineMarkdown'
import type { TableBlockData } from '../learningRegistry'

export function ComparisonTable({ block }: { block: TableBlockData }) {
  const [rowHeader, ...colHeaders] = block.columns

  return (
    <div className="learn-table-wrap">
      <table className="learn-table">
        {block.caption && <caption className="learn-table-caption">{block.caption}</caption>}
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {colHeaders.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => {
            const [head, ...cells] = row
            return (
              <tr key={r}>
                <th scope="row">{renderInline(head ?? '')}</th>
                {cells.map((cell, c) => (
                  <td key={c}>{renderInline(cell)}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
