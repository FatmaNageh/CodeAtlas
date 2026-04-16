import type { SupportedLanguage } from "./scan";


export type Range = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};


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
  extendsNames?: string[];
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
  enclosingSymbolQname?: string;
};

export type TextChunkFact = {
  index: number;
  text: string;
  startLine: number;
  endLine: number;
  chunkVersion: string;
};

export type CodeFacts = {
  kind: "code";
  fileRelPath: string;
  language: SupportedLanguage;
  imports: RawImport[];
  astNodes: RawSymbol[];
  parseErrors?: number;
  lineCount?: number;
  textPreview?: string;
  textHash?: string;
};

export type TextFacts = {
  kind: "text";
  fileRelPath: string;
  references: { raw: string; range?: Range }[];
  symbolMentions: { name: string; range?: Range }[];
  chunks: TextChunkFact[];
  lineCount?: number;
  textPreview?: string;
  textHash?: string;
};

export type FileFacts = CodeFacts | TextFacts;
export type FactsByFile = Record<string, FileFacts>;