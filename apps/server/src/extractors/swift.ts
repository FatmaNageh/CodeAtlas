import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type SwiftScope =
  | { kind: "type"; name: string; qname: string }
  | { kind: "function"; name: string; qname: string };

function collectInheritedTypes(node: SyntaxNode): string[] {
  const clause = node.childForFieldName("inheritance_clause");
  if (!clause) {
    return [];
  }

  return clause.namedChildren
    .map((child) => child.text.replace(/^:\s*/, "").trim())
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function joinQualifiedName(stack: SwiftScope[], name: string): string {
  const prefix = stack.filter((scope) => scope.kind === "type").map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractSwift: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: SwiftScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentTypeScope = () => [...stack].reverse().find((scope) => scope.kind === "type");

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_declaration") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (
      node.type === "class_declaration" ||
      node.type === "struct_declaration" ||
      node.type === "protocol_declaration" ||
      node.type === "enum_declaration" ||
      node.type === "extension_declaration"
    ) {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        const inherited = collectInheritedTypes(node);
        symbols.push({
          kind:
            node.type === "struct_declaration"
              ? "struct"
              : node.type === "protocol_declaration"
                ? "protocol"
                : node.type === "enum_declaration"
                  ? "enum"
                  : "class",
          name,
          qname,
          range: nodeRange(node),
          extendsNames: inherited.slice(0, 1),
          implementsNames: inherited.slice(1),
        });
        stack.push({ kind: "type", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "function_declaration" || node.type === "initializer_declaration") {
      const name = extractName(node) ?? (node.type === "initializer_declaration" ? "init" : null);
      if (name) {
        const parent = currentTypeScope();
        const qname = parent ? `${parent.qname}.${name}` : joinQualifiedName(stack, name);
        symbols.push({
          kind: node.type === "initializer_declaration" ? "constructor" : parent ? "method" : "function",
          name,
          qname,
          range: nodeRange(node),
          parentName: parent?.name,
        });
        stack.push({ kind: "function", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "call_expression") {
      const target = node.childForFieldName("function");
      if (target?.text) {
        callSites.push({
          calleeText: target.text,
          range: nodeRange(node),
          enclosingSymbolQname: currentScope()?.qname,
        });
      }
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  };

  walk(root);
  return { imports, symbols, callSites };
};
