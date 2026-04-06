import { useEffect, useMemo, useRef } from "react";
import type { CodeNode, D3Node, D3Link } from "@CodeAtlas/api/types/codeNode";
import * as d3 from 'd3';
import type { Simulation, D3DragEvent, D3ZoomEvent } from 'd3';

// add simulation-aware local types
type SimNode = D3Node & d3.SimulationNodeDatum;
type SimLink = D3Link & d3.SimulationLinkDatum<SimNode>;

interface KnowledgeGraphProps {
  data: CodeNode;
  onNodeClick: (node: CodeNode) => void;
  selectedNodePath: string | null;
}

// change flattenData to populate SimNode/SimLink arrays
const flattenData = (node: CodeNode, parentId: string | null, nodes: SimNode[], links: D3Link[]): void => {
  const nodeId = node.path;
  // node object from CodeNode meets SimNode (SimulationNodeDatum props added by d3 at runtime)
  nodes.push({ ...node, id: nodeId } as SimNode);

  if (parentId) {
    links.push({ source: parentId, target: nodeId } as D3Link);
  }

  if (node.children && node.children.length > 0) {
    node.children.forEach((child: CodeNode) => {
        flattenData(child, nodeId, nodes, links);
    });
  }
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onNodeClick, selectedNodePath }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, links, nodeById } = useMemo(() => {
    const nodes: SimNode[] = [];
    const links: D3Link[] = [];
    flattenData(data, null, nodes, links);

    // build a stable map id -> original CodeNode so we can call onNodeClick with correct type
    const nodeById = new Map<string, CodeNode>();
    nodes.forEach(n => {
      const id = String(n.id);
      // SimNode contains the same fields as the original CodeNode; assert safely
      nodeById.set(id, n as unknown as CodeNode);
    });

    return { nodes, links, nodeById };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // cast links to SimLink[] only where d3 needs SimulationLinkDatum generics
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links as unknown as SimLink[]).id((d: SimNode) => d.id as string).distance(60).strength(0.5))
      .force("charge", d3.forceManyBody<SimNode>().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d: SimNode) => (d.isDirectory ? 15 : 10) + 2));

    const link = svg.select(".links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links as unknown as SimLink[])
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-opacity", 0.6);

    const node = svg.select(".nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag(simulation));

    node.append("circle")
      .attr("r", (d: SimNode) => d.isDirectory ? 12 : 7)
      .attr("fill", (d: SimNode) => d.isDirectory ? '#2563eb' : '#10b981')
      .attr("stroke", "#f9fafb")
      .attr("stroke-width", 1.5);

    node.append("text")
      .text((d: SimNode) => d.file)
      .attr("x", 15)
      .attr("y", 5)
      .attr("fill", "#d1d5db")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px #000");

    node.on('click', function(this: SVGGElement, _event: Event, d: SimNode) {
      const codeNode = nodeById.get(String(d.id));
      if (codeNode) onNodeClick(codeNode);
    });

    node.on('mouseover', function(this: SVGGElement, _event: Event, d: SimNode) {
      d3.select(this).select('circle').attr('r', d.isDirectory ? 16 : 10);
      d3.select(this).select('text').style('font-weight', 'bold');
    }).on('mouseout', function(this: SVGGElement, _event: Event, d: SimNode) {
      if (d.path !== selectedNodePath) {
        d3.select(this).select('circle').attr('r', d.isDirectory ? 12 : 7);
      }
      d3.select(this).select('text').style('font-weight', 'normal');
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (l: SimLink) => {
          const s = l.source as SimNode;
          return s?.x ?? 0;
        })
        .attr("y1", (l: SimLink) => {
          const s = l.source as SimNode;
          return s?.y ?? 0;
        })
        .attr("x2", (l: SimLink) => {
          const t = l.target as SimNode;
          return t?.x ?? 0;
        })
        .attr("y2", (l: SimLink) => {
          const t = l.target as SimNode;
          return t?.y ?? 0;
        });

      node
        .attr("transform", (d: SimNode) => `translate(${d.x},${d.y})`);
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      svg.selectAll('g').attr('transform', event.transform.toString());
    });

    svg.call(zoom);

    return () => {
      simulation.stop();
    };
  }, [nodes, links, onNodeClick, selectedNodePath, nodeById]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGCircleElement, SimNode>(".nodes g circle")
      .transition()
      .duration(300)
      .attr('r', (d: SimNode) => {
          const baseRadius = d.isDirectory ? 12 : 7;
          return d.path === selectedNodePath ? baseRadius + 4 : baseRadius;
      })
      .attr('stroke', (d: SimNode) => d.path === selectedNodePath ? '#34d399' : '#f9fafb');
  }, [selectedNodePath]);

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

    return d3.drag<SVGGElement, SimNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full">
        <g className="links"></g>
        <g className="nodes"></g>
      </svg>
    </div>
  );
};
