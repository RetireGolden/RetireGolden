/**
 * The sentence the sustainable-spending solver adds to its diagnostics, last,
 * whenever it names years whose ACA premium tax credit it could not price.
 * A module of its own, with no imports, so a page that shows its own plain
 * note for those years can recognize the engine sentence without loading the
 * solver.
 */

/** How the solver's unpriced-credit sentence begins; no other diagnostic begins so. */
export const ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD = 'The ACA premium tax credit is not priced in '

/** True for the solver's unpriced-credit sentence, false for every other diagnostic. */
export function isAcaGrossPremiumDiagnostic(message: string): boolean {
  return message.startsWith(ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD)
}
