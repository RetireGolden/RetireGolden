/**
 * Tiny, dependency-free inline renderer for article prose.
 *
 * Supports just enough Markdown for body text — links, bold, and inline code —
 * and builds real React elements (never `dangerouslySetInnerHTML`), so author
 * content cannot inject raw HTML. Block structure (paragraphs, lists, headings)
 * is handled by ArticleBody; this only handles inline spans within one string.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// link [text](href) | bold **text** | inline code `code`
const INLINE_PATTERN = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g

/** Render a single line/paragraph of constrained Markdown to React nodes. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start))

    const [linkText, href] = [match[1], match[2]]
    const boldText = match[3]
    const codeText = match[4]

    if (linkText !== undefined && href !== undefined) {
      // Internal links use the router; external links open in a new tab.
      nodes.push(
        href.startsWith('/') ? (
          <Link key={key++} to={href}>
            {linkText}
          </Link>
        ) : (
          <a key={key++} href={href} target="_blank" rel="noreferrer">
            {linkText}
          </a>
        ),
      )
    } else if (boldText !== undefined) {
      nodes.push(<strong key={key++}>{boldText}</strong>)
    } else if (codeText !== undefined) {
      nodes.push(<code key={key++}>{codeText}</code>)
    }

    lastIndex = start + match[0].length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}
