import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";

import { runCypher } from "../db/cypher";

export const diagnosticsRoute = new Hono();

function toPlain(v: any): any {
  // Neo4j Integer objects support .toNumber()
  if (v && typeof v === "object") {
    if (typeof (v as any).toNumber === "function") return (v as any).toNumber();
    if (Array.isArray(v)) return v.map(toPlain);

    // Neo4j Node
    if ((v as any).identity && (v as any).labels && (v as any).properties) {
      return {
        id: String((v as any).properties?.id ?? ""),
        labels: (v as any).labels,
        properties: Object.fromEntries(Object.entries((v as any).properties).map(([k, val]) => [k, toPlain(val)])),
      };
    }

    // Neo4j Relationship
    if ((v as any).type && (v as any).properties && (v as any).start && (v as any).end) {
      return {
        type: (v as any).type,
        properties: Object.fromEntries(Object.entries((v as any).properties).map(([k, val]) => [k, toPlain(val)])),
      };
    }

    const out: Record<string, any> = {};
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
  const rows = await runCypher<{ r: any }>(
    `MATCH (r:Repo) RETURN r ORDER BY r.rootPath ASC LIMIT 50`,
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
  const labelCounts = await runCypher<{ labels: any; c: any }>(
    `MATCH (n) WHERE n.repoId=$repoId RETURN labels(n) AS labels, count(*) AS c ORDER BY c DESC`,
    { repoId },
  );

  // 2) File node existence checks
  const codeFileSample = await runCypher<{ relPath: any; language: any }>(
    `MATCH (f:CodeFile {repoId:$repoId}) RETURN f.relPath AS relPath, f.language AS language LIMIT 10`,
    { repoId },
  );
  const textFileSample = await runCypher<{ relPath: any; textKind: any }>(
    `MATCH (t:TextFile {repoId:$repoId}) RETURN t.relPath AS relPath, t.textKind AS textKind LIMIT 10`,
    { repoId },
  );

  // 3) Relationship samples
  const importsLocal = await runCypher<{ a: any; b: any }>(
    `MATCH (a:CodeFile {repoId:$repoId})-[:IMPORTS]->(b:CodeFile {repoId:$repoId}) RETURN a.relPath AS a, b.relPath AS b LIMIT 20`,
    { repoId },
  );
  const importsExternal = await runCypher<{ f: any; m: any }>(
    `MATCH (f:CodeFile {repoId:$repoId})-[:IMPORTS_EXTERNAL]->(m:ExternalModule {repoId:$repoId}) RETURN f.relPath AS f, m.name AS m LIMIT 20`,
    { repoId },
  );
  const parentEdges = await runCypher<{ p: any; c: any }>(
    `MATCH (p:Symbol {repoId:$repoId})-[:PARENT]->(c:Symbol {repoId:$repoId}) RETURN p.qname AS p, c.qname AS c LIMIT 20`,
    { repoId },
  );
  const extendsEdges = await runCypher<{ a: any; b: any; conf: any }>(
    `MATCH (a:Symbol {repoId:$repoId})-[r:EXTENDS]->(b) RETURN a.qname AS a, coalesce(b.qname,b.name) AS b, r.confidence AS conf LIMIT 20`,
    { repoId },
  );
  const implementsEdges = await runCypher<{ a: any; b: any; conf: any }>(
    `MATCH (a:Symbol {repoId:$repoId})-[r:IMPLEMENTS]->(b) RETURN a.qname AS a, coalesce(b.qname,b.name) AS b, r.confidence AS conf LIMIT 20`,
    { repoId },
  );
  const callsEdges = await runCypher<{ a: any; b: any; conf: any }>(
    `MATCH (a:Symbol {repoId:$repoId})-[r:CALLS]->(b:Symbol {repoId:$repoId}) RETURN a.qname AS a, b.qname AS b, r.confidence AS conf ORDER BY conf DESC LIMIT 20`,
    { repoId },
  );
  const docRefs = await runCypher<{ t: any; x: any; conf: any }>(
    `MATCH (t:TextFile {repoId:$repoId})-[r:REFERENCES]->(x) RETURN t.relPath AS t, coalesce(x.relPath,x.qname,x.name) AS x, r.confidence AS conf LIMIT 20`,
    { repoId },
  );

  // 4) Schema checks (best-effort; may require privileges)
  let constraints: any[] = [];
  let indexes: any[] = [];
  try {
    const cons = await runCypher<any>(`SHOW CONSTRAINTS`);
    constraints = cons.map(toPlain);
  } catch {
    constraints = [{ warning: "SHOW CONSTRAINTS failed (insufficient privileges or older Neo4j)." }];
  }
  try {
    const idx = await runCypher<any>(`SHOW INDEXES`);
    indexes = idx.map(toPlain);
  } catch {
    indexes = [{ warning: "SHOW INDEXES failed (insufficient privileges or older Neo4j)." }];
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
    hasSymbols: (await runCypher<{ c: any }>(`MATCH (s:Symbol {repoId:$repoId}) RETURN count(s) AS c`, { repoId }))?.[0]?.c ?? 0,
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
