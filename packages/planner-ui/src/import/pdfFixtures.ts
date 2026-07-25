/**
 * Hand-emitted PDF byte sequences for testing the document-parsing spike
 * (advisor-intake-and-migration-workbench, WS5).
 *
 * This exists because the plan's risk section forbids bundled proprietary
 * samples — "accept user-provided documents only; no bundled proprietary
 * samples" — and the repo commits no binary fixtures at all. So the extractor
 * and the accuracy benchmark are exercised against PDFs this module *builds*,
 * byte by byte, from a declarative spec: a known text string on a known page
 * is the only way to assert "page 2 said X" without shipping someone's
 * statement. It is shared by `documentText.test.ts` and the benchmark so both
 * describe documents in the same vocabulary and a fixture fix lands once.
 *
 * These are deliberately *minimal* PDFs: uncompressed content streams, one
 * base-14 font, a real cross-reference table. They are not a general PDF
 * writer and make no attempt to be — anything a viewer needs and a text
 * extractor does not (fonts embedded, compression, tagging) is absent. They
 * are structurally valid, which is the point: pdfjs must parse them the same
 * way it parses a real document, or the tests prove nothing.
 *
 * Not published at all: test instrumentation has no business on a consumer's
 * disk, and the `./*` wildcard would otherwise make it importable, so
 * `package.json`'s `files` excludes this module the way it excludes
 * `src/report/goldens`. Only `documentText.ts` ships from this spike.
 */

/**
 * One text run on a line, positioned at an absolute x in points from the left
 * edge of the page. Columns are how a statement actually lays out a holdings
 * table, and the horizontal gap between runs is what pdfjs uses to decide
 * whether to insert a space — so a table whose columns are set too tight
 * really does come back with two cells run together. Expressing x rather than
 * "a wide gap" is what lets the corpus reproduce that.
 */
export interface SyntheticPdfRun {
  /** Absolute x in points; the page is 612 wide with a 72pt margin. */
  readonly x: number
  readonly text: string
}

/**
 * One baseline of a page: a bare string is a single run at the left margin,
 * an array is an explicit set of columns. An empty string leaves the line
 * blank and still advances the baseline, so vertical spacing reads the way it
 * does on paper.
 */
export type SyntheticPdfLine = string | readonly SyntheticPdfRun[]

/** One page in a synthetic document. */
export interface SyntheticPdfPage {
  /**
   * Text drawn on the page via a `Tj` operator. Omit for a page with no text
   * layer — combined with `image`, that is the scanned-statement shape the
   * extractor must report as image-only rather than as an empty success.
   */
  readonly text?: string
  /**
   * A laid-out page: successive baselines from the top margin down, each of
   * which may carry columns. Drawn in addition to `text` when both are given,
   * though a page normally uses one or the other.
   */
  readonly lines?: readonly SyntheticPdfLine[]
  /** Point size for {@link lines}; the baseline step is 1.4x this. */
  readonly fontSize?: number
  /**
   * Draw a 1x1 greyscale raster image. The image is real enough to survive
   * pdfjs's operator-list build, which is what the extractor inspects to tell
   * a scanned page from a genuinely blank one.
   */
  readonly image?: boolean
}

/** A whole synthetic document. */
export interface SyntheticPdfSpec {
  readonly pages: readonly SyntheticPdfPage[]
  /**
   * Emit an `/Encrypt` trailer entry with a standard security handler whose
   * `/U` value cannot validate against the empty user password, so pdfjs
   * raises its "needs a password" condition. The document is not really
   * enciphered — nothing here needs to be, because the password check happens
   * before any content is read.
   */
  readonly encrypted?: boolean
  /** File header line; override to emit something that is not a PDF. */
  readonly header?: string
}

/**
 * Escape the three characters that are special inside a PDF literal string.
 * Callers pass ordinary prose; this keeps a stray parenthesis from ending the
 * string early and silently corrupting the fixture.
 */
function escapePdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/** Top baseline and left margin for {@link SyntheticPdfPage.lines}, in points. */
const TOP_BASELINE = 720
const LEFT_MARGIN = 72

/**
 * Emit one text-showing operator per run, moving the text matrix between runs
 * so every run lands where the caller asked. A whole line lives inside one
 * `BT`/`ET` text object because that is how a real generator writes it, and
 * because pdfjs's end-of-line and inter-run spacing decisions are made within
 * a text object.
 */
function lineOperators(line: SyntheticPdfLine, fontSize: number, y: number): string | null {
  const runs: readonly SyntheticPdfRun[] =
    typeof line === 'string' ? (line === '' ? [] : [{ x: LEFT_MARGIN, text: line }]) : line.filter((run) => run.text !== '')
  if (runs.length === 0) return null

  // `Td` is relative to the start of the previous line, so the first run
  // carries the absolute position and every later run only carries the gap.
  let cursor: number | null = null
  const parts: string[] = [`BT /F1 ${fontSize} Tf`]
  for (const run of runs) {
    parts.push(
      cursor === null
        ? `${run.x} ${y} Td (${escapePdfString(run.text)}) Tj`
        : `${run.x - cursor} 0 Td (${escapePdfString(run.text)}) Tj`,
    )
    cursor = run.x
  }
  parts.push('ET')
  return parts.join(' ')
}

/**
 * Build a small, structurally valid PDF from `spec`.
 *
 * Throws on non-ASCII input — a programming error in a test, not a data
 * condition. The emitter computes `/Length` and the xref byte offsets from
 * JavaScript string lengths, which only equal byte offsets while every
 * character is a single UTF-8 byte; a smart quote would silently shift every
 * offset and produce a fixture that tests the recovery path by accident.
 */
export function buildSyntheticPdf(spec: SyntheticPdfSpec): Uint8Array {
  const bodies: Array<[number, string]> = []
  let nextId = 1
  const alloc = (): number => nextId++

  const catalogId = alloc()
  const pagesId = alloc()
  const fontId = alloc()

  const pageIds: number[] = []
  for (const page of spec.pages) {
    const pageId = alloc()
    const contentId = alloc()
    pageIds.push(pageId)

    const operators: string[] = []
    const resources: string[] = []

    if (page.text) {
      operators.push(`BT /F1 12 Tf 72 720 Td (${escapePdfString(page.text)}) Tj ET`)
      resources.push(`/Font << /F1 ${fontId} 0 R >>`)
    }
    if (page.lines?.length) {
      const fontSize = page.fontSize ?? 10
      let y = TOP_BASELINE
      for (const line of page.lines) {
        const operator = lineOperators(line, fontSize, y)
        if (operator !== null) operators.push(operator)
        y -= Math.round(fontSize * 1.4)
      }
      if (!resources.some((entry) => entry.startsWith('/Font'))) {
        resources.push(`/Font << /F1 ${fontId} 0 R >>`)
      }
    }
    if (page.image) {
      const imageId = alloc()
      // One sample byte ('@', 0x40) for a 1x1 8-bit greyscale image: the
      // smallest raster pdfjs will actually decode, so the paint operator
      // reaches the operator list instead of being dropped as malformed.
      bodies.push([
        imageId,
        '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray' +
          ' /BitsPerComponent 8 /Length 1 >>\nstream\n@\nendstream',
      ])
      operators.push('q 100 0 0 100 72 600 cm /Im1 Do Q')
      resources.push(`/XObject << /Im1 ${imageId} 0 R >>`)
    }

    const content = operators.join('\n')
    bodies.push([
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792]` +
        ` /Resources << ${resources.join(' ')} >> /Contents ${contentId} 0 R >>`,
    ])
    bodies.push([contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
  }

  const objects = new Map<number, string>(bodies)
  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  objects.set(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
  )
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let trailerExtra = ''
  if (spec.encrypted) {
    const encryptId = alloc()
    const unusable = '61'.repeat(32)
    objects.set(encryptId, `<< /Filter /Standard /V 1 /R 2 /O <${unusable}> /U <${unusable}> /P -1 >>`)
    const id = 'ab'.repeat(16)
    trailerExtra = ` /Encrypt ${encryptId} 0 R /ID [<${id}> <${id}>]`
  }

  const size = nextId
  let out = `${spec.header ?? '%PDF-1.7'}\n`
  const offsets = new Map<number, number>()
  for (let id = 1; id < size; id++) {
    offsets.set(id, out.length)
    out += `${id} 0 obj\n${objects.get(id) ?? '<< >>'}\nendobj\n`
  }

  const startxref = out.length
  out += `xref\n0 ${size}\n0000000000 65535 f \n`
  for (let id = 1; id < size; id++) {
    out += `${String(offsets.get(id) ?? 0).padStart(10, '0')} 00000 n \n`
  }
  out += `trailer\n<< /Size ${size} /Root ${catalogId} 0 R${trailerExtra} >>\nstartxref\n${startxref}\n%%EOF\n`

  if (!/^[\x20-\x7e\n]*$/.test(out)) {
    throw new Error('buildSyntheticPdf: fixture text must be printable ASCII (byte offsets assume it)')
  }
  return new TextEncoder().encode(out)
}
