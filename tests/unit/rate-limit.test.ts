import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { distributedRateLimit, distributedRateLimitIp, isDistributedRateLimitActive, memoryRateLimit } from "@/lib/distributed-rate-limit";

describe("rate-limit - distributedRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_KV_NAMESPACE_ID;
    delete process.env.CF_API_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to memory when KV not configured", async () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    
    const result1 = await distributedRateLimit("test", req, 5, 60_000);
    expect(result1.ok).toBe(true);
    
    // Make 5 requests - all should pass
    for (let i = 0; i < 4; i++) {
      const result = await distributedRateLimit("test", req, 5, 60_000);
      expect(result.ok).toBe(true);
    }
    
    // 6th request should fail
    const result6 = await distributedRateLimit("test", req, 5, 60_000);
    expect(result6.ok).toBe(false);
    expect(result6.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks different IPs separately", async () => {
    const req1 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    const req2 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.2" },
    });
    
    // Exhaust limit for IP 1
    for (let i = 0; i < 5; i++) {
      await distributedRateLimit("test-ip", new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      }), 5, 60_000);
    }
    
    // IP 1 should be rate limited
    const result1 = await distributedRateLimit("test-ip", new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    }), 5, 60_000);
    expect(result1.ok).toBe(false);
    
    // IP 2 should still work
    const result2 = await distributedRateLimit("test-ip", new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.2" },
    }), 5, 60_000);
    expect(result2.ok).toBe(true);
  });

  it("respects different key prefixes", async () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    
    // Exhaust limit for prefix "login"
    for (let i = 0; i < 5; i++) {
      await distributedRateLimit("login", req, 5, 60_000);
    }
    
    // login prefix should be rate limited
    const loginResult = await distributedRateLimit("login", req, 5, 60_000);
    expect(loginResult.ok).toBe(false);
    
    // order prefix should still work
    const orderResult = await distributedRateLimit("order", req, 5, 60_000);
    expect(orderResult.ok).toBe(true);
  });

  it("extracts IP from various headers", async () => {
    const testCases = [
      { header: "cf-connecting-ip", value: "1.2.3.4" },
      { header: "x-real-ip", value: "5.6.7.8" },
      { header: "x-forwarded-for", value: "9.10.11.12, 13.14.15.16" },
    ];
    
    for (const tc of testCases) {
      const req = new Request("http://localhost", {
        headers: { [tc.header]: tc.value },
      });
      const result = await distributedRateLimit(`test-header-${tc.header}`, req, 10, 60_000);
      expect(result.ok).toBe(true);
    }
  });

  it("handles missing IP gracefully", async () => {
    const req = new Request("http://localhost", {});
    const result = await distributedRateLimit("test-no-ip", req, 10, 60_000);
    expect(result.ok).toBe(true);
  });
});

describe("rate-limit - distributedRateLimitIp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_KV_NAMESPACE_ID;
    delete process.env.CF_API_TOKEN;
  });

  it("works with explicit IP parameter", async () => {
    const result = await distributedRateLimitIp("test-ip", "192.168.1.1", 5, 60_000);
    expect(result.ok).toBe(true);
    
    for (let i = 0; i < 4; i++) {
      const result = await distributedRateLimitIp("test-ip2", "192.168.1.2", 5, 60_000);
      expect(result.ok).toBe(true);
    }
    
    const result6 = await distributedRateLimitIp("test-ip2", "192.168.1.2", 5, 60_000);
    expect(result6.ok).toBe(false);
  });

  it("tracks different IPs separately", async () => {
    await distributedRateLimitIp("test-ip-separate", "192.168.1.1", 2, 60_000);
    await distributedRateLimitIp("test-ip-separate", "192.168.1.1", 2, 60_000);
    
    const result1 = await distributedRateLimitIp("test-ip-separate", "192.168.1.1", 2, 60_000);
    expect(result1.ok).toBe(false);
    
    const result2 = await distributedRateLimitIp("test-ip-separate", "192.168.1.2", 2, 60_000);
    expect(result2.ok).toBe(true);
  });
});

describe("rate-limit - isDistributedRateLimitActive", () => {
  it("returns false when KV not configured", () => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_KV_NAMESPACE_ID;
    delete process.env.CF_API_TOKEN;
    
    expect(isDistributedRateLimitActive()).toBe(false);
  });

  it("returns true when KV configured", () => {
    process.env.CF_ACCOUNT_ID = "test-account";
    process.env.CF_KV_NAMESPACE_ID = "test-namespace";
    process.env.CF_API_TOKEN = "test-token";
    
    expect(isDistributedRateLimitActive()).toBe(true);
    
    // Cleanup
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_KV_NAMESPACE_ID;
    delete process.env.CF_API_TOKEN;
  });
});

describe("rate-limit - memoryRateLimit (internal)", () => {
  it("respects window expiration", async () => {
    // This tests the internal memory rate limiter logic
    const { memoryRateLimit } = await import("@/lib/distributed-rate-limit");
    
    // We can't easily test the internal function due to module encapsulation
    // but we can verify the behavior through the public API
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    
    // Make requests up to limit
    for (let i = 0; i < 3; i++) {
      const result = await distributedRateLimit("window-test", new Request("http://localhost", {
        headers: { "x-forwarded-for": "10.0.0.1" },
      }), 3, 100); // 100ms window
      
      if (i < 3) expect(result.ok).toBe(true);
    }
    
    const result4 = await distributedRateLimit("window-test", new Request("http://localhost", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    }), 3, 100);
    expect(result4.ok).toBe(false);
    
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const resultAfterWindow = await distributedRateLimit("window-test", new Request("http://localhost", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    }), 3, 100);
    expect(resultAfterWindow.ok).toBe(true);
  });
});