/**
 * Declarations for the quote verifier's pure pieces, so the verdict-contract
 * test can import them under strict TypeScript without pulling scripts/ into
 * the compiled package surface. Importing the module is safe: execution is
 * behind import.meta.main.
 */
export interface QuoteVerdictSource {
  readonly url: string
  readonly ok: boolean
  readonly problem?: string
  readonly isPdf: boolean
  readonly pdfUnreadable?: boolean
  readonly suspectStub?: boolean
  readonly variants: readonly string[]
  readonly fromCache: boolean
}
export declare function verdictFor(
  entry: { readonly quotedText: string },
  source: QuoteVerdictSource,
): { readonly verdict: string; readonly detail: string }
export declare function htmlVariants(html: string): string[]
