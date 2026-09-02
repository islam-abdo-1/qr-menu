import { describe, it, expect, vi, afterEach } from "vitest";
import { getSessionCookieOptions } from "@/lib/session-cookies";
import { getSessionCookieOptions as ownerGetSessionCookieOptions } from "../../owner-app/lib/session-cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SEC-009: secure session cookie flag", () => {
  it("sets secure=true when NODE_ENV=production (qr-menu)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const opts = getSessionCookieOptions(60 * 60 * 24 * 30);
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
  });

  it("sets secure=false outside production (qr-menu)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const opts = getSessionCookieOptions(60 * 60 * 24 * 30);
    expect(opts.secure).toBe(false);
  });

  it("sets secure=true when NODE_ENV=production (owner-app)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const opts = ownerGetSessionCookieOptions(60 * 60 * 24);
    expect(opts.secure).toBe(true);
  });

  it("sets secure=false outside production (owner-app)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const opts = ownerGetSessionCookieOptions(60 * 60 * 24);
    expect(opts.secure).toBe(false);
  });
});
