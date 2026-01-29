import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

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

export const extractJava: ExtractorFn = (root) => {
  const imports = [];
  const symbols = [];
  const callSites = [];

  const stack: string[] = [];
  const currentQname = () => (stack.length ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (node.type === "import_declaration") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "class_declaration" || node.type === "interface_declaration") {
      const name = extractName(node);
      if (name) {
        const qname = name;
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

    if (node.type === "method_invocation") {
      const name = node.childForFieldName("name");
      if (name?.text) callSites.push({ calleeText: name.text, range: nodeRange(node), enclosingSymbolQname: currentQname() });
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walk(child);
    }
  };

  walk(root);
  return { imports, symbols, callSites };
};
