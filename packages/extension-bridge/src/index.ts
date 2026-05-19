import { z } from "zod";

const stoppedServerStatusSchema = z.object({
  status: z.literal("stopped"),
  port: z.literal(0),
  url: z.literal(""),
});

const startingServerStatusSchema = z.object({
  status: z.literal("starting"),
  port: z.number().int().nonnegative(),
  url: z.string(),
});

const runningServerStatusSchema = z.object({
  status: z.literal("running"),
  port: z.number().int().nonnegative(),
  url: z.string(),
});

const errorServerStatusSchema = z.object({
  status: z.literal("error"),
  port: z.number().int().nonnegative(),
  url: z.string(),
  error: z.string().optional(),
});

export const serverStatusSchema = z.discriminatedUnion("status", [
  stoppedServerStatusSchema,
  startingServerStatusSchema,
  runningServerStatusSchema,
  errorServerStatusSchema,
]);

export const codeAtlasInitialStateSchema = z.object({
  serverUrl: z.string(),
  repoId: z.string(),
  repoRoot: z.string(),
  neo4jBrowserUrl: z.string(),
  workspaceRoot: z.string(),
  autoRefresh: z.boolean(),
  serverStatus: serverStatusSchema,
});

export const webviewToHostMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("app/ready") }),
  z.object({ type: z.literal("app/getInitialState") }),
  z.object({ type: z.literal("app/openGraph") }),
  z.object({ type: z.literal("app/indexWorkspace") }),
  z.object({ type: z.literal("app/selectRepository") }),
  z.object({
    type: z.literal("app/indexRepository"),
    payload: z.object({ repoRoot: z.string().optional() }).optional(),
  }),
  z.object({
    type: z.literal("app/openFile"),
    payload: z.object({
      path: z.string(),
      line: z.number().int().positive().optional(),
      column: z.number().int().positive().optional(),
    }),
  }),
  z.object({ type: z.literal("app/openSettings") }),
  z.object({ type: z.literal("app/showError"), payload: z.object({ message: z.string() }) }),
  z.object({ type: z.literal("app/showInfo"), payload: z.object({ message: z.string() }) }),
  z.object({ type: z.literal("app/openNeo4jBrowser") }),
  z.object({
    type: z.literal("app/setChatContext"),
    payload: z.object({
      node: z.object({}).passthrough().nullable(),
      nodes: z.array(z.object({}).passthrough()),
    }),
  }),
]);

export const hostToWebviewMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("app/initialState"), payload: codeAtlasInitialStateSchema }),
  z.object({ type: z.literal("app/settingsChanged"), payload: codeAtlasInitialStateSchema }),
  z.object({ type: z.literal("app/serverStatusChanged"), payload: serverStatusSchema }),
  z.object({ type: z.literal("app/focusGraph") }),
  z.object({ type: z.literal("app/indexingStarted"), payload: z.object({ repoRoot: z.string() }) }),
  z.object({
    type: z.literal("app/indexingCompleted"),
    payload: z.object({ repoId: z.string(), repoRoot: z.string() }),
  }),
  z.object({
    type: z.literal("app/indexingFailed"),
    payload: z.object({ repoRoot: z.string(), error: z.string() }),
  }),
  z.object({
    type: z.literal("app/activeFileChanged"),
    payload: z.object({ path: z.string().nullable() }),
  }),
  z.object({
    type: z.literal("app/workspaceChanged"),
    payload: z.object({ workspaceRoot: z.string() }),
  }),
]);

export const webviewPersistedStateSchema = z.object({
  initialState: codeAtlasInitialStateSchema.optional(),
});

export type CodeAtlasInitialState = z.infer<typeof codeAtlasInitialStateSchema>;
export type ServerStatus = z.infer<typeof serverStatusSchema>;
export type WebviewToHostMessage = z.infer<typeof webviewToHostMessageSchema>;
export type HostToWebviewMessage = z.infer<typeof hostToWebviewMessageSchema>;
export type WebviewPersistedState = z.infer<typeof webviewPersistedStateSchema>;

export function parseWebviewToHostMessage(value: object | null): WebviewToHostMessage | null {
  const result = webviewToHostMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseHostToWebviewMessage(value: object | null): HostToWebviewMessage | null {
  const result = hostToWebviewMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseWebviewPersistedState(value: object | null): WebviewPersistedState | null {
  const result = webviewPersistedStateSchema.safeParse(value);
  return result.success ? result.data : null;
}
