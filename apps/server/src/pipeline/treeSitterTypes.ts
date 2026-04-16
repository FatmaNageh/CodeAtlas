import type Parser from "tree-sitter";
import type { SyntaxNode } from "tree-sitter";

export type TreeSitterTree = {
  rootNode?: SyntaxNode & { hasError?: (() => boolean) | boolean };
};

export type TreeSitterParserInstance = Parser;
export type TreeSitterParserConstructor = typeof Parser;
