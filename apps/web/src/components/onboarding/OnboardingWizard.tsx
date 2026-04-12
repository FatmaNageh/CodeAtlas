import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
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

/**
 * Attempt to extract an absolute path from a dropped DataTransferItem.
 *
 * Strategy (in priority order):
 *  1. Electron exposes `file.path` — an absolute OS path.
 *  2. webkitGetAsEntry().fullPath — browsers give a virtual root-relative path
 *     like "/my-project". Not a real OS path, but it is the folder name.
 *  3. File.name — last resort.
 */
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

  const first = files[0] as File & { path?: string };

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
        `Detected folder: "${folderName}". Your browser can't expose the full system path — please confirm or complete the path in the field below.`,
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
      setBuildStats({ files: "—", nodes: "—", relations: "—" });

      saveSession({ baseUrl, lastProjectPath: selectedRepo.path });

      const result = await indexRepo(
        { projectPath: selectedRepo.path, mode: "full", saveDebugJson: true, computeHash: true },
        baseUrl,
      );

      const fileCount =
        result?.scanned?.processedFiles ?? result?.scanned?.totalFiles ?? result?.files ?? null;
      const nodeCount =
        result?.graph?.nodes ?? result?.metrics?.nodes ?? result?.nodes ?? null;
      const edgeCount =
        result?.graph?.edges ?? result?.metrics?.edges ?? result?.edges ?? null;

      if (fileCount === 0 || fileCount === "0") {
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
        toast.error("0 files indexed — check your project path");
        return;
      }

      const repoId = result?.repoId ?? result?.repo?.id ?? "";

      if (!repoId) {
        setBuildError("Indexing completed but no repoId was returned. Check the backend logs.");
        setBuildProgress(100);
        setBuildDone(true);
        setBuilding(false);
        return;
      }

      saveSession({ baseUrl, lastRepoId: repoId, lastProjectPath: selectedRepo.path });
      setBuildProgress(100);
      setBuildDone(true);
      setBuilding(false);
      setBuildStats({
        files: fileCount != null ? `${fileCount} files` : "—",
        nodes: nodeCount != null ? `${nodeCount} nodes` : "—",
        relations: edgeCount != null ? `${edgeCount} relationships` : "—",
      });

      toast.success(`Graph built — ${nodeCount ?? "?"} nodes indexed`);
    } catch (error) {
      setBuildDone(true);
      setBuilding(false);
      setBuildProgress(100);
      const message =
        error instanceof Error ? error.message : "Indexing failed — check the backend is running";
      setBuildError(message);
      toast.error(message);
    }
  };

  return (
    <main
      className="min-h-[calc(100vh-50px)]"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--purple) 10%, transparent), transparent 35%), var(--bg)",
      }}
    >
      <section className="mx-auto max-w-[1280px] px-6 py-10">
        <div
          className="overflow-hidden rounded-[28px]"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface) 100%, transparent))",
            border: "1px solid var(--border)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.10)",
          }}
        >
          <div className="grid lg:grid-cols-[320px_1fr]">
            <aside
              className="border-b p-6 lg:border-b-0 lg:border-r lg:p-8"
              style={{ borderColor: "var(--border)" }}
            >
        

             
            
              <div className="mt-8 space-y-4">
                <ProgressStep
                  stepNumber={1}
                  title="Repository"
                  description="Choose a project folder or paste a path"
                  active={step === 1}
                  done={step > 1}
                  icon={<Folder className="h-3 w-3" />}
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
                className="mt-8 rounded-[20px] p-4"
                style={{
                  background: "color-mix(in srgb, var(--surface2) 60%, transparent)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                  Current selection
                </div>
                <div
                  className="mt-2 text-[12px] leading-6"
                  style={{ color: "var(--text3)" }}
                >
                  {selectedRepo.name}
                </div>
                <div
                  className="mt-1 break-all text-[11px] leading-5"
                  style={{ color: "var(--text3)" }}
                >
                  {selectedRepo.path}
                </div>
              </div>
            </aside>

            <div className="p-6 md:p-8 lg:p-10">
              {step === 1 && (
                <>
                  <PageHeader
                    title="Select a repository"
                    description="Drop a folder, browse your file system, or paste an absolute path to begin analysis."
                  />

                  <button
                    type="button"
                    onClick={handleBrowseClick}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="w-full rounded-[24px] border border-dashed px-6 py-12 text-center transition"
                    style={{
                      borderColor: isDragging ? "var(--node-folder)" : "var(--border2)",
                      background: isDragging
                        ? "color-mix(in srgb, var(--node-folder-bg) 70%, transparent)"
                        : "color-mix(in srgb, var(--surface2) 55%, transparent)",
                      transform: isDragging ? "scale(1.01)" : "scale(1)",
                    }}
                  >
                    <div
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{
                        background: isDragging ? "var(--node-folder)" : "var(--surface)",
                        color: isDragging ? "var(--surface)" : "var(--text)",
                        border: `1px solid ${isDragging ? "var(--node-folder)" : "var(--border)"}`,
                      }}
                    >
                      {isDragging ? (
                        <UploadCloud className="h-6 w-6" />
                      ) : droppedFolderName ? (
                        <FolderOpen className="h-6 w-6" style={{ color: "var(--node-folder)" }} />
                      ) : (
                        <FolderOpen className="h-6 w-6" />
                      )}
                    </div>

                    {isDragging ? (
                      <>
                        <h3
                          className="mt-5 text-[18px] font-semibold"
                          style={{ color: "var(--node-folder)" }}
                        >
                          Release to set folder
                        </h3>
                        <p
                          className="mt-2 text-[13px]"
                          style={{ color: "var(--node-folder)", opacity: 0.8 }}
                        >
                          Drop your project folder here
                        </p>
                      </>
                    ) : droppedFolderName ? (
                      <>
                        <h3
                          className="mt-5 text-[18px] font-semibold"
                          style={{ color: "var(--text)" }}
                        >
                          {droppedFolderName}
                        </h3>
                        <p className="mt-2 text-[13px]" style={{ color: "var(--text3)" }}>
                          Folder detected — confirm the path below or choose another
                        </p>
                      </>
                    ) : (
                      <>
                        <h3
                          className="mt-5 text-[18px] font-semibold"
                          style={{ color: "var(--text)" }}
                        >
                          Drop a folder here
                        </h3>
                        <p className="mt-2 text-[13px]" style={{ color: "var(--text3)" }}>
                          or click to browse your file system
                        </p>
                      </>
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    // @ts-expect-error — webkitdirectory is non-standard
                    webkitdirectory=""
                    multiple
                    style={{ display: "none" }}
                    onChange={handleFileInputChange}
                  />

                  <section
                    className="mt-6 rounded-[22px] p-5"
                    style={{
                      background: "color-mix(in srgb, var(--surface2) 55%, transparent)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label
                        className="text-[12px] font-medium"
                        style={{ color: "var(--text2)" }}
                      >
                        Project path
                      </label>

                      {droppedFolderName && (
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                          style={{
                            background: "var(--node-folder-bg)",
                            color: "var(--node-folder)",
                            border: "1px solid color-mix(in srgb, var(--node-folder) 15%, transparent)",
                          }}
                        >
                          Auto-filled
                        </span>
                      )}
                    </div>

                    <input
                      className="mt-3 w-full rounded-[12px] border px-4 py-3 text-[13px] outline-none transition"
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

                    <p className="mt-3 text-[11px] leading-6" style={{ color: "var(--text3)" }}>
                      Drop or browse above to auto-fill, or paste the backend-accessible absolute path directly.
                    </p>
                  </section>

                  <section className="mt-8">
                    <div
                      className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em]"
                      style={{ color: "var(--text3)" }}
                    >
                      Recent repositories
                    </div>

                    <div className="space-y-3">
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
                            className="flex w-full items-center gap-4 rounded-[18px] border px-4 py-4 text-left transition"
                            style={{
                              borderColor: selected ? "var(--text)" : "var(--border)",
                              background: selected
                                ? "color-mix(in srgb, var(--surface2) 90%, transparent)"
                                : "transparent",
                            }}
                          >
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-xl"
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

                            <div
                              className="flex h-6 w-6 items-center justify-center rounded-full border"
                              style={{
                                borderColor: selected ? "var(--text)" : "var(--border2)",
                                color: selected ? "var(--text)" : "transparent",
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
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
                    title="Configure analysis"
                    description="Adjust what CodeAtlas includes or ignores while building the knowledge graph."
                  />

                  <ConfigCard
                    title="Excluded directories & files"
                    description="These patterns will be ignored during indexing."
                  >
                    <div className="flex flex-wrap gap-2">
                      {ignoredPatterns.map((pattern) => (
                        <div
                          key={pattern}
                          className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]"
                          style={{
                            borderColor: "var(--border)",
                            background: "color-mix(in srgb, var(--surface) 96%, transparent)",
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
                        }}
                      >
                        + Add pattern
                      </button>
                    </div>
                  </ConfigCard>

                  <ConfigCard
                    title="Relationship types"
                    description="Core relations extracted during graph construction."
                  >
                    <div className="flex flex-wrap gap-2">
                      {relationshipTypes.map((type) => (
                        <div
                          key={type}
                          className="rounded-full px-3 py-1.5 text-[12px] font-medium"
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
                  </ConfigCard>

                  <ConfigCard
                    title="AI context limit"
                    description="Set the maximum number of nodes included as context."
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
                        className="min-w-[72px] rounded-xl px-3 py-2 text-center text-[13px] font-semibold"
                        style={{
                          background: "var(--surface)",
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
                    title="Building knowledge graph"
                    description="CodeAtlas is validating the repository, extracting entities, and identifying relationships."
                  />

                  <div
                    className="rounded-[22px] p-5"
                    style={{
                      background: "color-mix(in srgb, var(--surface2) 55%, transparent)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl"
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

                    <div className="mt-6">
                      <div
                        className="mb-2 flex items-center justify-between text-[11px]"
                        style={{ color: "var(--text3)" }}
                      >
                        <span>Build progress</span>
                        <span>{Math.round(buildProgress)}%</span>
                      </div>

                      <div
                        className="h-[8px] overflow-hidden rounded-full"
                        style={{ background: "var(--surface)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${buildProgress}%`,
                            background: "linear-gradient(90deg, var(--text), var(--teal))",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <BuildRow
                      done={buildDone && !buildError}
                      failed={buildError != null && buildStats.files === "0 files"}
                      label="Validating repository"
                      sub="Found supported source files"
                      count={buildStats.files !== "—" ? buildStats.files : undefined}
                    />
                    <BuildRow
                      done={buildDone && !buildError}
                      label="Extracting entities"
                      sub="Folders, files, classes, and functions"
                      count={buildStats.nodes !== "—" ? buildStats.nodes : undefined}
                    />
                    <BuildRow
                      active={!buildDone}
                      done={buildDone && !buildError}
                      label="Identifying relationships"
                      sub="CONTAINS · IMPORTS · CALLS"
                      count={
                        buildDone
                          ? buildStats.relations !== "—"
                            ? buildStats.relations
                            : undefined
                          : "Building…"
                      }
                    />
                    <BuildRow
                      done={buildDone && !buildError}
                      label="Persisting graph"
                      sub="Saving repoId into session storage"
                    />
                  </div>

                  {buildError && (
                    <div
                      className="mt-5 rounded-[18px] p-5 text-[12px] leading-6"
                      style={{
                        background: "var(--red-l)",
                        border: "1px solid var(--red-b)",
                        color: "var(--red)",
                      }}
                    >
                      <div className="mb-2 text-[13px] font-semibold">
                        Indexing did not complete
                      </div>
                      <pre className="whitespace-pre-wrap font-sans">{buildError}</pre>
                    </div>
                  )}

                  <div
                    className="mt-8 flex items-center justify-between border-t pt-6"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                      {buildError ? "Fix the project path and retry" : "Build in progress"}
                    </span>

                    <div className="flex items-center gap-3">
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
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h2
        className="text-[26px] font-semibold tracking-[-0.04em]"
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
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-5 rounded-[22px] p-5"
      style={{
        background: "color-mix(in srgb, var(--surface2) 50%, transparent)",
        border: "1px solid var(--border)",
      }}
    >
      <h3 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </h3>
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
      className="rounded-[18px] p-4"
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
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: done || active ? "var(--text)" : "var(--surface)",
            color: done || active ? "var(--surface)" : "var(--text2)",
            border: done || active ? "none" : "1px solid var(--border)",
          }}
        >
          {done ? <Check className="h-4 w-4" /> : icon}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: active ? "var(--purple)" : "var(--text3)" }}
            >
              Step {stepNumber}
            </span>
          </div>
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
      className="mt-8 flex items-center justify-between border-t pt-6"
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
      className="flex items-start gap-4 rounded-[18px] p-4"
      style={{
        background: "color-mix(in srgb, var(--surface2) 45%, transparent)",
        border: "1px solid var(--border)",
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