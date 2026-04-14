import type { SyntaxNode } from "tree-sitter";
import type { ExtractorFn } from "./types";
import { extractName, nodeRange } from "./common";

type RustScope =
  | { kind: "module"; name: string; qname: string }
  | { kind: "type"; name: string; qname: string }
  | { kind: "impl"; name: string; qname: string };

function implTarget(node: SyntaxNode): { owner: string | null; traitName: string | null } {
  const text = node.text.replace(/\s+/g, " ");
  const traitMatch = text.match(/^impl\s+([A-Za-z_][\w:]*)\s+for\s+([A-Za-z_][\w:]*)/);
  if (traitMatch?.[1] && traitMatch[2]) {
    return { owner: traitMatch[2], traitName: traitMatch[1] };
  }

  const ownerMatch = text.match(/^impl(?:<[^>]+>)?\s+([A-Za-z_][\w:]*)/);
  return { owner: ownerMatch?.[1] ?? null, traitName: null };
}

function joinQualifiedName(stack: RustScope[], name: string): string {
  const prefix = stack.map((scope) => scope.name);
  return prefix.length > 0 ? `${prefix.join("::")}::${name}` : name;
}

export const extractRust: ExtractorFn = (root) => {
  const imports: ReturnType<ExtractorFn>["imports"] = [];
  const symbols: ReturnType<ExtractorFn>["symbols"] = [];
  const callSites: ReturnType<ExtractorFn>["callSites"] = [];

  const stack: RustScope[] = [];
  const currentScope = () => (stack.length > 0 ? stack[stack.length - 1] : undefined);
  const currentImplScope = () => [...stack].reverse().find((scope) => scope.kind === "impl");

  const walk = (node: SyntaxNode) => {
    if (node.type === "use_declaration") {
      imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
    }

    if (node.type === "mod_item") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        symbols.push({ kind: "module", name, qname, range: nodeRange(node) });
        stack.push({ kind: "module", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "struct_item" || node.type === "enum_item" || node.type === "trait_item") {
      const name = extractName(node);
      if (name) {
        const qname = joinQualifiedName(stack, name);
        symbols.push({
          kind:
            node.type === "struct_item"
              ? "struct"
              : node.type === "enum_item"
                ? "enum"
                : "trait",
          name,
          qname,
          range: nodeRange(node),
        });
        stack.push({ kind: "type", name, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "impl_item") {
      const implInfo = implTarget(node);
      if (implInfo.owner) {
        const qname = joinQualifiedName(stack, implInfo.owner);
        stack.push({ kind: "impl", name: implInfo.owner, qname });
        for (const child of node.namedChildren) {
          walk(child);
        }
        stack.pop();
        return;
      }
    }

    if (node.type === "function_item") {
      const name = extractName(node);
      if (name) {
        const implScope = currentImplScope();
        const qname = joinQualifiedName(stack, name);
        symbols.push({
          kind: implScope ? "method" : "function",
          name,
          qname,
          range: nodeRange(node),
          parentName: implScope?.name,
        });
        stack.push({ kind: "module", name, qname });
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
