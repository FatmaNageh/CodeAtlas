import { describe, expect, it } from "vitest";

import { rankChunkForGraphRag, type SimilarASTNodeRow } from "@/retrieval/vector";

function makeChunk(overrides: Partial<SimilarASTNodeRow>): SimilarASTNodeRow {
  return {
    id: "ast:processPayment",
    score: 0.7,
    filePath: "src/example.ts",
    chunkText: "function processPayment() { return authorizeCard(); }",
    symbol: "processPayment",
    unitKind: "function-unit",
    summaryCandidate: "Handles payment authorization flow.",
    segmentReason: "standalone-region",
    keywords: ["payment", "authorization"],
    topLevelSymbols: ["processPayment"],
    tokenCount: 32,
    startLine: 1,
    endLine: 5,
    sourceKind: "ast",
    ...overrides,
  };
}

describe("rankChunkForGraphRag", () => {
  it("boosts AST chunks whose metadata matches the query", () => {
    const matchingChunk = makeChunk({});
    const nonMatchingChunk = makeChunk({
      symbol: "formatDate",
      summaryCandidate: "Formats date strings for display.",
      keywords: ["date", "formatting"],
      topLevelSymbols: ["formatDate"],
      chunkText: "function formatDate() { return format(value); }",
    });

    const queryTokens = ["payment", "authorization"];

    expect(rankChunkForGraphRag(matchingChunk, queryTokens)).toBeGreaterThan(
      rankChunkForGraphRag(nonMatchingChunk, queryTokens),
    );
  });

  it("falls back to vector score when query tokens are empty", () => {
    const chunk = makeChunk({ score: 0.42 });

    expect(rankChunkForGraphRag(chunk, [])).toBe(0.42);
  });
});
