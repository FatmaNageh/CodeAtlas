import crypto from "node:crypto";

import type { CodeFileIndexEntry } from "../types/scan";
import type { CodeFacts, FactsByFile, RawCallSite, RawImport, RawSymbol } from "../types/facts";
import type { SyntaxNode } from "tree-sitter";

import { parseFile } from "./parse";
import { Extractors } from "../extractors";
import { extractTsJsWithTsCompiler } from "../extractors/tsCompiler";
import { uniq } from "../extractors/common";
import { extractTextFallback } from "../extractors/textFallback";
import type { TreeSitterTree } from "./treeSitterTypes";

function safePreview(text: string, max = 4000): string {
  return text.length <= max ? text : text.slice(0, max);
}

function comparePositions(
  leftLine: number,
  leftCol: number,
  rightLine: number,
  rightCol: number,
): number {
  if (leftLine !== rightLine) return leftLine - rightLine;
  return leftCol - rightCol;
}

function rangesOverlap(left: NonNullable<RawSymbol["range"]>, right: NonNullable<RawSymbol["range"]>): boolean {
  const leftEndsBeforeRightStarts =
    comparePositions(left.endLine, left.endCol, right.startLine, right.startCol) < 0;
  const rightEndsBeforeLeftStarts =
    comparePositions(right.endLine, right.endCol, left.startLine, left.startCol) < 0;
  return !(leftEndsBeforeRightStarts || rightEndsBeforeLeftStarts);
}

function rangeSpan(range: NonNullable<RawSymbol["range"]>): number {
  return (range.endLine - range.startLine) * 10000 + (range.endCol - range.startCol);
}

function mergeSymbolMetadata(primary: RawSymbol, secondary: RawSymbol): RawSymbol {
  const extendsNames = Array.from(
    new Set([...(primary.extendsNames ?? []), ...(secondary.extendsNames ?? [])]),
  );
  const implementsNames = Array.from(
    new Set([...(primary.implementsNames ?? []), ...(secondary.implementsNames ?? [])]),
  );

  return {
    ...secondary,
    ...primary,
    qname: primary.qname ?? secondary.qname,
    parentName: primary.parentName ?? secondary.parentName,
    extendsNames: extendsNames.length > 0 ? extendsNames : undefined,
    implementsNames: implementsNames.length > 0 ? implementsNames : undefined,
    range: primary.range ?? secondary.range,
  };
}

function dedupeSymbols(symbols: RawSymbol[]): RawSymbol[] {
  const groups = new Map<string, RawSymbol[]>();

  for (const symbol of symbols) {
    const baseKey = `${symbol.kind}:${symbol.qname ?? symbol.name}`;
    const existing = groups.get(baseKey) ?? [];
    const range = symbol.range ?? null;

    if (!range) {
      const rangedIndex = existing.findIndex((candidate) => candidate.range);
      if (rangedIndex >= 0) {
        const ranged = existing[rangedIndex];
        if (ranged) {
          existing[rangedIndex] = mergeSymbolMetadata(ranged, symbol);
        }
      } else if (existing.length === 0) {
        existing.push(symbol);
      } else {
        const first = existing[0];
        if (first) {
          existing[0] = mergeSymbolMetadata(first, symbol);
        }
      }
      groups.set(baseKey, existing);
      continue;
    }

    const overlappingIndex = existing.findIndex(
      (candidate) => candidate.range && rangesOverlap(candidate.range, range),
    );
    if (overlappingIndex >= 0) {
      const candidate = existing[overlappingIndex];
      if (!candidate) continue;
      const preferred =
        candidate.range && rangeSpan(candidate.range) >= rangeSpan(range) ? candidate : symbol;
      const secondary = preferred === candidate ? symbol : candidate;
      existing[overlappingIndex] = mergeSymbolMetadata(preferred, secondary);
    } else {
      existing.push(symbol);
    }

    groups.set(baseKey, existing);
  }

  return Array.from(groups.values()).flat();
}

function dedupeCallSites(callSites: RawCallSite[]): RawCallSite[] {
  const withRange = new Map<string, RawCallSite>();
  const withoutRange = new Map<string, RawCallSite>();

  for (const callSite of callSites) {
    const baseKey = `${callSite.calleeText}:${callSite.enclosingSymbolQname ?? ""}`;
    const range = callSite.range;
    if (range) {
      const key = `${baseKey}:${range.startLine}:${range.startCol}:${range.endLine}:${range.endCol}`;
      if (!withRange.has(key)) {
        withRange.set(key, callSite);
      }
      continue;
    }

    if (Array.from(withRange.keys()).some((key) => key.startsWith(`${baseKey}:`))) {
      continue;
    }
    if (!withoutRange.has(baseKey)) {
      withoutRange.set(baseKey, callSite);
    }
  }

  return [...withRange.values(), ...withoutRange.values()];
}

async function parseAndExtractSequential(files: CodeFileIndexEntry[]): Promise<FactsByFile> {
  const out: FactsByFile = {};

  for (const f of files) {
    const parsed = await parseFile(f);
    const text = parsed.text ?? "";
    const lineCount = text ? text.split(/\r\n|\r|\n/).length : 0;
    const textPreview = safePreview(text);
    const textHash = text ? crypto.createHash("sha1").update(text).digest("hex") : undefined;

    const tree = parsed.tree as TreeSitterTree | undefined;
    const root: SyntaxNode | undefined = tree?.rootNode;
    const extractor = Extractors[f.language];

    let imports: RawImport[] = [];
    let symbols: RawSymbol[] = [];
    let callSites: RawCallSite[] = [];

    // Phase 2 enhancement: prefer TypeScript Compiler API for JS/TS when available.
    if (f.language === "javascript" || f.language === "typescript") {
      const res = await extractTsJsWithTsCompiler({ language: f.language, ext: f.ext, relPath: f.relPath, text });
      if (res) {
        imports = [...imports, ...res.imports];
        symbols = [...symbols, ...res.symbols];
        callSites = [...callSites, ...res.callSites];
      }
    }

    if (root && extractor) {
      const res = extractor(root, { language: f.language, ext: f.ext, relPath: f.relPath, text });
      imports = [...imports, ...res.imports];
      symbols = [...symbols, ...res.symbols];
      callSites = [...callSites, ...res.callSites];
    }

    const fallback = extractTextFallback({ language: f.language, ext: f.ext, relPath: f.relPath, text });
    imports = [...imports, ...fallback.imports];
    symbols = [...symbols, ...fallback.symbols];
    callSites = [...callSites, ...fallback.callSites];

    // De-dupe (tree-sitter nodes can be reached multiple ways)
    imports = uniq(imports, (i) => `${i.kind || ""}:${i.raw}`);
    symbols = dedupeSymbols(symbols);
    callSites = dedupeCallSites(callSites);

    out[f.relPath] = {
      kind: "code",
      fileRelPath: f.relPath,
      language: f.language,
      imports,
      astNodes: symbols,
      callSites,
      parseStatus: parsed.parseStatus,
      parser: parsed.parser,
      parseErrors: parsed.parseErrors,
      lineCount,
      textPreview,
      textHash,
    } satisfies CodeFacts;
  }

  return out;
}

export type ParseAndExtractOptions = {
  disableParallel?: boolean;
};

/**
 * Parse + extract code facts for a list of code files.
 */
export async function parseAndExtract(
  files: CodeFileIndexEntry[],
  _options: ParseAndExtractOptions = {},
): Promise<FactsByFile> {
  return parseAndExtractSequential(files);
}
