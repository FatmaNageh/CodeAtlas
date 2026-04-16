import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Braces } from "lucide-react";
import { parseIrJson, summarizeIr, findMissingResolutions } from "@/lib/ir";
import { fetchIr } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/ir")({
  component: IRInspector,
});

// ── Shared sub-components ────────────────────────────────────────────────────

function PageSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`mb-5 rounded-[14px] p-6 ${className}`}
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
      style={{ background: "var(--s1)", border: "1px solid var(--b1)", color: "var(--t0)" }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--purple)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--b1)"; }}
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-2 text-[12.5px]"
      style={{ borderBottom: "1px solid var(--b0)" }}
    >
      <span style={{ color: "var(--t2)" }}>{label}</span>
      <span className="font-mono font-medium" style={{ color: "var(--t0)" }}>{value}</span>
    </div>
  );
}

function CodeBlock({ value }: { value: any }) {
  return (
    <pre
      className="max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11px] leading-5"
      style={{ background: "var(--s2)", color: "var(--t1)", border: "1px solid var(--b0)" }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function IRInspector() {
  const sess = loadSession();
  const [baseUrl, setBaseUrl] = useState(
    sess.baseUrl ?? import.meta.env.VITE_SERVER_URL ?? "",
  );
  const [repoId,  setRepoId]  = useState(sess.lastRepoId ?? "");
  const [raw,     setRaw]     = useState("");
  const [ir,      setIr]      = useState<any>(null);

  const summary = useMemo(() => (ir ? summarizeIr(ir) : null), [ir]);
  const missing = useMemo(() => (ir ? findMissingResolutions(ir) : null), [ir]);

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
          style={{ background: "var(--teal-l)", border: "1px solid var(--teal-b)", color: "var(--teal)" }}
        >
          <Braces style={{ width: 11, height: 11 }} />
          IR Inspector · Offline
        </div>
        <h1
          className="text-[26px] font-bold tracking-[-0.5px]"
          style={{ fontFamily: "var(--font-display)", color: "var(--t0)" }}
        >
          IR Inspector
        </h1>
        <p className="mt-2 text-[13px] leading-6" style={{ color: "var(--t2)" }}>
          Inspect and summarise the intermediate representation of your indexed repository.
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
            <TextInput value={baseUrl} onChange={setBaseUrl} placeholder="http://127.0.0.1:3000" />
          </div>
          <div>
            <FieldLabel hint="from last indexRepo run">Repo ID</FieldLabel>
            <TextInput value={repoId} onChange={setRepoId} placeholder="repoId from session" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadFromBackend}
            disabled={!repoId.trim()}
            className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
              color: "#fff",
              boxShadow: "0 1px 8px color-mix(in srgb, var(--purple) 25%, transparent)",
            }}
          >
            Load IR from backend
          </button>
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
            style={{ minHeight: 200, background: "var(--s2)", border: "1px solid var(--b1)", color: "var(--t0)" }}
            placeholder="Paste IR JSON here..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <button
            type="button"
            onClick={load}
            disabled={!raw.trim()}
            className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t1)" }}
          >
            Load IR from pasted JSON
          </button>
        </PageSection>
      </details>

      {/* Results grid */}
      {summary && (
        <div className="grid gap-5 md:grid-cols-2">

          {/* Summary */}
          <PageSection>
            <h2 className="mb-4 text-[13.5px] font-semibold" style={{ color: "var(--t0)" }}>Summary</h2>
            <SummaryRow label="Nodes" value={summary.nodeCount} />
            <SummaryRow label="Edges" value={summary.edgeCount} />

            <p className="mb-2 mt-4 text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t3)" }}>
              Top node kinds
            </p>
            {summary.nodeKinds.slice(0, 10).map(([k, v]: any) => (
              <div
                key={k}
                className="flex justify-between py-1 text-[12px]"
                style={{ borderBottom: "1px solid var(--b0)", color: "var(--t1)" }}
              >
                <span>{k}</span>
                <span className="font-mono" style={{ color: "var(--t0)" }}>{v}</span>
              </div>
            ))}

            <p className="mb-2 mt-4 text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t3)" }}>
              Top edge types
            </p>
            {summary.edgeTypes.slice(0, 10).map(([k, v]: any) => (
              <div
                key={k}
                className="flex justify-between py-1 text-[12px]"
                style={{ borderBottom: "1px solid var(--b0)", color: "var(--t1)" }}
              >
                <span>{k}</span>
                <span className="font-mono" style={{ color: "var(--t0)" }}>{v}</span>
              </div>
            ))}
          </PageSection>

          {/* Missing resolutions */}
          <PageSection>
            <h2 className="mb-2 text-[13.5px] font-semibold" style={{ color: "var(--t0)" }}>
              Missing resolutions
            </h2>
            <p className="mb-4 text-[12px] leading-5" style={{ color: "var(--t3)" }}>
              Nodes with no corresponding RESOLVES_TO or CALLS edge.
            </p>

            <p className="mb-1.5 text-[11px] font-semibold" style={{ color: "var(--t1)" }}>
              Unresolved Imports
            </p>
            <CodeBlock value={missing?.unresolvedImports?.slice(0, 50) ?? []} />

            <p className="mb-1.5 mt-4 text-[11px] font-semibold" style={{ color: "var(--t1)" }}>
              Unresolved Calls
            </p>
            <CodeBlock value={missing?.unresolvedCalls?.slice(0, 50) ?? []} />
          </PageSection>

        </div>
      )}
    </div>
  );
}
