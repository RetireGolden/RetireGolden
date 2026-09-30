import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Local machine paths in committed evidence (decision D-LOCAL-PATHS-IN-EVIDENCE).
 *
 * Evidence must be rerunnable by someone other than its author, so no committed
 * text may point at one person's disk: a drive-letter path, a home directory
 * (macOS or Linux), a Git Bash or WSL mount of a Windows drive, or the program's
 * worktree root. This module lists the files the rule covers and finds such
 * paths in them; localPaths.conformance.test.ts applies it to the repository.
 */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

// A path token runs from its start to the first character that cannot be part
// of a path as prose, JSON or source writes one.
const REST = String.raw`[^\s'"\x60<>|()\[\],;*]*`
const LOCAL_PATH = new RegExp(
  [
    // A drive letter, a colon and a slash either way (JSON and source strings
    // write the backslash doubled). Not after a letter or digit, so a URL's
    // scheme ("https:") is not a drive.
    String.raw`(?<![A-Za-z0-9_])[A-Za-z]:[\\/]` + REST,
    // A macOS or Linux home directory as an absolute path, in the case those
    // systems give it; "planner/home/" and "./home/" are relative, and a
    // site's "/Home/" page path is not a home directory.
    String.raw`(?<![\w.~-])/(?:Users|home)/[\w.-]` + REST,
    // A Windows drive as Git Bash or WSL mounts it.
    String.raw`(?<![\w.~-])/(?:mnt/)?[A-Za-z]/(?:Users|TEMP|Windows|rgwt)(?=[\\/])` + REST,
    // The program's worktree root, however it is reached.
    String.raw`\brgwt[\\/]` + REST,
  ].join('|'),
  'gu',
)

/**
 * Every local path in `text`, one entry per occurrence, with its 1-based line
 * and the whole path token as written.
 *
 * @param {string} text
 * @returns {{ line: number, token: string }[]}
 */
export function findLocalPaths(text) {
  const found = []
  text.split(/\r?\n/u).forEach((line, index) => {
    for (const match of line.matchAll(LOCAL_PATH)) found.push({ line: index + 1, token: match[0] })
  })
  return found
}

/** The trees the rule covers: DOCS/, packages/<name>/src/, packages/<name>/scripts/, app/src/ and scripts/. */
function inScope(path) {
  const [top, second, third] = path.split('/')
  if (top === 'DOCS' || top === 'scripts') return true
  if (top === 'app') return second === 'src'
  return top === 'packages' && (third === 'src' || third === 'scripts')
}

function run(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
}

function gitListing(root) {
  try {
    // A copy extracted inside another checkout would list that checkout's
    // index under a prefix that tracks nothing here; only this tree's own
    // repository is a listing of it.
    if (resolve(run(root, ['rev-parse', '--show-toplevel']).trim()) !== resolve(root)) return null
    return run(root, ['ls-files', '-z']).split('\0').filter((path) => path !== '')
  } catch {
    return null
  }
}

function walk(root, directory, into) {
  let entries
  try {
    entries = readdirSync(join(root, directory), { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) walk(root, path, into)
    else if (entry.isFile()) into.push(path)
  }
}

function diskListing(root) {
  const paths = []
  for (const top of ['DOCS', 'scripts', 'app/src']) walk(root, top, paths)
  let packages = []
  try {
    packages = readdirSync(join(root, 'packages'), { withFileTypes: true }).filter((entry) => entry.isDirectory())
  } catch {
    // No packages directory: nothing more to list.
  }
  for (const entry of packages) {
    walk(root, `packages/${entry.name}/src`, paths)
    walk(root, `packages/${entry.name}/scripts`, paths)
  }
  return paths
}

/**
 * The files the rule covers, relative to `root` with forward slashes, sorted.
 * Read from git's index when `root` is a checkout's top level; otherwise (a
 * `git archive` copy, which holds only tracked files) from the disk. `disk`
 * forces the second.
 *
 * @param {string} [root]
 * @param {{ disk?: boolean }} [options]
 * @returns {{ source: 'git' | 'disk', paths: string[] }}
 */
export function listScopedFiles(root = repositoryRoot, options = {}) {
  const tracked = options.disk === true ? null : gitListing(root)
  if (tracked !== null) return { source: 'git', paths: tracked.filter(inScope).sort() }
  return { source: 'disk', paths: diskListing(root).filter(inScope).sort() }
}

/**
 * Every local path in the covered files that are text (a file holding a NUL
 * byte is binary and skipped).
 *
 * @param {string} [root]
 * @returns {{ source: 'git' | 'disk', paths: string[], found: { path: string, line: number, token: string }[] }}
 */
export function scanForLocalPaths(root = repositoryRoot) {
  const { source, paths } = listScopedFiles(root)
  const found = []
  for (const path of paths) {
    let bytes
    try {
      bytes = readFileSync(join(root, path))
    } catch {
      // Listed by the index but deleted in the working tree: nothing to read.
      continue
    }
    if (bytes.includes(0)) continue
    for (const hit of findLocalPaths(bytes.toString('utf8'))) found.push({ path, ...hit })
  }
  return { source, paths, found }
}
