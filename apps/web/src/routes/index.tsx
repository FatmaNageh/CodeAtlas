import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { useState } from "react";
import type { CodeNode } from "@CodeAtlas/api/types/codeNode.d";
import { NodeDetailPanel } from "@/components/NodeDetailPanel";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const TITLE_TEXT = "blah";
function HomeComponent() {
  // const healthCheck = useQuery(trpc.healthCheck.queryOptions());
  const fzfMasterData = useQuery(trpc.fzf_Master.queryOptions());
  const [selectedNode, setSelectedNode] = useState<CodeNode | null>(null);

  const handleNodeClick = (node: CodeNode) => {
    setSelectedNode(node);
  };

  const handlePanelClose = () => {
    setSelectedNode(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <div className="absolute top-4 left-4 z-10 bg-gray-900 bg-opacity-70 p-4 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-cyan-400">
          Code Knowledge Graph
        </h1>
        <p className="text-gray-400">Project: {fzfMasterData.data?.project}</p>
      </div>
      {fzfMasterData.isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400">Loading knowledge graph...</p>
        </div>
      ) : fzfMasterData.error ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500">
            Error loading data: {fzfMasterData.error.message}
          </p>
        </div>
      ) : (
        <KnowledgeGraph
          data={fzfMasterData.data?.data as CodeNode}
          onNodeClick={handleNodeClick}
          selectedNodePath={selectedNode?.path ?? null}
        />
      )}

      <NodeDetailPanel node={selectedNode} onClose={handlePanelClose} />
    </div>
  );
}
