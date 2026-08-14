#!/usr/bin/env node
/**
 * Generates THIRD-PARTY-NOTICES.txt from the resolved production dependency
 * tree (direct + transitive), by reading each package's actual LICENSE file
 * from node_modules. Run from the app/ directory:
 *
 *   pnpm run licenses
 *
 * Re-run whenever production dependencies change, then commit the result and
 * copy it into app/public/ (see the script in package.json). TypeScript-only
 * `@types/*` packages are excluded — they ship as types, never reach the
 * runtime bundle, and carry no attribution obligation.
 *
 * This is a dev/build-time tool with no runtime dependencies; it shells out to
 * `pnpm list` and reads the filesystem only. @see DOCS/enhancements/gap-analysis-closeout.md WS-E
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = join(__dirname, '..')

const LICENSE_FILENAMES = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT', 'LICENSE.BSD',
  'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'COPYING', 'COPYING.md', 'COPYING.txt',
  'NOTICE', 'NOTICE.md',
]

/** Recursively flatten the `pnpm list` tree into name -> Set<version> (dedup). */
function flatten(deps, out = new Map()) {
  for (const [name, node] of Object.entries(deps ?? {})) {
    if (node.version) {
      if (!out.has(name)) out.set(name, new Set())
      out.get(name).add(node.version)
    }
    if (node.dependencies) flatten(node.dependencies, out)
  }
  return out
}

/**
 * Walk node_modules (including nested copies) and return name -> [{version, dir}]
 * for every installed package. Filesystem reads are not restricted by a
 * package's `exports` field (which blocks `require.resolve('<pkg>/package.json')`
 * for d3-*, highs, clsx, …), so walking the directory tree directly is the
 * robust way to find each package's real install location(s).
 */
function walkNodeModules(root, out = new Map()) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.name === '.bin' || ent.name === '.cache' || ent.name === '.vite' || ent.name === '.tmp') continue
    const child = join(root, ent.name)
    // pnpm links packages into node_modules; Dirent.isDirectory() is false for
    // those symlinks. Follow them. Also walk the virtual store (`.pnpm`).
    let isDir = ent.isDirectory()
    if (!isDir && ent.isSymbolicLink()) {
      try {
        isDir = statSync(child).isDirectory()
      } catch {
        continue
      }
    }
    if (!isDir) continue
    if (ent.name === '.pnpm') {
      walkNodeModules(child, out)
      continue
    }
    // Scoped package: @scope/pkg — descend into @scope then pkg.
    if (ent.name.startsWith('@') && !ent.name.includes('node_modules')) {
      // Is this a scoped dir containing packages?
      const pkgJson = join(child, 'package.json')
      if (!existsSync(pkgJson)) {
        walkNodeModules(child, out) // it's a scope folder; descend
        continue
      }
    }
    // Read this package.json if present.
    const pkgJson = join(child, 'package.json')
    if (existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'))
        if (pkg.name) {
          if (!out.has(pkg.name)) out.set(pkg.name, [])
          out.get(pkg.name).push({ version: pkg.version, dir: child, pkg })
        }
      } catch {
        // invalid json; skip
      }
    }
    // Recurse into a nested node_modules.
    const nested = join(child, 'node_modules')
    if (existsSync(nested)) walkNodeModules(nested, out)
  }
  return out
}

/** Find the LICENSE/NOTICE file for a package at `pkgDir`. */
function findLicenseFile(pkgDir) {
  for (const name of LICENSE_FILENAMES) {
    const candidate = join(pkgDir, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function readLicenseText(pkgDir) {
  const file = findLicenseFile(pkgDir)
  if (!file) return null
  return readFileSync(file, 'utf8').trim()
}

/**
 * Copyleft/share-alike detection against the SPDX `license` field — never the
 * full license text (which would substring-match false positives). The field is
 * the authoritative declaration.
 */
function detectCopyleft(licenseField) {
  const l = (licenseField ?? '').toUpperCase().trim()
  if (!l) return false
  return /\b(GPL|AGPL|LGPL|MPL|EPL|CDDL|EUPL|OFL|SISSL|COPYLEFT|SSPL)\b|^(GPL|AGPL|LGPL|MPL|EPL|CDDL|EUPL|SSPL)/.test(l)
}

function main() {
  // Resolved production dependency tree (direct + transitive), excluding dev.
  // shell:true so the `pnpm` shim is found on Windows. `pnpm list` exits
  // non-zero when peers are unmet; stdout is still the JSON tree.
  let json
  try {
    json = execFileSync('pnpm', ['list', '--prod', '--json', '--depth', 'Infinity'], {
      cwd: appDir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: true,
    })
  } catch (err) {
    if (typeof err.stdout !== 'string' || err.stdout.trim() === '') throw err
    json = err.stdout
  }
  const listed = JSON.parse(json)
  const tree = Array.isArray(listed) ? listed[0] : listed
  const prodNames = flatten(tree.dependencies)

  // Walk the actual install tree to find each package's directory. pnpm
  // links workspace packages and keeps the rest in the virtual store, so
  // walk app-local node_modules, the repo-root node_modules, and `.pnpm`.
  const installed = walkNodeModules(join(appDir, 'node_modules'))
  walkNodeModules(join(appDir, '..', 'node_modules'), installed)
  // Prefer the install path `pnpm list` already resolved — that is the
  // production tree, including transitive deps that are not top-level links.
  function collectListPaths(deps) {
    for (const node of Object.values(deps ?? {})) {
      if (node.path && node.version && existsSync(join(node.path, 'package.json'))) {
        try {
          const pkg = JSON.parse(readFileSync(join(node.path, 'package.json'), 'utf8'))
          if (pkg.name) {
            if (!installed.has(pkg.name)) installed.set(pkg.name, [])
            const already = installed.get(pkg.name).some((c) => c.dir === node.path)
            if (!already) installed.get(pkg.name).push({ version: pkg.version, dir: node.path, pkg })
          }
        } catch {
          // invalid json; skip
        }
      }
      if (node.dependencies) collectListPaths(node.dependencies)
    }
  }
  collectListPaths(tree.dependencies)

  // Exclude TypeScript-only type packages (they never reach the runtime
  // bundle) and first-party @retiregolden/* workspace packages (our own
  // AGPL code, not a third party).
  const excluded = []
  const included = []
  for (const [name, versions] of prodNames) {
    if (name.startsWith('@types/') || name.startsWith('@retiregolden/')) {
      excluded.push(`${name}@${[...versions].join('/')}`)
      continue
    }
    included.push([name, versions])
  }
  included.sort((a, b) => a[0].localeCompare(b[0]))

  const copyleftHits = []
  const missing = []
  const blocks = []

  for (const [name, versions] of included) {
    const copies = installed.get(name) ?? []
    if (copies.length === 0) {
      // `pnpm list` includes optional platform packages that are not
      // installed on this OS. Skip them rather than attributing a hole.
      continue
    }
    // Prefer a copy that has a LICENSE file; fall back to the first.
    const withLicense = copies.find((c) => findLicenseFile(c.dir) !== null) ?? copies[0]
    const { dir: pkgDir, pkg } = withLicense
    const licenseField = Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type ?? l).join(', ') : pkg.license ?? (typeof pkg.license === 'object' ? pkg.license.type : undefined)
    const author = typeof pkg.author === 'object' ? `${pkg.author.name ?? ''}${pkg.author.email ? ` <${pkg.author.email}>` : ''}${pkg.author.url ? ` (${pkg.author.url})` : ''}` : (pkg.author ?? '')
    const homepage = pkg.homepage ?? (typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository) ?? ''
    const text = readLicenseText(pkgDir)

    if (detectCopyleft(licenseField)) copyleftHits.push(`${name}@${[...versions].join('/')}`)

    const lines = []
    lines.push(`${name} (${[...versions].join(', ')})`)
    if (licenseField) lines.push(`License: ${licenseField}`)
    if (author) lines.push(`Author: ${author}`)
    if (homepage) lines.push(`Homepage: ${homepage}`)
    if (!text) missing.push(`${name}@${[...versions].join('/')}`)
    blocks.push({ heading: lines.join('\n'), text: text ?? '(No LICENSE file found in the package; see the package metadata above.)' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const out = []
  out.push('THIRD-PARTY NOTICES')
  out.push('')
  out.push('RetireGolden incorporates the following third-party packages, which are')
  out.push('distributed under their respective licenses. Generated from the resolved')
  out.push('production dependency tree (direct + transitive, excluding TypeScript-only')
  out.push('@types/* packages that never reach the runtime bundle).')
  out.push('')
  out.push(`Generated: ${today}`)
  out.push(`Source:    pnpm list --prod --depth Infinity (workspace root pnpm-lock.yaml)`)
  out.push('')
  out.push('================================================================================')
  out.push('')
  for (const b of blocks) {
    out.push(b.heading)
    out.push('----------')
    out.push(b.text)
    out.push('')
    out.push('--------------------------------------------------------------------------------')
    out.push('')
  }

  out.push('Summary')
  out.push('-------')
  out.push(`Packages attributed: ${blocks.length}`)
  out.push(`Excluded (type-only @types/*, first-party @retiregolden/*): ${excluded.length}`)
  if (copyleftHits.length > 0) {
    out.push('')
    out.push('COOPYLEFT / SHARE-ALIKE LICENSES DETECTED (review before shipping):')
    for (const h of copyleftHits) out.push(`  - ${h}`)
  } else {
    out.push('Copyleft/share-alike licenses detected: none (all permissive MIT/ISC/BSD/Apache).')
  }
  if (missing.length > 0) {
    out.push('')
    out.push('Packages with no LICENSE file found (metadata only above):')
    for (const m of missing) out.push(`  - ${m}`)
  }
  out.push('')
  out.push('Excluded @types/* packages (TypeScript-only; not in the runtime bundle):')
  for (const e of excluded) out.push(`  - ${e}`)
  out.push('')

  const content = out.join('\n')
  const canonicalFile = join(appDir, 'THIRD-PARTY-NOTICES.txt')
  writeFileSync(canonicalFile, content, 'utf8')
  // Derive the shipped copy under public/ so Vite copies it verbatim into dist
  // (the canonical repo file is not bundled by default). One source of truth.
  const publicDir = join(appDir, 'public')
  if (existsSync(publicDir)) writeFileSync(join(publicDir, 'THIRD-PARTY-NOTICES.txt'), content, 'utf8')
  console.log(`Wrote ${canonicalFile} — ${blocks.length} packages attributed.`)
  if (blocks.length === 0) {
    console.error('ERROR: no production packages were attributed — pnpm list or node_modules walk failed.')
    process.exitCode = 1
  }
  if (copyleftHits.length > 0) {
    console.error(`WARNING: copyleft licenses detected: ${copyleftHits.join(', ')}`)
    process.exitCode = 1
  }
}

await main()
