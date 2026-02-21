export type IRNode = {
  id: string;
  kind: string;
  props?: Record<string, any>;
};

export type IREdge = {
  type: string;
  from: string;
  to: string;
  props?: Record<string, any>;
};

export type IR = {
  repoId?: string;
  nodes?: IRNode[];
  edges?: IREdge[];
};

export function parseIrJson(raw: string): IR {
  const ir = JSON.parse(raw) as IR;
  ir.nodes = ir.nodes ?? [];
  ir.edges = ir.edges ?? [];
  return ir;
}

export function summarizeIr(ir: IR) {
  const nodes = ir.nodes ?? [];
  const edges = ir.edges ?? [];

  const nodeKinds = new Map<string, number>();
  for (const n of nodes) nodeKinds.set(n.kind, (nodeKinds.get(n.kind) ?? 0) + 1);

  const edgeTypes = new Map<string, number>();
  for (const e of edges) edgeTypes.set(e.type, (edgeTypes.get(e.type) ?? 0) + 1);

  const unresolvedImports = edges.filter((e) => e.type === "IMPORTS_RAW").length;

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeKinds: Array.from(nodeKinds.entries()).sort((a, b) => b[1] - a[1]),
    edgeTypes: Array.from(edgeTypes.entries()).sort((a, b) => b[1] - a[1]),
    unresolvedImports,
  };
}

// Build a hierarchical CodeNode-like tree from CONTAINS edges
export type CodeNode = {
  path: string;
  name: string;
  type: string;
  children?: CodeNode[];
  meta?: Record<string, any>;
};

export function irToFileTree(ir: IR): CodeNode | null {
  const nodes = ir.nodes ?? [];
  const edges = ir.edges ?? [];

  const byId = new Map<string, IRNode>();
  nodes.forEach((n) => byId.set(n.id, n));

  // pick a root: Repo node if exists, else synthesize
  const repo = nodes.find((n) => n.kind === "Repo") ?? null;

  const childrenByParent = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "CONTAINS") continue;
    if (!childrenByParent.has(e.from)) childrenByParent.set(e.from, []);
    childrenByParent.get(e.from)!.push(e.to);
  }

  const build = (id: string): CodeNode => {
    const n = byId.get(id);
    const kind = n?.kind ?? "Unknown";
    const props = n?.props ?? {};
    const relPath = props.relPath || props.path || props.fileRelPath || id;
    const name = props.name || relPath.split("/").pop() || relPath;

    const childIds = (childrenByParent.get(id) ?? []).slice().sort();
    const children = childIds.map(build);

    return {
      path: String(relPath),
      name: String(name),
      type: kind,
      meta: props,
      children: children.length ? children : undefined,
    };
  };

  if (repo) return build(repo.id);

  // fallback: create a synthetic root from all CodeFile/TextFile nodes
  const files = nodes.filter((n) => n.kind === "CodeFile" || n.kind === "TextFile");
  const root: CodeNode = { path: "repo", name: "repo", type: "Repo", children: [] };

  for (const f of files) {
    const p = (f.props?.relPath ?? f.props?.fileRelPath ?? f.id) as string;
    root.children!.push({ path: p, name: p.split("/").pop() ?? p, type: f.kind, meta: f.props });
  }

  root.children = root.children!.sort((a, b) => a.path.localeCompare(b.path));
  return root;
}

export function findMissingResolutions(ir: IR) {
  const nodes = ir.nodes ?? [];
  const edges = ir.edges ?? [];

  const byId = new Map<string, IRNode>();
  nodes.forEach((n) => byId.set(n.id, n));

  const imports = nodes.filter((n) => n.kind === "Import");
  const resolvedTargets = new Set(edges.filter((e) => e.type === "RESOLVES_TO").map((e) => e.from));

  const unresolved = imports
    .filter((n) => !resolvedTargets.has(n.id))
    .map((n) => ({
      id: n.id,
      file: n.props?.fileRelPath ?? n.props?.relPath ?? "",
      raw: n.props?.raw ?? "",
    }));

  const callSites = nodes.filter((n) => n.kind === "CallSite");
  const called = new Set(edges.filter((e) => e.type === "CALLS").map((e) => e.from));

  const unresolvedCalls = callSites
    .filter((n) => !called.has(n.id))
    .map((n) => ({
      id: n.id,
      file: n.props?.fileRelPath ?? "",
      calleeText: n.props?.calleeText ?? "",
    }));

  return { unresolvedImports: unresolved, unresolvedCalls };
}

export function computeUnusedFiles(ir: IR) {
  const nodes = ir.nodes ?? [];
  const edges = ir.edges ?? [];

  const files = nodes.filter((n) => n.kind === "CodeFile" || n.kind === "TextFile");
  const inboundImportsTo = new Map<string, number>();

  // If your IR models IMPORTS as File->File or Import->File, we count both.
  for (const e of edges) {
    if (e.type !== "IMPORTS") continue;
    inboundImportsTo.set(e.to, (inboundImportsTo.get(e.to) ?? 0) + 1);
  }

  // Also treat RESOLVES_TO to CodeFile as a dependency signal (optional)
  for (const e of edges) {
    if (e.type !== "RESOLVES_TO") continue;
    const tgt = nodes.find((n) => n.id === e.to);
    if (tgt?.kind === "CodeFile") inboundImportsTo.set(e.to, (inboundImportsTo.get(e.to) ?? 0) + 1);
  }

  return files
    .filter((f) => (inboundImportsTo.get(f.id) ?? 0) === 0)
    .map((f) => ({
      id: f.id,
      relPath: String(f.props?.relPath ?? f.props?.fileRelPath ?? f.id),
      kind: f.kind,
    }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
}
