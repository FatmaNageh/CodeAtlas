import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import type * as TypeScript from "typescript";

import type { Range } from "../types/facts";
import type { IREdge, IRNode } from "../types/ir";
import type { ScanResult } from "../types/scan";
import { edgeKey, fileRootAstNodeId, normalizePath } from "./id";

type Ts = typeof TypeScript;

function findTsConfig(repoRoot: string): string | null {
  const tsconfigPath = path.join(repoRoot, "tsconfig.json");
  return fs.existsSync(tsconfigPath) ? tsconfigPath : null;
}

function toPosixRel(repoRoot: string, absFilePath: string): string | null {
  const relativePath = path.relative(repoRoot, absFilePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return normalizePath(relativePath);
}

function isTsJsRel(relPath: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(relPath);
}

function buildCompilerOptions(ts: Ts, repoRoot: string): TypeScript.CompilerOptions {
  const tsconfigPath = findTsConfig(repoRoot);
  const defaults: TypeScript.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    module: ts.ModuleKind.NodeNext,
    target: ts.ScriptTarget.ES2020,
    resolveJsonModule: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    noEmit: true,
  };

  if (!tsconfigPath) return defaults;

  try {
    const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (config.error) return defaults;
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(tsconfigPath));
    return { ...defaults, ...parsed.options };
  } catch {
    return defaults;
  }
}

function rangeFromNode(sourceFile: TypeScript.SourceFile, node: TypeScript.Node): Range {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile, false));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    startLine: start.line + 1,
    startCol: start.character + 1,
    endLine: end.line + 1,
    endCol: end.character + 1,
  };
}

function astNodeTypeFromDeclaration(ts: Ts, declaration: TypeScript.Declaration): string | null {
  switch (declaration.kind) {
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.ClassExpression:
      return "class";
    case ts.SyntaxKind.InterfaceDeclaration:
      return "interface";
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.MethodSignature:
      return "method";
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.ArrowFunction:
      return "function";
    case ts.SyntaxKind.ModuleDeclaration:
      return "module";
    default:
      return null;
  }
}

function propertyNameText(ts: Ts, name: TypeScript.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function resolveAstNodeIdFromDeclaration(params: {
  ts: Ts;
  repoRoot: string;
  declaration: TypeScript.Declaration;
  declarationLookup: Map<string, string>;
}): string | null {
  const { ts, repoRoot, declaration, declarationLookup } = params;
  const sourceFile = declaration.getSourceFile();
  const fileRelPath = toPosixRel(repoRoot, sourceFile.fileName);
  if (!fileRelPath) return null;

  const nodeType = astNodeTypeFromDeclaration(ts, declaration);
  if (!nodeType) return null;

  const namedDeclaration = declaration as TypeScript.NamedDeclaration;
  const rangeSource = namedDeclaration.name ?? declaration;
  const range = rangeFromNode(sourceFile, rangeSource);
  const lookupKey = `${fileRelPath}|${nodeType}|${range.startLine}|${range.startCol}`;
  return declarationLookup.get(lookupKey) ?? null;
}

function resolveAliasedDeclaration(
  checker: TypeScript.TypeChecker,
  ts: Ts,
  symbol: TypeScript.Symbol,
): TypeScript.Declaration | null {
  const resolvedSymbol =
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return resolvedSymbol.declarations?.[0] ?? null;
}

export function enrichIrWithTsProgram(input: {
  scan: ScanResult;
  repoId: string;
  nodes: IRNode[];
  edges: IREdge[];
  onlyFiles?: string[];
}): void {
  const require = createRequire(import.meta.url);
  let ts: Ts;
  try {
    ts = require("typescript") as Ts;
  } catch {
    return;
  }

  const repoRoot = path.resolve(input.scan.repoRoot);
  const compilerOptions = buildCompilerOptions(ts, repoRoot);

  // If onlyFiles is not provided, use all scanned TS/JS files
  const filesToProcess = input.onlyFiles ?? input.scan.entries
    .map((e) => normalizePath(e.relPath))
    .filter((filePath) => isTsJsRel(filePath));

  const onlySet = new Set(filesToProcess.map((filePath) => normalizePath(filePath)));
  const rootNames = Array.from(onlySet)
    .filter((filePath) => isTsJsRel(filePath))
    .map((filePath) => path.join(repoRoot, filePath))
    .filter((filePath) => fs.existsSync(filePath));

  if (rootNames.length === 0) return;

  const program = ts.createProgram({
    rootNames,
    options: compilerOptions,
    host: ts.createCompilerHost(compilerOptions, true),
  });
  const checker = program.getTypeChecker();

  const existingNodeIds = new Set(input.nodes.map((node) => node.props.id));
  const declarationLookup = new Map<string, string>();
  for (const node of input.nodes) {
    if (node.label !== "AstNode") continue;
    const fileRelPath = typeof node.props.filePath === "string" ? node.props.filePath : null;
    const nodeType = typeof node.props.nodeType === "string" ? node.props.nodeType : null;
    const startLine = typeof node.props.startLine === "number" ? node.props.startLine : null;
    const startCol = typeof node.props.startColumn === "number" ? node.props.startColumn : null;
    if (!fileRelPath || !nodeType || startLine === null || startCol === null) continue;
    declarationLookup.set(`${fileRelPath}|${nodeType}|${startLine}|${startCol}`, node.props.id);
  }
  const existingEdgeKeys = new Set(input.edges.map((edge) => edge.key));
  const addEdge = (edge: IREdge) => {
    if (existingEdgeKeys.has(edge.key)) return;
    existingEdgeKeys.add(edge.key);
    input.edges.push(edge);
  };

  for (const sourceFile of program.getSourceFiles()) {
    const fileRelPath = toPosixRel(repoRoot, sourceFile.fileName);
    if (!fileRelPath || !onlySet.has(fileRelPath)) continue;
    if (!isTsJsRel(fileRelPath)) continue;

    const fileRootId = fileRootAstNodeId(input.repoId, fileRelPath);
    if (!existingNodeIds.has(fileRootId)) continue;

    const visit = (node: TypeScript.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const moduleSpecifier = node.moduleSpecifier;
        const importClause = node.importClause;
        if (!importClause) {
          ts.forEachChild(node, visit);
          return;
        }

        const bindImport = (symbol: TypeScript.Symbol | undefined, importedAs: string | null) => {
          if (!symbol) return;
          const declaration = resolveAliasedDeclaration(checker, ts, symbol);
          if (!declaration) return;
          const targetId = resolveAstNodeIdFromDeclaration({
            ts,
            repoRoot,
            declaration,
            declarationLookup,
          });
          if (!targetId) return;
          addEdge({
            key: edgeKey("IMPORTS", fileRootId, targetId, fileRelPath),
            type: "IMPORTS",
            from: fileRootId,
            to: targetId,
            props: {
              repoId: input.repoId,
              sourceFilePath: fileRelPath,
              extractionMethod: "ast+ts-enrichment",
              confidence: 0.9,
              importText: importedAs ?? moduleSpecifier.text,
              isResolved: true,
              resolutionKind: "module",
            },
          });
        };

        if (importClause.name) {
          bindImport(checker.getSymbolAtLocation(importClause.name) ?? undefined, importClause.name.text);
        }

        const namedBindings = importClause.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          for (const element of namedBindings.elements) {
            bindImport(checker.getSymbolAtLocation(element.name) ?? undefined, element.name.text);
          }
        }

        if (namedBindings && ts.isNamespaceImport(namedBindings)) {
          bindImport(checker.getSymbolAtLocation(namedBindings.name) ?? undefined, namedBindings.name.text);
        }
      }

      if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
        const currentId = resolveAstNodeIdFromDeclaration({
          ts,
          repoRoot,
          declaration: node,
          declarationLookup,
        });
        if (currentId && node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            for (const heritageType of clause.types) {
              const symbol = checker.getSymbolAtLocation(heritageType.expression);
              if (!symbol) continue;
              const declaration = resolveAliasedDeclaration(checker, ts, symbol);
              if (!declaration) continue;
              const targetId = resolveAstNodeIdFromDeclaration({
                ts,
                repoRoot,
                declaration,
                declarationLookup,
              });
              if (!targetId) continue;
              addEdge({
                key: edgeKey("EXTENDS", currentId, targetId, fileRelPath),
                type: "EXTENDS",
                from: currentId,
                to: targetId,
                props: {
                  repoId: input.repoId,
                  sourceFilePath: fileRelPath,
                  extractionMethod: "ast+ts-enrichment",
                  confidence: 0.9,
                },
              });
            }
          }
        }
      }

      if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
        const methodName = propertyNameText(ts, node.name);
        if (!methodName) {
          ts.forEachChild(node, visit);
          return;
        }

        const currentId = resolveAstNodeIdFromDeclaration({
          ts,
          repoRoot,
          declaration: node,
          declarationLookup,
        });
        if (!currentId) {
          ts.forEachChild(node, visit);
          return;
        }

        const parent = node.parent;
        if (
          parent &&
          (ts.isClassDeclaration(parent) || ts.isClassExpression(parent) || ts.isInterfaceDeclaration(parent))
        ) {
          const parentType = checker.getTypeAtLocation(parent);
          const baseTypes = parentType.getBaseTypes?.() ?? [];
          for (const baseType of baseTypes) {
            const property = baseType.getProperty(methodName);
            const declaration = property?.declarations?.[0];
            if (!declaration) continue;
            const targetId = resolveAstNodeIdFromDeclaration({
              ts,
              repoRoot,
              declaration,
              declarationLookup,
            });
            if (!targetId) continue;
            addEdge({
              key: edgeKey("OVERRIDES", currentId, targetId, fileRelPath),
              type: "OVERRIDES",
              from: currentId,
              to: targetId,
              props: {
                repoId: input.repoId,
                sourceFilePath: fileRelPath,
                extractionMethod: "ast+ts-enrichment",
                confidence: 0.85,
              },
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }
}
