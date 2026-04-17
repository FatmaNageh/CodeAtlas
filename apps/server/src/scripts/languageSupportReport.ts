import { languageFixtures, languageFixturesDir } from "@/__tests__/pipeline/languageFixtures";
import { parseAndExtract } from "@/pipeline/parseExtract";
import { scanRepo } from "@/pipeline/scan";
import type { CodeFacts } from "@/types/facts";
import type { SupportedLanguage } from "@/types/scan";

type KindExpectationResult = {
  name: string;
  expectedKind: CodeFacts["astNodes"][number]["kind"];
  actualKind: CodeFacts["astNodes"][number]["kind"] | null;
  ok: boolean;
};

type LanguageReport = {
  relPath: string;
  expectedLanguage: SupportedLanguage;
  detectedLanguage: SupportedLanguage | null;
  languageMatch: boolean;
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
  expected: {
    imports: string[];
    symbols: string[];
    calls: string[];
    kinds: Array<{ name: string; kind: CodeFacts["astNodes"][number]["kind"] }>;
  };
  missing: {
    imports: string[];
    symbols: string[];
    calls: string[];
    kinds: KindExpectationResult[];
  };
  ok: boolean;
};

type ReportSummary = {
  total: number;
  passed: number;
  failed: number;
};

type LanguageSupportReport = {
  ok: boolean;
  fixtureRoot: string;
  summary: ReportSummary;
  languages: LanguageReport[];
};

function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function buildLanguageReport(
  fixture: (typeof languageFixtures)[number],
  detectedLanguage: SupportedLanguage | null,
  codeFact: CodeFacts | undefined,
): LanguageReport {
  const importValues = new Set(codeFact?.imports.map((item) => item.raw) ?? []);
  const symbolValues = new Set(
    codeFact?.astNodes.flatMap((node) => {
      const values: string[] = [];
      if (node.name) values.push(node.name);
      if (node.qname) values.push(node.qname);
      return values;
    }) ?? [],
  );
  const callValues = new Set(codeFact?.callSites.map((callSite) => callSite.calleeText) ?? []);
  const missingImports = (fixture.requiredImports ?? []).filter((value) => !importValues.has(value));
  const missingSymbols = fixture.requiredSymbols.filter((value) => !symbolValues.has(value));
  const missingCalls = (fixture.requiredCalls ?? []).filter((value) => !callValues.has(value));
  const missingKinds: KindExpectationResult[] = (fixture.requiredKinds ?? []).map((expectedKind) => {
    const matches = (codeFact?.astNodes ?? []).filter((node) => node.name === expectedKind.name);
    const actualKind = matches.find((node) => node.kind === expectedKind.kind)?.kind ?? matches[0]?.kind ?? null;
    return {
      name: expectedKind.name,
      expectedKind: expectedKind.kind,
      actualKind,
      ok: actualKind === expectedKind.kind,
    };
  });

  const languageMatch = detectedLanguage === fixture.language;
  const ok =
    languageMatch &&
    missingImports.length === 0 &&
    missingSymbols.length === 0 &&
    missingCalls.length === 0 &&
    missingKinds.every((entry) => entry.ok);

  return {
    relPath: fixture.relPath,
    expectedLanguage: fixture.language,
    detectedLanguage,
    languageMatch,
    parseStatus: codeFact?.parseStatus ?? null,
    parser: codeFact?.parser ?? null,
    parseErrors: codeFact?.parseErrors ?? null,
    importCount: codeFact?.imports.length ?? 0,
    extractedSymbolCount: codeFact?.astNodes.length ?? 0,
    callSiteCount: codeFact?.callSites.length ?? 0,
    imports: sortStrings(importValues),
    extractedSymbols: (codeFact?.astNodes ?? []).map((node) => ({
      kind: node.kind,
      name: node.name,
      qname: node.qname ?? null,
      parentName: node.parentName ?? null,
    })),
    callSites: (codeFact?.callSites ?? []).map((callSite) => ({
      calleeText: callSite.calleeText,
      enclosingSymbolQname: callSite.enclosingSymbolQname ?? null,
    })),
    expected: {
      imports: fixture.requiredImports ?? [],
      symbols: fixture.requiredSymbols,
      calls: fixture.requiredCalls ?? [],
      kinds: fixture.requiredKinds ?? [],
    },
    missing: {
      imports: missingImports,
      symbols: missingSymbols,
      calls: missingCalls,
      kinds: missingKinds.filter((entry) => !entry.ok),
    },
    ok,
  };
}

async function main(): Promise<void> {
  const scan = await scanRepo(languageFixturesDir);
  const codeEntries = scan.entries.filter(
    (entry): entry is Extract<(typeof scan.entries)[number], { kind: "code" }> => entry.kind === "code",
  );
  const facts = await parseAndExtract(codeEntries);
  const detectedByRelPath = new Map(
    codeEntries.map((entry) => [entry.relPath, entry.language] as const),
  );

  const languages = languageFixtures.map((fixture) =>
    {
      const fileFact = facts[fixture.relPath];
      const codeFact = fileFact?.kind === "code" ? fileFact : undefined;
      return buildLanguageReport(
        fixture,
        detectedByRelPath.get(fixture.relPath) ?? null,
        codeFact,
      );
    },
  );

  const summary: ReportSummary = {
    total: languages.length,
    passed: languages.filter((entry) => entry.ok).length,
    failed: languages.filter((entry) => !entry.ok).length,
  };

  const report: LanguageSupportReport = {
    ok: summary.failed === 0,
    fixtureRoot: languageFixturesDir,
    summary,
    languages,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main();
