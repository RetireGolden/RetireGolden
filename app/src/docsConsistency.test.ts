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
import setupToolchainAction from '../../.github/actions/setup-toolchain/action.yml?raw'
import { V2_BACKUP_VERSION } from '@retiregolden/planner-ui/data/v2Backup'
import { COMPLETE_EXPORT_FORMAT_VERSION } from '../../packages/planner-ui/src/data/completeExport'
import { CURRENT_PLAN_SCHEMA_VERSION } from '@retiregolden/engine/model/plan'
import { LEARNING_ARTICLES } from '@retiregolden/planner-ui/learn/learningRegistry'

const workflowFiles = Object.keys(import.meta.glob('../../.github/workflows/*.yml')).map(
  (path) => path.split('/').pop()!,
)
const nodeFloor = (JSON.parse(repoPackageJson) as { engines: { node: string } }).engines.node
const appNodeFloor = (JSON.parse(appPackageJson) as { engines: { node: string } }).engines.node
// packages/engine and packages/planner-ui are published to npm and ship no jsdom (it's a
// devDependency), so their own runtime floor is not required to track the workspace's
// dev-tooling floor above.
const enginePackageNodeFloor = (JSON.parse(enginePackageJson) as { engines: { node: string } }).engines.node
const plannerUiPackageNodeFloor = (JSON.parse(plannerUiPackageJson) as { engines: { node: string } })
  .engines.node
const publishedPackageNodeFloors = [enginePackageNodeFloor, plannerUiPackageNodeFloor]
// The Node major CI installs lives in one place: the shared composite action every
// workflow that runs Node uses (.github/actions/setup-toolchain).
const ciNodeVersion = setupToolchainAction.match(/node-version: '(\d+)'/)?.[1]

// Parses a '>=X[.Y[.Z]]' engines.node floor into numeric [major, minor, patch], defaulting
// an omitted minor/patch to 0.
function parseNodeFloor(floor: string): [number, number, number] {
  const match = floor.match(/^>=(\d+)(?:\.(\d+))?(?:\.(\d+))?$/)
  expect(match, `expected a '>=X[.Y[.Z]]' floor, got "${floor}"`).not.toBeNull()
  const [, major, minor, patch] = match!
  return [Number(major), Number(minor ?? 0), Number(patch ?? 0)]
}

// True when floor 'a' is not stricter than floor 'b' (a <= b in semver-floor terms).
function floorAtMost(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return true
}

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
    // The workspace floor may name a minor/patch inside the CI major: a dependency can
    // require one (jsdom 30 declares `^24.15.0`). The major still has to be the one CI
    // installs, because `node-version: '24'` resolves to the latest 24.x and nothing older.
    expect(nodeFloor).toMatch(/^>=\d+(?:\.\d+){0,2}$/)
    expect(nodeFloor.slice('>='.length).split('.')[0]).toBe(ciNodeVersion)
    for (const workflow of nodePinnedWorkflows) {
      // Every Node-running workflow goes through the composite, so the version is pinned
      // once; a raw setup-node step would reintroduce a second place to bump.
      expect(workflow).toContain('uses: ./.github/actions/setup-toolchain')
      expect(workflow).not.toMatch(/uses: actions\/setup-node@/)
    }
    expect(codeMap).toContain(`Node.js ${nodeFloor}`)
    expect(codeMap).toContain(`engines: node ${nodeFloor}`)
    expect(readme).toContain(`Node **${ciNodeVersion}** in CI`)
    // The app is unpublished workspace tooling, same floor as root.
    expect(appNodeFloor).toBe(nodeFloor)

    // packages/engine and packages/planner-ui are published to npm: their own README pins
    // whichever floor *they* describe, not the workspace's dev-tooling floor, and their
    // engines.node must never exceed the workspace floor (a published floor stricter than
    // the workspace itself needs would break older-Node consumers with no release deciding
    // it — see the 2026-07-24 @retiregolden/planner-ui 0.5.0 precedent, where an
    // engines.node move alone decided a MINOR release).
    expect(engineReadme).toContain(`Node ${enginePackageNodeFloor}`)
    const workspaceFloorParts = parseNodeFloor(nodeFloor)
    for (const floor of publishedPackageNodeFloors) {
      expect(floor).toMatch(/^>=\d+(?:\.\d+){0,2}$/)
      const parts = parseNodeFloor(floor)
      expect(parts[0]).toBe(workspaceFloorParts[0])
      expect(floorAtMost(parts, workspaceFloorParts)).toBe(true)
    }

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
