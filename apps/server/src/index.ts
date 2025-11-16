import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@CodeAtlas/api/context";
import { appRouter } from "@CodeAtlas/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import path from "path";
import { serve } from "@hono/node-server";


import { parseProject } from "./parser";
const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.get("/", (c) => {
	const baseDir = path.join(process.cwd(), "../../example_files/fzf-master/");
	
	
	try {
    // Call your parser
    const projectData = parseProject(baseDir);

    return c.json({
      project: path.basename(baseDir),
    //   filesAnalyzed: projectData.length,
      data: projectData,
    });
  } catch (err: any) {
    console.error("Error analyzing project:", err);
    return c.json({ error: err.message }, 500);
  }



});


serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
