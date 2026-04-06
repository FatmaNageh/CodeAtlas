import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { indexRepo, type IndexMode } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/indexing")({
  component: IndexingPage,
});

function IndexingPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [mode, setMode] = useState<IndexMode>("full");
  const [saveDebugJson, setSaveDebugJson] = useState(true);
  const [computeHash, setComputeHash] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const data = await indexRepo(
        { projectPath, mode, saveDebugJson, computeHash, dryRun },
        baseUrl
      );
      setResult(data);
      if (data?.repoId) {
        saveSession({ baseUrl, lastRepoId: data.repoId, lastProjectPath: projectPath });
      }
      toast.success("Index completed");
    } catch (e: any) {
      toast.error(e?.message ?? "Index failed");
    } finally {
      setLoading(false);
    }
  };

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <Card className="shadow-md border-2 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <span className="inline-block bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">Indexing Runner</span>
              <span className="ml-2 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-semibold tracking-wide">Advanced</span>
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
                  placeholder="e.g. C:\\Users\\...\\Repo"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Mode</label>
                <select
                  className="w-full px-3 py-2 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as IndexMode)}
                >
                  <option value="full">full</option>
                  <option value="incremental">incremental</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-8">
                <Checkbox checked={saveDebugJson} onCheckedChange={(v) => setSaveDebugJson(Boolean(v))} />
                <span className="text-sm">saveDebugJson</span>
              </div>

              <div className="flex items-center gap-2 pt-8">
                <Checkbox checked={computeHash} onCheckedChange={(v) => setComputeHash(Boolean(v))} />
                <span className="text-sm">computeHash</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(Boolean(v))} />
              <span className="text-sm">dryRun (skip Neo4j ingest)</span>
            </div>

            <Button onClick={run} disabled={loading || !projectPath} className="font-semibold mt-2">
              {loading ? "Running..." : "Run indexRepo"}
            </Button>

            <div className="text-xs text-muted-foreground">
              Tip: If you run <b>full</b> first, then edit a file and run <b>incremental</b>, you should see impacted dependents
              appear in the response (direct + transitive).
            </div>
          </CardContent>
        </Card>

        <Card className="shadow border border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span>Response</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded font-mono max-h-64 overflow-auto">
              {result ? JSON.stringify(result, null, 2) : "No run yet."}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
}
