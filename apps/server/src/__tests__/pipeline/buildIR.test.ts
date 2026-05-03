import fs from "fs/promises";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseAndExtract } from "@/pipeline/parseExtract";
import { buildIR } from "@/pipeline/ir";
import { scanRepo } from "@/pipeline/scan";
import { extractTextFacts } from "@/pipeline/textExtract";
import { repoNodeId, textFileNodeId } from "@/pipeline/id";

const fixturesDir = path.join(process.cwd(), "src/__tests__/fixtures");
const tempDir = path.join(fixturesDir, "temp-build-ir");

describe("buildIR", () => {
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, "src", "base.ts"),
      [
        "export class Base {",
        "  greet(): string {",
        '    return "base";',
        "  }",
        "}",
      ].join("\n"),
      "utf-8",
    );

    await fs.writeFile(
      path.join(tempDir, "src", "child.ts"),
      [
        'import { Base } from "./base";',
        "",
        "export class Child extends Base {",
        "  greet(): string {",
        '    return "child";',
        "  }",
        "}",
      ].join("\n"),
      "utf-8",
    );

    const readmeLines = [
      "# Graph Test",
      "",
      "This document references [child](src/child.ts).",
      "",
      "`Child` extends `Base` and overrides `greet`.",
    ];
    for (let index = 0; index < 30; index++) {
      readmeLines.push(`Line ${index + 1}: \`Child\` and \`Base\` stay linked.`);
    }
    await fs.writeFile(path.join(tempDir, "README.md"), readmeLines.join("\n"), "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("emits the new repo/file/ast/text graph shape", async () => {
    const scan = await scanRepo(tempDir);
    const codeFiles = scan.entries.filter((entry) => entry.kind === "code");
    const textFiles = scan.entries.filter((entry) => entry.kind === "text");
    const codeFacts = await parseAndExtract(codeFiles);
    const textFacts = await extractTextFacts(textFiles);
    const ir = await buildIR(scan, { ...codeFacts, ...textFacts });

    const repoRoots = ir.nodes.filter((node) => node.label === "Repo");
    const astNodes = ir.nodes.filter((node) => node.label === "AstNode");
    const textChunks = ir.nodes.filter((node) => node.label === "TextChunk");
    const readmeFileNodeId = textFileNodeId(ir.repoId, "README.md");
    const rootNodeId = repoNodeId(tempDir);

    expect(repoRoots).toHaveLength(1);
    expect(astNodes.length).toBeGreaterThanOrEqual(2);
    expect(textChunks.length).toBeGreaterThanOrEqual(2);
    expect(
      ir.edges.some(
        (edge) =>
          edge.type === "CONTAINS" &&
          edge.from === rootNodeId &&
          edge.to === readmeFileNodeId,
      ),
    ).toBe(true);

    const readmeChunks = textChunks
      .filter((node) => node.props.filePath === "README.md")
      .sort((a, b) => Number(a.props.chunkIndex) - Number(b.props.chunkIndex));
    expect(readmeChunks.length).toBeGreaterThanOrEqual(2);

    for (const chunk of readmeChunks) {
      expect(
        ir.edges.some(
          (edge) =>
            edge.type === "HAS_CHUNK" &&
            edge.from === readmeFileNodeId &&
            edge.to === chunk.props.id,
        ),
      ).toBe(true);
    }

    for (let i = 1; i < readmeChunks.length; i += 1) {
      const prevChunk = readmeChunks[i - 1];
      const nextChunk = readmeChunks[i];
      if (!prevChunk || !nextChunk) continue;
      expect(
        ir.edges.some(
            (edge) =>
              edge.type === "NEXT_CHUNK" &&
              edge.from === prevChunk.props.id &&
              edge.to === nextChunk.props.id,
        ),
      ).toBe(true);
    }

    expect(ir.edges.some((edge) => edge.type === "HAS_AST")).toBe(true);
    expect(ir.edges.some((edge) => edge.type === "HAS_CHUNK")).toBe(true);
    expect(ir.edges.some((edge) => edge.type === "NEXT_CHUNK")).toBe(true);
    expect(ir.edges.some((edge) => edge.type === "REFERENCES")).toBe(true);
  });
});
