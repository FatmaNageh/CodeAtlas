import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

export const extractJsTs: ExtractorFn = (root, ctx) => {
  const imports = [];
  const symbols = [];
  const callSites = [];

  const stack: string[] = [];

  function currentQname(): string | undefined {
    return stack.length ? stack[stack.length - 1] : undefined;
  }

  function pushSymbol(qname: string) {
    stack.push(qname);
  }

  function popSymbol() {
    stack.pop();
  }

  function extractImplements(node: SyntaxNode): string[] {
    // TypeScript class/interface implements clause best-effort
    const out: string[] = [];
    for (const ch of node.namedChildren ?? []) {
      if (ch.type === "implements_clause") {
        for (const n of ch.namedChildren ?? []) {
          if (n.type === "identifier" || n.type === "type_identifier" || n.type === "generic_type") {
            out.push(n.text);
          }
        }
      }
    }
    return out;
  }

  const walk = (node: SyntaxNode) => {
    // Imports
    if (node.type === "import_statement") {
      const src = node.childForFieldName("source");
      if (src?.text) {
        imports.push({ raw: src.text.replace(/[\'\"]/g, ""), range: nodeRange(node), kind: "static" });
      }
    }

    // require()
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");
      if (fn?.text) {
        callSites.push({ calleeText: fn.text, range: nodeRange(node), enclosingSymbolQname: currentQname() });
      }
      if (fn?.text === "require" && args?.text) {
        imports.push({ raw: args.text.replace(/[()\'\"]/g, "").trim(), range: nodeRange(node), kind: "require" });
      }
    }

    // Symbols
    if (node.type === "function_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = name;
        symbols.push({ kind: "function", name, qname, range: nodeRange(node) });
        pushSymbol(qname);
        // walk children under this function with updated stack
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        popSymbol();
        return;
      }
    }

    if (node.type === "class_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = name;
        const superclass = node.childForFieldName("superclass")?.text;
        const implementsNames = extractImplements(node);
        symbols.push({
          kind: "class",
          name,
          qname,
          range: nodeRange(node),
          extendsNames: superclass ? [superclass] : [],
          implementsNames,
        });
        pushSymbol(qname);
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        popSymbol();
        return;
      }
    }

    if (node.type === "method_definition") {
      const name = extractName(node);
      const parent = currentQname();
      if (name) {
        const qname = parent ? `${parent}.${name}` : name;
        symbols.push({ kind: "method", name, qname, range: nodeRange(node), parentName: parent });
        pushSymbol(qname);
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        popSymbol();
        return;
      }
    }

    if (node.type === "interface_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = name;
        symbols.push({ kind: "interface", name, qname, range: nodeRange(node) });
      }
    }

    // default recursion
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walk(child);
    }
  };

  walk(root);

  return { imports, symbols, callSites };
};
