import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')

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
  const updateMarker = read('.github/requirements.txt').match(/^semgrep==(\d+\.\d+\.\d+)$/m)
  assert.notEqual(updateMarker, null)
  assert.ok(source.includes(`python -m pip install 'semgrep==${updateMarker[1]}'`))
  assert.doesNotMatch(source, /pip install -r/)
  assert.doesNotMatch(source, /security-events:\s*write/)
  assert.doesNotMatch(source, /github\/codeql-action\/upload-sarif/)
  assert.match(source, /name: Scan \(p\/default\)/)
  assert.match(source, /name: semgrep-sarif/)
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
    assert.doesNotMatch(publish, /actions\/checkout/)
    assert.doesNotMatch(publish, /pnpm install/)
    assert.doesNotMatch(publish, /scripts\/pack-smoke/)
  })
}

test('planner smoke consumer dependency versions are exact', () => {
  const source = read('packages/planner-ui/scripts/pack-smoke.mjs')
  for (const version of ['19.2.7', '8.3.0', '6.0.1', '8.0.16']) {
    assert.match(source, new RegExp(`['\"]${version.replaceAll('.', '\\.')}['\"]`))
  }
  assert.doesNotMatch(source, /['"]\^(?:19\.2\.7|8\.3\.0|6\.0\.1|8\.0\.16)['"]/)
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
