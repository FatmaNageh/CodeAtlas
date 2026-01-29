import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

function receiverTypeText(node: SyntaxNode): string | undefined {
  // method_declaration in tree-sitter-go has receiver field
  const recv = node.childForFieldName?.("receiver");
  if (!recv) return undefined;
  // receiver can be: (t *Type) or (t Type)
  const typ = recv.namedChildren?.find((n) => n.type.includes("type")) ?? recv.namedChildren?.find((n) => n.text);
  return typ?.text?.replace(/^\*/, "")?.trim();
}

export const extractGo: ExtractorFn = (root) => {
  const imports = [];
  const symbols = [];
  const callSites = [];

  const stack: string[] = [];
  const currentQname = () => (stack.length ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_declaration") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "function_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = name;
        symbols.push({ kind: "function", name, qname, range: nodeRange(node) });
        stack.push(qname);
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
        const parent = recvType ?? currentQname();
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

    if (node.type === "type_declaration") {
      const name = extractName(node);
      if (name) symbols.push({ kind: "class", name, qname: name, range: nodeRange(node) });
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
