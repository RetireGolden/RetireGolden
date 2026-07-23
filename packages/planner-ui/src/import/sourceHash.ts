/**
 * The Web Crypto boundary for the import-provenance contract. `provenance.ts`
 * stays browser-free and synchronous; the one thing that genuinely needs
 * `crypto.subtle` — hashing source bytes into the `ImportSourceRef.sha256` — is
 * async and lives here, called only at the UI's async edge. `crypto` and
 * `TextEncoder` are globals in both the browser and Node 20+ (webcrypto).
 */

/** Lowercase hex SHA-256 of `text`, encoded as UTF-8. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** UTF-8 byte length of `text` — the `ImportSourceRef.bytes` value. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
