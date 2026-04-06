import { useEffect, useState } from "react";
import { Neo4jGraph } from "./components/Neo4jGraph";
import type { Neo4jNode, Neo4jEdge } from "./components/Neo4jGraph";

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: (message: unknown) => void };
  }
}

// VS Code API
const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : undefined;

export default function GraphWebviewApp() {
  const [nodes, setNodes] = useState<Neo4jNode[]>([]);
  const [edges, setEdges] = useState<Neo4jEdge[]>([]);

  useEffect(() => {
    // Listen for messages from the extension
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg?.type === "graph/data" && msg.payload) {
        setNodes(msg.payload.nodes || []);
        setEdges(msg.payload.edges || []);
      }
    });
    // Request initial data
    vscode?.postMessage({ type: "graph/request" });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Neo4jGraph nodes={nodes} edges={edges} onNodeClick={() => {}} />
    </div>
  );
}
