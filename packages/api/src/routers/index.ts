import { publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return {
      ok: true,
      status: "OK",
    };
  }),
  serverInfo: publicProcedure.query(() => {
    return {
      ok: true,
      service: "CodeAtlas API",
    };
  }),
});

export type AppRouter = typeof appRouter;
