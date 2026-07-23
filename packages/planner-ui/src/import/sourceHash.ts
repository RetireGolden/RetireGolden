/**
 * The Web Crypto boundary for the import-provenance contract. `provenance.ts`
 * stays browser-free and synchronous; the one thing that genuinely needs
 * `crypto.subtle` — hashing source bytes into the `ImportSourceRef.sha256` — is
 * async and lives here, called only at the UI's async edge. `crypto` and
 * `TextEncoder` are globals in both the browser and Node 20+ (webcrypto).
 */

/**
 * The `sha256`/`bytes` half of an `ImportSourceRef`: lowercase hex SHA-256 and
 * UTF-8 byte length of `text`, from a single encoding pass.
 */
export async function digestSource(text: string): Promise<{ sha256: string; bytes: number }> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return { sha256, bytes: buf.length }
}
