import { describe, expect, it } from 'vitest'
import { csvDownloadBlob, UTF8_BYTE_ORDER_MARK } from './csvDownload'

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

describe('csvDownloadBlob', () => {
  it('starts the file with the UTF-8 byte-order mark', async () => {
    const bytes = await bytesOf(csvDownloadBlob('a,b\n1,2\n'))
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect([...UTF8_BYTE_ORDER_MARK].map((c) => c.codePointAt(0))).toEqual([0xfeff])
  })

  it('leaves the CSV text after the mark byte for byte unchanged, non-ASCII included', async () => {
    const csv = 'label,amount\r\n"Pat · Rollover ""IRA"", primary (IRA)",40000\r\nJosé’s pension,1\r\n'
    const bytes = await bytesOf(csvDownloadBlob(csv))
    expect([...bytes.slice(3)]).toEqual([...new TextEncoder().encode(csv)])
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(UTF8_BYTE_ORDER_MARK + csv)
  })

  it('writes one mark for an empty CSV and nothing else', async () => {
    expect([...(await bytesOf(csvDownloadBlob('')))]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('labels the download as UTF-8 CSV', () => {
    expect(csvDownloadBlob('x').type).toBe('text/csv;charset=utf-8')
  })
})
