import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";

import { runCypher } from "../db/cypher";

export const diagnosticsRoute = new Hono();

export function toPlain(v: unknown): unknown {
  // Neo4j Integer objects support .toNumber()
  if (v && typeof v === "object") {
    if (typeof (v as { toNumber?: () => number }).toNumber === "function") {
      return (v as { toNumber: () => number }).toNumber();
    }
    if (Array.isArray(v)) return v.map(toPlain);

    // Neo4j Node
    const node = v as {
      identity?: unknown;
      labels?: string[];
      properties?: Record<string, unknown>;
    };
    if (node.identity && node.labels && node.properties) {
      return {
        id: String(node.properties?.id ?? ""),
        labels: node.labels,
        properties: Object.fromEntries(
          Object.entries(node.properties).map(([k, val]) => [k, toPlain(val)]),
        ),
      };
    }

    // Neo4j Relationship
    const rel = v as {
      type?: string;
      properties?: Record<string, unknown>;
      start?: unknown;
      end?: unknown;
    };
    if (rel.type && rel.properties && rel.start && rel.end) {
      return {
        type: rel.type,
        properties: Object.fromEntries(
          Object.entries(rel.properties).map(([k, val]) => [k, toPlain(val)]),
        ),
      };
    }

    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = toPlain(val);
    return out;
  }
  return v;
}

/**
 * Serve a single HTML tester page from src/test-client.html.
 * (We keep the filename for simplicity; it becomes the "Tester" UI.)
 */
diagnosticsRoute.get("/tester", async (c) => {
  const filePath = path.join(process.cwd(), "src", "test-client.html");
  const html = await fs.readFile(filePath, "utf-8");
  return c.html(html);
});

/**
 * List repos that exist in Neo4j.
 */
diagnosticsRoute.get("/diagnostics/repos", async (c) => {
  const rows = await runCypher<{ r: unknown }>(
    `MATCH (r:RepoRoot) RETURN r ORDER BY r.rootPath ASC LIMIT 50`,
  );
  return c.json({ ok: true, repos: rows.map((x) => toPlain(x.r)) });
});

/**
 * Run a full suite of sanity checks for a given repoId.
 */
diagnosticsRoute.get("/diagnostics/check", async (c) => {
  const repoId = c.req.query("repoId") ?? "";
  if (!repoId) return c.json({ ok: false, error: "Missing repoId" }, 400);

  // 1) Labels inventory
  const labelCounts = await runCypher<{ labels: unknown; c: unknown }>(
    `MATCH (n) WHERE n.repoId=$repoId RETURN labels(n) AS labels, count(*) AS c ORDER BY c DESC`,
    { repoId },
  );

  // 2) File node existence checks
  const codeFileSample = await runCypher<{ relPath: unknown; language: unknown }>(
    `MATCH (f:CodeFile {repoId:$repoId}) RETURN f.relPath AS relPath, f.language AS language LIMIT 10`,
    { repoId },
  );
  const textFileSample = await runCypher<{ relPath: unknown; textKind: unknown }>(
    `MATCH (t:TextFile {repoId:$repoId}) RETURN t.relPath AS relPath, t.textKind AS textKind LIMIT 10`,
    { repoId },
  );

  // 3) Relationship samples
  const importsLocal = await runCypher<{ a: unknown; b: unknown }>(
    `MATCH (a:CodeFile {repoId:$repoId})-[:REFERENCES]->(b:CodeFile {repoId:$repoId}) RETURN a.relPath AS a, b.relPath AS b LIMIT 20`,
    { repoId },
  );
  const importsExternal = await runCypher<{ f: unknown; m: unknown }>(
    `MATCH (f:TextFile {repoId:$repoId})-[:MENTIONS]->(m:ASTNode {repoId:$repoId}) RETURN f.relPath AS f, m.name AS m LIMIT 20`,
    { repoId },
  );
  const parentEdges = await runCypher<{ p: unknown; c: unknown }>(
    `MATCH (p:ASTNode {repoId:$repoId})-[:AST_CHILD]->(c:ASTNode {repoId:$repoId}) RETURN p.qname AS p, c.qname AS c LIMIT 20`,
    { repoId },
  );
  const extendsEdges = await runCypher<{ a: unknown; b: unknown; conf: unknown }>(
    `MATCH (a:ASTNode {repoId:$repoId})-[r:EXTENDS]->(b:ASTNode {repoId:$repoId}) RETURN a.qname AS a, coalesce(b.qname,b.name) AS b, r.confidence AS conf LIMIT 20`,
    { repoId },
  );
  const implementsEdges = await runCypher<{
    a: unknown;
    b: unknown;
    conf: unknown;
  }>(
    `MATCH (a:ASTNode {repoId:$repoId})-[r:OVERRIDES]->(b:ASTNode {repoId:$repoId}) RETURN a.qname AS a, coalesce(b.qname,b.name) AS b, r.confidence AS conf LIMIT 20`,
    { repoId },
  );
  const callsEdges = await runCypher<{ a: unknown; b: unknown; conf: unknown }>(
    `MATCH (a:ASTNode {repoId:$repoId})-[r:IMPORTS]->(b:ASTNode {repoId:$repoId}) RETURN a.qname AS a, b.qname AS b, r.confidence AS conf ORDER BY conf DESC LIMIT 20`,
    { repoId },
  );
  const docRefs = await runCypher<{ t: unknown; x: unknown; conf: unknown }>(
    `MATCH (t:TXTChunk {repoId:$repoId})-[r:DESCRIBES]->(x:ASTNode {repoId:$repoId}) RETURN t.fileRelPath AS t, coalesce(x.relPath,x.qname,x.name) AS x, r.confidence AS conf LIMIT 20`,
    { repoId },
  );

  // 4) Schema checks (best-effort; may require privileges)
  let constraints: unknown[] = [];
  let indexes: unknown[] = [];
  try {
    const cons = await runCypher<Record<string, unknown>>(`SHOW CONSTRAINTS`);
    constraints = cons.map(toPlain);
  } catch {
    constraints = [
      {
        warning:
          "SHOW CONSTRAINTS failed (insufficient privileges or older Neo4j).",
      },
    ];
  }
  try {
    const idx = await runCypher<Record<string, unknown>>(`SHOW INDEXES`);
    indexes = idx.map(toPlain);
  } catch {
    indexes = [
      {
        warning: "SHOW INDEXES failed (insufficient privileges or older Neo4j).",
      },
    ];
  }

  // Pass/Fail summary
  const labelsFlat = labelCounts.map((x) => (Array.isArray(x.labels) ? x.labels.join(":") : String(x.labels)));
  const hasOldFileLabel = labelsFlat.some((s) => s.includes("File") && !s.includes("CodeFile") && !s.includes("TextFile"));

  const summary = {
    hasRepoData: labelCounts.length > 0,
    hasCodeFiles: codeFileSample.length > 0,
    hasTextFiles: textFileSample.length > 0,
    hasLocalImports: importsLocal.length > 0,
    hasExternalImports: importsExternal.length > 0,
    hasSymbols:
      (
        await runCypher<{ c: unknown }>(
          `MATCH (s:ASTNode {repoId:$repoId}) RETURN count(s) AS c`,
          { repoId },
        )
      )?.[0]?.c ?? 0,
    hasOldFileLabel: !!hasOldFileLabel,
  };

  return c.json({
    ok: true,
    repoId,
    summary: toPlain(summary),
    labelCounts: toPlain(labelCounts),
    samples: {
      codeFiles: toPlain(codeFileSample),
      textFiles: toPlain(textFileSample),
      importsLocal: toPlain(importsLocal),
      importsExternal: toPlain(importsExternal),
      parentEdges: toPlain(parentEdges),
      extendsEdges: toPlain(extendsEdges),
      implementsEdges: toPlain(implementsEdges),
      callsEdges: toPlain(callsEdges),
      docRefs: toPlain(docRefs),
    },
    schema: { constraints, indexes },
  });
});
