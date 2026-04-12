import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GitBranch } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { indexRepo, type IndexMode } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/indexing")({
  component: IndexingPage,
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
      style={{ background: "var(--s1)", border: "1px solid var(--b1)", color: "var(--t0)" }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--purple)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--b1)"; }}
    />
  );
}

function StyledSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
      style={{ background: "var(--s1)", border: "1px solid var(--b1)", color: "var(--t0)" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span className="text-[13px]" style={{ color: "var(--t1)" }}>{children}</span>
    </label>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function IndexingPage() {
  const [baseUrl,       setBaseUrl]       = useState("");
  const [projectPath,   setProjectPath]   = useState("");
  const [mode,          setMode]          = useState<IndexMode>("full");
  const [saveDebugJson, setSaveDebugJson] = useState(true);
  const [computeHash,   setComputeHash]   = useState(true);
  const [dryRun,        setDryRun]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const data = await indexRepo(
        { projectPath, mode, saveDebugJson, computeHash, dryRun },
        baseUrl,
      );
      setResult(data);
      if (data?.repoId) saveSession({ baseUrl, lastRepoId: data.repoId, lastProjectPath: projectPath });
      toast.success("Index completed");
    } catch (e: any) {
      toast.error(e?.message ?? "Index failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[860px] px-6 py-12">

      {/* Page header */}
      <div className="mb-8">
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
          style={{ background: "var(--blue-l)", border: "1px solid var(--blue-b)", color: "var(--blue)" }}
        >
          <GitBranch style={{ width: 11, height: 11 }} />
          Indexing Runner · Advanced
        </div>
        <h1
          className="text-[26px] font-bold tracking-[-0.5px]"
          style={{ fontFamily: "var(--font-display)", color: "var(--t0)" }}
        >
          Indexing Runner
        </h1>
        <p className="mt-2 text-[13px] leading-6" style={{ color: "var(--t2)" }}>
          Trigger a full or incremental index of a repository and inspect the raw result.
        </p>
      </div>

      {/* Config */}
      <PageSection>
        <h2 className="mb-5 text-[13.5px] font-semibold" style={{ color: "var(--t0)" }}>
          Configuration
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
            <FieldLabel hint="local on server">Project path</FieldLabel>
            <TextInput
              value={projectPath}
              onChange={setProjectPath}
              placeholder="C:\Users\...\Repo"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Mode</FieldLabel>
            <StyledSelect
              value={mode}
              onChange={(v) => setMode(v as IndexMode)}
              options={[
                { value: "full",        label: "full"        },
                { value: "incremental", label: "incremental" },
              ]}
            />
          </div>
          <div className="flex items-end pb-1">
            <CheckRow checked={saveDebugJson} onChange={setSaveDebugJson}>
              saveDebugJson
            </CheckRow>
          </div>
          <div className="flex items-end pb-1">
            <CheckRow checked={computeHash} onChange={setComputeHash}>
              computeHash
            </CheckRow>
          </div>
        </div>

        <div className="mt-4">
          <CheckRow checked={dryRun} onChange={setDryRun}>
            dryRun — skip Neo4j ingest
          </CheckRow>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading || !projectPath.trim()}
            className="inline-flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-[13px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
              color: "#fff",
              boxShadow: "0 1px 8px color-mix(in srgb, var(--purple) 25%, transparent)",
            }}
          >
            {loading ? "Running…" : "Run indexRepo"}
          </button>
          {loading && (
            <span className="text-[12px]" style={{ color: "var(--t3)" }}>
              This may take a moment…
            </span>
          )}
        </div>

        <p className="mt-4 text-[12px] leading-5" style={{ color: "var(--t3)" }}>
          Tip: run <strong style={{ color: "var(--t2)" }}>full</strong> first, then edit a file and
          run <strong style={{ color: "var(--t2)" }}>incremental</strong> to see impacted dependents.
        </p>
      </PageSection>

      {/* Response */}
      <PageSection>
        <h2 className="mb-4 text-[13.5px] font-semibold" style={{ color: "var(--t0)" }}>
          Response
        </h2>
        <pre
          className="max-h-64 overflow-auto rounded-[8px] p-4 font-mono text-[11px] leading-5"
          style={{ background: "var(--s2)", color: "var(--t1)", border: "1px solid var(--b0)" }}
        >
          {result ? JSON.stringify(result, null, 2) : "No run yet."}
        </pre>
      </PageSection>
    </div>
  );
}