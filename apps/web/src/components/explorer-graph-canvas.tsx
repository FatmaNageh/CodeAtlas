import {
	useEffect,
	useMemo,
	useRef,
	forwardRef,
	useImperativeHandle,
	type ReactElement,
} from "react";

import * as d3 from "d3";
import {
	Boxes,
	FileCode2,
	FolderOpen,
	FunctionSquare,
	GitBranch,
	Spline,
	type IconNode,
	type LucideIcon,
} from "lucide-react";
import type { Neo4jEdge, Neo4jNode } from "@/components/Neo4jGraph";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ExplorerNodeKind = "folder" | "file" | "class" | "fn" | "ast";
export type ExplorerAstSymbolKind =
	| "class"
	| "function"
	| "namespace"
	| "member"
	| "ast";
export type ExplorerNode = Neo4jNode & {
	kind: ExplorerNodeKind;
	displayLabel: string;
};
type SimNode = ExplorerNode & d3.SimulationNodeDatum;
type SimLink = {
	id: string;
	type: string;
	source: string | SimNode;
	target: string | SimNode;
} & d3.SimulationLinkDatum<SimNode>;
type NodePos = { x: number; y: number };
export type GraphCanvasHandle = {
	zoomIn: () => void;
	zoomOut: () => void;
	fit: () => void;
	setLayout: (l: "force" | "radial" | "hierarchical") => void;
};

// ─── Public helpers ───────────────────────────────────────────────────────────
export function isAstNode(node: Neo4jNode): boolean {
	const labels = node.labels ?? [];
	const propKind = node.properties?.kind;
	if (typeof propKind === "string" && /^ast(node)?$/i.test(propKind)) {
		return true;
	}
	return labels.some((label) => {
		const normalized = label.toLowerCase();
		return (
			normalized === "astnode" ||
			normalized === "ast" ||
			normalized === "syntaxnode"
		);
	});
}

function propertyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function propertyStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

function astDisplayLabel(node: Neo4jNode): string {
	const p = node.properties ?? {};
	const primary =
		propertyString(p.label) ??
		propertyStringArray(p.topLevelSymbols)[0] ??
		propertyStringArray(p.symbolNames)[0] ??
		propertyString(p.summaryCandidate);
	if (primary) return primary;

	const unitKind = propertyString(p.unitKind) ?? "ast";
	const startLine =
		typeof p.startLine === "number" ? p.startLine : null;
	const endLine = typeof p.endLine === "number" ? p.endLine : null;
	if (startLine !== null && endLine !== null) {
		return `${unitKind} ${startLine}-${endLine}`;
	}
	if (startLine !== null) {
		return `${unitKind} line ${startLine}`;
	}
	return unitKind;
}

export function classifyNode(node: Neo4jNode): ExplorerNodeKind {
	const L = node.labels ?? [];
	if (
		L.includes("Repository") ||
		L.includes("Repo") ||
		L.includes("RepoRoot") ||
		L.includes("Folder") ||
		L.includes("Directory")
	)
		return "folder";
	if (isAstNode(node)) return "ast";
	if (L.includes("Class") || L.includes("Interface") || L.includes("Enum"))
		return "class";
	if (
		L.includes("Chunk") ||
		L.includes("Function") ||
		L.includes("Method") ||
		L.includes("CallSite") ||
		L.includes("CallSiteSummary")
	)
		return "fn";
	return "file";
}
export function nodeDisplayLabel(node: Neo4jNode): string {
	const p = node.properties ?? {};
	if (isAstNode(node)) {
		return astDisplayLabel(node);
	}
	return String(
		p.name ??
			p.label ??
			p.displayName ??
			p.path?.split(/[\\\/]/).pop() ??
			p.filePath?.split(/[\\\/]/).pop() ??
			p.symbol ??
			p.text ??
			node.id,
	);
}

export function astSymbolKind(node: Pick<Neo4jNode, "properties">): ExplorerAstSymbolKind {
	const p = node.properties ?? {};
	const normalizedKind =
		typeof p.normalizedKind === "string" ? p.normalizedKind.toLowerCase() : "";
	const nodeType = typeof p.nodeType === "string" ? p.nodeType.toLowerCase() : "";
	const kindHint = `${normalizedKind} ${nodeType}`;
	if (
		kindHint.includes("class") ||
		kindHint.includes("interface") ||
		kindHint.includes("enum") ||
		kindHint.includes("struct") ||
		kindHint.includes("trait") ||
		kindHint.includes("protocol")
	) {
		return "class";
	}
	if (
		kindHint.includes("function") ||
		kindHint.includes("method") ||
		kindHint.includes("constructor")
	) {
		return "function";
	}
	if (
		kindHint.includes("namespace") ||
		kindHint.includes("module") ||
		kindHint.includes("package")
	) {
		return "namespace";
	}
	if (
		kindHint.includes("field") ||
		kindHint.includes("property") ||
		kindHint.includes("variable") ||
		kindHint.includes("constant") ||
		kindHint.includes("parameter")
	) {
		return "member";
	}
	return "ast";
}

export function nodeTypeLabel(node: Pick<ExplorerNode, "kind" | "properties">): string {
	if (node.kind === "folder") return "Folder";
	if (node.kind === "file") return "File";
	if (node.kind === "class") return "Class";
	if (node.kind === "fn") return "Function";
	if (node.kind === "ast") {
		const symbolKind = astSymbolKind(node);
		if (symbolKind === "class") return "Class";
		if (symbolKind === "function") return "Function";
		if (symbolKind === "namespace") return "Namespace";
		if (symbolKind === "member") return "Member";
	}
	return "AST";
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
	light: {
		folder: {
			fill: "#6d28d9",
			bright: "#8b5cf6",
			labelBg: "#ede9fe",
			labelText: "#4c1d95",
		},
		file: {
			fill: "#0369a1",
			bright: "#38bdf8",
			labelBg: "#dbeafe",
			labelText: "#1e40af",
		},
		class: {
			fill: "#b45309",
			bright: "#fbbf24",
			labelBg: "#fef3c7",
			labelText: "#92400e",
		},
		fn: {
			fill: "#047857",
			bright: "#34d399",
			labelBg: "#d1fae5",
			labelText: "#065f46",
		},
		ast: {
			fill: "#0f766e",
			bright: "#14b8a6",
			labelBg: "#ccfbf1",
			labelText: "#115e59",
		},
		tour: {
			fill: "#be123c",
			bright: "#fb7185",
			labelBg: "#ffe4e6",
			labelText: "#9f1239",
		},
		multi: { ring: "#f59e0b", glow: "#f59e0b" }, // multi-select: amber
		bg: "#f2f1ed",
		dot: "rgba(0,0,0,0.06)",
		edge: {
			CONTAINS: "#7c3aed",
			IMPORTS: "#0369a1",
			CALLS: "#059669",
		} as Record<string, string>,
	},
	dark: {
		folder: {
			fill: "#7c3aed",
			bright: "#a78bfa",
			labelBg: "#1e1143",
			labelText: "#c4b5fd",
		},
		file: {
			fill: "#1d4ed8",
			bright: "#60a5fa",
			labelBg: "#1e3a5f",
			labelText: "#93c5fd",
		},
		class: {
			fill: "#d97706",
			bright: "#fbbf24",
			labelBg: "#2d1a02",
			labelText: "#fcd34d",
		},
		fn: {
			fill: "#059669",
			bright: "#34d399",
			labelBg: "#022c22",
			labelText: "#6ee7b7",
		},
		ast: {
			fill: "#0f766e",
			bright: "#2dd4bf",
			labelBg: "#042f2e",
			labelText: "#99f6e4",
		},
		tour: {
			fill: "#e11d48",
			bright: "#fb7185",
			labelBg: "#4c0519",
			labelText: "#fda4af",
		},
		multi: { ring: "#fbbf24", glow: "#fbbf24" },
		bg: "#0d0d0c",
		dot: "rgba(255,255,255,0.055)",
		edge: {
			CONTAINS: "#8b5cf6",
			IMPORTS: "#60a5fa",
			CALLS: "#34d399",
		} as Record<string, string>,
	},
} as const;
type KindKey = "folder" | "file" | "class" | "fn" | "ast" | "tour";
type Theme = (typeof C)[keyof typeof C];
const getTheme = (): Theme =>
	document.documentElement.classList.contains("dark") ? C.dark : C.light;


type LucideIconWithRender = LucideIcon & {
	render: (
		props: Record<string, never>,
		ref: null,
	) => ReactElement<{ iconNode?: IconNode }>;
};

function extractLucidePath(icon: LucideIcon): string {
	const rendered = (icon as LucideIconWithRender).render({}, null);
	const iconNode = rendered.props.iconNode ?? [];
	const paths = iconNode
		.filter(
			(entry): entry is ["path", Record<string, string>] => entry[0] === "path",
		)
		.map(([, attrs]) => attrs.d)
		.filter((d): d is string => typeof d === "string");
	return paths.join(" ");
}

function extractLucideNode(icon: LucideIcon): IconNode {
	const rendered = (icon as LucideIconWithRender).render({}, null);
	return rendered.props.iconNode ?? [];
}

const ICON_PATH: Record<ExplorerNodeKind, string> = {
	folder: extractLucidePath(FolderOpen),
	file: extractLucidePath(FileCode2),
	class: extractLucidePath(Boxes),
	fn: extractLucidePath(FunctionSquare),
	ast: extractLucidePath(Spline),
};

const ICON_NODES: Partial<Record<ExplorerNodeKind, IconNode>> = {
	file: extractLucideNode(FileCode2),
	ast: extractLucideNode(GitBranch),
};

function astSymbolIconNode(node: SimNode): IconNode {
	const symbolKind = astSymbolKind(node);
	if (symbolKind === "class") {
		return extractLucideNode(Boxes);
	}
	if (symbolKind === "function") {
		return extractLucideNode(FunctionSquare);
	}
	if (symbolKind === "namespace") {
		return extractLucideNode(FolderOpen);
	}
	if (symbolKind === "member") {
		return extractLucideNode(FileCode2);
	}
	return extractLucideNode(GitBranch);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const edgeCat = (t: string) => {
	const u = t.toUpperCase();
	return u.includes("CALL")
		? "CALLS"
		: u.includes("IMPORT")
			? "IMPORTS"
			: "CONTAINS";
};
const nodeR = (k: ExplorerNodeKind) =>
	k === "folder"
		? 22
		: k === "class"
			? 17
			: k === "fn"
				? 12
				: k === "ast"
					? 11
					: 15;

// Hide labels that are just chunk/import hashes — they clutter the graph
function shouldShowLabel(label: string, kind: ExplorerNodeKind): boolean {
	if (!label || label.trim() === "") return false;
	// Hide any label starting with a known chunk/import/call prefix
	if (/^(imp|chunk|call|callsite|fn|node|ref|sym|id):/i.test(label))
		return false;
	// Hide labels containing 6+ consecutive hex chars (hashes, IDs)
	if (/[a-f0-9]{6,}/i.test(label)) return false;
	// Hide UUID-shaped strings
	if (/^[a-f0-9-]{20,}$/i.test(label)) return false;
	// Hide "word:hexhex..." pattern
	if (/^[a-z]+:[a-f0-9]+/i.test(label)) return false;
	// Hide very long labels with no spaces/dots/slashes (raw IDs)
	if (label.length > 30 && !/[\s./]/.test(label)) return false;
	// Hide single/two-char fn node labels
	if (kind === "fn" && /^[a-z0-9_]{1,2}$/.test(label)) return false;
	return true;
}
const trim = (s: string, max = 20) =>
	s.length > max ? s.slice(0, max - 1) + "…" : s;

// ─── Layouts ─────────────────────────────────────────────────────────────────

/**
 * RADIAL LAYOUT
 * Each kind gets its own ring. Ring radius is calculated so nodes
 * always have enough arc-space between them (minimum 70px of arc per node).
 * This means large layers get bigger rings automatically.
 */
function radialLayout(nodes: SimNode[], W: number, H: number) {
	const cx = W / 2,
		cy = H / 2;
	const by: Record<string, SimNode[]> = {
		folder: [],
		file: [],
		class: [],
		fn: [],
		ast: [],
	};
	nodes.forEach((n) => by[n.kind].push(n));

	const MIN_ARC = 70; // minimum arc-length per node so they never overlap
	let currentR = 0;

	(["folder", "file", "class", "fn", "ast"] as ExplorerNodeKind[]).forEach((kind) => {
		const ns = by[kind];
		if (!ns.length) return;

		// Compute the minimum radius that gives each node MIN_ARC arc-space
		const requiredR = (ns.length * MIN_ARC) / (2 * Math.PI);
		const r = Math.max(currentR + 80, ns.length <= 1 ? 0 : requiredR);

		if (r === 0) {
			// Single folder at exact center
			ns[0].fx = cx;
			ns[0].fy = cy;
			ns[0].x = cx;
			ns[0].y = cy;
		} else {
			ns.forEach((n, i) => {
				const a = (i / ns.length) * 2 * Math.PI - Math.PI / 2;
				n.fx = cx + r * Math.cos(a);
				n.fy = cy + r * Math.sin(a);
				n.x = n.fx;
				n.y = n.fy;
			});
		}

		currentR = r + (kind === "folder" ? 60 : 80);
	});
}


function hierarchicalLayout(nodes: SimNode[], links: SimLink[], W: number, H: number) {
	const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
	const children = new Map<string, string[]>();
	const parent = new Map<string, string>();

	const hierarchicalEdge = (type: string) => {
		const t = type.toUpperCase();
		return (
			t.includes("CONTAIN") ||
			t.includes("HAS_AST") ||
			t.includes("NEXT_AST") ||
			t.includes("DECLARE") ||
			t.includes("HAS_AST_ROOT") ||
			t.includes("AST_CHILD")
		);
	};

	links.forEach((link) => {
		if (!hierarchicalEdge(link.type)) return;
		const sourceId =
			typeof link.source === "string"
				? link.source
				: String((link.source as SimNode).id);
		const targetId =
			typeof link.target === "string"
				? link.target
				: String((link.target as SimNode).id);
		if (!nodeById.has(sourceId) || !nodeById.has(targetId)) return;
		if (parent.has(targetId)) return;
		parent.set(targetId, sourceId);
		const list = children.get(sourceId) ?? [];
		list.push(targetId);
		children.set(sourceId, list);
	});

	const kindOrder: Record<ExplorerNodeKind, number> = {
		folder: 0,
		file: 1,
		class: 2,
		fn: 3,
		ast: 4,
	};
	const allIds = nodes.map((node) => String(node.id));
	const roots = allIds
		.filter((id) => !parent.has(id))
		.sort((a, b) => {
			const na = nodeById.get(a);
			const nb = nodeById.get(b);
			if (!na || !nb) return a.localeCompare(b);
			const kindCmp = kindOrder[na.kind] - kindOrder[nb.kind];
			if (kindCmp !== 0) return kindCmp;
			return na.displayLabel.localeCompare(nb.displayLabel);
		});

	const levels = new Map<string, number>();
	const placed = new Set<string>();
	const yById = new Map<string, number>();
	const X_STEP = 220;
	const Y_STEP = 58;
	const MARGIN_X = 90;
	const MARGIN_Y = 60;
	let nextRow = 0;

	const walk = (id: string, depth: number) => {
		if (placed.has(id)) return;
		placed.add(id);
		levels.set(id, depth);
		const kids = (children.get(id) ?? []).sort((a, b) => {
			const na = nodeById.get(a);
			const nb = nodeById.get(b);
			if (!na || !nb) return a.localeCompare(b);
			const kindCmp = kindOrder[na.kind] - kindOrder[nb.kind];
			if (kindCmp !== 0) return kindCmp;
			return na.displayLabel.localeCompare(nb.displayLabel);
		});

		if (kids.length === 0) {
			yById.set(id, nextRow * Y_STEP + MARGIN_Y);
			nextRow += 1;
			return;
		}

		const before = nextRow;
		kids.forEach((kid) => walk(kid, depth + 1));
		const after = Math.max(before, nextRow - 1);
		yById.set(id, ((before + after) / 2) * Y_STEP + MARGIN_Y);
	};

	roots.forEach((rootId) => {
		walk(rootId, 0);
		nextRow += 1;
	});

	allIds.forEach((id) => {
		if (!placed.has(id)) {
			walk(id, 0);
			nextRow += 1;
		}
	});

	nodes.forEach((node) => {
		const id = String(node.id);
		const level = levels.get(id) ?? kindOrder[node.kind];
		node.fx = Math.min(W - 80, Math.max(50, MARGIN_X + level * X_STEP));
		node.fy = Math.min(H - 40, Math.max(40, yById.get(id) ?? MARGIN_Y));
		node.x = node.fx;
		node.y = node.fy;
	});
}

// ─── Component ───────────────────────────────────────────────────────────────
type Ctrl = {
	zoom: d3.ZoomBehavior<SVGSVGElement, undefined>;
	svgSel: d3.Selection<SVGSVGElement, undefined, null, undefined>;
	simulation: d3.Simulation<SimNode, SimLink>;
	simNodes: SimNode[];
	simLinks: SimLink[];
	W: number;
	H: number;
};

export const ExplorerGraphCanvas = forwardRef<
	GraphCanvasHandle,
	{
		nodes: ExplorerNode[];
		edges: Neo4jEdge[];
		selectedNodeId: string | null;
		selectedNodeIds?: string[];
		onNodeClick: (node: ExplorerNode, event: MouseEvent) => void;
		mode: string;
		pathNodeIds: string[];
		highlightNodeIds: string[];
		tourHighlightNodeIds?: string[];
		activeTourNodeId?: string | null;
	}
>(function ExplorerGraphCanvas(
	{
		nodes,
		edges,
		selectedNodeId,
		selectedNodeIds = [],
		onNodeClick,
		mode: _mode,
		pathNodeIds,
		highlightNodeIds,
		tourHighlightNodeIds,
		activeTourNodeId,
	},
	ref,
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const ctrlRef = useRef<Ctrl | null>(null);
	const glowIdRef = useRef<string>("");
	const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
	const nodePosRef = useRef<Map<string, NodePos>>(new Map());

	// ── Imperative handle (zoom / layout) ──────────────────────────────────
	useImperativeHandle(ref, () => ({
		zoomIn: () =>
			ctrlRef.current?.svgSel
				.transition()
				.duration(280)
				.call(ctrlRef.current.zoom.scaleBy, 1.45),
		zoomOut: () =>
			ctrlRef.current?.svgSel
				.transition()
				.duration(280)
				.call(ctrlRef.current.zoom.scaleBy, 0.68),
		fit: () => {
			const c = ctrlRef.current;
			if (!c) return;
			let x0 = Infinity,
				y0 = Infinity,
				x1 = -Infinity,
				y1 = -Infinity;
			c.simNodes.forEach((n) => {
				const r = nodeR(n.kind) + 40;
				x0 = Math.min(x0, (n.x ?? 0) - r);
				y0 = Math.min(y0, (n.y ?? 0) - r);
				x1 = Math.max(x1, (n.x ?? 0) + r + 150);
				y1 = Math.max(y1, (n.y ?? 0) + r);
			});
			if (!isFinite(x0)) return;
			const pad = 50;
			const sc =
				0.9 * Math.min(c.W / (x1 - x0 + pad * 2), c.H / (y1 - y0 + pad * 2));
			c.svgSel
				.transition()
				.duration(500)
				.call(
					c.zoom.transform,
					d3.zoomIdentity
						.translate((c.W - sc * (x0 + x1)) / 2, (c.H - sc * (y0 + y1)) / 2)
						.scale(sc),
				);
		},
		setLayout: (layout) => {
			const c = ctrlRef.current;
			if (!c) return;
			if (layout === "force") {
				c.simNodes.forEach((n) => {
					n.fx = null;
					n.fy = null;
				});
				c.simulation.alpha(0.8).alphaDecay(0.028).restart();
			} else if (layout === "radial") {
				radialLayout(c.simNodes, c.W, c.H);
				c.simulation.alpha(0.15).restart();
			} else if (layout === "hierarchical") {
				hierarchicalLayout(c.simNodes, c.simLinks, c.W, c.H);
				c.simulation.alpha(0.15).restart();
			}
			// Auto-fit after layout switch so all nodes are visible
			setTimeout(() => {
				let x0 = Infinity,
					y0 = Infinity,
					x1 = -Infinity,
					y1 = -Infinity;
				c.simNodes.forEach((n) => {
					const r = 40;
					x0 = Math.min(x0, (n.x ?? 0) - r);
					y0 = Math.min(y0, (n.y ?? 0) - r);
					x1 = Math.max(x1, (n.x ?? 0) + r + 160);
					y1 = Math.max(y1, (n.y ?? 0) + r);
				});
				if (!isFinite(x0)) return;
				const pad = 50,
					sc =
						0.88 *
						Math.min(c.W / (x1 - x0 + pad * 2), c.H / (y1 - y0 + pad * 2));
				c.svgSel
					.transition()
					.duration(600)
					.call(
						c.zoom.transform,
						d3.zoomIdentity
							.translate((c.W - sc * (x0 + x1)) / 2, (c.H - sc * (y0 + y1)) / 2)
							.scale(sc),
					);
			}, 400);
		},
	}));

	const prepared = useMemo(() => {
		const nodeMap = new Map(nodes.map((n) => [String(n.id), n]));
		const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
		const simLinks: SimLink[] = edges
			.filter((e) => nodeMap.has(String(e.from)) && nodeMap.has(String(e.to)))
			.map((e) => ({
				id: String(e.id),
				type: String(e.type),
				source: String(e.from),
				target: String(e.to),
			}));
		return { simNodes, simLinks, nodeMap };
	}, [nodes, edges]);

	useEffect(() => {
		if (!containerRef.current || !svgRef.current) return;
		const { width: W, height: H } =
			containerRef.current.getBoundingClientRect();
		const T = getTheme();
		const prevTransform = zoomTransformRef.current;
		const prevPos = nodePosRef.current;

		const seed = (id: string) => {
			let h = 0;
			for (let i = 0; i < id.length; i++) {
				h = (h * 31 + id.charCodeAt(i)) >>> 0;
			}
			return h;
		};
		prepared.simNodes.forEach((node) => {
			const p = prevPos.get(String(node.id));
			if (p) {
				node.x = p.x;
				node.y = p.y;
				node.fx = p.x;
				node.fy = p.y;
				return;
			}
			if (!(prevPos.size > 0 && node.kind === "ast")) return;
			const id = String(node.id);
			const anchorEdge = prepared.simLinks.find((link) => {
				const sourceId =
					typeof link.source === "string"
						? link.source
						: String((link.source as SimNode).id);
				const targetId =
					typeof link.target === "string"
						? link.target
						: String((link.target as SimNode).id);
				if (sourceId === id) return prevPos.has(targetId);
				if (targetId === id) return prevPos.has(sourceId);
				return false;
			});
			if (!anchorEdge) return;
			const sourceId =
				typeof anchorEdge.source === "string"
					? anchorEdge.source
					: String((anchorEdge.source as SimNode).id);
			const targetId =
				typeof anchorEdge.target === "string"
					? anchorEdge.target
					: String((anchorEdge.target as SimNode).id);
			const anchorId = sourceId === id ? targetId : sourceId;
			const anchorPos = prevPos.get(anchorId);
			if (!anchorPos) return;
			const n = seed(id);
			const angle = (n % 360) * (Math.PI / 180);
			const radius = 28 + (n % 34);
			node.x = anchorPos.x + Math.cos(angle) * radius;
			node.y = anchorPos.y + Math.sin(angle) * radius;
		});

		const svg = d3.select<SVGSVGElement, undefined>(svgRef.current);
		svg.selectAll("*").remove();
		svg.attr("viewBox", `0 0 ${W} ${H}`);

		const defs = svg.append("defs");

		// Dot grid
		const pid = `p-${Math.random().toString(36).slice(2)}`;
		const pat = defs
			.append("pattern")
			.attr("id", pid)
			.attr("width", 24)
			.attr("height", 24)
			.attr("patternUnits", "userSpaceOnUse");
		pat.append("rect").attr("width", 24).attr("height", 24).attr("fill", T.bg);
		pat
			.append("circle")
			.attr("cx", 12)
			.attr("cy", 12)
			.attr("r", 0.85)
			.attr("fill", T.dot);

		// Glow filter
		const gid = `g-${Math.random().toString(36).slice(2)}`;
		glowIdRef.current = gid;
		const gf = defs
			.append("filter")
			.attr("id", gid)
			.attr("x", "-60%")
			.attr("y", "-60%")
			.attr("width", "220%")
			.attr("height", "220%");
		gf.append("feGaussianBlur")
			.attr("in", "SourceGraphic")
			.attr("stdDeviation", 7)
			.attr("result", "b");
		const fm = gf.append("feMerge");
		fm.append("feMergeNode").attr("in", "b");
		fm.append("feMergeNode").attr("in", "SourceGraphic");

		// Arrow markers
		const arrowId: Record<string, string> = {};
		(["CONTAINS", "IMPORTS", "CALLS"] as const).forEach((cat) => {
			const id = `a-${cat}-${Math.random().toString(36).slice(2)}`;
			arrowId[cat] = id;
			defs
				.append("marker")
				.attr("id", id)
				.attr("viewBox", "0 -4 8 8")
				.attr("refX", 7)
				.attr("refY", 0)
				.attr("markerWidth", 5)
				.attr("markerHeight", 5)
				.attr("orient", "auto")
				.append("path")
				.attr("d", "M0,-4L8,0L0,4")
				.attr("fill", T.edge[cat])
				.attr("fill-opacity", 0.85);
		});

		svg
			.append("rect")
			.attr("width", W)
			.attr("height", H)
			.attr("fill", `url(#${pid})`);
		const g = svg.append("g");

		// ── Simulation — pre-tick offline so graph arrives settled ──────────
		const simulation = d3
			.forceSimulation<SimNode>(prepared.simNodes)
			.force(
				"link",
				d3
					.forceLink<SimNode, SimLink>(prepared.simLinks)
					.id((d) => String(d.id))
					.distance((l) => {
						const s = (
							typeof l.source === "string"
								? prepared.nodeMap.get(l.source)
								: l.source
						) as SimNode | undefined;
						const t = (
							typeof l.target === "string"
								? prepared.nodeMap.get(l.target)
								: l.target
						) as SimNode | undefined;
						if (s?.kind === "folder" && t?.kind === "folder") return 260;
						if (s?.kind === "folder" || t?.kind === "folder") return 160;
						if (s?.kind === "file" || t?.kind === "file") return 100;
						return 65;
					})
					.strength(0.7),
			)
			.force(
				"charge",
				d3.forceManyBody<SimNode>().strength((d) => {
					const k = (d as SimNode).kind;
					return k === "folder"
						? -1200
						: k === "file"
							? -650
							: k === "class"
								? -400
								: -250;
				}),
			)
			.force(
				"center",
				prevPos.size > 0 ? null : d3.forceCenter(W / 2, H / 2),
			)
			.force(
				"collide",
				d3
					.forceCollide<SimNode>()
					.radius((d) => nodeR(d.kind) + 46)
					.strength(0.95),
			)
			.stop();

		const ticks =
			prevPos.size > 0
				? 10
				: prepared.simNodes.length > 1400
				? 28
				: prepared.simNodes.length > 800
					? 42
					: prepared.simNodes.length > 300
						? 72
						: 120;
		for (let i = 0; i < ticks; i++) simulation.tick();

		const ex2 = (d: SimLink) => {
			const s = d.source as SimNode,
				t = d.target as SimNode;
			const dx = (t.x ?? 0) - (s.x ?? 0),
				dy = (t.y ?? 0) - (s.y ?? 0),
				len = Math.sqrt(dx * dx + dy * dy) || 1;
			return (t.x ?? 0) - (dx / len) * (nodeR(t.kind) + 3);
		};
		const ey2 = (d: SimLink) => {
			const s = d.source as SimNode,
				t = d.target as SimNode;
			const dx = (t.x ?? 0) - (s.x ?? 0),
				dy = (t.y ?? 0) - (s.y ?? 0),
				len = Math.sqrt(dx * dx + dy * dy) || 1;
			return (t.y ?? 0) - (dy / len) * (nodeR(t.kind) + 3);
		};

		// ── Edges ────────────────────────────────────────────────────────────
		const link = g
			.append("g")
			.selectAll<SVGLineElement, SimLink>("line")
			.data(prepared.simLinks, (d) => d.id)
			.join("line")
			.attr("class", "graph-link")
			.attr("stroke", (d) => T.edge[edgeCat(d.type)] ?? T.edge.CONTAINS)
			.attr("stroke-dasharray", (d) => {
				const c = edgeCat(d.type);
				return c === "CALLS" ? "3 5" : c === "IMPORTS" ? "6 3" : "none";
			})
			.attr("stroke-width", 1)
			.attr("stroke-opacity", 0.25)
			.attr("marker-end", (d) => {
				const c = edgeCat(d.type);
				return c !== "CONTAINS" ? `url(#${arrowId[c]})` : null;
			})
			.attr("x1", (d) => (d.source as SimNode).x ?? 0)
			.attr("y1", (d) => (d.source as SimNode).y ?? 0)
			.attr("x2", ex2)
			.attr("y2", ey2);

		let nodeG!: d3.Selection<
			SVGGElement,
			SimNode,
			SVGGElement,
			unknown
		>;
		const renderPositions = () => {
			link
				.attr("x1", (d) => (d.source as SimNode).x ?? 0)
				.attr("y1", (d) => (d.source as SimNode).y ?? 0)
				.attr("x2", ex2)
				.attr("y2", ey2);
			nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		};

		// ── Nodes ────────────────────────────────────────────────────────────
		nodeG = g
			.append("g")
			.selectAll<SVGGElement, SimNode>("g")
			.data(prepared.simNodes, (d) => String(d.id))
			.join("g")
			.attr("cursor", "pointer")
			.attr("data-nid", (d) => String(d.id))
			.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
			.call(
				d3
					.drag<SVGGElement, SimNode>()
					.on("start", (event, d) => {
						event.sourceEvent.stopPropagation();
						d.fx = d.x ?? event.x;
						d.fy = d.y ?? event.y;
					})
					.on("drag", (event, d) => {
						d.fx = event.x;
						d.fy = event.y;
						d.x = event.x;
						d.y = event.y;
						renderPositions();
					})
					.on("end", (_, d) => {
						d.fx = d.x;
						d.fy = d.y;
						renderPositions();
					}), // pin where dropped
			)
			.on("click", (event: MouseEvent, d) => {
				event.stopPropagation();
				onNodeClick(d, event);
			});

		// Selection ring (class "ring" so Effect 2 can update it)
		nodeG
			.append("circle")
			.attr("class", "ring")
			.attr("r", (d) => nodeR(d.kind) + 9)
			.attr("fill", "none")
			.attr("stroke", "none")
			.attr("stroke-width", 2.5)
			.attr("stroke-opacity", 0.85);

		// Main circle — solid fill, white border for contrast
		nodeG
			.append("circle")
			.attr("class", "circ")
			.attr("r", (d) => nodeR(d.kind))
			.attr("fill", (d) => T[d.kind as KindKey]?.fill ?? T.file.fill)
			.attr("stroke", "rgba(255,255,255,0.35)")
			.attr("stroke-width", 1.5)
			.attr("opacity", 1);

		// Lucide icon — scale(s) translate(-12,-12) centers the 24×24 path at origin
		nodeG
			.append("g")
			.attr("class", "icon")
			.attr("transform", (d) => {
				const s = nodeR(d.kind) * 0.055;
				return `scale(${s}) translate(-12,-12)`;
			})
			.attr("opacity", 1)
			.each(function (d) {
				const iconNode =
					d.kind === "ast" ? astSymbolIconNode(d) : ICON_NODES[d.kind];
				const iconSel = d3.select(this);
				if (iconNode && iconNode.length > 0) {
					iconNode.forEach(([tag, attrs]) => {
						const shape = iconSel.append(String(tag));
						Object.entries(attrs).forEach(([key, value]) => {
							shape.attr(key, value);
						});
					});
				} else {
					iconSel.append("path").attr("d", ICON_PATH[d.kind]);
				}
			})
			.attr("fill", "none")
			.attr("stroke", "rgba(255,255,255,0.95)")
			.attr("stroke-width", 2)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.style("pointer-events", "none");

		// Label pill — only for nodes with readable (non-hash) names
		const CW = 6.4,
			PH = 20,
			PP = 10;
		const showLabel = (d: SimNode) => shouldShowLabel(d.displayLabel, d.kind);
		const lx = (d: SimNode) => nodeR(d.kind) + 8;

		nodeG
			.filter(showLabel)
			.append("rect")
			.attr("class", "lpill")
			.attr("x", lx)
			.attr("y", -PH / 2)
			.attr("rx", 5)
			.attr("height", PH)
			.attr("width", (d) => trim(d.displayLabel).length * CW + PP)
			.attr("fill", (d) => T[d.kind as KindKey]?.labelBg ?? T.file.labelBg)
			.attr("stroke", (d) => T[d.kind as KindKey]?.fill ?? T.file.fill)
			.attr("stroke-width", 0.75)
			.attr("opacity", 1);

		nodeG
			.filter(showLabel)
			.append("text")
			.attr("class", "ltxt")
			.text((d) => trim(d.displayLabel))
			.attr("x", (d) => lx(d) + PP / 2)
			.attr("y", 4)
			.style("font-size", "10.5px")
			.style(
				"font-family",
				"'JetBrains Mono','Fira Code',ui-monospace,monospace",
			)
			.style("font-weight", "500")
			.style("pointer-events", "none")
			.attr("fill", (d) => T[d.kind as KindKey]?.labelText ?? T.file.labelText)
			.attr("opacity", 1);

		// ── Gentle final settle (very brief) ─────────────────────────────────
		if (prevPos.size > 0) {
			simulation.on("tick", null);
			simulation.stop();
		} else {
			simulation
				.alpha(0.05)
				.alphaDecay(0.06)
				.on("tick", renderPositions)
				.restart();
		}
		renderPositions();
		nodePosRef.current = new Map(
			prepared.simNodes.map((node) => [
				String(node.id),
				{ x: node.x ?? 0, y: node.y ?? 0 },
			]),
		);

		// Zoom
		const zoom = d3
			.zoom<SVGSVGElement, undefined>()
			.scaleExtent([0.05, 6])
			.on("zoom", (ev) => {
				zoomTransformRef.current = ev.transform;
				g.attr("transform", ev.transform.toString());
			});
		svg.call(zoom);
		svg.on("dblclick.zoom", null);
		svg.call(zoom.transform, prevTransform);
		g.attr("transform", prevTransform.toString());
		ctrlRef.current = {
			zoom,
			svgSel: svg,
			simulation,
			simNodes: prepared.simNodes,
			simLinks: prepared.simLinks,
			W,
			H,
		};

		return () => {
			nodePosRef.current = new Map(
				prepared.simNodes.map((node) => [
					String(node.id),
					{ x: node.x ?? 0, y: node.y ?? 0 },
				]),
			);
			simulation.stop();
		};
	
	}, [prepared]);

	useEffect(() => {
		if (!svgRef.current) return;
		const T = getTheme();
		const multiSet = new Set(selectedNodeIds);
		const gid = glowIdRef.current;
		const pathSet = new Set(pathNodeIds);
		const hlSet = new Set(highlightNodeIds);
		const tourSet = new Set(tourHighlightNodeIds ?? []);
		const hasFocus = pathSet.size > 1 || tourSet.size > 0 || hlSet.size > 1;
		const nodeOpacity = (id: string) => {
			if (!hasFocus) return 1;
			if (pathSet.size > 1) return pathSet.has(id) ? 1 : 0.1;
			if (tourSet.size > 0) return tourSet.has(id) ? 1 : 0.1;
			if (hlSet.size > 1) return hlSet.has(id) ? 1 : 0.1;
			return 1;
		};
		const edgeOpacity = (sourceId: string, targetId: string) => {
			if (!hasFocus) return 0.25;
			if (pathSet.size > 1)
				return pathSet.has(sourceId) && pathSet.has(targetId) ? 0.9 : 0.04;
			if (tourSet.size > 0)
				return tourSet.has(sourceId) || tourSet.has(targetId) ? 0.6 : 0.04;
			if (hlSet.size > 1)
				return hlSet.has(sourceId) || hlSet.has(targetId) ? 0.7 : 0.04;
			return 0.25;
		};

		const svg = d3.select(svgRef.current);

		svg
			.selectAll<SVGGElement, SimNode>("[data-nid]")
			.each(function (d) {
				const id = String(d.id);
				const isPrimary = id === selectedNodeId;
				const isMulti = multiSet.has(id) && !isPrimary;
				const isTour = id === activeTourNodeId;
				const opacity = nodeOpacity(id);
				const color = isPrimary
					? (T[d.kind as KindKey]?.bright ?? T.file.bright)
					: isMulti
						? T.multi.ring
						: isTour
							? T.tour.bright
							: "none";
				const el = d3.select(this);
				el.select(".ring")
					.attr("stroke", color)
					.attr("stroke-opacity", isPrimary || isMulti || isTour ? 0.85 : 0)
					.attr("filter", isPrimary ? `url(#${gid})` : "none");
				el.select(".circ")
					.attr(
						"stroke",
						isPrimary || isMulti ? color : "rgba(255,255,255,0.35)",
					)
					.attr("stroke-width", isPrimary || isMulti ? 2.5 : 1.5)
					.attr("opacity", opacity);
				el.select(".icon").attr("opacity", opacity);
				el.select(".lpill").attr("opacity", opacity);
				el.select(".ltxt").attr("opacity", opacity);
			});

		svg
			.selectAll<SVGLineElement, SimLink>("line.graph-link")
			.attr("stroke-width", (d) => {
				const sourceId =
					typeof d.source === "string"
						? d.source
						: String((d.source as SimNode).id);
				const targetId =
					typeof d.target === "string"
						? d.target
						: String((d.target as SimNode).id);
				return pathSet.has(sourceId) && pathSet.has(targetId) ? 2.5 : 1;
			})
			.attr("stroke-opacity", (d) => {
				const sourceId =
					typeof d.source === "string"
						? d.source
						: String((d.source as SimNode).id);
				const targetId =
					typeof d.target === "string"
						? d.target
						: String((d.target as SimNode).id);
				return edgeOpacity(sourceId, targetId);
			});
	}, [
		selectedNodeId,
		selectedNodeIds,
		activeTourNodeId,
		pathNodeIds,
		highlightNodeIds,
		tourHighlightNodeIds,
	]);

	return (
		<div ref={containerRef} className="h-full w-full">
			<svg ref={svgRef} className="h-full w-full" />
		</div>
	);
});
