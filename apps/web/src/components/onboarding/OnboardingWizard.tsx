import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Folder, FolderOpen, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { indexRepo } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";

type Step = 1 | 2 | 3;

type RepoItem = {
  id: string;
  name: string;
  path: string;
  meta: string;
};

const demoRepos: RepoItem[] = [
  {
    id: "repo-1",
    name: "my-ecommerce-api",
    path: "/projects/my-ecommerce-api",
    meta: "1,247 files · 2 days ago",
  },
  {
    id: "repo-2",
    name: "compiler-frontend",
    path: "/dev/compiler-frontend",
    meta: "3,891 files · 1 week ago",
  },
];

const relationshipTypes = ["CONTAINS", "IMPORTS", "CALLS"];

export function OnboardingWizard() {
  const session = loadSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [baseUrl] = useState(session.baseUrl ?? "");
  const [selectedRepoId, setSelectedRepoId] = useState("repo-1");
  const [customPath, setCustomPath] = useState(session.lastProjectPath ?? "");
  const [ignoredPatterns, setIgnoredPatterns] = useState<string[]>([
    "node_modules",
    ".git",
    ".env",
    "dist/",
    "build/",
  ]);
  const [aiContextLimit, setAiContextLimit] = useState(20);
  const [buildProgress, setBuildProgress] = useState(0);
  const [building, setBuilding] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [buildStats, setBuildStats] = useState({
    files: "1,247 files",
    nodes: "4,328 nodes",
    relations: "12,441 / ~18k",
  });

  const selectedRepo = useMemo(() => {
    if (customPath.trim()) {
      const parts = customPath.replace(/\\/g, "/").split("/").filter(Boolean);
      const name = parts[parts.length - 1] || "selected-repository";
      return {
        id: "custom",
        name,
        path: customPath,
        meta: "Custom path",
      } satisfies RepoItem;
    }

    return demoRepos.find((repo) => repo.id === selectedRepoId) ?? demoRepos[0];
  }, [selectedRepoId, customPath]);

  useEffect(() => {
    if (step !== 3 || buildDone) return;

    setBuilding(true);
    setBuildProgress(68);

    const timer = window.setInterval(() => {
      setBuildProgress((prev) => {
        const next = Math.min(prev + Math.random() * 4, 98);
        return next;
      });
    }, 350);

    return () => {
      window.clearInterval(timer);
    };
  }, [step, buildDone]);

  const removePattern = (pattern: string) => {
    setIgnoredPatterns((prev) => prev.filter((item) => item !== pattern));
  };

  const handleBuild = async () => {
    if (building && buildDone) return;

    try {
      setStep(3);
      setBuilding(true);
      setBuildDone(false);

      saveSession({
        baseUrl,
        lastProjectPath: selectedRepo.path,
      });

      const result = await indexRepo(
        {
          projectPath: selectedRepo.path,
          mode: "full",
          saveDebugJson: true,
          computeHash: true,
        },
        baseUrl,
      );

      const repoId = result?.repoId ?? result?.repo?.id ?? "";
      saveSession({
        baseUrl,
        lastRepoId: repoId,
        lastProjectPath: selectedRepo.path,
      });

      setBuildProgress(100);
      setBuildDone(true);
      setBuilding(false);

      setBuildStats({
        files: `${result?.scanned?.processedFiles ?? result?.scanned?.totalFiles ?? "1,247"} files`,
        nodes: `${result?.graph?.nodes ?? result?.metrics?.nodes ?? "4,328"} nodes`,
        relations: `${result?.graph?.edges ?? result?.metrics?.edges ?? "18,763"} relationships`,
      });

      toast.success("Graph build complete");
    } catch (error: any) {
      setBuildDone(true);
      setBuilding(false);
      setBuildProgress(100);
      toast.error(error?.message ?? "Failed to build graph");
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-50px)] w-full max-w-[1200px] items-center justify-center px-6 py-10">
      <div className="codeatlas-card w-full max-w-[560px] overflow-hidden rounded-[16px] shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
        <StepHeader step={step} />

        {step === 1 && (
          <>
            <div className="px-7 py-8">
              <h2 className="mb-2 text-[18px] font-medium tracking-[-0.3px]">Select a repository</h2>
              <p className="codeatlas-muted mb-6 text-[13px] leading-6">
                Choose a local directory or a recent project to begin analysis.
              </p>

              <div className="mb-4 rounded-[10px] border border-[var(--border2)] bg-[var(--surface2)]/50 p-4">
                <label className="mb-2 block text-[12px] text-[var(--text2)]">Local project path</label>
                <input
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--text)]"
                  placeholder="C:/Users/hp/Desktop/CodeAtlas/example_files/simple_js_project"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                />
                <p className="mt-2 text-[11px] text-[var(--text3)]">
                  Paste the real backend-accessible path here, or pick one of the recent demo repositories below.
                </p>
              </div>

              <button
                type="button"
                onClick={() => toast.info("Use the local project path field above in the React version.")}
                className="codeatlas-dashed mb-4 w-full rounded-[10px] px-6 py-9 text-center transition hover:bg-[var(--surface2)]"
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--surface2)]">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <h4 className="mb-1 text-[14px] font-medium">Drop a folder here</h4>
                <p className="text-[12px] text-[var(--text3)]">or click to browse your file system</p>
              </button>

              <p className="mb-2 text-[12px] text-[var(--text3)]">Recent repositories</p>
              <div className="flex flex-col gap-2">
                {demoRepos.map((repo) => {
                  const selected = !customPath.trim() && repo.id === selectedRepoId;
                  return (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => {
                        setSelectedRepoId(repo.id);
                        setCustomPath("");
                      }}
                      className={`flex items-center gap-3 rounded-[8px] border px-4 py-3 text-left transition ${
                        selected
                          ? "border-[var(--text)] bg-[var(--surface2)]"
                          : "border-[var(--border)] hover:bg-[var(--surface2)]"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[var(--node-folder-bg)] text-[var(--node-folder)]">
                        <Folder className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="text-[13px] font-medium">{repo.name}</div>
                        <div className="text-[11px] text-[var(--text3)]">
                          {repo.path} · {repo.meta}
                        </div>
                      </div>

                      <div className="ml-auto flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-[var(--border2)] bg-transparent text-[10px]">
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <WizardFooter
              step={step}
              onNext={() => setStep(2)}
              nextLabel="Next"
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="px-7 py-8">
              <h2 className="mb-2 text-[18px] font-medium tracking-[-0.3px]">Configure analysis</h2>
              <p className="codeatlas-muted mb-6 text-[13px] leading-6">
                Adjust what CodeAtlas will include or ignore when building the knowledge graph.
              </p>

              <section className="mb-6">
                <label className="mb-2 block text-[12px] text-[var(--text2)]">Excluded directories &amp; files</label>
                <div className="flex flex-wrap gap-2">
                  {ignoredPatterns.map((pattern) => (
                    <div
                      key={pattern}
                      className="flex items-center gap-2 rounded-full border border-[var(--border2)] px-3 py-1 text-[12px] text-[var(--text2)]"
                    >
                      <code>{pattern}</code>
                      <button type="button" onClick={() => removePattern(pattern)} className="text-[14px] leading-none">
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => toast.info("Add more patterns by extending ignoredPatterns in the component state.")}
                    className="rounded-full border border-dashed border-[var(--border2)] px-3 py-1 text-[12px] text-[var(--text2)]"
                  >
                    + Add pattern
                  </button>
                </div>
              </section>

              <section className="mb-6">
                <label className="mb-2 block text-[12px] text-[var(--text2)]">Relationship types to extract</label>
                <div className="flex flex-wrap gap-2">
                  {relationshipTypes.map((type) => (
                    <div
                      key={type}
                      className="rounded-full px-3 py-1 text-[12px]"
                      style={{
                        backgroundColor:
                          type === "CONTAINS"
                            ? "var(--node-folder-bg)"
                            : type === "IMPORTS"
                              ? "var(--node-file-bg)"
                              : "var(--node-fn-bg)",
                        color:
                          type === "CONTAINS"
                            ? "var(--node-folder)"
                            : type === "IMPORTS"
                              ? "var(--node-file)"
                              : "var(--node-fn)",
                      }}
                    >
                      <code>{type}</code>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <label className="mb-2 block text-[12px] text-[var(--text2)]">AI context limit</label>
                <div className="flex items-center gap-3">
                  <input
                    className="w-full"
                    type="range"
                    min={5}
                    max={50}
                    value={aiContextLimit}
                    onChange={(e) => setAiContextLimit(Number(e.target.value))}
                  />
                  <span className="min-w-8 text-[13px] font-medium">{aiContextLimit}</span>
                  <span className="text-[12px] text-[var(--text3)]">nodes max</span>
                </div>
              </section>
            </div>

            <WizardFooter
              step={step}
              onBack={() => setStep(1)}
              onNext={handleBuild}
              nextLabel="Build graph"
            />
          </>
        )}

        {step === 3 && (
          <>
            <div className="px-7 py-8">
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--node-folder-bg)] text-[var(--node-folder)]">
                  <Folder className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[16px] font-medium">{selectedRepo.name}</div>
                  <div className="text-[12px] text-[var(--text3)]">{selectedRepo.path}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--text3)]">
                  <span>Building knowledge graph</span>
                  <span>{Math.round(buildProgress)}%</span>
                </div>
                <div className="h-[4px] overflow-hidden rounded bg-[var(--surface2)]">
                  <div className="h-full rounded bg-[var(--text)] transition-all duration-500" style={{ width: `${buildProgress}%` }} />
                </div>
              </div>

              <div className="space-y-4">
                <BuildRow done label="Validating repository" sub="Found supported source files" count={buildStats.files} />
                <BuildRow done label="Extracting entities" sub="Folders, files, classes, functions" count={buildStats.nodes} />
                <BuildRow
                  active={!buildDone}
                  done={buildDone}
                  label="Identifying relationships"
                  sub="CONTAINS · IMPORTS · CALLS"
                  count={buildDone ? buildStats.relations : "Building…"}
                />
                <BuildRow done={buildDone} label="Persisting graph" sub="Saving repoId into session storage" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border)] px-7 py-5">
              <span className="text-[12px] text-[var(--text3)]">Build progress</span>
              <div className="flex items-center gap-2">
                <Link
                  to="/graph"
                  className="rounded-[6px] border border-[var(--border2)] px-3 py-2 text-[12px] hover:bg-[var(--surface2)]"
                >
                  Open existing graph
                </Link>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/graph" })}
                  className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--text)] px-3 py-2 text-[12px] text-[var(--surface)]"
                >
                  Open Explorer <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const isDone = (value: Step) => step > value;
  const isActive = (value: Step) => step === value;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-7 py-5">
      {[
        [1, "Repository"],
        [2, "Configure"],
        [3, "Build graph"],
      ].map(([value, label], index) => (
        <div key={label as string} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[11px] ${
              isDone(value as Step)
                ? "border-[var(--text)] bg-[var(--text)] text-[var(--surface)]"
                : isActive(value as Step)
                  ? "border-[var(--text)] text-[var(--text)]"
                  : "border-[var(--border2)] text-[var(--text3)]"
            }`}
          >
            {isDone(value as Step) ? <Check className="h-3 w-3" /> : value}
          </div>
          <span className={`text-[12px] ${isActive(value as Step) ? "text-[var(--text)]" : "text-[var(--text3)]"}`}>{label}</span>
          {index < 2 ? <div className="mx-1 h-px flex-1 bg-[var(--border2)]" /> : null}
        </div>
      ))}
    </div>
  );
}

function WizardFooter({
  step,
  onBack,
  onNext,
  nextLabel,
}: {
  step: Step;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--border)] px-7 py-5">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-[var(--text2)] hover:text-[var(--text)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : (
          <div className="flex gap-1.5">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`h-[6px] w-[6px] rounded-full ${dot === step ? "bg-[var(--text)]" : "bg-[var(--border2)]"}`}
              />
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={onNext} className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--text)] px-3 py-2 text-[12px] text-[var(--surface)]">
        {nextLabel} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BuildRow({
  label,
  sub,
  count,
  done = false,
  active = false,
}: {
  label: string;
  sub: string;
  count?: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div
        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] ${
          done
            ? "border-[var(--teal-b)] bg-[var(--teal-l)] text-[var(--teal)]"
            : active
              ? "codeatlas-progress-pulse border-[var(--text)] text-[var(--text)]"
              : "border-[var(--border2)] text-[var(--text3)]"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : null}
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-[var(--text3)]">{sub}</div>
      </div>
      {count ? <div className="text-[11px] text-[var(--teal)]">{count}</div> : null}
    </div>
  );
}
