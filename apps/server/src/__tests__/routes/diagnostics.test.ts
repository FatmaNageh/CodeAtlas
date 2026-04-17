import { describe, expect, it } from "vitest";

import { diagnosticsRoute } from "@/routes/diagnostics";

describe("diagnosticsRoute", () => {
  it("returns 404 from /tester when the asset is missing", async () => {
    const response = await diagnosticsRoute.request("http://localhost/tester");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: "tester asset is not available in this build",
    });
  });
});
