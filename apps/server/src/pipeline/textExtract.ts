import fs from "fs/promises";
import crypto from "crypto";
import { CHUNK_VERSION } from "../types/graphProperties";
import type { TextFileIndexEntry } from "../types/scan";
import type { FactsByFile, TextFacts } from "../types/facts";

const DEFAULT_LINES_PER_CHUNK = 24;

function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function uniqBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }

  return out;
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

function buildChunks(
  text: string,
  linesPerChunk: number = DEFAULT_LINES_PER_CHUNK,
): TextFacts["chunks"] {
  if (!text.trim()) return [];

  const lines = splitLines(text);
  const chunks: TextFacts["chunks"] = [];

  for (let start = 0; start < lines.length; start += linesPerChunk) {
    const slice = lines.slice(start, start + linesPerChunk);
    const chunkText = slice.join("\n");

    if (!chunkText.trim()) continue;

    chunks.push({
      index: chunks.length,
      text: chunkText,
      startLine: start + 1,
      endLine: start + slice.length,
      chunkVersion: CHUNK_VERSION,
    });
  }

  return chunks;
}

function extractReferences(text: string): TextFacts["references"] {
  const references: TextFacts["references"] = [];

  // Markdown-style links: [label](path)
  const markdownLinkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = markdownLinkRe.exec(text))) {
    const raw = (match[1] || "").trim();
    if (!raw) continue;

    // Skip obvious external links
    if (/^(https?:\/\/|mailto:)/i.test(raw)) continue;

    references.push({ raw });
  }

  // Inline code blocks: `...`
  const inlineCodeRe = /`([^`]{1,200})`/g;
  while ((match = inlineCodeRe.exec(text))) {
    const token = (match[1] || "").trim();
    if (!token) continue;

    if (/\//.test(token) || /\.[A-Za-z0-9]{1,8}$/.test(token)) {
      references.push({ raw: token });
    }
  }

  return uniqBy(references, (r) => r.raw);
}

function extractSymbolMentions(text: string): TextFacts["symbolMentions"] {
  const mentions: TextFacts["symbolMentions"] = [];
  const inlineCodeRe = /`([^`]{1,200})`/g;
  let match: RegExpExecArray | null;

  while ((match = inlineCodeRe.exec(text))) {
    const token = (match[1] || "").trim();
    if (!token) continue;

    if (/^[A-Za-z_][\w]*$/.test(token)) {
      mentions.push({ name: token });
    }
  }

  return uniqBy(mentions, (m) => m.name);
}

export async function extractTextFacts(files: TextFileIndexEntry[]): Promise<FactsByFile> {
  const out: FactsByFile = {};

  for (const file of files) {
    const text = await fs.readFile(file.absPath, "utf-8").catch(() => "");
    const lineCount = text ? splitLines(text).length : 0;
    const textPreview = text ? text.slice(0, 4000) : "";
    const textHash = text ? sha1(text) : undefined;

    out[file.relPath] = {
      kind: "text",
      fileRelPath: file.relPath,
      references: extractReferences(text),
      symbolMentions: extractSymbolMentions(text),
      chunks: buildChunks(text, DEFAULT_LINES_PER_CHUNK),
      lineCount,
      textPreview,
      textHash,
    } satisfies TextFacts;
  }

  return out;
}