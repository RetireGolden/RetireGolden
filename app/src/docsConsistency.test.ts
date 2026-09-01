/**
 * Keeps the docs that describe the codebase in sync with reality: the
 * Learning Center article count in DOCS/code-map.md and the workflow list in
 * code-map.md / README.md must match the tree, or these tests point at the
 * exact line to update.
 */
import { describe, expect, it } from 'vitest'

// Vite raw/glob imports keep this test inside the browser-typed src tree.
import codeMap from '../../DOCS/code-map.md?raw'
import architecture from '../../DOCS/architecture.md?raw'
import standards from '../../DOCS/standards.md?raw'
import tipsIncomeFloor from '../../DOCS/domain/domain-rules-reference/18-tips-income-floor-ladders-the-ss-bridge.md?raw'
import planFileFormat from '../../DOCS/features/plan-file-format.md?raw'
import planningRecord from '../../DOCS/features/planning-record.md?raw'
import readme from '../../README.md?raw'
import engineReadme from '../../packages/engine/README.md?raw'
import appPackageJson from '../package.json?raw'
import enginePackageJson from '../../packages/engine/package.json?raw'
import plannerUiPackageJson from '../../packages/planner-ui/package.json?raw'
import repoPackageJson from '../../package.json?raw'
import fedInvestClient from '../../packages/planner-ui/src/data/fedInvestClient.ts?raw'
import incomeFloorSection from '../../packages/planner-ui/src/planner/sections/IncomeFloorSection.tsx?raw'
import owlParityWorkflow from '../../.github/workflows/owl-parity.yml?raw'
import publishEngineWorkflow from '../../.github/workflows/publish-engine.yml?raw'
import publishPlannerUiWorkflow from '../../.github/workflows/publish-planner-ui.yml?raw'
import resolveGateWorkflow from '../../.github/workflows/resolve-gate.yml?raw'
import swaWorkflow from '../../.github/workflows/azure-static-web-apps-retiregolden.yml?raw'
import { V2_BACKUP_VERSION } from '@retiregolden/planner-ui/data/v2Backup'
import { COMPLETE_EXPORT_FORMAT_VERSION } from '../../packages/planner-ui/src/data/completeExport'
import { CURRENT_PLAN_SCHEMA_VERSION } from '@retiregolden/engine/model/plan'
import { LEARNING_ARTICLES } from '@retiregolden/planner-ui/learn/learningRegistry'

const workflowFiles = Object.keys(import.meta.glob('../../.github/workflows/*.yml')).map(
  (path) => path.split('/').pop()!,
)
const nodeFloor = (JSON.parse(repoPackageJson) as { engines: { node: string } }).engines.node
const packageNodeFloors = [appPackageJson, enginePackageJson, plannerUiPackageJson].map(
  (manifest) => (JSON.parse(manifest) as { engines: { node: string } }).engines.node,
)
const ciNodeVersion = swaWorkflow.match(/node-version: '(\d+)'/)?.[1]
const nodePinnedWorkflows = [
  swaWorkflow,
  owlParityWorkflow,
  publishEngineWorkflow,
  publishPlannerUiWorkflow,
  resolveGateWorkflow,
]

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

  it('architecture.md states the current plan schema version', () => {
    expect(architecture).toMatch(
      new RegExp(`CURRENT_PLAN_SCHEMA_VERSION[^\\n]*\\*\\*${CURRENT_PLAN_SCHEMA_VERSION}\\*\\*`),
    )
  })

  it('documentation states the repository Node.js floor and CI version', () => {
    expect(ciNodeVersion).toBeDefined()
    expect(nodeFloor).toBe(`>=${ciNodeVersion}`)
    for (const workflow of nodePinnedWorkflows) {
      expect([...workflow.matchAll(/node-version: '(\d+)'/g)].map((match) => match[1])).toContain(ciNodeVersion)
    }
    expect(codeMap).toContain(`Node.js ${nodeFloor}`)
    expect(codeMap).toContain(`engines: node ${nodeFloor}`)
    expect(readme).toContain(`Node **${ciNodeVersion}** in CI`)
    expect(engineReadme).toContain(`Node ${nodeFloor}`)
    expect(packageNodeFloors).toEqual([nodeFloor, nodeFloor, nodeFloor])
    for (const doc of [codeMap, readme, engineReadme]) {
      expect(doc).not.toMatch(/\bNode\s*(?:≥|>=)\s*(?:20|22)\b/)
    }
  })

  it('architecture.md assigns opt-in FedInvest IO to the planner client', () => {
    for (const doc of [architecture, codeMap, standards, tipsIncomeFloor]) {
      expect(doc).toContain('planner-ui/src/data/fedInvestClient.ts')
    }
    expect(fedInvestClient).toMatch(/export\s+async\s+function\s+fetchFedInvestTips/)
    expect(incomeFloorSection).toMatch(/from '\.\.\/\.\.\/data\/fedInvestClient'/)
    expect(incomeFloorSection).toMatch(/fetchFedInvestTips\(\)/)
  })

  it('planning-record.md states the current complete-export format version', () => {
    expect(planningRecord).toContain('retiregolden.complete-export')
    expect(planningRecord).toContain(`\`formatVersion\` is currently **${COMPLETE_EXPORT_FORMAT_VERSION}**`)
  })
})
