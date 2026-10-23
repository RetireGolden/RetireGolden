import { Fragment } from 'react'
import { PrintableDetails } from './PrintableDetails'

/** Catalog prose carries audit record IDs; the card keeps its human citations. */
function readableFigures(figures: string): string {
  // Remove only citation-only parentheticals, not arbitrary prose containing
  // an audit ID. The catalog rendering test guards newly added citation forms.
  return figures
    .replace(/\s*\(`[a-z0-9-]+`\)/gu, '')
    .replace(/\s*\(records `[^()]+`\)/gu, '')
}

function LinkedFigures({ text }: { text: string }) {
  return text.split(/(https?:\/\/[^\s)]+)/gu).map((part, i) => {
    if (!/^https?:\/\//u.test(part)) return <Fragment key={i}>{part}</Fragment>
    const label = part.endsWith('/26_1040es_fillable.pdf')
      ? 'Maine Form 1040ES-ME'
      : `Source document (${new URL(part).hostname})`
    return <a key={i} href={part} target="_blank" rel="noopener noreferrer">{label}</a>
  })
}

/** Presentation only: the catalog and the exact copy/JSON export stay intact. */
export function ParameterFigures({ id, figures }: { id: string; figures: string }) {
  const readable = readableFigures(figures)
  if (id !== 'state-income-tax') return <LinkedFigures text={readable} />
  return (
    <>
      Tax schedules and modeling limitations for all 50 states and DC.
      <PrintableDetails className="provenance-details">
        <summary>State details and limitations</summary>
        <div className="mt-sm"><LinkedFigures text={readable} /></div>
      </PrintableDetails>
    </>
  )
}
