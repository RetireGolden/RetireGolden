/**
 * Types for the two non-TypeScript things `src/rules/quoteFidelityDocs.test.ts`
 * imports. It compares a table in DOCS/operations/quote-fidelity.md against the
 * constant the verifier actually uses, so it needs to read a markdown file and
 * a `.mjs` script.
 *
 * Declared here rather than reached for with `node:fs`, because the engine has
 * no `@types/node` and should not acquire one for this: the package is pure
 * domain math with no ambient IO (see eslint.config.js, which bans `fetch`,
 * `document` and `localStorage` in `src/**`), and giving it Node's globals to
 * satisfy one test would widen what the rest of `src` is able to reach for.
 * Vite reads both files at transform time instead, which needs no such types.
 */
declare module '*?raw' {
  /** File contents, verbatim. */
  const content: string
  export default content
}

declare module '*/host-conventions.mjs' {
  export interface HostConvention {
    /** Possessive/contraction apostrophe, or null where the host is inconsistent. */
    apostrophe: string | null
    structuralDash: string
    sectionSign: string
    notes: string
  }
  export const HOST_CONVENTIONS: Readonly<Record<string, HostConvention>>
}
