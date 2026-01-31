// LegendDot component for node color legend
function LegendDot({ color, label }: { color: string, label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-block',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: color,
        border: '2px solid #fff',
        marginRight: 2,
        boxShadow: '0 1px 4px #0006',
      }} />
      <span style={{ fontSize: 15, color: '#f3f4f6', fontWeight: 500 }}>{label}</span>
    </span>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useLayoutEffect } from "react";
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
    const [controlsCollapsed, setControlsCollapsed] = useState(false);
  // ...existing code...

  // Controls bar height logic
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
  const controlsRef = useRef<HTMLDivElement>(null);
  const [controlsHeight, setControlsHeight] = useState(180);
  useLayoutEffect(() => {
    if (controlsRef.current) {
      setControlsHeight(controlsRef.current.offsetHeight);
    }
  }, [baseUrl, repoId, neoLimit, mode, raw, neo, tree]);

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
      setControlsCollapsed(true); // Collapse controls after loading
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
      setControlsCollapsed(true); // Collapse controls after manual load
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
    <div style={{width: '100vw', height: '100vh', overflow: 'hidden', background: '#18181b', position: 'relative'}}>
      {/* Node Color Legend - bottom left, floating (only after graph is loaded) */}
      {(tree || neo) && (
        <div style={{
          position: 'fixed',
          left: 24,
          bottom: 24,
          zIndex: 30,
          background: 'rgba(30,41,59,0.85)',
          border: '1.5px solid #334155',
          borderRadius: 10,
          padding: '10px 18px',
          color: '#f3f4f6',
          fontSize: 15,
          boxShadow: '0 2px 12px #0007',
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          pointerEvents: 'auto',
          userSelect: 'none',
          minWidth: 320,
          maxWidth: 900,
        }}>
          <span style={{fontWeight: 700, fontSize: 16, marginRight: 8}}>Legend:</span>
          <LegendDot color="#f59e0b" label="Repo" />
          <LegendDot color="#2563eb" label="Directory" />
          <LegendDot color="#10b981" label="CodeFile/TextFile" />
          <LegendDot color="#a78bfa" label="CallSite" />
          <LegendDot color="#fbbf24" label="CallSiteSummary" />
          <LegendDot color="#64748b" label="Other" />
        </div>
      )}

      {/* Controls Bar */}

      {!controlsCollapsed && (
        <div ref={controlsRef} style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          background: 'rgba(30,41,59,0.98)',
          boxShadow: '0 2px 16px #000a',
          padding: '24px 32px 16px 32px',
          borderBottom: '1px solid #22223b',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <button
            onClick={() => setControlsCollapsed(true)}
            style={{position: 'absolute', top: 12, right: 24, zIndex: 20, background: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 15, cursor: 'pointer'}}
          >
            Collapse Controls
          </button>
        <div style={{fontWeight: 700, fontSize: 22, color: '#f3f4f6', marginBottom: 2}}>{title}</div>
        <div style={{display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14, color: '#a3a3a3'}}>Backend base URL</label>
            <input
              style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#232334', color: '#f3f4f6'}}
              placeholder="(optional) http://127.0.0.1:3000"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14, color: '#a3a3a3'}}>RepoId</label>
            <input
              style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#232334', color: '#f3f4f6'}}
              placeholder="repoId from last indexRepo run"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
            />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14, color: '#a3a3a3'}}>Neo4j limit</label>
            <input
              style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#232334', color: '#f3f4f6'}}
              type="number"
              min={0}
              step={1}
              value={neoLimit}
              onChange={(e) => setNeoLimit(Number.parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8}}>
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
        <details style={{marginTop: 8}}>
          <summary style={{fontSize: 14, color: '#a3a3a3', cursor: 'pointer'}}>Advanced: paste IR JSON manually</summary>
          <textarea
            style={{width: '100%', minHeight: 120, padding: 10, borderRadius: 6, border: '1px solid #334155', background: '#232334', color: '#f3f4f6', fontFamily: 'monospace', fontSize: 13, marginTop: 8}}
            placeholder="Paste IR JSON here..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <Button onClick={load} disabled={!raw.trim()} style={{marginTop: 8}}>
            Render graph from pasted JSON
          </Button>
        </details>
      </div>
      )}

      {/* Graph Area - fullscreen below controls, never overlaps */}
      <div style={{
        position: 'absolute',
        top: controlsCollapsed ? 0 : controlsHeight,
        left: 0,
        width: '100vw',
        height: controlsCollapsed ? '100vh' : `calc(100vh - ${controlsHeight}px)`,
        zIndex: 1,
        transition: 'top 0.3s, height 0.3s',
      }}>
        {controlsCollapsed && (
          <button
            onClick={() => setControlsCollapsed(false)}
            style={{
              position: 'fixed',
              top: 56,
              right: 36,
              zIndex: 40,
              background: 'linear-gradient(90deg, #334155 60%, #64748b 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 17,
              fontWeight: 600,
              boxShadow: '0 2px 12px #000a',
              cursor: 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s',
              outline: 'none',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#475569'}
            onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(90deg, #334155 60%, #64748b 100%)'}
          >
            <span style={{marginRight: 10, fontSize: 10}}>⮞</span> Expand Controls
          </button>
        )}


        {mode === "ir" && tree && (
          <div style={{width: '100vw', height: '100%', background: 'radial-gradient(ellipse at center, #18181b 60%, #111112 100%)', borderRadius: 0, overflow: 'hidden'}}>
            <KnowledgeGraph
              data={tree as any}
              onNodeClick={(n: any) => setSelected(n)}
              selectedNodePath={selected?.path ?? null}
            />
            <NodeDetailPanel node={selected as any} onClose={() => setSelected(null)} />
          </div>
        )}
        {mode === "neo4j" && neo && (
          <div style={{width: '100vw', height: '100%', background: 'radial-gradient(ellipse at center, #18181b 60%, #111112 100%)', borderRadius: 0, overflow: 'hidden'}}>
            <Neo4jGraph nodes={neo.nodes} edges={neo.edges} onNodeClick={(n) => setSelectedNeo(n)} />
          </div>
        )}
      </div>
    </div>
  );
}
