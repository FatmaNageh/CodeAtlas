import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

function parseBaseClasses(classNodeText: string): string[] {
  const m = classNodeText.match(/^class\s+[A-Za-z_][\w]*\s*\(([^)]*)\)/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+as\s+.*/i, ""));
}

export const extractPython: ExtractorFn = (root) => {
  const imports = [];
  const symbols = [];
  const callSites = [];

  const stack: string[] = [];
  const currentQname = () => (stack.length ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      // Keep raw text; resolution will normalize it.
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "class_definition") {
      const name = extractName(node);
      if (name) {
        const qname = name;
        const bases = parseBaseClasses(node.text);
        symbols.push({ kind: "class", name, qname, range: nodeRange(node), extendsNames: bases });
        stack.push(qname);
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
        const parent = currentQname();
        const kind = parent ? "method" : "function";
        const qname = parent ? `${parent}.${name}` : name;
        symbols.push({ kind: kind as any, name, qname, range: nodeRange(node), parentName: parent });
        stack.push(qname);
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
      if (fn?.text) callSites.push({ calleeText: fn.text, range: nodeRange(node), enclosingSymbolQname: currentQname() });
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walk(child);
    }
  };

  walk(root);

  return { imports, symbols, callSites };
};
