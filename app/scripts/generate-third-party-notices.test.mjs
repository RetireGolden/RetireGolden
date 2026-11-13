import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateNotices } from './generate-third-party-notices.mjs'

const fixtureBase = resolve(tmpdir())
const fixtureRoots = []
const originalExitCode = process.exitCode

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = originalExitCode
  for (const root of fixtureRoots.splice(0)) {
    if (dirname(root) !== fixtureBase) throw new Error('Unexpected fixture directory')
    rmSync(root, { recursive: true, force: true })
  }
})

function fixture() {
  const root = mkdtempSync(join(fixtureBase, 'rg-notices-test-'))
  fixtureRoots.push(root)
  const appDir = join(root, 'app')
  mkdirSync(join(appDir, 'public'), { recursive: true })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  return { root, appDir }
}

function install(root, version, author, license) {
  const dir = join(root, 'node_modules', '.pnpm', `example@${version}`, 'node_modules', 'example')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'example', version, author, license: 'MIT' }))
  writeFileSync(join(dir, 'LICENSE'), license)
  return dir
}

describe('third-party notices production versions', () => {
  it('reads metadata and license text from the production version despite an older installed copy', () => {
    const { root, appDir } = fixture()
    install(root, '1.0.0', 'Previous author', 'Previous license text')
    const current = install(root, '2.0.0', 'Current author', 'Current license text')

    generateNotices({ dependencies: { example: { version: '2.0.0', path: current } } }, appDir)

    const content = readFileSync(join(appDir, 'THIRD-PARTY-NOTICES.txt'), 'utf8')
    expect(content).toContain('example (2.0.0)')
    expect(content).toContain('Author: Current author')
    expect(content).toContain('Current license text')
    expect(content).not.toContain('Previous author')
    expect(content).not.toContain('Previous license text')
    expect(readFileSync(join(appDir, 'public', 'THIRD-PARTY-NOTICES.txt'), 'utf8')).toBe(content)
  })

  it('reports a missing production version instead of attributing an unrelated installed copy', () => {
    const { root, appDir } = fixture()
    install(root, '1.0.0', 'Previous author', 'Previous license text')

    generateNotices({ dependencies: { example: { version: '2.0.0' } } }, appDir)

    const content = readFileSync(join(appDir, 'THIRD-PARTY-NOTICES.txt'), 'utf8')
    expect(content).toContain('example@2.0.0 (not found in node_modules)')
    expect(content).not.toContain('example (2.0.0)')
    expect(content).not.toContain('Previous license text')
    expect(process.exitCode).toBe(1)
  })
})
