import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type RubyScope = {
  kind: "class" | "method";
  name: string;
  qname: string;
};

function joinQualifiedName(stack: RubyScope[], name: string): string {
  const prefix = stack.filter((scope) => scope.kind === "class").map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractRuby: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: RubyScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentClassScope = () => [...stack].reverse().find((scope) => scope.kind === "class");

  const walk = (node: SyntaxNode) => {
    if (node.type === "call") {
      const identifier = node.childForFieldName("name") || node.namedChildren?.find((n) => n.type === "identifier");
      if (identifier?.text === "require" || identifier?.text === "require_relative") {
        imports.push({ raw: node.text, range: nodeRange(node), kind: "require" });
      }
      if (identifier?.text) {
        callSites.push({ calleeText: identifier.text, range: nodeRange(node), enclosingSymbolQname: currentScope()?.qname });
      }
    }

    if (node.type === "class") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        symbols.push({ kind: "class", name, qname, range: nodeRange(node) });
        stack.push({ kind: "class", name, qname });
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
        const parent = currentClassScope();
        const qname = joinQualifiedName(stack, name);
        symbols.push({ kind: "method", name, qname, range: nodeRange(node), parentName: parent?.name });
        stack.push({ kind: "method", name, qname });
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
