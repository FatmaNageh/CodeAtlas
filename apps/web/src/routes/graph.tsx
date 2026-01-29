import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { NodeDetailPanel } from "@/components/NodeDetailPanel";
import { Neo4jGraph, type Neo4jNode, type Neo4jEdge } from "@/components/Neo4jGraph";
import { Neo4jNodeDetailPanel } from "@/components/Neo4jNodeDetailPanel";
import { irToFileTree, parseIrJson, type CodeNode } from "@/lib/ir";
import { fetchIr, fetchNeo4jSubgraph } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/graph")({
  component: GraphViewer,
});

function GraphViewer() {
  const sess = loadSession();
  const [baseUrl, setBaseUrl] = useState(sess.baseUrl ?? "");
  const [repoId, setRepoId] = useState(sess.lastRepoId ?? "");
  const [mode, setMode] = useState<"ir" | "neo4j">("neo4j");
  const [neoLimit, setNeoLimit] = useState(600);
  const [raw, setRaw] = useState("");
  const [tree, setTree] = useState<CodeNode | null>(null);
  const [selected, setSelected] = useState<CodeNode | null>(null);
  const [neo, setNeo] = useState<{ nodes: Neo4jNode[]; edges: Neo4jEdge[] } | null>(null);
  const [selectedNeo, setSelectedNeo] = useState<Neo4jNode | null>(null);

  const loadFromBackend = async () => {
    if (!repoId.trim()) {
      toast.error("Missing repoId");
      return;
    }
    try {
      const rid = repoId.trim();
      saveSession({ baseUrl, lastRepoId: rid });

      if (mode === "ir") {
        const ir = await fetchIr(rid, baseUrl);
        const t = irToFileTree(ir);
        setTree(t);
        setNeo(null);
        setSelected(null);
        setSelectedNeo(null);
        toast.success("Loaded IR from backend");
      } else {
        const sg = await fetchNeo4jSubgraph(rid, baseUrl, Math.max(0, Math.floor(Number(neoLimit) || 0)));
        setNeo({ nodes: sg.nodes ?? [], edges: sg.edges ?? [] });
        setTree(null);
        setSelected(null);
        setSelectedNeo(null);
        toast.success("Loaded Neo4j subgraph");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load IR");
    }
  };

  const load = () => {
    try {
      const ir = parseIrJson(raw);
      const t = irToFileTree(ir);
      setTree(t);
      toast.success("Built graph from IR");
    } catch (e: any) {
      toast.error(e?.message ?? "Invalid JSON");
    }
  };

  const title = useMemo(() => {
    if (mode === "neo4j") {
      return neo ? "Neo4j Graph (relationships from database)" : "Load Neo4j graph";
    }
    return tree ? "Repo Tree Graph (CONTAINS edges)" : "Load IR to view graph";
  }, [tree, mode, neo]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Backend base URL</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="(optional) http://127.0.0.1:3000"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">RepoId</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="repoId from last indexRepo run"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Neo4j limit</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                type="number"
                min={0}
                step={1}
                value={neoLimit}
                onChange={(e) => setNeoLimit(Number.parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={mode === "ir" ? "default" : "outline"}
              onClick={() => {
                setMode("ir");
                setNeo(null);
                setSelectedNeo(null);
              }}
            >
              IR Tree
            </Button>
            <Button
              variant={mode === "neo4j" ? "default" : "outline"}
              onClick={() => {
                setMode("neo4j");
                setTree(null);
                setSelected(null);
              }}
            >
              Neo4j Graph
            </Button>
            <Button onClick={loadFromBackend} disabled={!repoId.trim()}>
              {mode === "neo4j" ? "Load Neo4j graph" : "Load IR from backend"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTree(null);
                setNeo(null);
                setSelected(null);
                setSelectedNeo(null);
              }}
            >
              Clear
            </Button>
          </div>

          <details className="mt-2">
            <summary className="text-sm text-muted-foreground cursor-pointer">Advanced: paste IR JSON manually</summary>
            <textarea
              className="w-full min-h-[160px] p-3 rounded border bg-background font-mono text-xs mt-2"
              placeholder="Paste IR JSON here..."
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <Button onClick={load} disabled={!raw.trim()} className="mt-2">
              Render graph from pasted JSON
            </Button>
          </details>
        </CardContent>
      </Card>

      {mode === "ir" && tree && (
        <div className="relative w-full h-[70vh] rounded border overflow-hidden">
          <KnowledgeGraph
            data={tree as any}
            onNodeClick={(n: any) => setSelected(n)}
            selectedNodePath={selected?.path ?? null}
          />
          <NodeDetailPanel node={selected as any} onClose={() => setSelected(null)} />
        </div>
      )}

      {mode === "neo4j" && neo && (
        <div className="relative w-full h-[70vh] rounded border overflow-hidden">
          <Neo4jGraph nodes={neo.nodes} edges={neo.edges} onNodeClick={(n) => setSelectedNeo(n)} />
          <Neo4jNodeDetailPanel node={selectedNeo} edges={neo.edges} onClose={() => setSelectedNeo(null)} />
        </div>
      )}
    </div>
  );
}
