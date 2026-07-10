/**
 * Renders an article's source URLs as a labelled list of external links.
 * Renders nothing when there are no sources.
 */

export function SourceList({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null

  return (
    <div className="learn-sources">
      <h2 className="learn-section-title">Sources</h2>
      <ul className="learn-list">
        {urls.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
