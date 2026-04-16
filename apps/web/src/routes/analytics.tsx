import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { computeUnusedFiles, parseIrJson } from "@/lib/ir";
import { fetchIr } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

// ── Shared sub-components ────────────────────────────────────────────────────

function PageSection({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mb-5 rounded-[14px] p-6"
      style={{ background: "var(--s0)", border: "1px solid var(--b1)" }}
    >
      {children}
    </section>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-[12px]" style={{ color: "var(--t2)" }}>
      {children}
      {hint && <span className="ml-1.5" style={{ color: "var(--t3)", fontWeight: 400 }}>({hint})</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none transition-colors"
      style={{
        background: "var(--s1)",
        border: "1px solid var(--b1)",
        color: "var(--t0)",
      }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--purple)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--b1)"; }}
    />
  );
}

function Btn({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      style={
        primary
          ? {
              background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
              color: "#fff",
              boxShadow: "0 1px 8px color-mix(in srgb, var(--purple) 25%, transparent)",
            }
          : {
              background: "var(--s1)",
              border: "1px solid var(--b2)",
              color: "var(--t1)",
            }
      }
    >
      {children}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const sess = loadSession();
  const [baseUrl, setBaseUrl] = useState(
    sess.baseUrl ?? import.meta.env.VITE_SERVER_URL ?? "",
  );
  const [repoId, setRepoId]   = useState(sess.lastRepoId ?? "");
  const [raw, setRaw]         = useState("");
  const [ir, setIr]           = useState<any>(null);

  const unused = useMemo(() => (ir ? computeUnusedFiles(ir) : []), [ir]);

  const load = () => {
    try   { setIr(parseIrJson(raw)); toast.success("Loaded IR JSON"); }
    catch (e: any) { toast.error(e?.message ?? "Invalid JSON"); }
  };

  const loadFromBackend = async () => {
    if (!repoId.trim()) { toast.error("Missing repoId"); return; }
    try {
      const data = await fetchIr(repoId.trim(), baseUrl);
      saveSession({ baseUrl, lastRepoId: repoId.trim() });
      setIr(data);
      toast.success("Loaded IR from backend");
    } catch (e: any) { toast.error(e?.message ?? "Failed to load IR"); }
  };

  return (
    <div className="mx-auto w-full max-w-[860px] px-6 py-12">

      {/* Page header */}
      <div className="mb-8">
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
          style={{ background: "var(--purple-l)", border: "1px solid var(--purple-b)", color: "var(--purple)" }}
        >
          <BarChart3 style={{ width: 11, height: 11 }} />
          Analytics · IR Insights
        </div>
        <h1
          className="text-[26px] font-bold tracking-[-0.5px]"
          style={{ fontFamily: "var(--font-display)", color: "var(--t0)" }}
        >
          Analytics
          <span className="ml-2 text-[20px] font-normal" style={{ color: "var(--t2)" }}>
            (non-LLM)
          </span>
        </h1>
        <p className="mt-2 text-[13px] leading-6" style={{ color: "var(--t2)" }}>
          Compute analytics directly from the IR — unused files, import chains, dependency hotspots.
        </p>
      </div>

      {/* Connection */}
      <PageSection>
        <h2 className="mb-5 text-[13.5px] font-semibold" style={{ color: "var(--t0)" }}>
          Connection
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel hint="optional">Backend base URL</FieldLabel>
            <TextInput
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder="http://127.0.0.1:3000"
            />
          </div>
          <div>
            <FieldLabel hint="from last indexRepo run">Repo ID</FieldLabel>
            <TextInput
              value={repoId}
              onChange={setRepoId}
              placeholder="repoId from session"
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn onClick={loadFromBackend} disabled={!repoId.trim()} primary>
            Load IR from backend
          </Btn>
        </div>
      </PageSection>

      {/* Paste JSON */}
      <details className="mb-5">
        <summary
          className="mb-3 cursor-pointer select-none text-[12px]"
          style={{ color: "var(--t2)" }}
        >
          ▸ Advanced: paste IR JSON manually
        </summary>
        <PageSection>
          <textarea
            className="mb-4 w-full resize-y rounded-[8px] p-3 font-mono text-[12px] outline-none"
            style={{
              minHeight: 180,
              background: "var(--s2)",
              border: "1px solid var(--b1)",
              color: "var(--t0)",
            }}
            placeholder="Paste IR JSON here..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <Btn onClick={load} disabled={!raw.trim()}>
            Compute analytics from pasted JSON
          </Btn>
        </PageSection>
      </details>

      {/* Results */}
      {ir && (
        <PageSection>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[13.5px] font-semibold" style={{ color: "var(--t0)" }}>
              Unused files
            </h2>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: "var(--amber-l)", color: "var(--amber)", border: "1px solid var(--amber-b)" }}
            >
              {unused.length}
            </span>
          </div>
          <p className="mb-3 text-[12px]" style={{ color: "var(--t3)" }}>
            Heuristic: files with zero inbound IMPORTS. Entry points not yet excluded — treat as candidates.
          </p>
          <pre
            className="max-h-96 overflow-auto rounded-[8px] p-4 font-mono text-[11px] leading-5"
            style={{ background: "var(--s2)", color: "var(--t1)", border: "1px solid var(--b0)" }}
          >
            {JSON.stringify(unused.slice(0, 200), null, 2)}
          </pre>
        </PageSection>
      )}
    </div>
  );
}
