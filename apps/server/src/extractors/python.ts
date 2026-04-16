import type { SyntaxNode } from "tree-sitter";
import type { SymbolKind } from "@/types/facts";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type PythonScope = {
  kind: "class" | "function";
  name: string;
  qname: string;
};

function parseBaseClasses(classNodeText: string): string[] {
  const m = classNodeText.match(/^class\s+[A-Za-z_][\w]*\s*\(([^)]*)\)/);
  if (!m) return [];
  const matches = m[1];
  if (!matches) return [];
  return matches
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+as\s+.*/i, ""));
}

function joinQualifiedName(stack: PythonScope[], name: string): string {
  const prefix = stack.map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractPython: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: PythonScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentClassScope = () => [...stack].reverse().find((scope) => scope.kind === "class");

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      // Keep raw text; resolution will normalize it.
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "class_definition") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        const bases = parseBaseClasses(node.text);
        symbols.push({ kind: "class", name, qname, range: nodeRange(node), extendsNames: bases });
        stack.push({ kind: "class", name, qname });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "function_definition") {
      const name = extractName(node);
      if (name) {
        const parent = currentClassScope();
        const kind: SymbolKind = parent ? "method" : "function";
        const qname = joinQualifiedName(stack, name);
        symbols.push({ kind, name, qname, range: nodeRange(node), parentName: parent?.name });
        stack.push({ kind: "function", name, qname });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "call") {
      const fn = node.child(0);
      if (fn?.text) {
        callSites.push({ calleeText: fn.text, range: nodeRange(node), enclosingSymbolQname: currentScope()?.qname });
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walk(child);
    }
  };

  walk(root);

  return { imports, symbols, callSites };
};
