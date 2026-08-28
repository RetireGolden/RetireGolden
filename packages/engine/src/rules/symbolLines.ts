import ts from 'typescript'

/**
 * Structural symbol table per file: declaration names, exported bindings,
 * class/interface members, and object-literal property names, collected from
 * the TypeScript AST so a deleted mapped occurrence cannot hide behind an
 * unrelated identifier that merely appears somewhere in the file's text. Each
 * admitted name maps to the 1-based line of its first declaration, which is
 * what the coverage manifest publishes as the deep-link anchor.
 *
 * This module imports the `typescript` package (a devDependency), so it is
 * excluded from the dist build in tsconfig.build.json; its consumers are the
 * conformance suite, the freshness suite, and scripts/rules-coverage.mjs.
 */
export function declaredSymbolLinesOf(fileName: string, source: string): ReadonlyMap<string, number> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const lines = new Map<string, number>()
  const record = (name: ts.Node | undefined): void => {
    if (name === undefined || !ts.isIdentifier(name)) return
    if (lines.has(name.text)) return // first declaration wins, matching walk order
    lines.set(name.text, file.getLineAndCharacterOfPosition(name.getStart(file)).line + 1)
  }
  // Members one level under a module-scope declaration are publishable
  // (class methods, interface properties, a pack object's top entries);
  // anything deeper is a local, and a local is not a calculator method.
  const recordMembers = (node: ts.Node): void => {
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
        record(child.name)
        // A data pack's leaf fields are publishable facts, so property
        // structure recurses; function bodies never do - a local inside a
        // calculator stays a local.
        if (ts.isPropertyAssignment(child) && child.initializer !== undefined) recordMembers(child.initializer)
        if (ts.isPropertySignature(child) && child.type !== undefined) recordMembers(child.type)
      }
      if (ts.isObjectLiteralExpression(child) || ts.isTypeLiteralNode(child) || ts.isArrayLiteralExpression(child)) recordMembers(child)
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
      record(statement.name)
      recordMembers(statement)
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        record(declaration.name)
        if (declaration.initializer !== undefined) recordMembers(declaration.initializer)
      }
      continue
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) record(specifier.name)
    }
  }
  return lines
}
