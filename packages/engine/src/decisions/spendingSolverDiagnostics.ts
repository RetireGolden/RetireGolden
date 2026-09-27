/**
 * Sentences the sustainable-spending solver adds to its diagnostics that a
 * page recognizes: the one it adds last whenever it names years whose ACA
 * premium tax credit it could not price, and the one it adds when it
 * publishes the exact amount that passed rather than that amount rounded
 * down to $100. A module of its own, with no imports, so a page can recognize
 * the engine sentences without loading the solver.
 */

/** How the solver's unpriced-credit sentence begins; no other diagnostic begins so. */
export const ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD = 'The ACA premium tax credit is not priced in '

/** True for the solver's unpriced-credit sentence, false for every other diagnostic. */
export function isAcaGrossPremiumDiagnostic(message: string): boolean {
  return message.startsWith(ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD)
}

/**
 * How the solver's sentence begins when `maxBaseAnnualRounding` is 'none'
 * (the published answer is the exact amount that passed, and the sentence
 * says why the amount rounded down to $100 is not published); no other
 * diagnostic begins so.
 */
export const EXACT_ANSWER_DIAGNOSTIC_LEAD = 'The answer is the exact amount that passed'

/** True for the solver's exact-answer sentence, false for every other diagnostic. */
export function isExactAnswerDiagnostic(message: string): boolean {
  return message.startsWith(EXACT_ANSWER_DIAGNOSTIC_LEAD)
}
