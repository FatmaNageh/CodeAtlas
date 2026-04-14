import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type JavaScope =
  | { kind: "type"; name: string; qname: string }
  | { kind: "method"; name: string; qname: string };

function listInterfaceNames(node: SyntaxNode): string[] {
  const out: string[] = [];
  // tree-sitter-java: class_declaration may contain interfaces field
  const interfaces = node.childForFieldName?.("interfaces");
  if (interfaces) {
    for (const ch of interfaces.namedChildren ?? []) {
      if (ch.text) out.push(ch.text);
    }
  }
  return out;
}

function joinQualifiedName(stack: JavaScope[], name: string): string {
  const prefix = stack.filter((scope) => scope.kind === "type").map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractJava: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: JavaScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentTypeScope = () => [...stack].reverse().find((scope) => scope.kind === "type");

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_declaration") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "class_declaration" || node.type === "interface_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        const superclass = node.childForFieldName?.("superclass")?.text;
        const interfaces = listInterfaceNames(node);
        symbols.push({
          kind: node.type === "interface_declaration" ? "interface" : "class",
          name,
          qname,
          range: nodeRange(node),
          extendsNames: superclass ? [superclass] : [],
          implementsNames: interfaces,
        });
        stack.push({ kind: "type", name, qname });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "method_declaration") {
      const name = extractName(node);
      if (name) {
        const parent = currentTypeScope();
        const qname = parent ? `${parent.qname}.${name}` : joinQualifiedName(stack, name);
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

    if (node.type === "method_invocation") {
      const name = node.childForFieldName("name");
      if (name?.text) {
        callSites.push({ calleeText: name.text, range: nodeRange(node), enclosingSymbolQname: currentScope()?.qname });
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
