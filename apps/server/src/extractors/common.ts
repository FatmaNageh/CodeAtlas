import type { SyntaxNode } from "tree-sitter";
import type { Range } from "../types/ir";

export function nodeRange(n: SyntaxNode): Range {
  return {
    startLine: n.startPosition.row + 1,
    startCol: n.startPosition.column + 1,
    endLine: n.endPosition.row + 1,
    endCol: n.endPosition.column + 1,
  };
}

export function extractName(node: SyntaxNode): string | null {
  const nameField = node.childForFieldName?.("name");
  if (nameField?.text) return nameField.text;

  const idNode = node.namedChildren?.find((n) => /identifier|name|property_identifier/.test(n.type));
  if (idNode?.text) return idNode.text;

  if (node.type === "function_definition") {
    const declarator = node.namedChildren?.find((n) => n.type === "function_declarator");
    const ident = declarator?.namedChildren?.find((n) => n.type === "identifier");
    if (ident?.text) return ident.text;
  }

  const fallback = node.namedChildren?.find((n) => n.type === "identifier" || n.type === "name");
  if (fallback?.text) return fallback.text;

  return null;
}

export function uniq<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
