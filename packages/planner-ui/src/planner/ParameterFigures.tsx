import { Fragment } from 'react'

/** Catalog prose carries audit record IDs; the card keeps its human citations. */
function readableFigures(figures: string): string {
  return figures.replace(/\s*\([^()]*`[^()]*\)/gu, '')
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
  const endOfIntro = readable.indexOf('. ') + 1
  return (
    <>
      {readable.slice(0, endOfIntro)}
      <details className="provenance-details">
        <summary>State details and limitations</summary>
        <div className="mt-sm"><LinkedFigures text={readable.slice(endOfIntro).trim()} /></div>
      </details>
    </>
  )
}
