
import { useEffect, useMemo, useRef } from "react";
import type { CodeNode, D3Node, D3Link } from "@CodeAtlas/api/types/codeNode";

// import type * as d3 from 'd3';
                                
// declare const d3: any;
import * as d3 from 'd3';

interface KnowledgeGraphProps {
  data: CodeNode;
  onNodeClick: (node: CodeNode) => void;
  selectedNodePath: string | null;
}

const flattenData = (node: CodeNode, parentId: string | null, nodes: D3Node[], links: D3Link[]) => {
  const nodeId = node.path;
  nodes.push({ ...node, id: nodeId });

  if (parentId) {
    links.push({ source: parentId, target: nodeId });
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
  

  const { nodes, links } = useMemo(() => {
    const nodes: D3Node[] = [];
    const links: D3Link[] = [];
    flattenData(data, null, nodes, links);
    return { nodes, links };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(60).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => (d.isDirectory ? 15 : 10) + 2));

    const link = svg.select(".links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4b5563") // gray-600
      .attr("stroke-opacity", 0.6);

    const node = svg.select(".nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag(simulation));

    node.append("circle")
      .attr("r", (d: any) => d.isDirectory ? 12 : 7)
      .attr("fill", (d: any) => d.isDirectory ? '#2563eb' : '#10b981') // blue-600 : emerald-500
      .attr("stroke", "#f9fafb") // gray-50
      .attr("stroke-width", 1.5);

    node.append("text")
      .text((d: any) => d.file)
      .attr("x", 15)
      .attr("y", 5)
      .attr("fill", "#d1d5db") // gray-300
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px #000");

    node.on('click', (event: any, d: any) => {
      onNodeClick(d);
    });
    
    node.on('mouseover', (event: any, d: any) => {
      d3.select(event.currentTarget).select('circle').attr('r', (d: any) => (d.isDirectory ? 16 : 10));
      d3.select(event.currentTarget).select('text').style('font-weight', 'bold');
    }).on('mouseout', (event: any, d: any) => {
      if (d.path !== selectedNodePath) {
        d3.select(event.currentTarget).select('circle').attr('r', (d: any) => (d.isDirectory ? 12 : 7));
      }
      d3.select(event.currentTarget).select('text').style('font-weight', 'normal');
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    const zoom = d3.zoom().on("zoom", (event: any) => {
      svg.selectAll('g').attr('transform', event.transform);
    });

    svg.call(zoom as any);

    return () => {
      simulation.stop();
    };
  }, [nodes, links, onNodeClick]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll(".nodes g circle")
      .transition()
      .duration(300)
      .attr('r', (d: any) => {
          const baseRadius = d.isDirectory ? 12 : 7;
          return d.path === selectedNodePath ? baseRadius + 4 : baseRadius;
      })
      .attr('stroke', (d: any) => d.path === selectedNodePath ? '#34d399' : '#f9fafb'); // emerald-400
  }, [selectedNodePath]);


  const drag = (simulation: any) => {
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
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
