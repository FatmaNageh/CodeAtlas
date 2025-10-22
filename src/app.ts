import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import path from 'path'
import { parseProject } from "./parser.js";

const app = new Hono()

// Endpoint to analyze project
app.get("/analyze", async (c) => {
  // You can change this path to wherever your test project is
  const baseDir = path.join(process.cwd(), "./example_files/fzf-master");

  try {
    // Call your parser
    const projectData = parseProject(baseDir);

    return c.json({
      project: path.basename(baseDir),
      filesAnalyzed: projectData.length,
      data: projectData,
    });
  } catch (err: any) {
    console.error("Error analyzing project:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Start server
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}/analyze`)
})
