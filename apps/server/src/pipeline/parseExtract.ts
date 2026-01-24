import fs from "fs/promises";
import crypto from "crypto";
import Parser, { type Language, type SyntaxNode } from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import CPP from "tree-sitter-cpp";
import Go from "tree-sitter-go";
import Ruby from "tree-sitter-ruby";

import type { FileIndexEntry } from "../types/scan";
import type { FactsByFile, RawFacts, RawImport, RawSymbol, RawCallSite } from "../types/facts";
import type { Range } from "../types/ir";

function getLanguageParser(ext: string): Parser {
  const parser = new Parser();
  switch (ext) {
    case ".js":
    case ".ts":
      parser.setLanguage(JavaScript as unknown as Language);
      break;
    case ".py":
      parser.setLanguage(Python as unknown as Language);
      break;
    case ".java":
      parser.setLanguage(Java as unknown as Language);
      break;
    case ".cpp":
    case ".cc":
    case ".hpp":
      parser.setLanguage(CPP as unknown as Language);
      break;
    case ".rb":
      parser.setLanguage(Ruby as unknown as Language);
      break;
    case ".go":
      parser.setLanguage(Go as unknown as Language);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
  return parser;
}

function nodeRange(n: SyntaxNode): Range {
  return {
    startLine: n.startPosition.row + 1,
    startCol: n.startPosition.column + 1,
    endLine: n.endPosition.row + 1,
    endCol: n.endPosition.column + 1,
  };
}

function extractName(node: SyntaxNode): string | null {
  const nameField = node.childForFieldName?.("name");
  if (nameField?.text) return nameField.text;

  const idNode = node.namedChildren?.find((n) => /identifier|name|property_identifier/.test(n.type));
  if (idNode?.text) return idNode.text;

  if (node.type === "function_definition") {
    const declarator = node.namedChildren?.find((n) => n.type === "function_declarator");
    const ident = declarator?.namedChildren?.find((n) => n.type === "identifier");
    if (ident?.text) return ident.text;
  }

  const fallback = node.namedChildren?.find((n) => n.type === "identifier" || n.type === "name");
  if (fallback?.text) return fallback.text;

  return null;
}

export async function parseAndExtract(files: FileIndexEntry[]): Promise<FactsByFile> {
  const out: FactsByFile = {};

  for (const f of files) {
    const abs = f.absPath;
    const rel = f.relPath;
    const ext = f.ext.toLowerCase();

    const code = await fs.readFile(abs, "utf-8").catch(() => "");
    const lineCount = code ? code.split(/\r\n|\r|\n/).length : 0;
    const textPreview = code ? code.slice(0, 4000) : "";
    const textHash = code ? crypto.createHash("sha1").update(code).digest("hex") : undefined;
    if (!code) {
      out[rel] = {
        fileRelPath: rel,
        language: f.language,
        imports: [],
        symbols: [],
        callSites: [],
        parseErrors: 0,
        lineCount,
        textPreview,
        textHash,
      };
      continue;
    }

    let parser: Parser;
    try {
      parser = getLanguageParser(ext);
    } catch {
      out[rel] = {
        fileRelPath: rel,
        language: f.language,
        imports: [],
        symbols: [],
        callSites: [],
        parseErrors: 0,
        lineCount,
        textPreview,
        textHash,
      };
      continue;
    }

    const tree = parser.parse(code);
    const root = tree.rootNode;

    const imports: RawImport[] = [];
    const symbols: RawSymbol[] = [];
    const callSites: RawCallSite[] = [];

    const walk = (node: SyntaxNode) => {
      // JS/TS
      if (ext === ".js" || ext === ".ts") {
        if (node.type === "import_statement") {
          const src = node.childForFieldName("source");
          if (src?.text) imports.push({ raw: src.text.replace(/['"]/g, ""), range: nodeRange(node), kind: "static" });
        }
        if (node.type === "call_expression") {
          const fn = node.childForFieldName("function");
          const args = node.childForFieldName("arguments");
          if (fn?.text) callSites.push({ calleeText: fn.text, range: nodeRange(node) });
          if (fn?.text === "require" && args?.text) imports.push({ raw: args.text, range: nodeRange(node), kind: "require" });
        }
        if (node.type === "function_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "function", name, range: nodeRange(node) });
        }
        if (node.type === "method_definition") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "method", name, range: nodeRange(node) });
        }
        if (node.type === "class_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "class", name, range: nodeRange(node) });
        }
      }

      // Python
      if (ext === ".py") {
        if (node.type === "import_statement" || node.type === "import_from_statement") {
          imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
        }
        if (node.type === "function_definition") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "function", name, range: nodeRange(node) });
        }
        if (node.type === "class_definition") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "class", name, range: nodeRange(node) });
        }
        if (node.type === "call") {
          const fn = node.child(0);
          if (fn?.text) callSites.push({ calleeText: fn.text, range: nodeRange(node) });
        }
      }

      // Java
      if (ext === ".java") {
        if (node.type === "import_declaration") imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
        if (node.type === "method_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "method", name, range: nodeRange(node) });
        }
        if (node.type === "class_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "class", name, range: nodeRange(node) });
        }
        if (node.type === "method_invocation") {
          const name = node.childForFieldName("name");
          if (name?.text) callSites.push({ calleeText: name.text, range: nodeRange(node) });
        }
      }

      // Go
      if (ext === ".go") {
        if (node.type === "import_declaration") imports.push({ raw: node.text, range: nodeRange(node), kind: "static" });
        if (node.type === "function_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "function", name, range: nodeRange(node) });
        }
        if (node.type === "method_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "method", name, range: nodeRange(node) });
        }
        if (node.type === "type_declaration") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "class", name, range: nodeRange(node) });
        }
        if (node.type === "call_expression") {
          const fn = node.childForFieldName("function");
          if (fn?.text) callSites.push({ calleeText: fn.text, range: nodeRange(node) });
        }
      }

      // Ruby
      if (ext === ".rb") {
        if (node.type === "call") {
          const identifier =
            node.childForFieldName("name") ||
            node.namedChildren?.find((n) => n.type === "identifier");
          if (identifier?.text === "require" || identifier?.text === "require_relative") {
            imports.push({ raw: node.text, range: nodeRange(node), kind: "require" });
          }
          if (identifier?.text) callSites.push({ calleeText: identifier.text, range: nodeRange(node) });
        }
        if (node.type === "method") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "method", name, range: nodeRange(node) });
        }
        if (node.type === "class") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "class", name, range: nodeRange(node) });
        }
      }

      // C/C++
      if (ext === ".cpp" || ext === ".cc" || ext === ".hpp") {
        if (node.type === "preproc_include") imports.push({ raw: node.text, range: nodeRange(node), kind: "include" });
        if (node.type === "namespace_definition") {
          const nm = node.child(1)?.text;
          if (nm) symbols.push({ kind: "namespace", name: nm, range: nodeRange(node) });
        }
        if (node.type === "function_definition") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "function", name, range: nodeRange(node) });
        }
        if (node.type === "class_specifier") {
          const name = extractName(node);
          if (name) symbols.push({ kind: "class", name, range: nodeRange(node) });
        }
        if (node.type === "call_expression") {
          const fn = node.childForFieldName("function");
          if (fn?.text) callSites.push({ calleeText: fn.text, range: nodeRange(node) });
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) walk(child);
      }
    };

    walk(root);

    const hasError =
      typeof (root as any).hasError === "function"
        ? (root as any).hasError()
        : Boolean((root as any).hasError);

    const facts: RawFacts = {
      fileRelPath: rel,
      language: f.language,
      imports,
      symbols,
      callSites,
      parseErrors: hasError ? 1 : 0,
      lineCount,
      textPreview,
      textHash,
    };

    out[rel] = facts;
  }

  return out;
}
