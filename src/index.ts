import { serve } from "@hono/node-server";
import { Hono } from "hono";

import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
const parser = new Parser();
parser.setLanguage(JavaScript as unknown as import("tree-sitter").Language);
import path from "path";
import { fileURLToPath } from "url";
import { createGraph } from "./graph/creator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const driver = neo4j.driver(
//   'neo4j://localhost',
//   neo4j.auth.basic('neo4j', 'password')
// )

const app = new Hono();

app.get("/graph", (c) => {
  const graph = createGraph();
  return c.json(graph);
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
