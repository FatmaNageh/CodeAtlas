import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type PhpScope =
  | { kind: "namespace"; name: string; qname: string }
  | { kind: "type"; name: string; qname: string }
  | { kind: "function"; name: string; qname: string };

function collectInterfaceNames(node: SyntaxNode): string[] {
  const clause = node.childForFieldName("interfaces");
  if (!clause) {
    return [];
  }

  return clause.namedChildren
    .map((child) => child.text)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function joinQualifiedName(stack: PhpScope[], name: string, separator: "\\" | "::" = "\\"): string {
  const prefix = stack
    .filter((scope) => scope.kind === "namespace" || scope.kind === "type")
    .map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(separator)}${separator}${name}` : name;
}

function currentTypeScope(stack: PhpScope[]): PhpScope | undefined {
  return [...stack].reverse().find((scope) => scope.kind === "type");
}

export const extractPhp: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: PhpScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (
      node.type === "namespace_use_declaration" ||
      node.type === "require_expression" ||
      node.type === "include_expression"
    ) {
      imports.push({
        raw: node.text,
        range: nodeRange(node),
        kind: node.type === "namespace_use_declaration" ? "static" : "include",
      });
    }

    if (node.type === "namespace_definition") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name, "\\");
        symbols.push({ kind: "namespace", name, qname, range: nodeRange(node) });
        stack.push({ kind: "namespace", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (
      node.type === "class_declaration" ||
      node.type === "interface_declaration" ||
      node.type === "trait_declaration" ||
      node.type === "enum_declaration"
    ) {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name, "\\");
        const baseType = node.childForFieldName("base_clause")?.text;
        symbols.push({
          kind:
            node.type === "interface_declaration"
              ? "interface"
              : node.type === "trait_declaration"
                ? "trait"
                : node.type === "enum_declaration"
                  ? "enum"
                  : "class",
          name,
          qname,
          range: nodeRange(node),
          extendsNames: baseType ? [baseType] : [],
          implementsNames: collectInterfaceNames(node),
        });
        stack.push({ kind: "type", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "function_definition" || node.type === "method_declaration") {
      const name = extractName(node);
      if (name) {
        const typeScope = currentTypeScope(stack);
        const qname = typeScope ? `${typeScope.qname}::${name}` : joinQualifiedName(stack, name, "\\");
        symbols.push({
          kind: typeScope ? "method" : "function",
          name,
          qname,
          range: nodeRange(node),
          parentName: typeScope?.name,
        });
        stack.push({ kind: "function", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "function_call_expression" || node.type === "member_call_expression") {
      const target = node.childForFieldName("function") ?? node.childForFieldName("name");
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
