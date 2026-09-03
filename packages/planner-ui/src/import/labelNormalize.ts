/**
 * Unicode-aware text normalizer shared by the broker-refresh matcher
 * (`refresh.ts`) and the existing-plan intake-refresh matcher
 * (`intakeRefresh.ts`). NFKC-normalize and lowercase, retain letters and
 * digits (Unicode categories L and N) plus combining marks that follow a
 * retained base character, fold everything else to a single space, then
 * squeeze whitespace runs and trim.
 *
 * Digits survive — they are name content ("401k", "529") — and so do
 * non-ASCII letters ("Épargne" stays "épargne", not "pargne"): an
 * ASCII-only `[^a-z0-9 ]` filter treats an accented letter as punctuation
 * and drops it, corrupting the word instead of folding the accent.
 */
export function normalizeUnicodeText(raw: string): string {
  let normalized = ''
  let hasRetainedBase = false
  for (const character of raw.normalize('NFKC').toLowerCase()) {
    if (/[\p{L}\p{N}]/u.test(character)) {
      normalized += character
      hasRetainedBase = true
    } else if (/\p{M}/u.test(character)) {
      if (hasRetainedBase) normalized += character
    } else {
      normalized += ' '
      hasRetainedBase = false
    }
  }
  return normalized.replace(/\s+/g, ' ').trim()
}
