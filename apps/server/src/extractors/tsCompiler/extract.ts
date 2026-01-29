import type { RawCallSite, RawImport, RawSymbol, SymbolKind } from "../../types/facts";
import type { Range } from "../../types/ir";
import type { Extracted, ExtractorContext } from "../types";

type Ts = any;
type TSNode = any;
type TSSourceFile = any;

function scriptKindFor(ts: Ts, ext: string) {
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".jsx") return ts.ScriptKind.JSX;
  if (ext === ".js" || ext === ".cjs" || ext === ".mjs") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function toRange(ts: Ts, sf: TSSourceFile, node: TSNode): Range {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf, false));
  const end = sf.getLineAndCharacterOfPosition(node.getEnd());
  return {
    startLine: start.line + 1,
    startCol: start.character + 1,
    endLine: end.line + 1,
    endCol: end.character + 1,
  };
}

function textOf(sf: TSSourceFile, node: TSNode) {
  return node.getText(sf);
}

export async function extractTsJsWithTsCompiler(ctx: ExtractorContext): Promise<Extracted | null> {
  let ts: Ts;
  try {
    ts = (await import("typescript")) as Ts;
  } catch {
    return null;
  }

  const sf = ts.createSourceFile(
    ctx.relPath,
    ctx.text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(ts, ctx.ext),
  );

  const imports: RawImport[] = [];
  const symbols: RawSymbol[] = [];
  const callSites: RawCallSite[] = [];

  const stack: string[] = []; // enclosing qname parts

  const enclosing = () => (stack.length ? stack.join(".") : undefined);
  const qnameFor = (name: string) => (stack.length ? `${stack.join(".")}.${name}` : name);

  const addImport = (raw: string, kind: RawImport["kind"], node?: TSNode) => {
    const r: RawImport = { raw, kind };
    if (node) r.range = toRange(ts, sf, node);
    imports.push(r);
  };

  const addSymbol = (kind: SymbolKind, name: string, node: TSNode, parentName?: string, extra?: Partial<RawSymbol>) => {
    symbols.push({
      kind,
      name,
      qname: qnameFor(name),
      range: toRange(ts, sf, node),
      parentName,
      ...extra,
    });
  };

  const collectHeritage = (node: any) => {
    const extendsNames: string[] = [];
    const implementsNames: string[] = [];
    if (!node.heritageClauses) return {};
    for (const hc of node.heritageClauses) {
      const isExt = hc.token === ts.SyntaxKind.ExtendsKeyword;
      const isImpl = hc.token === ts.SyntaxKind.ImplementsKeyword;
      for (const t of hc.types ?? []) {
        const name = textOf(sf, t.expression);
        if (isExt) extendsNames.push(name);
        if (isImpl) implementsNames.push(name);
      }
    }
    const out: any = {};
    if (extendsNames.length) out.extendsNames = extendsNames;
    if (implementsNames.length) out.implementsNames = implementsNames;
    return out;
  };

  const visit = (node: TSNode) => {
    // Imports / exports
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) addImport(node.moduleSpecifier.text, "static", node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      const ms = node.moduleSpecifier;
      if (ms && ts.isStringLiteral(ms)) addImport(ms.text, "static", ms);
    }

    // Calls + dynamic imports + require
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length) {
        const arg0 = node.arguments[0];
        if (ts.isStringLiteral(arg0)) addImport(arg0.text, "dynamic", arg0);
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === "require" && node.arguments.length) {
        const arg0 = node.arguments[0];
        if (ts.isStringLiteral(arg0)) addImport(arg0.text, "require", arg0);
      }

      callSites.push({
        calleeText: textOf(sf, node.expression),
        range: toRange(ts, sf, node),
        enclosingSymbolQname: enclosing(),
      });
    }

    // Declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text;
      addSymbol("class", name, node.name, undefined, collectHeritage(node));
      stack.push(name);
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    }

    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      addSymbol("interface", name, node.name, undefined, collectHeritage(node));
      stack.push(name);
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      addSymbol("function", name, node.name);
      stack.push(name);
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    }

    if (ts.isMethodDeclaration(node)) {
      const parent = stack.length ? stack[stack.length - 1] : undefined;
      let name = "";
      if (ts.isIdentifier(node.name)) name = node.name.text;
      else if (ts.isStringLiteral(node.name)) name = node.name.text;
      else name = textOf(sf, node.name);

      if (name) addSymbol("method", name, node.name, parent);
      stack.push(name || "<method>");
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    }

    if (ts.isModuleDeclaration(node) && node.name) {
      const name = ts.isIdentifier(node.name) ? node.name.text : textOf(sf, node.name);
      addSymbol("module", name, node.name);
      stack.push(name);
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          const init = decl.initializer;
          const kind: SymbolKind = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? "function" : "module";
          addSymbol(kind, name, decl.name);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);

  return { imports, symbols, callSites };
}
