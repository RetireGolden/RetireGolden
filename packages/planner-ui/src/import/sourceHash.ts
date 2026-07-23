/**
 * The Web Crypto boundary for the import-provenance contract. `provenance.ts`
 * stays browser-free and synchronous; the one thing that genuinely needs
 * `crypto.subtle` — hashing source bytes into the `ImportSourceRef.sha256` — is
 * async and lives here, called only at the UI's async edge. `crypto` and
 * `TextEncoder` are globals in both the browser and Node 20+ (webcrypto).
 */

/**
 * The `sha256`/`bytes` half of an `ImportSourceRef`. Pass the source's raw
 * `ArrayBuffer` so the hash matches the file on disk (decoding to text first
 * would normalize BOMs and invalid UTF-8 out of the digest); strings — for
 * sources that never were files, like the guided 1040 inputs — are hashed as
 * their UTF-8 encoding. `crypto.subtle` only exists in secure contexts, and an
 * import must not fail because it cannot be fingerprinted — without it (or on
 * any digest failure) `sha256` comes back as the empty string, never a wrong
 * hash.
 */
export async function digestSource(data: string | ArrayBuffer): Promise<{ sha256: string; bytes: number }> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let sha256 = ''
  try {
    const digest = await crypto.subtle.digest('SHA-256', buf)
    sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Insecure context or a host without Web Crypto — proceed unhashed.
  }
  return { sha256, bytes: buf.length }
}
