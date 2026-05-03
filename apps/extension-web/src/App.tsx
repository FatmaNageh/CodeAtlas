import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CodeAtlasInitialState, ServerStatus } from "@CodeAtlas/extension-bridge";
import {
  getPersistedState,
  postHostMessage,
  setPersistedState,
  subscribeToHostMessages,
} from "@/host";
import { fetchGraphData } from "@/graph/api";
import { GraphCanvas } from "@/graph/GraphCanvas";
import { getGraphSummary, getNodeKind, getNodeLabel, getNodePath } from "@/graph/model";
import type { GraphData, GraphNode } from "@/graph/types";

const defaultStatus: ServerStatus = { status: "stopped", port: 0, url: "" };

function getStatusLabel(status: ServerStatus): string {
  switch (status.status) {
    case "running":
      return "Server online";
    case "starting":
      return "Server starting";
    case "error":
      return "Server error";
    case "stopped":
      return "Server offline";
  }
}

function getWorkspaceLabel(value: string): string {
  if (!value) return "No workspace selected";
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

export function App() {
  const [initialState, setInitialState] = useState<CodeAtlasInitialState | undefined>(
    () => getPersistedState()?.initialState,
  );
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [graphStatus, setGraphStatus] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready" }
    | { status: "empty" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [selectedNode, setSelectedNode] = useState<GraphNode | undefined>();
  const [graphFocusRequest, setGraphFocusRequest] = useState(0);
  const graphWorkbenchRef = useRef<HTMLElement | null>(null);
  const [indexingState, setIndexingState] = useState<
    | { status: "idle" }
    | { status: "running"; repoRoot: string }
    | { status: "completed"; repoId: string; repoRoot: string }
    | { status: "failed"; repoRoot: string; error: string }
  >({ status: "idle" });

  useEffect(() => {
    const unsubscribe = subscribeToHostMessages((message) => {
      if (message.type === "app/initialState" || message.type === "app/settingsChanged") {
        setInitialState(message.payload);
        setPersistedState({ initialState: message.payload });
      }

      if (message.type === "app/serverStatusChanged") {
        setInitialState((current) => {
          if (!current) return current;
          const next = { ...current, serverStatus: message.payload };
          setPersistedState({ initialState: next });
          return next;
        });
      }

      if (message.type === "app/focusGraph") {
        setGraphFocusRequest((current) => current + 1);
      }

      if (message.type === "app/indexingStarted") {
        setIndexingState({ status: "running", repoRoot: message.payload.repoRoot });
      }

      if (message.type === "app/indexingCompleted") {
        setIndexingState({
          status: "completed",
          repoId: message.payload.repoId,
          repoRoot: message.payload.repoRoot,
        });
      }

      if (message.type === "app/indexingFailed") {
        setIndexingState({
          status: "failed",
          repoRoot: message.payload.repoRoot,
          error: message.payload.error,
        });
      }
    });

    postHostMessage({ type: "app/getInitialState" });
    return unsubscribe;
  }, []);

  const status = initialState?.serverStatus ?? defaultStatus;
  const repoReady = Boolean(initialState?.repoId);
  const graphSummary = useMemo(() => getGraphSummary(graph), [graph]);
  const workspaceLabel = useMemo(
    () => getWorkspaceLabel(initialState?.workspaceRoot ?? ""),
    [initialState?.workspaceRoot],
  );
  const indexingLabel = useMemo(() => {
    switch (indexingState.status) {
      case "running":
        return `Indexing ${getWorkspaceLabel(indexingState.repoRoot)}`;
      case "completed":
        return `Indexed ${indexingState.repoId}`;
      case "failed":
        return `Index failed: ${indexingState.error}`;
      case "idle":
        return repoReady ? "Graph context ready" : "Graph context missing";
    }
  }, [indexingState, repoReady]);

  const loadGraph = useCallback(async () => {
    if (!initialState?.serverUrl || !initialState.repoId) {
      setGraph({ nodes: [], edges: [] });
      setSelectedNode(undefined);
      setGraphStatus({ status: "idle" });
      return;
    }

    setGraphStatus({ status: "loading" });
    try {
      const nextGraph = await fetchGraphData(initialState.serverUrl, initialState.repoId);
      setGraph(nextGraph);
      setSelectedNode(undefined);
      setGraphStatus(nextGraph.nodes.length > 0 ? { status: "ready" } : { status: "empty" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGraph({ nodes: [], edges: [] });
      setSelectedNode(undefined);
      setGraphStatus({ status: "error", message });
    }
  }, [initialState?.repoId, initialState?.serverUrl]);

  const focusGraphWorkspace = useCallback(() => {
    graphWorkbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (initialState?.repoId) void loadGraph();
  }, [initialState?.repoId, loadGraph]);

  useEffect(() => {
    if (graphFocusRequest === 0) return;
    focusGraphWorkspace();
  }, [focusGraphWorkspace, graphFocusRequest]);

  useEffect(() => {
    if (!repoReady) return;
    void loadGraph();
  }, [loadGraph, repoReady]);

  useEffect(() => {
    if (indexingState.status !== "completed") return;
    void loadGraph();
  }, [indexingState, loadGraph]);

  const selectedPath = selectedNode ? getNodePath(selectedNode) : "";
  const selectedKind = selectedNode ? getNodeKind(selectedNode) : undefined;

  return (
    <main className="app-shell">
      <section className="top-bar" aria-label="CodeAtlas extension overview">
        <div>
          <p className="eyebrow">CodeAtlas for VS Code</p>
          <h1>Workspace intelligence, embedded.</h1>
        </div>
        <span className={`status-pill status-${status.status}`}>{getStatusLabel(status)}</span>
      </section>

      <section className="workspace-band" aria-label="Current workspace state">
        <div className="workspace-copy">
          <span className="label">Workspace</span>
          <strong>{workspaceLabel}</strong>
          <span className="path">{initialState?.workspaceRoot || "Open a folder in VS Code to start indexing."}</span>
        </div>
        <div className="repo-state">
          <span className="label">Repository</span>
          <strong>{repoReady ? initialState?.repoId : "Not indexed"}</strong>
          <span className="path">{initialState?.repoRoot || indexingLabel}</span>
        </div>
      </section>

      <section ref={graphWorkbenchRef} className="graph-workbench" aria-label="Knowledge graph workspace">
        <div className="graph-toolbar">
          <div>
            <span className="label">Knowledge Graph</span>
            <strong>{graphStatus.status === "ready" ? `${graphSummary.nodes} nodes` : "Workspace graph"}</strong>
          </div>
          <div className="graph-metrics" aria-label="Graph metrics">
            <span>{graphSummary.edges} edges</span>
            <span>{graphSummary.files} files</span>
            <span>{graphSummary.symbols} symbols</span>
          </div>
          <button type="button" className="compact-button" disabled={!repoReady || graphStatus.status === "loading"} onClick={loadGraph}>
            Refresh
          </button>
        </div>

        <div className="graph-stage">
          <div className="graph-canvas-shell">
            {graphStatus.status === "ready" ? (
              <GraphCanvas graph={graph} selectedNodeId={selectedNode?.id ?? ""} onSelectNode={setSelectedNode} />
            ) : (
              <div className={`graph-placeholder graph-placeholder-${graphStatus.status}`}>
                <strong>
                  {graphStatus.status === "loading"
                    ? "Loading graph"
                    : graphStatus.status === "error"
                      ? "Graph unavailable"
                      : graphStatus.status === "empty"
                        ? "No graph nodes found"
                        : "Index a repository to render its graph"}
                </strong>
                <span>
                  {graphStatus.status === "error"
                    ? graphStatus.message
                    : repoReady
                      ? "Refresh after indexing if the server already has this repository."
                      : "Use Index Workspace or Select Repository to create graph context."}
                </span>
              </div>
            )}
          </div>

          <aside className="node-inspector" aria-label="Selected node details">
            {selectedNode ? (
              <>
                <span className="label">{selectedKind}</span>
                <strong>{getNodeLabel(selectedNode)}</strong>
                <span className="path">{selectedPath || selectedNode.id}</span>
                <dl>
                  {Object.entries(selectedNode.properties).slice(0, 8).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
                {selectedPath ? (
                  <button
                    type="button"
                    className="compact-button wide"
                    onClick={() => postHostMessage({ type: "app/openFile", payload: { path: selectedPath } })}
                  >
                    Open File
                  </button>
                ) : null}
              </>
            ) : (
              <div className="inspector-empty">
                <span className="label">Node Inspector</span>
                <strong>No node selected</strong>
                <span className="path">Select a graph node to inspect its metadata and open file-backed nodes.</span>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="action-grid" aria-label="Primary actions">
        <button
          type="button"
          disabled={indexingState.status === "running"}
          onClick={() => postHostMessage({
            type: "app/indexRepository",
            payload: { repoRoot: initialState?.workspaceRoot },
          })}
        >
          <span>Index Workspace</span>
          <small>{indexingLabel}</small>
        </button>
        <button type="button" onClick={() => postHostMessage({ type: "app/selectRepository" })}>
          <span>Select Repository</span>
          <small>Pick a different folder and save it as the active graph context.</small>
        </button>
        <button type="button" onClick={focusGraphWorkspace}>
          <span>Open Graph</span>
          <small>Focus this graph workspace from the command palette or shortcut.</small>
        </button>
        <button type="button" onClick={() => postHostMessage({ type: "app/openSettings" })}>
          <span>Settings</span>
          <small>Update server URL, repo ID, repo root, and workspace settings.</small>
        </button>
        <button type="button" onClick={() => postHostMessage({ type: "app/openNeo4jBrowser" })}>
          <span>Neo4j Browser</span>
          <small>Inspect graph data directly in the configured Neo4j browser.</small>
        </button>
      </section>

      <section className="system-strip" aria-label="Connection details">
        <div>
          <span className="label">Server URL</span>
          <code>{initialState?.serverUrl ?? "Waiting for extension host"}</code>
        </div>
        <div>
          <span className="label">Auto refresh</span>
          <code>{initialState?.autoRefresh ? "Enabled" : "Disabled"}</code>
        </div>
      </section>
    </main>
  );
}
