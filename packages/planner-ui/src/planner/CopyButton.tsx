/**
 * A copy-to-clipboard button that tells the truth when the clipboard is not
 * available.
 *
 * The Clipboard API is absent in insecure contexts and in some browsers, and a
 * `writeText` promise can reject on a permission denial. Neither is rare enough
 * to ignore and neither may be reported as success — so on failure the button
 * says so *and* reveals the text in a selectable field, which is the only
 * fallback that still gets the user their data.
 *
 * Lifted here from AssumptionsCardPage when the results toolbar's "Copy plan for
 * your AI" became the second caller. Both pages hand off content the user cannot
 * otherwise retrieve, so the fallback belongs to the button, not to each page.
 */

import { useEffect, useRef, useState } from 'react'

export interface CopyButtonProps {
  /** Idle label. */
  label: string
  /** Label flashed for a couple of seconds after a successful copy. */
  copiedLabel: string
  /** The text to copy, computed lazily so callers need not serialize on render. */
  text: () => string
  /** Accessible name for the fallback field, when the clipboard is unavailable. */
  fallbackLabel?: string
}

export function CopyButton({ label, copiedLabel, text, fallbackLabel = 'Copy this text manually' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  /** Populated only on failure — the text the user now has to copy by hand. */
  const [fallbackText, setFallbackText] = useState('')
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const flashCopied = () => {
    setState('copied')
    setFallbackText('')
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setState('idle'), 2500)
  }
  /**
   * Failure does NOT auto-reset: the fallback field is the user's only route to
   * the text, so it stays until they copy successfully or leave the page.
   */
  const showFallback = (value: string) => {
    clearTimeout(resetTimer.current)
    setFallbackText(value)
    setState('failed')
  }

  const copy = () => {
    const value = text()
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      showFallback(value)
      return
    }
    navigator.clipboard
      .writeText(value)
      .then(flashCopied)
      .catch(() => showFallback(value))
  }

  // Select the fallback the moment it appears, so Ctrl/Cmd-C just works.
  useEffect(() => {
    if (state === 'failed') fallbackRef.current?.select()
  }, [state])

  return (
    <>
      <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
        {state === 'copied' ? copiedLabel : state === 'failed' ? 'Clipboard unavailable — copy manually' : label}
      </button>
      {state === 'failed' ? (
        <textarea
          ref={fallbackRef}
          className="copy-fallback"
          readOnly
          rows={4}
          value={fallbackText}
          aria-label={fallbackLabel}
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </>
  )
}
