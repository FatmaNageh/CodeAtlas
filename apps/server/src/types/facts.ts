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
  /** Names of base types (best-effort). */
  extendsNames?: string[];
  /** Names of implemented interfaces (best-effort). */
  implementsNames?: string[];
};

export type RawImport = {
  raw: string;
  range?: Range;
  kind?: "static" | "dynamic" | "require" | "include";
};

export type RawCallSite = {
  calleeText: string;
  range?: Range;
  /** Qualified name of the enclosing symbol (function/method/class) if known. */
  enclosingSymbolQname?: string;
};

export type CodeFacts = {
  kind: "code";
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

export type TextFacts = {
  kind: "text";
  fileRelPath: string;
  /** Links/paths referenced from docs (best-effort). */
  references: { raw: string; range?: Range }[];
  /** Backticked identifiers or headings that likely refer to symbols (best-effort). */
  symbolMentions: { name: string; range?: Range }[];
  lineCount?: number;
  textPreview?: string;
  textHash?: string;
};

export type FileFacts = CodeFacts | TextFacts;
export type FactsByFile = Record<string, FileFacts>;
