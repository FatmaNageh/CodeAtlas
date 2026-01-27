import type { SupportedLanguage } from "./scan";
import type { Range } from "./ir";

export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "interface"
  | "module"
  | "namespace";

export type RawSymbol = {
  kind: SymbolKind;
  name: string;
  qname?: string;
  range?: Range;
  parentName?: string;
};

export type RawImport = {
  raw: string;
  range?: Range;
  kind?: "static" | "dynamic" | "require" | "include";
};

export type RawCallSite = {
  calleeText: string;
  range?: Range;
};

export type RawFacts = {
  fileRelPath: string;
  language: SupportedLanguage;
  imports: RawImport[];
  symbols: RawSymbol[];
  callSites: RawCallSite[];
  parseErrors?: number;
  /** Optional helpers for later chunking / citations. */
  lineCount?: number;
  /** Short preview of the file text (safe size). */
  textPreview?: string;
  /** SHA1 hash of full file text (when available). */
  textHash?: string;
};

export type FactsByFile = Record<string, RawFacts>;
