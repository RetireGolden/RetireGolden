import ts from 'typescript'

/**
 * Structural symbol table per file: declaration names, exported bindings,
 * class/interface members, and object-literal property names, collected from
 * the TypeScript AST so a deleted mapped occurrence cannot hide behind an
 * unrelated identifier that merely appears somewhere in the file's text. Each
 * admitted name carries the 1-based line the coverage manifest publishes as
 * its deep-link anchor, resolved by symbolAnchorLine's two-tier rule.
 *
 * This module imports the `typescript` package (a devDependency), so it is
 * excluded from the dist build in tsconfig.build.json; its consumers are the
 * conformance suite, the freshness suite, and the rule tooling scripts.
 */
export interface DeclaredSymbol {
  /** 1-based line of the winning occurrence (see symbolAnchorLine). */
  readonly line: number
  /**
   * True when a module-scope statement declares this name. Compiling
   * TypeScript only permits same-name statement declarations that merge into
   * one logical symbol (overload clusters, declaration merging), so the first
   * occurrence's line is the anchor and module-scope names are never
   * ambiguous.
   */
  readonly moduleScope: boolean
  /**
   * How many member-tier occurrences share the name (interface properties,
   * pack fields, class members). A member-only name with more than one
   * occurrence is ambiguous as an anchor: a repeated pack field like a
   * per-state rate would deep-link one state's rule to another state's
   * figure. Such pins must qualify the member by its immediate parent
   * (`ND.capitalGainsTaxablePct`), which the walk also records.
   */
  readonly memberCount: number
}

interface MutableDeclaredSymbol {
  line: number
  moduleScope: boolean
  memberCount: number
}

export function declaredSymbolLinesOf(fileName: string, source: string): ReadonlyMap<string, DeclaredSymbol> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const table = new Map<string, MutableDeclaredSymbol>()
  const lineOf = (name: ts.Node): number => file.getLineAndCharacterOfPosition(name.getStart(file)).line + 1
  const recordModuleScope = (name: ts.Node | undefined): void => {
    if (name === undefined || !ts.isIdentifier(name)) return
    const existing = table.get(name.text)
    if (existing === undefined) {
      table.set(name.text, { line: lineOf(name), moduleScope: true, memberCount: 0 })
    } else if (!existing.moduleScope) {
      // Module scope outranks members: the operative declaration, not a
      // same-named interface property, is what the anchor must point at.
      existing.line = lineOf(name)
      existing.moduleScope = true
    }
    // Two module-scope occurrences are merged declarations; first line wins.
  }
  const recordMember = (text: string, name: ts.Node): void => {
    const existing = table.get(text)
    if (existing === undefined) {
      table.set(text, { line: lineOf(name), moduleScope: false, memberCount: 1 })
    } else if (!existing.moduleScope) {
      existing.memberCount += 1 // first line kept; >1 means ambiguous
    }
    // A module-scope entry ignores member occurrences entirely.
  }
  // Members one level under a module-scope declaration are publishable
  // (class methods, interface properties, a pack object's top entries);
  // anything deeper is a local, and a local is not a calculator method.
  // `parent` is the nearest admitted ancestor name, so every member is also
  // recorded as `parent.name` for pins whose bare name repeats in the file.
  const recordMembers = (node: ts.Node, parent: string | undefined): void => {
    ts.forEachChild(node, (child) => {
      if (
        ts.isPropertyAssignment(child) ||
        ts.isPropertySignature(child) ||
        ts.isPropertyDeclaration(child) ||
        ts.isMethodDeclaration(child) ||
        ts.isMethodSignature(child) ||
        ts.isShorthandPropertyAssignment(child) ||
        ts.isGetAccessorDeclaration(child) ||
        ts.isSetAccessorDeclaration(child) ||
        ts.isEnumMember(child)
      ) {
        const name = child.name
        const identifier = name !== undefined && ts.isIdentifier(name) ? name : undefined
        if (identifier !== undefined) {
          recordMember(identifier.text, identifier)
          if (parent !== undefined) recordMember(parent + '.' + identifier.text, identifier)
        }
        // A data pack's leaf fields are publishable facts, so property
        // structure recurses; function bodies never do - a local inside a
        // calculator stays a local. A non-identifier property name is not
        // itself admissible but its children still are.
        const childParent = identifier !== undefined ? identifier.text : parent
        if (ts.isPropertyAssignment(child) && child.initializer !== undefined) recordMembers(child.initializer, childParent)
        if (ts.isPropertySignature(child) && child.type !== undefined) recordMembers(child.type, childParent)
      }
      if (ts.isObjectLiteralExpression(child) || ts.isTypeLiteralNode(child) || ts.isArrayLiteralExpression(child)) {
        recordMembers(child, parent)
      }
    })
  }
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      recordModuleScope(statement.name)
      const parent = statement.name !== undefined && ts.isIdentifier(statement.name) ? statement.name.text : undefined
      recordMembers(statement, parent)
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        recordModuleScope(declaration.name)
        if (declaration.initializer !== undefined) {
          const parent = ts.isIdentifier(declaration.name) ? declaration.name.text : undefined
          recordMembers(declaration.initializer, parent)
        }
      }
      continue
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) recordModuleScope(specifier.name)
    }
  }
  return table
}

/**
 * The 1-based deep-link line for a pinned symbol. Module-scope declarations
 * win outright; a member-tier name resolves only when it occurs exactly once,
 * otherwise the pin is ambiguous and must be parent-qualified. Throws rather
 * than guessing: a published anchor that could point at the wrong occurrence
 * is worse than a failed build.
 */
export function symbolAnchorLine(
  table: ReadonlyMap<string, DeclaredSymbol>,
  fileName: string,
  symbol: string,
): number {
  const entry = table.get(symbol)
  if (entry === undefined) {
    throw new Error(fileName + '#' + symbol + ' is not a declared symbol')
  }
  if (!entry.moduleScope && entry.memberCount > 1) {
    throw new Error(
      fileName + '#' + symbol + ' is ambiguous (' + entry.memberCount +
        ' member occurrences); qualify the pin with its parent, e.g. #parent.' + symbol,
    )
  }
  return entry.line
}
