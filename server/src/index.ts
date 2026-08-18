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

const familyMembers = [
  { id: "1", name: "Alice", relationship: "Spouse" },
  { id: "2", name: "Bob", relationship: "Child" },
];

type MedicalRecord = {
  id: string;
  familyMemberId: string;
  encryptedData: string;
  iv: string;
  createdAt: string;
};

// In-memory store for local/dev UI flows (replaced by DB later)
const medicalRecords: MedicalRecord[] = [];

const routes = app
  .get("/api/family-members", (c) => {
    return c.json({ members: familyMembers });
  })
  .get("/api/family-members/:id/medical-records", (c) => {
    const familyMemberId = c.req.param("id");
    const member = familyMembers.find((m) => m.id === familyMemberId);
    if (!member) {
      return c.json({ error: "Family member not found" }, 404);
    }

    const records = medicalRecords
      .filter((r) => r.familyMemberId === familyMemberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return c.json({ records });
  })
  .post("/api/medical-records", async (c) => {
    const body = await c.req.json<{
      familyMemberId: string;
      encryptedData: string;
      iv: string;
    }>();

    if (!body.familyMemberId || !body.encryptedData || !body.iv) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const member = familyMembers.find((m) => m.id === body.familyMemberId);
    if (!member) {
      return c.json({ error: "Family member not found" }, 404);
    }

    const record: MedicalRecord = {
      id: crypto.randomUUID(),
      familyMemberId: body.familyMemberId,
      encryptedData: body.encryptedData,
      iv: body.iv,
      createdAt: new Date().toISOString(),
    };

    medicalRecords.push(record);

    return c.json({
      success: true,
      record,
    });
  });

export type AppType = typeof routes;

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
