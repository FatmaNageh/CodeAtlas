import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";

import { runCypher } from "../db/cypher";

export const diagnosticsRoute = new Hono();

// Neo4j type definitions
interface Neo4jInteger {
  toNumber: () => number;
}

interface Neo4jNode {
  identity: Neo4jInteger;
  labels: string[];
  properties: Record<string, Neo4jValue>;
}

interface Neo4jRelationship {
  type: string;
  properties: Record<string, Neo4jValue>;
  start: Neo4jInteger;
  end: Neo4jInteger;
}

type Neo4jValue =
  | string
  | number
  | boolean
  | null
  | Neo4jInteger
  | Neo4jNode
  | Neo4jRelationship
  | Neo4jValue[];

export function toPlain(v: Neo4jValue): unknown {
   // Neo4j Integer objects support .toNumber()
   if (v && typeof v === "object") {
     if (typeof (v as Neo4jInteger).toNumber === "function") {
       return (v as Neo4jInteger).toNumber();
     }
     if (Array.isArray(v)) return v.map(toPlain);

     // Neo4j Node
     const node = v as Neo4jNode;
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
     const rel = v as Neo4jRelationship;
     if (rel.type && rel.properties && rel.start && rel.end) {
       return {
         type: rel.type,
         properties: Object.fromEntries(
           Object.entries(rel.properties).map(([k, val]) => [k, toPlain(val)]),
         ),
       };
     }

     // Handle plain objects
     if (!(v instanceof Array) && !(v as Neo4jNode).identity && !(v as Neo4jRelationship).type) {
       const out: Record<string, unknown> = {};
       for (const [k, val] of Object.entries(v as unknown as Record<string, Neo4jValue>)) out[k] = toPlain(val);
       return out;
     }
     
     return v;
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
  const rows = await runCypher<{ r: Neo4jNode }>(
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
  const labelCounts = await runCypher<{ labels: string[]; c: Neo4jInteger | number }>(
    `MATCH (n) WHERE n.repoId=$repoId RETURN labels(n) AS labels, count(*) AS c ORDER BY c DESC`,
    { repoId },
  );

  // 2) File node existence checks
  const codeFileSample = await runCypher<{ relPath: string; language: string }>(
    `MATCH (f:CodeFile {repoId:$repoId}) RETURN f.relPath AS relPath, f.language AS language LIMIT 10`,
    { repoId },
  );
  const textFileSample = await runCypher<{ relPath: string; textKind: string }>(
    `MATCH (t:TextFile {repoId:$repoId}) RETURN t.relPath AS relPath, t.textKind AS textKind LIMIT 10`,
    { repoId },
  );

  // 3) Relationship samples
  const importsLocal = await runCypher<{ a: string; b: string }>(
    `MATCH (a:CodeFile {repoId:$repoId})-[:REFERENCES]->(b:CodeFile {repoId:$repoId}) RETURN a.relPath AS a, b.relPath AS b LIMIT 20`,
    { repoId },
  );
  const importsExternal = await runCypher<{ f: string; m: string }>(
    `MATCH (f:TextFile {repoId:$repoId})-[:MENTIONS]->(m:ASTNode {repoId:$repoId}) RETURN f.relPath AS f, m.name AS m LIMIT 20`,
    { repoId },
  );
  const parentEdges = await runCypher<{ p: string; c: string }>(
    `MATCH (p:ASTNode {repoId:$repoId})-[:AST_CHILD]->(c:ASTNode {repoId:$repoId}) RETURN p.qname AS p, c.qname AS c LIMIT 20`,
    { repoId },
  );
  const extendsEdges = await runCypher<{ a: string; b: string; conf: number }>(
    `MATCH (a:ASTNode {repoId:$repoId})-[r:EXTENDS]->(b:ASTNode {repoId:$repoId}) RETURN a.qname AS a, coalesce(b.qname,b.name) AS b, r.confidence AS conf LIMIT 20`,
    { repoId },
  );
  const implementsEdges = await runCypher<{
    a: string;
    b: string;
    conf: number;
  }>(
    `MATCH (a:ASTNode {repoId:$repoId})-[r:OVERRIDES]->(b:ASTNode {repoId:$repoId}) RETURN a.qname AS a, coalesce(b.qname,b.name) AS b, r.confidence AS conf LIMIT 20`,
    { repoId },
  );
  const callsEdges = await runCypher<{ a: string; b: string; conf: number }>(
    `MATCH (a:ASTNode {repoId:$repoId})-[r:IMPORTS]->(b:ASTNode {repoId:$repoId}) RETURN a.qname AS a, b.qname AS b, r.confidence AS conf ORDER BY conf DESC LIMIT 20`,
    { repoId },
  );
  const docRefs = await runCypher<{ t: string; x: string; conf: number }>(
    `MATCH (t:TXTChunk {repoId:$repoId})-[r:DESCRIBES]->(x:ASTNode {repoId:$repoId}) RETURN t.fileRelPath AS t, coalesce(x.relPath,x.qname,x.name) AS x, r.confidence AS conf LIMIT 20`,
    { repoId },
  );

  // 4) Schema checks (best-effort; may require privileges)
  let constraints: unknown[] = [];
  let indexes: unknown[] = [];
  try {
    const cons = await runCypher<Record<string, Neo4jValue>>(`SHOW CONSTRAINTS`);
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
    const idx = await runCypher<Record<string, Neo4jValue>>(`SHOW INDEXES`);
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