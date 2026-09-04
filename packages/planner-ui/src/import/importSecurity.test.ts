import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseBrokerPositionsCsv } from './brokerCsv'
import { MAX_CSV_CHARS, parseCsv } from './csv'
import { extractDocumentText, type HostPdfjsModule } from './documentText'
import { analyzeGenericCsv, draftPlanFromGenericCsv } from './genericCsv'
import { identifyMigrationExport } from './migrationSource'
import { mapProjectionLabExport } from './projectionLab'

const BROKER_FORMULA_CSV = `"Positions for account =1+1 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"@SUM(A1)","<script>alert(1)</script>","$500.00","$400.00"
`

function ids(prefix: string): () => string {
  let next = 0
  return () => `${prefix}-${++next}`
}

const localPdfjs: HostPdfjsModule = {
  VerbosityLevel: { ERRORS: 0 },
  OPS: {
    paintImageXObject: 85,
    paintInlineImageXObject: 86,
    paintImageMaskXObject: 87,
  },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          streamTextContent: () =>
            new ReadableStream({
              start(controller) {
                controller.enqueue({ items: [{ str: '=HYPERLINK("https://evil.test")\u202E' }] })
                controller.close()
              },
            }),
          getTextContent: () => Promise.resolve({ items: [] }),
          getOperatorList: () => Promise.resolve({ fnArray: [] }),
          cleanup: () => undefined,
        }),
    }),
    destroy: () => Promise.resolve(),
  }),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('public import adversarial boundary', () => {
  it('performs representative imports without touching a network or evaluating formulas', async () => {
    const forbidden = vi.fn(() => {
      throw new Error('import attempted a forbidden capability')
    })
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
      vi.stubGlobal(name, forbidden)
    }
    vi.stubGlobal('navigator', { sendBeacon: forbidden })
    vi.stubGlobal('eval', forbidden)

    const csv = parseCsv('name,balance\n=1+1,100\n@SUM(A1),200')
    expect(csv.ok && csv.rows[1]![0]).toBe('=1+1')

    const broker = parseBrokerPositionsCsv(BROKER_FORMULA_CSV)
    expect(broker.ok && broker.accounts[0]!.accountLabel).toBe('=1+1')

    const generic = analyzeGenericCsv('Account,Balance\n<script>alert(1)</script>,100')
    expect(generic.ok).toBe(true)
    if (generic.ok) {
      const draft = draftPlanFromGenericCsv(generic.analysis, ['name', 'balance'], ids('generic'))
      expect(draft.ok && draft.plan.accounts[0]!.name).toBe('<script>alert(1)</script>')
    }

    const projection = mapProjectionLabExport(
      JSON.stringify({
        currentFinances: { accounts: [{ name: '=CMD()', type: 'cash', balance: 100 }] },
      }),
      ids('projection'),
    )
    expect(projection.ok && projection.plan.accounts[0]!.name).toBe('=CMD()')

    const migration = identifyMigrationExport(`Prepared by eMoney report \u202E ${String.fromCharCode(7)}`)
    expect(migration?.outcome).toBe('identified')
    if (migration?.outcome === 'identified') {
      expect(migration.evidence[0]!.matched).toContain('<U+202E>')
      expect(migration.evidence[0]!.matched).toContain('<U+0007>')
    }

    const document = await extractDocumentText(new TextEncoder().encode('%PDF-1.7'), { pdfjs: localPdfjs })
    expect(document.ok && document.pages[0]!.text).toContain('=HYPERLINK')
    expect(forbidden).not.toHaveBeenCalled()
  })

  it('refuses archive/PDF magic on non-document paths and enforces existing caps', async () => {
    expect(parseBrokerPositionsCsv('PK\u0003\u0004compressed archive').ok).toBe(false)
    expect(parseBrokerPositionsCsv('%PDF-1.7 fake positions').ok).toBe(false)
    expect(mapProjectionLabExport('%PDF-1.7').ok).toBe(false)
    expect(parseCsv('x'.repeat(MAX_CSV_CHARS + 1)).ok).toBe(false)

    const zipAsDocument = await extractDocumentText(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      pdfjs: localPdfjs,
    })
    expect(zipAsDocument.ok).toBe(false)
    if (!zipAsDocument.ok) expect(zipAsDocument.reason).toBe('not_pdf')
  })
})
