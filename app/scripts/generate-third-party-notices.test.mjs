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

function install(root, version, author, license, name = 'example') {
  const dir = join(root, 'node_modules', '.pnpm', `${name}@${version}`, 'node_modules', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version, author, license: 'MIT' }))
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

  it('fails incomplete attribution even when another production package has a license block', () => {
    const { root, appDir } = fixture()
    install(root, '1.0.0', 'Previous author', 'Previous license text')
    const available = install(root, '1.0.0', 'Available author', 'Available license text', 'available')

    generateNotices({ dependencies: {
      available: { version: '1.0.0', path: available },
      example: { version: '2.0.0' },
    } }, appDir)

    const content = readFileSync(join(appDir, 'THIRD-PARTY-NOTICES.txt'), 'utf8')
    expect(content).toContain('available (1.0.0)')
    expect(content).toContain('Available license text')
    expect(content).toContain('example@2.0.0 (not found in node_modules)')
    expect(content).not.toContain('Previous license text')
    expect(process.exitCode).toBe(1)
  })

  it('attributes each resolved version with its own metadata and license', () => {
    const { root, appDir } = fixture()
    install(root, '1.0.0', 'First author', 'First license text')
    install(root, '2.0.0', 'Second author', 'Second license text')

    generateNotices({ dependencies: { example: {
      version: '1.0.0',
      dependencies: { example: { version: '2.0.0' } },
    } } }, appDir)

    const content = readFileSync(join(appDir, 'THIRD-PARTY-NOTICES.txt'), 'utf8')
    expect(content).toContain('example (1.0.0)\nLicense: MIT\nAuthor: First author\n----------\nFirst license text')
    expect(content).toContain('example (2.0.0)\nLicense: MIT\nAuthor: Second author\n----------\nSecond license text')
    expect(content).toContain('Packages attributed: 2')
    expect(process.exitCode).toBe(originalExitCode)
  })

  it('fails when only one of two resolved versions is installed', () => {
    const { root, appDir } = fixture()
    install(root, '1.0.0', 'First author', 'First license text')

    generateNotices({ dependencies: { example: {
      version: '1.0.0',
      dependencies: { example: { version: '2.0.0' } },
    } } }, appDir)

    const content = readFileSync(join(appDir, 'THIRD-PARTY-NOTICES.txt'), 'utf8')
    expect(content).toContain('example@2.0.0 (not found in node_modules)')
    expect(content).not.toContain('example (2.0.0)')
    expect(process.exitCode).toBe(1)
  })
})
