/**
 * Renders a `figure` block: a registered chart or an image, wrapped in a
 * semantic <figure>/<figcaption> with a screen-reader text equivalent and an
 * optional source note. The visual never carries meaning by colour alone — the
 * `alt` text equivalent always describes what the figure shows.
 */

import type { FigureBlockData } from '../learningRegistry'
import { renderLearnChart } from './charts'

export function ArticleFigure({ block }: { block: FigureBlockData }) {
  const chart = block.chartId ? renderLearnChart(block.chartId) : null

  return (
    <figure className="learn-figure">
      {chart ? (
        <div className="learn-figure-media" role="img" aria-label={block.alt}>
          {chart}
        </div>
      ) : block.image ? (
        <img className="learn-figure-media" src={block.image.src} alt={block.alt} />
      ) : (
        // No renderable media: fall back to the text equivalent so nothing is lost.
        <p className="learn-figure-fallback">{block.alt}</p>
      )}
      {/* Always expose the text equivalent to assistive tech, even for charts. */}
      <span className="sr-only">{block.alt}</span>
      <figcaption className="learn-figure-caption">
        {block.caption}
        {block.sourceNote && <span className="learn-figure-source"> {block.sourceNote}</span>}
      </figcaption>
    </figure>
  )
}
