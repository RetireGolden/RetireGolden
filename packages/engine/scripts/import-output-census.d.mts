/**
 * Declarations for the census importer, so the census freshness test can
 * regenerate the frozen modules through the importer's own generator under
 * strict TypeScript without pulling scripts/ into the compiled package surface.
 */
export interface CensusInput {
  readonly families: readonly unknown[]
  readonly coverage: readonly unknown[]
  readonly exclusions: readonly unknown[]
}

export interface CensusModules {
  /** The text of src/rules/outputFamilies.ts. */
  readonly outputFamilies: string
  /** The text of src/rules/outputFieldCoverage.ts. */
  readonly outputFieldCoverage: string
  readonly counts: {
    readonly families: number
    readonly coverage: number
    readonly exclusions: number
  }
}

/** The three census file names, read from the Docs directory and copied under src/rules/census/. */
export declare const CENSUS_FILE_NAMES: readonly string[]

/**
 * Validates the parsed census and renders both frozen modules, their headers
 * naming `commit`. Throws on a malformed row, a duplicate family id, or a
 * coverage row whose familyId names no family.
 */
export declare function renderCensusModules(census: CensusInput, commit: string): CensusModules
