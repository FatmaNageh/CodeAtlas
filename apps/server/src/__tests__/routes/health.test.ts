import { afterEach, describe, expect, it, vi } from "vitest";

describe("healthRoute", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 200 when Neo4j is reachable", async () => {
    vi.doMock("@/db/neo4j/client", () => ({
      getNeo4jClient: () => ({
        ping: vi.fn().mockResolvedValue(true),
      }),
    }));

    const { healthRoute } = await import("@/routes/health");
    const response = await healthRoute.request("http://localhost/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      neo4j: "ok",
    });
  });

  it("returns 503 when Neo4j is unreachable", async () => {
    vi.doMock("@/db/neo4j/client", () => ({
      getNeo4jClient: () => ({
        ping: vi.fn().mockRejectedValue(new Error("offline")),
      }),
    }));

    const { healthRoute } = await import("@/routes/health");
    const response = await healthRoute.request("http://localhost/health");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      neo4j: "unreachable",
    });
  });
});
