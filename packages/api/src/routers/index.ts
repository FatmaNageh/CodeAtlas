import { publicProcedure, router } from "../index";
import type { CodeNode } from "../types/codeNode";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	fzf_Master: publicProcedure.query(async () => {
	const data = await fetch("http://localhost:3000/").then((res) => res.json());
	console.log(data);
																								
	const typedData = data as { project: string; data: CodeNode };
	return typedData;
	}),							
});
export type AppRouter = typeof appRouter;
