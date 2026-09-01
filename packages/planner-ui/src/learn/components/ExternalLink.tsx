/**
 * An off-site link that opens in a new tab, carrying the cue the app's
 * provenance links already use: a trailing ↗ plus a screen-reader "opens in a
 * new tab" note (#418). Every `target="_blank"` link in the Learning Center
 * goes through here so the affordance is the same on the Sources page, in
 * article source lists, and in article prose.
 */

import type { ReactNode } from 'react'

export function ExternalLink({
  href,
  children,
  className,
  title,
}: {
  href: string
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={title}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

