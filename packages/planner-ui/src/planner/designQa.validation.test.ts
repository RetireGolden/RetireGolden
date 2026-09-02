/**
 * Source and stylesheet pins for the validation chrome (#452, #459, #476,
 * #494). Behaviour is covered in validationChrome.test.tsx; these hold the
 * pieces jsdom cannot see.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

describe('validation chrome pins', () => {
  it('invalid controls and their messages use the danger token; the save chip is a button that jumps', () => {
    const css = read('./planner.css')
    expect(css).toMatch(/\.field input\[aria-invalid='true'\],\n\.field select\[aria-invalid='true'\] \{\s*border-color: var\(--bad\)/)
    expect(css).toMatch(/\.field-error \{[^}]*color: var\(--bad\)/)
    expect(css).toMatch(/\.save-state--button \{[^}]*cursor: pointer/)
    const workspace = read('./PlanWorkspace.tsx')
    expect(workspace).toMatch(/document\.querySelector<HTMLElement>\('\[aria-invalid="true"\], \.issue-list'\)/)
    expect(workspace).toContain('className="save-state save-state--error save-state--button"')
  })

  it('every plan section scopes its issue list', () => {
    const sections = ['Accounts', 'Assumptions', 'Household', 'IncomeFloor', 'Income', 'Insurance', 'Spending', 'Strategy']
    for (const name of sections) {
      const src = read(`./sections/${name}Section.tsx`)
      expect(src, name).toMatch(/<Issues section="[a-z-]+" \/>/)
      expect(src, name).not.toContain('<Issues />')
    }
  })

  it('scenario field lists never show raw pointer or dotted paths (#459)', () => {
    const scenarios = read('./ScenariosPage.tsx')
    expect(scenarios).not.toContain("preview.operationPaths.join(', ')")
    expect(scenarios).not.toContain("d.path.split('.').slice(-2)")
    expect(scenarios).toContain('{preview.operationPaths.map(fieldName)')
    expect(scenarios).toContain('{fieldName(d.path)}')
  })
})
