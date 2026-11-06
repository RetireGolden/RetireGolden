import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

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

test('Azure deploy runs only pinned artifact and deployment actions', () => {
  const source = read('.github/workflows/azure-static-web-apps-retiregolden.yml')
  const authorize = job(source, 'authorize')
  const deploy = job(source, 'deploy')
  assert.match(authorize, /if \(!result\.authorized\) core\.setFailed\(result\.reason\)/)
  assert.match(deploy, /actions\/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333/)
  assert.match(deploy, /Azure\/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1/)
  assert.doesNotMatch(deploy, /actions\/checkout/)
  assert.doesNotMatch(deploy, /setup-toolchain/)
  assert.doesNotMatch(deploy, /pnpm|npm install/)
})

test('existing ZAP check fails when no preview URL is authorized', () => {
  const source = read('.github/workflows/zap.yml')
  const zap = job(source, 'zap_baseline')
  assert.match(zap, /name: ZAP Baseline/)
  assert.match(zap, /Require an authorized preview URL/)
  assert.match(zap, /if \[ -z "\$TARGET_URL" \]/)
  assert.doesNotMatch(zap, /^\s+if: inputs\.target_url != ''$/m)
})

test('default-branch SWA controller stays inert until legacy deployment is removed', () => {
  const source = read('.github/workflows/azure-static-web-apps-controller.yml')
  const inspect = job(source, 'inspect')
  const preview = job(source, 'deploy_preview')
  const publisher = job(source, 'publish_pr_result')
  const production = job(source, 'deploy_production')
  const close = job(source, 'close_preview')

  assert.match(source, /workflow_run:\n\s+workflows: \[Azure Static Web Apps CI\/CD\]/)
  assert.match(source, /pull_request_target:\n\s+types: \[closed\]/)
  assert.match(inspect, /jobs\.some\(job => job\.name === 'deploy'\)/)
  assert.match(inspect, /outputs\.legacy = 'true'/)
  assert.match(inspect, /authorizeExactHeadPullRequest/)
  assert.match(inspect, /listWorkflowRunArtifacts/)
  assert.match(inspect, /dist\.length !== 1/)
  assert.match(preview, /actions\/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333/)
  assert.match(preview, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/)
  assert.match(preview, /deployment_environment: pr\$\{\{ needs\.inspect\.outputs\.pr_number \}\}/)
  assert.doesNotMatch(preview, /repo_token:/)
  assert.match(publisher, /const name = 'ZAP DAST \/ ZAP Baseline'/)
  assert.match(publisher, /checks\.create/)
  assert.match(production, /group: swa-production/)
  assert.match(production, /cancel-in-progress: true/)
  assert.match(close, /action: close/)
  assert.match(close, /deployment_environment: pr\$\{\{ needs\.inspect_close\.outputs\.pr_number \}\}/)
  assert.doesNotMatch(source, /actions\/checkout@/)
  assert.doesNotMatch(source, /\bpnpm\b|npm install/)
})

test('review caller stages trusted default-branch events and exact gate publication', () => {
  const source = read('.github/workflows/openrouter-code-review.yml')
  const review = job(source, 'review')
  const gate = job(source, 'gate-check')
  const pin = 'a40c5eb8d588266531184ffc633dc2969d9138df'

  assert.match(source, /pull_request_target:\n\s+types: \[opened, synchronize, reopened, ready_for_review\]/)
  assert.match(source, /repository_dispatch:\n\s+types: \[openrouter-review\]/)
  assert.match(source, /checks: write/)
  assert.match(review, new RegExp(`openrouter-code-review\\.yml@${pin}`))
  assert.doesNotMatch(review, /checks: write/)
  assert.match(review, /expected_head_sha: \$\{\{ github\.event\.client_payload\.head_sha \|\| '' \}\}/)
  assert.match(gate, new RegExp(`openrouter-review-gate-check\\.yml@${pin}`))
  assert.match(gate, /checks: write/)
})
