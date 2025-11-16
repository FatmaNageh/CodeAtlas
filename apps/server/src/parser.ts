import Parser, { type Language, type SyntaxNode } from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import CPP from "tree-sitter-cpp";
import Go from "tree-sitter-go";
import Ruby from "tree-sitter-ruby";
import fs from "fs";
import path from "path";
import type { FileNode, DirectoryNode, GraphNode } from "../types/graph";

function getLanguageParser(ext: string): Parser {
  const parser = new Parser();

  switch (ext) {
    case ".js":
    case ".ts":
      parser.setLanguage(JavaScript as Language);
      break;
    case ".py":
      parser.setLanguage(Python as Language);
      break;
    case ".java":
      parser.setLanguage(Java as Language);
      break;
    case ".cpp":
    case ".cc":
    case ".hpp":
      parser.setLanguage(CPP as Language);
      break;
    case ".rb":
      parser.setLanguage(Ruby as Language);
      break;
      case ".go":
      parser.setLanguage(Go as Language);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  return parser;
}


// Enhanced: collect directories as well as files to preserve folder hierarchy with nested structure.
function getAllFiles(dirPath: string): GraphNode {
  function buildDirectory(absPath: string, relPath: string): GraphNode {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absPath, { withFileTypes: true });
    } catch (e) {
      return {
        id: absPath,
        type: {
          basename: path.basename(absPath),
          relative_path: relPath === "" ? "" : relPath + path.sep,
          isDirectory: true,
          children: []
        } as DirectoryNode
      };
    }

    const children: GraphNode[] = [];

    for (const entry of entries) {
      const entryAbsPath = path.join(absPath, entry.name);
      const entryRelPath = path.join(relPath, entry.name);

      if (entry.isDirectory()) {
        children.push(buildDirectory(entryAbsPath, entryRelPath));
      } else if (/\.(js|ts|py|java|cpp|cc|hpp|rb|go)$/.test(entry.name)) {
        const fileNode: FileNode = {
          basename: path.basename(entryAbsPath),
          relative_path: entryRelPath
        };
        children.push({
          id: entryAbsPath,
          type: fileNode
        });
      }
    }

    return {
      id: absPath,
      type: {
        basename: path.basename(absPath),
        relative_path: relPath === "" ? "" : relPath + path.sep,
        isDirectory: true,
        children
      } as DirectoryNode
    };
  }

  return buildDirectory(dirPath, "");
}



function extractName(node: SyntaxNode): string | null {
  const nameField = node.childForFieldName?.("name");
  if (nameField && nameField.text) return nameField.text;

  const idNode = node.namedChildren?.find((n: SyntaxNode) =>
    /identifier|name|property_identifier/.test(n.type)
  );
  if (idNode && idNode.text) return idNode.text;

  if (node.type === "function_definition") {
    const declarator = node.namedChildren?.find(
      (n: SyntaxNode) => n.type === "function_declarator"
    );
    const ident = declarator?.namedChildren?.find(
      (n: SyntaxNode) => n.type === "identifier"
    );
    if (ident && ident.text) return ident.text;
  }

  const fallback = node.namedChildren?.find(
    (n: SyntaxNode) => n.type === "identifier" || n.type === "name"
  );
  if (fallback && fallback.text) return fallback.text;

  return null;
}

type ParsedNode = {
  file: string;
  path: string;
  isDirectory: boolean;
  imports: string[];
  functions: string[];
  classes: string[];
  modules: string[];
  children: ParsedNode[];
};

function isDirectoryGraphNode(node: GraphNode): node is GraphNode & { type: DirectoryNode } {
  return (node.type as DirectoryNode).isDirectory === true;
}

export function parseProject(projectPath: string): ParsedNode {
  const rootNode = getAllFiles(projectPath);
  
  function parseNode(node: GraphNode): ParsedNode {
    const filePath = node.id;
    
    // Handle directories
    if (isDirectoryGraphNode(node)) {
      const directoryData: ParsedNode = {
        file: path.basename(filePath),
        path: filePath,
        isDirectory: true,
        imports: [],
        functions: [],
        classes: [],
        modules: [],
        children: node.type.children?.map(child => parseNode(child)) || []
      };
      return directoryData;
    }

    // Handle files
    const code = fs.readFileSync(filePath, "utf8");
    const ext = path.extname(filePath);
    let parser: Parser;

    try {
      parser = getLanguageParser(ext);
    } catch {
      console.warn(`Skipping unsupported file: ${filePath}`);
      return {
        file: path.basename(filePath),
        path: filePath,
        isDirectory: false,
        imports: [],
        functions: [],
        classes: [],
        modules: [],
        children: []
      };
    }

    const tree = parser.parse(code);
    const root = tree.rootNode;

    const imports: string[] = [];
    const functions: string[] = [];
    const classes: string[] = [];
    const modules: string[] = []; //Added Modules

    const walk = (node: SyntaxNode) => {
      switch (ext) {
        // --- JavaScript / TypeScript ---
        case ".js":
        case ".ts":
          if (node.type === "import_statement") {
            const src = node.childForFieldName("source");
            if (src) imports.push(src.text.replace(/['"]/g, ""));
          }
          if (
            node.type === "function_declaration" ||
            node.type === "method_definition"
          ) {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "class_declaration") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;

        // --- Python ---
        case ".py":
          if (
            node.type === "import_statement" ||
            node.type === "import_from_statement"
          ) {
            imports.push(node.text);
          }
          if (node.type === "function_definition") {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "class_definition") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;

        // --- Java ---
        case ".java":
          if (node.type === "import_declaration") imports.push(node.text);
          if (node.type === "method_declaration") {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "class_declaration") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;

        // --- C++ ---
        case ".cpp":
        case ".cc":
        case ".hpp":
          if (node.type === "namespace_definition")
            modules.push(node.child(1)?.text || "");
          if (node.type === "function_definition") {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "class_specifier") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;

        // --- Go ---
        case ".go":
          if (node.type === "import_declaration") imports.push(node.text);
          if (node.type === "function_declaration") {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "type_declaration") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;

        // --- Ruby ---
        case ".rb":
          if (node.type === "call") {
            const identifier = node.childForFieldName("name") || node.namedChildren?.find((n: SyntaxNode) => n.type === "identifier");
            if (identifier?.text === "require" || identifier?.text === "require_relative") {
              imports.push(node.text);
            }
          }
          if (node.type === "method") {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "class") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;

        default:
          console.warn(`Unsupported language: ${ext}`);
          break;
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          walk(child);
        }
      }
    };

    walk(root);

    return {
      file: path.basename(filePath),
      path: filePath,
      isDirectory: false,
      imports,
      functions,
      classes,
      modules,
      children: []
    };
  }

  return parseNode(rootNode);
}
