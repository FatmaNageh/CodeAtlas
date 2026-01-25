import type { Context as HonoContext } from "hono";

export type BackendServices = {
	parseProject: (projectPath: string) => Promise<any>;
};

export type CreateContextOptions = {
	context: HonoContext;
	backendServices?: BackendServices;
};

export async function createContext({ context, backendServices }: CreateContextOptions) {
	// No auth configured
	return {
		session: null,
		backendServices,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
