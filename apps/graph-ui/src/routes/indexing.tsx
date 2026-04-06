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
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Indexing Runner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Backend base URL</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="http://127.0.0.1:3000"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Project path</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="C:\\Users\\...\\Repo"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Mode</label>
              <select
                className="w-full px-3 py-2 rounded border bg-background"
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

          <Button onClick={run} disabled={loading || !projectPath}>
            {loading ? "Running..." : "Run indexRepo"}
          </Button>

          <div className="text-xs text-muted-foreground">
            Tip: If you run <b>full</b> first, then edit a file and run <b>incremental</b>, you should see impacted dependents
            appear in the response (direct + transitive).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded">
            {result ? JSON.stringify(result, null, 2) : "No run yet."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
