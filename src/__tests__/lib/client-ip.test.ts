import { describe, it, expect } from "vitest";
import { clientIp } from "@/lib/client-ip";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x", { headers });
}

describe("clientIp (Bug #20)", () => {
  it("returns 'unknown' when no headers are present", () => {
    expect(clientIp(reqWith({}))).toBe("unknown");
  });

  it("falls back to x-real-ip when XFF is absent", () => {
    expect(clientIp(reqWith({ "x-real-ip": "203.0.113.4" }))).toBe("203.0.113.4");
  });

  it("uses the rightmost XFF entry when no trusted proxy header is set", () => {
    const ip = clientIp(reqWith({
      "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
    }));
    expect(ip).toBe("3.3.3.3");
  });

  it("ignores XFF leftmost spoofing without the trusted-proxy token", () => {
    // Attacker injects a leftmost IP they don't own; we should not trust it.
    const ip = clientIp(reqWith({
      "x-forwarded-for": "evil-spoof, 198.51.100.7",
    }));
    expect(ip).toBe("198.51.100.7");
  });

  it("honors leftmost XFF when x-trusted-proxy matches TRUSTED_PROXY_TOKEN", () => {
    const prev = process.env.TRUSTED_PROXY_TOKEN;
    process.env.TRUSTED_PROXY_TOKEN = "shared-secret-xyz";
    try {
      const ip = clientIp(reqWith({
        "x-forwarded-for": "9.9.9.9, 10.0.0.1",
        "x-trusted-proxy": "shared-secret-xyz",
      }));
      expect(ip).toBe("9.9.9.9");
    } finally {
      if (prev === undefined) delete process.env.TRUSTED_PROXY_TOKEN;
      else process.env.TRUSTED_PROXY_TOKEN = prev;
    }
  });

  it("ignores x-trusted-proxy when token does not match", () => {
    const prev = process.env.TRUSTED_PROXY_TOKEN;
    process.env.TRUSTED_PROXY_TOKEN = "shared-secret-xyz";
    try {
      const ip = clientIp(reqWith({
        "x-forwarded-for": "9.9.9.9, 10.0.0.1",
        "x-trusted-proxy": "wrong",
      }));
      expect(ip).toBe("10.0.0.1");
    } finally {
      if (prev === undefined) delete process.env.TRUSTED_PROXY_TOKEN;
      else process.env.TRUSTED_PROXY_TOKEN = prev;
    }
  });
});
