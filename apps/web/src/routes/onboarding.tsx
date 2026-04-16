import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Folder,
  FolderOpen,
  Check,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Sparkles,
  Settings2,
  Database,
  FolderSearch,
  Wand2,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { indexRepo, type IndexRepoResponse } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  return <OnboardingWizard />;
}
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

function extractPathFromItem(item: DataTransferItem): string | null {
  const file = item.getAsFile();
  const entry = item.webkitGetAsEntry?.();

  if (file && (file as any).path) {
    const absPath: string = (file as any).path;
    if (entry?.isDirectory) return absPath;
    const sep = absPath.includes("\\") ? "\\" : "/";
    const parts = absPath.split(sep);
    parts.pop();
    return parts.join(sep) || absPath;
  }

  if (entry) {
    return entry.fullPath?.replace(/^\//, "") || entry.name || null;
  }

  return file?.name ?? null;
}

function extractPathFromFileList(files: FileList): string | null {
  if (!files.length) return null;

  const first = files[0] as File & {
    path?: string;
    webkitRelativePath?: string;
  };

  if (first.path) {
    const sep = first.path.includes("\\") ? "\\" : "/";
    const parts = first.path.split(sep);
    const relDepth = first.webkitRelativePath
      ? first.webkitRelativePath.split("/").length - 1
      : 1;
    return parts.slice(0, parts.length - relDepth).join(sep) || first.path;
  }

  if (first.webkitRelativePath) {
    return first.webkitRelativePath.split("/")[0];
  }

  return first.name;
}

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
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildStats, setBuildStats] = useState({
    files: "—",
    nodes: "—",
    relations: "—",
  });

  // Build phase and logs
  type BuildPhase =
    | "idle"
    | "validating"
    | "extracting"
    | "relating"
    | "persisting"
    | "done"
    | "failed";
  const [buildPhase, setBuildPhase] = useState<BuildPhase>("idle");
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const pushBuildLog = (message: string) => {
    setBuildLogs((prev) => [...prev, message]);
  };

  const [isDragging, setIsDragging] = useState(false);
  const [droppedFolderName, setDroppedFolderName] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setBuildProgress((prev) => Math.min(prev + Math.random() * 4, 98));
    }, 350);

    return () => window.clearInterval(timer);
  }, [step, buildDone]);

  const removePattern = (pattern: string) => {
    setIgnoredPatterns((prev) => prev.filter((item) => item !== pattern));
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items.length > 0) e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const items = Array.from(e.dataTransfer.items);
    if (!items.length) return;

    const folderItem =
      items.find((it) => it.webkitGetAsEntry?.()?.isDirectory) ?? items[0];
    const entry = folderItem.webkitGetAsEntry?.();

    if (entry && !entry.isDirectory) {
      toast.error("Please drop a folder, not a file.");
      return;
    }

    const resolved = extractPathFromItem(folderItem);
    if (!resolved) {
      toast.error("Could not read the folder path.");
      return;
    }

    const folderName = entry?.name ?? resolved.split(/[/\\]/).pop() ?? resolved;
    setDroppedFolderName(folderName);
    setCustomPath(resolved);

    const looksAbsolute =
      resolved.startsWith("/") || /^[A-Za-z]:[\\/]/.test(resolved);

    if (!looksAbsolute) {
      toast.warning(
        `Detected folder: "${folderName}". Your browser can't expose the full system path — please confirm or complete the path below.`,
        { duration: 6000 },
      );
    } else {
      toast.success(`Folder set: ${resolved}`);
    }
  };

  const handleBrowseClick = () => fileInputRef.current?.click();

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    const resolved = extractPathFromFileList(files);
    if (!resolved) return;

    const folderName = resolved.split(/[/\\]/).pop() ?? resolved;
    setDroppedFolderName(folderName);
    setCustomPath(resolved);

    const looksAbsolute =
      resolved.startsWith("/") || /^[A-Za-z]:[\\/]/.test(resolved);

    if (!looksAbsolute) {
      toast.warning(
        `Selected: "${folderName}". Browser security limits full path access — please verify or complete the path below.`,
        { duration: 6000 },
      );
    } else {
      toast.success(`Folder set: ${resolved}`);
    }

    e.target.value = "";
  };

  const handleBuild = async () => {
    if (building || buildDone) return;

    try {
      setStep(3);
      setBuilding(true);
      setBuildDone(false);
      setBuildError(null);
      setBuildPhase("validating");
      setBuildLogs([]);
      setBuildProgress(8);
      setBuildStats({ files: "—", nodes: "—", relations: "—" });

      pushBuildLog("Validating repository path and preparing indexing session...");
      saveSession({ baseUrl, lastProjectPath: selectedRepo.path });

      // Simulated phase progression for better UX before backend finishes
      window.setTimeout(() => {
        setBuildPhase("extracting");
        setBuildProgress(28);
        pushBuildLog("Repository validated. Extracting files and entities...");
      }, 500);

      window.setTimeout(() => {
        setBuildPhase("relating");
        setBuildProgress(58);
        pushBuildLog("Entities extracted. Identifying graph relationships...");
      }, 1100);

      const result: IndexRepoResponse = await indexRepo(
        {
          projectPath: selectedRepo.path,
          mode: "full",
          saveDebugJson: true,
          computeHash: true,
        },
        baseUrl,
      );

      const fileCount =
        result?.scanned?.processedFiles ??
        result?.scanned?.totalFiles ??
        null;

      const nodeCount =
        result?.stats?.astNodes ??
        null;

      const edgeCount =
        result?.stats?.edges ??
        null;

      if (fileCount === 0) {
        setBuildPhase("failed");
        setBuildProgress(100);
        setBuildDone(true);
        setBuilding(false);
        setBuildStats({
          files: "0 files",
          nodes: nodeCount != null ? String(nodeCount) : "—",
          relations: edgeCount != null ? String(edgeCount) : "—",
        });

        setBuildError(
          `The backend found 0 source files at:\n"${selectedRepo.path}"\n\nThis usually means the path doesn't exist on the server or has no supported files (.ts, .js, .py, .java, etc.).\n\nGo back and enter the real absolute path to your project on the server machine.`,
        );

        pushBuildLog("Validation failed: no supported source files were found.");
        toast.error("0 files indexed — check your project path");
        return;
      }

      setBuildPhase("persisting");
      setBuildProgress(84);
      pushBuildLog("Relationships identified. Persisting graph to storage...");

      const repoId = result.repoId;

      if (!repoId) {
        setBuildPhase("failed");
        setBuildError("Indexing completed but no repoId was returned. Check the backend logs.");
        setBuildProgress(100);
        setBuildDone(true);
        setBuilding(false);
        pushBuildLog("Build failed: repoId was not returned by the backend.");
        return;
      }

      saveSession({
        baseUrl,
        lastRepoId: repoId,
        lastProjectPath: selectedRepo.path,
      });

      setBuildStats({
        files: fileCount != null ? `${fileCount} files` : "—",
        nodes: nodeCount != null ? `${nodeCount} nodes` : "—",
        relations: edgeCount != null ? `${edgeCount} relationships` : "—",
      });

      setBuildPhase("done");
      setBuildProgress(100);
      setBuildDone(true);
      setBuilding(false);
      pushBuildLog("Graph persisted successfully. Setup is complete.");

      toast.success(`Graph built — ${nodeCount ?? "?"} nodes indexed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Indexing failed — check the backend is running";

      setBuildPhase("failed");
      setBuildDone(true);
      setBuilding(false);
      setBuildProgress(100);
      setBuildError(message);
      pushBuildLog(`Build failed: ${message}`);
      toast.error(message);
    }
  };

  return (
    <main
      className="min-h-[calc(100vh-50px)]"
      style={{
        background: `
          radial-gradient(circle at top right, color-mix(in srgb, var(--teal) 4%, transparent), transparent 28%),
          var(--bg)
        `,
      }}
    >
      <section className="mx-auto max-w-[1120px] px-4 py-4 md:px-6 md:py-8">
        <div
          className="overflow-hidden rounded-[20px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <div className="grid lg:grid-cols-[280px_1fr]">
            <aside
              className="border-b p-4 lg:border-b-0 lg:border-r lg:p-6"
              style={{ borderColor: "var(--border)" }}
            >
            

              <div className="mt-8 space-y-4">
                <ProgressStep
                  stepNumber={1}
                  title="Repository"
                  description="Choose a project folder or paste a path"
                  active={step === 1}
                  done={step > 1}
                  icon={<Folder className="h-3.5 w-3.5" />}
                />
                <ProgressStep
                  stepNumber={2}
                  title="Configure"
                  description="Adjust analysis and extraction settings"
                  active={step === 2}
                  done={step > 2}
                  icon={<Settings2 className="h-4 w-4" />}
                />
                <ProgressStep
                  stepNumber={3}
                  title="Build graph"
                  description="Index entities and relationships"
                  active={step === 3}
                  done={buildDone && !buildError}
                  icon={<Database className="h-4 w-4" />}
                />
              </div>
              <div
                className="mt-8 rounded-[16px] p-4"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
              
                }}
              >
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-4 w-4" style={{ color: "var(--node-folder)" }} />
                  <div className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                    Current selection
                  </div>
                </div>

                <div className="mt-3 text-[13px] font-medium" style={{ color: "var(--text)" }}>
                  {selectedRepo.name}
                </div>

                <div
                  className="mt-1 break-all text-[11px] leading-5"
                  style={{ color: "var(--text3)" }}
                >
                  {selectedRepo.path}
                </div>

                <div
                  className="mt-3 rounded-[12px] px-3 py-2 text-[11px] leading-5"
                  style={{
                    background: "var(--surface2)",
                    color: "var(--text3)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {step === 1 && "Choose a repository source to continue."}
                  {step === 2 && "Review extraction settings before graph creation."}
                  {step === 3 && "The repository is being indexed and validated."}
                </div>
              </div>

              {/* Setup tips card removed for less visual noise */}
            </aside>

            <div className="p-5 md:p-8 lg:p-10">
              {step === 1 && (
                <>
                  <PageHeader
                    eyebrow="Step 01"
                    title="Select repository"
                    description="Drag a folder here, browse for one, or paste its absolute path."
                  />

                  <button
                    type="button"
                    onClick={handleBrowseClick}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="group w-full rounded-[18px] border border-dashed px-6 py-9 text-center transition"
                    style={{
                      borderColor: isDragging ? "var(--node-folder)" : "var(--border2)",
                      background: isDragging
                        ? "color-mix(in srgb, var(--node-folder-bg) 72%, transparent)"
                        : "linear-gradient(180deg, color-mix(in srgb, var(--surface2) 55%, transparent), color-mix(in srgb, var(--surface) 75%, transparent))",
                      transform: isDragging ? "scale(1.01)" : "scale(1)",
                      boxShadow: isDragging
                        ? "0 18px 50px color-mix(in srgb, var(--node-folder) 12%, transparent)"
                        : "none",
                    }}
                  >
                    <div
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px] transition"
                      style={{
                        background: isDragging ? "var(--node-folder)" : "var(--surface)",
                        color: isDragging ? "var(--surface)" : "var(--text)",
                        border: `1px solid ${isDragging ? "var(--node-folder)" : "var(--border)"}`,
                      }}
                    >
                      {isDragging ? (
                        <UploadCloud className="h-7 w-7" />
                      ) : droppedFolderName ? (
                        <FolderOpen className="h-7 w-7" style={{ color: "var(--node-folder)" }} />
                      ) : (
                        <FolderOpen className="h-7 w-7" />
                      )}
                    </div>

                    {isDragging ? (
                      <>
                        <h3
                          className="mt-4 text-[18px] font-semibold"
                          style={{ color: "var(--node-folder)" }}
                        >
                          Release to set folder
                        </h3>
                        <p className="mt-2 text-[13px]" style={{ color: "var(--node-folder)", opacity: 0.82 }}>
                          Drop your project folder here to auto-fill the path
                        </p>
                      </>
                    ) : droppedFolderName ? (
                      <>
                        <h3
                          className="mt-4 text-[18px] font-semibold"
                          style={{ color: "var(--text)" }}
                        >
                          {droppedFolderName}
                        </h3>
                        <p className="mt-2 text-[13px]" style={{ color: "var(--text3)" }}>
                          Folder detected — confirm the path below or choose another location
                        </p>
                      </>
                    ) : (
                      <>
                        <h3
                          className="mt-4 text-[18px] font-semibold"
                          style={{ color: "var(--text)" }}
                        >
                          Drop a folder here
                        </h3>
                        <p className="mt-2 text-[13px]" style={{ color: "var(--text3)" }}>
                          Choose a project folder by dragging it here, browsing, or pasting its absolute path.
                        </p>
                      </>
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    // @ts-expect-error
                    webkitdirectory=""
                    multiple
                    style={{ display: "none" }}
                    onChange={handleFileInputChange}
                  />

                  <section
                    className="mt-6 rounded-[16px] p-5"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[12px] font-medium" style={{ color: "var(--text2)" }}>
                        Project path
                      </label>

                      {droppedFolderName && (
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                          style={{
                            background: "var(--surface2)",
                            color: "var(--node-folder)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          Auto-filled
                        </span>
                      )}
                    </div>

                    <input
                      className="mt-3 w-full rounded-[14px] border px-4 py-3 text-[13px] outline-none transition"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                      }}
                      placeholder="C:/Users/hp/Desktop/CodeAtlas/example_files/simple_js_project"
                      value={customPath}
                      onChange={(e) => {
                        setCustomPath(e.target.value);
                        if (!e.target.value) setDroppedFolderName(null);
                      }}
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <QuickAction
                        label="Use demo repo 1"
                        onClick={() => {
                          setSelectedRepoId("repo-1");
                          setCustomPath("");
                          setDroppedFolderName(null);
                        }}
                      />
                      <QuickAction
                        label="Use demo repo 2"
                        onClick={() => {
                          setSelectedRepoId("repo-2");
                          setCustomPath("");
                          setDroppedFolderName(null);
                        }}
                      />
                      <QuickAction
                        label="Clear path"
                        onClick={() => {
                          setCustomPath("");
                          setDroppedFolderName(null);
                        }}
                      />
                    </div>

                    <p className="mt-3 text-[11px] leading-6" style={{ color: "var(--text3)" }}>
                      Drop or browse above to auto-fill, or paste the backend-accessible absolute path directly.
                    </p>
                  </section>

                  <section className="mt-8">
                    <div
                      className="mb-3 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em]"
                      style={{ color: "var(--text3)" }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Recent repositories
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {demoRepos.map((repo) => {
                        const selected = !customPath.trim() && repo.id === selectedRepoId;

                        return (
                          <button
                            key={repo.id}
                            type="button"
                            onClick={() => {
                              setSelectedRepoId(repo.id);
                              setCustomPath("");
                              setDroppedFolderName(null);
                            }}
                            className="flex w-full items-center gap-4 rounded-[14px] border px-4 py-4 text-left transition"
                            style={{
                              borderColor: selected ? "var(--text)" : "var(--border)",
                              background: selected
                                ? "linear-gradient(180deg, color-mix(in srgb, var(--surface2) 92%, transparent), color-mix(in srgb, var(--surface) 95%, transparent))"
                                : "transparent",
                              boxShadow: selected ? "0 10px 26px rgba(0,0,0,0.06)" : "none",
                            }}
                          >
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                              style={{
                                background: "var(--node-folder-bg)",
                                color: "var(--node-folder)",
                              }}
                            >
                              <Folder className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div
                                className="truncate text-[14px] font-medium"
                                style={{ color: "var(--text)" }}
                              >
                                {repo.name}
                              </div>
                              <div
                                className="truncate text-[11px]"
                                style={{ color: "var(--text3)" }}
                              >
                                {repo.path}
                              </div>
                              <div
                                className="mt-1 text-[11px]"
                                style={{ color: "var(--text3)" }}
                              >
                                {repo.meta}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {selected && (
                                <span
                                  className="hidden rounded-full px-2 py-1 text-[10px] font-medium md:inline-flex"
                                  style={{
                                    background: "color-mix(in srgb, var(--teal) 10%, transparent)",
                                    color: "var(--teal)",
                                  }}
                                >
                                  Selected
                                </span>
                              )}

                              <div
                                className="flex h-6 w-6 items-center justify-center rounded-full border"
                                style={{
                                  borderColor: selected ? "var(--text)" : "var(--border2)",
                                  color: selected ? "var(--text)" : "transparent",
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <WizardFooter
                    step={step}
                    onNext={() => setStep(2)}
                    nextLabel="Continue"
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <PageHeader
                    eyebrow="Step 01"
                    title="Select repository"
                    description="Drag a folder here, browse for one, or paste its absolute path."
                  />

                  <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <ConfigCard
                        title="Excluded directories & files"
                        description="These patterns will be ignored during indexing."
                        icon={<ShieldCheck className="h-4 w-4" />}
                      >
                        <div className="flex flex-wrap gap-2">
                          {ignoredPatterns.map((pattern) => (
                            <div
                              key={pattern}
                              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]"
                              style={{
                                borderColor: "var(--border)",
                                background: "var(--surface2)",
                                color: "var(--text2)",
                              }}
                            >
                              <code>{pattern}</code>
                              <button
                                type="button"
                                onClick={() => removePattern(pattern)}
                                className="text-[14px] leading-none"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() =>
                              toast.info(
                                "Add more patterns by extending ignoredPatterns in the component state.",
                              )
                            }
                            className="rounded-full border border-dashed px-3 py-1.5 text-[12px]"
                            style={{
                              borderColor: "var(--border2)",
                              color: "var(--text2)",
                              background: "var(--surface2)",
                            }}
                          >
                            + Add pattern
                          </button>
                        </div>
                      </ConfigCard>

                      <ConfigCard
                        title="Relationship types"
                        description="Core relations extracted during graph construction."
                        icon={<Wand2 className="h-4 w-4" />}
                      >
                        <div className="flex flex-wrap gap-2">
                          {relationshipTypes.map((type) => (
                            <div
                              key={type}
                              className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                              style={{
                                background: "var(--surface2)",
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
                      </ConfigCard>
                    </div>

                    <div>
                      <ConfigCard
                        title="AI context limit"
                        description="Set the maximum number of nodes included as context."
                        icon={<Sparkles className="h-4 w-4" />}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            className="w-full accent-[var(--text)]"
                            type="range"
                            min={5}
                            max={50}
                            value={aiContextLimit}
                            onChange={(e) => setAiContextLimit(Number(e.target.value))}
                          />
                          <div
                            className="min-w-[76px] rounded-[12px] px-3 py-2 text-center text-[13px] font-semibold"
                            style={{
                              background: "var(--surface2)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {aiContextLimit}
                          </div>
                        </div>
                        <div className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
                          nodes max
                        </div>
                      </ConfigCard>

                      <section
                        className="rounded-[16px] p-5"
                        style={{
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" style={{ color: "var(--purple)" }} />
                          <h3 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                            Configuration summary
                          </h3>
                        </div>

                        <div className="mt-4 space-y-3 text-[12px]">
                          <SummaryRow label="Selected repo" value={selectedRepo.name} />
                          <SummaryRow label="Ignored patterns" value={`${ignoredPatterns.length} patterns`} />
                          <SummaryRow label="Relationship types" value={`${relationshipTypes.length} enabled`} />
                          <SummaryRow label="AI context limit" value={`${aiContextLimit} nodes`} />
                        </div>
                      </section>
                    </div>
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
                  <PageHeader
                    eyebrow="Step 03"
                    title="Build graph"
                    description="CodeAtlas is validating the repository and indexing its structure."
                  />

                  <div
                    className="rounded-[16px] p-5"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                          style={{
                            background: "var(--node-folder-bg)",
                            color: "var(--node-folder)",
                          }}
                        >
                          <Folder className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div
                            className="truncate text-[15px] font-medium"
                            style={{ color: "var(--text)" }}
                          >
                            {selectedRepo.name}
                          </div>
                          <div
                            className="truncate text-[12px]"
                            style={{ color: "var(--text3)" }}
                          >
                            {selectedRepo.path}
                          </div>
                        </div>
                      </div>

                      <div
                        className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium"
                        style={{
                          background: buildError
                            ? "var(--red-l)"
                            : buildDone
                              ? "var(--teal-l)"
                              : "color-mix(in srgb, var(--surface2) 70%, transparent)",
                          color: buildError
                            ? "var(--red)"
                            : buildDone
                              ? "var(--teal)"
                              : "var(--text2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {buildError ? "Build failed" : buildDone ? "Build completed" : "Indexing in progress"}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div
                        className="mb-2 flex items-center justify-between text-[11px]"
                        style={{ color: "var(--text3)" }}
                      >
                        <span>Build progress</span>
                        <span>{Math.round(buildProgress)}%</span>
                      </div>

                      <div
                        className="h-[9px] overflow-hidden rounded-full"
                        style={{ background: "var(--surface)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${buildProgress}%`,
                            background: buildError
                              ? "linear-gradient(90deg, var(--red), var(--red-b))"
                              : "linear-gradient(90deg, var(--text), var(--teal))",
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <MiniStat label="Files" value={buildStats.files} />
                      <MiniStat label="Nodes" value={buildStats.nodes} />
                      <MiniStat label="Relations" value={buildStats.relations} />
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <BuildRow
                      done={
                        buildPhase === "extracting" ||
                        buildPhase === "relating" ||
                        buildPhase === "persisting" ||
                        buildPhase === "done"
                      }
                      active={buildPhase === "validating"}
                      failed={buildPhase === "failed" && buildStats.files === "0 files"}
                      label="Validating repository"
                      sub="Checking project path and supported source files"
                      count={buildStats.files !== "—" ? buildStats.files : buildPhase === "validating" ? "Running..." : undefined}
                    />

                    <BuildRow
                      done={
                        buildPhase === "relating" ||
                        buildPhase === "persisting" ||
                        buildPhase === "done"
                      }
                      active={buildPhase === "extracting"}
                      label="Extracting entities"
                      sub="Folders, files, classes, and functions"
                      count={
                        buildStats.nodes !== "—"
                          ? buildStats.nodes
                          : buildPhase === "extracting"
                            ? "Running..."
                            : undefined
                      }
                    />

                    <BuildRow
                      done={buildPhase === "persisting" || buildPhase === "done"}
                      active={buildPhase === "relating"}
                      label="Identifying relationships"
                      sub="CONTAINS · IMPORTS · CALLS"
                      count={
                        buildStats.relations !== "—"
                          ? buildStats.relations
                          : buildPhase === "relating"
                            ? "Running..."
                            : undefined
                      }
                    />

                    <BuildRow
                      done={buildPhase === "done"}
                      active={buildPhase === "persisting"}
                      failed={buildPhase === "failed" && buildStats.files !== "0 files"}
                      label="Persisting graph"
                      sub="Saving repoId into session storage"
                      count={buildPhase === "persisting" ? "Running..." : buildPhase === "done" ? "Completed" : undefined}
                    />
                  </div>

                  <div
                    className="mt-6 rounded-[14px] p-4"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em]"
                      style={{ color: "var(--text3)" }}
                    >
                      Live activity
                    </div>

                    <div className="space-y-2">
                      {buildLogs.length === 0 ? (
                        <div className="text-[12px]" style={{ color: "var(--text3)" }}>
                          Waiting to start…
                        </div>
                      ) : (
                        buildLogs.map((log, index) => (
                          <div
                            key={index}
                            className="rounded-[12px] px-3 py-2 text-[12px]"
                            style={{
                              background: "color-mix(in srgb, var(--surface) 70%, transparent)",
                              color: "var(--text2)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {buildError && (
                    <div
                      className="mt-5 rounded-[14px] p-5 text-[12px] leading-6"
                      style={{
                        background: "var(--red-l)",
                        border: "1px solid var(--red-b)",
                        color: "var(--red)" ,
                      }}
                    >
                      <div className="mb-2 text-[13px] font-semibold">
                        Indexing did not complete
                      </div>
                      <pre className="whitespace-pre-wrap font-sans">{buildError}</pre>
                    </div>
                  )}

                  <div
                    className="mt-8 flex flex-col gap-3 border-t pt-6 md:flex-row md:items-center md:justify-between"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                      {buildError ? "Fix the project path and retry" : "Open the graph when indexing is ready"}
                    </span>

                    <div className="flex flex-wrap items-center gap-3">
                      {buildError ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStep(1);
                            setBuildError(null);
                            setBuildDone(false);
                            setBuildProgress(0);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium"
                          style={{
                            background: "var(--text)",
                            color: "var(--surface)",
                          }}
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Fix project path
                        </button>
                      ) : (
                        <>
                          <Link
                            to="/graph"
                            className="rounded-xl border px-4 py-2.5 text-[12px] font-medium"
                            style={{
                              borderColor: "var(--border2)",
                              color: "var(--text)",
                            }}
                          >
                            Open existing graph
                          </Link>
                          <button
                            type="button"
                            onClick={() => navigate({ to: "/graph" })}
                            disabled={!buildDone}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium disabled:opacity-40"
                            style={{
                              background: "var(--text)",
                              color: "var(--surface)",
                            }}
                          >
                            Open Explorer
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{
          color: "var(--teal)",
          background: "color-mix(in srgb, var(--teal) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--teal) 14%, transparent)",
        }}
      >
        {eyebrow}
      </div>

      <h2
        className="mt-4 text-[28px] font-semibold tracking-[-0.05em]"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>

      <p className="mt-2 max-w-2xl text-[13px] leading-7" style={{ color: "var(--text2)" }}>
        {description}
      </p>
    </div>
  );
}

function ConfigCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-5 rounded-[16px] p-5"
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h3>
      </div>

      <p className="mt-1 text-[12px] leading-6" style={{ color: "var(--text3)" }}>
        {description}
      </p>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProgressStep({
  stepNumber,
  title,
  description,
  active,
  done,
  icon,
}: {
  stepNumber: number;
  title: string;
  description: string;
  active: boolean;
  done: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[18px] p-4 transition"
      style={{
        background: active
          ? "color-mix(in srgb, var(--purple) 7%, transparent)"
          : "color-mix(in srgb, var(--surface2) 45%, transparent)",
        border: `1px solid ${
          active ? "color-mix(in srgb, var(--purple) 18%, transparent)" : "var(--border)"
        }`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: done || active ? "var(--text)" : "var(--surface)",
            color: done || active ? "var(--surface)" : "var(--text2)",
            border: done || active ? "none" : "1px solid var(--border)",
            boxShadow: active ? "0 10px 24px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {done ? <Check className="h-4 w-4" /> : icon}
        </div>

        <div className="min-w-0">
          <span
            className="text-[11px] font-medium uppercase tracking-[0.12em]"
            style={{ color: active ? "var(--purple)" : "var(--text3)" }}
          >
            Step {stepNumber}
          </span>

          <div className="mt-1 text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            {title}
          </div>

          <div className="mt-1 text-[12px] leading-6" style={{ color: "var(--text3)" }}>
            {description}
          </div>
        </div>
      </div>
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
    <div
      className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-medium"
            style={{
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        ) : (
          <div className="flex gap-2">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className="h-[7px] w-[7px] rounded-full"
                style={{
                  background: dot === step ? "var(--text)" : "var(--border2)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium"
        style={{
          background: "var(--text)",
          color: "var(--surface)",
        }}
      >
        {nextLabel}
        <ArrowRight className="h-3.5 w-3.5" />
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
  failed = false,
}: {
  label: string;
  sub: string;
  count?: string;
  done?: boolean;
  active?: boolean;
  failed?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-[12px] p-4"
      style={{
        background: active ? "var(--surface2)" : "var(--surface)",
        border: active
          ? "1px solid color-mix(in srgb, var(--teal) 20%, transparent)"
          : "1px solid var(--border)",
      }}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border ${
          active ? "codeatlas-progress-pulse" : ""
        }`}
        style={{
          borderColor: failed
            ? "var(--red-b)"
            : done
              ? "var(--teal-b)"
              : active
                ? "var(--text)"
                : "var(--border2)",
          background: failed
            ? "var(--red-l)"
            : done
              ? "var(--teal-l)"
              : active
                ? "color-mix(in srgb, var(--text) 8%, transparent)"
                : "transparent",
          color: failed
            ? "var(--red)"
            : done
              ? "var(--teal)"
              : active
                ? "var(--text)"
                : "var(--text3)",
        }}
      >
        {failed ? (
          <span style={{ fontSize: 14 }}>✕</span>
        ) : done ? (
          <Check className="h-4 w-4" />
        ) : active ? (
          <span
            className="h-2.5 w-2.5 rounded-full codeatlas-progress-pulse"
            style={{ background: "currentColor" }}
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium" style={{ color: "var(--text)" }}>
          {label}
        </div>
        <div className="mt-1 text-[12px] leading-6" style={{ color: "var(--text3)" }}>
          {sub}
        </div>
      </div>

      {count ? (
        <div
          className="text-[11px] font-medium"
          style={{
            color: failed || count === "0 files" ? "var(--red)" : "var(--teal)",
          }}
        >
          {count}
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] px-3 py-2"
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
      }}
    >
      <span className="text-[11px]" style={{ color: "var(--text3)" }}>
        {label}
      </span>
      <span className="text-[11px] font-medium" style={{ color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition"
      style={{
        borderColor: "var(--border)",
        color: "var(--text2)",
        background: "var(--surface2)",
      }}
    >
      {label}
      <ChevronRight className="h-3 w-3" />
    </button>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-[12px] px-4 py-3"
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="text-[11px]" style={{ color: "var(--text3)" }}>
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
