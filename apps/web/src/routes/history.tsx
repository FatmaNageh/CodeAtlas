import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, GitBranch, ArrowRight, RefreshCw, Database, Trash2 } from "lucide-react";
import { deleteRepositoryGraph, fetchRepos, type RepoRecord } from "@/lib/api";
import { getStoredProjects, removeStoredProject, type StoredProject } from "@/lib/project-history";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  component: GraphHistoryPage,
});

function GraphHistoryPage() {
  const navigate = useNavigate();
  const session = loadSession();
  const [baseUrl] = useState(session.baseUrl ?? import.meta.env.VITE_SERVER_URL ?? "");
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [storedProjects, setStoredProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setStoredProjects(getStoredProjects());
    try {
      const data = await fetchRepos(baseUrl);
      setRepos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openGraph(repoId: string) {
    saveSession({ lastRepoId: repoId });
    navigate({ to: "/graph" });
  }

  async function removeGraph(repoId: string) {
    const confirmed = window.confirm(
      "Delete this repository graph and its saved local index state?",
    );
    if (!confirmed) return;

    try {
      const result = await deleteRepositoryGraph({ repoId }, baseUrl);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setRepos((current) => current.filter((repo) => repo.repoId !== repoId));
      removeStoredProject(repoId);
      setStoredProjects(getStoredProjects());
      toast.success("Repository graph deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete repository graph";
      toast.error(message);
    }
  }

  const visibleProjects = (() => {
    const fromServer = repos.map((repo) => ({
      repoId: repo.repoId,
      rootPath: repo.rootPath ?? "",
      indexedAt: typeof repo.indexedAt === "string" ? repo.indexedAt : undefined,
      source: "server" as const,
    }));

    const merged = new Map<
      string,
      {
        repoId: string;
        rootPath: string;
        indexedAt?: string;
        lastOpenedAt?: string;
        chatUpdatedAt?: string;
        chatMessageCount?: number;
      }
    >();

    for (const repo of fromServer) {
      merged.set(repo.repoId, { ...repo });
    }

    for (const project of storedProjects) {
      const existing = merged.get(project.repoId);
      merged.set(project.repoId, {
        repoId: project.repoId,
        rootPath: existing?.rootPath || project.rootPath,
        indexedAt: existing?.indexedAt ?? project.indexedAt,
        lastOpenedAt: project.lastOpenedAt,
        chatUpdatedAt: project.chatUpdatedAt,
        chatMessageCount: project.chatMessageCount,
      });
    }

    return Array.from(merged.values()).sort((left, right) => {
      const leftDate = left.lastOpenedAt ?? left.indexedAt ?? "";
      const rightDate = right.lastOpenedAt ?? right.indexedAt ?? "";
      return rightDate.localeCompare(leftDate);
    });
  })();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "48px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 14px",
              borderRadius: 100,
              background: "color-mix(in srgb, var(--teal) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--teal) 25%, transparent)",
              marginBottom: 16,
            }}
          >
            <Database size={13} style={{ color: "var(--teal)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal)", letterSpacing: "0.04em" }}>
              Graph History · Neo4j
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 800,
                  color: "var(--t0)",
                  letterSpacing: "-0.5px",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Graph History
              </h1>
              <p style={{ color: "var(--t2)", fontSize: 15, marginTop: 8, maxWidth: 500 }}>
                All repositories indexed and saved in the Neo4j database. Click any graph to explore it.
              </p>
            </div>

            <button
              onClick={load}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--t1)",
                background: "color-mix(in srgb, var(--t0) 6%, transparent)",
                border: "1px solid var(--b2)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "opacity 0.15s",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {error && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: "color-mix(in srgb, #fb923c 10%, transparent)",
              border: "1px solid color-mix(in srgb, #fb923c 25%, transparent)",
              color: "#fb923c",
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 96,
                  borderRadius: 14,
                  background: "color-mix(in srgb, var(--t0) 4%, transparent)",
                  border: "1px solid var(--b1)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}

        {!loading && !error && repos.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              borderRadius: 16,
              border: "1px dashed var(--b2)",
              color: "var(--t3)",
            }}
          >
            <Database size={40} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: "var(--t2)", marginBottom: 8 }}>No graphs indexed yet</p>
            <p style={{ fontSize: 14 }}>Index a repository first to see it here.</p>
            <Link
              to="/onboarding"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 20,
                padding: "9px 20px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(135deg, var(--purple), var(--blue))",
                textDecoration: "none",
              }}
            >
              Get started <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {!loading && visibleProjects.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleProjects.map((repo) => (
              <RepoCard key={repo.repoId} repo={repo} onOpen={openGraph} onDelete={removeGraph} />
            ))}
          </div>
        )}

        {/* ── Nav buttons ── */}
        <div style={{ display: "flex", gap: 12, marginTop: 48, flexWrap: "wrap" }}>
          <NavButton to="/" label="Home" />
          <NavButton to="/graph" label="Graph Explorer" accent="var(--teal)" />
          <NavButton to="/onboarding" label="Onboarding" />
          <NavButton to="/faquestions" label="FAQ" />
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function RepoCard({
  repo,
  onOpen,
  onDelete,
}: {
  repo: {
    repoId: string;
    rootPath: string;
    indexedAt?: string;
    lastOpenedAt?: string;
    chatUpdatedAt?: string;
    chatMessageCount?: number;
  };
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const shortId = repo.repoId?.slice(0, 12) ?? "unknown";
  const rootPath = repo.rootPath ?? repo.repoId ?? "—";
  const parts = rootPath.replace(/\\/g, "/").split("/");
  const name = parts[parts.length - 1] || rootPath;
  const indexedAt = repo.indexedAt ? new Date(repo.indexedAt).toLocaleString() : null;
  const lastOpenedAt = repo.lastOpenedAt ? new Date(repo.lastOpenedAt).toLocaleString() : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "20px 24px",
        borderRadius: 14,
        background: hovered
          ? "color-mix(in srgb, var(--purple) 6%, var(--s0))"
          : "var(--s0)",
        border: `1px solid ${hovered ? "color-mix(in srgb, var(--purple) 30%, transparent)" : "var(--b1)"}`,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onClick={() => onOpen(repo.repoId)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "color-mix(in srgb, var(--purple) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--purple) 25%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <GitBranch size={18} style={{ color: "var(--purple)" }} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--t0)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--t3)",
              fontFamily: "var(--font-mono)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {shortId}
          </div>
          {indexedAt && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Clock size={11} style={{ color: "var(--t3)" }} />
              <span style={{ fontSize: 11, color: "var(--t3)" }}>
                Indexed {indexedAt}
              </span>
            </div>
          )}
          {lastOpenedAt && (
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--t3)" }}>
              Last opened {lastOpenedAt}
              {typeof repo.chatMessageCount === "number" ? ` · ${repo.chatMessageCount} chat messages` : ""}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(repo.repoId);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#b91c1c",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.18)",
            cursor: "pointer",
          }}
        >
          <Trash2 size={13} />
          Delete
        </button>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: hovered ? "#fff" : "var(--t1)",
            background: hovered
              ? "linear-gradient(135deg, var(--purple), var(--blue))"
              : "color-mix(in srgb, var(--t0) 6%, transparent)",
            border: `1px solid ${hovered ? "transparent" : "var(--b2)"}`,
            transition: "all 0.15s",
          }}
        >
          Open Graph <ArrowRight size={13} />
        </div>
      </div>
    </div>
  );
}

function NavButton({ to, label, accent }: { to: string; label: string; accent?: string }) {
  return (
    <Link
      to={to}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 20px",
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 500,
        color: accent ? accent : "var(--t1)",
        background: accent
          ? `color-mix(in srgb, ${accent} 10%, transparent)`
          : "color-mix(in srgb, var(--t0) 6%, transparent)",
        border: `1px solid ${accent ? `color-mix(in srgb, ${accent} 25%, transparent)` : "var(--b2)"}`,
        textDecoration: "none",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      {label}
    </Link>
  );
}
