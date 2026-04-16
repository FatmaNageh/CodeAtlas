import path from "node:path";

import { z } from "zod";

import { parseAndExtract } from "@/pipeline/parseExtract";
import { scanRepo } from "@/pipeline/scan";
import type { CodeFacts } from "@/types/facts";
import type { SupportedLanguage } from "@/types/scan";

import { normalizeProjectPath } from "./indexing";

export const analyzeReposInputSchema = z.object({
  repoPaths: z.array(z.string().min(1)).min(1),
});

export type AnalyzeReposInput = z.infer<typeof analyzeReposInputSchema>;

type RepoAnalysisOptions = {
  disableParallelParse?: boolean;
};

export type SupportedLanguageCount = Record<SupportedLanguage, number>;

export type FileAnalysis = {
  relPath: string;
  language: SupportedLanguage;
  ext: string;
  parseStatus: CodeFacts["parseStatus"] | null;
  parser: string | null;
  parseErrors: number | null;
  importCount: number;
  extractedSymbolCount: number;
  callSiteCount: number;
  imports: string[];
  extractedSymbols: Array<{
    kind: CodeFacts["astNodes"][number]["kind"];
    name: string;
    qname: string | null;
    parentName: string | null;
  }>;
  callSites: Array<{
    calleeText: string;
    enclosingSymbolQname: string | null;
  }>;
};

export type RepoAnalysis = {
  repoPath: string;
  scannedAt: string;
  ignoredCount: number;
  summary: {
    codeFiles: number;
    textFiles: number;
    byLanguage: SupportedLanguageCount;
    parsedFiles: number;
    partialFiles: number;
    failedFiles: number;
    totalImports: number;
    totalExtractedSymbols: number;
    totalCallSites: number;
  };
  files: FileAnalysis[];
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "c",
  "csharp",
  "cpp",
  "go",
  "java",
  "javascript",
  "kotlin",
  "php",
  "python",
  "ruby",
  "rust",
  "swift",
  "typescript",
];

function zeroLanguageCount(): SupportedLanguageCount {
  return {
    c: 0,
    csharp: 0,
    cpp: 0,
    go: 0,
    java: 0,
    javascript: 0,
    kotlin: 0,
    php: 0,
    python: 0,
    ruby: 0,
    rust: 0,
    swift: 0,
    typescript: 0,
  };
}

function sortByRelPath<T extends { relPath: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.relPath.localeCompare(right.relPath));
}

function toFileAnalysis(relPath: string, ext: string, language: SupportedLanguage, fact: CodeFacts): FileAnalysis {
  return {
    relPath,
    language,
    ext,
    parseStatus: fact.parseStatus ?? null,
    parser: fact.parser ?? null,
    parseErrors: fact.parseErrors ?? null,
    importCount: fact.imports.length,
    extractedSymbolCount: fact.astNodes.length,
    callSiteCount: fact.callSites.length,
    imports: fact.imports.map((item) => item.raw).sort((left, right) => left.localeCompare(right)),
    extractedSymbols: fact.astNodes.map((node) => ({
      kind: node.kind,
      name: node.name,
      qname: node.qname ?? null,
      parentName: node.parentName ?? null,
    })),
    callSites: fact.callSites.map((callSite) => ({
      calleeText: callSite.calleeText,
      enclosingSymbolQname: callSite.enclosingSymbolQname ?? null,
    })),
  };
}

export async function analyzeRepo(repoPath: string, options: RepoAnalysisOptions = {}): Promise<RepoAnalysis> {
  const normalizedRepoPath = normalizeProjectPath(repoPath);
  const scan = await scanRepo(normalizedRepoPath);
  const codeEntries = scan.entries.filter(
    (entry): entry is Extract<(typeof scan.entries)[number], { kind: "code" }> => entry.kind === "code",
  );
  const textFiles = scan.entries.filter((entry) => entry.kind === "text").length;
  const facts = await parseAndExtract(codeEntries, { disableParallel: options.disableParallelParse });
  const byLanguage = zeroLanguageCount();
  let parsedFiles = 0;
  let partialFiles = 0;
  let failedFiles = 0;
  let totalImports = 0;
  let totalExtractedSymbols = 0;
  let totalCallSites = 0;

  const files = sortByRelPath(
    codeEntries.map((entry) => {
      byLanguage[entry.language] += 1;
      const fileFact = facts[entry.relPath];
      const codeFact = fileFact?.kind === "code" ? fileFact : undefined;
      if (!codeFact) {
        failedFiles += 1;
        return {
          relPath: entry.relPath,
          language: entry.language,
          ext: entry.ext,
          parseStatus: null,
          parser: null,
          parseErrors: null,
          importCount: 0,
          extractedSymbolCount: 0,
          callSiteCount: 0,
          imports: [],
          extractedSymbols: [],
          callSites: [],
        } satisfies FileAnalysis;
      }

      switch (codeFact.parseStatus) {
        case "parsed":
          parsedFiles += 1;
          break;
        case "partial":
          partialFiles += 1;
          break;
        default:
          failedFiles += 1;
          break;
      }

      totalImports += codeFact.imports.length;
      totalExtractedSymbols += codeFact.astNodes.length;
      totalCallSites += codeFact.callSites.length;
      return toFileAnalysis(entry.relPath, entry.ext, entry.language, codeFact);
    }),
  );

  return {
    repoPath: path.resolve(normalizedRepoPath),
    scannedAt: scan.scannedAt,
    ignoredCount: scan.ignoredCount,
    summary: {
      codeFiles: codeEntries.length,
      textFiles,
      byLanguage,
      parsedFiles,
      partialFiles,
      failedFiles,
      totalImports,
      totalExtractedSymbols,
      totalCallSites,
    },
    files,
  };
}

export async function analyzeRepos(input: AnalyzeReposInput): Promise<RepoAnalysis[]> {
  return Promise.all(input.repoPaths.map((repoPath) => analyzeRepo(repoPath, { disableParallelParse: true })));
}
