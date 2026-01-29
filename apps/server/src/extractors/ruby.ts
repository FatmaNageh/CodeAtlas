import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

export const extractRuby: ExtractorFn = (root) => {
  const imports = [];
  const symbols = [];
  const callSites = [];

  const stack: string[] = [];
  const currentQname = () => (stack.length ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (node.type === "call") {
      const identifier = node.childForFieldName("name") || node.namedChildren?.find((n) => n.type === "identifier");
      if (identifier?.text === "require" || identifier?.text === "require_relative") {
        imports.push({ raw: node.text, range: nodeRange(node), kind: "require" });
      }
      if (identifier?.text) callSites.push({ calleeText: identifier.text, range: nodeRange(node), enclosingSymbolQname: currentQname() });
    }

    if (node.type === "class") {
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

    if (node.type === "method") {
      const name = extractName(node);
      if (name) {
        const parent = currentQname();
        const qname = parent ? `${parent}.${name}` : name;
        symbols.push({ kind: "method", name, qname, range: nodeRange(node), parentName: parent });
        stack.push(qname);
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
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
