/**
 * Keeps the docs that describe the codebase in sync with reality: the
 * Learning Center article count in DOCS/code-map.md and the workflow list in
 * code-map.md / README.md must match the tree, or these tests point at the
 * exact line to update.
 */
import { describe, expect, it } from 'vitest'

// Vite raw/glob imports keep this test inside the browser-typed src tree.
import codeMap from '../../DOCS/code-map.md?raw'
import planFileFormat from '../../DOCS/features/plan-file-format.md?raw'
import readme from '../../README.md?raw'
import { V2_BACKUP_VERSION } from '@retiregolden/planner-ui/data/v2Backup'
import { CURRENT_PLAN_SCHEMA_VERSION } from '@retiregolden/engine/model/plan'
import { LEARNING_ARTICLES } from '@retiregolden/planner-ui/learn/learningRegistry'

const workflowFiles = Object.keys(import.meta.glob('../../.github/workflows/*.yml')).map(
  (path) => path.split('/').pop()!,
)

describe('docs consistency', () => {
  it('code-map.md states the current Learning Center article count', () => {
    const match = codeMap.match(/(\d+) articles in `content\/`/)
    expect(match, 'code-map.md should mention "N articles in `content/`"').not.toBeNull()
    expect(Number(match![1])).toBe(LEARNING_ARTICLES.length)
  })

  it('code-map.md and README.md list every CI workflow', () => {
    expect(workflowFiles.length).toBeGreaterThan(0)
    for (const workflow of workflowFiles) {
      expect(codeMap, `code-map.md should mention ${workflow}`).toContain(workflow)
      expect(readme, `README.md should mention ${workflow}`).toContain(workflow)
    }
  })

  it('plan-file-format.md states the current plan schema and backup envelope versions', () => {
    expect(planFileFormat).toContain(`\`schemaVersion\` is currently **${CURRENT_PLAN_SCHEMA_VERSION}**`)
    expect(planFileFormat).toContain(`currently **${V2_BACKUP_VERSION}**`)
  })
})
