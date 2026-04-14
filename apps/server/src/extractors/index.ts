import type { SupportedLanguage } from "../types/scan";
import type { ExtractorFn } from "./types";

import { extractC } from "./c";
import { extractCSharp } from "./csharp";
import { extractJsTs } from "./jsTs";
import { extractCpp } from "./cpp";
import { extractGo } from "./go";
import { extractJava } from "./java";
import { extractKotlin } from "./kotlin";
import { extractPhp } from "./php";
import { extractPython } from "./python";
import { extractRuby } from "./ruby";
import { extractRust } from "./rust";
import { extractSwift } from "./swift";

export const Extractors: Record<SupportedLanguage, ExtractorFn> = {
  c: extractC,
  csharp: extractCSharp,
  cpp: extractCpp,
  go: extractGo,
  java: extractJava,
  javascript: extractJsTs,
  kotlin: extractKotlin,
  php: extractPhp,
  python: extractPython,
  ruby: extractRuby,
  rust: extractRust,
  swift: extractSwift,
  typescript: extractJsTs,
};
