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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Card className="shadow-md border-2 border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <span className="inline-block bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">IR Inspector (offline)</span>
            <span className="ml-2 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-semibold tracking-wide">IR Details</span>
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
              <label className="text-sm font-medium text-muted-foreground">RepoId <span className="text-xs font-normal">(from last indexRepo run)</span></label>
              <input
                className="w-full px-3 py-2 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                placeholder="repoId from last indexRepo run"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadFromBackend} disabled={!repoId.trim()} className="font-semibold">
              Load IR from backend
            </Button>
          </div>

          <details>
            <summary className="text-sm text-muted-foreground cursor-pointer">Advanced: paste IR JSON manually</summary>
            <textarea
              className="w-full min-h-[220px] p-3 rounded border bg-background font-mono text-xs mt-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              placeholder='Paste IR JSON here...'
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />

            <Button onClick={load} disabled={!raw.trim()} className="mt-2 font-semibold">
              Load IR from pasted JSON
            </Button>
          </details>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow border border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <span>Summary</span>
              </CardTitle>
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

          <Card className="shadow border border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <span>Missing resolutions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Unresolved means the node exists but there is no corresponding RESOLVES_TO (imports) or CALLS (call sites) edge.
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Unresolved Imports</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded font-mono max-h-56 overflow-auto">
                  {JSON.stringify(missing?.unresolvedImports?.slice(0, 50) ?? [], null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Unresolved Calls</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-3 rounded font-mono max-h-56 overflow-auto">
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
