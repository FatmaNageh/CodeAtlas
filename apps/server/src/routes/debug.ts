import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import { repoRoots } from "../state/repoRoots";
import { runCypher } from "../db/cypher";
import { int as neoInt } from "neo4j-driver";

export const debugRoute = new Hono();

// Simple in-memory map (repoId -> repoRoot) filled by indexRepo handler
// We'll add this in Step 2 below.

debugRoute.get("/debug/ir", async (c) => {
  const repoId = c.req.query("repoId");
  if (!repoId) return c.json({ ok: false, error: "Missing repoId" }, 400);

  const repoRoot = repoRoots.get(repoId);
  if (!repoRoot) return c.json({ ok: false, error: "Unknown repoId (index first)" }, 404);

  const irPath = path.join(repoRoot, ".codeatlas", "debug", repoId, "ir.json");

  try {
    const raw = await fs.readFile(irPath, "utf8");
    return c.json(JSON.parse(raw));
  } catch (e: any) {
    return c.json(
      { ok: false, error: "Failed to read ir.json", irPath, message: String(e?.message ?? e) },
      500
    );
  }
});

// -----------------------------
// Neo4j subgraph (nodes + edges)
// -----------------------------

function toPlain(v: any): any {
  if (v && typeof v === "object") {
    // neo4j Integer
    if (typeof (v as any).toNumber === "function") return (v as any).toNumber();
    if (Array.isArray(v)) return v.map(toPlain);

    // neo4j Node
    if ((v as any).identity && (v as any).labels && (v as any).properties) {
      const props = (v as any).properties ?? {};
      const plainProps: Record<string, any> = {};
      for (const [k, val] of Object.entries(props)) plainProps[k] = toPlain(val);
      return {
        id: String((props as any).id ?? ""),
        labels: (v as any).labels as string[],
        properties: plainProps,
      };
    }

    // neo4j Relationship
    if ((v as any).identity && (v as any).type && (v as any).properties) {
      const props = (v as any).properties ?? {};
      const plainProps: Record<string, any> = {};
      for (const [k, val] of Object.entries(props)) plainProps[k] = toPlain(val);
      return {
        id: String((props as any).id ?? ""),
        type: String((v as any).type),
        properties: plainProps,
      };
    }

    // plain object
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) out[k] = toPlain(val);
    return out;
  }
  return v;
}

debugRoute.get("/debug/subgraph", async (c) => {
  const repoId = c.req.query("repoId");
  const limitRaw = c.req.query("limit") ?? "500";
  const limitNum = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(limitNum) && limitNum >= 0 ? limitNum : 500;
  if (!repoId) return c.json({ ok: false, error: "Missing repoId" }, 400);

  try {
    const rows = await runCypher<{ a: any; r: any; b: any }>(
      `
      MATCH (a)-[r]->(b)
      WHERE a.repoId = $repoId
      RETURN a, r, b
      LIMIT $limit
      `,
      { repoId, limit: neoInt(limit) },
    );

    const nodesById = new Map<string, any>();
    const edges: any[] = [];

    for (const row of rows) {
      const a = toPlain(row.a);
      const b = toPlain(row.b);
      const r = toPlain(row.r);

      if (a?.id) nodesById.set(String(a.id), a);
      if (b?.id) nodesById.set(String(b.id), b);

      // We already have a and b ids; use those.
      const from = String(a?.id ?? "");
      const to = String(b?.id ?? "");

      edges.push({
        id: r?.id || `${r?.type ?? "REL"}:${from}:${to}`,
        type: r?.type ?? "REL",
        from,
        to,
        properties: r?.properties ?? {},
      });
    }

    return c.json({
      ok: true,
      repoId,
      nodes: Array.from(nodesById.values()),
      edges,
    });
  } catch (e: any) {
    return c.json({ ok: false, error: "Failed to fetch subgraph", message: String(e?.message ?? e) }, 500);
  }
});
