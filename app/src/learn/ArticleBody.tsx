/**
 * Renders an article's structured content blocks. Text blocks (prose, heading,
 * list, callout) render inline here; the richer blocks (figure, formula,
 * scenario, table) render through dedicated components in ./components.
 */

import { Fragment } from 'react'
import type { ArticleBlock } from './learningRegistry'
import { renderInline } from './inlineMarkdown'
import { ArticleFigure } from './components/ArticleFigure'
import { FormulaBlock } from './components/FormulaBlock'
import { ScenarioCard } from './components/ScenarioCard'
import { ComparisonTable } from './components/ComparisonTable'

/** Split a prose string into paragraphs on blank lines. */
function paragraphs(md: string): string[] {
  return md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case 'prose':
      return (
        <Fragment>
          {paragraphs(block.md).map((p, i) => (
            <p key={i}>{renderInline(p)}</p>
          ))}
        </Fragment>
      )
    case 'heading': {
      const level = block.level ?? 2
      return level === 3 ? <h3>{block.text}</h3> : <h2>{block.text}</h2>
    }
    case 'list':
      return block.ordered ? (
        <ol className="learn-list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul className="learn-list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    case 'callout':
      return (
        <div className={`learn-callout learn-callout--${block.tone ?? 'note'}`}>
          {paragraphs(block.md).map((p, i) => (
            <p key={i}>{renderInline(p)}</p>
          ))}
        </div>
      )
    case 'figure':
      return <ArticleFigure block={block} />
    case 'formula':
      return <FormulaBlock block={block} />
    case 'scenario':
      return <ScenarioCard block={block} />
    case 'table':
      return <ComparisonTable block={block} />
  }
}

export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <Fragment>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </Fragment>
  )
}
