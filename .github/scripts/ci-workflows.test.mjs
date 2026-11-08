import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import './swa-preview-cleanup.test.mjs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')

// Exact action references below intentionally make workflow updates visible.
// Automated action-pin PRs need the matching contract update in the same branch.

function job(source, id) {
  const marker = `  ${id}:\n`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing job ${id}`)
  const remainder = source.slice(start + marker.length)
  const next = /^  [A-Za-z0-9_-]+:\s*$/m.exec(remainder)
  const end = next === null ? undefined : start + marker.length + next.index
  return source.slice(start, end)
}

test('unprivileged Semgrep job uses an exact workflow-owned install', () => {
  const source = read('.github/workflows/semgrep.yml')
  const scan = job(source, 'semgrep')
  const publisher = job(source, 'publish_sarif')
  const updateMarker = read('.github/requirements.txt').match(/^semgrep==(\d+\.\d+\.\d+)$/m)
  assert.notEqual(updateMarker, null)
  const install = `semgrep==${updateMarker[1]}`
  assert.ok(scan.includes(`python -m pip install '${install}'`))
  assert.ok(read('DOCS/operations/security-scanning.md').includes(`\`${install}\``))
  assert.doesNotMatch(scan, /pip install -r/)
  assert.doesNotMatch(scan, /security-events:\s*write/)
  assert.doesNotMatch(scan, /github\/codeql-action\/upload-sarif/)
  assert.match(scan, /name: Scan \(p\/default\)/)
  assert.match(scan, /name: semgrep-sarif/)
  assert.match(publisher, /github\.event_name == 'push'/)
  assert.match(publisher, /github\.ref == 'refs\/heads\/main'/)
  assert.match(publisher, /security-events: write/)
  assert.match(publisher, /github\/codeql-action\/upload-sarif@[0-9a-f]{40}/)
})

for (const [workflow, artifact, packageName] of [
  ['publish-engine.yml', 'engine-package', '@retiregolden/engine'],
  ['publish-planner-ui.yml', 'planner-ui-package', '@retiregolden/planner-ui'],
]) {
  test(`${workflow} isolates build work from publish credentials`, () => {
    const source = read(`.github/workflows/${workflow}`)
    const build = job(source, 'build-and-smoke')
    const publish = job(source, 'publish')

    assert.match(build, /permissions:\n\s+contents: read/)
    assert.doesNotMatch(build, /id-token:/)
    assert.doesNotMatch(build, /environment:/)
    assert.match(build, /pnpm install --frozen-lockfile/)
    assert.match(build, /sha256sum/)
    assert.match(build, /PACK_SMOKE_TARBALL: \${{ steps\.pack\.outputs\.tarball }}/)
    assert.ok(build.indexOf('Pack release tarball') < build.indexOf('Smoke test the release tarball'))
    assert.match(build, /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/)
    assert.match(build, /retention-days: 7/)

    assert.match(publish, /environment: npm-publish/)
    assert.match(publish, /id-token: write/)
    assert.match(publish, /actions\/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333/)
    assert.match(publish, /npm install -g 'npm@11\.5\.1'/)
    assert.match(publish, /sha256sum --check package\.sha256/)
    assert.match(publish, new RegExp(`name: ${artifact}`))
    assert.match(publish, new RegExp(packageName.replace('/', '\\/')))
    assert.match(publish, /npm publish "\$TARBALL" --access public --provenance/)
    assert.match(publish, /if \[ "\$EVENT_NAME" = 'workflow_dispatch' \]; then\s+npm publish "\$TARBALL" --access public --dry-run\s+else\s+npm publish "\$TARBALL" --access public --provenance/s)
    assert.match(source, /if: github\.event_name == 'workflow_dispatch' && inputs\.dry_run == 'false'/)
    assert.match(source, /refs\/tags\/[a-z-]+-v\*\) tag_version=/)
    assert.doesNotMatch(publish, /actions\/checkout/)
    assert.doesNotMatch(publish, /pnpm install/)
    assert.doesNotMatch(publish, /scripts\/pack-smoke/)
  })
}

test('planner smoke consumer dependency entries are exact and satisfy peer floors', () => {
  const source = read('packages/planner-ui/scripts/pack-smoke.mjs')
  const manifest = /^\s{8}dependencies: \{\n(?<dependencies>[\s\S]*?)^\s{8}\},\n^\s{8}devDependencies: \{\n(?<devDependencies>[\s\S]*?)^\s{8}\},/m.exec(source)
  assert.notEqual(manifest, null)

  const entry = (block, name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`^\\s+(?:'${escaped}'|${escaped}): '([^']+)',?$`, 'm').exec(block)
    assert.notEqual(match, null, `missing scratch dependency ${name}`)
    return match[1]
  }
  const exactDependencies = {
    react: '19.2.8',
    'react-dom': '19.2.8',
    'react-router': '8.3.0',
  }
  const exactDevDependencies = {
    '@vitejs/plugin-react': '6.0.1',
    vite: '8.0.16',
  }
  for (const [name, version] of Object.entries(exactDependencies)) {
    assert.equal(entry(manifest.groups.dependencies, name), version)
  }
  for (const [name, version] of Object.entries(exactDevDependencies)) {
    assert.equal(entry(manifest.groups.devDependencies, name), version)
  }

  const peers = JSON.parse(read('packages/planner-ui/package.json')).peerDependencies
  const parts = (version) => version.replace(/^\^/, '').split('.').map(Number)
  const compare = (left, right) => {
    for (let index = 0; index < 3; index += 1) {
      if (left[index] !== right[index]) return left[index] - right[index]
    }
    return 0
  }
  for (const [name, version] of Object.entries(exactDependencies)) {
    const peer = peers[name]
    assert.match(peer, /^\^\d+\.\d+\.\d+$/)
    assert.equal(parts(version)[0], parts(peer)[0], `${name} must stay in the peer major`)
    assert.ok(compare(parts(version), parts(peer)) >= 0, `${name} must satisfy its peer floor`)
  }
})

test('pack smoke scripts exercise a caller-provided release tarball', () => {
  for (const path of [
    'packages/engine/scripts/pack-smoke.mjs',
    'packages/planner-ui/scripts/pack-smoke.mjs',
  ]) {
    const source = read(path)
    assert.match(source, /process\.env\.PACK_SMOKE_TARBALL/)
    assert.match(source, /copyFileSync\(providedTarball,/)
    assert.match(source, /using provided tarball/)
  }
})

test('Azure source workflow stops at the trusted build artifact', () => {
  const source = read('.github/workflows/azure-static-web-apps-retiregolden.yml')
  const controller = read('.github/workflows/azure-static-web-apps-controller.yml')
  const authorize = job(source, 'authorize')
  const forkZap = job(source, 'fork_zap_gate')
  const preview = job(controller, 'deploy_preview')
  assert.match(authorize, /if \(!result\.authorized\) core\.setFailed\(result\.reason\)/)
  assert.doesNotMatch(authorize, /Retrying cutover authorization/)
  assert.doesNotMatch(source, /^  (deploy|dast|close_pull_request):\s*$/m)
  assert.doesNotMatch(source, /AZURE_STATIC_WEB_APPS_API_TOKEN/)
  assert.match(forkZap, /ZAP DAST \/ ZAP Baseline/)
  assert.match(forkZap, /head\.repo\.full_name != github\.repository/)
  assert.match(forkZap, /Require a same-repository preview/)
  assert.match(preview, /actions\/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333/)
  assert.match(preview, /Azure\/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1/)
  assert.doesNotMatch(controller, /actions\/checkout/)
  assert.doesNotMatch(controller, /setup-toolchain|pnpm|npm install/)
})

test('direct reusable ZAP calls fail closed when the target URL is empty', () => {
  const source = read('.github/workflows/zap.yml')
  const inputs = source.slice(source.indexOf('  workflow_call:'), source.indexOf('  workflow_dispatch:'))
  const zap = job(source, 'zap_baseline')
  const guardStart = zap.indexOf('name: Require an authorized preview URL')
  const scanStart = zap.indexOf('name: ZAP Baseline Scan')
  assert.match(inputs, /target_url:[\s\S]*?default: ''/)
  assert.match(zap, /name: ZAP Baseline/)
  assert.ok(guardStart >= 0 && scanStart > guardStart)
  const guard = zap.slice(guardStart, scanStart)
  assert.match(guard, /TARGET_URL: \${{ inputs\.target_url }}/)
  assert.match(guard, /if \[ -z "\$TARGET_URL" \]; then[\s\S]*?exit 1/)
  assert.doesNotMatch(zap, /^\s+if: inputs\.target_url != ''$/m)
})

test('default-branch SWA controller owns deployment, scan publication, and teardown', () => {
  const source = read('.github/workflows/azure-static-web-apps-controller.yml')
  const inspect = job(source, 'inspect')
  const preview = job(source, 'deploy_preview')
  const publisher = job(source, 'publish_pr_result')
  const production = job(source, 'deploy_production')
  const close = job(source, 'close_preview')
  assert.doesNotMatch(inspect, /Retrying cutover deployment authorization/)

  assert.match(source, /workflow_run:[\s\S]*?workflows: \[Azure Static Web Apps CI\/CD\]/)
  assert.match(source, /GitHub emits `completed` for rerun attempts too/)
  assert.match(source, /pull_request_target:\n\s+types: \[closed\]/)
  assert.doesNotMatch(
    read('.github/workflows/azure-static-web-apps-retiregolden.yml'),
    /^  (deploy|dast|close_pull_request):\s*$/m,
  )
  assert.match(inspect, /classifyAzureControllerSourceJobs/)
  assert.match(inspect, /outputs\.legacy = 'true'/)
  assert.match(inspect, /sourceWorkflowHasLegacyDeploy/)
  assert.match(inspect, /outputs\.mode = 'legacy-result'/)
  assert.match(inspect, /conclusions\.get\('ZAP DAST'\) === 'success'/)
  assert.match(inspect, /conclusions\.get\('ZAP DAST \/ ZAP Baseline'\) === 'success'/)
  assert.match(inspect, /legacyZapSucceeded/)
  assert.match(inspect, /run\.head_repository\?\.full_name \|\| run\.repository\?\.full_name/)
  assert.match(inspect, /outputs\.mode = 'unsupported'/)
  assert.match(inspect, /outputs\.gate_success/)
  assert.match(inspect, /authorizeExactHeadPullRequest/)
  assert.match(inspect, /azureSourceWorkflowBlobAllowed\(\s*sourceFile, activeSourceFile, legacyBackstop,/)
  assert.match(inspect, /PR source workflow does not match the trusted default-branch workflow/)
  assert.match(
    read('.github/scripts/ci-acceleration.mjs'),
    /TRUSTED_STAGED_AZURE_SOURCE_WORKFLOW_BLOB_SHAS = new Set\(\)/,
  )
  assert.match(inspect, /listWorkflowRunArtifacts/)
  assert.match(inspect, /dist\.length !== 1/)
  assert.match(preview, /actions\/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333/)
  assert.match(preview, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/)
  assert.match(preview, /deployment_environment: pr\$\{\{ needs\.inspect\.outputs\.pr_number \}\}/)
  assert.match(preview, /Recheck live preview ownership/)
  assert.match(preview, /previewDeploymentSkipReason/)
  assert.equal((preview.match(/previewDeploymentSkipReason/g) ?? []).length, 3)
  assert.match(preview, /core\.setOutput\('cleanup', pr\.state === 'open' \? 'false' : 'true'\)/)
  assert.match(preview, /Verify named preview removal for a closed PR before upload/)
  assert.match(preview, /Verify preview removal after an invalidated upload/)
  assert.match(preview, /Reject superseded preview deployment/)
  assert.match(preview, /cancel-in-progress: false/)
  assert.doesNotMatch(preview, /repo_token:/)
  assert.match(publisher, /const name = 'ZAP DAST \/ ZAP Baseline'/)
  assert.match(publisher, /checks\.create/)
  assert.match(publisher, /azureControllerPrResultSuccess/)
  assert.match(publisher, /SOURCE_READY: \$\{\{ needs\.inspect\.outputs\.deploy_ready \}\}/)
  assert.match(publisher, /azureSourceCheckExternalId/)
  assert.match(publisher, /azureSourceCheckIsNewer/)
  assert.match(publisher, /actions: read/)
  assert.match(publisher, /listWorkflowRuns/)
  assert.match(publisher, /activeStatuses/)
  assert.match(publisher, /newestAzureSourceCheck/)
  assert.match(publisher, /checks\.update/)
  assert.match(publisher, /SOURCE_MODE: \$\{\{ needs\.inspect\.outputs\.mode \}\}/)
  assert.match(publisher, /Reasserted newer Azure source result/)
  assert.ok(publisher.indexOf('checks.create') < publisher.indexOf('const refreshed'))
  assert.match(production, /group: swa-production/)
  assert.match(production, /cancel-in-progress: false/)
  assert.match(production, /Recheck current production head/)
  assert.match(production, /productionDeploymentSkipReason/)
  assert.match(production, /Record a newer main commit after upload/)
  assert.match(close, /action: close/)
  assert.match(close, /Close legacy pull-request environment if present/)
  assert.match(close, /id: close_legacy\n\s+continue-on-error: true/)
  assert.match(close, /Delete and verify the closed named preview/)
  assert.match(close, /cleanup\.cleanupPreview/)
  assert.match(close, /if \(result\.status === 'blocked'\) core\.setFailed/)
  assert.doesNotMatch(close, /NAMED_OUTCOME|close_named/)
  assert.doesNotMatch(source, /actions\/checkout@/)
  assert.doesNotMatch(source, /\bpnpm\b|npm install/)
})

test('review caller stages trusted default-branch events and exact gate publication', () => {
  const source = read('.github/workflows/openrouter-code-review.yml')
  const review = job(source, 'review')
  const gate = job(source, 'gate-check')
  const pin = 'cb192b3e6ae8f12cb7081a0b6a3de95098d4ffaf'

  assert.doesNotMatch(source, /^  pull_request:\s*$/m)
  assert.match(source, /pull_request_target:\n\s+types: \[opened, synchronize, reopened, ready_for_review\]/)
  assert.match(source, /repository_dispatch:\n\s+types: \[openrouter-review\]/)
  assert.match(source, /checks: write/)
  assert.doesNotMatch(source, /^  target-selection:\s*$/m)
  assert.match(review, /github\.event\.pull_request\.head\.repo\.full_name == github\.event\.repository\.full_name/)
  assert.match(review, new RegExp(`openrouter-code-review\\.yml@${pin}`))
  assert.doesNotMatch(review, /checks: write/)
  assert.match(review, /expected_head_sha: \$\{\{ github\.event\.client_payload\.head_sha \|\| '' \}\}/)
  assert.match(gate, new RegExp(`openrouter-review-gate-check\\.yml@${pin}`))
  assert.match(gate, /checks: write/)
  assert.match(gate, /github\.event\.pull_request\.head\.repo\.full_name != github\.event\.repository\.full_name/)
  assert.match(gate, /head_sha: \$\{\{ needs\.review\.outputs\.gate_head_sha \|\| github\.event\.pull_request\.head\.sha \}\}/)
  assert.match(gate, /conclusion: \$\{\{ needs\.review\.outputs\.gate_conclusion \|\| 'failure' \}\}/)
})


test('cleanup credentials and helpers stay in trusted environment-bound jobs', () => {
  const source = read('.github/workflows/azure-static-web-apps-controller.yml')
  for (const id of ['deploy_preview', 'close_preview']) {
    const section = job(source, id)
    assert.match(section, /environment: azure-preview-cleanup/)
    assert.match(section, /id-token: write/)
    assert.match(section, /azure\/login@a641126d1b8aa4d1fa005f4f92df94a3a4c4c906/)
    assert.match(section, /group: swa-preview-pr\$\{\{/)
    assert.match(section, /cancel-in-progress: false/)
    assert.match(section, /path: '.github\/scripts\/swa-preview-cleanup\.mjs'|load\('.github\/scripts\/swa-preview-cleanup\.mjs'\)/)
    assert.match(section, /ref: context\.payload\.repository\.default_branch/)
    assert.match(section, /createAzureCliAdapter/)
  }
  const preview = job(source, 'deploy_preview')
  assert.match(preview, /mode: 'owned-upload'/)
  assert.match(preview, /expectedHeadSha: process\.env\.HEAD_SHA/)
  assert.match(preview, /eligibilityPredicate: policy\.previewDeploymentSkipReason/)
  assert.doesNotMatch(job(source, 'deploy_production'), /azure-preview-cleanup|azure\/login|cleanupPreview/)
})

test('hourly reconciliation revalidates under the shared lock and fails closed', () => {
  const source = read('.github/workflows/azure-static-web-apps-preview-reconcile.yml')
  const plan = job(source, 'plan')
  const cleanup = job(source, 'cleanup')
  const report = job(source, 'report')
  assert.match(source, /cron: '17 \* \* \* \*'/)
  assert.match(source, /dry_run:[\s\S]*?type: boolean\n\s+default: true/)
  assert.match(plan, /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/)
  assert.match(plan, /planPreviewReconciliation/)
  assert.match(plan, /\['blocked', 'deferred'\]\.includes/)
  assert.match(cleanup, /group: swa-preview-pr\$\{\{ matrix\.pr_number \}\}/)
  assert.match(cleanup, /cancel-in-progress: false/)
  assert.match(cleanup, /max-parallel: 2/)
  assert.match(cleanup, /cleanup\.cleanupPreview/)
  assert.match(cleanup, /dryRun: process\.env\.DRY_RUN === 'true'/)
  assert.match(cleanup, /if \(result\.status === 'blocked'\) core\.setFailed/)
  for (const section of [plan, cleanup]) {
    assert.match(section, /environment: azure-preview-cleanup/)
    assert.match(section, /id-token: write/)
    assert.match(section, /ref: context\.payload\.repository\.default_branch/)
  }
  assert.match(report, /always\(\)/)
  assert.match(report, /test "\$PLAN_RESULT" = success/)
  assert.match(report, /test "\$BLOCKED" = 0/)
  assert.match(report, /if \[ "\$HAS_WORK" = true \]; then test "\$CLEANUP_RESULT" = success; fi/)
  assert.match(job(source, 'reject_other_refs'), /exit 1/)
  assert.doesNotMatch(source, /actions\/checkout|static-web-apps-deploy|AZURE_STATIC_WEB_APPS_API_TOKEN|npm install|\bpnpm\b/)
})

test('cleanup infrastructure grants only app-scoped build reads and deletes', () => {
  const role = read('.github/azure/preview-cleanup.bicep')
  const identity = read('.github/azure/preview-cleanup-identity.bicep')
  const actions = [...role.matchAll(/'Microsoft\.Web\/[^']+'/g)].map(match => match[0])
  assert.deepEqual(actions, ["'Microsoft.Web/staticSites/builds/Read'", "'Microsoft.Web/staticSites/builds/Delete'"])
  assert.match(role, /assignableScopes: \[groupId\]/)
  assert.match(identity, /resource app 'Microsoft\.Web\/staticSites@[^']+' existing/)
  assert.match(identity, /resource grant[\s\S]*?scope: app/)
  assert.match(identity, /repo:RetireGolden\/RetireGolden:environment:azure-preview-cleanup/)
  assert.match(identity, /https:\/\/token\.actions\.githubusercontent\.com/)
  assert.match(identity, /api:\/\/AzureADTokenExchange/)
  assert.doesNotMatch(identity, /clientSecret|passwordCredentials/)
})
