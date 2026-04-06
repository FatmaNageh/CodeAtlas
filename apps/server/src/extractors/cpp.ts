import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

export const extractCpp: ExtractorFn = (root) => {
  const imports = [];
  const symbols = [];
  const callSites = [];

  const stack: string[] = [];
  const currentQname = () => (stack.length ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (node.type === "preproc_include") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "include" });
    }

    if (node.type === "namespace_definition") {
      const nm = node.child(1)?.text;
      if (nm) {
        symbols.push({ kind: "namespace", name: nm, qname: nm, range: nodeRange(node) });
        stack.push(nm);
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "class_specifier") {
      const name = extractName(node);
      if (name) {
        const qname = name;
        symbols.push({ kind: "class", name, qname, range: nodeRange(node) });
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
        const qname = parent ? `${parent}::${name}` : name;
        symbols.push({ kind: "function", name, qname, range: nodeRange(node), parentName: parent });
        stack.push(qname);
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
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
