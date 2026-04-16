import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type CSharpScope =
  | { kind: "namespace"; name: string; qname: string }
  | { kind: "type"; name: string; qname: string };

function collectTypeList(node: SyntaxNode, fieldName: string): string[] {
  const field = node.childForFieldName(fieldName);
  if (!field) {
    return [];
  }

  const names = new Set<string>();
  for (const child of field.namedChildren) {
    if (child.text) {
      names.add(child.text);
    }
    for (const grandChild of child.namedChildren) {
      if (grandChild.text) {
        names.add(grandChild.text);
      }
    }
  }
  return Array.from(names);
}

function namespaceName(node: SyntaxNode): string | null {
  const text = node.text.replace(/^namespace\s+/, "").replace(/[;{].*$/s, "").trim();
  return text.length > 0 ? text : null;
}

function joinQualifiedName(stack: CSharpScope[], name: string): string {
  const prefix = stack.map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractCSharp: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: CSharpScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentTypeScope = () => [...stack].reverse().find((scope) => scope.kind === "type");

  const walk = (node: SyntaxNode) => {
    if (node.type === "using_directive") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "namespace_declaration" || node.type === "file_scoped_namespace_declaration") {
      const name = namespaceName(node) ?? extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack.filter((scope) => scope.kind === "namespace"), name);
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
      node.type === "struct_declaration" ||
      node.type === "record_declaration" ||
      node.type === "enum_declaration"
    ) {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        const kind =
          node.type === "interface_declaration"
            ? "interface"
            : node.type === "enum_declaration"
              ? "enum"
              : node.type === "struct_declaration"
                ? "struct"
                : "class";
        symbols.push({
          kind,
          name,
          qname,
          range: nodeRange(node),
          extendsNames: collectTypeList(node, "base_list").slice(0, 1),
          implementsNames: collectTypeList(node, "base_list").slice(1),
        });
        stack.push({ kind: "type", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "method_declaration" || node.type === "constructor_declaration") {
      const name = extractName(node) ?? (node.type === "constructor_declaration" ? currentTypeScope()?.name ?? null : null);
      if (name) {
        const parent = currentTypeScope();
        const qname = parent ? `${parent.qname}.${name}` : joinQualifiedName(stack, name);
        symbols.push({
          kind: node.type === "constructor_declaration" ? "constructor" : "method",
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

    if (node.type === "invocation_expression" || node.type === "object_creation_expression") {
      const target = node.childForFieldName("function") ?? node.childForFieldName("type");
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
