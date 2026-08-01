import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono()
  .use("*", cors())
  .get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }))
  .get("/api/family-members", (c) => {
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
