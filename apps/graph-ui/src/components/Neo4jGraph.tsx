import { useEffect, useMemo, useRef, useState } from "react";
// Tooltip component
function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      left: x + 12,
      top: y + 12,
      background: 'rgba(30,41,59,0.98)',
      color: '#f3f4f6',
      borderRadius: 6,
      padding: '7px 14px',
      fontSize: 14,
      boxShadow: '0 2px 12px #000a',
      zIndex: 100,
      pointerEvents: 'none',
      border: '1px solid #334155',
      maxWidth: 320,
      whiteSpace: 'pre-line',
    }}>{children}</div>
  );
}

// Draggable floating panel for node details
// ...existing code...
import * as d3 from "d3";
import type { D3DragEvent, D3ZoomEvent } from "d3";

export type Neo4jNode = {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
};

export type Neo4jEdge = {
  id: string;
  type: string;
  from: string;
  to: string;
  properties?: Record<string, unknown>;
};

type SimNode = Neo4jNode & d3.SimulationNodeDatum;
type SimLink = {
  id: string;
  type: string;
  source: string | SimNode;
  target: string | SimNode;
} & d3.SimulationLinkDatum<SimNode>;

// Helper to pretty-print JSON
function prettyJSON(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

export function Neo4jGraph({
  nodes,
  edges,
  onNodeClick,
}: {
  nodes: Neo4jNode[];
  edges: Neo4jEdge[];
  onNodeClick: (node: Neo4jNode) => void;
}) {
  // --- Filter/Search State ---
  const [selectedNodeId, setSelectedNodeId] = useState<string|null>(null);
  const [selectedNode, setSelectedNode] = useState<Neo4jNode|null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string|null>(null);
  const [hoveredNode, setHoveredNode] = useState<Neo4jNode|null>(null);
  const [hoverPos, setHoverPos] = useState<{x:number,y:number}|null>(null);

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  // Collapse CallSite nodes by default
  const [collapseCallSites, setCollapseCallSites] = useState(true);
  const [expandedCallSiteParents, setExpandedCallSiteParents] = useState<string[]>([]);

  // Collect all node types (labels)
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    nodes.forEach((n) => n.labels?.forEach((l) => types.add(l)));
    return Array.from(types);
  }, [nodes]);

  // --- Filtering logic ---
  const filteredNodes = useMemo(() => {
    let result = nodes;
    // Collapse CallSite nodes into summary node per parent
    if (collapseCallSites) {
      // Find all parents of CallSite nodes
      const callSiteEdges = edges.filter(e => {
        const targetNode = nodes.find(n => n.id === e.to);
        return targetNode && targetNode.labels?.includes('CallSite');
      });
      const parentToCallSites: Record<string, Neo4jNode[]> = {};
      callSiteEdges.forEach(e => {
        if (!parentToCallSites[e.from]) parentToCallSites[e.from] = [];
        const callSiteNode = nodes.find(n => n.id === e.to);
        if (callSiteNode) parentToCallSites[e.from].push(callSiteNode);
      });
      // Remove all CallSite nodes
      result = result.filter(n => !n.labels?.includes('CallSite'));
      // Add summary nodes
      Object.entries(parentToCallSites).forEach(([parentId, callSites]) => {
        if (!expandedCallSiteParents.includes(parentId)) {
          result.push({
            id: `callsite-summary-${parentId}`,
            labels: ['CallSiteSummary'],
            properties: { count: callSites.length, parentId },
          });
        } else {
          // If expanded, add back the individual CallSite nodes
          result.push(...callSites);
        }
      });
    }
    if (search) {
      const searchLower = search.toLowerCase();
      const matches = result.filter((n) => {
        const label = nodeLabel(n).toLowerCase();
        const props = Object.values(n.properties || {}).join(" ").toLowerCase();
        return label.includes(searchLower) || props.includes(searchLower);
      });
      const matchTypes = new Set(matches.flatMap(n => n.labels || []));
      return result.filter((n) => n.labels?.some(l => matchTypes.has(l)) && (matches.includes(n) || matchTypes.size === 0));
    }
    return result.filter((n) => {
      if (selectedTypes.length && !n.labels?.some((l) => selectedTypes.includes(l))) return false;
      return true;
    });
  }, [nodes, edges, search, selectedTypes, collapseCallSites, expandedCallSiteParents]);

  // Only show edges where both nodes are present
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => {
    // Only show edges where both nodes are present in filteredNodeIds
    return edges.filter(e => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));
  }, [edges, filteredNodeIds]);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { simNodes, simLinks, nodeById } = useMemo(() => {
    // Ensure each node appears only once by id
    const nodeById = new Map<string, Neo4jNode>();
    filteredNodes.forEach((n) => {
      if (!nodeById.has(String(n.id))) nodeById.set(String(n.id), n);
    });

    // Only unique nodes
    const simNodes: SimNode[] = Array.from(nodeById.values()).map((n) => ({ ...n } as SimNode));
    // Only edges between unique nodes
    const simLinks: SimLink[] = filteredEdges
      .filter((e) => nodeById.has(String(e.from)) && nodeById.has(String(e.to)))
      .map((e) => ({
        id: String(e.id),
        type: String(e.type),
        source: String(e.from),
        target: String(e.to),
      })) as SimLink[];

    return { simNodes, simLinks, nodeById };
  }, [filteredNodes, filteredEdges]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Create a group to hold the graph
    let g = svg.select<SVGGElement>("g.graph-group");
    if (g.empty()) {
      g = svg.append("g").classed("graph-group", true);
      g.append("g").classed("links", true);
      g.append("g").classed("nodes", true);
    }

    // Define simulation before using it
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => String(d.id))
          .distance((l) => {
            if (l.type === "Repo") return 400;
            if (l.type === "Directory") return 260;
            if (l.type === "CodeFile" || l.type === "TextFile") return 200;
            return 180;
          })
          .strength(0.8),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-900))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 40))
      .stop(); // Stop automatic ticking

    // Run simulation for a fixed number of ticks synchronously to stabilize layout
    const STABILIZE_TICKS = 120;
    for (let i = 0; i < STABILIZE_TICKS; ++i) {
      simulation.tick();
    }

    const link = g
      .select(".links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks, (d: SimLink) => d.id)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-opacity", 0.55)
      .attr("x1", (l) => (l.source as SimNode)?.x ?? 0)
      .attr("y1", (l) => (l.source as SimNode)?.y ?? 0)
      .attr("x2", (l) => (l.target as SimNode)?.x ?? 0)
      .attr("y2", (l) => (l.target as SimNode)?.y ?? 0);

    // Use node id as key to ensure uniqueness
    const node = g
      .select(".nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes, (d: SimNode) => d.id)
      .join("g")
      .attr("cursor", "pointer")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .call(drag());

    node
      .append("circle")
      .attr("r", (d) => d.labels?.includes('CallSiteSummary') ? 18 : nodeRadius(d))
      .attr("fill", (d) => d.labels?.includes('CallSiteSummary') ? '#fbbf24' : nodeFill(d))
      .attr("stroke", "#f9fafb")
      .attr("stroke-width", 1.5);

    node
      .append("rect")
      .attr("x", 14)
      .attr("y", -10)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("height", 22)
      .attr("fill", "#111827")
      .attr("opacity", 0.92)
      .attr("stroke", "#22223b")
      .attr("stroke-width", 0.7)
      .attr("width", (d) => {
        const label = d.labels?.includes('CallSiteSummary')
          ? `CallSites (${d.properties?.count ?? 0})`
          : truncateLabel(nodeLabel(d));
        return 10 * label.length + 14;
      });

    node
      .append("text")
      .text((d) => d.labels?.includes('CallSiteSummary')
        ? `CallSites (${d.properties?.count ?? 0})`
        : truncateLabel(nodeLabel(d)))
      .attr("x", 20)
      .attr("y", 7)
      .attr("fill", "#f3f4f6")
      .style("font-size", "16px")
      .style("font-family", "monospace, monospace")
      .style("pointer-events", "none")
      .style("font-weight", "bold")
      .style("text-shadow", "0 2px 6px #000");
// Truncate long labels for readability
function truncateLabel(label: string, max = 28): string {
  if (label.length > max) return label.slice(0, max - 3) + '...';
  return label;
}

    node.on("click", function (_event: MouseEvent, d) {
      // Expand/collapse summary node
      if (d.labels?.includes('CallSiteSummary')) {
        const parentId = String(d.properties?.parentId ?? '');
        setExpandedCallSiteParents((expanded) => {
          const arr = expanded as string[];
          return arr.includes(parentId)
            ? arr.filter((id) => id !== parentId)
            : [...arr, parentId];
        });
        return;
      }
      setSelectedNodeId(String(d.id));
      const real = nodeById.get(String(d.id));
      setSelectedNode(real || null);
      if (real) onNodeClick(real);
      // Do not restart or stop simulation on click
    });

    // Hover effects and tooltips
    node.on("mouseenter", function (event, d) {
      setHoveredNodeId(String(d.id));
      setHoveredNode(nodeById.get(String(d.id)) || null);
      setHoverPos({ x: event.clientX, y: event.clientY });
    });
    node.on("mousemove", function (event) {
      setHoverPos({ x: event.clientX, y: event.clientY });
    });
    node.on("mouseleave", function () {
      setHoveredNodeId(null);
      setHoveredNode(null);
      setHoverPos(null);
    });

    // Find neighbors of selected node
    const neighborIds = new Set<string>();
    if (selectedNodeId) {
      neighborIds.add(selectedNodeId);
      simLinks.forEach(l => {
        if (String(l.source) === selectedNodeId) neighborIds.add(String(l.target));
        if (String(l.target) === selectedNodeId) neighborIds.add(String(l.source));
      });
    }

    // Highlight selected node and direct neighbors, dim others
    node.selectAll("circle")
      .attr("stroke-width", (d: unknown) => {
        const node = d as SimNode;
        return selectedNodeId && String(node.id) === selectedNodeId ? 4 :
          hoveredNodeId && String(node.id) === hoveredNodeId ? 3 : 1.5;
      })
      .attr("stroke", (d: unknown) => {
        const node = d as SimNode;
        return selectedNodeId && String(node.id) === selectedNodeId ? "#fbbf24" :
          hoveredNodeId && String(node.id) === hoveredNodeId ? "#38bdf8" : "#f9fafb";
      })
      .attr("fill-opacity", (d: unknown) => {
        const node = d as SimNode;
        return selectedNodeId && !neighborIds.has(String(node.id)) ? 0.1 :
          hoveredNodeId && String(node.id) === hoveredNodeId ? 1 : 1;
      })
      .transition().duration(180)
      .attr("r", (d: unknown) => {
        const node = d as SimNode;
        return hoveredNodeId && String(node.id) === hoveredNodeId ? nodeRadius(node) + 4 : nodeRadius(node);
      });
    node.selectAll("rect")
      .attr("opacity", (d: unknown) => {
        const node = d as SimNode;
        return selectedNodeId && !neighborIds.has(String(node.id)) ? 0.1 :
          hoveredNodeId && String(node.id) === hoveredNodeId ? 1 : 0.92;
      })
      .transition().duration(180)
      .attr("width", (d: unknown) => {
        const node = d as SimNode;
        const label = truncateLabel(nodeLabel(node));
        return hoveredNodeId && String(node.id) === hoveredNodeId ? (10 * label.length + 24) : (10 * label.length + 14);
      });
    node.selectAll("text")
      .attr("fill", (d: unknown) => {
        const node = d as SimNode;
        return selectedNodeId && !neighborIds.has(String(node.id)) ? "#888" :
          hoveredNodeId && String(node.id) === hoveredNodeId ? "#38bdf8" : "#f3f4f6";
      })
      .transition().duration(180)
      .style("font-size", (d: unknown) => {
        const node = d as SimNode;
        return hoveredNodeId && String(node.id) === hoveredNodeId ? "18px" : "16px";
      });
    // Dim unrelated links, highlight on hover
    function getId(val: string | SimNode | undefined): string {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object' && 'id' in val) return String(val.id);
      return '';
    }
    link.attr("stroke-opacity", (l: SimLink) => {
      if (selectedNodeId && !(getId(l.source as string | SimNode) === selectedNodeId || getId(l.target as string | SimNode) === selectedNodeId)) return 0.07;
      if (hoveredNodeId && !(getId(l.source as string | SimNode) === hoveredNodeId || getId(l.target as string | SimNode) === hoveredNodeId)) return 0.15;
      return 0.55;
    });
    link.attr("stroke", (l: SimLink) => {
      if (hoveredNodeId && (getId(l.source as string | SimNode) === hoveredNodeId || getId(l.target as string | SimNode) === hoveredNodeId)) return "#38bdf8";
      return "#4b5563";
    });

    // Run simulation for a fixed number of ticks, then stop to prevent floating
    const MAX_TICKS = 30;
    let tickCount = 0;
    simulation.on("tick", () => {
      link
        .attr("x1", (l) => (l.source as SimNode)?.x ?? 0)
        .attr("y1", (l) => (l.source as SimNode)?.y ?? 0)
        .attr("x2", (l) => (l.target as SimNode)?.x ?? 0)
        .attr("y2", (l) => (l.target as SimNode)?.y ?? 0);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);

      tickCount++;
      if (tickCount > MAX_TICKS) {
        simulation.stop();
      }
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      svg.select<SVGGElement>("g.graph-group").attr("transform", event.transform.toString());
    });
    svg.call(zoom);

    return () => {
      simulation.stop();
    };
  }, [simNodes, simLinks, nodeById, onNodeClick, hoveredNodeId, selectedNodeId]);

  const drag = () => {
    function dragstarted(_: D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode): void {
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode): void {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(_: D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode): void {
      d.fx = null;
      d.fy = null;
    }

    return d3.drag<SVGGElement, SimNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', left: 0, top: 0, background: 'radial-gradient(ellipse at center, #18181b 60%, #111112 100%)', zIndex: 1 }}>
      {/* --- Filter/Search UI --- */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0,
        background: 'rgba(30,41,59,0.97)', borderRadius: 1, padding: '10px 16px', boxShadow: '0 2px 12px #000a',
        border: '1px solid #334155', position: 'relative',
      }}>
        {/* Search input with icon */}
        <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
          <span style={{position: 'absolute', left: 10, color: '#94a3b8', fontSize: 17}} title="Search nodes">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="7" stroke="#94a3b8" strokeWidth="2"/><line x1="15.2" y1="15.2" x2="18" y2="18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/></svg>
          </span>
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '7px 12px 7px 34px', fontSize: 15, borderRadius: 7,
              border: '1px solid #475569', minWidth: 220, background: '#1e293b', color: '#f3f4f6',
              outline: 'none', boxShadow: '0 1px 4px #0002', transition: 'border 0.2s',
            }}
            onFocus={e => e.target.style.border = '1.5px solid #fbbf24'}
            onBlur={e => e.target.style.border = '1px solid #475569'}
          />
        </div>
        {/* Type filter dropdown */}
        <div style={{position: 'relative'}}>
          <details style={{display: 'inline'}}>
            <summary style={{
              cursor: 'pointer', fontSize: 15, color: '#fbbf24', fontWeight: 500,
              padding: '6px 16px', borderRadius: 7, background: '#334155', border: 'none',
              outline: 'none', userSelect: 'none', display: 'inline-block',
              transition: 'background 0.2s',
            }} title="Filter nodes by type"
              onMouseOver={e => e.currentTarget.style.background = '#475569'}
              onMouseOut={e => e.currentTarget.style.background = '#334155'}>
              Filter by type
              {selectedTypes.length > 0 && (
                <span style={{marginLeft: 7, color: '#a78bfa', fontWeight: 400}}>
                  ({selectedTypes.length})
                </span>
              )}
            </summary>
            <div style={{
              position: 'absolute', left: 0, top: 36, zIndex: 20,
              background: '#1e293b', border: '1px solid #334155', borderRadius: 9,
              boxShadow: '0 2px 12px #000a', minWidth: 180, padding: '12px 16px',
            }}>
              {allTypes.map(type => (
                <label key={type} style={{display: 'block', marginBottom: 7, fontSize: 14, color: '#f3f4f6', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={e => {
                      setSelectedTypes(sel =>
                        e.target.checked ? [...sel, type] : sel.filter(t => t !== type)
                      );
                    }}
                    style={{marginRight: 7, accentColor: '#fbbf24'}}
                  />
                  {type}
                </label>
              ))}
              {selectedTypes.length > 0 && (
                <button onClick={() => setSelectedTypes([])} style={{marginTop: 10, fontSize: 13, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer'}}>Clear all</button>
              )}
            </div>
          </details>
        </div>
        {/* Collapse CallSite nodes toggle with tooltip */}
        <div style={{marginLeft: 12, display: 'flex', alignItems: 'center'}} title="Collapse CallSite nodes into summary nodes">
          <input
            type="checkbox"
            checked={collapseCallSites}
            onChange={e => setCollapseCallSites(e.target.checked)}
            style={{marginRight: 7, accentColor: '#a78bfa', width: 18, height: 18}}
          />
          <span style={{fontSize: 15, color: '#f3f4f6', fontWeight: 500}}>Collapse CallSite nodes</span>
        </div>
      </div>
      {/* --- Graph --- */}
      <div ref={containerRef} style={{ width: '100vw', height: 'calc(100vh - 60px)', minHeight: 0, background: 'radial-gradient(ellipse at center, #18181b 60%, #111112 100%)', position: 'relative' }}>
        <svg ref={svgRef} style={{ width: '100vw', height: '100%', display: 'block' }}>
          {/* The graph-group <g> is created dynamically in useEffect */}
        </svg>
        {/* --- Node Details Panel (fixed position) --- */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            top: 36,
            right: 36,
            minWidth: 340,
            maxWidth: 440,
            background: 'rgba(24,24,32,0.99)',
            color: '#f3f4f6',
            borderRadius: 14,
            boxShadow: '0 4px 32px #000a',
            padding: 26,
            zIndex: 10,
            fontSize: 15,
            border: '1.5px solid #334155',
            transition: 'box-shadow 0.2s',
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{fontWeight: 700, fontSize: 19, marginBottom: 4, color: '#fbbf24'}}>
                {nodeLabel(selectedNode)}
                <span style={{fontWeight: 400, fontSize: 14, marginLeft: 10, color: '#a78bfa'}}>
                  {selectedNode.labels?.join(', ')}
                </span>
              </div>
              <button onClick={() => { setSelectedNodeId(null); setSelectedNode(null); }}
                style={{background: 'none', border: 'none', color: '#f87171', fontSize: 26, cursor: 'pointer', marginLeft: 10, borderRadius: 6, padding: '0 6px', transition: 'background 0.2s'} }
                onMouseOver={e => e.currentTarget.style.background = '#334155'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}>
                ×
              </button>
            </div>
            <div style={{marginBottom: 12, fontSize: 14, color: '#cbd5e1'}}>
              <b>ID:</b> {selectedNode.id}
            </div>
            <div style={{marginBottom: 12}}>
              <b>Properties:</b>
              <pre style={{background: '#18181b', color: '#f3f4f6', borderRadius: 7, padding: 12, fontSize: 13, marginTop: 4, maxHeight: 180, overflow: 'auto', border: '1px solid #334155'}}>
                {prettyJSON(selectedNode.properties)}
              </pre>
            </div>
            <div>
              <b>Connected relationship types:</b>
              <ul style={{margin: '8px 0 0 18px', fontSize: 14}}>
                {(() => {
                  function getId(val: string | SimNode | undefined): string {
                    if (typeof val === 'string') return val;
                    if (val && typeof val === 'object' && 'id' in val) return String(val.id);
                    return '';
                  }
                  const rels = simLinks.filter(l => getId(l.source as string | SimNode) === selectedNode.id || getId(l.target as string | SimNode) === selectedNode.id);
                  const uniqueTypes = Array.from(new Set(rels.map(l => l.type).filter(Boolean)));
                  if (uniqueTypes.length === 0) return <li style={{color:'#888'}}>No relationships</li>;
                  return uniqueTypes.map((type, i) => (
                    <li key={type + i}>{type}</li>
                  ));
                })()}
              </ul>
            </div>
          </div>
        )}
        {/* --- Tooltip on node hover --- */}
        {hoveredNode && hoverPos && (
          <Tooltip x={hoverPos.x} y={hoverPos.y}>
            <b style={{color:'#fbbf24', fontSize:15}}>{nodeLabel(hoveredNode)}</b>
            <br />
            <span style={{color:'#a78bfa', fontSize:13}}>{hoveredNode.labels?.join(', ')}</span>
            <br />
            <span style={{fontSize:12, color:'#cbd5e1'}}>ID: {hoveredNode.id}</span>
          </Tooltip>
        )}
        {/* --- Legend --- */}
        <div style={{
          position: 'absolute', left: 18, bottom: 18, zIndex: 8,
          background: 'rgba(30,41,59,0.97)', borderRadius: 10, padding: '10px 18px',
          boxShadow: '0 2px 12px #000a', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <span style={{fontWeight: 600, color: '#f3f4f6', fontSize: 15, marginRight: 10}}>Legend:</span>
          <span style={{display: 'flex', alignItems: 'center', gap: 7}}><span style={{width:16,height:16,background:'#f59e0b',borderRadius:8,display:'inline-block',border:'2px solid #fff'}}></span> <span style={{color:'#f3f4f6',fontSize:14}}>Repo</span></span>
          <span style={{display: 'flex', alignItems: 'center', gap: 7}}><span style={{width:16,height:16,background:'#2563eb',borderRadius:8,display:'inline-block',border:'2px solid #fff'}}></span> <span style={{color:'#f3f4f6',fontSize:14}}>Directory</span></span>
          <span style={{display: 'flex', alignItems: 'center', gap: 7}}><span style={{width:16,height:16,background:'#10b981',borderRadius:8,display:'inline-block',border:'2px solid #fff'}}></span> <span style={{color:'#f3f4f6',fontSize:14}}>CodeFile/TextFile</span></span>
          <span style={{display: 'flex', alignItems: 'center', gap: 7}}><span style={{width:16,height:16,background:'#a78bfa',borderRadius:8,display:'inline-block',border:'2px solid #fff'}}></span> <span style={{color:'#f3f4f6',fontSize:14}}>CallSite</span></span>
          <span style={{display: 'flex', alignItems: 'center', gap: 7}}><span style={{width:16,height:16,background:'#fbbf24',borderRadius:8,display:'inline-block',border:'2px solid #fff'}}></span> <span style={{color:'#f3f4f6',fontSize:14}}>CallSiteSummary</span></span>
          <span style={{display: 'flex', alignItems: 'center', gap: 7}}><span style={{width:16,height:16,background:'#64748b',borderRadius:8,display:'inline-block',border:'2px solid #fff'}}></span> <span style={{color:'#f3f4f6',fontSize:14}}>Other</span></span>
        </div>
      </div>
    </div>
  );
}

function hasLabel(n: Neo4jNode, label: string): boolean {
  return (n.labels ?? []).includes(label);
}

function nodeRadius(n: Neo4jNode): number {
  // Make node size more distinct by type
  if (hasLabel(n, "Repo")) return 28;
  if (hasLabel(n, "Directory")) return 20;
  if (hasLabel(n, "CodeFile") || hasLabel(n, "TextFile")) return 13;
  if (hasLabel(n, "Import") || hasLabel(n, "ExternalModule")) return 10;
  if (hasLabel(n, "CallSite")) return 11;
  return 8;
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
  // Helper to get last segment after '/' or '\\'
  function lastSegment(val?: string): string | undefined {
    if (!val) return undefined;
    // Remove trailing slash if present
    val = val.replace(/[\\/]$/, "");
    const parts = val.split(/[\\/]/);
    return parts[parts.length - 1] || val;
  }
  // Try to use the most meaningful property, showing only the last segment for paths
  // Prefer function/variable names if available
  if (typeof p.name === 'string' && p.name.length > 0 && !p.name.includes('/') && !p.name.includes('\\')) {
    return p.name;
  }
  const relPath = typeof p.relPath === 'string' ? p.relPath : undefined;
  const fileRelPath = typeof p.fileRelPath === 'string' ? p.fileRelPath : undefined;
  const normalized = typeof p.normalized === 'string' ? p.normalized : undefined;
  const raw = typeof p.raw === 'string' ? p.raw : undefined;
  return (
    lastSegment(typeof p.name === 'string' ? p.name : undefined) ||
    lastSegment(relPath) ||
    lastSegment(fileRelPath) ||
    lastSegment(normalized) ||
    lastSegment(raw) ||
    (n.labels?.[0] ? `${n.labels[0]}` : "Node")
  );
}
