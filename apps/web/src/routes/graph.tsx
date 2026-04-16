import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowLeft,
	ArrowRight,
	BrainCircuit,
	FileText,
	Minus,
	PanelLeftClose,
	PanelLeftOpen,
	Plus,
	RefreshCw,
	Search,
	Sparkles,
	Square,
	Upload,
} from "lucide-react";
import {
	fetchNeo4jSubgraph,
	fetchTour,
	indexRepo,
	type IndexRepoResponse,
	type TourResponse,
} from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";
import { useCompletion } from "@ai-sdk/react";
import type { Neo4jEdge, Neo4jNode } from "@/components/Neo4jGraph";
import {
	ExplorerGraphCanvas,
	nodeTypeLabel,
	classifyNode,
	nodeDisplayLabel,
	type ExplorerNode,
	type ExplorerNodeKind,
	type GraphCanvasHandle,
} from "@/components/explorer-graph-canvas";
import { AnimatedMarkdown } from "@/components/animated-markdown";

export const Route = createFileRoute("/graph")({
	component: GraphExplorerPage,
});

type EdgeCategory = "CONTAINS" | "IMPORTS" | "CALLS";
type Mode = "select" | "neighbour" | "path" | "insight";
type RightTab = "detail" | "parsing" | "insights" | "ai";
type TopView = "explorer" | "tour";
type ChatMessageBase = {
	id: string;
	text: string;
};

type UserChatMessage = ChatMessageBase & {
	role: "user";
};

type AssistantChatMessage = ChatMessageBase & {
	role: "assistant";
	contextFiles?: string[];
};

type ChatMessage = UserChatMessage | AssistantChatMessage;

type AskSource = {
	file?: string;
	symbol?: string;
	score?: number;
	sourceKind?: string;
};

type AskSuccessResponse = {
	ok: true;
	answer: string;
	sources?: AskSource[];
};

type AskErrorResponse = {
	ok: false;
	error?: string;
};

type SyncStats = {
	added: number;
	changed: number;
	removed: number;
	impactedDependents: number;
	processedFiles: number;
};

type SyncDetails = SyncStats & {
	addedFiles: string[];
	changedFiles: string[];
	removedFiles: string[];
	dependentFiles: string[];
	syncedAt: string;
};

type ParseStatus = "parsed" | "partial" | "failed";

type StatusTone = {
	background: string;
	border: string;
	color: string;
	label: string;
};

function isAskSuccessResponse(
	value: object | null,
): value is AskSuccessResponse {
	if (!value || !("ok" in value) || !("answer" in value)) return false;
	const candidate = value as {
		ok?: boolean;
		answer?: string;
		sources?: AskSource[];
	};
	return (
		candidate.ok === true &&
		typeof candidate.answer === "string" &&
		(candidate.sources === undefined || Array.isArray(candidate.sources))
	);
}

function isAskErrorResponse(value: object | null): value is AskErrorResponse {
	if (!value || !("ok" in value)) return false;
	const candidate = value as { ok?: boolean; error?: string };
	return (
		candidate.ok === false &&
		(candidate.error === undefined || typeof candidate.error === "string")
	);
}

function extractContextFiles(sources: AskSource[] | undefined): string[] {
	if (!sources || sources.length === 0) return [];
	const files = new Set<string>();
	sources.forEach((source) => {
		const file = typeof source.file === "string" ? source.file.trim() : "";
		if (file) files.add(file);
	});
	return Array.from(files);
}

function getStringProperty(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNumberProperty(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringArrayProperty(value: unknown): string[] {
	return Array.isArray(value)
		? value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

function getParseStatus(node: Neo4jNode): ParseStatus | null {
	const status = node.properties?.parseStatus;
	return status === "parsed" || status === "partial" || status === "failed"
		? status
		: null;
}

function parseStatusTone(status: ParseStatus | null): StatusTone | null {
	if (status === "parsed") {
		return {
			label: "Parsed",
			background: "rgba(16, 185, 129, 0.12)",
			border: "rgba(16, 185, 129, 0.28)",
			color: "#047857",
		};
	}
	if (status === "partial") {
		return {
			label: "Partial",
			background: "rgba(245, 158, 11, 0.14)",
			border: "rgba(245, 158, 11, 0.32)",
			color: "#b45309",
		};
	}
	if (status === "failed") {
		return {
			label: "Failed",
			background: "rgba(239, 68, 68, 0.12)",
			border: "rgba(239, 68, 68, 0.28)",
			color: "#b91c1c",
		};
	}
	return null;
}

function astNodeDisplayName(node: Neo4jNode): string {
	const props = node.properties ?? {};
	const unitKind = getStringProperty(props.unitKind) ?? "ast";
	const topLevelSymbols = getStringArrayProperty(props.topLevelSymbols);
	const symbolNames = getStringArrayProperty(props.symbolNames);
	const label = getStringProperty(props.label);
	const summaryCandidate = getStringProperty(props.summaryCandidate);
	const joinedSymbols = [...topLevelSymbols, ...symbolNames]
		.filter((value, index, array) => array.indexOf(value) === index)
		.slice(0, 2)
		.join(", ");

	if (label && joinedSymbols) {
		return `${label} · ${joinedSymbols}`;
	}
	if (label) return label;
	if (joinedSymbols) return `${unitKind} · ${joinedSymbols}`;
	if (summaryCandidate) return `${unitKind} · ${summaryCandidate}`;

	const startLine = getNumberProperty(props.startLine);
	const endLine = getNumberProperty(props.endLine);
	if (startLine !== null && endLine !== null) {
		return `${unitKind} ${startLine}-${endLine}`;
	}
	if (startLine !== null) {
		return `${unitKind} line ${startLine}`;
	}
	return unitKind;
}

type TreeItem = {
	key: string;
	label: string;
	depth: number;
	nodeId?: string;
};

function normalizeEdgeType(type: string): EdgeCategory {
	const t = String(type).toUpperCase();
	if (t.includes("CALL")) return "CALLS";
	if (t.includes("IMPORT")) return "IMPORTS";
	return "CONTAINS";
}

function getNodePath(node: Neo4jNode): string {
	const props = node.properties ?? {};
	return String(
		props.path ??
			props.filePath ??
			props.relativePath ??
			props.relPath ??
			props.name ??
			node.id,
	);
}

function normalizePathForMatch(filePath: string): string {
	return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function findParentFile(
	node: Neo4jNode,
	edges: Neo4jEdge[],
	allNodes: Neo4jNode[],
): Neo4jNode | null {
	const incoming = edges.filter((e) => String(e.to) === String(node.id));
	for (const edge of incoming) {
		const parent = allNodes.find((n) => String(n.id) === String(edge.from));
		if (!parent) continue;
		const kind = classifyNode(parent);
		if (kind === "file") return parent;
		if (kind === "folder") continue;
		const grandparent = findParentFile(parent, edges, allNodes);
		if (grandparent) return grandparent;
	}
	return null;
}

function getNodeLanguage(node: Neo4jNode): string {
	const props = node.properties ?? {};
	return String(
		props.language ??
			props.lang ??
			inferLanguageFromPath(getNodePath(node)) ??
			"Unknown",
	);
}

function inferLanguageFromPath(path: string): string | null {
	const ext = path.split(".").pop()?.toLowerCase();
	if (!ext || ext === path) return null;
	const map: Record<string, string> = {
		ts: "TypeScript",
		tsx: "TypeScript",
		js: "JavaScript",
		jsx: "JavaScript",
		java: "Java",
		py: "Python",
		cs: "C#",
		cpp: "C++",
		c: "C",
		go: "Go",
		rb: "Ruby",
		php: "PHP",
		kt: "Kotlin",
		swift: "Swift",
		html: "HTML",
		css: "CSS",
		json: "JSON",
		md: "Markdown",
	};
	return map[ext] ?? ext.toUpperCase();
}

function getNodeLoc(node: Neo4jNode): number | string {
	const props = node.properties ?? {};
	return props.loc ?? props.lines ?? props.lineCount ?? props.endLine ?? "—";
}

function buildTreeItems(nodes: ExplorerNode[]): TreeItem[] {
	const paths = nodes
		.filter((n) => ["folder", "file", "class"].includes(n.kind))
		.map((n) => ({
			nodeId: n.id,
			path: getNodePath(n),
			label: n.displayLabel,
		}));

	const items: TreeItem[] = [];
	const seen = new Set<string>();

	for (const item of paths) {
		const clean = item.path.replace(/^\/+/, "");
		const segments = clean.split(/[\\/]/).filter(Boolean);
		if (segments.length === 0) {
			if (!seen.has(item.nodeId)) {
				items.push({
					key: item.nodeId,
					label: item.label,
					depth: 0,
					nodeId: item.nodeId,
				});
				seen.add(item.nodeId);
			}
			continue;
		}

		let prefix = "";
		segments.forEach((segment, index) => {
			prefix = prefix ? `${prefix}/${segment}` : segment;
			const isLeaf = index === segments.length - 1;
			if (!seen.has(prefix)) {
				items.push({
					key: prefix,
					label: isLeaf ? item.label : `${segment}/`,
					depth: index,
					nodeId: isLeaf ? item.nodeId : undefined,
				});
				seen.add(prefix);
			}
		});
	}

	return items.slice(0, 80);
}

function computeDegrees(nodes: Neo4jNode[], edges: Neo4jEdge[]) {
	const degreeMap = new Map<string, { in: number; out: number }>();
	nodes.forEach((node) => degreeMap.set(String(node.id), { in: 0, out: 0 }));
	edges.forEach((edge) => {
		const from = degreeMap.get(String(edge.from));
		const to = degreeMap.get(String(edge.to));
		if (from) from.out += 1;
		if (to) to.in += 1;
	});
	return degreeMap;
}

function bfsDepth(nodes: Neo4jNode[], edges: Neo4jEdge[]) {
	const adjacency = new Map<string, string[]>();
	nodes.forEach((n) => adjacency.set(String(n.id), []));
	edges.forEach((e) => {
		const from = String(e.from);
		const to = String(e.to);
		adjacency.get(from)?.push(to);
	});
	const depth = new Map<string, number>();
	const roots = nodes.filter(
		(n) => n.labels?.includes("Repository") || n.labels?.includes("Repo"),
	);
	const queue: string[] = roots.length
		? roots.map((n) => String(n.id))
		: nodes.slice(0, 1).map((n) => String(n.id));
	queue.forEach((id) => depth.set(id, 0));
	for (let i = 0; i < queue.length; i += 1) {
		const current = queue[i]!;
		const currentDepth = depth.get(current) ?? 0;
		for (const next of adjacency.get(current) ?? []) {
			if (!depth.has(next)) {
				depth.set(next, currentDepth + 1);
				queue.push(next);
			}
		}
	}
	return depth;
}

function shortestPath(
	nodeIds: string[],
	edges: Neo4jEdge[],
	fromId: string,
	toId: string,
): string[] {
	const allowed = new Set(nodeIds);
	const adjacency = new Map<string, string[]>();
	nodeIds.forEach((id) => adjacency.set(id, []));
	edges.forEach((e) => {
		const from = String(e.from);
		const to = String(e.to);
		if (allowed.has(from) && allowed.has(to)) adjacency.get(from)?.push(to);
	});

	const queue = [fromId];
	const prev = new Map<string, string | null>();
	prev.set(fromId, null);

	for (let i = 0; i < queue.length; i += 1) {
		const current = queue[i]!;
		if (current === toId) break;
		for (const next of adjacency.get(current) ?? []) {
			if (!prev.has(next)) {
				prev.set(next, current);
				queue.push(next);
			}
		}
	}

	if (!prev.has(toId)) return [];
	const path: string[] = [];
	let current: string | null = toId;
	while (current) {
		path.push(current);
		current = prev.get(current) ?? null;
	}
	return path.reverse();
}

function GraphExplorerPage() {
	const session = loadSession();
	const [baseUrl] = useState(
		session.baseUrl ?? import.meta.env.VITE_SERVER_URL ?? "",
	);
	const [repoId] = useState(session.lastRepoId ?? "");
	const [repoRoot] = useState(session.lastProjectPath ?? "");
	const [graph, setGraph] = useState<{
		nodes: Neo4jNode[];
		edges: Neo4jEdge[];
	}>({ nodes: [], edges: [] });
	const [loading, setLoading] = useState(false);
	const [nodeLimit, setNodeLimit] = useState(2000);
	const [truncated, setTruncated] = useState(false);
	const [reIndexing, setReIndexing] = useState(false);
	const [showReIndexPanel, setShowReIndexPanel] = useState(false);
	const graphCanvasRef = useRef<GraphCanvasHandle>(null);
	const [activeLayout, setActiveLayout] = useState<
		"force" | "radial" | "hierarchical"
	>("force");
	const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
	const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
	const [mode, setMode] = useState<Mode>("select");
	const [tab, setTab] = useState<RightTab>("detail");
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<
		Record<EdgeCategory, boolean>
	>({ CONTAINS: true, IMPORTS: true, CALLS: true });
	const [visibleKinds, setVisibleKinds] = useState<
		Record<ExplorerNodeKind, boolean>
	>({ folder: true, file: true, class: true, fn: true, ast: true });
	const [expandedAstFileId, setExpandedAstFileId] = useState<string | null>(
		null,
	);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState("");
	const [mentionSearch, setMentionSearch] = useState<string | null>(null);
	const [mentionSelected, setMentionSelected] = useState(0);
	const [embedLoading, setEmbedLoading] = useState(false);
	const [pathFromId, setPathFromId] = useState<string>("");
	const [pathToId, setPathToId] = useState<string>("");
	const [summaryText, setSummaryText] = useState<string>("");
	const [summarizing, setSummarizing] = useState(false);
	const [topView, setTopView] = useState<TopView>("explorer");
	const [tourData, setTourData] = useState<TourResponse | null>(null);
	const [tourIndex, setTourIndex] = useState(0);
	const [tourLoading, setTourLoading] = useState(false);
	const [tourError, setTourError] = useState<string>("");
	const [topFilesCount, setTopFilesCount] = useState(12);
	const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
	const [lastSyncDetails, setLastSyncDetails] = useState<SyncDetails | null>(null);
	const pendingContextFilesRef = useRef<string[]>([]);

	const loadGraph = async (limit: number) => {
		if (!repoId.trim()) return;
		setLoading(true);
		setTruncated(false);
		try {
			const res = await fetchNeo4jSubgraph(repoId.trim(), baseUrl, limit);
			const nodes: Neo4jNode[] = res.nodes ?? [];
			const edges: Neo4jEdge[] = res.edges ?? [];
			setGraph({ nodes, edges });
			setExpandedAstFileId(null);
			if (nodes.length > 0 && nodes.length >= limit) {
				setTruncated(true);
				toast.warning(
					`Graph capped at ${limit} nodes â€” increase the limit to see more.`,
				);
			}
			saveSession({ baseUrl, lastRepoId: repoId.trim() });
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to load graph";
			toast.error(message);
		} finally {
			setLoading(false);
		}
	};

	const loadTour = async () => {
		if (!repoId.trim()) {
			setTourError("No repository loaded. Index a repo first.");
			return;
		}
		setTourLoading(true);
		setTourError("");
		try {
			const data = await fetchTour(repoId.trim(), baseUrl, topFilesCount);
			setTourData(data);
			setTourIndex(0);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setTourError(message);
			setTourData(null);
		} finally {
			setTourLoading(false);
		}
	};

	const handleSummarize = async () => {
		if (!selectedNode) return;
		const kind = classifyNode(selectedNode);
		let filepath: string;
		if (kind === "file" || kind === "folder") {
			filepath = getNodePath(selectedNode);
		} else {
			const parentFile = findParentFile(
				selectedNode,
				filteredEdges,
				filteredNodes,
			);
			if (!parentFile) {
				setSummaryText("Error: Could not find parent file for this node.");
				return;
			}
			filepath = getNodePath(parentFile);
		}
		setSummarizing(true);
		setSummaryText("");
		try {
			const res = await fetch(`${baseUrl}/graphrag/summarize`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ repoId, repoRoot, filePaths: [filepath] }),
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				setSummaryText(
					`Error: ${res.status} ${errData?.error ?? res.statusText}`,
				);
			} else {
				const data = await res.json();
				if (data?.results && data.results.length > 0) {
					const summaryText = data.results
						.map((r: any) => r.summary ?? r.text ?? JSON.stringify(r))
						.join("\n\n");
					setSummaryText(summaryText);
				} else if (data?.errors && data.errors.length > 0) {
					setSummaryText(
						`Errors: ${data.errors.map((e: any) => (typeof e === "string" ? e : JSON.stringify(e))).join("; ")}`,
					);
				} else {
					setSummaryText("Summary generated but no results returned.");
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setSummaryText(`Error: ${msg}`);
		} finally {
			setSummarizing(false);
		}
	};

	useEffect(() => {
		setSummaryText("");
	}, [selectedNodeId]);

	useEffect(() => {
		if (topView !== "tour") return;
		if (search) setSearch("");
		setVisibleKinds((current) =>
			current.file ? current : { ...current, file: true },
		);
	}, [topView, repoId, baseUrl]);

	const { complete, isLoading: chatLoading } = useCompletion({
		api: `${baseUrl}/graphrag/ask`,
		streamProtocol: "text",
		fetch: async (input, init) => {
			pendingContextFilesRef.current = [];
			const reqBody =
				typeof init?.body === "string" ? JSON.parse(init.body) : {};
			const question = String(reqBody?.question ?? reqBody?.prompt ?? "");
			const requestRepoId = String(reqBody?.repoId ?? repoId ?? "").trim();

			const response = await fetch(input, {
				...init,
				method: "POST",
				headers: {
					...(init?.headers ?? {}),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ ...reqBody, repoId: requestRepoId, question }),
			});
			const data: object | null = await response.json().catch(() => null);

			if (!response.ok || isAskErrorResponse(data)) {
				throw new Error(
					(isAskErrorResponse(data) ? data.error : undefined) ??
						`AI request failed (${response.status})`,
				);
			}

			if (!isAskSuccessResponse(data)) {
				throw new Error(`AI response format invalid (${response.status})`);
			}

			const answer = data.answer;
			pendingContextFilesRef.current = extractContextFiles(data.sources);

			return new Response(answer, {
				status: 200,
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
				},
			});
		},
		onError: (err) => {
			toast.error(err.message ?? "Failed to get AI response");
		},
	});

	useEffect(() => {
		const run = async () => {
			if (!repoId.trim()) return;
			setLoading(true);
			setTruncated(false);
			try {
				const res = await fetchNeo4jSubgraph(repoId.trim(), baseUrl, nodeLimit);
				const nodes: Neo4jNode[] = res.nodes ?? [];
				const edges: Neo4jEdge[] = res.edges ?? [];
				setGraph({ nodes, edges });
				setExpandedAstFileId(null);
				if (nodes.length > 0 && nodes.length >= nodeLimit) {
					setTruncated(true);
					toast.warning(
						`Graph capped at ${nodeLimit} nodes — increase the limit to see more.`,
					);
				}
				saveSession({ baseUrl, lastRepoId: repoId.trim() });
			} catch (error: any) {
				toast.error(error?.message ?? "Failed to load graph");
			} finally {
				setLoading(false);
			}
		};
		run();
	}, [repoId, baseUrl, nodeLimit]);

	const explorerNodes = useMemo<ExplorerNode[]>(() => {
		return graph.nodes
			.filter((node) => {
				const label = nodeDisplayLabel(node);
				// Remove internal import/chunk artifact nodes — they are not real code entities
				if (/^(imp|chunk|call|callsite|ref|sym):/i.test(label)) return false;
				if (/[a-f0-9]{8,}/i.test(label)) return false;
				if (/^[a-f0-9-]{20,}$/.test(label)) return false;
				return true;
			})
			.map((node) => ({
				...node,
				kind: classifyNode(node),
				displayLabel: nodeDisplayLabel(node),
			}));
	}, [graph.nodes]);

	const expandedAstNodeIds = useMemo(() => {
		const astIds = new Set<string>();
		if (!expandedAstFileId) return astIds;

		const nodeById = new Map(
			explorerNodes.map((node) => [String(node.id), node]),
		);
		const astAdjacency = new Map<string, string[]>();
		const queue: string[] = [];

		const queueAstNode = (nodeId: string) => {
			const node = nodeById.get(nodeId);
			if (!node || node.kind !== "ast" || astIds.has(nodeId)) return;
			astIds.add(nodeId);
			queue.push(nodeId);
		};

		const linkAstNodes = (fromId: string, toId: string) => {
			const fromNode = nodeById.get(fromId);
			const toNode = nodeById.get(toId);
			if (fromNode?.kind !== "ast" || toNode?.kind !== "ast") return;
			const fromList = astAdjacency.get(fromId) ?? [];
			fromList.push(toId);
			astAdjacency.set(fromId, fromList);
			const toList = astAdjacency.get(toId) ?? [];
			toList.push(fromId);
			astAdjacency.set(toId, toList);
		};

		graph.edges.forEach((edge) => {
			const fromId = String(edge.from);
			const toId = String(edge.to);
			const edgeType = String(edge.type).toUpperCase();
			const isFileAstBridge =
				edgeType.includes("HAS_AST") ||
				edgeType.includes("HAS_AST_ROOT") ||
				edgeType.includes("DECLARE");
			if (isFileAstBridge && fromId === expandedAstFileId) {
				queueAstNode(toId);
			}
			if (isFileAstBridge && toId === expandedAstFileId) {
				queueAstNode(fromId);
			}
			if (edgeType.includes("NEXT_AST") || edgeType.includes("AST_CHILD")) {
				linkAstNodes(fromId, toId);
			}
		});

		while (queue.length > 0) {
			const current = queue.pop();
			if (!current) continue;
			const neighbours = astAdjacency.get(current) ?? [];
			neighbours.forEach(queueAstNode);
		}

		return astIds;
	}, [expandedAstFileId, graph.edges, explorerNodes]);

	useEffect(() => {
		if (!expandedAstFileId) return;
		const fileStillVisible = explorerNodes.some(
			(node) => node.kind === "file" && String(node.id) === expandedAstFileId,
		);
		if (!fileStillVisible) setExpandedAstFileId(null);
	}, [expandedAstFileId, explorerNodes]);

	const filteredNodes = useMemo(() => {
		const lower = search.trim().toLowerCase();
		return explorerNodes.filter((node) => {
			if (node.kind === "ast" && !expandedAstNodeIds.has(String(node.id))) {
				return false;
			}
			if (!visibleKinds[node.kind]) return false;
			if (!lower) return true;
			const haystack =
				`${node.displayLabel} ${getNodePath(node)} ${JSON.stringify(node.properties ?? {})}`.toLowerCase();
			return haystack.includes(lower);
		});
	}, [explorerNodes, expandedAstNodeIds, visibleKinds, search]);

	const visibleNodeIds = useMemo(
		() => new Set(filteredNodes.map((node) => String(node.id))),
		[filteredNodes],
	);

	const filteredEdges = useMemo(() => {
		return graph.edges.filter((edge) => {
			const category = normalizeEdgeType(edge.type);
			return (
				visibleEdgeTypes[category] &&
				visibleNodeIds.has(String(edge.from)) &&
				visibleNodeIds.has(String(edge.to))
			);
		});
	}, [graph.edges, visibleEdgeTypes, visibleNodeIds]);

	const selectedNode = useMemo(() => {
		return (
			filteredNodes.find((node) => String(node.id) === selectedNodeId) ??
			filteredNodes[0] ??
			null
		);
	}, [filteredNodes, selectedNodeId]);

	const selectedNodeTypeLabel = selectedNode ? nodeTypeLabel(selectedNode) : "";
	const aiEnabledForSelection = selectedNode?.kind !== "ast";

	const selectedFileNode = useMemo(() => {
		if (!selectedNode) return null;
		if (selectedNode.kind === "file") return selectedNode;
		return findParentFile(selectedNode, graph.edges, graph.nodes);
	}, [selectedNode, graph.edges, graph.nodes]);

	const selectedParseStatus = useMemo(
		() => (selectedFileNode ? getParseStatus(selectedFileNode) : null),
		[selectedFileNode],
	);

	const selectedAstNodes = useMemo(() => {
		if (!selectedFileNode) return [] as ExplorerNode[];
		const fileId = String(selectedFileNode.id);
		const astNodeIds = new Set<string>();
		graph.edges.forEach((edge) => {
			const edgeType = String(edge.type).toUpperCase();
			if (
				String(edge.from) === fileId &&
				(edgeType.includes("HAS_AST") || edgeType.includes("HAS_AST_ROOT"))
			) {
				astNodeIds.add(String(edge.to));
			}
		});
		return explorerNodes
			.filter(
				(node) =>
					node.kind === "ast" && astNodeIds.has(String(node.id)),
			)
			.sort((left, right) => {
				const leftIndex = getNumberProperty(left.properties?.segmentIndex) ?? Number.MAX_SAFE_INTEGER;
				const rightIndex = getNumberProperty(right.properties?.segmentIndex) ?? Number.MAX_SAFE_INTEGER;
				if (leftIndex !== rightIndex) return leftIndex - rightIndex;
				const leftLine = getNumberProperty(left.properties?.startLine) ?? Number.MAX_SAFE_INTEGER;
				const rightLine = getNumberProperty(right.properties?.startLine) ?? Number.MAX_SAFE_INTEGER;
				return leftLine - rightLine;
			});
	}, [selectedFileNode, graph.edges, explorerNodes]);

	const selectedAstSummary = useMemo(() => {
		const summary = {
			classes: [] as string[],
			functions: [] as string[],
			modules: [] as string[],
			members: [] as string[],
			imports: [] as string[],
			calls: [] as string[],
			unitKinds: new Map<string, number>(),
		};

		for (const astNode of selectedAstNodes) {
			const props = astNode.properties ?? {};
			const unitKind = getStringProperty(props.unitKind) ?? "ast";
			summary.unitKinds.set(unitKind, (summary.unitKinds.get(unitKind) ?? 0) + 1);

			const topLevelSymbols = getStringArrayProperty(props.topLevelSymbols);
			const symbolNames = getStringArrayProperty(props.symbolNames);
			const imports = getStringArrayProperty(props.imports);
			const calls = getStringArrayProperty(props.calls);
			const candidates = [...topLevelSymbols, ...symbolNames].filter(
				(value, index, array) => array.indexOf(value) === index,
			);

			if (unitKind.includes("class")) {
				summary.classes.push(...candidates);
			} else if (
				unitKind.includes("function") ||
				unitKind.includes("method") ||
				unitKind.includes("constructor")
			) {
				summary.functions.push(...candidates);
			} else if (
				unitKind.includes("module") ||
				unitKind.includes("namespace") ||
				unitKind.includes("package")
			) {
				summary.modules.push(...candidates);
			} else if (
				unitKind.includes("field") ||
				unitKind.includes("property") ||
				unitKind.includes("member") ||
				unitKind.includes("variable")
			) {
				summary.members.push(...candidates);
			}

			summary.imports.push(...imports);
			summary.calls.push(...calls);
		}

		const dedupe = (values: string[]) =>
			values.filter((value, index, array) => array.indexOf(value) === index).slice(0, 12);

		return {
			classes: dedupe(summary.classes),
			functions: dedupe(summary.functions),
			modules: dedupe(summary.modules),
			members: dedupe(summary.members),
			imports: dedupe(summary.imports),
			calls: dedupe(summary.calls),
			unitKinds: Array.from(summary.unitKinds.entries()).sort((left, right) => right[1] - left[1]),
		};
	}, [selectedAstNodes]);

	useEffect(() => {
		if (!selectedNode && filteredNodes[0])
			setSelectedNodeId(String(filteredNodes[0].id));
	}, [selectedNode, filteredNodes]);

	useEffect(() => {
		if (tab === "ai" && !aiEnabledForSelection) {
			setTab("detail");
		}
	}, [tab, aiEnabledForSelection]);

	const degreeMap = useMemo(
		() => computeDegrees(filteredNodes, filteredEdges),
		[filteredNodes, filteredEdges],
	);
	const depthMap = useMemo(
		() => bfsDepth(filteredNodes, filteredEdges),
		[filteredNodes, filteredEdges],
	);

	const relationships = useMemo(() => {
		if (!selectedNode)
			return [] as Array<{
				edge: Neo4jEdge;
				target: ExplorerNode;
				category: EdgeCategory;
			}>;
		return filteredEdges
			.filter(
				(edge) =>
					String(edge.from) === String(selectedNode.id) ||
					String(edge.to) === String(selectedNode.id),
			)
			.map((edge) => {
				const targetId =
					String(edge.from) === String(selectedNode.id)
						? String(edge.to)
						: String(edge.from);
				return {
					edge,
					target: filteredNodes.find((node) => String(node.id) === targetId)!,
					category: normalizeEdgeType(edge.type),
				};
			})
			.filter((item) => Boolean(item.target))
			.slice(0, 12);
	}, [selectedNode, filteredEdges, filteredNodes]);

	const treeItems = useMemo(
		() => buildTreeItems(filteredNodes),
		[filteredNodes],
	);

	const pathCandidates = filteredNodes.slice(0, 40);
	useEffect(() => {
		if (!pathFromId && pathCandidates[0])
			setPathFromId(String(pathCandidates[0].id));
		if (!pathToId && pathCandidates[1])
			setPathToId(String(pathCandidates[1].id));
	}, [pathCandidates, pathFromId, pathToId]);

	const currentPath = useMemo(() => {
		if (mode !== "path" || !pathFromId || !pathToId) return [] as string[];
		return shortestPath(
			Array.from(visibleNodeIds),
			filteredEdges,
			pathFromId,
			pathToId,
		);
	}, [mode, pathFromId, pathToId, visibleNodeIds, filteredEdges]);

	const highlightNodeIds = useMemo(() => {
		if (topView === "tour") {
			return selectedNode ? [String(selectedNode.id)] : ([] as string[]);
		}
		if (!selectedNode) return [] as string[];
		if (mode === "neighbour") {
			const ids = new Set<string>([String(selectedNode.id)]);
			filteredEdges.forEach((edge) => {
				if (String(edge.from) === String(selectedNode.id))
					ids.add(String(edge.to));
				if (String(edge.to) === String(selectedNode.id))
					ids.add(String(edge.from));
			});
			return Array.from(ids);
		}
		if (mode === "insight") {
			return filteredNodes
				.map((node) => ({
					node,
					degree:
						(degreeMap.get(String(node.id))?.in ?? 0) +
						(degreeMap.get(String(node.id))?.out ?? 0),
				}))
				.sort((a, b) => b.degree - a.degree)
				.slice(0, 5)
				.map((item) => String(item.node.id));
		}
		// In plain "select" mode — return empty so ALL nodes stay fully bright
		return [] as string[];
	}, [selectedNode, mode, filteredEdges, filteredNodes, degreeMap, topView]);

	const hotspotNodes = useMemo(() => {
		return filteredNodes
			.map((node) => ({
				node,
				inDegree: degreeMap.get(String(node.id))?.in ?? 0,
				outDegree: degreeMap.get(String(node.id))?.out ?? 0,
			}))
			.sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
			.slice(0, 3);
	}, [filteredNodes, degreeMap]);

	const orphanNodes = useMemo(() => {
		return filteredNodes
			.filter((node) => {
				const degree = degreeMap.get(String(node.id));
				return (degree?.in ?? 0) + (degree?.out ?? 0) === 0;
			})
			.slice(0, 3);
	}, [filteredNodes, degreeMap]);

	const depthDistribution = useMemo(() => {
		const buckets = new Map<string, number>();
		filteredNodes.forEach((node) => {
			const depth = depthMap.get(String(node.id));
			const bucket =
				depth == null
					? "Unreached"
					: depth >= 4
						? "Depth 4+"
						: `Depth ${depth}`;
			buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
		});
		return Array.from(buckets.entries()).map(([label, value]) => ({
			label,
			value,
		}));
	}, [filteredNodes, depthMap]);

	const repoName = useMemo(() => {
		const cleanRoot = repoRoot?.trim();

		if (cleanRoot) {
			const normalized = cleanRoot.replace(/\\/g, "/");
			const parts = normalized.split("/").filter(Boolean);
			return parts[parts.length - 1] || cleanRoot;
		}

		if (repoId?.trim()) {
			return `Repository ${repoId.slice(0, 8)}`;
		}

		return "No repository loaded";
	}, [repoRoot, repoId]);

	const handleReIndex = async () => {
		if (!repoRoot.trim()) {
			toast.error(
				"No project path in session. Go to the Indexing page to run a full index first.",
			);
			return;
		}
		setReIndexing(true);
		try {
			toast.info("Syncing repository incrementally... this may take a moment.");
			const data: IndexRepoResponse = await indexRepo(
				{
					projectPath: repoRoot,
					mode: "incremental",
					saveDebugJson: true,
					computeHash: true,
					dryRun: false,
				},
				baseUrl,
			);
			const syncStats: SyncStats = {
				added: data.scanned.diff.added.length,
				changed: data.scanned.diff.changed.length,
				removed: data.scanned.diff.removed.length,
				impactedDependents: data.scanned.impactedDependents.length,
				processedFiles: data.scanned.processedFiles,
			};
			const syncDetails: SyncDetails = {
				...syncStats,
				addedFiles: data.scanned.diff.added.map((entry) => entry.relPath),
				changedFiles: data.scanned.diff.changed.map((entry) => entry.relPath),
				removedFiles: data.scanned.diff.removed.map((entry) => entry.relPath),
				dependentFiles: data.scanned.impactedDependents,
				syncedAt: new Date().toISOString(),
			};
			setLastSyncStats(syncStats);
			setLastSyncDetails(syncDetails);
			const summaryParts = [
				`${syncStats.added} added`,
				`${syncStats.changed} changed`,
				`${syncStats.removed} removed`,
				`${syncStats.impactedDependents} dependents`,
			];
			const hadAnyChanges =
				syncStats.added > 0 ||
				syncStats.changed > 0 ||
				syncStats.removed > 0 ||
				syncStats.impactedDependents > 0;
			const syncSummary = hadAnyChanges
				? `${summaryParts.join(", ")}. Processed ${syncStats.processedFiles} file${syncStats.processedFiles === 1 ? "" : "s"}.`
				: "No incremental changes detected.";
			if (data.repoId) {
				saveSession({
					baseUrl,
					lastRepoId: data.repoId,
					lastProjectPath: repoRoot,
				});
			}
			await loadGraph(nodeLimit);
			toast.success(`${syncSummary} Graph refreshed.`);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Incremental sync failed";
			toast.error(message);
		} finally {
			setReIndexing(false);
		}
	};

	const graphLooksSparse =
		!loading && graph.nodes.length > 0 && graph.nodes.length < 10;

	const tourSteps = tourData?.steps ?? [];
	const activeTourStep = tourSteps[tourIndex] ?? null;

	useEffect(() => {
		if (tourSteps.length === 0) {
			if (tourIndex !== 0) setTourIndex(0);
			return;
		}
		if (tourIndex >= tourSteps.length) {
			setTourIndex(tourSteps.length - 1);
		}
	}, [tourIndex, tourSteps.length]);

	const tourHighlightNodeIds = useMemo(() => {
		if (!tourData) return [] as string[];
		const filePaths = new Set(
			tourData.steps.map((step) => normalizePathForMatch(step.filePath)),
		);
		return explorerNodes
			.filter((node) => {
				if (node.kind !== "file") return false;
				const nodePath = normalizePathForMatch(getNodePath(node));
				return (
					filePaths.has(nodePath) ||
					filePaths.has(nodePath.split("/").pop() || "")
				);
			})
			.map((node) => String(node.id));
	}, [tourData, explorerNodes]);

	const activeTourNodeId = useMemo(() => {
		if (!activeTourStep) return null;
		const targetPath = normalizePathForMatch(activeTourStep.filePath);

		const match = explorerNodes.find((node) => {
			if (node.kind !== "file") return false;
			const nodePath = normalizePathForMatch(getNodePath(node));
			if (nodePath === targetPath) return true;
			if (nodePath.endsWith(targetPath)) return true;
			if (targetPath.endsWith(nodePath.split("/").pop() || "")) return true;
			return false;
		});
		return match ? String(match.id) : null;
	}, [activeTourStep, explorerNodes]);

	const activeTourFileNode = useMemo(() => {
		if (!activeTourStep) return null;
		const targetPath = normalizePathForMatch(activeTourStep.filePath);
		return (
			explorerNodes.find(
				(node) =>
					node.kind === "file" &&
					normalizePathForMatch(getNodePath(node)) === targetPath,
			) ?? null
		);
	}, [activeTourStep, explorerNodes]);

	useEffect(() => {
		if (topView !== "tour") return;
		if (!activeTourStep) return;
		const targetPath = normalizePathForMatch(activeTourStep.filePath);
		const match = explorerNodes.find((node) => {
			if (node.kind !== "file") return false;
			const nodePath = normalizePathForMatch(getNodePath(node));
			if (nodePath === targetPath) return true;
			if (nodePath.endsWith(targetPath)) return true;
			if (targetPath.endsWith(nodePath.split("/").pop() || "")) return true;
			return false;
		});
		if (match) {
			setSelectedNodeId(String(match.id));
			if (mode === "select") setTab("detail");
		}
	}, [topView, activeTourStep, explorerNodes, mode]);

	const layoutOptions: Array<{ label: string; icon: any }> = [
		{ label: "Force layout", icon: Sparkles },
		{ label: "Hierarchical", icon: Upload },
		{ label: "Radial", icon: BrainCircuit },
		{ label: "Fit", icon: Square },
	];

	const makeMessageId = () => {
		if (
			typeof crypto !== "undefined" &&
			typeof crypto.randomUUID === "function"
		) {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	};

	const mentionMatches = useMemo(() => {
		if (!mentionSearch) return [];
		const lower = mentionSearch.toLowerCase();
		return explorerNodes
			.filter((node) => {
				const label = nodeDisplayLabel(node).toLowerCase();
				const path = getNodePath(node).toLowerCase();
				return label.includes(lower) || path.includes(lower);
			})
			.slice(0, 8);
	}, [mentionSearch, explorerNodes]);

	const handleInputChange = (value: string) => {
		setChatInput(value);
		const cursorPos = value.length;
		const textBeforeCursor = value.slice(0, cursorPos);
		const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
		if (mentionMatch) {
			setMentionSearch(mentionMatch[1] ?? "");
			setMentionSelected(0);
		} else {
			setMentionSearch(null);
			setMentionSelected(0);
		}
	};

	const insertMention = (node: ExplorerNode) => {
		const mentionText = `@${nodeDisplayLabel(node).replace(/\s+/g, "_")}`;
		const textBeforeCursor = chatInput.slice(
			0,
			chatInput.length - (mentionSearch?.length ?? 0),
		);
		const newText = textBeforeCursor + mentionText + " ";
		setChatInput(newText);
		setMentionSearch(null);
		setMentionSelected(0);
	};

	const parseMentions = (
		text: string,
	): { text: string; mentionedNodes: ExplorerNode[] } => {
		const mentionRegex = /@(\w+)/g;
		const mentionedNodes: ExplorerNode[] = [];
		let match;
		while ((match = mentionRegex.exec(text)) !== null) {
			const mentionName = match[1];
			if (mentionName) {
				const found = explorerNodes.find(
					(node) =>
						nodeDisplayLabel(node).replace(/\s+/g, "_") === mentionName ||
						getNodePath(node).includes(mentionName),
				);
				if (found) mentionedNodes.push(found);
			}
		}
		const cleanText = text.replace(/@(\w+)/g, (fullMatch, name) => {
			const found = explorerNodes.find(
				(node) =>
					nodeDisplayLabel(node).replace(/\s+/g, "_") === name ||
					getNodePath(node).includes(name),
			);
			return found ? `[Node: ${nodeDisplayLabel(found)}]` : fullMatch;
		});
		return { text: cleanText, mentionedNodes };
	};

	const sendAi = async (rawText?: string) => {
		const text = (rawText ?? chatInput).trim();
		if (!text) return;
		if (!repoId.trim()) {
			toast.error("No repository loaded. Index a repo first.");
			return;
		}

		setTab("ai");
		setChatMessages((current) => [
			...current,
			{ id: makeMessageId(), role: "user", text },
		]);
		setChatInput("");
		pendingContextFilesRef.current = [];
		try {
			const { text: cleanedText, mentionedNodes } = parseMentions(text);

			const contextNodes: ExplorerNode[] =
				selectedNodeIds.length > 0
					? (selectedNodeIds
							.map((id) => filteredNodes.find((n) => String(n.id) === id))
							.filter(Boolean) as ExplorerNode[])
					: selectedNode
						? [selectedNode]
						: [];

			const body: {
				repoId: string;
				question: string;
				mentionedNodes?: { id: string; name: string; path: string }[];
				selectedNodes?: { id: string; name: string; path: string }[];
			} = {
				repoId: repoId.trim(),
				question: cleanedText,
			};
			if (mentionedNodes.length > 0) {
				body.mentionedNodes = mentionedNodes.map((node) => ({
					id: String(node.id),
					name: nodeDisplayLabel(node),
					path: getNodePath(node),
				}));
			}
			if (contextNodes.length > 0) {
				body.selectedNodes = contextNodes.map((node) => ({
					id: String(node.id),
					name: nodeDisplayLabel(node),
					path: getNodePath(node),
				}));
			}
			const answer = await complete(cleanedText, {
				body,
			});
			const contextFiles = pendingContextFilesRef.current;
			pendingContextFilesRef.current = [];
			setChatMessages((current) => [
				...current,
				{
					id: makeMessageId(),
					role: "assistant",
					text:
						typeof answer === "string" && answer.trim()
							? answer
							: "No answer returned.",
					contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
				},
			]);
		} catch {
			pendingContextFilesRef.current = [];
			setChatMessages((current) => [
				...current,
				{
					id: makeMessageId(),
					role: "assistant",
					text: "Error: failed to get AI response.",
				},
			]);
		}
	};

	const embedNodes = async () => {
		if (!repoId.trim()) {
			toast.error("No repository loaded. Index a repo first.");
			return;
		}
		if (!repoRoot.trim()) {
			toast.error(
				"Missing project path. Re-index the repo so embed can locate files.",
			);
			return;
		}

		setEmbedLoading(true);
		try {
			const res = await fetch(`${baseUrl}/graphrag/embedRepo`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					repoId: repoId.trim(),
					repoRoot: repoRoot.trim(),
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || data?.ok === false) {
				throw new Error(data?.error ?? `Embedding failed (${res.status})`);
			}
			toast.success("Embedding completed for current repository.");
		} catch (err: any) {
			toast.error(err?.message ?? "Failed to embed repository nodes");
		} finally {
			setEmbedLoading(false);
		}
	};

	return (
		<section className="min-h-[calc(100vh-50px)] bg-[var(--bg)]">
			<div className="flex h-[calc(100vh-50px)] flex-col overflow-hidden">
				<div className="flex h-12 items-center border-b border-[var(--b1)] bg-[var(--s0)] px-5 text-[13px]">
					<button
						className="mr-4 text-[var(--t2)] hover:text-[var(--t0)]"
						onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
					>
						{isLeftSidebarOpen ? (
							<PanelLeftClose className="h-4 w-4" />
						) : (
							<PanelLeftOpen className="h-4 w-4" />
						)}
					</button>
					<div className="flex items-center gap-8">
						<button
							className={
								topView === "explorer"
									? "border-b-2 border-[var(--t0)] pb-[14px] pt-4 font-medium text-[var(--t0)]"
									: "pb-[14px] pt-4 text-[var(--t2)] hover:text-[var(--t0)]"
							}
							onClick={() => setTopView("explorer")}
						>
							Explorer
						</button>
						<button
							className={
								topView === "tour"
									? "border-b-2 border-[var(--t0)] pb-[14px] pt-4 font-medium text-[var(--t0)]"
									: "pb-[14px] pt-4 text-[var(--t2)] hover:text-[var(--t0)]"
							}
							onClick={() => setTopView("tour")}
						>
							Tour
						</button>
						<span className="font-mono text-[11px] text-[var(--t2)]">
							{repoName}
						</span>
					</div>
					<div className="ml-auto flex items-center gap-3">
						{/* Node limit selector */}
						<div className="flex items-center gap-1.5">
							<span className="text-[11px] text-[var(--t3)]">Limit</span>
							<select
								className="h-8 rounded-[6px] border border-[var(--b2)] bg-[var(--s1)] px-2 text-[12px] text-[var(--t1)] outline-none"
								value={nodeLimit}
								onChange={(e) => setNodeLimit(Number(e.target.value))}
								title="Max nodes to load from backend"
							>
								{[250, 500, 1000, 2000, 5000].map((n) => (
									<option key={n} value={n}>
										{n.toLocaleString()}
									</option>
								))}
							</select>
						</div>

						{/* Truncation warning badge */}
						{truncated && (
							<span
								className="inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[11px] font-medium"
								style={{
									background: "var(--amber-l)",
									color: "var(--amber)",
									border: "1px solid var(--amber-b)",
								}}
								title="The graph was capped at the current limit. Increase the limit to see all nodes."
							>
								⚠ Capped at {nodeLimit.toLocaleString()}
							</span>
						)}

						<button
							className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[var(--b2)] px-3 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)] disabled:cursor-not-allowed disabled:opacity-60"
							onClick={embedNodes}
							disabled={embedLoading}
						>
							<Upload className="h-3.5 w-3.5" />{" "}
							{embedLoading ? "Embedding..." : "Embed Nodes"}
						</button>
						<button
							className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[var(--b2)] px-3 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)] disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void handleReIndex()}
							disabled={reIndexing}
						>
							<RefreshCw className={`h-3.5 w-3.5 ${reIndexing ? "animate-spin" : ""}`} /> Sync
						</button>
						{aiEnabledForSelection && (
							<button
								className="inline-flex h-8 items-center rounded-[6px] bg-[var(--t0)] px-3 text-[12px] text-[var(--s0)]"
								onClick={() => setTab("ai")}
							>
								Ask AI
							</button>
						)}
					</div>
				</div>

				<div
					className="grid flex-1 overflow-hidden"
					style={{
						gridTemplateColumns: isLeftSidebarOpen
							? "300px 1fr 360px"
							: "0px 1fr 360px",
					}}
				>
					<aside className="flex flex-col overflow-hidden border-r border-[var(--b1)] bg-[var(--s0)]">
						<div className="border-b border-[var(--b0)] p-2.5">
							<div className="relative">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--t3)]" />
								<input
									className="w-full rounded-[6px] border border-[var(--b1)] bg-[var(--s1)] py-2 pl-8 pr-3 text-[12px] outline-none"
									placeholder="Search nodes..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
								/>
							</div>
						</div>

						<div className="border-b border-[var(--b0)] px-3 py-3">
							<div className="pb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
								Interaction mode
							</div>
							<div className="grid grid-cols-2 gap-1">
								{[
									["select", "Select", "inspect node"],
									["neighbour", "Neighbours", "explore connections"],
									["path", "Path trace", "shortest path"],
									["insight", "Insights", "hotspots & depth"],
								].map(([value, label, sub]) => (
									<button
										key={value}
										className={`rounded-[6px] border px-2 py-2 text-center text-[11px] ${mode === value ? "border-transparent bg-[var(--t0)] text-[var(--s0)]" : "border-[var(--b1)] text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"}`}
										onClick={() => setMode(value as Mode)}
									>
										<div>{label}</div>
										<div className="text-[9px] opacity-70">{sub}</div>
									</button>
								))}
							</div>
						</div>

						<div className="border-b border-[var(--b0)] px-3 py-3">
							<div className="pb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
								Edge types
							</div>
							{(["CONTAINS", "IMPORTS", "CALLS"] as EdgeCategory[]).map(
								(type) => (
									<label
										key={type}
										className="flex items-center gap-2 py-1 text-[12px] text-[var(--t1)]"
									>
										<input
											type="checkbox"
											checked={visibleEdgeTypes[type]}
											onChange={(e) =>
												setVisibleEdgeTypes((cur) => ({
													...cur,
													[type]: e.target.checked,
												}))
											}
										/>
										<span
											className="h-2.5 w-2.5 rounded-[2px]"
											style={{
												background:
													type === "CONTAINS"
														? "var(--purple)"
														: type === "IMPORTS"
															? "var(--blue)"
															: "var(--green)",
											}}
										/>
										{type}
									</label>
								),
							)}
						</div>

						<div className="border-b border-[var(--b0)] px-3 py-3">
							<div className="pb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
								Node types
							</div>
							{(["folder", "file", "class", "fn", "ast"] as ExplorerNodeKind[]).map(
								(kind) => (
									<label
										key={kind}
										className="flex items-center gap-2 py-1 text-[12px] text-[var(--t1)]"
									>
										<input
											type="checkbox"
											checked={visibleKinds[kind]}
											onChange={(e) =>
												setVisibleKinds((cur) => ({
													...cur,
													[kind]: e.target.checked,
												}))
											}
										/>
										<span
											className="h-2.5 w-2.5 rounded-full"
											style={{
												background:
													kind === "folder"
														? "var(--purple)"
														: kind === "file"
															? "var(--blue)"
															: kind === "class"
																? "var(--amber)"
																: kind === "fn"
																	? "var(--green)"
																	: "#14b8a6",
											}}
										/>
										{kind === "fn"
											? "Function"
											: kind === "ast"
												? "AST"
											: kind[0]!.toUpperCase() + kind.slice(1)}
									</label>
								),
							)}
						</div>

						<div className="px-3 pt-3 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
							Repository tree
						</div>
						<div className="flex-1 overflow-y-auto py-2">
							{treeItems.map((item) => (
								<button
									key={item.key}
									onClick={() =>
										item.nodeId && setSelectedNodeId(String(item.nodeId))
									}
									className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] ${item.nodeId && String(item.nodeId) === String(selectedNode?.id) ? "bg-[var(--s2)] text-[var(--t0)]" : "text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"}`}
									style={{ paddingLeft: `${12 + item.depth * 14}px` }}
								>
									<span
										className="h-2 w-2 rounded-[2px]"
										style={{
											background: item.label.endsWith("/")
												? "var(--purple)"
												: "var(--blue)",
										}}
									/>
									{item.label}
								</button>
							))}
						</div>
					</aside>

					<div className="relative overflow-hidden bg-[var(--bg)]">
						<div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 overflow-hidden rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] shadow-sm">
							{layoutOptions.map(({ label, icon: Comp }) => {
								const isActive =
									(label === "Force layout" && activeLayout === "force") ||
									(label === "Hierarchical" &&
										activeLayout === "hierarchical") ||
									(label === "Radial" && activeLayout === "radial");
								const handleClick = () => {
									if (label === "Force layout") {
										setActiveLayout("force");
										graphCanvasRef.current?.setLayout("force");
									} else if (label === "Hierarchical") {
										setActiveLayout("hierarchical");
										graphCanvasRef.current?.setLayout("hierarchical");
									} else if (label === "Radial") {
										setActiveLayout("radial");
										graphCanvasRef.current?.setLayout("radial");
									} else if (label === "Fit") {
										graphCanvasRef.current?.fit();
									}
								};
								return (
									<button
										key={label}
										onClick={handleClick}
										className={`inline-flex h-8 items-center gap-1 border-r border-[var(--b0)] px-3 text-[11px] transition-colors last:border-r-0 ${isActive ? "bg-[var(--t0)] text-[var(--s0)]" : "text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"}`}
									>
										<Comp className="h-3.5 w-3.5" /> {label}
									</button>
								);
							})}
						</div>

						{/* Sparse-data / incomplete indexing banner */}
						{graphLooksSparse && (
							<div
								className="absolute left-1/2 top-14 z-10 -translate-x-1/2 w-[520px] rounded-[12px] p-4"
								style={{
									background: "var(--s0)",
									border: "1px solid var(--amber-b)",
									boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
								}}
							>
								<div className="mb-3 flex items-start gap-3">
									<div
										className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
										style={{ background: "var(--amber-l)" }}
									>
										<span style={{ color: "var(--amber)", fontSize: 16 }}>
											⚠
										</span>
									</div>
									<div>
										<div
											className="text-[13px] font-semibold"
											style={{ color: "var(--t0)" }}
										>
											Only {graph.nodes.length} nodes returned — indexing may be
											incomplete
										</div>
										<div
											className="mt-1 text-[11px] leading-5"
											style={{ color: "var(--t2)" }}
										>
											Neo4j has very few nodes for this repo. This usually means
											the indexing only stored top-level folders but didn't
											complete. Re-index to fix this.
										</div>
									</div>
								</div>

								{/* Diagnostics */}
								<div
									className="mb-3 rounded-[8px] px-3 py-2 text-[11px]"
									style={{ background: "var(--s1)" }}
								>
									<div className="flex justify-between py-0.5">
										<span style={{ color: "var(--t2)" }}>repoId</span>
										<span className="font-mono" style={{ color: "var(--t0)" }}>
											{repoId || "—"}
										</span>
									</div>
									<div className="flex justify-between py-0.5">
										<span style={{ color: "var(--t2)" }}>project path</span>
										<span
											className="max-w-[300px] truncate font-mono"
											style={{ color: "var(--t0)" }}
										>
											{repoRoot || "not set"}
										</span>
									</div>
								<div className="flex justify-between py-0.5">
									<span style={{ color: "var(--t2)" }}>nodes in Neo4j</span>
									<span
										className="font-mono"
										style={{ color: "var(--amber)" }}
										>
										{graph.nodes.length} (expected hundreds+)
									</span>
								</div>
								{lastSyncStats && (
									<>
										<div className="flex justify-between py-0.5">
											<span style={{ color: "var(--t2)" }}>last sync diff</span>
											<span
												className="font-mono"
												style={{ color: "var(--t0)" }}
											>
												+{lastSyncStats.added} ~{lastSyncStats.changed} -{lastSyncStats.removed}
											</span>
										</div>
										<div className="flex justify-between py-0.5">
											<span style={{ color: "var(--t2)" }}>dependent impact</span>
											<span
												className="font-mono"
												style={{ color: "var(--t0)" }}
											>
												{lastSyncStats.impactedDependents} dependents, {lastSyncStats.processedFiles} processed
											</span>
										</div>
									</>
								)}
								</div>

								<div className="flex gap-2">
									{repoRoot ? (
										<button
											className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[8px] text-[12px] font-semibold disabled:opacity-60"
											style={{ background: "var(--t0)", color: "var(--s0)" }}
											onClick={handleReIndex}
											disabled={reIndexing}
										>
											{reIndexing ? (
												<>
													<RefreshCw className="h-3.5 w-3.5 animate-spin" />{" "}
													Re-indexing…
												</>
											) : (
												<>
													<RefreshCw className="h-3.5 w-3.5" /> Re-index &amp;
													reload graph
												</>
											)}
										</button>
									) : (
										<a
											href="/indexing"
											className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[8px] text-[12px] font-semibold"
											style={{ background: "var(--t0)", color: "var(--s0)" }}
										>
											Go to Indexing page →
										</a>
									)}
									<button
										className="inline-flex h-9 items-center rounded-[8px] px-3 text-[12px]"
										style={{
											border: "1px solid var(--b2)",
											color: "var(--t2)",
										}}
										onClick={() => setShowReIndexPanel(false)}
									>
										Dismiss
									</button>
								</div>
							</div>
						)}



						<div className="absolute bottom-3 left-3 z-10 rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] p-3 text-[11px] text-[var(--t2)]">
							<div className="mb-2 text-[9px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
								Node types
							</div>
							<div className="space-y-1">
								{topView === "tour" ? (
									<>
										<div className="flex items-center gap-2">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ background: "var(--purple)" }}
											/>
											Folder
										</div>
										<div className="flex items-center gap-2">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ background: "var(--blue)" }}
											/>
											File
										</div>
										<div className="flex items-center gap-2">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ background: "#ef4444" }}
											/>
											Tour File
										</div>
									</>
								) : (
									[
										["Folder", "var(--purple)"],
										["File", "var(--blue)"],
										["Class", "var(--amber)"],
										["Function", "var(--green)"],
										["AST", "#14b8a6"],
									].map(([label, color]) => (
										<div key={label} className="flex items-center gap-2">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ background: color as string }}
											/>
											{label}
										</div>
									))
								)}
							</div>
						</div>

						<div className="absolute right-3 top-3 z-10 overflow-hidden rounded-[10px] border border-[var(--b1)] bg-[var(--s0)]">
							<button
								onClick={() => graphCanvasRef.current?.zoomIn()}
								className="grid h-8 w-8 place-items-center border-b border-[var(--b0)] text-[var(--t1)] hover:bg-[var(--s1)] active:bg-[var(--s2)]"
							>
								<Plus className="h-4 w-4" />
							</button>
							<button
								onClick={() => graphCanvasRef.current?.zoomOut()}
								className="grid h-8 w-8 place-items-center border-b border-[var(--b0)] text-[var(--t1)] hover:bg-[var(--s1)] active:bg-[var(--s2)]"
							>
								<Minus className="h-4 w-4" />
							</button>
							<button
								onClick={() => graphCanvasRef.current?.fit()}
								className="grid h-8 w-8 place-items-center text-[var(--t1)] hover:bg-[var(--s1)] active:bg-[var(--s2)]"
								title="Fit all nodes"
							>
								<Square className="h-3.5 w-3.5" />
							</button>
						</div>

						<div className="absolute bottom-3 right-3 z-10 rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] p-3 text-[11px] text-[var(--t2)]">
							<div className="flex justify-between gap-6">
								<span>Nodes visible</span>
								<span className="font-mono text-[var(--t0)]">
									{filteredNodes.length}
								</span>
							</div>
							<div className="flex justify-between gap-6">
								<span>Edges visible</span>
								<span className="font-mono text-[var(--t0)]">
									{filteredEdges.length}
								</span>
							</div>
							<div className="flex justify-between gap-6">
								<span>Selected</span>
								<span className="font-mono text-[var(--t0)]">
									{selectedNode ? selectedNode.displayLabel : "—"}
								</span>
							</div>
							<div className="flex justify-between gap-6">
								<span>Mode</span>
								<span className="font-mono text-[var(--t0)]">
									{topView === "tour" ? "tour" : mode}
								</span>
							</div>
						</div>

						{loading ? (
							<div className="grid h-full place-items-center text-[var(--t2)]">
								Loading graph from backend…
							</div>
						) : filteredNodes.length === 0 ? (
							<div className="grid h-full place-items-center px-10 text-center">
								<div className="max-w-[340px]">
									<div className="mb-3 text-[var(--t2)] text-[13px]">
										{repoId
											? "No graph nodes matched the current filters."
											: "Run indexing first so the graph page can load the last repoId from session."}
									</div>
									{/* Diagnostic block */}
									<div className="rounded-[10px] border border-[var(--b1)] bg-[var(--s0)] p-4 text-left text-[11px]">
										<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
											Session diagnostics
										</div>
										<div className="flex justify-between border-b border-[var(--b0)] py-1.5">
											<span className="text-[var(--t2)]">repoId</span>
											<span className="font-mono text-[var(--t0)]">
												{repoId || "—"}
											</span>
										</div>
										<div className="flex justify-between border-b border-[var(--b0)] py-1.5">
											<span className="text-[var(--t2)]">baseUrl</span>
											<span className="font-mono text-[var(--t0)]">
												{baseUrl || "(empty = same origin)"}
											</span>
										</div>
										<div className="flex justify-between border-b border-[var(--b0)] py-1.5">
											<span className="text-[var(--t2)]">limit</span>
											<span className="font-mono text-[var(--t0)]">
												{nodeLimit}
											</span>
										</div>
										<div className="flex justify-between py-1.5">
											<span className="text-[var(--t2)]">
												raw nodes returned
											</span>
											<span className="font-mono text-[var(--t0)]">
												{graph.nodes.length}
											</span>
										</div>
									</div>
									{graph.nodes.length > 0 && (
										<div className="mt-3 rounded-[8px] border border-[var(--amber-b)] bg-[var(--amber-l)] px-3 py-2 text-[11px] text-[var(--amber)]">
											{graph.nodes.length} node
											{graph.nodes.length !== 1 ? "s" : ""} loaded but all
											filtered out — check Edge types and Node types filters in
											the left sidebar.
										</div>
									)}
								</div>
							</div>
						) : (
							<ExplorerGraphCanvas
								ref={graphCanvasRef}
								nodes={
									topView === "tour"
										? filteredNodes.filter(
												(n) => n.kind === "file" || n.kind === "folder",
											)
										: filteredNodes
								}
								edges={
									topView === "tour"
										? filteredEdges.filter((e) => {
												const fromNode = filteredNodes.find(
													(n) => String(n.id) === String(e.from),
												);
												const toNode = filteredNodes.find(
													(n) => String(n.id) === String(e.to),
												);
												return (
													(fromNode?.kind === "file" ||
														fromNode?.kind === "folder") &&
													(toNode?.kind === "file" || toNode?.kind === "folder")
												);
											})
										: filteredEdges
								}
								selectedNodeId={selectedNode ? String(selectedNode.id) : null}
								selectedNodeIds={selectedNodeIds}
							onNodeClick={(node, event) => {
								const id = String(node.id);
								if (node.kind === "file") {
									setExpandedAstFileId((current) =>
										current === id ? null : id,
									);
								}
									if (event?.ctrlKey || event?.metaKey) {
										// Ctrl/Cmd+click: toggle multi-select, keep primary selected
										setSelectedNodeIds((prev) =>
											prev.includes(id)
												? prev.filter((x) => x !== id)
												: [...prev, id],
										);
										// Also add to AI context
										setTab("ai");
									} else {
										// Normal click: single select, clear multi
										setSelectedNodeId(id);
										setSelectedNodeIds([id]);
										if (mode === "select") setTab("detail");
									}
								}}
								mode={mode}
								pathNodeIds={currentPath}
								highlightNodeIds={highlightNodeIds}
								tourHighlightNodeIds={
									topView === "tour" ? tourHighlightNodeIds : undefined
								}
								activeTourNodeId={
									topView === "tour" ? activeTourNodeId : undefined
								}
							/>
						)}
					</div>

					<aside className="flex flex-col overflow-hidden border-l border-[var(--b1)] bg-[var(--s0)]">
						{topView === "tour" ? (
							<div className="flex flex-1 flex-col overflow-hidden">
								{tourData && tourSteps.length > 0 && !tourLoading ? (
									<>
										<div className="flex items-center justify-between border-b border-[var(--b1)] px-4 py-3">
											<div className="text-[11px] font-medium uppercase tracking-[0.07em] text-[var(--t2)]">
												Tour
											</div>
											<button
												className="rounded-[6px] border border-[var(--b1)] px-2 py-1 text-[10px] text-[var(--t1)] hover:bg-[var(--s1)]"
												onClick={() => {
													setTourData(null);
													setTourIndex(0);
												}}
											>
												Back
											</button>
										</div>

										<div className="flex-1 overflow-y-auto p-4 text-[11px]">
											{tourError ? (
												<div className="rounded-[8px] border border-red-500/30 bg-red-500/10 p-3 text-red-200">
													{tourError}
												</div>
											) : activeTourStep ? (
												<>
													<div className="rounded-[10px] bg-[var(--s1)] p-3">
														<div className="mb-2 text-[10px] uppercase tracking-[0.07em] text-[var(--t3)]">
															Step {activeTourStep.rank} of {tourSteps.length}
														</div>
														<div className="font-mono text-[12px] text-[var(--t0)]">
															{activeTourStep.filePath}
														</div>
														<div className="mt-2 flex gap-4 text-[10px] text-[var(--t2)]">
															<span>
																Score: {activeTourStep.score.toFixed(2)}
															</span>
															<span>
																Degree: {activeTourStep.metrics.totalDegree}
															</span>
															<span>Depth: {activeTourStep.metrics.depth}</span>
														</div>
													</div>

													<div className="mt-3 flex items-center gap-2">
														<button
															className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--b1)] text-[var(--t1)] hover:bg-[var(--s1)] disabled:cursor-not-allowed disabled:opacity-50"
															onClick={() =>
																setTourIndex((current) =>
																	Math.max(0, current - 1),
																)
															}
															disabled={tourIndex <= 0}
														>
															<ArrowLeft className="h-4 w-4" />
														</button>
														<div className="flex-1 text-center text-[10px] text-[var(--t3)]">
															{tourIndex + 1} / {tourSteps.length}
														</div>
														<button
															className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--b1)] text-[var(--t1)] hover:bg-[var(--s1)] disabled:cursor-not-allowed disabled:opacity-50"
															onClick={() =>
																setTourIndex((current) =>
																	Math.min(tourSteps.length - 1, current + 1),
																)
															}
															disabled={tourIndex >= tourSteps.length - 1}
														>
															<ArrowRight className="h-4 w-4" />
														</button>
													</div>

													<div className="mt-4">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
															Summary
														</div>
									<div className="rounded-[8px] bg-[var(--s1)] p-3">
										<AnimatedMarkdown
											markdown={activeTourStep.summary}
											emptyText="No summary available for this step."
										/>
									</div>
													</div>

													<div className="mt-4">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
															All steps
														</div>
														<div className="space-y-2">
															{tourSteps.map((step, index) => (
																<button
																	key={step.filePath}
																	onClick={() => setTourIndex(index)}
																	className={`w-full rounded-[6px] border px-3 py-2 text-left ${index === tourIndex ? "border-[var(--blue)] bg-[var(--blue-l)]" : "border-[var(--b1)] bg-[var(--s1)] hover:bg-[var(--s2)]"}`}
																>
																	<div className="mb-1 flex items-center justify-between gap-3">
																		<span className="text-[10px] text-[var(--t2)]">
																			#{step.rank}
																		</span>
																		<span className="font-mono text-[10px] text-[var(--t2)]">
																			score {step.score.toFixed(2)}
																		</span>
																	</div>
																	<div className="truncate font-mono text-[11px] text-[var(--t0)]">
																		{step.filePath}
																	</div>
																</button>
															))}
														</div>
													</div>
												</>
											) : (
												<div className="text-[var(--t2)]">
													No tour steps yet.
												</div>
											)}
										</div>
									</>
								) : (
									<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
										<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--blue-l)]">
											<FileText className="h-8 w-8 text-[var(--blue)]" />
										</div>
										<button
											className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--t0)] px-6 text-[13px] font-medium text-[var(--s0)] hover:bg-[var(--t0)]/90 disabled:cursor-not-allowed disabled:opacity-50"
											onClick={() => void loadTour()}
											disabled={tourLoading}
										>
											{tourLoading ? (
												<>
													<RefreshCw className="h-4 w-4 animate-spin" />
													Generating Tour...
												</>
											) : (
												<>
													<Sparkles className="h-4 w-4" />
													Generate Tour
												</>
											)}
										</button>
										<div className="flex flex-col items-center gap-3">
											<div className="flex items-center justify-center gap-3">
												<button
													className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--b1)] bg-[var(--s1)] text-[var(--t2)] hover:bg-[var(--s2)] disabled:cursor-not-allowed disabled:opacity-50"
													onClick={() =>
														setTopFilesCount((prev) => Math.max(5, prev - 1))
													}
													disabled={topFilesCount <= 5}
												>
													<Minus className="h-3 w-3" />
												</button>
												<div className="flex items-center gap-2">
													<span className="text-[12px] font-medium text-[var(--t1)]">
														Top
													</span>
													<span className="flex h-7 min-w-[32px] items-center justify-center rounded-[4px] bg-[var(--blue-l)] px-2 text-[13px] font-medium text-[var(--blue)]">
														{topFilesCount}
													</span>
													<span className="text-[12px] font-medium text-[var(--t1)]">
														files
													</span>
												</div>
												<button
													className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--b1)] bg-[var(--s1)] text-[var(--t2)] hover:bg-[var(--s2)] disabled:cursor-not-allowed disabled:opacity-50"
													onClick={() =>
														setTopFilesCount((prev) => Math.min(20, prev + 1))
													}
													disabled={topFilesCount >= 20}
												>
													<Plus className="h-3 w-3" />
												</button>
											</div>
											<input
												type="range"
												min={5}
												max={20}
												value={topFilesCount}
												onChange={(e) =>
													setTopFilesCount(Number(e.target.value))
												}
												className="h-2 w-[140px] cursor-pointer appearance-none rounded-full bg-[var(--b1)] accent-[var(--blue)]"
											/>
										</div>
										<p className="max-w-[240px] text-center text-[11px] leading-5 text-[var(--t2)]">
											Feature: The CodeAtlas tour feature gives you info for the
											top {topFilesCount} important files
										</p>
										{tourError && (
											<div className="mt-2 rounded-[8px] border border-red-500/30 bg-red-500/10 p-3 text-[10px] text-red-200">
												{tourError}
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<>
								<div className="flex border-b border-[var(--b1)] text-[12px]">
									{(
										aiEnabledForSelection
											? (["detail", "parsing", "insights", "ai"] as RightTab[])
											: (["detail", "parsing", "insights"] as RightTab[])
									).map((item) => (
										<button
											key={item}
											className={`flex-1 px-4 py-3 capitalize ${tab === item ? "border-b-2 border-[var(--t0)] text-[var(--t0)]" : "text-[var(--t2)] hover:text-[var(--t0)]"}`}
											onClick={() => setTab(item)}
										>
											{item}
										</button>
									))}
								</div>

								{tab === "detail" && (
									<div className="flex-1 overflow-y-auto p-4">
										{selectedNode ? (
											<>
												<div className="rounded-[10px] bg-[var(--s1)] p-3">
													<div className="mb-2 flex flex-wrap items-center gap-2">
														<div
															className="inline-flex rounded-[4px] px-2 py-0.5 font-mono text-[10px]"
															style={{
																background:
																	selectedNode.kind === "folder"
																		? "var(--purple-l)"
																		: selectedNode.kind === "file"
																			? "var(--blue-l)"
																			: selectedNode.kind === "class"
																				? "var(--amber-l)"
																				: selectedNode.kind === "fn"
																					? "var(--green-l)"
																					: "#ccfbf1",
																color:
																	selectedNode.kind === "folder"
																		? "var(--purple)"
																		: selectedNode.kind === "file"
																			? "var(--blue)"
																			: selectedNode.kind === "class"
																				? "var(--amber)"
																			: selectedNode.kind === "fn"
																				? "var(--green)"
																				: "#0f766e",
															}}
														>
															{selectedNodeTypeLabel}
														</div>
													</div>
													<div className="text-[14px] font-medium font-mono">
														{selectedNode.kind === "ast"
															? astNodeDisplayName(selectedNode)
															: selectedNode.displayLabel}
													</div>
													<div className="mt-1 text-[10px] font-mono text-[var(--t2)]">
														{getNodePath(selectedNode)}
													</div>
												</div>

												{false && selectedFileNode && (
													<div className="mt-5">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
															Parse Report
														</div>
														<div
															className="rounded-[10px] border p-3"
															style={{
																background:
																	parseStatusTone(selectedParseStatus)?.background ?? "var(--s1)",
																borderColor:
																	parseStatusTone(selectedParseStatus)?.border ?? "var(--b1)",
															}}
														>
															<div className="flex items-start justify-between gap-3">
																<div>
																	<div
																		className="text-[12px] font-semibold"
																		style={{ color: "var(--t0)" }}
																	>
																		{nodeDisplayLabel(selectedFileNode!)}
																	</div>
																	<div
																		className="mt-1 text-[11px] leading-5"
																		style={{ color: "var(--t2)" }}
																	>
																		{selectedParseStatus === "parsed"
																			? "Tree-sitter and segment extraction completed cleanly for this file."
																			: selectedParseStatus === "partial"
																				? "This file parsed with recoverable syntax issues. AST segments are available but may be incomplete."
																				: selectedParseStatus === "failed"
																					? "This file failed structural parsing. Any extracted facts are fallback-driven only."
																					: "No parse result was recorded for this file."}
																	</div>
																</div>
																{parseStatusTone(selectedParseStatus) && (
																	<div
																		className="rounded-full border px-2 py-1 font-mono text-[10px]"
																		style={{
																			background:
																				parseStatusTone(selectedParseStatus)?.background,
																			borderColor:
																				parseStatusTone(selectedParseStatus)?.border,
																			color: parseStatusTone(selectedParseStatus)?.color,
																		}}
																	>
																		{
																			parseStatusTone(selectedParseStatus)?.label
																		}
																	</div>
																)}
															</div>
															<div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
																{[
																	["Parser", getStringProperty(selectedFileNode!.properties?.parser) ?? "—"],
																	["Parse errors", String(getNumberProperty(selectedFileNode!.properties?.parseErrors) ?? 0)],
																	["Imports", String(getNumberProperty(selectedFileNode!.properties?.importCount) ?? 0)],
																	["Call sites", String(getNumberProperty(selectedFileNode!.properties?.callSiteCount) ?? 0)],
																].map(([label, value]) => (
																	<div
																		key={label}
																		className="rounded-[8px] px-3 py-2"
																		style={{ background: "rgba(255,255,255,0.45)" }}
																	>
																		<div className="text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
																			{label}
																		</div>
																		<div className="mt-1 font-mono text-[var(--t0)]">{value}</div>
																	</div>
																))}
															</div>
														</div>
													</div>
												)}

												{false && selectedFileNode && (
													<div className="mt-5">
														<div className="mb-2 flex items-center justify-between">
															<div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
																AST Inventory
															</div>
															{selectedNode.kind === "file" && (
																<button
																	className="rounded-[4px] border border-[var(--b1)] px-2 py-0.5 text-[10px] text-[var(--t2)] hover:bg-[var(--s1)]"
																	onClick={() =>
																		setExpandedAstFileId((current) =>
																			current === String(selectedFileNode!.id)
																				? null
																				: String(selectedFileNode!.id),
																		)
																	}
																>
																	{expandedAstFileId === String(selectedFileNode!.id)
																		? "Collapse graph AST"
																		: "Expand graph AST"}
																</button>
															)}
														</div>
														<div className="space-y-2">
															<div className="grid grid-cols-2 gap-2">
																{[
																	["Classes", selectedAstSummary.classes],
																	["Functions", selectedAstSummary.functions],
																	["Modules", selectedAstSummary.modules],
																	["Members", selectedAstSummary.members],
																	["Imports", selectedAstSummary.imports],
																	["Calls", selectedAstSummary.calls],
																].map(([label, values]) => (
																	<div
																		key={String(label)}
																		className="rounded-[10px] border px-3 py-3"
																		style={{ borderColor: "var(--b1)", background: "var(--s1)" }}
																	>
																		<div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
																			{label}
																		</div>
																		{Array.isArray(values) && values.length > 0 ? (
																			<div className="flex flex-wrap gap-1.5">
																				{values.map((value) => (
																					<span
																						key={value}
																						className="rounded-full bg-[var(--s0)] px-2 py-1 font-mono text-[10px] text-[var(--t1)]"
																					>
																						{value}
																					</span>
																				))}
																			</div>
																		) : (
																			<div className="text-[11px] text-[var(--t2)]">None</div>
																		)}
																	</div>
																))}
															</div>
															<div className="rounded-[10px] border px-3 py-3" style={{ borderColor: "var(--b1)", background: "var(--s1)" }}>
																<div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
																	Segment kinds
																</div>
																{selectedAstSummary.unitKinds.length > 0 ? (
																	<div className="flex flex-wrap gap-1.5">
																		{selectedAstSummary.unitKinds.map(([unitKind, count]) => (
																			<span
																				key={unitKind}
																				className="rounded-full bg-[var(--s0)] px-2 py-1 font-mono text-[10px] text-[var(--t1)]"
																			>
																				{unitKind} × {count}
																			</span>
																		))}
																	</div>
																) : (
																	<div className="text-[11px] text-[var(--t2)]">No segment kinds recorded.</div>
																)}
															</div>
															{selectedAstNodes.length > 0 ? (
																selectedAstNodes.slice(0, 18).map((astNode) => {
																	const unitKind =
																		getStringProperty(astNode.properties?.unitKind) ?? "ast";
																	const startLine =
																		getNumberProperty(astNode.properties?.startLine);
																	const endLine =
																		getNumberProperty(astNode.properties?.endLine);
																	const extractorMethod =
																		getStringProperty(astNode.properties?.extractionMethod);
																	const topLevelSymbols =
																		getStringArrayProperty(astNode.properties?.topLevelSymbols);
																	return (
																		<button
																			key={String(astNode.id)}
																			className="w-full rounded-[10px] border px-3 py-2 text-left hover:bg-[var(--s1)]"
																			style={{ borderColor: "var(--b1)", background: "var(--s0)" }}
																			onClick={() => setSelectedNodeId(String(astNode.id))}
																		>
																			<div className="flex items-start justify-between gap-3">
																				<div>
																					<div className="font-mono text-[11px] text-[var(--t0)]">
																						{astNodeDisplayName(astNode)}
																					</div>
																					<div className="mt-1 text-[10px] text-[var(--t2)]">
																						{unitKind}
																						{startLine !== null
																							? ` · lines ${startLine}${endLine !== null ? `-${endLine}` : ""}`
																							: ""}
																						{extractorMethod ? ` · ${extractorMethod}` : ""}
																					</div>
																					{topLevelSymbols.length > 0 && (
																						<div className="mt-1 text-[10px] text-[var(--t3)]">
																							Symbols: {topLevelSymbols.join(", ")}
																						</div>
																					)}
																				</div>
																				<div className="rounded-full bg-[#ccfbf1] px-2 py-0.5 font-mono text-[10px] text-[#115e59]">
																					AST
																				</div>
																			</div>
																		</button>
																	);
																})
															) : (
																<div className="rounded-[8px] bg-[var(--s1)] px-3 py-3 text-[11px] text-[var(--t2)]">
																	No AST segments are attached to this file.
																</div>
															)}
															{selectedAstNodes.length > 18 && (
																<div className="text-[10px] text-[var(--t3)]">
																	Showing 18 of {selectedAstNodes.length} AST nodes.
																</div>
															)}
														</div>
													</div>
												)}

												{false && lastSyncDetails && (
													<div className="mt-5">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
															Last Sync
														</div>
														<div className="rounded-[10px] bg-[var(--s1)] p-3">
															<div className="mb-3 flex flex-wrap items-center gap-2">
																{[
																	[`+${lastSyncDetails!.added}`, "Added", "var(--blue-l)", "var(--blue)"],
																	[`~${lastSyncDetails!.changed}`, "Changed", "var(--amber-l)", "var(--amber)"],
																	[`-${lastSyncDetails!.removed}`, "Removed", "rgba(239,68,68,0.12)", "#b91c1c"],
																	[`${lastSyncDetails!.impactedDependents}`, "Dependents", "rgba(16,185,129,0.12)", "#047857"],
																].map(([count, label, background, color]) => (
																	<div
																		key={String(label)}
																		className="rounded-full px-2 py-1 text-[10px] font-mono"
																		style={{ background: String(background), color: String(color) }}
																	>
																		{count} {label}
																	</div>
																))}
															</div>
															{[
																["Added files", lastSyncDetails!.addedFiles],
																["Changed files", lastSyncDetails!.changedFiles],
																["Removed files", lastSyncDetails!.removedFiles],
																["Dependent files", lastSyncDetails!.dependentFiles],
															].map(([label, files]) => (
																<div key={String(label)} className="mb-3 last:mb-0">
																	<div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
																		{label}
																	</div>
																	{Array.isArray(files) && files.length > 0 ? (
																		<div className="space-y-1">
																			{files.slice(0, 8).map((filePath) => (
																				<div
																					key={filePath}
																					className="rounded-[6px] bg-[var(--s0)] px-2 py-1 font-mono text-[10px] text-[var(--t1)]"
																				>
																					{filePath}
																				</div>
																			))}
																			{files.length > 8 && (
																				<div className="text-[10px] text-[var(--t3)]">
																					+{files.length - 8} more
																				</div>
																			)}
																		</div>
																	) : (
																		<div className="text-[11px] text-[var(--t2)]">None</div>
																	)}
																</div>
															))}
														</div>
													</div>
												)}

												{false && selectedNode.kind === "ast" && (
													<div className="mt-5">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
															AST Segment
														</div>
														<div className="rounded-[10px] bg-[var(--s1)] p-3">
															<div className="grid grid-cols-2 gap-2 text-[11px]">
																{[
																	["Display name", astNodeDisplayName(selectedNode)],
																	["Unit kind", getStringProperty(selectedNode.properties?.unitKind) ?? "—"],
																	["Segment index", String(getNumberProperty(selectedNode.properties?.segmentIndex) ?? "—")],
																	["Extraction", getStringProperty(selectedNode.properties?.extractionMethod) ?? "—"],
																	["Top-level symbols", getStringArrayProperty(selectedNode.properties?.topLevelSymbols).join(", ") || "—"],
																	["Line range", (() => {
																		const startLine = getNumberProperty(selectedNode.properties?.startLine);
																		const endLine = getNumberProperty(selectedNode.properties?.endLine);
																		return startLine !== null
																			? `${startLine}${endLine !== null ? `-${endLine}` : ""}`
																			: "—";
																	})()],
																].map(([label, value]) => (
																	<div key={String(label)} className="rounded-[8px] bg-[var(--s0)] px-3 py-2">
																		<div className="text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
																			{label}
																		</div>
																		<div className="mt-1 font-mono text-[var(--t0)]">{value}</div>
																	</div>
																))}
															</div>
														</div>
													</div>
												)}

												<div className="mt-5">
													<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
														Metadata
													</div>
													{[
														["Type", selectedNodeTypeLabel],
														["Language", getNodeLanguage(selectedNode)],
														["Lines of code", String(getNodeLoc(selectedNode))],
														[
															"Parse status",
															selectedNode.kind === "file"
																? selectedParseStatus ?? "—"
																: "—",
														],
														[
															"Parser",
															getStringProperty(selectedFileNode?.properties?.parser) ?? "—",
														],
														[
															"Parse errors",
															String(getNumberProperty(selectedFileNode?.properties?.parseErrors) ?? 0),
														],
														[
															"AST nodes",
															String(
																selectedNode.kind === "file"
																	? selectedAstNodes.length
																	: getNumberProperty(selectedFileNode?.properties?.astNodeCount) ?? selectedAstNodes.length,
															),
														],
														[
															"Imports",
															String(getNumberProperty(selectedFileNode?.properties?.importCount) ?? 0),
														],
														[
															"Call sites",
															String(getNumberProperty(selectedFileNode?.properties?.callSiteCount) ?? 0),
														],
														[
															"Degree (in/out)",
															`${degreeMap.get(String(selectedNode.id))?.in ?? 0} / ${degreeMap.get(String(selectedNode.id))?.out ?? 0}`,
														],
														[
															"Depth",
															String(
																depthMap.get(String(selectedNode.id)) ?? "—",
															),
														],
													].map(([label, value]) => (
														<div
															key={label}
															className="flex justify-between border-b border-[var(--b0)] py-2 text-[12px] last:border-b-0"
														>
															<span className="text-[var(--t2)]">{label}</span>
															<span className="font-mono text-[var(--t0)]">
																{value}
															</span>
														</div>
													))}
												</div>

												{selectedNode.kind !== "ast" && (
													<div className="mt-5">
														<div className="mb-2 flex items-center justify-between">
															<div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
																Summary
															</div>
															<button
																className="rounded-[4px] bg-[var(--blue)] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[var(--blue-h)] disabled:opacity-50"
																onClick={handleSummarize}
																disabled={summarizing}
															>
																{summarizing ? "Generating..." : "Summarize"}
															</button>
														</div>
														<div className="rounded-[8px] bg-[var(--s1)] p-3">
															<AnimatedMarkdown
																markdown={summaryText}
																loading={summarizing}
																emptyText="No summary generated yet."
															/>
														</div>
													</div>
												)}

												<div className="mt-5">
													<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
														Relationships
													</div>
													<div className="space-y-2">
														{relationships.map(({ edge, target, category }) => (
															<button
																key={edge.id}
																className="flex w-full items-center gap-2 rounded-[6px] bg-[var(--s1)] px-3 py-2 text-left text-[11px] hover:bg-[var(--s2)]"
																onClick={() =>
																	setSelectedNodeId(String(target.id))
																}
															>
																<span
																	className="rounded-[3px] border border-[var(--b1)] px-1.5 py-0.5 font-mono text-[9px]"
																	style={{
																		color:
																			category === "CONTAINS"
																				? "var(--purple)"
																				: category === "IMPORTS"
																					? "var(--blue)"
																					: "var(--green)",
																	}}
																>
																	{category}
																</span>
																<span className="flex-1 font-mono text-[var(--t0)]">
																	{target.displayLabel}
																</span>
															</button>
														))}
													</div>
												</div>

												<div className="mt-5">
													<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
														Actions
													</div>
													{aiEnabledForSelection && (
														<button
															className="mb-2 flex w-full items-center gap-2 rounded-[6px] border border-[var(--b1)] px-3 py-2 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]"
															onClick={() => setTab("ai")}
														>
															<Sparkles className="h-4 w-4" /> Add to AI context
														</button>
													)}
													<button
														className="mb-2 flex w-full items-center gap-2 rounded-[6px] border border-[var(--b1)] px-3 py-2 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]"
														onClick={() => setMode("neighbour")}
													>
														<ArrowRight className="h-4 w-4" /> Explore
														neighbours
													</button>
													<button
														className="flex w-full items-center gap-2 rounded-[6px] border border-[var(--b1)] px-3 py-2 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)]"
														onClick={() => setMode("path")}
													>
														<BrainCircuit className="h-4 w-4" /> Trace path from
														here
													</button>
												</div>
											</>
										) : (
											<div className="text-[var(--t2)]">
												Select a node to inspect its details.
											</div>
										)}
									</div>
								)}

								{tab === "parsing" && (
									<div className="flex-1 overflow-y-auto p-4">
										{selectedNode ? (
											<>
												{selectedFileNode && (
													<div className="mt-0">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
															Parse Report
														</div>
														<div
															className="rounded-[10px] border p-3"
															style={{
																background:
																	parseStatusTone(selectedParseStatus)?.background ?? "var(--s1)",
																borderColor:
																	parseStatusTone(selectedParseStatus)?.border ?? "var(--b1)",
															}}
														>
															<div className="flex items-start justify-between gap-3">
																<div>
																	<div className="text-[12px] font-semibold" style={{ color: "var(--t0)" }}>
																		{nodeDisplayLabel(selectedFileNode)}
																	</div>
																	<div className="mt-1 text-[11px] leading-5" style={{ color: "var(--t2)" }}>
																		{selectedParseStatus === "parsed"
																			? "Tree-sitter and segment extraction completed cleanly for this file."
																			: selectedParseStatus === "partial"
																				? "This file parsed with recoverable syntax issues. AST segments are available but may be incomplete."
																				: selectedParseStatus === "failed"
																					? "This file failed structural parsing. Any extracted facts are fallback-driven only."
																					: "No parse result was recorded for this file."}
																	</div>
																</div>
																{parseStatusTone(selectedParseStatus) && (
																	<div
																		className="rounded-full border px-2 py-1 font-mono text-[10px]"
																		style={{
																			background: parseStatusTone(selectedParseStatus)?.background,
																			borderColor: parseStatusTone(selectedParseStatus)?.border,
																			color: parseStatusTone(selectedParseStatus)?.color,
																		}}
																	>
																		{parseStatusTone(selectedParseStatus)?.label}
																	</div>
																)}
															</div>
															<div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
																{[
																	["Parser", getStringProperty(selectedFileNode.properties?.parser) ?? "—"],
																	["Parse errors", String(getNumberProperty(selectedFileNode.properties?.parseErrors) ?? 0)],
																	["Imports", String(getNumberProperty(selectedFileNode.properties?.importCount) ?? 0)],
																	["Call sites", String(getNumberProperty(selectedFileNode.properties?.callSiteCount) ?? 0)],
																].map(([label, value]) => (
																	<div key={label} className="rounded-[8px] px-3 py-2" style={{ background: "rgba(255,255,255,0.45)" }}>
																		<div className="text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">{label}</div>
																		<div className="mt-1 font-mono text-[var(--t0)]">{value}</div>
																	</div>
																))}
															</div>
														</div>
													</div>
												)}

												{selectedFileNode && (
													<div className="mt-5">
														<div className="mb-2 flex items-center justify-between">
															<div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
																AST Inventory
															</div>
															{selectedNode.kind === "file" && (
																<button
																	className="rounded-[4px] border border-[var(--b1)] px-2 py-0.5 text-[10px] text-[var(--t2)] hover:bg-[var(--s1)]"
																	onClick={() =>
																		setExpandedAstFileId((current) =>
																			current === String(selectedFileNode!.id) ? null : String(selectedFileNode!.id),
																		)
																	}
																>
																	{expandedAstFileId === String(selectedFileNode!.id) ? "Collapse graph AST" : "Expand graph AST"}
																</button>
															)}
														</div>
														<div className="space-y-2">
															<div className="grid grid-cols-2 gap-2">
																{[
																	["Classes", selectedAstSummary.classes],
																	["Functions", selectedAstSummary.functions],
																	["Modules", selectedAstSummary.modules],
																	["Members", selectedAstSummary.members],
																	["Imports", selectedAstSummary.imports],
																	["Calls", selectedAstSummary.calls],
																].map(([label, values]) => (
																	<div key={String(label)} className="rounded-[10px] border px-3 py-3" style={{ borderColor: "var(--b1)", background: "var(--s1)" }}>
																		<div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">{label}</div>
																		{Array.isArray(values) && values.length > 0 ? (
																			<div className="flex flex-wrap gap-1.5">
																				{values.map((value) => (
																					<span key={value} className="rounded-full bg-[var(--s0)] px-2 py-1 font-mono text-[10px] text-[var(--t1)]">
																						{value}
																					</span>
																				))}
																			</div>
																		) : (
																			<div className="text-[11px] text-[var(--t2)]">None</div>
																		)}
																	</div>
																))}
															</div>
															<div className="rounded-[10px] border px-3 py-3" style={{ borderColor: "var(--b1)", background: "var(--s1)" }}>
																<div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">Segment kinds</div>
																{selectedAstSummary.unitKinds.length > 0 ? (
																	<div className="flex flex-wrap gap-1.5">
																		{selectedAstSummary.unitKinds.map(([unitKind, count]) => (
																			<span key={unitKind} className="rounded-full bg-[var(--s0)] px-2 py-1 font-mono text-[10px] text-[var(--t1)]">
																				{unitKind} × {count}
																			</span>
																		))}
																	</div>
																) : (
																	<div className="text-[11px] text-[var(--t2)]">No segment kinds recorded.</div>
																)}
															</div>
															{selectedAstNodes.length > 0 ? (
																selectedAstNodes.slice(0, 18).map((astNode) => {
																	const unitKind = getStringProperty(astNode.properties?.unitKind) ?? "ast";
																	const startLine = getNumberProperty(astNode.properties?.startLine);
																	const endLine = getNumberProperty(astNode.properties?.endLine);
																	const extractorMethod = getStringProperty(astNode.properties?.extractionMethod);
																	const topLevelSymbols = getStringArrayProperty(astNode.properties?.topLevelSymbols);
																	return (
																		<button
																			key={String(astNode.id)}
																			className="w-full rounded-[10px] border px-3 py-2 text-left hover:bg-[var(--s1)]"
																			style={{ borderColor: "var(--b1)", background: "var(--s0)" }}
																			onClick={() => setSelectedNodeId(String(astNode.id))}
																		>
																			<div className="flex items-start justify-between gap-3">
																				<div>
																					<div className="font-mono text-[11px] text-[var(--t0)]">{astNodeDisplayName(astNode)}</div>
																					<div className="mt-1 text-[10px] text-[var(--t2)]">
																						{unitKind}
																						{startLine !== null ? ` · lines ${startLine}${endLine !== null ? `-${endLine}` : ""}` : ""}
																						{extractorMethod ? ` · ${extractorMethod}` : ""}
																					</div>
																					{topLevelSymbols.length > 0 && (
																						<div className="mt-1 text-[10px] text-[var(--t3)]">Symbols: {topLevelSymbols.join(", ")}</div>
																					)}
																				</div>
																				<div className="rounded-full bg-[#ccfbf1] px-2 py-0.5 font-mono text-[10px] text-[#115e59]">AST</div>
																			</div>
																		</button>
																	);
																})
															) : (
																<div className="rounded-[8px] bg-[var(--s1)] px-3 py-3 text-[11px] text-[var(--t2)]">No AST segments are attached to this file.</div>
															)}
														</div>
													</div>
												)}

												{lastSyncDetails && (
													<div className="mt-5">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">Last Sync</div>
														<div className="rounded-[10px] bg-[var(--s1)] p-3">
															<div className="mb-3 flex flex-wrap items-center gap-2">
																{[
																	[`+${lastSyncDetails!.added}`, "Added", "var(--blue-l)", "var(--blue)"],
																	[`~${lastSyncDetails!.changed}`, "Changed", "var(--amber-l)", "var(--amber)"],
																	[`-${lastSyncDetails!.removed}`, "Removed", "rgba(239,68,68,0.12)", "#b91c1c"],
																	[`${lastSyncDetails!.impactedDependents}`, "Dependents", "rgba(16,185,129,0.12)", "#047857"],
																].map(([count, label, background, color]) => (
																	<div key={String(label)} className="rounded-full px-2 py-1 text-[10px] font-mono" style={{ background: String(background), color: String(color) }}>
																		{count} {label}
																	</div>
																))}
															</div>
															{[
																["Added files", lastSyncDetails!.addedFiles],
																["Changed files", lastSyncDetails!.changedFiles],
																["Removed files", lastSyncDetails!.removedFiles],
																["Dependent files", lastSyncDetails!.dependentFiles],
															].map(([label, files]) => (
																<div key={String(label)} className="mb-3 last:mb-0">
																	<div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">{label}</div>
																	{Array.isArray(files) && files.length > 0 ? (
																		<div className="space-y-1">
																			{files.slice(0, 8).map((filePath) => (
																				<div key={filePath} className="rounded-[6px] bg-[var(--s0)] px-2 py-1 font-mono text-[10px] text-[var(--t1)]">
																					{filePath}
																				</div>
																			))}
																		</div>
																	) : (
																		<div className="text-[11px] text-[var(--t2)]">None</div>
																	)}
																</div>
															))}
														</div>
													</div>
												)}

												{selectedNode.kind === "ast" && (
													<div className="mt-5">
														<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">AST Segment</div>
														<div className="rounded-[10px] bg-[var(--s1)] p-3">
															<div className="grid grid-cols-2 gap-2 text-[11px]">
																{[
																	["Display name", astNodeDisplayName(selectedNode)],
																	["Unit kind", getStringProperty(selectedNode.properties?.unitKind) ?? "—"],
																	["Segment index", String(getNumberProperty(selectedNode.properties?.segmentIndex) ?? "—")],
																	["Extraction", getStringProperty(selectedNode.properties?.extractionMethod) ?? "—"],
																	["Top-level symbols", getStringArrayProperty(selectedNode.properties?.topLevelSymbols).join(", ") || "—"],
																	["Line range", (() => {
																		const startLine = getNumberProperty(selectedNode.properties?.startLine);
																		const endLine = getNumberProperty(selectedNode.properties?.endLine);
																		return startLine !== null ? `${startLine}${endLine !== null ? `-${endLine}` : ""}` : "—";
																	})()],
																].map(([label, value]) => (
																	<div key={String(label)} className="rounded-[8px] bg-[var(--s0)] px-3 py-2">
																		<div className="text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">{label}</div>
																		<div className="mt-1 font-mono text-[var(--t0)]">{value}</div>
																	</div>
																))}
															</div>
														</div>
													</div>
												)}
											</>
										) : (
											<div className="text-[var(--t2)]">Select a file or AST node to inspect parsing output.</div>
										)}
									</div>
								)}

								{tab === "insights" && (
									<div className="flex-1 overflow-y-auto p-4 text-[11px]">
										<div className="mb-4">
											<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
												Hotspot nodes
											</div>
											<div className="space-y-2">
												{hotspotNodes.map(({ node, inDegree, outDegree }) => (
													<div
														key={node.id}
														className="rounded-[10px] border border-[var(--b0)] bg-[var(--s1)] p-3"
													>
														<div className="mb-2 flex items-center justify-between">
															<span className="font-medium">
																{node.displayLabel}
															</span>
															<span
																className="rounded-full px-2 py-0.5 text-[10px]"
																style={{
																	background: "var(--amber-l)",
																	color: "var(--amber)",
																}}
															>
																degree {inDegree + outDegree}
															</span>
														</div>
														<div className="text-[var(--t2)]">
															in-edges {inDegree} · out-edges {outDegree}
														</div>
													</div>
												))}
											</div>
										</div>
										<div className="mb-4">
											<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
												Orphan nodes
											</div>
											<div className="space-y-2">
												{orphanNodes.length > 0 ? (
													orphanNodes.map((node) => (
														<div
															key={node.id}
															className="rounded-[10px] border border-dashed border-[var(--b2)] p-3 text-[var(--t2)]"
														>
															{node.displayLabel}
														</div>
													))
												) : (
													<div className="text-[var(--t2)]">
														No orphan nodes in the current filter set.
													</div>
												)}
											</div>
										</div>
										<div>
											<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
												Depth distribution
											</div>
											<div className="space-y-2">
												{depthDistribution.map(({ label, value }) => (
													<div key={label} className="flex items-center gap-3">
														<span className="w-16 text-right font-mono text-[var(--t2)]">
															{label}
														</span>
														<div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-[var(--s1)]">
															<div
																className="h-full rounded-[4px] bg-[var(--blue)]"
																style={{
																	width: `${Math.max(8, (value / Math.max(...depthDistribution.map((d) => d.value), 1)) * 100)}%`,
																}}
															/>
														</div>
														<span className="w-8 text-right font-mono text-[var(--t2)]">
															{value}
														</span>
													</div>
												))}
											</div>
										</div>
									</div>
								)}

								{tab === "ai" && (
									<div className="flex flex-1 flex-col overflow-hidden">
										{/* Context header — shows all selected nodes as chips */}
										<div className="border-b border-[var(--b0)] bg-[var(--s1)] px-3 py-2">
											<div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--t3)]">
												AI Context
												{selectedNodeIds.length > 1 && (
													<span
														className="ml-2 rounded-full px-1.5 py-0.5 text-[9px]"
														style={{
															background: "var(--amber-l)",
															color: "var(--amber)",
														}}
													>
														{selectedNodeIds.length} nodes
													</span>
												)}
											</div>
											{selectedNodeIds.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{selectedNodeIds.slice(0, 8).map((id) => {
														const n = filteredNodes.find(
															(x) => String(x.id) === id,
														);
														if (!n) return null;
														const color =
															n.kind === "folder"
																? "var(--purple)"
																: n.kind === "file"
																	? "var(--blue)"
																	: n.kind === "class"
																		? "var(--amber)"
																		: "var(--green)";
														const bg =
															n.kind === "folder"
																? "var(--purple-l)"
																: n.kind === "file"
																	? "var(--blue-l)"
																	: n.kind === "class"
																		? "var(--amber-l)"
																		: "var(--green-l)";
														return (
															<div
																key={id}
																className="inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-mono"
																style={{
																	background: bg,
																	color,
																	border: `1px solid ${color}`,
																}}
															>
																<span
																	className="h-1.5 w-1.5 rounded-full"
																	style={{ background: color }}
																/>
																{n.displayLabel}
																<button
																	className="ml-0.5 opacity-60 hover:opacity-100"
																	onClick={() =>
																		setSelectedNodeIds((prev) =>
																			prev.filter((x) => x !== id),
																		)
																	}
																>
																	×
																</button>
															</div>
														);
													})}
													{selectedNodeIds.length > 8 && (
														<span className="text-[10px] text-[var(--t3)]">
															+{selectedNodeIds.length - 8} more
														</span>
													)}
													{selectedNodeIds.length > 1 && (
														<button
															className="ml-auto text-[10px] text-[var(--t3)] hover:text-[var(--t0)]"
															onClick={() =>
																setSelectedNodeIds(
																	selectedNode ? [String(selectedNode.id)] : [],
																)
															}
														>
															Clear multi
														</button>
													)}
												</div>
											) : (
												<div className="text-[10px] text-[var(--t3)]">
													Click a node to add context · Ctrl+click to add
													multiple
												</div>
											)}
										</div>

										<div className="flex-1 overflow-y-auto p-3">
											<div className="space-y-3">
												{chatMessages.map((message) => (
													<div
														key={message.id}
														className={`max-w-[92%] rounded-[8px] px-3 py-2 text-[11px] leading-6 ${message.role === "user" ? "ml-auto bg-[var(--s2)]" : "border border-[var(--teal-b)] bg-[var(--teal-l)]"}`}
													>
														{message.text}
														{message.role === "assistant" &&
															message.contextFiles &&
															message.contextFiles.length > 0 && (
																<div className="mt-2 border-t border-[var(--teal-b)] pt-2">
																	<div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
																		Context files
																	</div>
																	<div className="space-y-1">
																		{message.contextFiles.map((filePath) => (
																			<div
																				key={`${message.id}-${filePath}`}
																				className="font-mono text-[10px] leading-4 text-[var(--t1)]"
																			>
																				{filePath}
																			</div>
																		))}
																	</div>
																</div>
															)}
													</div>
												))}
											</div>
										</div>
										<div className="relative border-t border-[var(--b0)] p-3">
											{mentionSearch !== null && mentionMatches.length > 0 && (
												<div className="absolute bottom-full left-3 right-3 mb-2 max-h-48 overflow-y-auto rounded-[8px] border border-[var(--b1)] bg-[var(--s0)] shadow-lg">
													{mentionMatches.map((node, index) => (
														<button
															key={node.id}
															className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] ${index === mentionSelected ? "bg-[var(--s2)]" : "hover:bg-[var(--s1)]"}`}
															onClick={() => insertMention(node)}
															onMouseEnter={() => setMentionSelected(index)}
														>
															<span
																className="h-2 w-2 rounded-full"
																style={{
																	background:
																		node.kind === "folder"
																			? "var(--purple)"
																			: node.kind === "file"
																				? "var(--blue)"
																				: node.kind === "class"
																					? "var(--amber)"
																					: "var(--green)",
																}}
															/>
															<span className="flex-1 font-mono text-[var(--t0)]">
																{nodeDisplayLabel(node)}
															</span>
															<span className="text-[10px] text-[var(--t2)]">
																{getNodePath(node)}
															</span>
														</button>
													))}
												</div>
											)}
											<div className="mb-2 flex flex-wrap gap-2">
												{[
													"Why is this node highly connected?",
													"Show the shortest dependency path.",
													"Suggest a safer refactor.",
												].map((prompt) => (
													<button
														key={prompt}
														className="rounded-full border border-[var(--b1)] px-3 py-1 text-[10px] text-[var(--t2)] hover:bg-[var(--s1)] hover:text-[var(--t0)]"
														onClick={() => setChatInput(prompt)}
													>
														{prompt}
													</button>
												))}
											</div>
											<div className="flex gap-2">
												<input
													className="flex-1 rounded-[6px] border border-[var(--b1)] bg-[var(--s1)] px-3 py-2 text-[11px] outline-none"
													value={chatInput}
													onChange={(e) => handleInputChange(e.target.value)}
													placeholder="Ask about selected context... (use @ to mention nodes)"
													onKeyDown={(e) => {
														if (
															mentionSearch !== null &&
															mentionMatches.length > 0
														) {
															if (e.key === "ArrowDown") {
																e.preventDefault();
																setMentionSelected((current) =>
																	Math.min(
																		current + 1,
																		mentionMatches.length - 1,
																	),
																);
																return;
															}
															if (e.key === "ArrowUp") {
																e.preventDefault();
																setMentionSelected((current) =>
																	Math.max(0, current - 1),
																);
																return;
															}
															if (e.key === "Enter" || e.key === "Tab") {
																e.preventDefault();
																const selected =
																	mentionMatches[mentionSelected];
																if (selected) insertMention(selected);
																return;
															}
															if (e.key === "Escape") {
																e.preventDefault();
																setMentionSearch(null);
																return;
															}
														}
														if (e.key === "Enter") {
															e.preventDefault();
															void sendAi();
														}
													}}
													disabled={chatLoading}
												/>
												<button
													className="rounded-[6px] bg-[var(--t0)] px-3 text-[11px] text-[var(--s0)] disabled:cursor-not-allowed disabled:opacity-60"
													onClick={() => void sendAi()}
													disabled={chatLoading}
												>
													{chatLoading ? "Sending..." : "Send"}
												</button>
											</div>
										</div>
									</div>
								)}
							</>
						)}
					</aside>
				</div>
			</div>
		</section>
	);
}
