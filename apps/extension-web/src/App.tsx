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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(markdown: string): string {
  let html = escapeHtml(markdown)
    .replace(/```([\s\S]*?)```/g, (_match, code: string) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(/(?:^|\n)- (.+)(?=\n|$)/g, "\n<li>$1</li>");
  html = html.replace(/(?:\n<li>.+<\/li>)+/g, (listBlock: string) => `<ul>${listBlock.replace(/\n/g, "")}</ul>`);
  html = html.replace(/(?:^|\n)\d+\. (.+)(?=\n|$)/g, "\n<oli>$1</oli>");
  html = html.replace(/(?:\n<oli>.+<\/oli>)+/g, (listBlock: string) => {
    const items = listBlock.replace(/\n/g, "").replace(/<oli>/g, "<li>").replace(/<\/oli>/g, "</li>");
    return `<ol>${items}</ol>`;
  });

  const blocks = html
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^<(pre|h2|h3|h4|ul)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, "<br />")}</p>`;
    });

  return blocks.join("");
}

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
  const latestLoadId = useRef(0);
  const graphWorkbenchRef = useRef<HTMLElement | null>(null);
  const [indexingState, setIndexingState] = useState<
    | { status: "idle" }
    | { status: "running"; repoRoot: string }
    | { status: "completed"; repoId: string; repoRoot: string }
    | { status: "failed"; repoRoot: string; error: string }
  >({ status: "idle" });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [animatedSummaryText, setAnimatedSummaryText] = useState("");
  const [summaryAnimating, setSummaryAnimating] = useState(false);

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
    const localLoadId = ++latestLoadId.current;

    if (!initialState?.serverUrl || !initialState.repoId) {
      setGraph({ nodes: [], edges: [] });
      setSelectedNode(undefined);
      setGraphStatus({ status: "idle" });
      return;
    }

    setGraphStatus({ status: "loading" });
    try {
      const nextGraph = await fetchGraphData(initialState.serverUrl, initialState.repoId);
      if (localLoadId !== latestLoadId.current) return;
      setGraph(nextGraph);
      setSelectedNode(undefined);
      setGraphStatus(nextGraph.nodes.length > 0 ? { status: "ready" } : { status: "empty" });
    } catch (error) {
      if (localLoadId !== latestLoadId.current) return;
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
  const summaryHtml = useMemo(() => renderMarkdown(animatedSummaryText), [animatedSummaryText]);

  const summarizeSelectedNode = useCallback(async () => {
    if (!initialState?.serverUrl || !initialState.repoId || !initialState.repoRoot) {
      setSummaryText("Missing server/repository config. Re-index and try again.");
      return;
    }
    if (!selectedPath) {
      setSummaryText("Selected node has no file path to summarize.");
      return;
    }

    setSummaryLoading(true);
    setSummaryText("");
    try {
      const response = await fetch(`${initialState.serverUrl}/graphrag/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: initialState.repoId,
          repoRoot: initialState.repoRoot,
          filePaths: [selectedPath],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ summary?: string; text?: string }>;
        errors?: string[];
      };

      if (!response.ok || data.ok === false) {
        setSummaryText(`Error: ${data.error ?? `HTTP ${response.status}`}`);
        return;
      }

      const rendered = (data.results ?? [])
        .map((result) => result.summary ?? result.text ?? "")
        .filter((item) => item.trim().length > 0)
        .join("\n\n");

      if (rendered) {
        setSummaryText(rendered);
      } else if ((data.errors ?? []).length > 0) {
        setSummaryText(`Errors: ${(data.errors ?? []).join("; ")}`);
      } else {
        setSummaryText("Summary generated, but no content was returned.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSummaryText(`Error: ${message}`);
    } finally {
      setSummaryLoading(false);
    }
  }, [initialState?.repoId, initialState?.repoRoot, initialState?.serverUrl, selectedPath]);

  useEffect(() => {
    setSummaryText("");
    setAnimatedSummaryText("");
  }, [selectedNode?.id]);

  useEffect(() => {
    if (graph.nodes.length === 0) return;

    const contextNode = selectedNode
      ? {
          ...selectedNode,
          _lbl: getNodeLabel(selectedNode),
          _k: getNodeKind(selectedNode),
          _path: getNodePath(selectedNode),
        }
      : null;

    const allNodes = graph.nodes.map((node) => ({
      ...node,
      _lbl: getNodeLabel(node),
      _k: getNodeKind(node),
      _path: getNodePath(node),
    }));

    postHostMessage({
      type: "app/setChatContext",
      payload: {
        node: contextNode,
        nodes: allNodes,
      },
    });
  }, [graph.nodes, selectedNode]);

  useEffect(() => {
    if (!summaryText) {
      setAnimatedSummaryText("");
      setSummaryAnimating(false);
      return;
    }

    setSummaryAnimating(true);
    let index = 0;
    const step = 14;
    const timer = window.setInterval(() => {
      index = Math.min(summaryText.length, index + step);
      setAnimatedSummaryText(summaryText.slice(0, index));
      if (index >= summaryText.length) {
        window.clearInterval(timer);
        setSummaryAnimating(false);
      }
    }, 16);

    return () => {
      window.clearInterval(timer);
      setSummaryAnimating(false);
    };
  }, [summaryText]);

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
              <div className="inspector-content">
                <div className="inspector-head">
                  <span className="label">{selectedKind}</span>
                  <strong>{getNodeLabel(selectedNode)}</strong>
                  <span className="path">{selectedPath || selectedNode.id}</span>
                </div>
                <div className="inspector-meta">
                  <dl>
                    {Object.entries(selectedNode.properties).slice(0, 8).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {selectedPath ? (
                  <div className="inspector-tail">
                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="compact-button"
                        onClick={() => postHostMessage({ type: "app/openFile", payload: { path: selectedPath } })}
                      >
                        Open File
                      </button>
                      <button
                        type="button"
                        className="compact-button"
                        disabled={summaryLoading}
                        onClick={() => void summarizeSelectedNode()}
                      >
                        {summaryLoading ? "Summarizing..." : "Summarize"}
                      </button>
                    </div>
                    <div className="summary-section">
                      <span className="label">Summary</span>
                      <div className="summary-scroll" aria-live="polite">
                        {summaryLoading && !summaryText ? (
                          <p className="summary-empty">Generating summary...</p>
                        ) : summaryText ? (
                          summaryAnimating ? (
                            <pre className="summary-live">{animatedSummaryText}</pre>
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                          )
                        ) : (
                          <p className="summary-empty">Generate a summary for this selected node.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
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
