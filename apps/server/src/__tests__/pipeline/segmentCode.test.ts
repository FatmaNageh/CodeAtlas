import { describe, expect, it } from "vitest";

import { buildCodeSegments } from "@/pipeline/segmentCode";
import type { CodeFacts } from "@/types/facts";

describe("buildCodeSegments", () => {
  it("collapses small multi-symbol files into one composite semantic segment", () => {
    const facts: CodeFacts = {
      kind: "code",
      fileRelPath: "src/example.ts",
      language: "typescript",
      imports: [
        {
          raw: "path",
          range: { startLine: 1, startCol: 1, endLine: 1, endCol: 24 },
          kind: "static",
        },
      ],
      astNodes: [
        {
          kind: "class",
          name: "Box",
          qname: "Box",
          range: { startLine: 3, startCol: 1, endLine: 7, endCol: 2 },
        },
        {
          kind: "method",
          name: "run",
          qname: "Box.run",
          parentName: "Box",
          range: { startLine: 4, startCol: 3, endLine: 6, endCol: 4 },
        },
        {
          kind: "function",
          name: "helper",
          qname: "helper",
          range: { startLine: 9, startCol: 1, endLine: 11, endCol: 2 },
        },
      ],
      callSites: [
        {
          calleeText: "helper",
          range: { startLine: 5, startCol: 12, endLine: 5, endCol: 18 },
          enclosingSymbolQname: "Box.run",
        },
      ],
      parseStatus: "parsed",
      parser: "tree-sitter",
      parseErrors: 0,
    };

    const text = [
      'import path from "path";',
      "",
      "export class Box {",
      "  run() {",
      "    return helper();",
      "  }",
      "}",
      "",
      "export function helper() {",
      '  return path.basename("a/b");',
      "}",
    ].join("\n");

    const segments = buildCodeSegments({ facts, text });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.unitKind).toBe("composite-unit");
    expect(segments[0]?.label).toBe("Box + helper");
    expect(segments[0]?.segmentReason).toBe("small-file-composite");
    expect(segments[0]?.symbolNames).toContain("Box");
    expect(segments[0]?.symbolNames).toContain("helper");
    expect(segments[0]?.topLevelSymbols).toEqual(["Box", "helper"]);
    expect(segments[0]?.keywords).toContain("Box");
    expect(segments[0]?.keywords).toContain("helper");
    expect(segments[0]?.summaryCandidate).toContain("composite-unit");
    expect((segments[0]?.tokenEstimate ?? 0)).toBeGreaterThan(0);
    expect((segments[0]?.charCount ?? 0)).toBeGreaterThan(0);
    expect(segments[0]?.text).toContain('import path from "path";');
  });

  it("keeps large standalone regions separate while grouping smaller neighbors", () => {
    const facts: CodeFacts = {
      kind: "code",
      fileRelPath: "src/large.ts",
      language: "typescript",
      imports: [],
      astNodes: [
        {
          kind: "class",
          name: "LargeBox",
          qname: "LargeBox",
          range: { startLine: 1, startCol: 1, endLine: 80, endCol: 2 },
        },
        {
          kind: "function",
          name: "helperA",
          qname: "helperA",
          range: { startLine: 82, startCol: 1, endLine: 86, endCol: 2 },
        },
        {
          kind: "function",
          name: "helperB",
          qname: "helperB",
          range: { startLine: 88, startCol: 1, endLine: 92, endCol: 2 },
        },
      ],
      callSites: [],
      parseStatus: "parsed",
      parser: "tree-sitter",
      parseErrors: 0,
    };

    const text = [
      ...Array.from({ length: 80 }, (_, index) =>
        index === 0 ? "export class LargeBox {" : index === 79 ? "}" : `  line${index}();`,
      ),
      "",
      "export function helperA() {",
      "  return 1;",
      "}",
      "",
      "export function helperB() {",
      "  return 2;",
      "}",
      "",
    ].join("\n");

    const segments = buildCodeSegments({ facts, text });

    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.unitKind)).toEqual(["class-unit", "composite-unit"]);
    expect(segments[0]?.label).toBe("LargeBox");
    expect(segments[1]?.label).toBe("helperA + helperB");
    expect(segments[0]?.segmentReason).toBe("standalone-region");
    expect(segments[1]?.segmentReason).toBe("grouped-top-level");
    expect(segments[1]?.topLevelSymbols).toEqual(["helperA", "helperB"]);
  });

  it("falls back to a module segment when there are no ranged top-level symbols", () => {
    const facts: CodeFacts = {
      kind: "code",
      fileRelPath: "src/plain.js",
      language: "javascript",
      imports: [],
      astNodes: [],
      callSites: [],
      parseStatus: "failed",
      parser: null,
      parseErrors: 1,
    };

    const text = 'console.log("hello");';
    const segments = buildCodeSegments({ facts, text });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.unitKind).toBe("module-unit");
    expect(segments[0]?.label).toBe("module-body");
  });
});
