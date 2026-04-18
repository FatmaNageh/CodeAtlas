import type { CodeFacts, CodeSegment, Range, RawCallSite, RawImport, RawSymbol } from "@/types/facts";
import type { AstUnitKind } from "@/types/graphProperties";

const SMALL_FILE_LINES = 80;
const MAX_SEGMENT_LINES = 120;
const MAX_SYMBOLS_PER_COMPOSITE = 3;
const STANDALONE_SYMBOL_LINES = 60;
const SPLIT_THRESHOLD_LINES = 200;
const MIN_COMPOSITE_SYMBOLS = 2;

type SymbolGroup = {
  symbols: RawSymbol[];
  standalone: boolean;
};

type SegmentReason =
  | "small-file-composite"
  | "grouped-top-level"
  | "standalone-region"
  | "oversized-split"
  | "fallback-module"
  | "recovery-root"
  | "recovered-symbol";

function comparePositions(
  leftLine: number,
  leftCol: number,
  rightLine: number,
  rightCol: number,
): number {
  if (leftLine !== rightLine) return leftLine - rightLine;
  return leftCol - rightCol;
}

function rangeContainsPoint(
  range: Range,
  line: number,
  col: number,
): boolean {
  return (
    comparePositions(range.startLine, range.startCol, line, col) <= 0 &&
    comparePositions(range.endLine, range.endCol, line, col) >= 0
  );
}

function lineSlice(text: string, startLine: number, endLine: number): string {
  const lines = text.split(/\r\n|\r|\n/);
  return lines.slice(Math.max(0, startLine - 1), Math.max(0, endLine)).join("\n").trim();
}

function getLineCount(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
}

function getLineLength(text: string, lineNumber: number): number {
  const lines = text.split(/\r\n|\r|\n/);
  return lines[Math.max(0, lineNumber - 1)]?.length ?? 1;
}

function estimateTokenCount(text: string): number {
  const tokens = text.match(/[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[^\s]/g);
  return tokens?.length ?? 0;
}

function unitKindForSymbol(symbol: RawSymbol): AstUnitKind {
  switch (symbol.kind) {
    case "class":
      return "class-unit";
    case "interface":
    case "protocol":
    case "trait":
      return "interface-unit";
    case "function":
    case "method":
    case "constructor":
      return "function-unit";
    default:
      return "module-unit";
  }
}

function segmentLabel(unitKind: AstUnitKind, symbol: RawSymbol | null, partIndex?: number): string {
  const baseLabel =
    symbol?.qname ??
    symbol?.name ??
    (unitKind === "module-unit" ? "module-body" : unitKind);
  return partIndex === undefined ? baseLabel : `${baseLabel} (part ${partIndex + 1})`;
}

function compositeSegmentLabel(symbols: RawSymbol[], index: number): string {
  const labels = symbols
    .map((symbol) => symbol.qname ?? symbol.name)
    .filter((label, labelIndex, values) => label && values.indexOf(label) === labelIndex);

  if (labels.length === 0) return `file-scope-${index + 1}`;
  if (labels.length === 1) return labels[0] ?? `file-scope-${index + 1}`;
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return `${labels[0]} + ${labels.length - 1} more`;
}

function buildKeywords(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const lowered = normalized.toLowerCase();
    if (seen.has(lowered)) continue;
    seen.add(lowered);
    keywords.push(normalized);
    if (keywords.length >= 12) break;
  }

  return keywords;
}

function buildSummaryCandidate(
  unitKind: AstUnitKind,
  label: string,
  topLevelSymbols: string[],
  imports: string[],
  calls: string[],
): string {
  const subject = label.trim() || unitKind;
  const symbolPhrase =
    topLevelSymbols.length > 0
      ? `Top-level symbols: ${topLevelSymbols.slice(0, 3).join(", ")}`
      : "No named top-level symbols extracted";
  const importPhrase =
    imports.length > 0
      ? `Imports: ${imports.slice(0, 3).join(", ")}`
      : "No imports extracted";
  const callPhrase =
    calls.length > 0
      ? `Calls: ${calls.slice(0, 3).join(", ")}`
      : "No calls extracted";

  return `${subject} (${unitKind}). ${symbolPhrase}. ${importPhrase}. ${callPhrase}.`;
}

function filterSymbolsForRange(symbols: RawSymbol[], range: Range): string[] {
  return Array.from(
    new Set(
      symbols
        .filter((symbol) => {
          const symbolRange = symbol.range;
          if (!symbolRange) return false;
          return (
            rangeContainsPoint(range, symbolRange.startLine, symbolRange.startCol) ||
            rangeContainsPoint(symbolRange, range.startLine, range.startCol)
          );
        })
        .map((symbol) => symbol.qname ?? symbol.name),
    ),
  );
}

function filterImportsForRange(imports: RawImport[], range: Range): string[] {
  return Array.from(
    new Set(
      imports
        .filter((item) => {
          const importRange = item.range;
          if (!importRange) return false;
          return rangeContainsPoint(range, importRange.startLine, importRange.startCol);
        })
        .map((item) => item.raw),
    ),
  );
}

function filterCallsForRange(callSites: RawCallSite[], range: Range): string[] {
  return Array.from(
    new Set(
      callSites
        .filter((callSite) => {
          const callRange = callSite.range;
          if (!callRange) return false;
          return rangeContainsPoint(range, callRange.startLine, callRange.startCol);
        })
        .map((callSite) => callSite.calleeText),
    ),
  );
}

function buildSegment(
  facts: CodeFacts,
  text: string,
  range: Range,
  index: number,
  unitKind: AstUnitKind,
  symbol: RawSymbol | null,
  topLevelSymbols: string[],
  reason: SegmentReason,
  partIndex?: number,
): CodeSegment | null {
  const segmentText = lineSlice(text, range.startLine, range.endLine);
  if (!segmentText) return null;

  const symbolNames = filterSymbolsForRange(facts.astNodes, range);
  const imports = filterImportsForRange(facts.imports, range);
  const calls = filterCallsForRange(facts.callSites, range);
  const label = segmentLabel(unitKind, symbol, partIndex);

  return {
    index,
    unitKind,
    label,
    summaryCandidate: buildSummaryCandidate(unitKind, label, topLevelSymbols, imports, calls),
    segmentReason: reason,
    startLine: range.startLine,
    startCol: range.startCol,
    endLine: range.endLine,
    endCol: range.endCol,
    text: segmentText,
    charCount: segmentText.length,
    tokenEstimate: estimateTokenCount(segmentText),
    symbolNames,
    topLevelSymbols,
    keywords: buildKeywords([...topLevelSymbols, ...symbolNames, ...imports, ...calls]),
    imports,
    calls,
  };
}

function splitLargeRange(range: Range): Range[] {
  const ranges: Range[] = [];
  for (let startLine = range.startLine; startLine <= range.endLine; startLine += MAX_SEGMENT_LINES) {
    const endLine = Math.min(range.endLine, startLine + MAX_SEGMENT_LINES - 1);
    ranges.push({
      startLine,
      startCol: startLine === range.startLine ? range.startCol : 1,
      endLine,
      endCol: endLine === range.endLine ? range.endCol : Number.MAX_SAFE_INTEGER,
    });
  }
  return ranges;
}

function symbolLineSpan(symbol: RawSymbol): number {
  const range = symbol.range;
  if (!range) return 0;
  return range.endLine - range.startLine + 1;
}

function buildTopLevelGroups(topLevelSymbols: RawSymbol[]): SymbolGroup[] {
  const groups: SymbolGroup[] = [];
  let currentSymbols: RawSymbol[] = [];
  let currentStartLine: number | null = null;
  let currentEndLine: number | null = null;

  const flushCurrent = (): void => {
    if (currentSymbols.length === 0) return;
    groups.push({
      symbols: currentSymbols,
      standalone: currentSymbols.length === 1 && symbolLineSpan(currentSymbols[0] as RawSymbol) >= STANDALONE_SYMBOL_LINES,
    });
    currentSymbols = [];
    currentStartLine = null;
    currentEndLine = null;
  };

  for (const symbol of topLevelSymbols) {
    const range = symbol.range;
    if (!range) continue;

    const span = symbolLineSpan(symbol);
    if (span > SPLIT_THRESHOLD_LINES) {
      flushCurrent();
      groups.push({ symbols: [symbol], standalone: true });
      continue;
    }

    if (span >= STANDALONE_SYMBOL_LINES) {
      flushCurrent();
      groups.push({ symbols: [symbol], standalone: true });
      continue;
    }

    if (currentSymbols.length === 0) {
      currentSymbols = [symbol];
      currentStartLine = range.startLine;
      currentEndLine = range.endLine;
      continue;
    }

    const proposedStartLine = currentStartLine ?? range.startLine;
    const proposedEndLine = Math.max(currentEndLine ?? range.endLine, range.endLine);
    const proposedSpan = proposedEndLine - proposedStartLine + 1;
    const wouldOverflow =
      currentSymbols.length >= MAX_SYMBOLS_PER_COMPOSITE ||
      proposedSpan > MAX_SEGMENT_LINES;

    if (wouldOverflow) {
      flushCurrent();
      currentSymbols = [symbol];
      currentStartLine = range.startLine;
      currentEndLine = range.endLine;
      continue;
    }

    currentSymbols.push(symbol);
    currentEndLine = proposedEndLine;
  }

  flushCurrent();
  return groups;
}

function makeFallbackModuleSegment(facts: CodeFacts, text: string): CodeSegment[] {
  const lines = text.split(/\r\n|\r|\n/);
  const trimmedText = text.trim();
  if (!trimmedText) return [];

  const segment = buildSegment(
    facts,
    text,
    {
      startLine: 1,
      startCol: 1,
      endLine: lines.length,
      endCol: lines[lines.length - 1]?.length ?? 1,
    },
    0,
    "module-unit",
    null,
    [],
    "fallback-module",
  );
  return segment ? [segment] : [];
}

function buildRecoverySegments(facts: CodeFacts, text: string, topLevelSymbols: RawSymbol[]): CodeSegment[] {
  const totalLines = getLineCount(text);
  if (totalLines === 0) return [];

  const rootSegment = buildSegment(
    facts,
    text,
    {
      startLine: 1,
      startCol: 1,
      endLine: totalLines,
      endCol: getLineLength(text, totalLines),
    },
    0,
    "module-unit",
    null,
    topLevelSymbols.map((symbol) => symbol.qname ?? symbol.name),
    "recovery-root",
  );

  const segments: CodeSegment[] = [];
  if (rootSegment) {
    rootSegment.label = "recovery-root";
    rootSegment.summaryCandidate = buildSummaryCandidate(
      rootSegment.unitKind,
      rootSegment.label,
      rootSegment.topLevelSymbols,
      rootSegment.imports,
      rootSegment.calls,
    );
    segments.push(rootSegment);
  }

  for (const symbol of topLevelSymbols) {
    const range = symbol.range;
    if (!range) continue;

    const segment = buildSegment(
      facts,
      text,
      range,
      segments.length,
      unitKindForSymbol(symbol),
      symbol,
      [symbol.qname ?? symbol.name],
      "recovered-symbol",
    );
    if (segment) {
      segments.push(segment);
    }
  }

  return segments.length > 0 ? segments : makeFallbackModuleSegment(facts, text);
}

export function buildCodeSegments(input: {
  facts: CodeFacts;
  text: string;
}): CodeSegment[] {
  const { facts, text } = input;
  const totalLines = getLineCount(text);
  const topLevelSymbols = facts.astNodes
    .filter((symbol) => symbol.range && !symbol.parentName)
    .sort((left, right) => {
      const leftRange = left.range as Range;
      const rightRange = right.range as Range;
      return comparePositions(
        leftRange.startLine,
        leftRange.startCol,
        rightRange.startLine,
        rightRange.startCol,
      );
    });

  if (facts.parseStatus === "partial" || facts.parseStatus === "failed") {
    return buildRecoverySegments(facts, text, topLevelSymbols);
  }

  if (topLevelSymbols.length === 0) {
    return makeFallbackModuleSegment(facts, text);
  }

  if (topLevelSymbols.length > 1 && totalLines > 0 && totalLines <= SMALL_FILE_LINES) {
    const wholeFileSegment = buildSegment(
      facts,
      text,
      {
        startLine: 1,
        startCol: 1,
        endLine: totalLines,
        endCol: getLineLength(text, totalLines),
      },
      0,
      "composite-unit",
      null,
      topLevelSymbols.map((symbol) => symbol.qname ?? symbol.name),
      "small-file-composite",
    );
    if (wholeFileSegment) {
      wholeFileSegment.label = compositeSegmentLabel(topLevelSymbols, 0);
      wholeFileSegment.summaryCandidate = buildSummaryCandidate(
        wholeFileSegment.unitKind,
        wholeFileSegment.label,
        wholeFileSegment.topLevelSymbols,
        wholeFileSegment.imports,
        wholeFileSegment.calls,
      );
      return [wholeFileSegment];
    }
  }

  const segments: CodeSegment[] = [];
  const groups = buildTopLevelGroups(topLevelSymbols);
  let previousEndLine = 0;

  for (const [groupIndex, group] of groups.entries()) {
    const firstSymbol = group.symbols[0];
    const lastSymbol = group.symbols[group.symbols.length - 1];
    if (!firstSymbol || !lastSymbol) continue;
    const firstRange = firstSymbol?.range;
    const lastRange = lastSymbol?.range;
    if (!firstRange || !lastRange) continue;

    const nextGroup = groups[groupIndex + 1];
    const nextGroupFirstSymbol = nextGroup?.symbols[0];
    const nextGroupFirstRange = nextGroupFirstSymbol?.range;

    const startLine = previousEndLine > 0 ? previousEndLine + 1 : 1;
    const endLine = nextGroupFirstRange
      ? Math.max(lastRange.endLine, nextGroupFirstRange.startLine - 1)
      : Math.max(lastRange.endLine, totalLines);
    previousEndLine = endLine;

    const segmentRange: Range = {
      startLine,
      startCol: startLine === firstRange.startLine ? firstRange.startCol : 1,
      endLine,
      endCol: endLine === lastRange.endLine ? lastRange.endCol : getLineLength(text, endLine),
    };

    if (group.standalone && group.symbols.length === 1) {
      const symbol = group.symbols[0];
      if (!symbol) continue;
      const topLevelGroupSymbols = [symbol.qname ?? symbol.name];
      const lineSpan = symbolLineSpan(symbol);
      if (lineSpan > SPLIT_THRESHOLD_LINES) {
        const splitRanges = splitLargeRange(segmentRange);
        for (const [partIndex, splitRange] of splitRanges.entries()) {
          const segment = buildSegment(
            facts,
            text,
            splitRange,
            segments.length,
            "split-unit",
            symbol,
            topLevelGroupSymbols,
            "oversized-split",
            partIndex,
          );
          if (segment) segments.push(segment);
        }
        continue;
      }

      const segment = buildSegment(
        facts,
        text,
        segmentRange,
        segments.length,
        unitKindForSymbol(symbol),
        symbol,
        topLevelGroupSymbols,
        "standalone-region",
      );
      if (segment) segments.push(segment);
      continue;
    }

    const groupTopLevelSymbols = group.symbols.map((symbol) => symbol.qname ?? symbol.name);
    const segment = buildSegment(
      facts,
      text,
      segmentRange,
      segments.length,
      group.symbols.length >= MIN_COMPOSITE_SYMBOLS ? "composite-unit" : unitKindForSymbol(firstSymbol),
      group.symbols.length === 1 ? firstSymbol : null,
      groupTopLevelSymbols,
      group.symbols.length >= MIN_COMPOSITE_SYMBOLS ? "grouped-top-level" : "standalone-region",
    );
    if (segment) {
      if (group.symbols.length >= MIN_COMPOSITE_SYMBOLS) {
        segment.label = compositeSegmentLabel(group.symbols, segments.length);
        segment.summaryCandidate = buildSummaryCandidate(
          segment.unitKind,
          segment.label,
          segment.topLevelSymbols,
          segment.imports,
          segment.calls,
        );
      }
      segments.push(segment);
    }
  }

  return segments.length > 0 ? segments : makeFallbackModuleSegment(facts, text);
}
