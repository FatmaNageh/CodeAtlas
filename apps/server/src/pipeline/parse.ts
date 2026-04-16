import fs from 'node:fs/promises';
import type { CodeFileIndexEntry } from '../types/scan';
import type { ParseStatus } from '../types/graphProperties';
import type { TreeSitterParserConstructor, TreeSitterTree } from './treeSitterTypes';

export interface ParsedFile {
  file: CodeFileIndexEntry;
  text: string;
  parseErrors: number;
  parseStatus: ParseStatus;
  parser: string | null;
  tree?: unknown; // optional Tree-sitter tree (best-effort)
}

function rootNodeHasError(rootNode: TreeSitterTree["rootNode"] | null): boolean {
  const hasErrorValue = (rootNode as { hasError?: unknown } | null | undefined)?.hasError;
  if (typeof hasErrorValue === "function") {
    return (hasErrorValue as () => boolean)();
  }
  return Boolean(hasErrorValue);
}

async function tryLoadTreeSitter(): Promise<TreeSitterParserConstructor | null> {
  try {
    const mod = await import('tree-sitter');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function tryLoadLanguage(language: string): Promise<unknown | null> {
  try {
    switch (language) {
      case 'javascript': {
        const mod = await import('tree-sitter-javascript');
        // JS grammar is the module itself (or default), not `.javascript`
        return mod.default ?? mod;
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
      case 'csharp': {
        const mod = await import('tree-sitter-c-sharp');
        return mod.default ?? mod;
      }
      case 'ruby': {
        const mod = await import('tree-sitter-ruby');
        return mod.default ?? mod;
      }
      case 'php': {
        const mod = await import('tree-sitter-php');
        const pkg = (mod.default ?? mod) as { php?: unknown };
        return pkg.php ?? pkg;
      }
      case 'rust': {
        const mod = await import('tree-sitter-rust');
        return mod.default ?? mod;
      }
      case 'kotlin': {
        const mod = await import('tree-sitter-kotlin');
        return mod.default ?? mod;
      }
      case 'swift': {
        const mod = await import('tree-sitter-swift');
        return mod.default ?? mod;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function parseFile(file: CodeFileIndexEntry): Promise<ParsedFile> {
  const text = await fs.readFile(file.absPath, 'utf8');

  // Tree-sitter parsing is best-effort in this phase. Extraction can still proceed via regex.
  let parseErrors = 0;
  let parseStatus: ParseStatus = "failed";
  let parser: string | null = null;
  let tree: unknown | undefined;

  const Parser = await tryLoadTreeSitter();
  if (Parser && file.language) {
    const Lang = await tryLoadLanguage(file.language);
    if (Lang) {
      try {
        const treeSitterParser = new Parser();
        treeSitterParser.setLanguage(Lang as Parameters<typeof treeSitterParser.setLanguage>[0]);
        const t = treeSitterParser.parse(text);
        const parsedTree = t as TreeSitterTree;
        const hasErr = rootNodeHasError(parsedTree.rootNode);
        parseErrors = hasErr ? 1 : 0;
        parseStatus = hasErr ? "partial" : "parsed";
        parser = "tree-sitter";
        tree = parsedTree;
      } catch {
        // ignore parse errors; we still extract by regex
        parseErrors = 1;
        parseStatus = "failed";
      }
    }
  }

  return { file, text, parseErrors, parseStatus, parser, tree };
}
