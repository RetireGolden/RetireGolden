export function buildDispatchPrompt(input: {
  asOf: string
  ruleIds: readonly string[]
  registry: Readonly<Record<string, { title: string; statement: string; classification: string; contraryReading: string | null; errorDirection: string | null; conventionRationale: string | null; jurisdiction: string; volatility: string; verifiedOn: string; effectiveFrom: number; effectiveThrough: number | null; authority: ReadonlyArray<{ kind: string; citation: string; url: string; quotedText: string }> }>>
  manifestRules: ReadonlyArray<{ id: string; dueOn: string; implementedBy: readonly string[]; fixtureFiles: readonly string[] }>
  /** Repo-relative record module path per rule id. Omitted, the prompt falls back to naming the whole records directory. */
  recordModuleOf?: ReadonlyMap<string, string>
}): string
