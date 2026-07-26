/**
 * Resource ceilings shared by the PDF reader and consumers of its output.
 *
 * Kept separate from documentText.ts so browser-free consumers such as the
 * migration identifier can enforce the same budgets without loading the PDF
 * implementation or creating a runtime dependency on the optional pdfjs path.
 */

/**
 * Largest document accepted, in bytes. Oversized input is rejected before the
 * bytes are inspected at all, taking precedence over every other file reason.
 */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

/** Largest page count accepted, checked once the document reports its length. */
export const MAX_DOCUMENT_PAGES = 300

/** Largest text kept from any one page. */
export const MAX_PAGE_TEXT_CHARS = 100_000

/**
 * Largest text kept from the whole document. Hosts that persist extracted text
 * can reconcile their own limits against this shared ceiling.
 */
export const MAX_DOCUMENT_TEXT_CHARS = 2_000_000
