import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { healthCheck, indexRepo } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Circle, Server, FolderOpen, Repeat } from "lucide-react";

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
    let icon = null;
    let cls = "";
    if (s === "pass") {
      icon = <CheckCircle className="w-4 h-4 mr-1 text-green-400" />;
      cls = "bg-green-500/10 text-green-600 border-green-200";
    } else if (s === "fail") {
      icon = <XCircle className="w-4 h-4 mr-1 text-red-400" />;
      cls = "bg-red-500/10 text-red-600 border-red-200";
    } else if (s === "running") {
      icon = <Loader2 className="w-4 h-4 mr-1 animate-spin text-yellow-500" />;
      cls = "bg-yellow-500/10 text-yellow-700 border-yellow-200";
    } else {
      icon = <Circle className="w-4 h-4 mr-1 text-muted-foreground" />;
      cls = "bg-muted text-muted-foreground border-muted-foreground/10";
    }
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${cls}`}>{icon}{s.toUpperCase()}</span>
    );
  };

  // Step icons for visual clarity
  const stepIcons = [
    <Server className="w-5 h-5 text-blue-500" />,
    <FolderOpen className="w-5 h-5 text-violet-500" />,
    <Repeat className="w-5 h-5 text-orange-500" />,
  ];

  // Progress bar for steps
  const stepProgress = (
    <div className="flex items-center justify-center gap-2 mb-2">
      {steps.map((st, i) => (
        <div key={st.id} className="flex flex-col items-center">
          <div className={`rounded-full border-2 w-8 h-8 flex items-center justify-center mb-1
            ${status[st.id] === "pass"
              ? "border-green-400 bg-green-100"
              : status[st.id] === "fail"
              ? "border-red-400 bg-red-100"
              : status[st.id] === "running"
              ? "border-yellow-400 bg-yellow-100"
              : "border-muted-foreground/20 bg-background"}`}
          >
            {stepIcons[i]}
          </div>
          <span className="text-xs text-muted-foreground">{st.id.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Card className="shadow-md border-2 border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <span className="inline-block bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">CodeAtlas Pipeline</span>
            <span className="ml-2 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-semibold tracking-wide">Showcase</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Backend base URL <span className="text-xs font-normal">(optional)</span></label>
              <input
                className="w-full px-3 py-2 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                placeholder="e.g. http://127.0.0.1:3000  (leave empty if same origin)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Project path <span className="text-xs font-normal">(local on server machine)</span></label>
              <input
                className="w-full px-3 py-2 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                placeholder="e.g. C:\\Users\\...\\myRepo"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            This dashboard runs quick <span className="font-semibold">smoke tests</span>. For detailed step-by-step testing, use the pages in the navbar.
          </div>
        </CardContent>
      </Card>

      <Card className="shadow border border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <span>Pipeline Steps</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stepProgress}
          <div className="grid gap-4">
            {steps.map((st, i) => (
              <Card key={st.id} className="border border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3 py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block">{stepIcons[i]}</div>
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium">{st.title}</CardTitle>
                      <div className="text-sm text-muted-foreground">{st.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {badge(status[st.id] ?? "idle")}
                    <Button
                      onClick={() => runStep(st.id, st.run)}
                      disabled={status[st.id] === "running"}
                      variant="outline"
                      className="font-semibold"
                    >
                      Run
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow border border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <span>Last result</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded font-mono max-h-64 overflow-auto">
            {lastResult ? JSON.stringify(lastResult, null, 2) : "No results yet."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
