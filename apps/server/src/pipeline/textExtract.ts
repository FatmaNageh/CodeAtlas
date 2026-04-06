import fs from "fs/promises";
import crypto from "crypto";
import type { TextFileIndexEntry } from "../types/scan";
import type { FactsByFile, TextFacts } from "../types/facts";

function uniq<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/** Lightweight doc extraction: links/paths and backticked identifiers. */
export async function extractTextFacts(files: TextFileIndexEntry[]): Promise<FactsByFile> {
  const out: FactsByFile = {};

  for (const f of files) {
    const text = await fs.readFile(f.absPath, "utf-8").catch(() => "");
    const lineCount = text ? text.split(/\r\n|\r|\n/).length : 0;
    const textPreview = text ? text.slice(0, 4000) : "";
    const textHash = text ? crypto.createHash("sha1").update(text).digest("hex") : undefined;

    const references: TextFacts["references"] = [];
    const symbolMentions: TextFacts["symbolMentions"] = [];

    // Markdown-style links: [label](path)
    const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(text))) {
      const raw = (m[1] || "").trim();
      if (!raw) continue;
      // Skip obvious URLs
      if (/^(https?:\/\/|mailto:)/i.test(raw)) continue;
      references.push({ raw });
    }

    // Inline code blocks: `...`
    const btRe = /`([^`]{1,200})`/g;
    while ((m = btRe.exec(text))) {
      const tok = (m[1] || "").trim();
      if (!tok) continue;
      if (/\//.test(tok) || /\.[A-Za-z0-9]{1,6}$/.test(tok)) {
        references.push({ raw: tok });
      } else if (/^[A-Za-z_][\w]*$/.test(tok)) {
        symbolMentions.push({ name: tok });
      }
    }

    out[f.relPath] = {
      kind: "text",
      fileRelPath: f.relPath,
      references: uniq(references, (r) => r.raw),
      symbolMentions: uniq(symbolMentions, (s) => s.name),
      lineCount,
      textPreview,
      textHash,
    } satisfies TextFacts;
  }

  return out;
}
