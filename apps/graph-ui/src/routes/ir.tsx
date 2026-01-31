import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseIrJson, summarizeIr, findMissingResolutions } from "@/lib/ir";
import { fetchIr } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/ir")({
  component: IRInspector,
});

function IRInspector() {
  const sess = loadSession();
  const [baseUrl, setBaseUrl] = useState(sess.baseUrl ?? "");
  const [repoId, setRepoId] = useState(sess.lastRepoId ?? "");
  const [raw, setRaw] = useState("");
  const [ir, setIr] = useState<any>(null);

  const summary = useMemo(() => (ir ? summarizeIr(ir) : null), [ir]);
  const missing = useMemo(() => (ir ? findMissingResolutions(ir) : null), [ir]);

  const load = () => {
    try {
      const parsed = parseIrJson(raw);
      setIr(parsed);
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
          <CardTitle>IR Inspector (offline)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              className="w-full min-h-[220px] p-3 rounded border bg-background font-mono text-xs mt-2"
              placeholder='Paste IR JSON here...'
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />

            <Button onClick={load} disabled={!raw.trim()} className="mt-2">
              Load IR from pasted JSON
            </Button>
          </details>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>Nodes: <b>{summary.nodeCount}</b></div>
              <div>Edges: <b>{summary.edgeCount}</b></div>

              <div className="mt-3 text-xs text-muted-foreground">Top node kinds</div>
              <ul className="text-xs space-y-1">
                {summary.nodeKinds.slice(0, 12).map(([k, v]: any) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span><span>{v}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 text-xs text-muted-foreground">Top edge types</div>
              <ul className="text-xs space-y-1">
                {summary.edgeTypes.slice(0, 12).map(([k, v]: any) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span><span>{v}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missing resolutions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Unresolved means the node exists but there is no corresponding RESOLVES_TO (imports) or CALLS (call sites) edge.
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Unresolved Imports</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded max-h-[220px] overflow-auto">
                  {JSON.stringify(missing?.unresolvedImports?.slice(0, 50) ?? [], null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Unresolved Calls</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded max-h-[220px] overflow-auto">
                  {JSON.stringify(missing?.unresolvedCalls?.slice(0, 50) ?? [], null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
