import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, forwardRef, useImperativeHandle } from "react";
import * as d3 from "d3";
import type { Neo4jEdge, Neo4jNode } from "@/components/Neo4jGraph";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ExplorerNodeKind = "folder" | "file" | "class" | "fn";
export type ExplorerNode = Neo4jNode & { kind: ExplorerNodeKind; displayLabel: string };
type SimNode = ExplorerNode & d3.SimulationNodeDatum;
type SimLink = { id: string; type: string; source: string | SimNode; target: string | SimNode } & d3.SimulationLinkDatum<SimNode>;
export type GraphCanvasHandle = {
  zoomIn: () => void; zoomOut: () => void; fit: () => void;
  setLayout: (l: "force" | "radial" | "hierarchical") => void;
};

// ─── Public helpers ───────────────────────────────────────────────────────────
export function classifyNode(node: Neo4jNode): ExplorerNodeKind {
  const L = node.labels ?? [];
  if (L.includes("Repository") || L.includes("Repo") || L.includes("Folder") || L.includes("Directory")) return "folder";
  if (L.includes("Class") || L.includes("Interface") || L.includes("Enum")) return "class";
  if (L.includes("Chunk") || L.includes("Function") || L.includes("Method") || L.includes("CallSite") || L.includes("CallSiteSummary")) return "fn";
  return "file";
}
export function nodeDisplayLabel(node: Neo4jNode): string {
  const p = node.properties ?? {};
  return String(p.name ?? p.displayName ?? p.path?.split(/[\\\/]/).pop() ?? p.filePath?.split(/[\\\/]/).pop() ?? p.symbol ?? p.text ?? node.id);
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  light: {
    folder: { fill: "#6d28d9", bright: "#8b5cf6", labelBg: "#ede9fe", labelText: "#4c1d95" },
    file:   { fill: "#0369a1", bright: "#38bdf8", labelBg: "#dbeafe", labelText: "#1e40af" },
    class:  { fill: "#b45309", bright: "#fbbf24", labelBg: "#fef3c7", labelText: "#92400e" },
    fn:     { fill: "#047857", bright: "#34d399", labelBg: "#d1fae5", labelText: "#065f46" },
    tour:   { fill: "#be123c", bright: "#fb7185", labelBg: "#ffe4e6", labelText: "#9f1239" },
    multi:  { ring: "#f59e0b", glow: "#f59e0b" }, // multi-select: amber
    bg: "#f2f1ed", dot: "rgba(0,0,0,0.06)",
    edge: { CONTAINS: "#7c3aed", IMPORTS: "#0369a1", CALLS: "#059669" } as Record<string, string>,
  },
  dark: {
    folder: { fill: "#7c3aed", bright: "#a78bfa", labelBg: "#1e1143", labelText: "#c4b5fd" },
    file:   { fill: "#1d4ed8", bright: "#60a5fa", labelBg: "#1e3a5f", labelText: "#93c5fd" },
    class:  { fill: "#d97706", bright: "#fbbf24", labelBg: "#2d1a02", labelText: "#fcd34d" },
    fn:     { fill: "#059669", bright: "#34d399", labelBg: "#022c22", labelText: "#6ee7b7" },
    tour:   { fill: "#e11d48", bright: "#fb7185", labelBg: "#4c0519", labelText: "#fda4af" },
    multi:  { ring: "#fbbf24", glow: "#fbbf24" },
    bg: "#0d0d0c", dot: "rgba(255,255,255,0.055)",
    edge: { CONTAINS: "#8b5cf6", IMPORTS: "#60a5fa", CALLS: "#34d399" } as Record<string, string>,
  },
} as const;
type KindKey = "folder" | "file" | "class" | "fn" | "tour";
type Theme = typeof C.light;
const getTheme = (): Theme => document.documentElement.classList.contains("dark") ? C.dark : C.light;

// ─── Lucide icon SVG paths (24×24 viewBox, stroke-only) ──────────────────────
// Rendered inside node circles — clean, recognizable at small sizes
const ICON_PATH: Record<ExplorerNodeKind, string> = {
  // Folder: classic open folder shape
  folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  // File: document with folded corner
  file: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6",
  // Class: hexagonal package/box
  class: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  // Function: code-2 brackets
  fn: "m18 16 4-4-4-4 M6 8l-4 4 4 4 M14.5 4l-5 16",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const edgeCat = (t: string) => {
  const u = t.toUpperCase();
  return u.includes("CALL") ? "CALLS" : u.includes("IMPORT") ? "IMPORTS" : "CONTAINS";
};
const nodeR = (k: ExplorerNodeKind) => k === "folder" ? 22 : k === "class" ? 17 : k === "fn" ? 12 : 15;

// Hide labels that are just chunk/import hashes — they clutter the graph
function shouldShowLabel(label: string, kind: ExplorerNodeKind): boolean {
  if (!label || label.trim() === "") return false;
  // Hide any label starting with a known chunk/import/call prefix
  if (/^(imp|chunk|call|callsite|fn|node|ref|sym|id):/i.test(label)) return false;
  // Hide labels containing 6+ consecutive hex chars (hashes, IDs)
  if (/[a-f0-9]{6,}/i.test(label)) return false;
  // Hide UUID-shaped strings
  if (/^[a-f0-9-]{20,}$/i.test(label)) return false;
  // Hide "word:hexhex..." pattern
  if (/^[a-z]+:[a-f0-9]+/i.test(label)) return false;
  // Hide very long labels with no spaces/dots/slashes (raw IDs)
  if (label.length > 30 && !/[\s./]/.test(label)) return false;
  // Hide single/two-char fn node labels
  if (kind === "fn" && /^[a-z0-9_]{1,2}$/.test(label)) return false;
  return true;
}
const trim = (s: string, max = 20) => s.length > max ? s.slice(0, max - 1) + "…" : s;

// ─── Layouts ─────────────────────────────────────────────────────────────────

/**
 * RADIAL LAYOUT
 * Each kind gets its own ring. Ring radius is calculated so nodes
 * always have enough arc-space between them (minimum 70px of arc per node).
 * This means large layers get bigger rings automatically.
 */
function radialLayout(nodes: SimNode[], W: number, H: number) {
  const cx = W / 2, cy = H / 2;
  const by: Record<string, SimNode[]> = { folder: [], file: [], class: [], fn: [] };
  nodes.forEach(n => by[n.kind].push(n));

  const MIN_ARC = 70; // minimum arc-length per node so they never overlap
  let currentR = 0;

  (["folder", "file", "class", "fn"] as ExplorerNodeKind[]).forEach(kind => {
    const ns = by[kind];
    if (!ns.length) return;

    // Compute the minimum radius that gives each node MIN_ARC arc-space
    const requiredR = (ns.length * MIN_ARC) / (2 * Math.PI);
    const r = Math.max(currentR + 80, ns.length <= 1 ? 0 : requiredR);

    if (r === 0) {
      // Single folder at exact center
      ns[0].fx = cx; ns[0].fy = cy; ns[0].x = cx; ns[0].y = cy;
    } else {
      ns.forEach((n, i) => {
        const a = (i / ns.length) * 2 * Math.PI - Math.PI / 2;
        n.fx = cx + r * Math.cos(a);
        n.fy = cy + r * Math.sin(a);
        n.x = n.fx; n.y = n.fy;
      });
    }

    currentR = r + (kind === "folder" ? 60 : 80);
  });
}

/**
 * HIERARCHICAL LAYOUT
 * Each kind is a horizontal layer. Nodes WRAP into multiple rows
 * so they never get squashed into one long line.
 * Generous spacing between nodes and between layers.
 */
function hierarchicalLayout(nodes: SimNode[], W: number, H: number) {
  const by: Record<string, SimNode[]> = { folder: [], file: [], class: [], fn: [] };
  nodes.forEach(n => by[n.kind].push(n));

  const COL_W  = 100; // horizontal space per node (center to center)
  const ROW_H  = 85;  // vertical space per row within a layer
  const LAYER_PAD = 70; // extra gap between different kind-layers
  const MARGIN = 60;  // left/right margin

  let currentY = 80;

  (["folder", "file", "class", "fn"] as ExplorerNodeKind[]).forEach(kind => {
    const ns = by[kind];
    if (!ns.length) return;

    // How many columns fit in the canvas width with proper spacing?
    const maxCols = Math.max(1, Math.floor((W - MARGIN * 2) / COL_W));
    const cols    = Math.min(ns.length, maxCols);
    const rows    = Math.ceil(ns.length / cols);

    // Center the columns in the canvas
    const totalW = (cols - 1) * COL_W;
    const startX = (W - totalW) / 2;

    ns.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      n.fx = startX + col * COL_W;
      n.fy = currentY + row * ROW_H;
      n.x = n.fx; n.y = n.fy;
    });

    currentY += rows * ROW_H + LAYER_PAD;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
type Ctrl = {
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  simulation: d3.Simulation<SimNode, SimLink>;
  simNodes: SimNode[];
  W: number; H: number;
};

export const ExplorerGraphCanvas = forwardRef<GraphCanvasHandle, {
  nodes: ExplorerNode[];
  edges: Neo4jEdge[];
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  onNodeClick: (node: ExplorerNode, event: MouseEvent) => void;
  mode: string;
  pathNodeIds: string[];
  highlightNodeIds: string[];
  tourHighlightNodeIds?: string[];
  activeTourNodeId?: string | null;
}>(function ExplorerGraphCanvas(
  { nodes, edges, selectedNodeId, selectedNodeIds = [], onNodeClick, mode, pathNodeIds, highlightNodeIds, tourHighlightNodeIds, activeTourNodeId },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const ctrlRef      = useRef<Ctrl | null>(null);
  const glowIdRef    = useRef<string>("");

  // ── Imperative handle (zoom / layout) ──────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn:  () => ctrlRef.current?.svgSel.transition().duration(280).call(ctrlRef.current.zoom.scaleBy, 1.45),
    zoomOut: () => ctrlRef.current?.svgSel.transition().duration(280).call(ctrlRef.current.zoom.scaleBy, 0.68),
    fit: () => {
      const c = ctrlRef.current;
      if (!c) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      c.simNodes.forEach(n => {
        const r = nodeR(n.kind) + 40;
        x0 = Math.min(x0, (n.x ?? 0) - r); y0 = Math.min(y0, (n.y ?? 0) - r);
        x1 = Math.max(x1, (n.x ?? 0) + r + 150); y1 = Math.max(y1, (n.y ?? 0) + r);
      });
      if (!isFinite(x0)) return;
      const pad = 50;
      const sc = 0.9 * Math.min(c.W / (x1 - x0 + pad * 2), c.H / (y1 - y0 + pad * 2));
      c.svgSel.transition().duration(500).call(c.zoom.transform, d3.zoomIdentity.translate((c.W - sc*(x0+x1))/2, (c.H - sc*(y0+y1))/2).scale(sc));
    },
    setLayout: (layout) => {
      const c = ctrlRef.current;
      if (!c) return;
      if (layout === "force") {
        c.simNodes.forEach(n => { n.fx = null; n.fy = null; });
        c.simulation.alpha(0.8).alphaDecay(0.028).restart();
      } else if (layout === "radial") {
        radialLayout(c.simNodes, c.W, c.H);
        c.simulation.alpha(0.15).restart();
      } else if (layout === "hierarchical") {
        hierarchicalLayout(c.simNodes, c.W, c.H);
        c.simulation.alpha(0.15).restart();
      }
      // Auto-fit after layout switch so all nodes are visible
      setTimeout(() => {
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        c.simNodes.forEach(n=>{
          const r=40;
          x0=Math.min(x0,(n.x??0)-r); y0=Math.min(y0,(n.y??0)-r);
          x1=Math.max(x1,(n.x??0)+r+160); y1=Math.max(y1,(n.y??0)+r);
        });
        if(!isFinite(x0)) return;
        const pad=50, sc=0.88*Math.min(c.W/(x1-x0+pad*2),c.H/(y1-y0+pad*2));
        c.svgSel.transition().duration(600).call(c.zoom.transform,
          d3.zoomIdentity.translate((c.W-sc*(x0+x1))/2,(c.H-sc*(y0+y1))/2).scale(sc));
      }, 400);
    },
  }));

  const prepared = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [String(n.id), n]));
    const simNodes: SimNode[] = nodes.map(n => ({ ...n }));
    const simLinks: SimLink[] = edges
      .filter(e => nodeMap.has(String(e.from)) && nodeMap.has(String(e.to)))
      .map(e => ({ id: String(e.id), type: String(e.type), source: String(e.from), target: String(e.to) }));
    return { simNodes, simLinks, nodeMap };
  }, [nodes, edges]);

  // ── EFFECT 1: build simulation + draw (no selectedNodeId dep) ──────────
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    const { width: W, height: H } = containerRef.current.getBoundingClientRect();
    const T = getTheme();

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const defs = svg.append("defs");

    // Dot grid
    const pid = `p-${Math.random().toString(36).slice(2)}`;
    const pat = defs.append("pattern").attr("id", pid).attr("width", 24).attr("height", 24).attr("patternUnits", "userSpaceOnUse");
    pat.append("rect").attr("width", 24).attr("height", 24).attr("fill", T.bg);
    pat.append("circle").attr("cx", 12).attr("cy", 12).attr("r", 0.85).attr("fill", T.dot);

    // Glow filter
    const gid = `g-${Math.random().toString(36).slice(2)}`;
    glowIdRef.current = gid;
    const gf = defs.append("filter").attr("id", gid).attr("x","-60%").attr("y","-60%").attr("width","220%").attr("height","220%");
    gf.append("feGaussianBlur").attr("in","SourceGraphic").attr("stdDeviation", 7).attr("result","b");
    const fm = gf.append("feMerge");
    fm.append("feMergeNode").attr("in","b"); fm.append("feMergeNode").attr("in","SourceGraphic");

    // Arrow markers
    const arrowId: Record<string, string> = {};
    (["CONTAINS","IMPORTS","CALLS"] as const).forEach(cat => {
      const id = `a-${cat}-${Math.random().toString(36).slice(2)}`;
      arrowId[cat] = id;
      defs.append("marker").attr("id", id).attr("viewBox","0 -4 8 8").attr("refX", 7).attr("refY", 0).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient","auto")
        .append("path").attr("d","M0,-4L8,0L0,4").attr("fill", T.edge[cat]).attr("fill-opacity", 0.85);
    });

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", `url(#${pid})`);
    const g = svg.append("g");

    // ── Focus/dimming (only when multi-node focus is active) ────────────
    const pathSet = new Set(pathNodeIds);
    const hlSet   = new Set(highlightNodeIds);
    const tourSet = new Set(tourHighlightNodeIds ?? []);
    const hasFocus = pathSet.size > 1 || tourSet.size > 0 || hlSet.size > 1;
    const nodeOp = (id: string) => {
      if (!hasFocus) return 1;
      if (pathSet.size > 1) return pathSet.has(id) ? 1 : 0.1;
      if (tourSet.size > 0) return tourSet.has(id) ? 1 : 0.1;
      if (hlSet.size > 1)   return hlSet.has(id)   ? 1 : 0.1;
      return 1;
    };
    const edgeOp = (s: string, t: string) => {
      if (!hasFocus) return 0.25;
      if (pathSet.size > 1) return pathSet.has(s) && pathSet.has(t) ? 0.9 : 0.04;
      if (tourSet.size > 0) return tourSet.has(s) || tourSet.has(t)  ? 0.6 : 0.04;
      if (hlSet.size > 1)   return hlSet.has(s)   || hlSet.has(t)    ? 0.7 : 0.04;
      return 0.25;
    };

    // ── Simulation — pre-tick offline so graph arrives settled ──────────
    const simulation = d3.forceSimulation<SimNode>(prepared.simNodes)
      .force("link",
        d3.forceLink<SimNode, SimLink>(prepared.simLinks).id(d => String(d.id))
          .distance(l => {
            const s = (typeof l.source==="string"?prepared.nodeMap.get(l.source):l.source) as SimNode|undefined;
            const t = (typeof l.target==="string"?prepared.nodeMap.get(l.target):l.target) as SimNode|undefined;
            if (s?.kind==="folder"&&t?.kind==="folder") return 260;
            if (s?.kind==="folder"||t?.kind==="folder") return 160;
            if (s?.kind==="file"||t?.kind==="file") return 100;
            return 65;
          }).strength(0.7),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(d => {
        const k = (d as SimNode).kind;
        return k==="folder"?-1200 : k==="file"?-650 : k==="class"?-400 : -250;
      }))
      .force("center",  d3.forceCenter(W/2, H/2))
      .force("collide", d3.forceCollide<SimNode>().radius(d => nodeR(d.kind)+46).strength(0.95))
      .stop();

    const ticks = Math.min(500, Math.max(180, 800 - Math.floor(prepared.simNodes.length * 0.6)));
    for (let i = 0; i < ticks; i++) simulation.tick();

    const ex2 = (d: SimLink) => {
      const s=d.source as SimNode, t=d.target as SimNode;
      const dx=(t.x??0)-(s.x??0), dy=(t.y??0)-(s.y??0), len=Math.sqrt(dx*dx+dy*dy)||1;
      return (t.x??0)-(dx/len)*(nodeR(t.kind)+3);
    };
    const ey2 = (d: SimLink) => {
      const s=d.source as SimNode, t=d.target as SimNode;
      const dx=(t.x??0)-(s.x??0), dy=(t.y??0)-(s.y??0), len=Math.sqrt(dx*dx+dy*dy)||1;
      return (t.y??0)-(dy/len)*(nodeR(t.kind)+3);
    };

    // ── Edges ────────────────────────────────────────────────────────────
    const link = g.append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(prepared.simLinks, d => d.id)
      .join("line")
      .attr("stroke", d => T.edge[edgeCat(d.type)]??T.edge.CONTAINS)
      .attr("stroke-dasharray", d => { const c=edgeCat(d.type); return c==="CALLS"?"3 5":c==="IMPORTS"?"6 3":"none"; })
      .attr("stroke-width", d => {
        const si=typeof d.source==="string"?d.source:String((d.source as SimNode).id);
        const ti=typeof d.target==="string"?d.target:String((d.target as SimNode).id);
        return pathSet.has(si)&&pathSet.has(ti)?2.5:1;
      })
      .attr("stroke-opacity", d => {
        const si=typeof d.source==="string"?d.source:String((d.source as SimNode).id);
        const ti=typeof d.target==="string"?d.target:String((d.target as SimNode).id);
        return edgeOp(si, ti);
      })
      .attr("marker-end", d => { const c=edgeCat(d.type); return c!=="CONTAINS"?`url(#${arrowId[c]})`:null as any; })
      .attr("x1", d=>(d.source as SimNode).x??0).attr("y1", d=>(d.source as SimNode).y??0)
      .attr("x2", ex2).attr("y2", ey2);

    // ── Nodes ────────────────────────────────────────────────────────────
    const nodeG = g.append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(prepared.simNodes, d => String(d.id))
      .join("g")
      .attr("cursor", "pointer")
      .attr("data-nid", d => String(d.id))
      .attr("transform", d => `translate(${d.x??0},${d.y??0})`)
      .call(
        d3.drag<SVGGElement, SimNode>()
          // ── No simulation restart on drag — prevents click-triggered movement ──
          .on("start", (_, d) => { d.fx=d.x; d.fy=d.y; })
          .on("drag", (event, d) => {
            d.fx=event.x; d.fy=event.y; d.x=event.x; d.y=event.y;
            d3.select(event.sourceEvent.target?.closest?.("[data-nid]") ?? event.currentTarget as Element)
              .attr("transform", `translate(${d.x},${d.y})`);
            const nid = String(d.id);
            link.filter(l => {
              const si=typeof l.source==="string"?l.source:String((l.source as SimNode).id);
              const ti=typeof l.target==="string"?l.target:String((l.target as SimNode).id);
              return si===nid||ti===nid;
            })
            .attr("x1", l=>(l.source as SimNode).x??0).attr("y1", l=>(l.source as SimNode).y??0)
            .attr("x2", ex2).attr("y2", ey2);
          })
          .on("end", (_, d) => { d.fx=d.x; d.fy=d.y; }), // pin where dropped
      )
      .on("click", (event: MouseEvent, d) => {
        event.stopPropagation();
        onNodeClick(d, event);
      });

    // Selection ring (class "ring" so Effect 2 can update it)
    nodeG.append("circle").attr("class","ring")
      .attr("r", d => nodeR(d.kind)+9).attr("fill","none")
      .attr("stroke","none").attr("stroke-width", 2.5).attr("stroke-opacity", 0.85);

    // Main circle — solid fill, white border for contrast
    nodeG.append("circle").attr("class","circ")
      .attr("r", d => nodeR(d.kind))
      .attr("fill", d => T[d.kind as KindKey]?.fill ?? T.file.fill)
      .attr("stroke","rgba(255,255,255,0.35)").attr("stroke-width", 1.5)
      .attr("opacity", d => nodeOp(String(d.id)));

    // Lucide icon — scale(s) translate(-12,-12) centers the 24×24 path at origin
    nodeG.append("g").attr("class","icon")
      .attr("transform", d => { const s=nodeR(d.kind)*0.055; return `scale(${s}) translate(-12,-12)`; })
      .attr("opacity", d => nodeOp(String(d.id)))
      .append("path")
      .attr("d", d => ICON_PATH[d.kind])
      .attr("fill","none").attr("stroke","rgba(255,255,255,0.95)")
      .attr("stroke-width", 2).attr("stroke-linecap","round").attr("stroke-linejoin","round")
      .style("pointer-events","none");

    // Label pill — only for nodes with readable (non-hash) names
    const CW=6.4, PH=20, PP=10;
    const showLabel = (d: SimNode) => shouldShowLabel(d.displayLabel, d.kind);
    const lx = (d: SimNode) => nodeR(d.kind)+8;

    nodeG.filter(showLabel).append("rect")
      .attr("class","lpill")
      .attr("x", lx).attr("y",-PH/2).attr("rx",5).attr("height",PH)
      .attr("width", d => trim(d.displayLabel).length*CW+PP)
      .attr("fill",   d => T[d.kind as KindKey]?.labelBg  ?? T.file.labelBg)
      .attr("stroke", d => T[d.kind as KindKey]?.fill     ?? T.file.fill)
      .attr("stroke-width",0.75)
      .attr("opacity", d => nodeOp(String(d.id)));

    nodeG.filter(showLabel).append("text")
      .attr("class","ltxt")
      .text(d => trim(d.displayLabel))
      .attr("x", d => lx(d)+PP/2).attr("y", 4)
      .style("font-size","10.5px")
      .style("font-family","'JetBrains Mono','Fira Code',ui-monospace,monospace")
      .style("font-weight","500").style("pointer-events","none")
      .attr("fill", d => T[d.kind as KindKey]?.labelText ?? T.file.labelText)
      .attr("opacity", d => nodeOp(String(d.id)));

    // ── Gentle final settle (very brief) ─────────────────────────────────
    simulation.alpha(0.05).alphaDecay(0.06)
      .on("tick", () => {
        link.attr("x1",d=>(d.source as SimNode).x??0).attr("y1",d=>(d.source as SimNode).y??0).attr("x2",ex2).attr("y2",ey2);
        nodeG.attr("transform", d=>`translate(${d.x??0},${d.y??0})`);
      }).restart();

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.05,6])
      .on("zoom", ev => g.attr("transform", ev.transform.toString()));
    svg.call(zoom);
    ctrlRef.current = { zoom, svgSel: svg, simulation, simNodes: prepared.simNodes, W, H };

    return () => simulation.stop();
  // selectedNodeId intentionally NOT in deps — selection is updated by Effect 2
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, mode, pathNodeIds, highlightNodeIds, tourHighlightNodeIds, activeTourNodeId]);

  // ── EFFECT 2: update selection rings WITHOUT re-running simulation ─────
  useEffect(() => {
    if (!svgRef.current) return;
    const T = getTheme();
    const multiSet = new Set(selectedNodeIds);
    const gid = glowIdRef.current;

    d3.select(svgRef.current)
      .selectAll<SVGGElement, SimNode>("[data-nid]")
      .each(function(d) {
        const id = String(d.id);
        const isPrimary = id === selectedNodeId;
        const isMulti   = multiSet.has(id) && !isPrimary;
        const isTour    = id === activeTourNodeId;
        const color = isPrimary ? (T[d.kind as KindKey]?.bright ?? T.file.bright)
                    : isMulti  ? T.multi.ring
                    : isTour   ? T.tour.bright
                    : "none";
        const el = d3.select(this);
        el.select(".ring")
          .attr("stroke", color)
          .attr("stroke-opacity", (isPrimary||isMulti||isTour) ? 0.85 : 0)
          .attr("filter", isPrimary ? `url(#${gid})` : "none");
        el.select(".circ")
          .attr("stroke", (isPrimary||isMulti) ? color : "rgba(255,255,255,0.35)")
          .attr("stroke-width", (isPrimary||isMulti) ? 2.5 : 1.5);
      });
  }, [selectedNodeId, selectedNodeIds, activeTourNodeId]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
});