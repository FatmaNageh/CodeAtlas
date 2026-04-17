import { describe, expect, it } from "vitest";

import { parseAndExtract } from "@/pipeline/parseExtract";
import { buildIR } from "@/pipeline/ir";
import { scanRepo } from "@/pipeline/scan";
import type { CodeFacts } from "@/types/facts";
import { languageFixtures, languageFixturesDir } from "./languageFixtures";

describe("language support", () => {
  it("classifies all 13 languages during scan", async () => {
    const result = await scanRepo(languageFixturesDir);
    const actual = new Map(
      result.entries
        .filter((entry): entry is Extract<typeof result.entries[number], { kind: "code" }> => entry.kind === "code")
        .map((entry) => [entry.relPath, entry.language] as const),
    );

    expect(actual.size).toBe(languageFixtures.length);
    for (const fixture of languageFixtures) {
      expect(actual.get(fixture.relPath)).toBe(fixture.language);
    }
  });

  it("extracts expected imports, symbols, and calls for all language fixtures", async () => {
    const scan = await scanRepo(languageFixturesDir);
    const codeEntries = scan.entries.filter(
      (entry): entry is Extract<typeof scan.entries[number], { kind: "code" }> => entry.kind === "code",
    );
    const facts = await parseAndExtract(codeEntries);

    for (const fixture of languageFixtures) {
      const fact = facts[fixture.relPath];
      expect(fact).toBeDefined();
      expect(fact?.kind).toBe("code");
      if (fact?.kind !== "code") {
        continue;
      }

      const codeFact = fact as CodeFacts;
      const symbolNames = new Set(
        codeFact.astNodes.flatMap((node) => [node.name, node.qname].filter((value): value is string => Boolean(value))),
      );
      const importValues = new Set(codeFact.imports.map((item) => item.raw));
      const callValues = new Set(codeFact.callSites.map((callSite) => callSite.calleeText));

      expect(codeFact.fileRelPath).toBe(fixture.relPath);
      expect(codeFact.language).toBe(fixture.language);
      expect(codeFact.astNodes.length).toBeGreaterThan(0);

      for (const requiredSymbol of fixture.requiredSymbols) {
        expect(symbolNames.has(requiredSymbol)).toBe(true);
      }

      for (const requiredImport of fixture.requiredImports ?? []) {
        expect(importValues.has(requiredImport)).toBe(true);
      }

      for (const requiredCall of fixture.requiredCalls ?? []) {
        expect(callValues.has(requiredCall)).toBe(true);
      }

      for (const expectedKind of fixture.requiredKinds ?? []) {
        expect(
          codeFact.astNodes.some(
            (node) => node.name === expectedKind.name && node.kind === expectedKind.kind,
          ),
        ).toBe(true);
      }
    }
  });

  it("does not duplicate TypeScript symbols when compiler and tree-sitter extraction overlap", async () => {
    const scan = await scanRepo(languageFixturesDir);
    const codeEntries = scan.entries.filter(
      (entry): entry is Extract<typeof scan.entries[number], { kind: "code" }> => entry.kind === "code",
    );
    const facts = await parseAndExtract(codeEntries, { disableParallel: true });

    const fact = facts["typescript/main.ts"];
    expect(fact).toBeDefined();
    expect(fact?.kind).toBe("code");
    if (fact?.kind !== "code") return;

    const symbolKeys = fact.astNodes.map((node) => `${node.kind}:${node.qname ?? node.name}`);
    expect(new Set(symbolKeys).size).toBe(symbolKeys.length);
  });

  it("emits a root and recovered child ast segment for every supported language when parsing fails", async () => {
    const scan = await scanRepo(languageFixturesDir);
    const codeEntries = scan.entries.filter(
      (entry): entry is Extract<typeof scan.entries[number], { kind: "code" }> => entry.kind === "code",
    );

    const failedFacts = Object.fromEntries(
      codeEntries.map((entry) => [
        entry.relPath,
        {
          kind: "code",
          fileRelPath: entry.relPath,
          language: entry.language,
          imports: [],
          astNodes: [],
          callSites: [],
          parseStatus: "failed" as const,
          parser: null,
          parseErrors: 1,
        } satisfies CodeFacts,
      ]),
    );

    const ir = await buildIR(scan, failedFacts);

    for (const fixture of languageFixtures) {
      const fileAstNodes = ir.nodes.filter(
        (node) =>
          node.label === "AstNode" &&
          node.props.filePath === fixture.relPath,
      );

      const rootNode = fileAstNodes.find(
        (node) => node.label === "AstNode" && node.props.segmentReason === "file-root",
      );
      const recoveredSegment = fileAstNodes.find(
        (node) => node.label === "AstNode" && node.props.segmentReason === "fallback-module",
      );

      expect(rootNode?.label).toBe("AstNode");
      expect(recoveredSegment?.label).toBe("AstNode");

      if (!rootNode || rootNode.label !== "AstNode") {
        throw new Error(`Expected file-root AstNode for ${fixture.relPath}`);
      }
      if (!recoveredSegment || recoveredSegment.label !== "AstNode") {
        throw new Error(`Expected recovered AstNode for ${fixture.relPath}`);
      }

      expect(recoveredSegment.props.extractionMethod).toBe("recovered");
      expect(recoveredSegment.props.text).toBeTruthy();
      expect(
        ir.edges.some(
          (edge) =>
            edge.type === "HAS_AST_ROOT" &&
            edge.to === rootNode.props.id,
        ),
      ).toBe(true);
      expect(
        ir.edges.some(
          (edge) =>
            edge.type === "AST_CHILD" &&
            edge.from === rootNode.props.id &&
            edge.to === recoveredSegment.props.id,
        ),
      ).toBe(true);
    }
  });
});
