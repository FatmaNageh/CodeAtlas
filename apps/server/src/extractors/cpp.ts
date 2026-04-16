import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type CppScope =
  | { kind: "namespace"; name: string; qname: string }
  | { kind: "class"; name: string; qname: string }
  | { kind: "struct"; name: string; qname: string };

function joinQname(scopes: CppScope[], name: string): string {
  const prefix = scopes.map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join("::")}::${name}` : name;
}

export const extractCpp: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: CppScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);

  const walk = (node: SyntaxNode) => {
    if (node.type === "preproc_include") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "include" });
    }

    if (node.type === "namespace_definition") {
      const nm = node.child(1)?.text;
      if (nm) {
        const qname = joinQname(stack, nm);
        symbols.push({ kind: "namespace", name: nm, qname, range: nodeRange(node) });
        stack.push({ kind: "namespace", name: nm, qname });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "class_specifier" || node.type === "struct_specifier") {
      const name = extractName(node);
      if (name) {
        const qname = joinQname(stack, name);
        const kind = node.type === "struct_specifier" ? "struct" : "class";
        symbols.push({ kind, name, qname, range: nodeRange(node) });
        stack.push({ kind, name, qname });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "enum_specifier") {
      const name = extractName(node);
      if (name) {
        const qname = joinQname(stack, name);
        symbols.push({ kind: "enum", name, qname, range: nodeRange(node) });
      }
    }

    if (node.type === "function_definition") {
      const name = extractName(node);
      if (name) {
        const parent = currentScope();
        const parentName =
          parent && (parent.kind === "class" || parent.kind === "struct")
            ? parent.name
            : undefined;
        const qname = joinQname(stack, name);
        symbols.push({
          kind: parentName ? "method" : "function",
          name,
          qname,
          range: nodeRange(node),
          parentName,
        });
        stack.push({ kind: "namespace", name, qname });
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
        callSites.push({
          calleeText: fn.text,
          range: nodeRange(node),
          enclosingSymbolQname: currentScope()?.qname,
        });
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
