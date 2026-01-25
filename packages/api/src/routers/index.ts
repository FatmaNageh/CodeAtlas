import { publicProcedure, router } from "../index";
import type { CodeNode } from "../types/codeNode";
import path from "path";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	fzf_Master: publicProcedure.query(async ({ ctx }) => {
		const baseDir = path.join(process.cwd(), "../../example_files/");
		
		if (!ctx.backendServices?.parseProject) {
			throw new Error("Backend parseProject service not configured");
		}

		try {
			const projectData = await ctx.backendServices.parseProject(baseDir);
			
			return {
				project: path.basename(baseDir),
				data: projectData as unknown as CodeNode
			};
		} catch (err: any) {
			console.error("Error analyzing project:", err);
			throw new Error(`Failed to parse project: ${err.message}`);
		}
	}),							
});
export type AppRouter = typeof appRouter;
