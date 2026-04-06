import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";

export type ServerStatus = "stopped" | "starting" | "running" | "error";

export interface ServerState {
  status: ServerStatus;
  port: number;
  url: string;
  pid?: number;
  error?: string;
  repoId?: string;
}

type StatusListener = (state: ServerState) => void;

/** Finds a free TCP port by binding to :0 and releasing. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Locates `apps/server` relative to a workspace root. */
function findServerDir(workspaceRoot: string): string | null {
  const candidates = [
    path.join(workspaceRoot, "apps", "server"),
    path.join(workspaceRoot, "..", "server"),
    path.join(workspaceRoot, "..", "apps", "server"),
    path.join(workspaceRoot, "..", "..", "apps", "server"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "package.json"))) return c;
  }
  return null;
}

/** Returns the path to tsx / node runner for the server. */
function resolveRunner(serverDir: string): { cmd: string; args: string[] } {
  // Prefer local tsx if available
  const tsxLocal = path.join(serverDir, "node_modules", ".bin", "tsx");
  const tsxLocalCmd = process.platform === "win32" ? `${tsxLocal}.CMD` : tsxLocal;

  if (fs.existsSync(tsxLocalCmd) || fs.existsSync(tsxLocal)) {
    return { cmd: tsxLocalCmd.replace(".CMD", ""), args: ["watch", "src/index.ts"] };
  }

  // Fall back to pnpm/npm run dev
  const pm = fs.existsSync(path.join(serverDir, "..", "..", "pnpm-lock.yaml")) ? "pnpm" : "npm";
  return { cmd: pm, args: ["run", "dev"] };
}

export class ServerManager implements vscode.Disposable {
  private _proc: cp.ChildProcess | null = null;
  private _state: ServerState = { status: "stopped", port: 0, url: "" };
  private _listeners: StatusListener[] = [];
  private _output: vscode.OutputChannel;
  private _startupTimer: NodeJS.Timeout | null = null;
  private _workspaceRoot: string;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._output = vscode.window.createOutputChannel("CodeAtlas Server");
    _context.subscriptions.push(this._output);

    this._workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get state(): ServerState {
    return { ...this._state };
  }

  onStatusChange(listener: StatusListener): vscode.Disposable {
    this._listeners.push(listener);
    return new vscode.Disposable(() => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    });
  }

  /** Start the server. If already running, resolves immediately. */
  async start(): Promise<void> {
    if (this._state.status === "running") return;
    if (this._state.status === "starting") {
      return new Promise((resolve) => {
        const unsub = this.onStatusChange((s) => {
          if (s.status === "running" || s.status === "error") {
            unsub.dispose();
            resolve();
          }
        });
      });
    }

    this._output.show(true);
    this._output.appendLine("[CodeAtlas] Starting backend server…");

    const serverDir = findServerDir(this._workspaceRoot);
    if (!serverDir) {
      this._setState({
        status: "error",
        port: 0,
        url: "",
        error:
          "Could not locate apps/server directory. Open the CodeAtlas workspace root in VS Code.",
      });
      vscode.window.showErrorMessage(
        "CodeAtlas: Cannot find apps/server directory. Open the CodeAtlas project root as your workspace."
      );
      return;
    }

    this._output.appendLine(`[CodeAtlas] Server dir: ${serverDir}`);

    // Check for .env and required vars
    const envPath = path.join(serverDir, ".env");
    const envOk = this._checkEnv(envPath);
    if (!envOk) return;

    const port = await findFreePort();
    const { cmd, args } = resolveRunner(serverDir);

    this._output.appendLine(`[CodeAtlas] Runner: ${cmd} ${args.join(" ")}`);
    this._output.appendLine(`[CodeAtlas] Port: ${port}`);

    this._setState({ status: "starting", port, url: `http://127.0.0.1:${port}` });

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(port),
      CORS_ORIGIN: "*", // ← allow VS Code webview origin
    };

    // Inherit OPENROUTER_API_KEY / NEO4J_* from workspace .env if set
    try {
      const raw = fs.readFileSync(envPath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && m[1] && m[2] && !env[m[1]]) {
          env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // .env read failed — that's OK
    }

    const opts: cp.SpawnOptions = {
      cwd: serverDir,
      env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    };

    try {
      this._proc = cp.spawn(cmd, args, opts);
    } catch (err: any) {
      this._setState({
        status: "error",
        port,
        url: "",
        error: `Failed to spawn server: ${err?.message ?? String(err)}`,
      });
      return;
    }

    this._proc.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString();
      this._output.append(line);

      // Detect ready signal: "Server is running on http://localhost:PORT"
      const m = line.match(/running on http[s]?:\/\/[^:]+:(\d+)/i);
      if (m) {
        const actualPort = parseInt(m[1], 10) || port;
        const url = `http://127.0.0.1:${actualPort}`;
        this._output.appendLine(`[CodeAtlas] ✓ Server ready at ${url}`);
        if (this._startupTimer) { clearTimeout(this._startupTimer); this._startupTimer = null; }
        this._setState({ status: "running", port: actualPort, url, pid: this._proc?.pid });
      }
    });

    this._proc.stderr?.on("data", (chunk: Buffer) => {
      this._output.append(chunk.toString());
    });

    this._proc.on("exit", (code, signal) => {
      this._output.appendLine(
        `[CodeAtlas] Server process exited (code=${code ?? "—"} signal=${signal ?? "—"})`
      );
      if (this._state.status !== "stopped") {
        this._setState({ status: "error", port, url: "", error: `Server exited with code ${code}` });
      }
      this._proc = null;
    });

    this._proc.on("error", (err) => {
      this._output.appendLine(`[CodeAtlas] Server spawn error: ${err.message}`);
      this._setState({ status: "error", port, url: "", error: err.message });
    });

    // Timeout if server doesn't become ready in 60 s
    this._startupTimer = setTimeout(() => {
      if (this._state.status === "starting") {
        this._output.appendLine("[CodeAtlas] ⚠ Startup timeout (60 s) — server may still be booting");
        // Don't error out — just bump to running optimistically
        this._setState({ status: "running", port, url: `http://127.0.0.1:${port}`, pid: this._proc?.pid });
      }
    }, 60_000);
  }

  stop(): void {
    if (this._startupTimer) { clearTimeout(this._startupTimer); this._startupTimer = null; }
    if (!this._proc) { this._setState({ status: "stopped", port: 0, url: "" }); return; }

    this._output.appendLine("[CodeAtlas] Stopping server…");
    this._setState({ status: "stopped", port: 0, url: "" });

    try {
      if (process.platform === "win32") {
        cp.spawn("taskkill", ["/pid", String(this._proc.pid), "/f", "/t"], { shell: true });
      } else {
        this._proc.kill("SIGTERM");
      }
    } catch {
      // ignore
    }
    this._proc = null;
  }

  async restart(): Promise<void> {
    this.stop();
    await new Promise<void>((r) => setTimeout(r, 800));
    await this.start();
  }

  /** Show the output channel. */
  showLog(): void {
    this._output.show();
  }

  dispose(): void {
    this.stop();
    this._output.dispose();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _setState(patch: Partial<ServerState>): void {
    this._state = { ...this._state, ...patch };
    for (const l of this._listeners) {
      try { l(this._state); } catch { /* ignore */ }
    }
  }

  private _checkEnv(envPath: string): boolean {
    if (!fs.existsSync(envPath)) {
      vscode.window
        .showWarningMessage(
          "CodeAtlas: No .env found in apps/server. The server needs NEO4J_* and OPENROUTER_API_KEY.",
          "Open Docs"
        )
        .then((choice) => {
          if (choice === "Open Docs") {
            vscode.env.openExternal(vscode.Uri.parse("https://github.com/codeatlas/codeatlas"));
          }
        });
      // Still attempt to start — env vars might be set system-wide
      return true;
    }

    let raw = "";
    try { raw = fs.readFileSync(envPath, "utf8"); } catch { return true; }

    const missing: string[] = [];
    for (const key of ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "OPENROUTER_API_KEY"]) {
      const m = raw.match(new RegExp(`^${key}=(.+)$`, "m"));
      if (!m || !m[1]?.trim()) missing.push(key);
    }

    if (missing.length > 0) {
      vscode.window
        .showWarningMessage(
          `CodeAtlas: Missing env vars in apps/server/.env: ${missing.join(", ")}`,
          "Open .env",
          "Continue anyway"
        )
        .then((choice) => {
          if (choice === "Open .env") {
            vscode.workspace.openTextDocument(envPath).then((doc) =>
              vscode.window.showTextDocument(doc)
            );
          }
        });
    }

    return true;
  }
}