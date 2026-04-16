import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";

import { runCypher } from "@/db/cypher";

export const diagnosticsRoute = new Hono();

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

interface Neo4jMap {
  [key: string]: Neo4jValue;
}

type Neo4jValue =
  | string
  | number
  | boolean
  | null
  | Neo4jInteger
  | Neo4jNode
  | Neo4jRelationship
  | Neo4jValue[]
  | Neo4jMap;

type PlainValue =
  | string
  | number
  | boolean
  | null
  | PlainValue[]
  | { [key: string]: PlainValue };

function isNeo4jInteger(v: Neo4jValue): v is Neo4jInteger {
  return typeof v === "object" && v !== null && "toNumber" in v && typeof v.toNumber === "function";
}

function isNeo4jNode(v: Neo4jValue): v is Neo4jNode {
  return (
    typeof v === "object" &&
    v !== null &&
    "identity" in v &&
    "labels" in v &&
    "properties" in v &&
    Array.isArray(v.labels)
  );
}

function isNeo4jRelationship(v: Neo4jValue): v is Neo4jRelationship {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    "properties" in v &&
    "start" in v &&
    "end" in v
  );
}

export function toPlain(v: Neo4jValue): PlainValue {
  if (v && typeof v === "object") {
    if (isNeo4jInteger(v)) {
      return v.toNumber();
    }

    if (Array.isArray(v)) return v.map(toPlain);

    if (isNeo4jNode(v)) {
      return {
        id: String(v.properties.id ?? ""),
        labels: v.labels,
        properties: Object.fromEntries(
          Object.entries(v.properties).map(([k, val]) => [k, toPlain(val)]),
        ),
      };
    }

    if (isNeo4jRelationship(v)) {
      return {
        type: v.type,
        properties: Object.fromEntries(
          Object.entries(v.properties).map(([k, val]) => [k, toPlain(val)]),
        ),
      };
    }

    const out: { [key: string]: PlainValue } = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = toPlain(val);
    }
    return out;
  }

  return v;
}

diagnosticsRoute.get("/tester", async (c) => {
  const filePath = path.join(process.cwd(), "src", "test-client.html");
  const html = await fs.readFile(filePath, "utf-8");
  return c.html(html);
});

diagnosticsRoute.get("/diagnostics/repos", async (c) => {
  const rows = await runCypher<{ r: Neo4jNode }>(
    `MATCH (r:Repo) RETURN r ORDER BY r.rootPath ASC LIMIT 50`,
  );
  return c.json({ ok: true, repos: rows.map((x) => toPlain(x.r)) });
});

diagnosticsRoute.get("/diagnostics/check", async (c) => {
  const repoId = c.req.query("repoId") ?? "";
  if (!repoId) return c.json({ ok: false, error: "Missing repoId" }, 400);

  const labelCounts = await runCypher<{ labels: string[]; c: Neo4jInteger | number }>(
    `MATCH (n) WHERE n.repoId = $repoId RETURN labels(n) AS labels, count(*) AS c ORDER BY c DESC`,
    { repoId },
  );

  const codeFileSample = await runCypher<{ path: string; language: string }>(
    `MATCH (f:CodeFile {repoId:$repoId}) RETURN f.path AS path, f.language AS language LIMIT 10`,
    { repoId },
  );

  const textFileSample = await runCypher<{ path: string; textType: string }>(
    `MATCH (t:TextFile {repoId:$repoId}) RETURN t.path AS path, t.textType AS textType LIMIT 10`,
    { repoId },
  );

  const referencesCodeToCode = await runCypher<{ fromPath: string; toPath: string }>(
    `MATCH (a:CodeFile {repoId:$repoId})-[:REFERENCES]->(b:CodeFile {repoId:$repoId})
     RETURN a.path AS fromPath, b.path AS toPath
     LIMIT 20`,
    { repoId },
  );

  const referencesTextToAny = await runCypher<{ fromPath: string; toId: string }>(
    `MATCH (t:TextFile {repoId:$repoId})-[:REFERENCES]->(x {repoId:$repoId})
     RETURN t.path AS fromPath, x.id AS toId
     LIMIT 20`,
    { repoId },
  );

  const chunkLinks = await runCypher<{ filePath: string; chunkIndex: number }>(
    `MATCH (t:TextFile {repoId:$repoId})-[:HAS_CHUNK]->(c:TextChunk {repoId:$repoId})
     RETURN t.path AS filePath, c.chunkIndex AS chunkIndex
     ORDER BY filePath, chunkIndex
     LIMIT 20`,
    { repoId },
  );

  const nextChunkEdges = await runCypher<{ fromIndex: number; toIndex: number }>(
    `MATCH (a:TextChunk {repoId:$repoId})-[:NEXT_CHUNK]->(b:TextChunk {repoId:$repoId})
     RETURN a.chunkIndex AS fromIndex, b.chunkIndex AS toIndex
     LIMIT 20`,
    { repoId },
  );

  const astNodes = await runCypher<{ c: Neo4jInteger | number }>(
    `MATCH (a:AstNode {repoId:$repoId}) RETURN count(a) AS c`,
    { repoId },
  );

  const astSamples = await runCypher<{ filePath: string; normalizedKind: string; name: string | null }>(
    `MATCH (a:AstNode {repoId:$repoId})
     RETURN a.filePath AS filePath, a.normalizedKind AS normalizedKind, a.name AS name
     LIMIT 20`,
    { repoId },
  );

  const astChildEdges = await runCypher<{ parentName: string | null; childName: string | null }>(
    `MATCH (p:AstNode {repoId:$repoId})-[:AST_CHILD]->(c:AstNode {repoId:$repoId})
     RETURN p.name AS parentName, c.name AS childName
     LIMIT 20`,
    { repoId },
  );

  const extendsEdges = await runCypher<{ a: string | null; b: string | null; conf: number | null }>(
    `MATCH (a:AstNode {repoId:$repoId})-[r:EXTENDS]->(b:AstNode {repoId:$repoId})
     RETURN a.name AS a, b.name AS b, r.confidence AS conf
     LIMIT 20`,
    { repoId },
  );

  const overridesEdges = await runCypher<{ a: string | null; b: string | null; conf: number | null }>(
    `MATCH (a:AstNode {repoId:$repoId})-[r:OVERRIDES]->(b:AstNode {repoId:$repoId})
     RETURN a.name AS a, b.name AS b, r.confidence AS conf
     LIMIT 20`,
    { repoId },
  );

  const importsEdges = await runCypher<{ a: string | null; b: string | null; conf: number | null }>(
    `MATCH (a:AstNode {repoId:$repoId})-[r:IMPORTS]->(b:AstNode {repoId:$repoId})
     RETURN a.name AS a, b.name AS b, r.confidence AS conf
     LIMIT 20`,
    { repoId },
  );

  const describesEdges = await runCypher<{ filePath: string; targetName: string | null; conf: number | null }>(
    `MATCH (t:TextChunk {repoId:$repoId})-[r:DESCRIBES]->(x:AstNode {repoId:$repoId})
     RETURN t.filePath AS filePath, x.name AS targetName, r.confidence AS conf
     LIMIT 20`,
    { repoId },
  );

  let constraints: PlainValue[] = [];
  let indexes: PlainValue[] = [];

  try {
    const cons = await runCypher<Record<string, Neo4jValue>>(`SHOW CONSTRAINTS`);
    constraints = cons.map(toPlain);
  } catch {
    constraints = [
      {
        warning: "SHOW CONSTRAINTS failed (insufficient privileges or older Neo4j).",
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

  const labelsFlat = labelCounts.map((x) =>
    Array.isArray(x.labels) ? x.labels.join(":") : String(x.labels),
  );

  const hasWrongLegacyLabels = labelsFlat.some(
    (s) =>
      s.includes("RepoRoot") ||
      s.includes("ASTNode") ||
      s.includes("TEXTChunk") ||
      s.includes("TXTChunk"),
  );

  const astCountRaw = astNodes?.[0]?.c ?? 0;
  const astCount =
    typeof astCountRaw === "number" ? astCountRaw : astCountRaw.toNumber();

  const summary = {
    hasRepoData: labelCounts.length > 0,
    hasCodeFiles: codeFileSample.length > 0,
    hasTextFiles: textFileSample.length > 0,
    hasCodeReferences: referencesCodeToCode.length > 0,
    hasTextReferences: referencesTextToAny.length > 0,
    hasChunks: chunkLinks.length > 0,
    astNodeCount: astCount,
    hasLegacyWrongLabels: hasWrongLegacyLabels,
  };

  return c.json({
    ok: true,
    repoId,
    summary: toPlain(summary),
    labelCounts: toPlain(labelCounts),
    samples: {
      codeFiles: toPlain(codeFileSample),
      textFiles: toPlain(textFileSample),
      referencesCodeToCode: toPlain(referencesCodeToCode),
      referencesTextToAny: toPlain(referencesTextToAny),
      chunkLinks: toPlain(chunkLinks),
      nextChunkEdges: toPlain(nextChunkEdges),
      astSamples: toPlain(astSamples),
      astChildEdges: toPlain(astChildEdges),
      extendsEdges: toPlain(extendsEdges),
      overridesEdges: toPlain(overridesEdges),
      importsEdges: toPlain(importsEdges),
      describesEdges: toPlain(describesEdges),
    },
    schema: { constraints, indexes },
  });
});
