/**
 * Renders an article's source URLs as a labelled list of external links.
 * Each link shows a short host + path label (not the bare wrapping URL) with
 * the shared new-tab cue; the full URL is the href and the hover title.
 * Renders nothing when there are no sources.
 */

import { ExternalLink } from './ExternalLink'
import { sourceLabel } from './sourceLabel'

export function SourceList({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null

  return (
    <div className="learn-sources">
      <h2 className="learn-section-title">Sources</h2>
      <ul className="learn-list">
        {urls.map((url) => (
          <li key={url}>
            <ExternalLink href={url} title={url}>
              {sourceLabel(url)}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
