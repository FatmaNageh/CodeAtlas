import fs from 'node:fs/promises';
import type { FileIndexEntry } from '../types/scan';

export interface ParsedFile {
  file: FileIndexEntry;
  text: string;
  parseErrors: number;
  tree?: unknown; // optional Tree-sitter tree (best-effort)
}

async function tryLoadTreeSitter(): Promise<any | null> {
  try {
    const mod = await import('tree-sitter');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function tryLoadLanguage(language: string): Promise<any | null> {
  try {
    switch (language) {
      case 'javascript': {
        const mod = await import('tree-sitter-javascript');
        return (mod.default ?? mod).javascript ?? (mod.default ?? mod);
      }
      case 'typescript': {
        const mod = await import('tree-sitter-typescript');
        const pkg = mod.default ?? mod;
        return pkg.typescript ?? pkg.tsx ?? pkg;
      }
      case 'python': {
        const mod = await import('tree-sitter-python');
        return mod.default ?? mod;
      }
      case 'java': {
        const mod = await import('tree-sitter-java');
        return mod.default ?? mod;
      }
      case 'go': {
        const mod = await import('tree-sitter-go');
        return mod.default ?? mod;
      }
      case 'cpp': {
        const mod = await import('tree-sitter-cpp');
        return mod.default ?? mod;
      }
      case 'c': {
        const mod = await import('tree-sitter-c');
        return mod.default ?? mod;
      }
      case 'ruby': {
        const mod = await import('tree-sitter-ruby');
        return mod.default ?? mod;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function parseFile(file: FileIndexEntry): Promise<ParsedFile> {
  const text = await fs.readFile(file.absPath, 'utf8');

  // Tree-sitter parsing is best-effort in this phase. Extraction can still proceed via regex.
  let parseErrors = 0;
  let tree: unknown | undefined;

  const Parser = await tryLoadTreeSitter();
  if (Parser && file.language) {
    const Lang = await tryLoadLanguage(file.language);
    if (Lang) {
      try {
        const parser = new Parser();
        parser.setLanguage(Lang);
        const t = parser.parse(text);
        // @ts-ignore - tree-sitter node shape varies
        parseErrors = typeof t?.rootNode?.hasError === 'boolean' && t.rootNode.hasError ? 1 : 0;
        tree = t;
      } catch {
        // ignore parse errors; we still extract by regex
        parseErrors = 1;
      }
    }
  }

  return { file, text, parseErrors, tree };
}
