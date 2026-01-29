import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { healthCheck, indexRepo } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type StepStatus = "idle" | "running" | "pass" | "fail";

function Dashboard() {
  const [baseUrl, setBaseUrl] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [status, setStatus] = useState<Record<string, StepStatus>>({
    health: "idle",
    full: "idle",
    incr: "idle",
  });
  const [lastResult, setLastResult] = useState<any>(null);

  const steps = useMemo(
    () => [
      {
        id: "health",
        title: "Step 1 — Server health",
        desc: "Checks that the backend is running and reachable (GET /health).",
        run: async () => {
          const data = await healthCheck(baseUrl);
          setLastResult(data);
        },
      },
      {
        id: "full",
        title: "Step 2 — Full indexing (Phase 1 + Phase 2 engine)",
        desc: "Runs full scan → parse → IR → Neo4j ingest (unless dryRun enabled in Indexing page).",
        run: async () => {
          if (!projectPath) throw new Error("Set a project path first.");
          const data = await indexRepo(
            { projectPath, mode: "full", saveDebugJson: true, computeHash: true },
            baseUrl
          );
          setLastResult(data);
        },
      },
      {
        id: "incr",
        title: "Step 3 — Incremental indexing (changed + dependents)",
        desc: "Runs incremental mode. Should include direct/transitive dependents if graph exists.",
        run: async () => {
          if (!projectPath) throw new Error("Set a project path first.");
          const data = await indexRepo(
            { projectPath, mode: "incremental", saveDebugJson: true, computeHash: true },
            baseUrl
          );
          setLastResult(data);
        },
      },
    ],
    [baseUrl, projectPath]
  );

  const runStep = async (id: string, fn: () => Promise<void>) => {
    setStatus((s) => ({ ...s, [id]: "running" }));
    try {
      await fn();
      setStatus((s) => ({ ...s, [id]: "pass" }));
      toast.success("Step passed");
    } catch (e: any) {
      setStatus((s) => ({ ...s, [id]: "fail" }));
      toast.error(e?.message ?? "Step failed");
    }
  };

  const badge = (s: StepStatus) => {
    const cls =
      s === "pass"
        ? "bg-green-500/20 text-green-400"
        : s === "fail"
        ? "bg-red-500/20 text-red-400"
        : s === "running"
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-muted text-muted-foreground";
    return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{s.toUpperCase()}</span>;
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CodeAtlas Pipeline Showcase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Backend base URL (optional)</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="e.g. http://127.0.0.1:3000  (leave empty if same origin)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Project path (local on server machine)</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="e.g. C:\\Users\\...\\myRepo"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            This dashboard runs quick “smoke tests”. For detailed step-by-step testing, use the pages in the navbar.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {steps.map((st) => (
          <Card key={st.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{st.title}</CardTitle>
                <div className="text-sm text-muted-foreground">{st.desc}</div>
              </div>
              <div className="flex items-center gap-3">
                {badge(status[st.id] ?? "idle")}
                <Button
                  onClick={() => runStep(st.id, st.run)}
                  disabled={status[st.id] === "running"}
                >
                  Run
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last result</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded">
            {lastResult ? JSON.stringify(lastResult, null, 2) : "No results yet."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
