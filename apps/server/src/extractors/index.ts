import type { SupportedLanguage } from "../types/scan";
import type { ExtractorFn } from "./types";

import { extractJsTs } from "./jsTs";
import { extractPython } from "./python";
import { extractJava } from "./java";
import { extractGo } from "./go";
import { extractCpp } from "./cpp";
import { extractRuby } from "./ruby";

export const Extractors: Record<SupportedLanguage, ExtractorFn> = {
  javascript: extractJsTs,
  typescript: extractJsTs,
  python: extractPython,
  java: extractJava,
  go: extractGo,
  cpp: extractCpp,
  ruby: extractRuby,
};