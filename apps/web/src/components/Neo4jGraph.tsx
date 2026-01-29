import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { Simulation, D3DragEvent, D3ZoomEvent } from "d3";

export type Neo4jNode = {
  id: string;
  labels: string[];
  properties: Record<string, any>;
};

export type Neo4jEdge = {
  id: string;
  type: string;
  from: string;
  to: string;
  properties?: Record<string, any>;
};

type SimNode = Neo4jNode & d3.SimulationNodeDatum;
type SimLink = {
  id: string;
  type: string;
  source: string | SimNode;
  target: string | SimNode;
} & d3.SimulationLinkDatum<SimNode>;

export function Neo4jGraph({
  nodes,
  edges,
  onNodeClick,
}: {
  nodes: Neo4jNode[];
  edges: Neo4jEdge[];
  onNodeClick: (node: Neo4jNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { simNodes, simLinks, nodeById } = useMemo(() => {
    const nodeById = new Map<string, Neo4jNode>();
    for (const n of nodes) nodeById.set(String(n.id), n);

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n } as SimNode));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeById.has(String(e.from)) && nodeById.has(String(e.to)))
      .map((e) => ({
        id: String(e.id),
        type: String(e.type),
        source: String(e.from),
        target: String(e.to),
      })) as SimLink[];

    return { simNodes, simLinks, nodeById };
  }, [nodes, edges]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => String(d.id))
          .distance(80)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4));

    const link = svg
      .select(".links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-opacity", 0.55);

    const node = svg
      .select(".nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag(simulation));

    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => nodeFill(d))
      .attr("stroke", "#f9fafb")
      .attr("stroke-width", 1.5);

    node
      .append("text")
      .text((d) => nodeLabel(d))
      .attr("x", 14)
      .attr("y", 5)
      .attr("fill", "#d1d5db")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px #000");

    node.on("click", function (_event, d) {
      const real = nodeById.get(String(d.id));
      if (real) onNodeClick(real);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (l) => (l.source as SimNode)?.x ?? 0)
        .attr("y1", (l) => (l.source as SimNode)?.y ?? 0)
        .attr("x2", (l) => (l.target as SimNode)?.x ?? 0)
        .attr("y2", (l) => (l.target as SimNode)?.y ?? 0);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      svg.selectAll("g").attr("transform", event.transform.toString());
    });
    svg.call(zoom);

    return () => simulation.stop();
  }, [simNodes, simLinks, nodeById, onNodeClick]);

  const drag = (simulation: Simulation<SimNode, SimLink>) => {
    function dragstarted(event: D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode): void {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode): void {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode): void {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag<SVGGElement, SimNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full">
        <g className="links" />
        <g className="nodes" />
      </svg>
    </div>
  );
}

function hasLabel(n: Neo4jNode, label: string): boolean {
  return (n.labels ?? []).includes(label);
}

function nodeRadius(n: Neo4jNode): number {
  if (hasLabel(n, "Directory")) return 12;
  if (hasLabel(n, "Repo")) return 14;
  if (hasLabel(n, "CodeFile") || hasLabel(n, "TextFile")) return 9;
  if (hasLabel(n, "Import") || hasLabel(n, "ExternalModule")) return 8;
  return 7;
}

function nodeFill(n: Neo4jNode): string {
  if (hasLabel(n, "Directory")) return "#2563eb";
  if (hasLabel(n, "Repo")) return "#f59e0b";
  if (hasLabel(n, "CodeFile") || hasLabel(n, "TextFile")) return "#10b981";
  if (hasLabel(n, "CallSite")) return "#a78bfa";
  return "#64748b";
}

function nodeLabel(n: Neo4jNode): string {
  const p = n.properties ?? {};
  return (
    p.name ||
    p.relPath ||
    p.fileRelPath ||
    p.normalized ||
    p.raw ||
    (n.labels?.[0] ? `${n.labels[0]}` : "Node")
  );
}
