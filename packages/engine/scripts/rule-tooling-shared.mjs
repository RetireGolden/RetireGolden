import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const engineDir = resolve(scriptDir, '..')
export const repositoryDir = resolve(engineDir, '..', '..')
const sourceDir = join(engineDir, 'src')
const rulesDir = join(sourceDir, 'rules')

export async function loadModule(name) {
  const path = join(rulesDir, name)
  return import(pathToFileURL(path).href)
}

export function todayUtcIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Drops leading `--` tokens pnpm forwards after `pnpm <script> -- <flags>`. */
export function stripLeadingSeparators(argv) {
  const args = [...argv]
  while (args[0] === '--') args.shift()
  return args
}

export function validateAsOf(asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) {
    throw new Error('Invalid --as-of date: ' + asOf)
  }
  const parsed = new Date(asOf + 'T00:00:00Z')
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== asOf) {
    throw new Error('Invalid --as-of date: ' + asOf)
  }
}
