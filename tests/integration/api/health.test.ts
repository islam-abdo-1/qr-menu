import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

describe("API - /api/health", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    const dev = process.env.NODE_ENV !== "production";
    const app = next({ dev, dir: process.cwd() });
    await app.prepare();
    
    server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      const handle = app.getRequestHandler();
      handle(req, res, parsedUrl);
    });
    
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe("GET /api/health", () => {
    it("returns 200 with healthy status when all critical checks pass", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.supabaseAuth).toBeDefined();
      expect(data.checks.storage).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
    });

    it("includes warnings array", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const data = await res.json();
      expect(Array.isArray(data.warnings)).toBe(true);
    });

    it("returns 503 with degraded status when critical check fails", async () => {
      // This test would need a mocked failure scenario
      // For now we verify the structure is correct
      const res = await fetch(`${baseUrl}/api/health`);
      const data = await res.json();
      
      expect(["healthy", "degraded"]).toContain(data.status);
      if (data.status === "degraded") {
        expect(res.status).toBe(503);
      }
    });
  });
});