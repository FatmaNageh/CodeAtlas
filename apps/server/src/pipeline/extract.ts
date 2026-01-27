import type { FileFacts, ExtractedCallSite, ExtractedDocChunk, ExtractedImport, ExtractedSymbol, SymbolKind } from '../types/facts';
import type { ParsedFile } from './parse';

function uniq<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function extractImportsRegex(text: string, language: string): ExtractedImport[] {
  const imports: ExtractedImport[] = [];

  if (language === 'javascript' || language === 'typescript') {
    const re1 = /\bimport\s+[^\n]*?\sfrom\s+['"]([^'"]+)['"]/g;
    const re2 = /\bimport\s+['"]([^'"]+)['"]/g;
    const re3 = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(text))) imports.push({ raw: m[1] });
    while ((m = re2.exec(text))) imports.push({ raw: m[1] });
    while ((m = re3.exec(text))) imports.push({ raw: m[1] });
  } else if (language === 'python') {
    const re1 = /^\s*from\s+([^\s]+)\s+import\s+/gm;
    const re2 = /^\s*import\s+([^\s\n#]+)\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(text))) imports.push({ raw: m[1] });
    while ((m = re2.exec(text))) imports.push({ raw: m[1].split(',')[0].trim() });
  } else if (language === 'java') {
    const re = /^\s*import\s+([^;\n]+);/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) imports.push({ raw: m[1].trim() });
  } else if (language === 'go') {
    const re1 = /^\s*import\s+\(([^\)]*)\)/gm;
    const re2 = /^\s*import\s+"([^"]+)"/gm;
    let m: RegExpExecArray | null;
    while ((m = re2.exec(text))) imports.push({ raw: m[1] });
    while ((m = re1.exec(text))) {
      const block = m[1];
      const reLine = /"([^"]+)"/g;
      let l: RegExpExecArray | null;
      while ((l = reLine.exec(block))) imports.push({ raw: l[1] });
    }
  } else if (language === 'cpp' || language === 'c') {
    const re = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) imports.push({ raw: m[1].trim() });
  } else if (language === 'ruby') {
    const re = /^\s*require\s+['"]([^'"]+)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) imports.push({ raw: m[1] });
  }

  return uniq(imports, (i) => i.raw);
}

function kindFromLanguageSymbol(language: string, rawKind: string): SymbolKind {
  if (rawKind === 'class') return 'class';
  if (rawKind === 'interface') return 'interface';
  if (rawKind === 'module' || rawKind === 'namespace') return rawKind as SymbolKind;
  if (rawKind === 'method') return 'method';
  if (rawKind === 'function') return 'function';
  return 'unknown';
}

function extractSymbolsRegex(text: string, language: string): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];

  if (language === 'javascript' || language === 'typescript') {
    const reFn = /^\s*(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    const reClass = /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm;
    const reIface = /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/gm;
    const reConstFn = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*\(/gm;
    let m: RegExpExecArray | null;
    while ((m = reFn.exec(text))) symbols.push({ kind: kindFromLanguageSymbol(language, 'function'), name: m[1] });
    while ((m = reConstFn.exec(text))) symbols.push({ kind: kindFromLanguageSymbol(language, 'function'), name: m[1] });
    while ((m = reClass.exec(text))) symbols.push({ kind: kindFromLanguageSymbol(language, 'class'), name: m[1] });
    while ((m = reIface.exec(text))) symbols.push({ kind: kindFromLanguageSymbol(language, 'interface'), name: m[1] });
  } else if (language === 'python') {
    const reFn = /^\s*def\s+([A-Za-z_][\w]*)\s*\(/gm;
    const reClass = /^\s*class\s+([A-Za-z_][\w]*)\s*\(?/gm;
    let m: RegExpExecArray | null;
    while ((m = reFn.exec(text))) symbols.push({ kind: 'function', name: m[1] });
    while ((m = reClass.exec(text))) symbols.push({ kind: 'class', name: m[1] });
  } else if (language === 'java') {
    const reClass = /^\s*(?:public\s+)?(?:abstract\s+)?class\s+([A-Za-z_][\w]*)/gm;
    const reIface = /^\s*(?:public\s+)?interface\s+([A-Za-z_][\w]*)/gm;
    const reMethod = /^\s*(?:public|protected|private)?\s*(?:static\s+)?[A-Za-z_][\w<>\[\]]*\s+([A-Za-z_][\w]*)\s*\(/gm;
    let m: RegExpExecArray | null;
    while ((m = reClass.exec(text))) symbols.push({ kind: 'class', name: m[1] });
    while ((m = reIface.exec(text))) symbols.push({ kind: 'interface', name: m[1] });
    while ((m = reMethod.exec(text))) symbols.push({ kind: 'method', name: m[1] });
  } else if (language === 'go') {
    const reFn = /^\s*func\s+([A-Za-z_][\w]*)\s*\(/gm;
    const reMethod = /^\s*func\s*\([^\)]*\)\s*([A-Za-z_][\w]*)\s*\(/gm;
    let m: RegExpExecArray | null;
    while ((m = reMethod.exec(text))) symbols.push({ kind: 'method', name: m[1] });
    while ((m = reFn.exec(text))) symbols.push({ kind: 'function', name: m[1] });
  } else if (language === 'cpp' || language === 'c') {
    const reClass = /^\s*class\s+([A-Za-z_][\w]*)/gm;
    const reFn = /^\s*[A-Za-z_][\w:<>\*\&\s]*\s+([A-Za-z_][\w]*)\s*\([^;\{\n]*\)\s*\{/gm;
    let m: RegExpExecArray | null;
    while ((m = reClass.exec(text))) symbols.push({ kind: 'class', name: m[1] });
    while ((m = reFn.exec(text))) symbols.push({ kind: 'function', name: m[1] });
  } else if (language === 'ruby') {
    const reClass = /^\s*class\s+([A-Za-z_][\w:]*)/gm;
    const reFn = /^\s*def\s+([A-Za-z_][\w!?=]*)/gm;
    let m: RegExpExecArray | null;
    while ((m = reClass.exec(text))) symbols.push({ kind: 'class', name: m[1] });
    while ((m = reFn.exec(text))) symbols.push({ kind: 'method', name: m[1] });
  }

  return uniq(symbols, (s) => `${s.kind}:${s.name}`);
}

function extractCallSitesRegex(text: string, language: string): ExtractedCallSite[] {
  const callSites: ExtractedCallSite[] = [];

  // very naive: capture foo( where foo is an identifier, exclude some keywords
  const keyword = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'new', 'class', 'def']);
  const re = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = m[1];
    if (keyword.has(name)) continue;
    callSites.push({ calleeText: name });
  }

  return uniq(callSites, (c) => c.calleeText);
}

function extractDocChunksRegex(text: string, language: string): ExtractedDocChunk[] {
  const chunks: ExtractedDocChunk[] = [];

  // First block comment / docstring as a chunk (lightweight for phase 1)
  if (language === 'python') {
    const m = text.match(/^[\s\n]*([\"\']{3}[\s\S]*?[\"\']{3})/);
    if (m) chunks.push({ kind: 'doc', text: m[1] });
  } else {
    const m = text.match(/^[\s\n]*(\/\*\*[\s\S]*?\*\/)/);
    if (m) chunks.push({ kind: 'doc', text: m[1] });
  }

  return chunks;
}

export function extractFacts(parsed: ParsedFile): FileFacts {
  const language = parsed.file.language ?? 'unknown';

  const symbols = extractSymbolsRegex(parsed.text, language);
  const imports = extractImportsRegex(parsed.text, language);
  const callSites = extractCallSitesRegex(parsed.text, language);
  const docChunks = extractDocChunksRegex(parsed.text, language);

  return {
    repoId: parsed.file.repoId,
    path: parsed.file.path,
    language,
    parseErrors: parsed.parseErrors,
    symbols,
    imports,
    callSites,
    docChunks,
  };
}
