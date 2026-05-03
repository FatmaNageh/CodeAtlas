import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { D3DragEvent, D3ZoomEvent } from "d3";
import type { GraphData, GraphEdge, GraphKind, GraphNode } from "@/graph/types";
import { getNodeKind, getNodeLabel, getNodePath } from "@/graph/model";

interface SimNode extends GraphNode, d3.SimulationNodeDatum {
  kind: GraphKind;
  label: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  source: string | SimNode;
  target: string | SimNode;
}

const kindColor: Record<GraphKind, string> = {
  repo: "#f0c674",
  folder: "#c792ea",
  file: "#75beff",
  class: "#e9c46a",
  fn: "#89d185",
  callsite: "#8a8f98",
  import: "#6f7682",
};

function nodeRadius(kind: GraphKind): number {
  switch (kind) {
    case "repo":
      return 18;
    case "folder":
      return 14;
    case "file":
      return 11;
    case "class":
      return 10;
    case "fn":
      return 8;
    case "callsite":
    case "import":
      return 6;
  }
}

function edgeEndpoint(value: string | SimNode): string {
  return typeof value === "string" ? value : value.id;
}

export function GraphCanvas({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  graph: GraphData;
  selectedNodeId: string;
  onSelectNode: (node: GraphNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const selectedRef = useRef(selectedNodeId);

  useEffect(() => {
    selectedRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const prepared = useMemo(() => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const nodes: SimNode[] = graph.nodes.map((node) => ({
      ...node,
      kind: getNodeKind(node),
      label: getNodeLabel(node),
    }));
    const links: SimLink[] = graph.edges
      .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
      .map((edge: GraphEdge) => ({
        id: edge.id,
        type: edge.type,
        source: edge.from,
        target: edge.to,
      }));
    return { nodes, links };
  }, [graph]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const bounds = svgElement.getBoundingClientRect();
    const width = Math.max(bounds.width, 720);
    const height = Math.max(bounds.height, 460);
    const svg = d3.select<SVGSVGElement, undefined>(svgElement);
    svg.selectAll("*").remove();

    const root = svg.append("g").attr("class", "graph-root");
    const linkLayer = root.append("g").attr("class", "graph-links");
    const nodeLayer = root.append("g").attr("class", "graph-nodes");

    const zoom = d3
      .zoom<SVGSVGElement, undefined>()
      .scaleExtent([0.18, 4])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, undefined>) => {
        root.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    const links = linkLayer
      .selectAll<SVGLineElement, SimLink>("line")
      .data(prepared.links, (link) => link.id)
      .join("line")
      .attr("class", "graph-link")
      .attr("stroke-width", (link) => (link.type === "CONTAINS" ? 1.4 : 1));

    const nodes = nodeLayer
      .selectAll<SVGGElement, SimNode>("g")
      .data(prepared.nodes, (node) => node.id)
      .join((enter) => {
        const group = enter.append("g").attr("class", "graph-node").attr("tabindex", 0);
        group
          .append("circle")
          .attr("r", (node) => nodeRadius(node.kind))
          .attr("fill", (node) => kindColor[node.kind]);
        group
          .append("text")
          .attr("x", 14)
          .attr("y", 4)
          .text((node) => node.label);
        group.append("title").text((node) => {
          const path = getNodePath(node);
          return path ? `${node.label}\n${path}` : node.label;
        });
        return group;
      });

    function updateSelection() {
      nodes.classed("selected", (node) => node.id === selectedRef.current);
    }

    nodes.on("click", (_event, node) => {
      selectedRef.current = node.id;
      updateSelection();
      onSelectNode(node);
    });

    nodes.on("keydown", (event: KeyboardEvent, node) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectedRef.current = node.id;
      updateSelection();
      onSelectNode(node);
    });

    const simulation = d3
      .forceSimulation<SimNode>(prepared.nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(prepared.links)
          .id((node) => node.id)
          .distance((link) => (link.type === "CONTAINS" ? 52 : 105))
          .strength((link) => (link.type === "CONTAINS" ? 0.75 : 0.2)),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-420))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((node) => nodeRadius(node.kind) + 14));

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event: D3DragEvent<SVGGElement, SimNode, SimNode>, node) => {
        if (!event.active) simulation.alphaTarget(0.22).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event: D3DragEvent<SVGGElement, SimNode, SimNode>, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event: D3DragEvent<SVGGElement, SimNode, SimNode>, node) => {
        if (!event.active) simulation.alphaTarget(0);
        node.fx = null;
        node.fy = null;
      });
    nodes.call(drag);

    simulation.on("tick", () => {
      links
        .attr("x1", (link) => {
          const source = link.source as SimNode;
          return source.x ?? 0;
        })
        .attr("y1", (link) => {
          const source = link.source as SimNode;
          return source.y ?? 0;
        })
        .attr("x2", (link) => {
          const target = link.target as SimNode;
          return target.x ?? 0;
        })
        .attr("y2", (link) => {
          const target = link.target as SimNode;
          return target.y ?? 0;
        });

      nodes.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
    });

    const linkedIds = new Set<string>();
    for (const link of prepared.links) {
      linkedIds.add(edgeEndpoint(link.source));
      linkedIds.add(edgeEndpoint(link.target));
    }
    nodes.classed("island", (node) => !linkedIds.has(node.id));
    updateSelection();

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [onSelectNode, prepared]);

  return <svg ref={svgRef} className="graph-canvas" role="img" aria-label="CodeAtlas knowledge graph" />;
}
