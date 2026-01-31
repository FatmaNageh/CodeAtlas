import React from "react";
import { Neo4jGraph, Neo4jNode, Neo4jEdge } from "../../../web/src/components/Neo4jGraph";

export function GraphWebview({ nodes, edges }: { nodes: Neo4jNode[]; edges: Neo4jEdge[] }) {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Neo4jGraph nodes={nodes} edges={edges} onNodeClick={() => {}} />
    </div>
  );
}
