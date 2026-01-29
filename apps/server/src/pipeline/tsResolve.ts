import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

import type { ScanResult } from "../types/scan";

type Ts = any;

type Resolver = {
  /**
   * Resolve an import specifier used in a file to a repository-relative target path.
   * Returns null if it cannot be resolved to a local file in this repo.
   */
  resolveModuleToRelPath: (moduleSpecifier: string, containingFileRelPath: string) => string | null;
};

function findNearestTsConfig(repoRoot: string): string | null {
  // Phase 2: keep it simple—only check repo root for now.
  const tsconfig = path.join(repoRoot, "tsconfig.json");
  if (fs.existsSync(tsconfig)) return tsconfig;
  return null;
}

function toPosixRel(repoRoot: string, absFile: string): string | null {
  const rel = path.relative(repoRoot, absFile);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

export function createTsModuleResolver(scan: ScanResult, filesByRel: Map<string, unknown>): Resolver | null {
  const require = createRequire(import.meta.url);
  let ts: Ts;
  try {
    ts = require("typescript") as Ts;
  } catch {
    return null;
  }

  const repoRoot = path.resolve(scan.repoRoot);
  const tsconfigPath = findNearestTsConfig(repoRoot);

  let basePath = repoRoot;
  let compilerOptions: any = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
    resolveJsonModule: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
  };

  if (tsconfigPath) {
    try {
      basePath = path.dirname(tsconfigPath);
      const cfg = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (!cfg.error) {
        const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, basePath);
        compilerOptions = { ...compilerOptions, ...(parsed.options ?? {}) };
      }
    } catch {
      // Ignore and keep defaults.
    }
  }

  const host: any = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };

  const getCanonical = (f: string) => (ts.sys.useCaseSensitiveFileNames ? f : f.toLowerCase());
  const cache = ts.createModuleResolutionCache(basePath, getCanonical, compilerOptions);

  const resolveModuleToRelPath = (moduleSpecifier: string, containingFileRelPath: string): string | null => {
    if (!moduleSpecifier || typeof moduleSpecifier !== "string") return null;

    const containingAbs = path.join(repoRoot, containingFileRelPath);
    const res = ts.resolveModuleName(moduleSpecifier, containingAbs, compilerOptions, host, cache);
    const resolvedFile = res?.resolvedModule?.resolvedFileName;
    if (!resolvedFile) return null;

    // Ignore node_modules (treat as external)
    if (resolvedFile.includes("node_modules")) return null;

    const rel = toPosixRel(repoRoot, resolvedFile);
    if (!rel) return null;

    if (filesByRel.has(rel)) return rel;

    const normalized = rel.startsWith("./") ? rel.slice(2) : rel;
    if (filesByRel.has(normalized)) return normalized;

    return null;
  };

  return { resolveModuleToRelPath };
}
