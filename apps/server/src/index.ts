import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@CodeAtlas/api/context";
import { appRouter } from "@CodeAtlas/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import path from "path";
import { serve } from "@hono/node-server";

import { healthRoute } from "./routes/health";
import { indexRepoRoute } from "./routes/indexRepo";
import { graphRoute } from "./routes/getRepo";

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

app.get("/", (c) => c.json({ ok: true, service: "CodeAtlas server", routes: ["/health", "POST /indexRepo", "/trpc/*", "getGraph"] }));

// Keep tRPC mounting (doesn't interfere with backend-only testing)
app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);


app.route("/", healthRoute);
app.route("/", indexRepoRoute);
app.route("/",graphRoute )
serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
