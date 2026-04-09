import { indexRepository } from "../src/pipeline/indexRepo";

async function main() {
  const result = await indexRepository({
    projectPath: "E:/Graduation Project/CodeAtlas/example_files/project",
    mode: "full",
    saveDebugJson: false,
    dryRun: false,
  });
  
  console.log("=== IR STATS ===");
  console.log("files:", result.stats.files);
  console.log("dirs:", result.stats.dirs);
  console.log("astNodes:", result.stats.astNodes);
  console.log("textChunks:", result.stats.textChunks);
  console.log("references:", result.stats.references);
}

main().catch(console.error);
