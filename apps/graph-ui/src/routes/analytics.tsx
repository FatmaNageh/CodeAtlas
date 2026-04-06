import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeUnusedFiles, parseIrJson } from "@/lib/ir";
import { fetchIr } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const sess = loadSession();
  const [baseUrl, setBaseUrl] = useState(sess.baseUrl ?? "");
  const [repoId, setRepoId] = useState(sess.lastRepoId ?? "");
  const [raw, setRaw] = useState("");
  const [ir, setIr] = useState<any>(null);

  const unused = useMemo(() => (ir ? computeUnusedFiles(ir) : []), [ir]);

  const load = () => {
    try {
      setIr(parseIrJson(raw));
      toast.success("Loaded IR JSON");
    } catch (e: any) {
      toast.error(e?.message ?? "Invalid JSON");
    }
  };

  const loadFromBackend = async () => {
    if (!repoId.trim()) {
      toast.error("Missing repoId");
      return;
    }
    try {
      const data = await fetchIr(repoId.trim(), baseUrl);
      saveSession({ baseUrl, lastRepoId: repoId.trim() });
      setIr(data);
      toast.success("Loaded IR from backend");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load IR");
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analytics (non-LLM)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            For now this page computes analytics directly from the IR (offline):
            <b> unused files</b> based on “no inbound IMPORTS/RESOLVES_TO”.
            Later you can move these computations to Neo4j queries + backend endpoints.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Backend base URL</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="(optional) http://127.0.0.1:3000"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">RepoId</label>
              <input
                className="w-full px-3 py-2 rounded border bg-background"
                placeholder="repoId from last indexRepo run"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadFromBackend} disabled={!repoId.trim()}>
              Load IR from backend
            </Button>
          </div>

          <details>
            <summary className="text-sm text-muted-foreground cursor-pointer">Advanced: paste IR JSON manually</summary>
            <textarea
              className="w-full min-h-[200px] p-3 rounded border bg-background font-mono text-xs mt-2"
              placeholder="Paste IR JSON here..."
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />

            <Button onClick={load} disabled={!raw.trim()} className="mt-2">
              Compute analytics from pasted JSON
            </Button>
          </details>
        </CardContent>
      </Card>

      {ir && (
        <Card>
          <CardHeader>
            <CardTitle>Unused files ({unused.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-2">
              Heuristic: files with zero inbound IMPORTS (and no RESOLVES_TO references to the file).
              Entry points are not yet excluded — treat this as “candidates”.
            </div>

            <pre className="text-xs whitespace-pre-wrap break-word bg-muted/40 p-3 rounded max-h-[420px] overflow-auto">
              {JSON.stringify(unused.slice(0, 200), null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
