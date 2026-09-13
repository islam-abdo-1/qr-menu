import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

describe("API - /api/staff/login", () => {
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

  describe("POST /api/staff/login", () => {
    it("returns 400 for missing name or pin", async () => {
      const res = await fetch(`${baseUrl}/api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });

    it("returns 400 for invalid pin format", async () => {
      const res = await fetch(`${baseUrl}/api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ahmed",
          pin: "123", // Too short
        }),
      });
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });

    it("returns 401 for wrong pin", async () => {
      const res = await fetch(`${baseUrl}/api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ahmed",
          pin: "0000",
          slug: "test-restaurant",
        }),
      });
      
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("الكود السري غير صحيح");
    });

    it("returns 429 when rate limited", async () => {
      // Make multiple rapid requests to trigger rate limit
      const makeRequest = () => fetch(`${baseUrl}/api/staff/login`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.88.88", // Unique IP for this test
        },
        body: JSON.stringify({
          name: "TestUser",
          pin: "0000",
        }),
      });

      // Make 6 requests (limit is 5 per 15 min)
      const results = await Promise.all(Array(6).fill(null).map(() => 
        fetch(`${baseUrl}/api/staff/login`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-forwarded-for": "192.168.77.77", // Unique IP for this test
          },
          body: JSON.stringify({
            name: "RateLimitUser",
            pin: "0000",
          }),
        })
      ));
      
      // At least one should be rate limited (429)
      const rateLimited = results.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});