import type { RawCallSite, RawImport, RawSymbol, SymbolKind } from "@/types/facts";

import type { Extracted, ExtractorContext } from "./types";

function emptyExtracted(): Extracted {
  return { imports: [], symbols: [], callSites: [] };
}

function pushImport(imports: RawImport[], raw: string | null | undefined): void {
  const value = raw?.trim() ?? "";
  if (value.length > 0) imports.push({ raw: value, kind: "static" });
}

function pushSymbol(
  symbols: RawSymbol[],
  kind: SymbolKind,
  name: string | null | undefined,
  qname?: string | null,
  parentName?: string | null,
): void {
  const cleanName = name?.trim() ?? "";
  if (!cleanName) return;
  symbols.push({
    kind,
    name: cleanName,
    qname: qname?.trim() || cleanName,
    parentName: parentName?.trim() || undefined,
  });
}

function pushCall(
  callSites: RawCallSite[],
  calleeText: string | null | undefined,
  enclosingSymbolQname?: string | null,
): void {
  const value = calleeText?.trim() ?? "";
  if (value.length > 0) {
    callSites.push({ calleeText: value, enclosingSymbolQname: enclosingSymbolQname?.trim() || undefined });
  }
}

function extractWithRegex(pattern: RegExp, text: string, onMatch: (match: RegExpExecArray) => void): void {
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    onMatch(match);
    match = pattern.exec(text);
  }
}

function extractCText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^#include\s+[<"][^>"]+[>"]/gm, text, (match) => pushImport(result.imports, match[0]));
  extractWithRegex(/\bstruct\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "struct", match[1]));
  extractWithRegex(/\benum\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "enum", match[1]));
  extractWithRegex(/^[\t ]*[A-Za-z_][\w\s*]*\s+([A-Za-z_]\w*)\s*\([^;{]*\)\s*\{/gm, text, (match) => {
    pushSymbol(result.symbols, "function", match[1]);
  });
  extractWithRegex(/\b([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return", "sizeof"].includes(callee)) {
      pushCall(result.callSites, callee);
    }
  });
  return result;
}

function extractCppText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^#include\s+[<"][^>"]+[>"]/gm, text, (match) => pushImport(result.imports, match[0]));
  const namespaceMatch = text.match(/\bnamespace\s+([A-Za-z_]\w*)\s*\{/);
  const namespaceName = namespaceMatch?.[1] ?? null;
  if (namespaceName) {
    pushSymbol(result.symbols, "namespace", namespaceName, namespaceName);
  }
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\};/g, text, (match) => {
    const className = match[1] ?? "";
    const qname = namespaceName ? `${namespaceName}::${className}` : className;
    pushSymbol(result.symbols, "class", className, qname);
    extractWithRegex(/\b([A-Za-z_]\w*)\s*\([^;{)]*\)\s*\{/g, match[2] ?? "", (inner) => {
      pushSymbol(result.symbols, "method", inner[1], `${qname}::${inner[1]}`, className);
    });
  });
  extractWithRegex(/^[\t ]*[A-Za-z_][\w\s:*&<>]*\s+([A-Za-z_]\w*)\s*\([^;{]*\)\s*\{/gm, text, (match) => {
    const name = match[1];
    if (name !== "run") {
      const qname = namespaceName ? `${namespaceName}::${name}` : name;
      pushSymbol(result.symbols, "function", name, qname);
    }
  });
  extractWithRegex(/\b([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return"].includes(callee)) {
      pushCall(result.callSites, callee);
    }
  });
  return result;
}

function extractCSharpText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^\s*using\s+[^;]+;/gm, text, (match) => pushImport(result.imports, match[0]));
  const namespaceMatch = text.match(/\bnamespace\s+([A-Za-z_][\w.]*)\s*[;{]/);
  const namespaceName = namespaceMatch?.[1] ?? null;
  if (namespaceName) {
    pushSymbol(result.symbols, "namespace", namespaceName, namespaceName);
  }
  extractWithRegex(/\b(interface|class|struct|record|enum)\s+([A-Za-z_]\w*)/g, text, (match) => {
    const kind = match[1] === "interface" ? "interface" : match[1] === "enum" ? "enum" : match[1] === "struct" ? "struct" : "class";
    const name = match[2] ?? "";
    const qname = namespaceName ? `${namespaceName}.${name}` : name;
    pushSymbol(result.symbols, kind, name, qname);
  });
  extractWithRegex(/\b(class|record)\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/g, text, (match) => {
    const typeName = match[2] ?? "";
    const typeQname = namespaceName ? `${namespaceName}.${typeName}` : typeName;
    extractWithRegex(/\b(?:public|private|protected|internal|static|virtual|override|sealed|abstract|\s)+([A-Za-z_]\w*)\s*\([^;{)]*\)/g, match[3] ?? "", (inner) => {
      const methodName = inner[1];
      if (methodName !== typeName) {
        pushSymbol(result.symbols, "method", methodName, `${typeQname}.${methodName}`, typeName);
      }
    });
  });
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return", "new"].includes(callee)) {
      pushCall(result.callSites, callee);
    }
  });
  return result;
}

function extractGoText(text: string): Extracted {
  const result = emptyExtracted();
  const pkg = text.match(/\bpackage\s+([A-Za-z_]\w*)/)?.[1] ?? null;
  if (pkg) pushSymbol(result.symbols, "namespace", pkg, pkg);
  extractWithRegex(/^import\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0]));
  extractWithRegex(/\btype\s+([A-Za-z_]\w*)\s+struct\b/g, text, (match) => {
    pushSymbol(result.symbols, "struct", match[1], pkg ? `${pkg}.${match[1]}` : match[1]);
  });
  extractWithRegex(/\bfunc\s+([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const name = match[1];
    pushSymbol(result.symbols, "function", name, pkg ? `${pkg}.${name}` : name);
  });
  extractWithRegex(/\bfunc\s*\(\s*[A-Za-z_]\w*\s+\*?([A-Za-z_]\w*)\s*\)\s*([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const typeName = match[1];
    const methodName = match[2];
    pushSymbol(result.symbols, "method", methodName, `${typeName}.${methodName}`, typeName);
  });
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "switch", "return"].includes(callee)) pushCall(result.callSites, callee);
  });
  return result;
}

function extractPythonText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^(import\s+[^\n]+|from\s+[^\n]+\s+import\s+[^\n]+)/gm, text, (match) => pushImport(result.imports, match[1]));
  const lines = text.split(/\r?\n/);
  let currentClass: string | null = null;
  for (const line of lines) {
    const classMatch = line.match(/^class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      currentClass = classMatch[1] ?? null;
      pushSymbol(result.symbols, "class", currentClass);
      continue;
    }
    const methodMatch = line.match(/^\s+def\s+([A-Za-z_]\w*)\s*\(/);
    if (methodMatch && currentClass) {
      pushSymbol(result.symbols, "method", methodMatch[1], `${currentClass}.${methodMatch[1]}`, currentClass);
      continue;
    }
    const functionMatch = line.match(/^def\s+([A-Za-z_]\w*)\s*\(/);
    if (functionMatch) {
      currentClass = null;
      pushSymbol(result.symbols, "function", functionMatch[1]);
      continue;
    }
    const callMatch = line.match(/([A-Za-z_][\w.]*)\s*\(/g);
    if (callMatch) {
      for (const call of callMatch) {
        pushCall(result.callSites, call.replace(/\s*\($/, ""));
      }
    }
  }
  return result;
}

function extractKotlinText(text: string): Extracted {
  const result = emptyExtracted();
  const pkg = text.match(/\bpackage\s+([A-Za-z_][\w.]*)/)?.[1] ?? null;
  if (pkg) pushSymbol(result.symbols, "namespace", pkg, pkg);
  extractWithRegex(/^import\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0]));
  extractWithRegex(/\binterface\s+([A-Za-z_]\w*)/g, text, (match) => {
    const qname = pkg ? `${pkg}.${match[1]}` : match[1];
    pushSymbol(result.symbols, "interface", match[1], qname);
  });
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)/g, text, (match) => {
    const qname = pkg ? `${pkg}.${match[1]}` : match[1];
    pushSymbol(result.symbols, "class", match[1], qname);
  });
  const classMatch = text.match(/\bclass\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/);
  if (classMatch) {
    const typeName = classMatch[1];
    const typeQname = pkg ? `${pkg}.${typeName}` : typeName;
    extractWithRegex(/\bfun\s+([A-Za-z_]\w*)\s*\(/g, classMatch[2] ?? "", (match) => {
      pushSymbol(result.symbols, "method", match[1], `${typeQname}.${match[1]}`, typeName);
    });
  }
  extractWithRegex(/^fun\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) => {
    const qname = pkg ? `${pkg}.${match[1]}` : match[1];
    pushSymbol(result.symbols, "function", match[1], qname);
  });
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "when", "return"].includes(callee)) pushCall(result.callSites, callee);
  });
  return result;
}

function extractPhpText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^\s*use\s+[^;]+;/gm, text, (match) => pushImport(result.imports, match[0]));
  extractWithRegex(/\binterface\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "interface", match[1]));
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "class", match[1]));
  const classMatch = text.match(/\bclass\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/);
  if (classMatch) {
    const typeName = classMatch[1];
    extractWithRegex(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g, classMatch[2] ?? "", (match) => {
      pushSymbol(result.symbols, "method", match[1], `${typeName}::${match[1]}`, typeName);
    });
  }
  extractWithRegex(/^function\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) => pushSymbol(result.symbols, "function", match[1]));
  extractWithRegex(/\b([A-Za-z_][\w\\]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return"].includes(callee)) pushCall(result.callSites, callee);
  });
  return result;
}

function extractRubyText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^\s*require(?:_relative)?\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0]));
  const classMatch = text.match(/\bclass\s+([A-Za-z_]\w*)[\s\S]*?end/m);
  const className = classMatch?.[1] ?? null;
  if (className) pushSymbol(result.symbols, "class", className);
  extractWithRegex(/^\s*def\s+([A-Za-z_]\w*)/gm, text, (match) => {
    const methodName = match[1];
    const qname = className ? `${className}.${methodName}` : methodName;
    pushSymbol(result.symbols, "method", methodName, qname, className ?? undefined);
  });
  extractWithRegex(/\b([A-Z]?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (callee !== "require") pushCall(result.callSites, callee);
  });
  extractWithRegex(/^\s+([a-z_]\w*)\s*$/gm, text, (match) => {
    const callee = match[1];
    if (callee !== "end") pushCall(result.callSites, callee);
  });
  return result;
}

function extractRustText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^use\s+[^\n;]+;/gm, text, (match) => pushImport(result.imports, match[0]));
  extractWithRegex(/\bstruct\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "struct", match[1]));
  extractWithRegex(/\btrait\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "trait", match[1]));
  extractWithRegex(/\bimpl(?:<[^>]+>)?(?:\s+[A-Za-z_][\w:]*)?\s+for\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}/g, text, (match) => {
    const typeName = match[1];
    extractWithRegex(/\bfn\s+([A-Za-z_]\w*)\s*\(/g, match[2] ?? "", (inner) => {
      pushSymbol(result.symbols, "method", inner[1], `${typeName}::${inner[1]}`, typeName);
    });
  });
  extractWithRegex(/^fn\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) => pushSymbol(result.symbols, "function", match[1]));
  extractWithRegex(/\b([A-Za-z_][\w:]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "match", "return"].includes(callee)) pushCall(result.callSites, callee);
  });
  return result;
}

function extractSwiftText(text: string): Extracted {
  const result = emptyExtracted();
  extractWithRegex(/^import\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0]));
  extractWithRegex(/\bprotocol\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "protocol", match[1]));
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)/g, text, (match) => pushSymbol(result.symbols, "class", match[1]));
  const classMatch = text.match(/\bclass\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/);
  if (classMatch) {
    const className = classMatch[1];
    extractWithRegex(/\bfunc\s+([A-Za-z_]\w*)\s*\(/g, classMatch[2] ?? "", (match) => {
      pushSymbol(result.symbols, "method", match[1], `${className}.${match[1]}`, className);
    });
  }
  extractWithRegex(/^func\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) => pushSymbol(result.symbols, "function", match[1]));
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return"].includes(callee)) pushCall(result.callSites, callee);
  });
  return result;
}

export function extractTextFallback(ctx: ExtractorContext): Extracted {
  switch (ctx.language) {
    case "c":
      return extractCText(ctx.text);
    case "cpp":
      return extractCppText(ctx.text);
    case "csharp":
      return extractCSharpText(ctx.text);
    case "go":
      return extractGoText(ctx.text);
    case "kotlin":
      return extractKotlinText(ctx.text);
    case "php":
      return extractPhpText(ctx.text);
    case "python":
      return extractPythonText(ctx.text);
    case "ruby":
      return extractRubyText(ctx.text);
    case "rust":
      return extractRustText(ctx.text);
    case "swift":
      return extractSwiftText(ctx.text);
    default:
      return emptyExtracted();
  }
}
