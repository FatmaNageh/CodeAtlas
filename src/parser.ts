import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import CPP from "tree-sitter-cpp";
import fs from "fs";
import path from "path";


function getLanguageParser(ext: string): Parser {
  const parser = new Parser();

  switch (ext) {
    case ".js":
    case ".ts":
      parser.setLanguage(JavaScript as any);
      break;
    case ".py":
      parser.setLanguage(Python as any);
      break;
    case ".java":
      parser.setLanguage(Java as any);
      break;
    case ".cpp":
    case ".cc":
    case ".hpp":
      parser.setLanguage(CPP as any);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  return parser;
}

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    }  else if (/\.(js|ts|py|java|cpp|cc|hpp)$/.test(fullPath)) files.push(fullPath);
  }
  return files;
}

function extractName(node: any): string | null {
  const nameField = node.childForFieldName?.("name");
  if (nameField && nameField.text) return nameField.text;

  const idNode = node.namedChildren?.find((n: any) =>
    /identifier|name|property_identifier/.test(n.type)
  );
  if (idNode && idNode.text) return idNode.text;

  if (node.type === "function_definition") {
    const declarator = node.namedChildren?.find(
      (n: any) => n.type === "function_declarator"
    );
    const ident = declarator?.namedChildren?.find(
      (n: any) => n.type === "identifier"
    );
    if (ident && ident.text) return ident.text;
  }

  const fallback = node.namedChildren?.find(
    (n: any) => n.type === "identifier" || n.type === "name"
  );
  if (fallback && fallback.text) return fallback.text;

  return null;
}

export function parseProject(projectPath: string) {
  const allFiles = getAllFiles(projectPath);
  const projectData: any[] = [];

  for (const filePath of allFiles) {
    const code = fs.readFileSync(filePath, "utf8");
    const ext = path.extname(filePath);
    let parser: Parser;

    try {
      parser = getLanguageParser(ext);
    } catch {
      console.warn(`Skipping unsupported file: ${filePath}`);
      continue;
    }

    const tree = parser.parse(code);
    const root = tree.rootNode;
    
    const imports: string[] = [];
    const functions: string[] = [];
    const classes: string[] = [];
    const modules: string[] = []; //Added Modules

    const walk = (node: any) => {
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
          if (node.type === "namespace_definition") modules.push(node.text);
          if (node.type === "function_definition") {
            const name = extractName(node);
            if (name) functions.push(name);
          }
          if (node.type === "class_specifier") {
            const name = extractName(node);
            if (name) classes.push(name);
          }
          break;
      }

      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i));
      }
    };

    walk(root);

    projectData.push({
      file: path.basename(filePath),
      path: filePath,
      imports,
      functions,
      classes,
      modules,
    });
  }

  return projectData;
}
