import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import fs from "fs";
import path from "path";

const parser = new Parser();
parser.setLanguage(JavaScript as unknown as import("tree-sitter").Language);

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function parseProject(projectPath: string) {
  const allFiles = getAllFiles(projectPath);
  const projectData: any[] = [];

  for (const filePath of allFiles) {
    const code = fs.readFileSync(filePath, "utf8");
    const tree = parser.parse(code);
    const root = tree.rootNode;

    const imports: string[] = [];
    const functions: string[] = [];
    const classes: string[] = [];

    root.namedChildren.forEach((node) => {
      if (node.type === "import_statement") {
        imports.push(node.text);
      }
      if (node.type === "function_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) functions.push(nameNode.text);
      }
      if (node.type === "class_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) classes.push(nameNode.text);
      }
    });

    projectData.push({
      file: path.basename(filePath),
      path: filePath,
      imports,
      functions,
      classes,
    });
  }

  return projectData;
}
