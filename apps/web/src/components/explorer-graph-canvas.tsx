import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { Neo4jEdge, Neo4jNode } from "@/components/Neo4jGraph";

export type ExplorerNodeKind = "folder" | "file" | "class" | "fn";

export type ExplorerNode = Neo4jNode & {
  kind: ExplorerNodeKind;
  displayLabel: string;
};

type SimNode = ExplorerNode & d3.SimulationNodeDatum;
type SimLink = {
  id: string;
  type: string;
  source: string | SimNode;
  target: string | SimNode;
} & d3.SimulationLinkDatum<SimNode>;

export function classifyNode(node: Neo4jNode): ExplorerNodeKind {
  const labels = node.labels ?? [];
  if (labels.includes("Repository") || labels.includes("Repo") || labels.includes("Folder") || labels.includes("Directory")) {
    return "folder";
  }
  if (labels.includes("Class") || labels.includes("Interface") || labels.includes("Enum")) {
    return "class";
  }
  if (labels.includes("Chunk") || labels.includes("Function") || labels.includes("Method") || labels.includes("CallSite") || labels.includes("CallSiteSummary")) {
    return "fn";
  }
  return "file";
}

export function nodeDisplayLabel(node: Neo4jNode): string {
  const props = node.properties ?? {};
  return String(
    props.name ??
      props.displayName ??
      props.path?.split(/[\\/]/).pop() ??
      props.filePath?.split(/[\\/]/).pop() ??
      props.symbol ??
      props.text ??
      node.id,
  );
}

function nodeFill(kind: ExplorerNodeKind) {
  if (kind === "folder") return "var(--purple-l)";
  if (kind === "class") return "var(--amber-l)";
  if (kind === "fn") return "var(--green-l)";
  return "var(--blue-l)";
}

function nodeStroke(kind: ExplorerNodeKind) {
  if (kind === "folder") return "var(--purple)";
  if (kind === "class") return "var(--amber)";
  if (kind === "fn") return "var(--green)";
  return "var(--blue)";
}

function edgeStroke(type: string) {
  const t = String(type).toUpperCase();
  if (t.includes("CALL")) return "var(--green)";
  if (t.includes("IMPORT")) return "var(--blue)";
  return "var(--purple)";
}

function edgeDash(type: string) {
  const t = String(type).toUpperCase();
  if (t.includes("CALL")) return "2 4";
  if (t.includes("IMPORT")) return "5 3";
  return undefined;
}

function nodeRadius(kind: ExplorerNodeKind) {
  if (kind === "folder") return 18;
  if (kind === "class") return 16;
  if (kind === "fn") return 12;
  return 14;
}

function trimLabel(label: string, max = 18) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function ExplorerGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  mode,
  pathNodeIds,
  highlightNodeIds,
  tourHighlightNodeIds,
}: {
  nodes: ExplorerNode[];
  edges: Neo4jEdge[];
  selectedNodeId: string | null;
  onNodeClick: (node: ExplorerNode) => void;
  mode: string;
  pathNodeIds: string[];
  highlightNodeIds: string[];
  tourHighlightNodeIds?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const prepared = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [String(n.id), n]));
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeMap.has(String(e.from)) && nodeMap.has(String(e.to)))
      .map((e) => ({ id: String(e.id), type: String(e.type), source: String(e.from), target: String(e.to) }));
    return { simNodes, simLinks, nodeMap };
  }, [nodes, edges]);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");
    const linkLayer = g.append("g");
    const nodeLayer = g.append("g");

    const simulation = d3
      .forceSimulation<SimNode>(prepared.simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(prepared.simLinks)
          .id((d) => String(d.id))
          .distance((l) => {
            const source = typeof l.source === "string" ? prepared.nodeMap.get(l.source) : l.source;
            const target = typeof l.target === "string" ? prepared.nodeMap.get(l.target) : l.target;
            if (source?.kind === "folder" && target?.kind === "folder") return 170;
            if (source?.kind === "folder" || target?.kind === "folder") return 130;
            return 95;
          })
          .strength(0.6),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-520))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => nodeRadius(d.kind) + 28));

    const pathSet = new Set(pathNodeIds);
    const highlightSet = new Set(highlightNodeIds);
    const tourHighlightSet = new Set(tourHighlightNodeIds ?? []);

    const link = linkLayer
      .selectAll("line")
      .data(prepared.simLinks, (d: any) => d.id)
      .join("line")
      .attr("stroke", (d) => edgeStroke(d.type))
      .attr("stroke-dasharray", (d) => edgeDash(d.type) ?? null)
      .attr("stroke-width", (d) => {
        const sourceId = typeof d.source === "string" ? d.source : String(d.source.id);
        const targetId = typeof d.target === "string" ? d.target : String(d.target.id);
        return pathSet.has(sourceId) && pathSet.has(targetId) ? 2.2 : 1.1;
      })
      .attr("stroke-opacity", (d) => {
        const sourceId = typeof d.source === "string" ? d.source : String(d.source.id);
        const targetId = typeof d.target === "string" ? d.target : String(d.target.id);
        if (pathSet.size > 1) return pathSet.has(sourceId) && pathSet.has(targetId) ? 0.95 : 0.12;
        if (highlightSet.size > 0) return highlightSet.has(sourceId) || highlightSet.has(targetId) ? 0.9 : 0.1;
        return 0.55;
      });

    const node = nodeLayer
      .selectAll("g")
      .data(prepared.simNodes, (d: any) => d.id)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (_, d) => onNodeClick(d));

    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d.kind))
      .attr("fill", (d) => (tourHighlightSet.has(String(d.id)) ? "#ef4444" : nodeFill(d.kind)))
      .attr("stroke", (d) => (tourHighlightSet.has(String(d.id)) ? "#dc2626" : nodeStroke(d.kind)))
      .attr("stroke-width", (d) => {
        if (String(d.id) === selectedNodeId) return 3;
        if (pathSet.has(String(d.id)) || highlightSet.has(String(d.id)) || tourHighlightSet.has(String(d.id))) return 2.5;
        return 1.4;
      })
      .attr("opacity", (d) => {
        if (pathSet.size > 0) return pathSet.has(String(d.id)) ? 1 : 0.2;
        if (tourHighlightSet.size > 0) return tourHighlightSet.has(String(d.id)) ? 1 : 0.24;
        if (highlightSet.size > 0) return highlightSet.has(String(d.id)) ? 1 : 0.24;
        return 1;
      });

    node
      .append("rect")
      .attr("x", (d) => nodeRadius(d.kind) + 8)
      .attr("y", -12)
      .attr("rx", 6)
      .attr("height", 24)
      .attr("width", (d) => trimLabel(d.displayLabel).length * 7.5 + 16)
      .attr("fill", "var(--s0)")
      .attr("stroke", (d) => (tourHighlightSet.has(String(d.id)) ? "#dc2626" : nodeStroke(d.kind)))
      .attr("stroke-width", 1)
      .attr("opacity", (d) => {
        if (pathSet.size > 0) return pathSet.has(String(d.id)) ? 0.98 : 0.15;
        if (tourHighlightSet.size > 0) return tourHighlightSet.has(String(d.id)) ? 0.98 : 0.18;
        if (highlightSet.size > 0) return highlightSet.has(String(d.id)) ? 0.98 : 0.18;
        return 0.96;
      });

    node
      .append("text")
      .attr("x", (d) => nodeRadius(d.kind) + 16)
      .attr("y", 5)
      .text((d) => trimLabel(d.displayLabel))
      .attr("fill", (d) => (tourHighlightSet.has(String(d.id)) ? "#ef4444" : nodeStroke(d.kind)))
      .style("font-size", "11px")
      .style("font-family", "var(--mono)")
      .style("pointer-events", "none")
      .attr("opacity", (d) => {
        if (pathSet.size > 0) return pathSet.has(String(d.id)) ? 1 : 0.2;
        if (tourHighlightSet.size > 0) return tourHighlightSet.has(String(d.id)) ? 1 : 0.22;
        if (highlightSet.size > 0) return highlightSet.has(String(d.id)) ? 1 : 0.22;
        return 1;
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    svg.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      }),
    );

    return () => simulation.stop();
  }, [prepared, selectedNodeId, onNodeClick, mode, pathNodeIds, highlightNodeIds, tourHighlightNodeIds]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
