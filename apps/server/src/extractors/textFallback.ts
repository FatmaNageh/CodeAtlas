import type { RawCallSite, RawImport, RawSymbol, SymbolKind } from "@/types/facts";

import type { Extracted, ExtractorContext } from "./types";

type Range = NonNullable<RawSymbol["range"]>;

type TextLocator = {
  fromOffsets: (startOffset: number, endOffset: number) => Range;
  fromMatch: (match: RegExpExecArray, value?: string | null | undefined) => Range;
};

function emptyExtracted(): Extracted {
  return { imports: [], symbols: [], callSites: [] };
}

function createTextLocator(text: string): TextLocator {
  const lineStarts: number[] = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }

  function offsetToLineCol(offset: number): { line: number; col: number } {
    const boundedOffset = Math.max(0, Math.min(offset, text.length));
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const lineStart = lineStarts[mid] ?? 0;
      const nextLineStart = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY;

      if (boundedOffset < lineStart) {
        high = mid - 1;
        continue;
      }

      if (boundedOffset >= nextLineStart) {
        low = mid + 1;
        continue;
      }

      return { line: mid + 1, col: boundedOffset - lineStart + 1 };
    }

    const lastLineStart = lineStarts[lineStarts.length - 1] ?? 0;
    return {
      line: lineStarts.length,
      col: boundedOffset - lastLineStart + 1,
    };
  }

  return {
    fromOffsets(startOffset, endOffset) {
      const start = offsetToLineCol(startOffset);
      const end = offsetToLineCol(Math.max(startOffset, endOffset - 1));
      return {
        startLine: start.line,
        startCol: start.col,
        endLine: end.line,
        endCol: end.col,
      };
    },
    fromMatch(match, value) {
      const matchedText = match[0] ?? "";
      const startOffset = match.index;
      if (value) {
        const relativeIndex = matchedText.indexOf(value);
        if (relativeIndex >= 0) {
          return this.fromOffsets(startOffset + relativeIndex, startOffset + relativeIndex + value.length);
        }
      }
      return this.fromOffsets(startOffset, startOffset + matchedText.length);
    },
  };
}

function pushImport(imports: RawImport[], raw: string | null | undefined, range?: Range): void {
  const value = raw?.trim() ?? "";
  if (value.length > 0) imports.push({ raw: value, kind: "static", range });
}

function pushSymbol(
  symbols: RawSymbol[],
  kind: SymbolKind,
  name: string | null | undefined,
  qname?: string | null,
  parentName?: string | null,
  range?: Range,
): void {
  const cleanName = name?.trim() ?? "";
  if (!cleanName) return;
  symbols.push({
    kind,
    name: cleanName,
    qname: qname?.trim() || cleanName,
    parentName: parentName?.trim() || undefined,
    range,
  });
}

function pushCall(
  callSites: RawCallSite[],
  calleeText: string | null | undefined,
  enclosingSymbolQname?: string | null,
  range?: Range,
): void {
  const value = calleeText?.trim() ?? "";
  if (value.length > 0) {
    callSites.push({ calleeText: value, enclosingSymbolQname: enclosingSymbolQname?.trim() || undefined, range });
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
  const locator = createTextLocator(text);
  extractWithRegex(/^#include\s+[<"][^>"]+[>"]/gm, text, (match) =>
    pushImport(result.imports, match[0], locator.fromMatch(match)),
  );
  extractWithRegex(/\bstruct\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "struct", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\benum\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "enum", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/^[\t ]*[A-Za-z_][\w\s*]*\s+([A-Za-z_]\w*)\s*\([^;{]*\)\s*\{/gm, text, (match) => {
    pushSymbol(result.symbols, "function", match[1], undefined, undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\b([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return", "sizeof"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractCppText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^#include\s+[<"][^>"]+[>"]/gm, text, (match) =>
    pushImport(result.imports, match[0], locator.fromMatch(match)),
  );
  const namespaceMatch = /\bnamespace\s+([A-Za-z_]\w*)\s*\{/.exec(text);
  const namespaceName = namespaceMatch?.[1] ?? null;
  if (namespaceMatch && namespaceName) {
    pushSymbol(
      result.symbols,
      "namespace",
      namespaceName,
      namespaceName,
      undefined,
      locator.fromMatch(namespaceMatch),
    );
  }
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\};/g, text, (match) => {
    const className = match[1] ?? "";
    const qname = namespaceName ? `${namespaceName}::${className}` : className;
    pushSymbol(result.symbols, "class", className, qname, undefined, locator.fromMatch(match));
    extractWithRegex(/\b([A-Za-z_]\w*)\s*\([^;{)]*\)\s*\{/g, match[2] ?? "", (inner) => {
      const relativeStart = (match.index ?? 0) + match[0].indexOf(inner[0]);
      const range = locator.fromOffsets(relativeStart, relativeStart + inner[0].length);
      pushSymbol(result.symbols, "method", inner[1], `${qname}::${inner[1]}`, className, range);
    });
  });
  extractWithRegex(/^[\t ]*[A-Za-z_][\w\s:*&<>]*\s+([A-Za-z_]\w*)\s*\([^;{]*\)\s*\{/gm, text, (match) => {
    const name = match[1];
    if (name !== "run") {
      const qname = namespaceName ? `${namespaceName}::${name}` : name;
      pushSymbol(result.symbols, "function", name, qname, undefined, locator.fromMatch(match));
    }
  });
  extractWithRegex(/\b([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractCSharpText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^\s*using\s+[^;]+;/gm, text, (match) =>
    pushImport(result.imports, match[0], locator.fromMatch(match)),
  );
  const namespaceMatch = /\bnamespace\s+([A-Za-z_][\w.]*)\s*[;{]/.exec(text);
  const namespaceName = namespaceMatch?.[1] ?? null;
  if (namespaceMatch && namespaceName) {
    pushSymbol(
      result.symbols,
      "namespace",
      namespaceName,
      namespaceName,
      undefined,
      locator.fromMatch(namespaceMatch),
    );
  }
  extractWithRegex(/\b(interface|class|struct|record|enum)\s+([A-Za-z_]\w*)/g, text, (match) => {
    const kind = match[1] === "interface" ? "interface" : match[1] === "enum" ? "enum" : match[1] === "struct" ? "struct" : "class";
    const name = match[2] ?? "";
    const qname = namespaceName ? `${namespaceName}.${name}` : name;
    pushSymbol(result.symbols, kind, name, qname, undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\b(class|record)\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/g, text, (match) => {
    const typeName = match[2] ?? "";
    const typeQname = namespaceName ? `${namespaceName}.${typeName}` : typeName;
    extractWithRegex(/\b(?:public|private|protected|internal|static|virtual|override|sealed|abstract|\s)+([A-Za-z_]\w*)\s*\([^;{)]*\)/g, match[3] ?? "", (inner) => {
      const methodName = inner[1];
      if (methodName !== typeName) {
        const relativeStart = (match.index ?? 0) + match[0].indexOf(inner[0]);
        const range = locator.fromOffsets(relativeStart, relativeStart + inner[0].length);
        pushSymbol(result.symbols, "method", methodName, `${typeQname}.${methodName}`, typeName, range);
      }
    });
  });
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return", "new"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractGoText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  const pkgMatch = /\bpackage\s+([A-Za-z_]\w*)/.exec(text);
  const pkg = pkgMatch?.[1] ?? null;
  if (pkgMatch && pkg) {
    pushSymbol(result.symbols, "namespace", pkg, pkg, undefined, locator.fromMatch(pkgMatch));
  }
  extractWithRegex(/^import\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0], locator.fromMatch(match)));
  extractWithRegex(/\btype\s+([A-Za-z_]\w*)\s+struct\b/g, text, (match) => {
    pushSymbol(result.symbols, "struct", match[1], pkg ? `${pkg}.${match[1]}` : match[1], undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\bfunc\s+([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const name = match[1];
    pushSymbol(result.symbols, "function", name, pkg ? `${pkg}.${name}` : name, undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\bfunc\s*\(\s*[A-Za-z_]\w*\s+\*?([A-Za-z_]\w*)\s*\)\s*([A-Za-z_]\w*)\s*\(/g, text, (match) => {
    const typeName = match[1];
    const methodName = match[2];
    pushSymbol(result.symbols, "method", methodName, `${typeName}.${methodName}`, typeName, locator.fromMatch(match));
  });
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "switch", "return"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractPythonText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^(import\s+[^\n]+|from\s+[^\n]+\s+import\s+[^\n]+)/gm, text, (match) =>
    pushImport(result.imports, match[1], locator.fromMatch(match)),
  );
  const lines = text.split(/\r?\n/);
  let currentClass: string | null = null;
  let lineOffset = 0;
  for (const line of lines) {
    const classMatch = line.match(/^class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      currentClass = classMatch[1] ?? null;
      pushSymbol(
        result.symbols,
        "class",
        currentClass,
        undefined,
        undefined,
        locator.fromOffsets(lineOffset, lineOffset + line.length),
      );
      lineOffset += line.length + 1;
      continue;
    }
    const methodMatch = line.match(/^\s+def\s+([A-Za-z_]\w*)\s*\(/);
    if (methodMatch && currentClass) {
      pushSymbol(
        result.symbols,
        "method",
        methodMatch[1],
        `${currentClass}.${methodMatch[1]}`,
        currentClass,
        locator.fromOffsets(lineOffset, lineOffset + line.length),
      );
      lineOffset += line.length + 1;
      continue;
    }
    const functionMatch = line.match(/^def\s+([A-Za-z_]\w*)\s*\(/);
    if (functionMatch) {
      currentClass = null;
      pushSymbol(
        result.symbols,
        "function",
        functionMatch[1],
        undefined,
        undefined,
        locator.fromOffsets(lineOffset, lineOffset + line.length),
      );
      lineOffset += line.length + 1;
      continue;
    }
    const callMatch = line.match(/([A-Za-z_][\w.]*)\s*\(/g);
    if (callMatch) {
      for (const call of callMatch) {
        const callee = call.replace(/\s*\($/, "");
        const relativeIndex = line.indexOf(call);
        pushCall(
          result.callSites,
          callee,
          undefined,
          locator.fromOffsets(lineOffset + Math.max(0, relativeIndex), lineOffset + Math.max(0, relativeIndex) + callee.length),
        );
      }
    }
    lineOffset += line.length + 1;
  }
  return result;
}

function extractKotlinText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  const pkgMatch = /\bpackage\s+([A-Za-z_][\w.]*)/.exec(text);
  const pkg = pkgMatch?.[1] ?? null;
  if (pkgMatch && pkg) {
    pushSymbol(result.symbols, "namespace", pkg, pkg, undefined, locator.fromMatch(pkgMatch));
  }
  extractWithRegex(/^import\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0], locator.fromMatch(match)));
  extractWithRegex(/\binterface\s+([A-Za-z_]\w*)/g, text, (match) => {
    const qname = pkg ? `${pkg}.${match[1]}` : match[1];
    pushSymbol(result.symbols, "interface", match[1], qname, undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)/g, text, (match) => {
    const qname = pkg ? `${pkg}.${match[1]}` : match[1];
    pushSymbol(result.symbols, "class", match[1], qname, undefined, locator.fromMatch(match));
  });
  const classMatch = /\bclass\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/.exec(text);
  if (classMatch) {
    const typeName = classMatch[1];
    const typeQname = pkg ? `${pkg}.${typeName}` : typeName;
    extractWithRegex(/\bfun\s+([A-Za-z_]\w*)\s*\(/g, classMatch[2] ?? "", (match) => {
      const relativeStart = (classMatch.index ?? 0) + classMatch[0].indexOf(match[0]);
      const range = locator.fromOffsets(relativeStart, relativeStart + match[0].length);
      pushSymbol(result.symbols, "method", match[1], `${typeQname}.${match[1]}`, typeName, range);
    });
  }
  extractWithRegex(/^fun\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) => {
    const qname = pkg ? `${pkg}.${match[1]}` : match[1];
    pushSymbol(result.symbols, "function", match[1], qname, undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "when", "return"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractPhpText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^\s*use\s+[^;]+;/gm, text, (match) => pushImport(result.imports, match[0], locator.fromMatch(match)));
  extractWithRegex(/\binterface\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "interface", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "class", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  const classMatch = /\bclass\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/.exec(text);
  if (classMatch) {
    const typeName = classMatch[1];
    extractWithRegex(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g, classMatch[2] ?? "", (match) => {
      const relativeStart = (classMatch.index ?? 0) + classMatch[0].indexOf(match[0]);
      const range = locator.fromOffsets(relativeStart, relativeStart + match[0].length);
      pushSymbol(result.symbols, "method", match[1], `${typeName}::${match[1]}`, typeName, range);
    });
  }
  extractWithRegex(/^function\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) =>
    pushSymbol(result.symbols, "function", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\b([A-Za-z_][\w\\]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractRubyText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^\s*require(?:_relative)?\s+[^\n]+/gm, text, (match) =>
    pushImport(result.imports, match[0], locator.fromMatch(match)),
  );
  const classMatch = /\bclass\s+([A-Za-z_]\w*)[\s\S]*?end/m.exec(text);
  const className = classMatch?.[1] ?? null;
  if (classMatch && className) {
    pushSymbol(
      result.symbols,
      "class",
      className,
      undefined,
      undefined,
      locator.fromMatch(classMatch),
    );
  }
  extractWithRegex(/^\s*def\s+([A-Za-z_]\w*)/gm, text, (match) => {
    const methodName = match[1];
    const qname = className ? `${className}.${methodName}` : methodName;
    pushSymbol(result.symbols, "method", methodName, qname, className ?? undefined, locator.fromMatch(match));
  });
  extractWithRegex(/\b([A-Z]?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (callee !== "require") pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
  });
  extractWithRegex(/^\s+([a-z_]\w*)\s*$/gm, text, (match) => {
    const callee = match[1];
    if (callee !== "end") pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
  });
  return result;
}

function extractRustText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^use\s+[^\n;]+;/gm, text, (match) => pushImport(result.imports, match[0], locator.fromMatch(match)));
  extractWithRegex(/\bstruct\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "struct", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\btrait\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "trait", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\bimpl(?:<[^>]+>)?(?:\s+[A-Za-z_][\w:]*)?\s+for\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}/g, text, (match) => {
    const typeName = match[1];
    extractWithRegex(/\bfn\s+([A-Za-z_]\w*)\s*\(/g, match[2] ?? "", (inner) => {
      const relativeStart = (match.index ?? 0) + match[0].indexOf(inner[0]);
      const range = locator.fromOffsets(relativeStart, relativeStart + inner[0].length);
      pushSymbol(result.symbols, "method", inner[1], `${typeName}::${inner[1]}`, typeName, range);
    });
  });
  extractWithRegex(/^fn\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) =>
    pushSymbol(result.symbols, "function", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\b([A-Za-z_][\w:]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "match", "return"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
  });
  return result;
}

function extractSwiftText(text: string): Extracted {
  const result = emptyExtracted();
  const locator = createTextLocator(text);
  extractWithRegex(/^import\s+[^\n]+/gm, text, (match) => pushImport(result.imports, match[0], locator.fromMatch(match)));
  extractWithRegex(/\bprotocol\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "protocol", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\bclass\s+([A-Za-z_]\w*)/g, text, (match) =>
    pushSymbol(result.symbols, "class", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  const classMatch = /\bclass\s+([A-Za-z_]\w*)[\s\S]*?\{([\s\S]*?)\n\}/.exec(text);
  if (classMatch) {
    const className = classMatch[1];
    extractWithRegex(/\bfunc\s+([A-Za-z_]\w*)\s*\(/g, classMatch[2] ?? "", (match) => {
      const relativeStart = (classMatch.index ?? 0) + classMatch[0].indexOf(match[0]);
      const range = locator.fromOffsets(relativeStart, relativeStart + match[0].length);
      pushSymbol(result.symbols, "method", match[1], `${className}.${match[1]}`, className, range);
    });
  }
  extractWithRegex(/^func\s+([A-Za-z_]\w*)\s*\(/gm, text, (match) =>
    pushSymbol(result.symbols, "function", match[1], undefined, undefined, locator.fromMatch(match)),
  );
  extractWithRegex(/\b([A-Za-z_][\w.]*)\s*\(/g, text, (match) => {
    const callee = match[1] ?? "";
    if (!["if", "for", "while", "switch", "return"].includes(callee)) {
      pushCall(result.callSites, callee, undefined, locator.fromMatch(match, callee));
    }
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
