/**
 * Declarations for the coverage generator, so the freshness test can import
 * its glob walk under strict TypeScript without pulling scripts/ into the
 * compiled package surface.
 */
export declare function testSourcesInGlobShape(directory?: string): Record<string, string>

/**
 * Whether `text` is a coverage shard this generator wrote, judged by the
 * shard's `kind` discriminator. Unparseable content answers false, so the
 * generator's orphan sweep only ever deletes what it positively recognises as
 * its own prior output.
 */
export declare function isGeneratedShardText(text: string): boolean
