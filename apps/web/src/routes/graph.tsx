import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Minus, Plus, RefreshCw, Search, Sparkles, Square, Upload } from "lucide-react";
import { fetchNeo4jSubgraph } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";
import type { Neo4jEdge, Neo4jNode } from "@/components/Neo4jGraph";
import { ExplorerGraphCanvas, classifyNode, nodeDisplayLabel, type ExplorerNode, type ExplorerNodeKind } from "@/components/explorer-graph-canvas";

export const Route = createFileRoute("/graph")({
  component: GraphExplorerPage,
});

type EdgeCategory = "CONTAINS" | "IMPORTS" | "CALLS";
type Mode = "select" | "neighbour" | "path" | "insight";
type RightTab = "detail" | "insights" | "ai";

type TreeItem = {
  key: string;
  label: string;
  depth: number;
  nodeId?: string;
};

function normalizeEdgeType(type: string): EdgeCategory {
  const t = String(type).toUpperCase();
  if (t.includes("CALL")) return "CALLS";
  if (t.includes("IMPORT")) return "IMPORTS";
  return "CONTAINS";
}

function getNodePath(node: Neo4jNode): string {
  const props = node.properties ?? {};
  return String(props.path ?? props.filePath ?? props.relativePath ?? props.name ?? node.id);
}

function getNodeLanguage(node: Neo4jNode): string {
  const props = node.properties ?? {};
  return String(props.language ?? props.lang ?? inferLanguageFromPath(getNodePath(node)) ?? "Unknown");
}

function inferLanguageFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext || ext === path) return null;
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    java: "Java",
    py: "Python",
    cs: "C#",
    cpp: "C++",
    c: "C",
    go: "Go",
    rb: "Ruby",
    php: "PHP",
    kt: "Kotlin",
    swift: "Swift",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    md: "Markdown",
  };
  return map[ext] ?? ext.toUpperCase();
}

function getNodeLoc(node: Neo4jNode): number | string {
  const props = node.properties ?? {};
  return props.loc ?? props.lines ?? props.lineCount ?? props.endLine ?? "—";
}

function buildTreeItems(nodes: ExplorerNode[]): TreeItem[] {
  const paths = nodes
    .filter((n) => ["folder", "file", "class"].includes(n.kind))
    .map((n) => ({ nodeId: n.id, path: getNodePath(n), label: n.displayLabel }));

  const items: TreeItem[] = [];
  const seen = new Set<string>();

  for (const item of paths) {
    const clean = item.path.replace(/^\/+/, "");
    const segments = clean.split(/[\\/]/).filter(Boolean);
    if (segments.length === 0) {
      if (!seen.has(item.nodeId)) {
        items.push({ key: item.nodeId, label: item.label, depth: 0, nodeId: item.nodeId });
        seen.add(item.nodeId);
      }
      continue;
    }

    let prefix = "";
    segments.forEach((segment, index) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;
      if (!seen.has(prefix)) {
        items.push({
          key: prefix,
          label: isLeaf ? item.label : `${segment}/`,
          depth: index,
          nodeId: isLeaf ? item.nodeId : undefined,
        });
        seen.add(prefix);
      }
    });
  }

  return items.slice(0, 80);
}

function computeDegrees(nodes: Neo4jNode[], edges: Neo4jEdge[]) {
  const degreeMap = new Map<string, { in: number; out: number }>();
  nodes.forEach((node) => degreeMap.set(String(node.id), { in: 0, out: 0 }));
  edges.forEach((edge) => {
    const from = degreeMap.get(String(edge.from));
    const to = degreeMap.get(String(edge.to));
    if (from) from.out += 1;
    if (to) to.in += 1;
  });
  return degreeMap;
}

function bfsDepth(nodes: Neo4jNode[], edges: Neo4jEdge[]) {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((n) => adjacency.set(String(n.id), []));
  edges.forEach((e) => {
    const from = String(e.from);
    const to = String(e.to);
    adjacency.get(from)?.push(to);
  });
  const depth = new Map<string, number>();
  const roots = nodes.filter((n) => n.labels?.includes("Repository") || n.labels?.includes("Repo"));
  const queue: string[] = roots.length ? roots.map((n) => String(n.id)) : nodes.slice(0, 1).map((n) => String(n.id));
  queue.forEach((id) => depth.set(id, 0));
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]!;
    const currentDepth = depth.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  return depth;
}

function shortestPath(nodeIds: string[], edges: Neo4jEdge[], fromId: string, toId: string): string[] {
  const allowed = new Set(nodeIds);
  const adjacency = new Map<string, string[]>();
  nodeIds.forEach((id) => adjacency.set(id, []));
  edges.forEach((e) => {
    const from = String(e.from);
    const to = String(e.to);
    if (allowed.has(from) && allowed.has(to)) adjacency.get(from)?.push(to);
  });

  const queue = [fromId];
  const prev = new Map<string, string | null>();
  prev.set(fromId, null);

  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]!;
    if (current === toId) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!prev.has(next)) {
        prev.set(next, current);
        queue.push(next);
      }
    }
  }

  if (!prev.has(toId)) return [];
  const path: string[] = [];
  let current: string | null = toId;
  while (current) {
    path.push(current);
    current = prev.get(current) ?? null;
  }
  return path.reverse();
}

function GraphExplorerPage() {
  const session = loadSession();
  const [baseUrl] = useState(session.baseUrl ?? "");
  const [repoId] = useState(session.lastRepoId ?? "");
  const [graph, setGraph] = useState<{ nodes: Neo4jNode[]; edges: Neo4jEdge[] }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [tab, setTab] = useState<RightTab>("detail");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Record<EdgeCategory, boolean>>({ CONTAINS: true, IMPORTS: true, CALLS: true });
  const [visibleKinds, setVisibleKinds] = useState<Record<ExplorerNodeKind, boolean>>({ folder: true, file: true, class: true, fn: true });
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "user", text: "How does this repository connect the selected node to its neighbours?" },
    { role: "assistant", text: "Once you select a node, CodeAtlas uses the graph data already loaded from Neo4j to show direct relationships and graph-grounded structure in this panel." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [pathFromId, setPathFromId] = useState<string>("");
  const [pathToId, setPathToId] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!repoId.trim()) return;
      setLoading(true);
      try {
        const res = await fetchNeo4jSubgraph(repoId.trim(), baseUrl, 500);
        setGraph({ nodes: res.nodes ?? [], edges: res.edges ?? [] });
        saveSession({ baseUrl, lastRepoId: repoId.trim() });
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load graph");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [repoId, baseUrl]);

  const explorerNodes = useMemo<ExplorerNode[]>(() => {
    return graph.nodes.map((node) => ({
      ...node,
      kind: classifyNode(node),
      displayLabel: nodeDisplayLabel(node),
    }));
  }, [graph.nodes]);

  const filteredNodes = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return explorerNodes.filter((node) => {
      if (!visibleKinds[node.kind]) return false;
      if (!lower) return true;
      const haystack = `${node.displayLabel} ${getNodePath(node)} ${JSON.stringify(node.properties ?? {})}`.toLowerCase();
      return haystack.includes(lower);
    });
  }, [explorerNodes, visibleKinds, search]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((node) => String(node.id))), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return graph.edges.filter((edge) => {
      const category = normalizeEdgeType(edge.type);
      return visibleEdgeTypes[category] && visibleNodeIds.has(String(edge.from)) && visibleNodeIds.has(String(edge.to));
    });
  }, [graph.edges, visibleEdgeTypes, visibleNodeIds]);

  const selectedNode = useMemo(() => {
    return filteredNodes.find((node) => String(node.id) === selectedNodeId) ?? filteredNodes[0] ?? null;
  }, [filteredNodes, selectedNodeId]);

  useEffect(() => {
    if (!selectedNode && filteredNodes[0]) setSelectedNodeId(String(filteredNodes[0].id));
  }, [selectedNode, filteredNodes]);

  const degreeMap = useMemo(() => computeDegrees(filteredNodes, filteredEdges), [filteredNodes, filteredEdges]);
  const depthMap = useMemo(() => bfsDepth(filteredNodes, filteredEdges), [filteredNodes, filteredEdges]);

  const relationships = useMemo(() => {
    if (!selectedNode) return [] as Array<{ edge: Neo4jEdge; target: ExplorerNode; category: EdgeCategory }>;
    return filteredEdges
      .filter((edge) => String(edge.from) === String(selectedNode.id) || String(edge.to) === String(selectedNode.id))
      .map((edge) => {
        const targetId = String(edge.from) === String(selectedNode.id) ? String(edge.to) : String(edge.from);
        return {
          edge,
          target: filteredNodes.find((node) => String(node.id) === targetId)!,
          category: normalizeEdgeType(edge.type),
        };
      })
      .filter((item) => Boolean(item.target))
      .slice(0, 12);
  }, [selectedNode, filteredEdges, filteredNodes]);

  const treeItems = useMemo(() => buildTreeItems(filteredNodes), [filteredNodes]);

  const pathCandidates = filteredNodes.slice(0, 40);
  useEffect(() => {
    if (!pathFromId && pathCandidates[0]) setPathFromId(String(pathCandidates[0].id));
    if (!pathToId && pathCandidates[1]) setPathToId(String(pathCandidates[1].id));
  }, [pathCandidates, pathFromId, pathToId]);

  const currentPath = useMemo(() => {
    if (mode !== "path" || !pathFromId || !pathToId) return [] as string[];
    return shortestPath(Array.from(visibleNodeIds), filteredEdges, pathFromId, pathToId);
  }, [mode, pathFromId, pathToId, visibleNodeIds, filteredEdges]);

  const highlightNodeIds = useMemo(() => {
    if (!selectedNode) return [] as string[];
    if (mode === "neighbour") {
      const ids = new Set<string>([String(selectedNode.id)]);
      filteredEdges.forEach((edge) => {
        if (String(edge.from) === String(selectedNode.id)) ids.add(String(edge.to));
        if (String(edge.to) === String(selectedNode.id)) ids.add(String(edge.from));
      });
      return Array.from(ids);
    }
    if (mode === "insight") {
      return filteredNodes
        .map((node) => ({ node, degree: (degreeMap.get(String(node.id))?.in ?? 0) + (degreeMap.get(String(node.id))?.out ?? 0) }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 5)
        .map((item) => String(item.node.id));
    }
    return selectedNode ? [String(selectedNode.id)] : [];
  }, [selectedNode, mode, filteredEdges, filteredNodes, degreeMap]);

  const hotspotNodes = useMemo(() => {
    return filteredNodes
      .map((node) => ({
        node,
        inDegree: degreeMap.get(String(node.id))?.in ?? 0,
        outDegree: degreeMap.get(String(node.id))?.out ?? 0,
      }))
      .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
      .slice(0, 3);
  }, [filteredNodes, degreeMap]);

  const orphanNodes = useMemo(() => {
    return filteredNodes.filter((node) => {
      const degree = degreeMap.get(String(node.id));
      return (degree?.in ?? 0) + (degree?.out ?? 0) === 0;
    }).slice(0, 3);
  }, [filteredNodes, degreeMap]);

  const depthDistribution = useMemo(() => {
    const buckets = new Map<string, number>();
    filteredNodes.forEach((node) => {
      const depth = depthMap.get(String(node.id));
      const bucket = depth == null ? "Unreached" : depth >= 4 ? "Depth 4+" : `Depth ${depth}`;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
  }, [filteredNodes, depthMap]);

  const repoName = useMemo(() => {
    if (!repoId) return "No repository loaded";
    return repoId;
  }, [repoId]);

  const sendAi = () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiMessages((cur) => [
      ...cur,
      { role: "user", text },
      {
        role: "assistant",
        text: selectedNode
          ? `Using the currently loaded graph context around ${selectedNode.displayLabel}, CodeAtlas can inspect ${relationships.length} visible relationships in this filtered view.`
          : "Load a graph and select a node to get graph-grounded context.",
      },
    ]);
    setAiInput("");
    setTab("ai");
  };

  return (
    <section className="min-h-[calc(100vh-50px)] bg-[var(--bg)]">
      <div className="flex h-[calc(100vh-50px)] flex-col overflow-hidden">
        <div className="flex h-12 items-center border-b border-[var(--b1)] bg-[var(--s0)] px-5 text-[13px]">
          <div className="flex items-center gap-8">
            <span className="border-b-2 border-[var(--t0)] pb-[14px] pt-4 font-medium text-[var(--t0)]">Explorer</span>
            <span className="text-[var(--t2)]">Summary</span>
            <span className="font-mono text-[11px] text-[var(--t2)]">{repoName}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[var(--b2)] px-3 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]" onClick={() => window.location.reload()}>
              <RefreshCw className="h-3.5 w-3.5" /> Sync
            </button>
            <button className="inline-flex h-8 items-center rounded-[6px] bg-[var(--t0)] px-3 text-[12px] text-[var(--s0)]" onClick={() => setTab("ai")}>
              Ask AI
            </button>
          </div>
        </div>

        <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "300px 1fr 360px" }}>
          <aside className="flex flex-col overflow-hidden border-r border-[var(--b1)] bg-[var(--s0)]">
            <div className="border-b border-[var(--b0)] p-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--t3)]" />
                <input
                  className="w-full rounded-[6px] border border-[var(--b1)] bg-[var(--s1)] py-2 pl-8 pr-3 text-[12px] outline-none"
                  placeholder="Search nodes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="border-b border-[var(--b0)] px-3 py-3">
              <div className="pb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Interaction mode</div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ["select", "Select", "inspect node"],
                  ["neighbour", "Neighbours", "explore connections"],
                  ["path", "Path trace", "shortest path"],
                  ["insight", "Insights", "hotspots & depth"],
                ].map(([value, label, sub]) => (
                  <button
                    key={value}
                    className={`rounded-[6px] border px-2 py-2 text-center text-[11px] ${mode === value ? "border-transparent bg-[var(--t0)] text-[var(--s0)]" : "border-[var(--b1)] text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"}`}
                    onClick={() => setMode(value as Mode)}
                  >
                    <div>{label}</div>
                    <div className="text-[9px] opacity-70">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-[var(--b0)] px-3 py-3">
              <div className="pb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Edge types</div>
              {(["CONTAINS", "IMPORTS", "CALLS"] as EdgeCategory[]).map((type) => (
                <label key={type} className="flex items-center gap-2 py-1 text-[12px] text-[var(--t1)]">
                  <input
                    type="checkbox"
                    checked={visibleEdgeTypes[type]}
                    onChange={(e) => setVisibleEdgeTypes((cur) => ({ ...cur, [type]: e.target.checked }))}
                  />
                  <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: type === "CONTAINS" ? "var(--purple)" : type === "IMPORTS" ? "var(--blue)" : "var(--green)" }} />
                  {type}
                </label>
              ))}
            </div>

            <div className="border-b border-[var(--b0)] px-3 py-3">
              <div className="pb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Node types</div>
              {(["folder", "file", "class", "fn"] as ExplorerNodeKind[]).map((kind) => (
                <label key={kind} className="flex items-center gap-2 py-1 text-[12px] text-[var(--t1)]">
                  <input
                    type="checkbox"
                    checked={visibleKinds[kind]}
                    onChange={(e) => setVisibleKinds((cur) => ({ ...cur, [kind]: e.target.checked }))}
                  />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: kind === "folder" ? "var(--purple)" : kind === "file" ? "var(--blue)" : kind === "class" ? "var(--amber)" : "var(--green)" }} />
                  {kind === "fn" ? "Function" : kind[0]!.toUpperCase() + kind.slice(1)}
                </label>
              ))}
            </div>

            <div className="px-3 pt-3 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Repository tree</div>
            <div className="flex-1 overflow-y-auto py-2">
              {treeItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => item.nodeId && setSelectedNodeId(String(item.nodeId))}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] ${item.nodeId && String(item.nodeId) === String(selectedNode?.id) ? "bg-[var(--s2)] text-[var(--t0)]" : "text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"}`}
                  style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                >
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: item.label.endsWith("/") ? "var(--purple)" : "var(--blue)" }} />
                  {item.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="relative overflow-hidden bg-[var(--bg)]">
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 overflow-hidden rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] shadow-sm">
              {[
                ["Force layout", Sparkles],
                ["Hierarchical", Upload],
                ["Radial", BrainCircuit],
                ["Fit", Square],
              ].map(([label, Icon], index) => {
                const Comp = Icon as any;
                return (
                  <button key={label} className={`inline-flex h-8 items-center gap-1 border-r border-[var(--b0)] px-3 text-[11px] ${index === 0 ? "bg-[var(--t0)] text-[var(--s0)]" : "text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"}`}>
                    <Comp className="h-3.5 w-3.5" /> {label}
                  </button>
                );
              })}
            </div>

            <div className="absolute left-3 top-3 z-10 rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] p-3 text-[11px] text-[var(--t2)]">
              <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">{mode === "insight" ? "Insight mode" : mode === "path" ? "Path trace" : "Graph state"}</div>
              {mode === "path" ? (
                <div className="min-w-[220px] space-y-2">
                  <select className="w-full rounded-[6px] border border-[var(--b1)] bg-[var(--s1)] px-2 py-1.5 font-mono text-[11px]" value={pathFromId} onChange={(e) => setPathFromId(e.target.value)}>
                    {pathCandidates.map((node) => <option key={node.id} value={String(node.id)}>{node.displayLabel}</option>)}
                  </select>
                  <select className="w-full rounded-[6px] border border-[var(--b1)] bg-[var(--s1)] px-2 py-1.5 font-mono text-[11px]" value={pathToId} onChange={(e) => setPathToId(e.target.value)}>
                    {pathCandidates.map((node) => <option key={node.id} value={String(node.id)}>{node.displayLabel}</option>)}
                  </select>
                  <div className="rounded-[6px] bg-[var(--blue-l)] p-2 font-mono text-[11px] text-[var(--blue)]">
                    {currentPath.length > 0 ? currentPath.map((id) => filteredNodes.find((n) => String(n.id) === id)?.displayLabel ?? id).join(" → ") : "No path in current filtered graph"}
                  </div>
                </div>
              ) : mode === "insight" ? (
                <div className="space-y-1">
                  <div>Hotspots are highlighted using real graph degree.</div>
                  <div>Depth is estimated from the repository root.</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div>{loading ? "Loading graph from backend..." : `Nodes visible: ${filteredNodes.length}`}</div>
                  <div>Edges visible: {filteredEdges.length}</div>
                </div>
              )}
            </div>

            <div className="absolute bottom-3 left-3 z-10 rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] p-3 text-[11px] text-[var(--t2)]">
              <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Node types</div>
              <div className="space-y-1">
                {[
                  ["Folder", "var(--purple)"],
                  ["File", "var(--blue)"],
                  ["Class", "var(--amber)"],
                  ["Function", "var(--green)"],
                ].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color as string }} />{label}</div>
                ))}
              </div>
            </div>

            <div className="absolute right-3 top-3 z-10 overflow-hidden rounded-[10px] border border-[var(--b1)] bg-[var(--s0)]">
              <button className="grid h-8 w-8 place-items-center border-b border-[var(--b0)] text-[var(--t1)] hover:bg-[var(--s1)]"><Plus className="h-4 w-4" /></button>
              <button className="grid h-8 w-8 place-items-center border-b border-[var(--b0)] text-[var(--t1)] hover:bg-[var(--s1)]"><Minus className="h-4 w-4" /></button>
              <button className="grid h-8 w-8 place-items-center text-[var(--t1)] hover:bg-[var(--s1)]"><Square className="h-3.5 w-3.5" /></button>
            </div>

            <div className="absolute bottom-3 right-3 z-10 rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] p-3 text-[11px] text-[var(--t2)]">
              <div className="flex justify-between gap-6"><span>Nodes visible</span><span className="font-mono text-[var(--t0)]">{filteredNodes.length}</span></div>
              <div className="flex justify-between gap-6"><span>Edges visible</span><span className="font-mono text-[var(--t0)]">{filteredEdges.length}</span></div>
              <div className="flex justify-between gap-6"><span>Selected</span><span className="font-mono text-[var(--t0)]">{selectedNode ? selectedNode.displayLabel : "—"}</span></div>
              <div className="flex justify-between gap-6"><span>Mode</span><span className="font-mono text-[var(--t0)]">{mode}</span></div>
            </div>

            {loading ? (
              <div className="grid h-full place-items-center text-[var(--t2)]">Loading graph from backend…</div>
            ) : filteredNodes.length === 0 ? (
              <div className="grid h-full place-items-center px-10 text-center text-[var(--t2)]">
                {repoId ? "No graph nodes matched the current filters." : "Run indexing first so the graph page can load the last repoId from session."}
              </div>
            ) : (
              <ExplorerGraphCanvas
                nodes={filteredNodes}
                edges={filteredEdges}
                selectedNodeId={selectedNode ? String(selectedNode.id) : null}
                onNodeClick={(node) => {
                  setSelectedNodeId(String(node.id));
                  if (mode === "select") setTab("detail");
                }}
                mode={mode}
                pathNodeIds={currentPath}
                highlightNodeIds={highlightNodeIds}
              />
            )}
          </div>

          <aside className="flex flex-col overflow-hidden border-l border-[var(--b1)] bg-[var(--s0)]">
            <div className="flex border-b border-[var(--b1)] text-[12px]">
              {(["detail", "insights", "ai"] as RightTab[]).map((item) => (
                <button key={item} className={`flex-1 px-4 py-3 capitalize ${tab === item ? "border-b-2 border-[var(--t0)] text-[var(--t0)]" : "text-[var(--t2)] hover:text-[var(--t0)]"}`} onClick={() => setTab(item)}>
                  {item}
                </button>
              ))}
            </div>

            {tab === "detail" && (
              <div className="flex-1 overflow-y-auto p-4">
                {selectedNode ? (
                  <>
                    <div className="rounded-[10px] bg-[var(--s1)] p-3">
                      <div className="mb-2 inline-flex rounded-[4px] px-2 py-0.5 font-mono text-[10px]" style={{ background: selectedNode.kind === "folder" ? "var(--purple-l)" : selectedNode.kind === "file" ? "var(--blue-l)" : selectedNode.kind === "class" ? "var(--amber-l)" : "var(--green-l)", color: selectedNode.kind === "folder" ? "var(--purple)" : selectedNode.kind === "file" ? "var(--blue)" : selectedNode.kind === "class" ? "var(--amber)" : "var(--green)" }}>
                        {selectedNode.kind}
                      </div>
                      <div className="text-[14px] font-medium font-mono">{selectedNode.displayLabel}</div>
                      <div className="mt-1 text-[10px] font-mono text-[var(--t2)]">{getNodePath(selectedNode)}</div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Metadata</div>
                      {[
                        ["Type", selectedNode.kind],
                        ["Language", getNodeLanguage(selectedNode)],
                        ["Lines of code", String(getNodeLoc(selectedNode))],
                        ["Degree (in/out)", `${degreeMap.get(String(selectedNode.id))?.in ?? 0} / ${degreeMap.get(String(selectedNode.id))?.out ?? 0}`],
                        ["Depth", String(depthMap.get(String(selectedNode.id)) ?? "—")],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between border-b border-[var(--b0)] py-2 text-[12px] last:border-b-0">
                          <span className="text-[var(--t2)]">{label}</span>
                          <span className="font-mono text-[var(--t0)]">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Relationships</div>
                      <div className="space-y-2">
                        {relationships.map(({ edge, target, category }) => (
                          <button key={edge.id} className="flex w-full items-center gap-2 rounded-[6px] bg-[var(--s1)] px-3 py-2 text-left text-[11px] hover:bg-[var(--s2)]" onClick={() => setSelectedNodeId(String(target.id))}>
                            <span className="rounded-[3px] border border-[var(--b1)] px-1.5 py-0.5 font-mono text-[9px]" style={{ color: category === "CONTAINS" ? "var(--purple)" : category === "IMPORTS" ? "var(--blue)" : "var(--green)" }}>{category}</span>
                            <span className="flex-1 font-mono text-[var(--t0)]">{target.displayLabel}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Actions</div>
                      <button className="mb-2 flex w-full items-center gap-2 rounded-[6px] border border-[var(--b1)] px-3 py-2 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]" onClick={() => setTab("ai")}><Sparkles className="h-4 w-4" /> Add to AI context</button>
                      <button className="mb-2 flex w-full items-center gap-2 rounded-[6px] border border-[var(--b1)] px-3 py-2 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]" onClick={() => setMode("neighbour")}><ArrowRight className="h-4 w-4" /> Explore neighbours</button>
                      <button className="flex w-full items-center gap-2 rounded-[6px] border border-[var(--b1)] px-3 py-2 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]" onClick={() => setMode("path")}><BrainCircuit className="h-4 w-4" /> Trace path from here</button>
                    </div>
                  </>
                ) : (
                  <div className="text-[var(--t2)]">Select a node to inspect its details.</div>
                )}
              </div>
            )}

            {tab === "insights" && (
              <div className="flex-1 overflow-y-auto p-4 text-[11px]">
                <div className="mb-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Hotspot nodes</div>
                  <div className="space-y-2">
                    {hotspotNodes.map(({ node, inDegree, outDegree }) => (
                      <div key={node.id} className="rounded-[10px] border border-[var(--b0)] bg-[var(--s1)] p-3">
                        <div className="mb-2 flex items-center justify-between"><span className="font-medium">{node.displayLabel}</span><span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--amber-l)", color: "var(--amber)" }}>degree {inDegree + outDegree}</span></div>
                        <div className="text-[var(--t2)]">in-edges {inDegree} · out-edges {outDegree}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Orphan nodes</div>
                  <div className="space-y-2">
                    {orphanNodes.length > 0 ? orphanNodes.map((node) => (
                      <div key={node.id} className="rounded-[10px] border border-dashed border-[var(--b2)] p-3 text-[var(--t2)]">{node.displayLabel}</div>
                    )) : <div className="text-[var(--t2)]">No orphan nodes in the current filter set.</div>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Depth distribution</div>
                  <div className="space-y-2">
                    {depthDistribution.map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-16 text-right font-mono text-[var(--t2)]">{label}</span>
                        <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-[var(--s1)]"><div className="h-full rounded-[4px] bg-[var(--blue)]" style={{ width: `${Math.max(8, (value / Math.max(...depthDistribution.map((d) => d.value), 1)) * 100)}%` }} /></div>
                        <span className="w-8 text-right font-mono text-[var(--t2)]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "ai" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b border-[var(--b0)] bg-[var(--s1)] px-3 py-2 text-[10px] uppercase tracking-[0.07em] text-[var(--t3)]">
                  Context {selectedNode ? `· ${selectedNode.displayLabel}` : ""}
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    {aiMessages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className={`max-w-[92%] rounded-[8px] px-3 py-2 text-[11px] leading-6 ${message.role === "user" ? "ml-auto bg-[var(--s2)]" : "border border-[var(--teal-b)] bg-[var(--teal-l)]"}`}>
                        {message.text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[var(--b0)] p-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {[
                      "Why is this node highly connected?",
                      "Show the shortest dependency path.",
                      "Suggest a safer refactor.",
                    ].map((prompt) => (
                      <button key={prompt} className="rounded-full border border-[var(--b1)] px-3 py-1 text-[10px] text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]" onClick={() => setAiInput(prompt)}>{prompt}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 rounded-[6px] border border-[var(--b1)] bg-[var(--s1)] px-3 py-2 text-[11px] outline-none" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Ask about selected context..." onKeyDown={(e) => e.key === "Enter" && sendAi()} />
                    <button className="rounded-[6px] bg-[var(--t0)] px-3 text-[11px] text-[var(--s0)]" onClick={sendAi}>Send</button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
