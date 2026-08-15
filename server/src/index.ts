import { Hono } from "hono";
import { cors } from "hono/cors";

declare const process: { env: Record<string, string | undefined> };

const app = new Hono();

app.use("*", cors());

// Health check remains unauthenticated for Cloud Run startup/liveness probes
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Protect API endpoints with internal secret header when configured
app.use("/api/*", async (c, next) => {
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (internalApiKey) {
    const key = c.req.header("x-internal-api-key") || c.req.header("X-Internal-API-Key");
    if (key !== internalApiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  await next();
});

app.get("/api/family-members", (c) => {
    return c.json({
      members: [
        { id: "1", name: "Alice", relationship: "Spouse" },
        { id: "2", name: "Bob", relationship: "Child" },
      ],
    });
  })
  .post("/api/medical-records", async (c) => {
    const body = await c.req.json<{
      familyMemberId: string;
      encryptedData: string;
      iv: string;
    }>();

    // Mock DB insert return
    return c.json({
      success: true,
      record: {
        id: crypto.randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
      },
    });
  });

export type AppType = typeof app;

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
