import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import CPP from "tree-sitter-cpp";

const parser = new Parser();

export function getLanguageParser(ext: string): Parser {
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
    case ".cxx":
    case ".hpp":
      parser.setLanguage(CPP as any);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
  return parser;
}