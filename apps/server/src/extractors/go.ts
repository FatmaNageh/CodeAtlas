import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type GoScope =
  | { kind: "package"; name: string; qname: string }
  | { kind: "type"; name: string; qname: string }
  | { kind: "function"; name: string; qname: string };

function receiverTypeText(node: SyntaxNode): string | undefined {
  // method_declaration in tree-sitter-go has receiver field
  const recv = node.childForFieldName?.("receiver");
  if (!recv) return undefined;
  // receiver can be: (t *Type) or (t Type)
  const typ = recv.namedChildren?.find((n) => n.type.includes("type")) ?? recv.namedChildren?.find((n) => n.text);
  return typ?.text?.replace(/^\*/, "")?.trim();
}

function joinQualifiedName(stack: GoScope[], name: string): string {
  const prefix = stack.filter((scope) => scope.kind === "package" || scope.kind === "type").map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join(".")}.${name}` : name;
}

export const extractGo: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: GoScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentTypeScope = () => [...stack].reverse().find((scope) => scope.kind === "type");

  const walk = (node: SyntaxNode) => {
    if (node.type === "package_clause") {
      const name = node.childForFieldName("name")?.text ?? extractName(node);
      if (name) {
        symbols.push({ kind: "namespace", name, qname: name, range: nodeRange(node) });
        stack.push({ kind: "package", name, qname: name });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "import_declaration") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "function_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        symbols.push({ kind: "function", name, qname, range: nodeRange(node) });
        stack.push({ kind: "function", name, qname });
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
        const recvType = receiverTypeText(node);
        const parent = recvType ?? currentTypeScope()?.name;
        const qname = parent ? `${joinQualifiedName(stack, parent)}.${name}` : joinQualifiedName(stack, name);
        symbols.push({ kind: "method", name, qname, range: nodeRange(node), parentName: parent });
        stack.push({ kind: "function", name, qname });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "type_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        symbols.push({ kind: "struct", name, qname, range: nodeRange(node) });
        stack.push({ kind: "type", name, qname });
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
      if (fn?.text) {
        callSites.push({ calleeText: fn.text, range: nodeRange(node), enclosingSymbolQname: currentScope()?.qname });
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
