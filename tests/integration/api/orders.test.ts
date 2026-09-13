import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

describe("API - /api/orders", () => {
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

  describe("POST /api/orders", () => {
    it("returns 400 for missing required fields", async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("returns 400 for dine-in without table number", async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: "test",
          customerName: "Test",
          type: "dine-in",
          items: [{ itemId: "1", qty: 1 }],
        }),
      });
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("اختر رقم الطاولة");
    });

    it("returns 400 for delivery without phone", async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: "test",
          customerName: "Test",
          type: "delivery",
          items: [{ itemId: "1", qty: 1 }],
        }),
      });
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("اكتب رقم الهاتف");
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: "test",
          customerName: "Test",
          type: "delivery",
          phone: "123",
          items: [{ itemId: "1", qty: 1 }],
        }),
      });
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("رقم الهاتف غير صحيح");
    });

    it("returns 429 when rate limited", async () => {
      // Make multiple rapid requests to trigger rate limit
      const makeRequest = () => fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.99.99", // Unique IP for this test
        },
        body: JSON.stringify({
          restaurantSlug: "test",
          customerName: "RateLimitTest",
          type: "dine-in",
          tableNo: "1",
          items: [{ itemId: "test-item", qty: 1 }],
          cartNonce: `test-${Date.now()}-${Math.random()}`,
        }),
      });

      // First 30 should pass (or fail for other reasons)
      const results = await Promise.all(Array(35).fill(null).map(() => makeRequest()));
      
      // At least one should be rate limited (429)
      const rateLimited = results.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});