/**
 * Public read/verify contract for RetireGolden's complete-export container.
 * The sole producer lives in RetireGolden-Pro; this package intentionally
 * contains no writer. It is browser-free plain TypeScript, usable in Node and
 * browsers, with Web Crypto used only for SHA-256 verification.
 *
 * Compatibility policy: label-like fields stay deliberately liberal. A v1
 * reader accepts any non-empty `purpose`, media type, restore policy, edition,
 * disposition, reason code, app label, schema, or store id so producers can
 * add labels and stores without breaking existing readers. Integrity-bearing
 * fields (paths, hashes, counts, references, timestamps, totals, and limits)
 * remain strict.
 *
 * No production call site for this module exists in this repository; what that costs a
 * reviewer is recorded in `DOCS/features/published-only-modules.md`.
 */

export const COMPLETE_EXPORT_FORMAT = 'retiregolden.complete-export'
export const COMPLETE_EXPORT_FORMAT_VERSION = 1
export const COMPLETE_EXPORT_FILE_EXTENSION = 'rgcomplete'
export const MANIFEST_ENTRY_NAME = 'manifest.json'
export const MANIFEST_SHA256_ENTRY_NAME = 'manifest.sha256'
/** UTF-8 manifest byte cap; matches the RetireGolden-Pro producer. */
export const MAX_COMPLETE_EXPORT_MANIFEST_BYTES = 2 * 1024 * 1024
/** The one v1 Free-bridge component: the v2 backup envelope, when present. */
export const FREE_BRIDGE_COMPONENT_PATH = 'portable/plans-v2.json'

/** One independently verifiable component stored in the archive. */
export interface CompleteExportComponentEntry {
  /** Safe relative ZIP entry path for this component. */
  path: string
  /** MIME type describing the component encoding. */
  mediaType: string
  /** Producer-defined schema identifier for the component payload. */
  schema: string
  /** Positive version of the component schema. */
  schemaVersion: number
  /** Exact stored byte count of the component. */
  byteLength: number
  /** Lowercase hexadecimal SHA-256 of the component's raw stored bytes. */
  sha256: string
  /** Logical records represented by the component. */
  logicalCount: number
  /** Producer-defined instruction for restoring this component. */
  restorePolicy: string
  /** Producer-defined edition compatibility label. */
  edition: string
}

/** Accounting for a source store, including stores with no component. */
export interface CompleteExportStoreEntry {
  /** Producer-defined source-store identifier. */
  storeId: string
  /** Producer-defined accounting disposition. */
  disposition: string
  /** Component path when this store contributed one. */
  component?: string
  /** Source records observed before writing the component. */
  sourceCount?: number
  /** Producer-defined reason code for a non-standard disposition. */
  reasonCode?: string
  /** Human-readable detail for a non-standard disposition. */
  detail?: string
}

/** One item deliberately excluded from the portable archive. */
export interface CompleteExportOmissionEntry {
  /** Identifier of the omitted store or artifact. */
  storeId: string
  /** Producer-defined explanation category for the omission. */
  reasonCode: string
  /** Human-readable explanation of the omission boundary. */
  detail: string
}

/** Reader and archive limits recorded by the producer. */
export interface CompleteExportLimits {
  /** Maximum combined stored bytes across all components. */
  maxTotalStoredBytes: number
  /** Maximum number of archive entries. */
  maxEntries: number
  /** Maximum UTF-8 byte length of `manifest.json`. */
  maxManifestBytes: number
  /** Maximum stored byte length of one component. */
  maxComponentBytes: number
  /** Maximum byte length of one JSONL line. */
  maxJsonlLineBytes: number
  /** Maximum permitted JSON nesting depth in component documents. */
  maxJsonNesting: number
}

/** The canonical manifest describing a complete-export archive. */
export interface CompleteExportManifest {
  /** Fixed container-format discriminator. */
  format: typeof COMPLETE_EXPORT_FORMAT
  /** Supported version of the container manifest contract. */
  formatVersion: typeof COMPLETE_EXPORT_FORMAT_VERSION
  /** Producer-assigned identity for this exported snapshot. */
  exportId: string
  /** UTC instant at which the producer created the manifest. */
  createdAtUtc: string
  /** Producer identity recorded with the export. */
  app: {
    /** Producer product label. */
    product: string
    /** Producer version label. */
    version: string
    /** Producer platform label. */
    platform: string
  }
  /** Producer-defined export purpose label. */
  purpose: string
  /** The source-library generation and its consistency window. */
  snapshot: {
    /** Nonnegative source-library generation number. */
    generation: number
    /** UTC instant at which the snapshot began. */
    startedAtUtc: string
    /** UTC instant at which the snapshot completed. */
    completedAtUtc: string
  }
  /** Always true: this archive is deliberately plaintext. */
  plaintext: true
  /** Archive components and their independent integrity data. */
  components: CompleteExportComponentEntry[]
  /** Store-level accounting for included and absent data. */
  stores: CompleteExportStoreEntry[]
  /** Explicit accounting for intentionally omitted data. */
  omissions: CompleteExportOmissionEntry[]
  /** Aggregate integrity equations over all components. */
  totals: {
    /** Number of components, equal to `components.length`. */
    components: number
    /** Sum of every component's logical record count. */
    logicalRecords: number
    /** Sum of every component's stored byte length. */
    bytes: number
  }
  /** Import compatibility claims for Pro and the Free planner. */
  compatibility: {
    /** RetireGolden-Pro compatibility claim. */
    pro: {
      /** Whether Pro can import this container. */
      importable: boolean
      /** Minimum complete-export container version accepted by Pro. */
      minimumContainerVersion: number
    }
    /** RetireGolden Free compatibility claim. */
    free: {
      /** Whether the Free web app can import this container directly. */
      importableContainer: boolean
      /** Path of a Free-compatible plans component when one is present. */
      plansComponent?: string
      /** Producer-defined reason the Free-compatible component is absent. */
      reason?: string
    }
  }
  /** Resource limits the producer applied to this container. */
  limits: CompleteExportLimits
}

/** Result of parsing an untrusted complete-export manifest. */
export type ParseCompleteExportManifestResult =
  | { ok: true; manifest: CompleteExportManifest }
  | {
      ok: false
      reason: 'too_large' | 'invalid_json' | 'not_complete_export' | 'newer_than_supported' | 'malformed'
      detail?: string
    }

type RecordValue = Record<string, unknown>

const SHA256_RE = /^[0-9a-f]{64}$/
// Fractional seconds are capped at millisecond precision so that ordering
// comparisons via Date.parse can never truncate away a real difference.
const UTC_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/
// eslint-disable-next-line no-control-regex -- rejecting control characters in entry paths is the point
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f]/

function asRecord(value: unknown): RecordValue | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RecordValue) : null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

// Safe integers only: byte lengths and counts above 2**53 - 1 cannot be
// summed or compared exactly in JS, so the totals equations would silently
// stop being equations. Negative zero is rejected as a non-value.
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** A real ISO-8601 UTC timestamp, including a real calendar date. */
function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = UTC_TIMESTAMP_RE.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (month < 1 || month > 12 || hour >= 24 || minute >= 60 || second >= 60) return false
  const daysInMonth =
    month === 2
      ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
        ? 29
        : 28
      : [4, 6, 9, 11].includes(month)
        ? 30
        : 31
  return day >= 1 && day <= daysInMonth
}

function isSafeComponentPath(value: unknown): value is string {
  if (
    !isNonEmptyString(value) ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes(':') ||
    CONTROL_CHARACTER_RE.test(value)
  ) {
    return false
  }
  const segments = value.split('/')
  // Each segment must survive Win32 folding non-empty: a segment of only
  // dots/spaces (".", "..", "...", " .") folds to nothing on extraction.
  return segments.every(
    (segment) => segment.length > 0 && segment.replace(/[. ]+$/, '').length > 0,
  )
}

// Reserved-name collisions are checked case-insensitively: extracting
// "MANIFEST.JSON" on a case-insensitive filesystem would clobber the real one.
function isReservedManifestPath(path: string): boolean {
  const folded = win32FoldedPath(path)
  return folded === MANIFEST_ENTRY_NAME || folded === MANIFEST_SHA256_ENTRY_NAME
}

// Win32 name folding: the filesystem lowercases and strips trailing dots and
// spaces from each component, so collision checks must fold the same way.
function win32FoldedPath(path: string): string {
  return path
    .toLowerCase()
    .split('/')
    .map((segment) => segment.replace(/[. ]+$/, ''))
    .join('/')
}

function malformed(detail: string): ParseCompleteExportManifestResult {
  return { ok: false, reason: 'malformed', detail }
}

type ParsedEntry<T> = { ok: true; value: T } | { ok: false; detail: string }

function parseComponentEntry(value: unknown, index: number): ParsedEntry<CompleteExportComponentEntry> {
  const record = asRecord(value)
  const prefix = `components[${index}]`
  if (record === null) return { ok: false, detail: prefix }

  const path = record['path']
  if (!isSafeComponentPath(path)) return { ok: false, detail: `${prefix}.path` }
  if (isReservedManifestPath(path)) return { ok: false, detail: `${prefix}.path` }
  const mediaType = record['mediaType']
  if (!isNonEmptyString(mediaType)) return { ok: false, detail: `${prefix}.mediaType` }
  const schema = record['schema']
  if (!isNonEmptyString(schema)) return { ok: false, detail: `${prefix}.schema` }
  const schemaVersion = record['schemaVersion']
  if (!isPositiveInteger(schemaVersion)) return { ok: false, detail: `${prefix}.schemaVersion` }
  const byteLength = record['byteLength']
  if (!isNonNegativeInteger(byteLength)) return { ok: false, detail: `${prefix}.byteLength` }
  const sha256 = record['sha256']
  if (typeof sha256 !== 'string' || !SHA256_RE.test(sha256)) return { ok: false, detail: `${prefix}.sha256` }
  const logicalCount = record['logicalCount']
  if (!isNonNegativeInteger(logicalCount)) return { ok: false, detail: `${prefix}.logicalCount` }
  const restorePolicy = record['restorePolicy']
  if (!isNonEmptyString(restorePolicy)) return { ok: false, detail: `${prefix}.restorePolicy` }
  const edition = record['edition']
  if (!isNonEmptyString(edition)) return { ok: false, detail: `${prefix}.edition` }

  return {
    ok: true,
    value: { path, mediaType, schema, schemaVersion, byteLength, sha256, logicalCount, restorePolicy, edition },
  }
}

function parseStoreEntry(value: unknown, index: number, componentPaths: ReadonlySet<string>): ParsedEntry<CompleteExportStoreEntry> {
  const record = asRecord(value)
  const prefix = `stores[${index}]`
  if (record === null) return { ok: false, detail: prefix }

  const storeId = record['storeId']
  if (!isNonEmptyString(storeId)) return { ok: false, detail: `${prefix}.storeId` }
  const disposition = record['disposition']
  if (!isNonEmptyString(disposition)) return { ok: false, detail: `${prefix}.disposition` }
  const component = record['component']
  if (component !== undefined && (!isNonEmptyString(component) || !componentPaths.has(component))) {
    return { ok: false, detail: `${prefix}.component` }
  }
  const sourceCount = record['sourceCount']
  if (sourceCount !== undefined && !isNonNegativeInteger(sourceCount)) {
    return { ok: false, detail: `${prefix}.sourceCount` }
  }
  const reasonCode = record['reasonCode']
  if (reasonCode !== undefined && !isNonEmptyString(reasonCode)) return { ok: false, detail: `${prefix}.reasonCode` }
  const detail = record['detail']
  if (detail !== undefined && typeof detail !== 'string') return { ok: false, detail: `${prefix}.detail` }

  return {
    ok: true,
    value: {
      storeId,
      disposition,
      ...(component !== undefined ? { component } : {}),
      ...(sourceCount !== undefined ? { sourceCount } : {}),
      ...(reasonCode !== undefined ? { reasonCode } : {}),
      ...(detail !== undefined ? { detail } : {}),
    },
  }
}

function parseOmissionEntry(value: unknown, index: number): ParsedEntry<CompleteExportOmissionEntry> {
  const record = asRecord(value)
  const prefix = `omissions[${index}]`
  if (record === null) return { ok: false, detail: prefix }
  const storeId = record['storeId']
  if (!isNonEmptyString(storeId)) return { ok: false, detail: `${prefix}.storeId` }
  const reasonCode = record['reasonCode']
  if (!isNonEmptyString(reasonCode)) return { ok: false, detail: `${prefix}.reasonCode` }
  const detail = record['detail']
  if (!isNonEmptyString(detail)) return { ok: false, detail: `${prefix}.detail` }
  return { ok: true, value: { storeId, reasonCode, detail } }
}

/**
 * Parse a manifest from untrusted text. Unknown fields are intentionally
 * tolerated and dropped; everything returned here was rebuilt from a checked
 * v1 contract field.
 */
export function parseCompleteExportManifest(json: string): ParseCompleteExportManifestResult {
  // UTF-8 never encodes to fewer bytes than the string has UTF-16 code units,
  // so an over-cap length refuses before allocating an encoded copy.
  if (json.length > MAX_COMPLETE_EXPORT_MANIFEST_BYTES) {
    return { ok: false, reason: 'too_large' }
  }
  const manifestByteLength = new TextEncoder().encode(json).byteLength
  if (manifestByteLength > MAX_COMPLETE_EXPORT_MANIFEST_BYTES) {
    return { ok: false, reason: 'too_large' }
  }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
  const manifest = asRecord(raw)
  if (manifest === null) return { ok: false, reason: 'invalid_json' }
  if (manifest['format'] !== COMPLETE_EXPORT_FORMAT) return { ok: false, reason: 'not_complete_export' }

  const formatVersion = manifest['formatVersion']
  if (!isPositiveInteger(formatVersion)) return malformed('formatVersion')
  if (formatVersion > COMPLETE_EXPORT_FORMAT_VERSION) return { ok: false, reason: 'newer_than_supported' }
  if (formatVersion !== COMPLETE_EXPORT_FORMAT_VERSION) return malformed('formatVersion')

  const exportId = manifest['exportId']
  if (!isNonEmptyString(exportId)) return malformed('exportId')
  const createdAtUtc = manifest['createdAtUtc']
  if (!isUtcTimestamp(createdAtUtc)) return malformed('createdAtUtc')

  const app = asRecord(manifest['app'])
  if (app === null) return malformed('app')
  const appProduct = app['product']
  if (!isNonEmptyString(appProduct)) return malformed('app.product')
  const appVersion = app['version']
  if (!isNonEmptyString(appVersion)) return malformed('app.version')
  const appPlatform = app['platform']
  if (!isNonEmptyString(appPlatform)) return malformed('app.platform')

  const purpose = manifest['purpose']
  if (!isNonEmptyString(purpose)) return malformed('purpose')
  const snapshot = asRecord(manifest['snapshot'])
  if (snapshot === null) return malformed('snapshot')
  const generation = snapshot['generation']
  if (!isNonNegativeInteger(generation)) return malformed('snapshot.generation')
  const startedAtUtc = snapshot['startedAtUtc']
  if (!isUtcTimestamp(startedAtUtc)) return malformed('snapshot.startedAtUtc')
  const completedAtUtc = snapshot['completedAtUtc']
  if (!isUtcTimestamp(completedAtUtc)) return malformed('snapshot.completedAtUtc')
  // A snapshot window that ends before it starts is impossible; createdAtUtc
  // is deliberately not ordered against it, since producers may stamp the
  // manifest from a different clock read than the snapshot.
  if (Date.parse(completedAtUtc) < Date.parse(startedAtUtc)) {
    return malformed('snapshot.completedAtUtc')
  }
  if (manifest['plaintext'] !== true) return malformed('plaintext')

  const rawComponents = manifest['components']
  if (!Array.isArray(rawComponents)) return malformed('components')
  const components: CompleteExportComponentEntry[] = []
  const componentPaths = new Set<string>()
  const foldedComponentPaths = new Set<string>()
  for (const [index, entry] of rawComponents.entries()) {
    const parsed = parseComponentEntry(entry, index)
    if (!parsed.ok) return malformed(parsed.detail)
    // Duplicates are detected case-folded: two entries differing only by case
    // collide on case-insensitive filesystems when the archive is extracted.
    if (foldedComponentPaths.has(win32FoldedPath(parsed.value.path))) return malformed(`components[${index}].path`)
    foldedComponentPaths.add(win32FoldedPath(parsed.value.path))
    componentPaths.add(parsed.value.path)
    components.push(parsed.value)
  }

  const rawStores = manifest['stores']
  if (!Array.isArray(rawStores)) return malformed('stores')
  const stores: CompleteExportStoreEntry[] = []
  const storeIds = new Set<string>()
  for (const [index, entry] of rawStores.entries()) {
    const parsed = parseStoreEntry(entry, index, componentPaths)
    if (!parsed.ok) return malformed(parsed.detail)
    if (storeIds.has(parsed.value.storeId)) return malformed(`stores[${index}].storeId`)
    storeIds.add(parsed.value.storeId)
    stores.push(parsed.value)
  }

  const rawOmissions = manifest['omissions']
  if (!Array.isArray(rawOmissions)) return malformed('omissions')
  const omissions: CompleteExportOmissionEntry[] = []
  for (const [index, entry] of rawOmissions.entries()) {
    const parsed = parseOmissionEntry(entry, index)
    if (!parsed.ok) return malformed(parsed.detail)
    omissions.push(parsed.value)
  }

  const totals = asRecord(manifest['totals'])
  if (totals === null) return malformed('totals')
  // Refuse sums past 2**53 - 1: above that, IEEE rounding lets a wrong total
  // collide with the true one, so the equations would stop discriminating.
  let totalBytes = 0
  let totalLogicalRecords = 0
  for (const component of components) {
    totalBytes += component.byteLength
    totalLogicalRecords += component.logicalCount
    if (totalBytes > Number.MAX_SAFE_INTEGER) return malformed('totals.bytes')
    if (totalLogicalRecords > Number.MAX_SAFE_INTEGER) return malformed('totals.logicalRecords')
  }
  if (totals['components'] !== components.length) return malformed('totals.components')
  if (totals['bytes'] !== totalBytes) return malformed('totals.bytes')
  if (totals['logicalRecords'] !== totalLogicalRecords) return malformed('totals.logicalRecords')

  const compatibility = asRecord(manifest['compatibility'])
  if (compatibility === null) return malformed('compatibility')
  const proCompatibility = asRecord(compatibility['pro'])
  if (proCompatibility === null) return malformed('compatibility.pro')
  const proImportable = proCompatibility['importable']
  if (typeof proImportable !== 'boolean') return malformed('compatibility.pro.importable')
  const minimumContainerVersion = proCompatibility['minimumContainerVersion']
  if (!isPositiveInteger(minimumContainerVersion)) return malformed('compatibility.pro.minimumContainerVersion')
  // "Importable, but only above this container's own version" is contradictory.
  if (proImportable && minimumContainerVersion > COMPLETE_EXPORT_FORMAT_VERSION) {
    return malformed('compatibility.pro.minimumContainerVersion')
  }
  const freeCompatibility = asRecord(compatibility['free'])
  if (freeCompatibility === null) return malformed('compatibility.free')
  const importableContainer = freeCompatibility['importableContainer']
  if (typeof importableContainer !== 'boolean') return malformed('compatibility.free.importableContainer')
  const plansComponent = freeCompatibility['plansComponent']
  if (plansComponent !== undefined) {
    // The v1 Free bridge is a documented identity, not a label: it is the
    // portable/plans-v2.json component carrying the v2 backup envelope, and
    // it must exist and be labeled free-compatible.
    const bridged = components.find((component) => component.path === plansComponent)
    if (
      plansComponent !== FREE_BRIDGE_COMPONENT_PATH ||
      bridged === undefined ||
      bridged.edition !== 'free-compatible'
    ) {
      return malformed('compatibility.free.plansComponent')
    }
  }
  const freeReason = freeCompatibility['reason']
  if (freeReason !== undefined && typeof freeReason !== 'string') return malformed('compatibility.free.reason')
  // The documented contract: the free block either names the bridge component
  // or records why it is absent. A reason beside a present component is
  // allowed (extra explanation is not a contradiction); a silent absence is.
  if (plansComponent === undefined && !isNonEmptyString(freeReason)) {
    return malformed('compatibility.free.reason')
  }

  const limits = asRecord(manifest['limits'])
  if (limits === null) return malformed('limits')
  const maxTotalStoredBytes = limits['maxTotalStoredBytes']
  if (!isPositiveInteger(maxTotalStoredBytes)) return malformed('limits.maxTotalStoredBytes')
  const maxEntries = limits['maxEntries']
  if (!isPositiveInteger(maxEntries)) return malformed('limits.maxEntries')
  const maxManifestBytes = limits['maxManifestBytes']
  if (!isPositiveInteger(maxManifestBytes)) return malformed('limits.maxManifestBytes')
  const maxComponentBytes = limits['maxComponentBytes']
  if (!isPositiveInteger(maxComponentBytes)) return malformed('limits.maxComponentBytes')
  const maxJsonlLineBytes = limits['maxJsonlLineBytes']
  if (!isPositiveInteger(maxJsonlLineBytes)) return malformed('limits.maxJsonlLineBytes')
  const maxJsonNesting = limits['maxJsonNesting']
  if (!isPositiveInteger(maxJsonNesting)) return malformed('limits.maxJsonNesting')
  // The manifest must satisfy its own advertised bounds: a component larger
  // than the declared per-component cap, a total above the archive cap, or
  // more entries (components plus the manifest pair) than declared is
  // internally inconsistent, not a bigger archive.
  if (components.some((component) => component.byteLength > maxComponentBytes)) {
    return malformed('limits.maxComponentBytes')
  }
  if (totalBytes > maxTotalStoredBytes) return malformed('limits.maxTotalStoredBytes')
  if (components.length + 2 > maxEntries) return malformed('limits.maxEntries')
  if (manifestByteLength > maxManifestBytes) return malformed('limits.maxManifestBytes')

  return {
    ok: true,
    manifest: {
      format: COMPLETE_EXPORT_FORMAT,
      formatVersion: COMPLETE_EXPORT_FORMAT_VERSION,
      exportId,
      createdAtUtc,
      app: { product: appProduct, version: appVersion, platform: appPlatform },
      purpose,
      snapshot: { generation, startedAtUtc, completedAtUtc },
      plaintext: true,
      components,
      stores,
      omissions,
      totals: { components: components.length, logicalRecords: totalLogicalRecords, bytes: totalBytes },
      compatibility: {
        pro: { importable: proImportable, minimumContainerVersion },
        free: {
          importableContainer,
          ...(plansComponent !== undefined ? { plansComponent } : {}),
          ...(freeReason !== undefined ? { reason: freeReason } : {}),
        },
      },
      limits: {
        maxTotalStoredBytes,
        maxEntries,
        maxManifestBytes,
        maxComponentBytes,
        maxJsonlLineBytes,
        maxJsonNesting,
      },
    },
  }
}

/** Parse the exact `manifest.sha256` sidecar grammar. */
export function parseManifestSha256Line(line: string): { ok: true; sha256: string } | { ok: false } {
  const match = /^([0-9a-f]{64}) {2}manifest\.json\n$/.exec(line)
  return match === null ? { ok: false } : { ok: true, sha256: match[1]! }
}

/**
 * Hash raw bytes (or UTF-8 text) with SHA-256. This fails loudly when Web
 * Crypto is unavailable: a verifier that silently answers with a wrong digest
 * is worse than one that refuses to answer.
 */
export async function completeExportSha256Hex(data: Uint8Array | ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data)
  const webCrypto = globalThis.crypto
  if (webCrypto === undefined || webCrypto.subtle === undefined) {
    throw new Error('Web Crypto is unavailable; cannot verify a complete export')
  }
  // The cast narrows Uint8Array<ArrayBufferLike> to BufferSource; a
  // SharedArrayBuffer-backed view here would be a caller error.
  const digest = await webCrypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Verify `manifest.json` text against an exact `manifest.sha256` sidecar line. */
export async function verifyManifestText(
  manifestText: string,
  sha256Line: string,
): Promise<{ ok: true } | { ok: false; reason: 'bad_sha256_line' | 'sha256_mismatch' }> {
  const parsedLine = parseManifestSha256Line(sha256Line)
  if (!parsedLine.ok) return { ok: false, reason: 'bad_sha256_line' }
  const sha256 = await completeExportSha256Hex(manifestText)
  return sha256 === parsedLine.sha256 ? { ok: true } : { ok: false, reason: 'sha256_mismatch' }
}

/** Verify a component's exact stored length before hashing its raw bytes. */
export async function verifyComponentBytes(
  entry: CompleteExportComponentEntry,
  bytes: Uint8Array,
): Promise<{ ok: true } | { ok: false; reason: 'byte_length_mismatch' | 'sha256_mismatch' }> {
  if (bytes.byteLength !== entry.byteLength) return { ok: false, reason: 'byte_length_mismatch' }
  const sha256 = await completeExportSha256Hex(bytes)
  return sha256 === entry.sha256 ? { ok: true } : { ok: false, reason: 'sha256_mismatch' }
}
