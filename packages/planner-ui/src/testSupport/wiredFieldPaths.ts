/**
 * Every schema path a field component is wired to, read out of the source.
 *
 * Two suites depend on this being complete: the engine round-trip
 * (`validationIssues.enginePaths.test.ts`) proves each path is one the engine
 * actually reports, and the bounds drift guard
 * (`schemaFieldBounds.test.ts`) proves each one's range comes from the engine
 * schema. A wiring form this scanner cannot see is a path that escapes both,
 * so the forms are enumerated here rather than in either suite (review r3-5,
 * r3-6).
 *
 * Test-support only: nothing here is imported by the app.
 */

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import * as nodeFsRaw from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import * as nodeUrlRaw from 'node:url'

// The app tsconfig carries no @types/node, so the imports above resolve to
// `any`. Casting the whole namespace once, ahead of any member access, is
// what stops that `any` from making every call through it unsafe below —
// these signatures are the only shapes this file calls.
interface NodeFsLike {
  readdirSync: (path: string, opts: { withFileTypes: true }) => Array<{ name: string; isDirectory: () => boolean }>
  readFileSync: (path: string, encoding: string) => string
}
interface NodeUrlLike {
  fileURLToPath: (url: string | URL) => string
}
const nodeFs = nodeFsRaw as NodeFsLike
const nodeUrl = nodeUrlRaw as NodeUrlLike
const { readdirSync, readFileSync } = nodeFs
const { fileURLToPath } = nodeUrl

/**
 * What each interpolation in a wired path template stands for. List indexes
 * resolve to a fixture position; the asset-class id resolves to `*`, since the
 * same field is wired once for every class the schema allows and a consumer
 * must expand it to all of them rather than test the first (review r4-1).
 */
export const WILDCARD = '*'

const INDEX_OF: Record<string, string> = {
  index: '0',
  i: '0',
  ri: '0',
  streamIndex: '2',
  ladderIndex: '0',
  id: WILDCARD,
}

/**
 * Substitutes the index names above and leaves anything else (`${leaf}`, which
 * the helper form fills in per call site) intact, so an interpolation this
 * scanner does not know is never silently resolved to the wrong path.
 */
const resolveTemplate = (tpl: string): string =>
  tpl.replace(/\$\{(\w+)\}/g, (whole: string, name: string) => INDEX_OF[name] ?? whole)

function sourceFiles(from: string): string[] {
  const files: string[] = []
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = `${at}/${entry.name}`
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) files.push(full)
    }
  }
  walk(from)
  return files
}

/**
 * The three wiring forms in use:
 *   path="strategies.qcdAnnual"
 *   path={`incomes.${index}.endAge`}
 *   path={fieldPath('startYear')}, where a helper in the same file builds the
 *     template — the income-floor rows address their ladder by id, so the
 *     index is computed once and the leaves are passed in (#512).
 */
export function wiredFieldPaths(dirUrl: string | URL = new URL('../planner/', import.meta.url)): string[] {
  const found = new Set<string>()
  for (const file of sourceFiles(fileURLToPath(dirUrl))) {
    const src = readFileSync(file, 'utf8')
    for (const [, quoted] of src.matchAll(/\bpath="([^"]+)"/g)) if (quoted!.includes('.')) found.add(quoted!)
    for (const [, tpl] of src.matchAll(/\bpath=\{`([^`]+)`\}/g)) {
      const resolved = resolveTemplate(tpl!)
      if (!resolved.includes('${')) found.add(resolved)
    }
    // A helper of the form `const NAME = (leaf: string) => (… ? `TEMPLATE` : undefined)`
    // paired with `path={NAME('leaf')}` call sites.
    for (const [, helper, tpl] of src.matchAll(/const (\w+) = \(leaf: string\) =>[^`]*`([^`]+)`/g)) {
      const template = resolveTemplate(tpl!)
      for (const [, leaf] of src.matchAll(new RegExp(`\\bpath=\\{${helper}\\('([^']+)'\\)\\}`, 'g'))) {
        const resolved = template.replace('${leaf}', leaf!)
        if (!resolved.includes('${')) found.add(resolved)
      }
    }
  }
  return [...found].sort()
}
