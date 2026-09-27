import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { readPackageSource } from '../../scripts/census-sources.mjs'

/**
 * Mutation receipt drift (decision D-RECEIPT-DRIFT).
 *
 * A mutation receipt (`DOCS/calculations/<domain>/<id>.mutation.md`) is the
 * evidence that an evidence test kills a mutant of production code: the diff it
 * applied, the command it ran, and the failing output it captured. It is
 * evidence a reader can rerun only while it still describes the current code
 * and tests. A receipt has drifted when any of the following no longer holds.
 * Every check reads the files on disk and nothing is re-executed, so the
 * checks over all receipts take about a quarter of a second.
 *
 * (a) The hunks still anchor. The diff has at least one `@@` hunk, and each
 *     header names its lines (`@@ -start,count +start,count @@`; a header such
 *     as `@@ mutation @@` names none). Each hunk's line counts match its lines,
 *     its new-side start is its old-side start moved by the net added lines of
 *     the earlier hunks in the same file, and its old side (context and removed
 *     lines, in order) occurs exactly once in the current file it applies to
 *     (a diff may span several files; see parseReceipt), as whole lines (not
 *     as a piece cut out of a longer line), starting at the line the header
 *     names. "Exactly once" counts every occurrence of the joined text, which is
 *     how the re-execution harness finds the hunk when it applies it.
 *
 * (b) The quoted test lines still point where they say. For every stack line
 *     the capture prints into a test file (`❯ [function] src/….test.ts:L:C`),
 *     the file exists and has line L. A frame with a function name lies inside
 *     a function of that name in the file (a dotted label is tried whole, as
 *     `Class.method`, then by its last segment). A frame with no function name
 *     (`Object.<anonymous>` included) lies inside the registration call of the
 *     test the enclosing FAIL line names (that test's title is at or above L
 *     and its call has not closed before L), or else inside the helper the next
 *     frame of the same error names (an unnamed callback such as a `forEach`
 *     body within that helper). A dotted label that names no function holding
 *     L (`Array.forEach` is V8's name for the receiver's method) is held to the
 *     unnamed-frame rule.
 *     Every code-frame line the capture quotes (`  NN| text`) reads the same as
 *     line NN of the test file it was quoted from, where a line vitest
 *     truncated with "…" must still begin with the kept text. Every test the
 *     capture names (FAIL lines and × lines) is still registered in its file.
 *
 * (c) The stated test counts still match. A per-file count
 *     (`❯ src/….test.ts (N tests | …)`) and, when one test file ran, the summary
 *     total (`Tests … (N)`) equal the number of tests the file registers, where
 *     the source fixes that number: every `it`/`test` call is a statement
 *     directly in the file or in the callback of `describe`,
 *     `describeCalculation`, `describeRule` or `describeRefusal` (each runs its
 *     callback once), with no `.each`/`.for` table, loop, condition or helper
 *     function between them. A file that registers tests any other way has no
 *     static count, and receipts that quote it are not count-checked.
 *
 * Left out, and why:
 * - The diff's `index` blob hashes. They change on any edit anywhere in the
 *   production file, far from the hunk included, and they are git's hashes of
 *   the normalized bytes, which a CRLF checkout on Windows does not have on
 *   disk; (a) keeps the part of that evidence that must stay true.
 * - Stack lines into production files. They describe the mutant as it ran, and
 *   an unmutated callee's lines move with edits unrelated to the receipt; (a)
 *   pins the mutated site itself.
 * - A test title built from a non-literal expression (a variable, a call) is
 *   matched with that part as a wildcard, since its text is only known when the
 *   suite runs.
 * - Failure counts, assertion messages and durations. Whether the mutant still
 *   fails the same tests with the same message is what re-execution
 *   establishes; no reading of the source can say.
 */

const receiptSources = import.meta.glob('../../../../DOCS/calculations/**/*.mutation.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

interface ReceiptHunk {
  /** Production file the hunk applies to, relative to the repository root. */
  readonly file: string
  readonly header: string
  readonly oldStart: number
  readonly oldCount: number
  readonly newStart: number
  readonly newCount: number
  readonly oldLines: readonly string[]
  readonly newLines: readonly string[]
}

interface ParsedReceipt {
  /** Production file the heading names, relative to the repository root. */
  readonly production: string
  readonly hunks: readonly ReceiptHunk[]
  /** Test file the command runs, relative to `packages/engine`. */
  readonly commandTest: string | null
  readonly capture: readonly string[]
}

interface Registration {
  /**
   * The title as the literal texts between its wildcards, in order: a title
   * matches when it is these texts with any text (none included) between each
   * pair, so one entry means an exact title (see `matchesTitle`).
   */
  readonly titleSegments: readonly string[]
  readonly startLine: number
  readonly endLine: number
}

interface NamedFunction {
  readonly name: string
  readonly startLine: number
  readonly endLine: number
}

interface TestFileShape {
  readonly lines: readonly string[]
  readonly registrations: readonly Registration[]
  readonly functions: readonly NamedFunction[]
  /** Number of tests the file registers, or null when the source does not fix it. */
  readonly staticCount: number | null
}

const NL = '\n'
const FENCE = '```'

function normalize(text: string): string {
  return text.replace(/\r\n/gu, NL)
}

function sectionText(receipt: string, heading: string): string | null {
  const start = receipt.indexOf(NL + '## ' + heading)
  if (start < 0) return null
  const next = receipt.indexOf(NL + '## ', start + 1)
  return receipt.slice(start + 1, next < 0 ? receipt.length : next + 1)
}

/**
 * The body of a section's fenced block: from the line after the first fence
 * to the section's last bare fence line at least as long as the opening one,
 * so a fence printed inside the block (a capture that quotes Markdown) does
 * not end it early. Each receipt section holds one fenced block.
 */
function fencedBody(section: string | null): string | null {
  if (section === null) return null
  const lines = section.split(NL)
  const open = lines.findIndex((line) => line.startsWith(FENCE))
  if (open < 0) return null
  const ticks = /^`+/u.exec(lines[open]!)![0].length
  for (let close = lines.length - 1; close > open; close -= 1) {
    const bare = /^(`+)\s*$/u.exec(lines[close]!)
    if (bare !== null && bare[1]!.length >= ticks) return lines.slice(open + 1, close).join(NL)
  }
  return null
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u

/** The path a `+++ ` or `--- ` file header names, without git's a/ or b/ prefix. */
function headerPath(line: string): string {
  return line.slice(4).replace(/\t.*$/u, '').trim().replace(/^[ab]\//u, '')
}

/**
 * Parses a receipt the way the re-execution harness reads it, and also reads
 * a diff that spans several files: a `diff --git` line, or a `--- `/`+++ `
 * pair followed by an @@ header, starts the next file's section, so each hunk
 * is checked against the file it applies to; hunks before any file header
 * apply to the file the heading names. A `diff --git` or `index` line cannot
 * be hunk content (a hunk line starts with a space, `-`, `+` or `\`). A
 * `--- `/`+++ ` pair is taken as a header only when an @@ header follows it,
 * so it would be misread only if a hunk ended in a removed line reading
 * `-- ` and an added line reading `++ ` right before the next hunk.
 */
function parseReceipt(raw: string): ParsedReceipt | string {
  const text = normalize(raw)
  const production = /## Mutation applied to `([^`]+)`/u.exec(text)?.[1]
  if (production === undefined) return 'no "## Mutation applied to `path`" heading'
  const diff = fencedBody(sectionText(text, 'Mutation applied'))
  if (diff === null) return 'no fenced diff under "Mutation applied"'
  const hunks: {
    file: string
    header: string
    oldStart: number
    oldCount: number
    newStart: number
    newCount: number
    oldLines: string[]
    newLines: string[]
  }[] = []
  let file = production
  let current: (typeof hunks)[number] | null = null
  const lines = diff.split(NL)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const gitHeader = /^diff --git a\/\S+ b\/(\S+)/u.exec(line)
    if (gitHeader !== null) {
      file = gitHeader[1]!
      current = null
      continue
    }
    if (current !== null && line.startsWith('index ')) {
      current = null
      continue
    }
    if (line.startsWith('--- ') && lines[index + 1]?.startsWith('+++ ') && lines[index + 2]?.startsWith('@@')) {
      const target = headerPath(lines[index + 1]!)
      file = target === '/dev/null' ? headerPath(line) : target
      current = null
      index += 1
      continue
    }
    // The harness starts a hunk at any line that begins with @@; one whose
    // header carries no line numbers (`@@ mutation @@`) parses with NaN starts.
    if (line.startsWith('@@')) {
      const header = HUNK_HEADER.exec(line)
      current = {
        file,
        header: line,
        oldStart: header === null ? Number.NaN : Number(header[1]),
        oldCount: header === null ? Number.NaN : header[2] === undefined ? 1 : Number(header[2]),
        newStart: header === null ? Number.NaN : Number(header[3]),
        newCount: header === null ? Number.NaN : header[4] === undefined ? 1 : Number(header[4]),
        oldLines: [],
        newLines: [],
      }
      hunks.push(current)
      continue
    }
    if (current === null || line.startsWith('\\')) continue
    if (line.startsWith('-')) current.oldLines.push(line.slice(1))
    else if (line.startsWith('+')) current.newLines.push(line.slice(1))
    else {
      current.oldLines.push(line.slice(1))
      current.newLines.push(line.slice(1))
    }
  }
  const command = fencedBody(sectionText(text, 'Command'))
  const commandTest = command === null ? null : (/src\/\S+\.test\.ts/u.exec(command)?.[0] ?? null)
  const capture = fencedBody(sectionText(text, 'Captured failing output'))
  return { production, hunks, commandTest, capture: capture === null ? [] : capture.split(NL) }
}

function countOccurrences(haystack: string, needle: string): number[] {
  const found: number[] = []
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return found
    found.push(at)
    from = at + 1
  }
}

/** Criterion (a): every hunk anchors once in its own file, at the line its header names. */
function hunkDrift(receipt: ParsedReceipt, sourceOf: (repoPath: string) => string | undefined): string[] {
  if (receipt.hunks.length === 0) return ['the diff has no @@ hunk, so it names no line and cannot be re-executed']
  const reasons: string[] = []
  const files = [...new Set(receipt.hunks.map((hunk) => hunk.file))]
  const texts = new Map<string, string>()
  for (const file of files) {
    const source = sourceOf(file)
    if (source === undefined) reasons.push(`production file ${file} does not exist`)
    else texts.set(file, normalize(source))
  }
  // A unified diff numbers each file's new side from that file's own earlier hunks.
  const netAdded = new Map<string, number>()
  receipt.hunks.forEach((hunk, index) => {
    const text = texts.get(hunk.file)
    if (text === undefined) return
    const label =
      receipt.hunks.length === 1 ? 'the hunk' : files.length === 1 ? `hunk ${index + 1}` : `hunk ${index + 1} (${hunk.file})`
    const earlier = netAdded.get(hunk.file) ?? 0
    netAdded.set(hunk.file, earlier + hunk.newLines.length - hunk.oldLines.length)
    const named = !Number.isNaN(hunk.oldStart)
    if (!named) {
      reasons.push(`${label} header "${hunk.header}" names no line`)
    } else {
      if (hunk.oldLines.length !== hunk.oldCount || hunk.newLines.length !== hunk.newCount) {
        reasons.push(
          `${label} header ${hunk.header.split(' @@')[0]} @@ counts ${hunk.oldCount},${hunk.newCount} but the hunk has ${hunk.oldLines.length} old and ${hunk.newLines.length} new lines`,
        )
      }
      if (hunk.newStart !== hunk.oldStart + earlier) {
        reasons.push(`${label} header starts the new side at ${hunk.newStart}, not ${hunk.oldStart + earlier}`)
      }
    }
    if (hunk.oldLines.length === 0) {
      reasons.push(`${label} has no context or removed line to anchor it`)
      return
    }
    if (hunk.oldLines.join(NL) === hunk.newLines.join(NL)) reasons.push(`${label} changes nothing`)
    const oldText = hunk.oldLines.join(NL)
    const at = countOccurrences(text, oldText)
    if (at.length === 0) {
      reasons.push(`${label}'s context and removed lines no longer occur in ${hunk.file}`)
      return
    }
    if (at.length > 1) {
      reasons.push(`${label}'s context and removed lines occur ${at.length} times in ${hunk.file}`)
      return
    }
    const offset = at[0]!
    const end = offset + oldText.length
    const wholeLines = (offset === 0 || text[offset - 1] === NL) && (end === text.length || text[end] === NL)
    if (!wholeLines) {
      reasons.push(`${label}'s context and removed lines occur only inside longer lines of ${hunk.file}`)
      return
    }
    const line = text.slice(0, offset).split(NL).length
    if (named && line !== hunk.oldStart) reasons.push(`${label} header names line ${hunk.oldStart}, but its lines now start at ${line}`)
  })
  return reasons
}

/** A part of a test title whose text is known only when the suite runs. */
const WILDCARD = Symbol('any text')

type TitlePart = string | typeof WILDCARD

function titleParts(node: ts.Expression, formatted: boolean): TitlePart[] {
  const literal = (text: string): TitlePart[] => {
    if (!formatted) return [text]
    // it.each/it.for titles are formatted per row: a specifier (%s %d %i %f %j
    // %o %c %#) or an object row's $name becomes that row's text, and %% is a
    // literal percent sign.
    const parts: TitlePart[] = []
    let from = 0
    for (const token of text.matchAll(/%%|%[sdifjoc#]|\$[\w.]+/gu)) {
      parts.push(text.slice(from, token.index), token[0] === '%%' ? '%' : WILDCARD)
      from = token.index + token[0].length
    }
    parts.push(text.slice(from))
    return parts
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return literal(node.text)
  if (ts.isTemplateExpression(node)) {
    return [...literal(node.head.text), ...node.templateSpans.flatMap((span): TitlePart[] => [WILDCARD, ...literal(span.literal.text)])]
  }
  if (ts.isParenthesizedExpression(node)) return titleParts(node.expression, formatted)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...titleParts(node.left, formatted), ...titleParts(node.right, formatted)]
  }
  return [WILDCARD]
}

/** The literal texts between a title's wildcards, in order (adjacent literals joined). */
function titleSegments(parts: readonly TitlePart[]): string[] {
  const segments = ['']
  for (const part of parts) {
    if (part === WILDCARD) segments.push('')
    else segments[segments.length - 1] += part
  }
  return segments
}

/**
 * Whether `title` is the segments in order with any text (none included) in
 * each gap between them: the first segment begins it, the last ends it, and
 * each middle segment is found at its leftmost place after the one before and
 * before the last. Taking the leftmost place never loses a match, because a
 * gap takes any text. A single segment has no gap, so it must be the whole title.
 */
function matchesTitle(segments: readonly string[], title: string): boolean {
  const first = segments[0]!
  if (segments.length === 1) return title === first
  const last = segments[segments.length - 1]!
  const end = title.length - last.length
  if (end < first.length || !title.startsWith(first) || !title.endsWith(last)) return false
  let at = first.length
  for (const segment of segments.slice(1, -1)) {
    const found = title.indexOf(segment, at)
    if (found < 0 || found + segment.length > end) return false
    at = found + segment.length
  }
  return true
}

/** The member chain of a callee (`it.skip` → ['it', 'skip']), with '()' for a call in the chain. */
function calleeChain(node: ts.Expression): string[] | null {
  if (ts.isIdentifier(node)) return [node.text]
  if (ts.isPropertyAccessExpression(node)) {
    const base = calleeChain(node.expression)
    return base === null ? null : [...base, node.name.text]
  }
  if (ts.isCallExpression(node)) {
    const base = calleeChain(node.expression)
    return base === null ? null : [...base, '()']
  }
  return null
}

const TEST_FACTORIES = new Set(['each', 'for', 'skipIf', 'runIf'])
const TABLE_FACTORIES = new Set(['each', 'for'])
const DESCRIBE_HELPERS = new Set(['describe', 'describeCalculation', 'describeRule', 'describeRefusal'])

function isTestRegistration(chain: readonly string[] | null): boolean {
  if (chain === null || (chain[0] !== 'it' && chain[0] !== 'test')) return false
  // `it.each(table)` returns the registering function; the call it returns is the registration.
  return !TEST_FACTORIES.has(chain[chain.length - 1]!)
}

function isOncePerCallDescribe(call: ts.CallExpression): boolean {
  const chain = calleeChain(call.expression)
  return chain !== null && DESCRIBE_HELPERS.has(chain[0]!) && !chain.some((part) => TABLE_FACTORIES.has(part) || part === '()')
}

/** Whether a registration runs exactly once whenever the file is collected. */
function registersOnce(call: ts.CallExpression): boolean {
  if (calleeChain(call.expression)!.some((part) => TABLE_FACTORIES.has(part))) return false
  let callback: ts.Node
  const statement = call.parent
  if (ts.isArrowFunction(statement) && statement.body === call) {
    callback = statement
  } else {
    if (!ts.isExpressionStatement(statement)) return false
    const container = statement.parent
    if (ts.isSourceFile(container)) return true
    if (!ts.isBlock(container)) return false
    callback = container.parent
  }
  if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return false
  const host = callback.parent
  if (!ts.isCallExpression(host) || !host.arguments.some((argument) => argument === callback)) return false
  if (!isOncePerCallDescribe(host)) return false
  return registersOnce(host)
}

function functionName(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name !== undefined) return node.name.text
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent
    if (
      (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) &&
      parent.initializer === node
    ) {
      return ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name) ? parent.name.text : null
    }
  }
  return null
}

/** A function's names as V8 may label its frames: its own name, and `Class.name` for a class member. */
function functionNames(node: ts.Node): string[] {
  const name = functionName(node)
  if (name === null) return []
  const member = ts.isPropertyDeclaration(node.parent) ? node.parent : node
  const owner = member.parent
  const className = owner !== undefined && (ts.isClassDeclaration(owner) || ts.isClassExpression(owner)) ? owner.name?.text : undefined
  return className === undefined ? [name] : [name, `${className}.${name}`]
}

/** Registrations, named functions and the static test count of a test file. */
function testFileShape(path: string, source: string): TestFileShape {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lineOf = (position: number): number => file.getLineAndCharacterOfPosition(position).line + 1
  const registrations: Registration[] = []
  const functions: NamedFunction[] = []
  let everyOnce = true
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression)
      if (isTestRegistration(chain)) {
        const formatted = chain!.some((part) => TABLE_FACTORIES.has(part))
        const title = node.arguments[0]
        registrations.push({
          titleSegments: titleSegments(title === undefined ? [WILDCARD] : titleParts(title, formatted)),
          startLine: lineOf(node.getStart(file)),
          endLine: lineOf(node.getEnd()),
        })
        if (!registersOnce(node)) everyOnce = false
      }
    }
    for (const name of functionNames(node)) {
      functions.push({ name, startLine: lineOf(node.getStart(file)), endLine: lineOf(node.getEnd()) })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return {
    lines: normalize(source).split(NL),
    registrations,
    functions,
    staticCount: everyOnce ? registrations.length : null,
  }
}

const FAIL_LINE = /^\s*FAIL\s+(\S+\.test\.ts)\s+>\s+(.+?)\s*$/u
const STACK_LINE = /^\s*❯\s+(?:(.+?)\s+)?(\S+\.[cm]?[jt]sx?):(\d+):(\d+)\s*$/u
const FILE_COUNT_LINE = /^\s*❯\s+(\S+\.test\.ts)\s+\((\d+) tests?\b/u
const FAILED_TITLE_LINE = /^\s*×\s+(.+?)(?:\s+\d+(?:\.\d+)?m?s)?\s*$/u
const CODE_FRAME_LINE = /^\s*(\d+)\|(.*)$/u
const SUMMARY_TESTS = /^\s*Tests\s+.*\((\d+)\)\s*$/u
const SUMMARY_FILES = /^\s*Test Files\s+.*\((\d+)\)\s*$/u
const SEPARATOR = /^\s*⎯/u

/** A path as vitest prints it, relative to `packages/engine` (`src/…`). */
function enginePath(printed: string): string {
  const unified = printed.replace(/\\/gu, '/')
  const marker = unified.lastIndexOf('packages/engine/')
  if (marker >= 0) return unified.slice(marker + 'packages/engine/'.length)
  if (unified.startsWith('src/')) return unified
  const src = unified.lastIndexOf('/src/')
  return src >= 0 ? unified.slice(src + 1) : unified
}

function registered(shape: TestFileShape, title: string, fullName: boolean): Registration[] {
  return shape.registrations.filter((registration) => {
    if (!fullName) return matchesTitle(registration.titleSegments, title)
    // A FAIL line names the suites too (`suite > test`); the test's own title is a
    // ` > `-bounded suffix of it.
    if (matchesTitle(registration.titleSegments, title)) return true
    for (let at = title.indexOf(' > '); at >= 0; at = title.indexOf(' > ', at + 1)) {
      if (matchesTitle(registration.titleSegments, title.slice(at + 3))) return true
    }
    return false
  })
}

type ShapeOf = (enginePath: string) => TestFileShape | undefined

/**
 * A stack frame's function label as vitest prints it, or null for an unnamed
 * frame. V8 labels an anonymous function called on a receiver
 * `Type.<anonymous>`, which names no function either; `async ` and `new `
 * prefixes are dropped.
 */
function frameLabel(method: string | undefined): string | null {
  if (method === undefined) return null
  const label = method.replace(/^(?:async|new)(?:\s+|$)/u, '').trim()
  return label === '' || label.includes('<anonymous>') ? null : label
}

/** Whether a function the label names (its full dotted form, then its last segment) holds the line. */
function insideFunction(shape: TestFileShape, label: string, lineNumber: number): boolean {
  const names = new Set([label, label.split('.').pop()!])
  return shape.functions.some((fn) => names.has(fn.name) && fn.startLine <= lineNumber && lineNumber <= fn.endLine)
}

/** Criteria (b) and (c) over one receipt's capture. */
function captureDrift(receipt: ParsedReceipt, shapeOf: ShapeOf): { quoted: string[]; counts: string[] } {
  const quoted: string[] = []
  const counts: string[] = []
  const defaultTest = receipt.commandTest
  if (defaultTest === null) quoted.push('the command names no src/….test.ts file')
  else if (shapeOf(defaultTest) === undefined) quoted.push(`the command's test file ${defaultTest} does not exist`)
  let failFile: string | null = null
  let failName: string | null = null
  let frameFile: string | null = null
  let treeFile: string | null = null
  let summaryTotal: number | null = null
  let testFilesRun: number | null = null
  const missingFiles = new Set<string>()
  const shapeOrReport = (path: string): TestFileShape | undefined => {
    const shape = shapeOf(path)
    if (shape === undefined && !missingFiles.has(path)) {
      missingFiles.add(path)
      quoted.push(`the capture quotes ${path}, which does not exist`)
    }
    return shape
  }
  /** The next stack frame of the same error: the caller of the frame at `index`. */
  const callerOf = (index: number): RegExpExecArray | null => {
    for (let next = index + 1; next < receipt.capture.length; next += 1) {
      const line = receipt.capture[next]!
      if (FAIL_LINE.test(line) || SEPARATOR.test(line)) return null
      const stack = STACK_LINE.exec(line)
      if (stack !== null) return stack
    }
    return null
  }
  for (let index = 0; index < receipt.capture.length; index += 1) {
    const line = receipt.capture[index]!
    const fail = FAIL_LINE.exec(line)
    if (fail !== null) {
      failFile = enginePath(fail[1]!)
      failName = fail[2]!
      frameFile = failFile
      const shape = shapeOrReport(failFile)
      if (shape !== undefined && registered(shape, failName, true).length === 0) {
        quoted.push(`FAIL names "${failName}", which ${failFile} no longer registers`)
      }
      continue
    }
    if (SEPARATOR.test(line)) {
      failFile = null
      failName = null
      frameFile = null
      continue
    }
    const fileCount = FILE_COUNT_LINE.exec(line)
    if (fileCount !== null) {
      treeFile = enginePath(fileCount[1]!)
      const shape = shapeOrReport(treeFile)
      if (shape !== undefined && shape.staticCount !== null && shape.staticCount !== Number(fileCount[2])) {
        counts.push(`states ${fileCount[2]} tests in ${treeFile}, which now registers ${shape.staticCount}`)
      }
      continue
    }
    const stack = STACK_LINE.exec(line)
    if (stack !== null) {
      const path = enginePath(stack[2]!)
      frameFile = path
      if (!path.endsWith('.test.ts')) continue
      const shape = shapeOrReport(path)
      if (shape === undefined) continue
      const lineNumber = Number(stack[3])
      const label = frameLabel(stack[1])
      const where = `${path}:${lineNumber}`
      if (lineNumber > shape.lines.length) {
        quoted.push(`${where} is past the end of the file (${shape.lines.length} lines)`)
        continue
      }
      if (label !== null) {
        if (insideFunction(shape, label, lineNumber)) continue
        if (!label.includes('.')) {
          quoted.push(`${where} is no longer inside a function named ${label}`)
          continue
        }
        // A receiver-qualified label (`Array.forEach`, `Object.next`) is V8's
        // inferred name and may name the receiver's method rather than a
        // declaration in this file; when no function of that name holds the
        // line, the frame is held to the unnamed-frame rule below.
      }
      if (failName !== null && path === failFile) {
        // An unnamed frame is the test's own callback, or a callback inside
        // the named helper that the next frame of the same error shows calling it.
        const caller = callerOf(index)
        const callerLabel = caller === null ? null : frameLabel(caller[1])
        if (caller !== null && callerLabel !== null && enginePath(caller[2]!) === path && insideFunction(shape, callerLabel, lineNumber)) {
          continue
        }
        const tests = registered(shape, failName, true)
        if (tests.length > 0 && !tests.some((test) => test.startLine <= lineNumber && lineNumber <= test.endLine)) {
          const lines = tests.map((test) => `${test.startLine}-${test.endLine}`).join(', ')
          quoted.push(`${where} is outside the test "${failName.split(' > ').pop()}" (now lines ${lines})`)
        }
      }
      continue
    }
    const frame = CODE_FRAME_LINE.exec(line)
    if (frame !== null) {
      const path = frameFile ?? failFile ?? defaultTest
      if (path === null || !path.endsWith('.test.ts')) continue
      const shape = shapeOf(path)
      if (shape === undefined) continue
      const lineNumber = Number(frame[1])
      const printed = frame[2]!.startsWith(' ') ? frame[2]!.slice(1) : frame[2]!
      const current = (shape.lines[lineNumber - 1] ?? '').replace(/\t/gu, ' ').trimEnd()
      const kept = printed.trimEnd()
      const matches = kept.endsWith('…')
        ? current.startsWith(kept.slice(0, -1)) && current.length >= kept.length
        : current === kept
      if (lineNumber > shape.lines.length || !matches) {
        quoted.push(`${path}:${lineNumber} is quoted as "${kept.trim()}" but now reads "${current.trim()}"`)
      }
      continue
    }
    const failedTitle = FAILED_TITLE_LINE.exec(line)
    if (failedTitle !== null) {
      const path = treeFile ?? defaultTest
      const shape = path === null ? undefined : shapeOf(path)
      if (path !== null && shape !== undefined && registered(shape, failedTitle[1]!, false).length === 0) {
        quoted.push(`× names "${failedTitle[1]}", which ${path} no longer registers`)
      }
      continue
    }
    const tests = SUMMARY_TESTS.exec(line)
    if (tests !== null) summaryTotal = Number(tests[1])
    const files = SUMMARY_FILES.exec(line)
    if (files !== null) testFilesRun = Number(files[1])
  }
  if (summaryTotal !== null && testFilesRun === 1) {
    const path = treeFile ?? defaultTest
    const shape = path === null ? undefined : shapeOf(path)
    if (shape !== undefined && shape.staticCount !== null && shape.staticCount !== summaryTotal) {
      counts.push(`states ${summaryTotal} tests in the run of ${path}, which now registers ${shape.staticCount}`)
    }
  }
  return { quoted, counts }
}

function productionSource(repoPath: string): string | undefined {
  return repoPath.startsWith('packages/') ? readPackageSource(repoPath.slice('packages/'.length)) : undefined
}

const shapeCache = new Map<string, TestFileShape | undefined>()
function shapeOnDisk(path: string): TestFileShape | undefined {
  if (!shapeCache.has(path)) {
    const source = readPackageSource('engine/' + path)
    shapeCache.set(path, source === undefined ? undefined : testFileShape(path, source))
  }
  return shapeCache.get(path)
}

/**
 * A receipt's label in messages: its glob key cut at the `DOCS/` marker, so it
 * reads `DOCS/calculations/<group>/<id>.mutation.md` whatever the Vite root
 * made of the relative prefix.
 */
function receiptLabel(globKey: string): string {
  const unified = globKey.replace(/\\/gu, '/')
  const marker = unified.lastIndexOf('DOCS/calculations/')
  return marker >= 0 ? unified.slice(marker) : unified
}

const receipts = Object.entries(receiptSources)
  .map(([key, raw]) => [receiptLabel(key), raw] as const)
  .sort(([a], [b]) => a.localeCompare(b))

const parsedReceipts = receipts.map(([path, raw]) => [path, parseReceipt(raw)] as const)
const captureDriftByPath = new Map<string, ReturnType<typeof captureDrift>>()
function captureDriftOf(path: string, receipt: ParsedReceipt): ReturnType<typeof captureDrift> {
  let drift = captureDriftByPath.get(path)
  if (drift === undefined) {
    drift = captureDrift(receipt, shapeOnDisk)
    captureDriftByPath.set(path, drift)
  }
  return drift
}

function driftOverReceipts(check: (receipt: ParsedReceipt, path: string) => readonly string[]): string[] {
  const drifted: string[] = []
  for (const [path, receipt] of parsedReceipts) {
    const reasons = typeof receipt === 'string' ? [receipt] : check(receipt, path)
    for (const reason of reasons) drifted.push(`${path}: ${reason}`)
  }
  return drifted
}

const SYNTHETIC_PRODUCTION = ['export function f(x: number): number {', '  const y = x + 1', '  return y * 2', '}', ''].join(NL)

const SYNTHETIC_TEST = [
  "import { describe, expect, it } from 'vitest'",
  "import { f } from './synthetic.js'",
  '',
  'function expectDoubled(actual: number): void {',
  '  expect(actual).toBe(4)',
  '}',
  '',
  "describe('synthetic — Synthetic', () => {",
  "  it('doubles one plus one', () => {",
  '    expectDoubled(f(1))',
  '  })',
  "  it('keeps zero at two', () => {",
  '    expect(f(0)).toBe(2)',
  '  })',
  '})',
  '',
].join(NL)

const SYNTHETIC_DIFF = [
  '@@ -2,2 +2,2 @@ export function f(x: number): number {',
  '-  const y = x + 1',
  '+  const y = x + 2',
  '   return y * 2',
]

const SYNTHETIC_CAPTURE = [
  ' ❯ src/synthetic.evidence.test.ts (2 tests | 1 failed) 3ms',
  '     × doubles one plus one 2ms',
  '⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯',
  ' FAIL  src/synthetic.evidence.test.ts > synthetic — Synthetic > doubles one plus one',
  'AssertionError: expected 6 to be 4 // Object.is equality',
  ' ❯ expectDoubled src/synthetic.evidence.test.ts:5:18',
  '      3|',
  '      4| function expectDoubled(actual: number): void {',
  '      5|   expect(actual).toBe(4)',
  '       |                  ^',
  '      6| }',
  '      7|',
  ' ❯ src/synthetic.evidence.test.ts:10:5',
  '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯',
  ' Test Files  1 failed (1)',
  '      Tests  1 failed | 1 passed (2)',
]

function syntheticReceipt(diff: readonly string[], capture: readonly string[]): string {
  return [
    '# Mutation receipt: synthetic',
    '',
    'Executed 2026-09-27 against RetireGolden base `00000000` (branch `synthetic`) in `packages/engine`.',
    '',
    '## Mutation applied to `packages/engine/src/synthetic.ts`',
    '',
    FENCE + 'diff',
    ...diff,
    FENCE,
    '',
    '## Command',
    '',
    FENCE,
    'NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/synthetic.evidence.test.ts',
    FENCE,
    '',
    '## Captured failing output',
    '',
    FENCE,
    ...capture,
    FENCE,
    '',
    '## Revert',
    '',
    'Restored.',
    '',
  ].join(NL)
}

function syntheticDrift(
  diff: readonly string[],
  options: {
    readonly production?: string
    readonly test?: string
    readonly capture?: readonly string[]
    readonly sources?: Readonly<Record<string, string>>
  } = {},
): string[] {
  const receipt = parseReceipt(syntheticReceipt(diff, options.capture ?? SYNTHETIC_CAPTURE))
  if (typeof receipt === 'string') return [receipt]
  const shape = testFileShape('src/synthetic.evidence.test.ts', options.test ?? SYNTHETIC_TEST)
  const { quoted, counts } = captureDrift(receipt, (path) =>
    path === 'src/synthetic.evidence.test.ts' ? shape : undefined,
  )
  const sources: Readonly<Record<string, string>> = {
    'packages/engine/src/synthetic.ts': options.production ?? SYNTHETIC_PRODUCTION,
    ...options.sources,
  }
  return [...hunkDrift(receipt, (path) => sources[path]), ...quoted, ...counts]
}

const crlf = (text: string): string => text.split(NL).join('\r\n')

describe('mutation receipt drift', () => {
  it('parses every mutation receipt in DOCS/calculations', () => {
    expect(receipts.length).toBeGreaterThan(0)
    expect(receipts.filter(([path]) => !/^DOCS\/calculations\/[^/]+\/[^/]+\.mutation\.md$/u.test(path))).toEqual([])
    expect(parsedReceipts.filter(([, receipt]) => typeof receipt === 'string')).toEqual([])
  })

  it('labels a receipt from the DOCS/ marker, whatever prefix the Vite root gives its glob key', () => {
    for (const key of [
      '../../../../DOCS/calculations/taxes/x.mutation.md',
      '/DOCS/calculations/taxes/x.mutation.md',
      'C:/work/repo/DOCS/calculations/taxes/x.mutation.md',
      'C:\\work\\repo\\DOCS\\calculations\\taxes\\x.mutation.md',
    ]) {
      expect(receiptLabel(key), key).toBe('DOCS/calculations/taxes/x.mutation.md')
    }
  })

  it('(a) anchors every hunk once in its production file, at the line its @@ header names', () => {
    expect(driftOverReceipts((receipt) => hunkDrift(receipt, productionSource))).toEqual([])
  })

  it('(b) keeps every quoted test line, stack line and test title pointing into the test the capture names', () => {
    expect(driftOverReceipts((receipt, path) => captureDriftOf(path, receipt).quoted)).toEqual([])
  })

  it('(c) states only test counts the test file still registers, where the source fixes the count', () => {
    expect(driftOverReceipts((receipt, path) => captureDriftOf(path, receipt).counts)).toEqual([])
  })

  it('passes a synthetic receipt that matches its production and test files, with LF or CRLF line ends', () => {
    expect(syntheticDrift(SYNTHETIC_DIFF)).toEqual([])
    expect(syntheticDrift(SYNTHETIC_DIFF, { production: crlf(SYNTHETIC_PRODUCTION), test: crlf(SYNTHETIC_TEST) })).toEqual([])
  })

  it('flags a hunk whose code moved, whose header names no line or miscounts, or whose lines are parts of lines', () => {
    expect(syntheticDrift(SYNTHETIC_DIFF, { production: '// a new first line' + NL + SYNTHETIC_PRODUCTION })).toEqual([
      'the hunk header names line 2, but its lines now start at 3',
    ])
    expect(syntheticDrift(['@@ mutation @@', ...SYNTHETIC_DIFF.slice(1)])).toEqual([
      'the hunk header "@@ mutation @@" names no line',
    ])
    expect(syntheticDrift(['@@ -2,3 +2,3 @@', ...SYNTHETIC_DIFF.slice(1)])).toEqual([
      'the hunk header @@ -2,3 +2,3 @@ counts 3,3 but the hunk has 2 old and 2 new lines',
    ])
    expect(syntheticDrift(['@@ -2 +2 @@', '-const y = x + 1', '+const y = x + 2'])).toEqual([
      "the hunk's context and removed lines occur only inside longer lines of packages/engine/src/synthetic.ts",
    ])
    expect(syntheticDrift(SYNTHETIC_DIFF.slice(1))).toEqual([
      'the diff has no @@ hunk, so it names no line and cannot be re-executed',
    ])
  })

  it('flags quoted test lines, frames, test titles and test counts the test file no longer matches', () => {
    const lineAboveHelper = SYNTHETIC_TEST.replace(NL + 'function expectDoubled', NL + '// moved' + NL + 'function expectDoubled')
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: lineAboveHelper })).toEqual([
      'src/synthetic.evidence.test.ts:4 is quoted as "function expectDoubled(actual: number): void {" but now reads "// moved"',
      'src/synthetic.evidence.test.ts:5 is quoted as "expect(actual).toBe(4)" but now reads "function expectDoubled(actual: number): void {"',
      'src/synthetic.evidence.test.ts:6 is quoted as "}" but now reads "expect(actual).toBe(4)"',
      'src/synthetic.evidence.test.ts:7 is quoted as "" but now reads "}"',
    ])
    const threeAboveHelper = SYNTHETIC_TEST.replace(NL + 'function expectDoubled', NL + NL + NL + NL + 'function expectDoubled')
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: threeAboveHelper })).toContain(
      'src/synthetic.evidence.test.ts:5 is no longer inside a function named expectDoubled',
    )
    const twoAboveTest = SYNTHETIC_TEST.replace(NL + "  it('doubles", NL + NL + NL + "  it('doubles")
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: twoAboveTest })).toEqual([
      'src/synthetic.evidence.test.ts:10 is outside the test "doubles one plus one" (now lines 11-13)',
    ])
    const renamed = SYNTHETIC_TEST.replace("'doubles one plus one'", "'doubles one and one'")
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: renamed })).toEqual([
      '× names "doubles one plus one", which src/synthetic.evidence.test.ts no longer registers',
      'FAIL names "synthetic — Synthetic > doubles one plus one", which src/synthetic.evidence.test.ts no longer registers',
    ])
    const added = SYNTHETIC_TEST.replace(NL + '})' + NL, NL + "  it.todo('a third')" + NL + '})' + NL)
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: added })).toEqual([
      'states 2 tests in src/synthetic.evidence.test.ts, which now registers 3',
      'states 2 tests in the run of src/synthetic.evidence.test.ts, which now registers 3',
    ])
    // A table-driven registration leaves the count to the table, so the count is not checked.
    const table = SYNTHETIC_TEST.replace(NL + '})' + NL, NL + "  it.each([1, 2])('row %i', () => {})" + NL + '})' + NL)
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: table })).toEqual([])
  })

  it('reads a dotted or <anonymous> frame label as V8 prints it, without failing a frame that is where it says', () => {
    const TEST_FRAME = SYNTHETIC_CAPTURE.indexOf(' ❯ src/synthetic.evidence.test.ts:10:5')
    const HELPER_FRAME = SYNTHETIC_CAPTURE.indexOf(' ❯ expectDoubled src/synthetic.evidence.test.ts:5:18')
    const withFrame = (index: number, frame: string): string[] =>
      SYNTHETIC_CAPTURE.map((line, at) => (at === index ? frame : line))
    for (const frame of [
      ' ❯ Object.<anonymous> src/synthetic.evidence.test.ts:10:5',
      ' ❯ Array.forEach src/synthetic.evidence.test.ts:10:5',
      ' ❯ async src/synthetic.evidence.test.ts:10:5',
    ]) {
      expect(syntheticDrift(SYNTHETIC_DIFF, { capture: withFrame(TEST_FRAME, frame) }), frame).toEqual([])
    }
    const asyncHelper = withFrame(HELPER_FRAME, ' ❯ async expectDoubled src/synthetic.evidence.test.ts:5:18')
    expect(syntheticDrift(SYNTHETIC_DIFF, { capture: asyncHelper })).toEqual([])
    // A dotted label that names no function is held to the unnamed-frame rule,
    // so it still fails when it points outside the test.
    const outside = withFrame(TEST_FRAME, ' ❯ Array.forEach src/synthetic.evidence.test.ts:2:1')
    expect(syntheticDrift(SYNTHETIC_DIFF, { capture: outside })).toEqual([
      'src/synthetic.evidence.test.ts:2 is outside the test "doubles one plus one" (now lines 9-11)',
    ])
    // A class member is found by its Class.method label.
    const withClass = SYNTHETIC_TEST.replace(
      NL + 'function expectDoubled(actual: number): void {' + NL + '  expect(actual).toBe(4)' + NL + '}',
      NL + 'class Check { doubled(actual: number): void {' + NL + '  expect(actual).toBe(4)' + NL + '} }',
    )
    const classCapture = withFrame(HELPER_FRAME, ' ❯ Check.doubled src/synthetic.evidence.test.ts:5:18').filter(
      (line) => !/^\s+\d+\|/u.test(line),
    )
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: withClass, capture: classCapture })).toEqual([])
  })

  it('checks each hunk of a diff that spans two files against its own file', () => {
    const OTHER = 'packages/engine/src/other.ts'
    const twoFiles = [
      'diff --git a/packages/engine/src/synthetic.ts b/packages/engine/src/synthetic.ts',
      'index 1111111..2222222 100644',
      '--- a/packages/engine/src/synthetic.ts',
      '+++ b/packages/engine/src/synthetic.ts',
      ...SYNTHETIC_DIFF,
      `diff --git a/${OTHER} b/${OTHER}`,
      'index 3333333..4444444 100644',
      `--- a/${OTHER}`,
      `+++ b/${OTHER}`,
      '@@ -2,1 +2,1 @@',
      '-export const k = 3',
      '+export const k = 4',
    ]
    const other = ['export const j = 1', 'export const k = 3', ''].join(NL)
    // Read as one file, the second header's lines would join the first hunk and neither would anchor.
    expect(syntheticDrift(twoFiles, { sources: { [OTHER]: other } })).toEqual([])
    expect(syntheticDrift(twoFiles, { sources: { [OTHER]: '// moved' + NL + other } })).toEqual([
      `hunk 2 (${OTHER}) header names line 2, but its lines now start at 3`,
    ])
    expect(syntheticDrift(twoFiles, { sources: {} })).toEqual([`production file ${OTHER} does not exist`])
    // A bare ---/+++ pair before an @@ starts a file section as well.
    const pairOnly = twoFiles.filter((line) => !line.startsWith('diff --git') && !line.startsWith('index '))
    expect(syntheticDrift(pairOnly, { sources: { [OTHER]: other } })).toEqual([])
  })

  it('reads a whole capture that prints a fence of its own', () => {
    // Were the capture cut at the fence it prints, the lines after it would go
    // unchecked and this stale count would pass.
    const added = SYNTHETIC_TEST.replace(NL + '})' + NL, NL + "  it.todo('a third')" + NL + '})' + NL)
    const fenced = ['AssertionError: expected the report to read', FENCE, 'a quoted block', FENCE, ...SYNTHETIC_CAPTURE]
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: added, capture: fenced })).toEqual([
      'states 2 tests in src/synthetic.evidence.test.ts, which now registers 3',
      'states 2 tests in the run of src/synthetic.evidence.test.ts, which now registers 3',
    ])
    expect(syntheticDrift(SYNTHETIC_DIFF, { capture: fenced })).toEqual([])
  })

  it("reads a table title's %% as a literal percent sign and only its specifiers as the row's text", () => {
    const table = SYNTHETIC_TEST.replace(
      NL + '})' + NL,
      NL + "  it.each([[50, 2]])('keeps %% of %i at %s', () => {})" + NL + '})' + NL,
    )
    const withFailedRow = (title: string): string[] => [...SYNTHETIC_CAPTURE.slice(0, 2), `     × ${title} 1ms`, ...SYNTHETIC_CAPTURE.slice(2)]
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: table, capture: withFailedRow('keeps % of 50 at 2') })).toEqual([])
    // Read as a specifier, %% would take any text, and a title the table cannot print would pass.
    expect(syntheticDrift(SYNTHETIC_DIFF, { test: table, capture: withFailedRow('keeps 10 of 50 at 2') })).toEqual([
      '× names "keeps 10 of 50 at 2", which src/synthetic.evidence.test.ts no longer registers',
    ])
  })

  it('reads a title with two wildcards as its literal parts in order, each gap taking any text and no part overlapping the next', () => {
    const titles = SYNTHETIC_TEST.replace(
      NL + '})' + NL,
      NL +
        "  it.each([['x', 'y']])('%s at %s at', () => {})" +
        NL +
        "  it(`holds ${'a'} then ${'b'} (${'c'})`, () => {})" +
        NL +
        '})' +
        NL,
    )
    const withFailedRow = (title: string): string[] => [...SYNTHETIC_CAPTURE.slice(0, 2), `     × ${title} 1ms`, ...SYNTHETIC_CAPTURE.slice(2)]
    const unregistered = (title: string): string[] => [`× names "${title}", which src/synthetic.evidence.test.ts no longer registers`]
    for (const title of ['x at y at', 'x at  at', 'x at y at z at', 'holds 1 then 2 (3)', 'holds  then  ()', 'holds a then b then c (d (e))']) {
      expect(syntheticDrift(SYNTHETIC_DIFF, { test: titles, capture: withFailedRow(title) }), title).toEqual([])
    }
    // 'x at at' has " at " and a closing " at", but only by sharing one space: the
    // middle part must end before the last one begins.
    for (const title of ['x at', 'x at at', 'x y at', 'x at y', 'holds 1 (3) then 2', 'holds 1 then 2 (3']) {
      expect(syntheticDrift(SYNTHETIC_DIFF, { test: titles, capture: withFailedRow(title) }), title).toEqual(unregistered(title))
    }
  })
})
