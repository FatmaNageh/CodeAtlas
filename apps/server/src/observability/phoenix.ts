import { register } from "@arizeai/phoenix-otel";

let phoenixReady = false;

export function initPhoenixTracing(): void {
  if (phoenixReady) return;
  const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT ?? process.env.PHOENIX_ENDPOINT;
  if (!endpoint) return;

  register({
    projectName: process.env.PHOENIX_PROJECT_NAME ?? "codeatlas-server",
    url: endpoint,
    apiKey: process.env.PHOENIX_API_KEY,
    batch: true,
  });

  phoenixReady = true;
}
