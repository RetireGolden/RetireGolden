/**
 * Declarations for the coverage generator, so the freshness test can import
 * its glob walk under strict TypeScript without pulling scripts/ into the
 * compiled package surface.
 */
export declare function testSourcesInGlobShape(directory?: string): Record<string, string>
