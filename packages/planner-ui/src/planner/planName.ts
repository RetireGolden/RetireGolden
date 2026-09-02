/**
 * Plan-name presentation limits (#533). The schema only requires a non-empty
 * name; these caps are chrome, not validation: the name inputs (workspace
 * header, Duplicate prompt) stop accepting text at the cap, a "Copy of …"
 * default is cut to fit it, and the tab title carries a shortened name so a
 * long one does not fill the tab strip. Stored names are never rewritten.
 */

/** Longest name the name inputs accept. */
export const PLAN_NAME_MAX_LENGTH = 120

/** Longest run of the name the document title carries before an ellipsis. */
export const PLAN_NAME_TITLE_MAX_LENGTH = 60

type GraphemeSegmenter = { segment(text: string): Iterable<{ segment: string }> }

/**
 * The name's grapheme clusters: Intl.Segmenter where the runtime has it, code
 * points otherwise. Either way a cut never lands inside a surrogate pair,
 * and with the segmenter never inside a joined emoji sequence.
 */
function graphemesOf(name: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: undefined, o: { granularity: 'grapheme' }) => GraphemeSegmenter })
    .Segmenter
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(name), (s) => s.segment)
  return Array.from(name)
}

/**
 * The longest prefix of `name` that fits `maxUnits` UTF-16 code units — the
 * unit a native maxlength counts in, so what this returns always fits the
 * input it is meant for — and ends on a grapheme boundary, trailing space
 * trimmed. A name that already fits is returned as is.
 */
function cutToUnits(name: string, maxUnits: number): string {
  if (name.length <= maxUnits) return name
  let out = ''
  for (const grapheme of graphemesOf(name)) {
    if (out.length + grapheme.length > maxUnits) break
    out += grapheme
  }
  return out.trimEnd()
}

/** The Duplicate prompt's default for a source plan, cut to the input cap. */
export function duplicateNameDefault(sourceName: string): string {
  return clampPlanName(`Copy of ${sourceName}`)
}

/**
 * The name a Duplicate goes ahead with: what was typed, or, when the prompt
 * was emptied and confirmed, the same default the prompt opened with. The
 * store's own blank fallback is "Copy of <name>" unclamped, which for a
 * source already at the cap would exceed it (review of #533).
 */
export function duplicateNameFor(entered: string, sourceName: string): string {
  const typed = entered.trim()
  return typed ? clampPlanName(typed) : duplicateNameDefault(sourceName)
}

/** A default such as "Copy of <name>" cut to the input cap, trailing space trimmed. */
export function clampPlanName(name: string): string {
  return cutToUnits(name, PLAN_NAME_MAX_LENGTH)
}

/** The plan name as the tab title shows it: shortened with an ellipsis past the cap. */
export function planNameForTitle(name: string): string {
  return name.length <= PLAN_NAME_TITLE_MAX_LENGTH ? name : `${cutToUnits(name, PLAN_NAME_TITLE_MAX_LENGTH)}…`
}
