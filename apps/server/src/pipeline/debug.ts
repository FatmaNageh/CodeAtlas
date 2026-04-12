import fs from "fs/promises";
import path from "path";
import type { FactsByFile } from "@/types";
import type { GraphIR } from "@/types";

export async function saveDebug(repoRoot: string, repoId: string, facts: FactsByFile, ir: GraphIR): Promise<string> {
  const dir = path.join(repoRoot, ".codeatlas", "debug", repoId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "factsByFile.json"), JSON.stringify(facts, null, 2), "utf-8");
  await fs.writeFile(path.join(dir, "ir.json"), JSON.stringify(ir, null, 2), "utf-8");
  return dir;
}
