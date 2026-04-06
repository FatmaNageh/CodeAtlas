import type { SyntaxNode } from "tree-sitter";
import type { SupportedLanguage } from "../types/scan";
import type { RawCallSite, RawImport, RawSymbol } from "../types/facts";

export type Extracted = {
  imports: RawImport[];
  symbols: RawSymbol[];
  callSites: RawCallSite[];
};

export type ExtractorContext = {
  language: SupportedLanguage;
  ext: string;
  relPath: string;
  text: string;
};

export type ExtractorFn = (root: SyntaxNode, ctx: ExtractorContext) => Extracted;
