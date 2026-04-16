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
}

type StatusListener = (state: ServerState) => void;

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

function findServerDir(workspaceRoot: string): string | null {
  const candidates = [
    path.join(workspaceRoot, "apps", "server"),
    path.join(workspaceRoot, "server"),
    path.join(workspaceRoot, "..", "server"),
    path.join(workspaceRoot, "..", "apps", "server"),
    path.join(workspaceRoot, "..", "..", "apps", "server"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "package.json"))) return path.resolve(c);
  }
  return null;
}

function resolveRunner(serverDir: string): { cmd: string; args: string[] } {
  const tsxLocal = path.join(serverDir, "node_modules", ".bin", "tsx");
  const tsxCmd   = process.platform === "win32" ? `${tsxLocal}.CMD` : tsxLocal;
  if (fs.existsSync(tsxCmd) || fs.existsSync(tsxLocal)) {
    return { cmd: tsxCmd, args: ["watch", "src/index.ts"] };
  }
  const pm = fs.existsSync(path.join(serverDir, "..", "..", "pnpm-lock.yaml")) ? "pnpm" : "npm";
  return { cmd: pm, args: ["run", "dev"] };
}

/** Parse a .env file into key→value pairs, supporting quoted values and comments. */
function parseEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export class ServerManager implements vscode.Disposable {
  private _proc: cp.ChildProcess | null = null;
  private _state: ServerState = { status: "stopped", port: 0, url: "" };
  private _listeners: StatusListener[] = [];
  private _output: vscode.OutputChannel;
  private _startupTimer: ReturnType<typeof setTimeout> | null = null;
  private _workspaceRoot: string;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._output = vscode.window.createOutputChannel("CodeAtlas Server");
    _context.subscriptions.push(this._output);
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  }

  get state(): ServerState {
    return { ...this._state };
  }

  onStatusChange(listener: StatusListener): vscode.Disposable {
    this._listeners.push(listener);
    return new vscode.Disposable(() => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    });
  }

  async start(): Promise<void> {
    if (this._state.status === "running") return;
    if (this._state.status === "starting") {
      return new Promise((resolve) => {
        const unsub = this.onStatusChange((s) => {
          if (s.status === "running" || s.status === "error") { unsub.dispose(); resolve(); }
        });
      });
    }

    this._output.show(true);
    this._output.appendLine("[CodeAtlas] Starting backend server…");

    const serverDir = findServerDir(this._workspaceRoot);
    if (!serverDir) {
      this._setState({
        status: "error", port: 0, url: "",
        error: "Could not locate apps/server directory. Open the CodeAtlas workspace root in VS Code.",
      });
      vscode.window
        .showErrorMessage("CodeAtlas: Cannot find apps/server. Open the CodeAtlas project root as your workspace.", "Open Docs")
        .then((c) => { if (c === "Open Docs") vscode.env.openExternal(vscode.Uri.parse("https://github.com/codeatlas/codeatlas")); });
      return;
    }

    this._output.appendLine(`[CodeAtlas] Server dir: ${serverDir}`);

    const envPath = path.join(serverDir, ".env");
    this._checkEnv(envPath);

    const port = await findFreePort();
    const { cmd, args } = resolveRunner(serverDir);
    this._output.appendLine(`[CodeAtlas] Runner: ${cmd} ${args.join(" ")}`);
    this._output.appendLine(`[CodeAtlas] Port: ${port}`);

    this._setState({ status: "starting", port, url: `http://127.0.0.1:${port}` });

    // Build env: start from process env, overlay .env file, then force PORT
    const env: NodeJS.ProcessEnv = { ...process.env };
    try {
      const raw = fs.readFileSync(envPath, "utf8");
      const parsed = parseEnv(raw);
      for (const [k, v] of Object.entries(parsed)) {
        if (!env[k]) env[k] = v;   // don't overwrite system env vars
      }
    } catch { /* .env absent — OK */ }

    env["PORT"]        = String(port);
    env["CORS_ORIGIN"] = "*";

    const opts: cp.SpawnOptions = {
      cwd: serverDir,
      env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    };

    try {
      this._proc = cp.spawn(cmd, args, opts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._setState({ status: "error", port, url: "", error: `Failed to spawn server: ${msg}` });
      return;
    }

    this._proc.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString();
      this._output.append(line);
      // Detect "Server is running on http://…:PORT"
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
      this._output.appendLine(`[CodeAtlas] Server process exited (code=${code ?? "—"} signal=${signal ?? "—"})`);
      if (this._state.status !== "stopped") {
        this._setState({ status: "error", port, url: "", error: `Server exited with code ${code}` });
      }
      this._proc = null;
    });

    this._proc.on("error", (err) => {
      this._output.appendLine(`[CodeAtlas] Spawn error: ${err.message}`);
      this._setState({ status: "error", port, url: "", error: err.message });
    });

    // 60 s optimistic timeout
    this._startupTimer = setTimeout(() => {
      if (this._state.status === "starting") {
        this._output.appendLine("[CodeAtlas] ⚠ Startup timeout (60 s) — marking as running optimistically");
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
    } catch { /* ignore */ }
    this._proc = null;
  }

  async restart(): Promise<void> {
    this.stop();
    await new Promise<void>((r) => setTimeout(r, 800));
    await this.start();
  }

  showLog(): void { this._output.show(); }

  dispose(): void { this.stop(); this._output.dispose(); }

  private _setState(patch: Partial<ServerState>): void {
    this._state = { ...this._state, ...patch };
    for (const l of this._listeners) {
      try { l(this._state); } catch { /* ignore */ }
    }
  }

  private _checkEnv(envPath: string): void {
    if (!fs.existsSync(envPath)) {
      vscode.window
        .showWarningMessage("CodeAtlas: No .env found in apps/server. The server needs NEO4J_* and OPENROUTER_API_KEY.", "Open Docs")
        .then((c) => { if (c === "Open Docs") vscode.env.openExternal(vscode.Uri.parse("https://github.com/codeatlas/codeatlas")); });
      return;
    }

    let raw = "";
    try { raw = fs.readFileSync(envPath, "utf8"); } catch { return; }
    const parsed = parseEnv(raw);
    const required = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "OPENROUTER_API_KEY"];
    const missing = required.filter(k => !parsed[k]?.trim());

    if (missing.length > 0) {
      vscode.window
        .showWarningMessage(`CodeAtlas: Missing env vars in apps/server/.env: ${missing.join(", ")}`, "Open .env", "Continue anyway")
        .then((c) => {
          if (c === "Open .env") {
            vscode.workspace.openTextDocument(envPath).then(doc => vscode.window.showTextDocument(doc));
          }
        });
    }
  }
}
