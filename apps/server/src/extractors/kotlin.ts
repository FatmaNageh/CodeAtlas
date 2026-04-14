import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type KotlinScope =
  | { kind: "namespace"; name: string; qname: string }
  | { kind: "type"; name: string; qname: string };

function collectSuperTypes(node: SyntaxNode): string[] {
  const delegation = node.childForFieldName("delegation_specifiers");
  if (!delegation) {
    return [];
  }

  return delegation.namedChildren
    .map((child) => child.text)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function joinQualifiedName(stack: KotlinScope[], name: string): string {
  const prefix = stack.map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractKotlin: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: KotlinScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentTypeScope = () => [...stack].reverse().find((scope) => scope.kind === "type");

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_header") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "package_header") {
      const name = node.text.replace(/^package\s+/, "").trim();
      if (name) {
        symbols.push({ kind: "namespace", name, qname: name, range: nodeRange(node) });
        stack.push({ kind: "namespace", name, qname: name });
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
      node.type === "object_declaration" ||
      node.type === "enum_class_body"
    ) {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        symbols.push({
          kind: node.type === "interface_declaration" ? "interface" : "class",
          name,
          qname,
          range: nodeRange(node),
          extendsNames: collectSuperTypes(node).slice(0, 1),
          implementsNames: collectSuperTypes(node).slice(1),
        });
        stack.push({ kind: "type", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "function_declaration" || node.type === "secondary_constructor") {
      const name =
        extractName(node) ??
        (node.type === "secondary_constructor" ? currentTypeScope()?.name ?? "constructor" : null);
      if (name) {
        const parent = currentTypeScope();
        const qname = parent ? `${parent.qname}.${name}` : joinQualifiedName(stack, name);
        symbols.push({
          kind: node.type === "secondary_constructor" ? "constructor" : parent ? "method" : "function",
          name,
          qname,
          range: nodeRange(node),
          parentName: parent?.name,
        });
        stack.push({ kind: "type", name, qname });
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
