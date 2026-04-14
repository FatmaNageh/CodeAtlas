import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

function qualifiedName(parts: string[], name: string): string {
  return parts.length > 0 ? `${parts.join("::")}::${name}` : name;
}

export const extractC: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const containerStack: Array<{ name: string; kind: "struct" | "enum" }> = [];
  const currentContainer = () =>
    containerStack.length > 0 ? containerStack[containerStack.length - 1] : undefined;

  const walk = (node: SyntaxNode) => {
    if (node.type === "preproc_include") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "include" });
    }

    if (node.type === "function_definition") {
      const name = extractName(node);
      if (name) {
        symbols.push({
          kind: "function",
          name,
          qname: qualifiedName(containerStack.map((container) => container.name), name),
          range: nodeRange(node),
          parentName: currentContainer()?.name,
        });
      }
    }

    if (node.type === "struct_specifier") {
      const name = extractName(node);
      if (name) {
        symbols.push({ kind: "struct", name, qname: qualifiedName([], name), range: nodeRange(node) });
        containerStack.push({ name, kind: "struct" });
        for (let index = 0; index < node.childCount; index++) {
          const child = node.child(index);
          if (child) {
            walk(child);
          }
        }
        containerStack.pop();
        return;
      }
    }

    if (node.type === "enum_specifier") {
      const name = extractName(node);
      if (name) {
        symbols.push({ kind: "enum", name, qname: qualifiedName([], name), range: nodeRange(node) });
        containerStack.push({ name, kind: "enum" });
        for (let index = 0; index < node.childCount; index++) {
          const child = node.child(index);
          if (child) {
            walk(child);
          }
        }
        containerStack.pop();
        return;
      }
    }

    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (fn?.text) {
        callSites.push({
          calleeText: fn.text,
          range: nodeRange(node),
          enclosingSymbolQname: currentContainer()?.name,
        });
      }
    }

    for (let index = 0; index < node.childCount; index++) {
      const child = node.child(index);
      if (child) {
        walk(child);
      }
    }
  };

  walk(root);
  return { imports, symbols, callSites };
};
