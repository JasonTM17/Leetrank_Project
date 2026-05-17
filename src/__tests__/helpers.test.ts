import { describe, it, expect } from "vitest";
import { jsonRequest, plainRequest, asNextRequest } from "./helpers";

describe("test helpers", () => {
  describe("jsonRequest", () => {
    it("serializes the body and sets content type", async () => {
      const req = jsonRequest("http://x/echo", { a: 1, b: "two" });
      expect(req.method).toBe("POST");
      expect(req.headers.get("Content-Type")).toBe("application/json");
      const body = await req.json();
      expect(body).toEqual({ a: 1, b: "two" });
    });

    it("respects an explicit method override", () => {
      const req = jsonRequest("http://x/echo", {}, { method: "PUT" });
      expect(req.method).toBe("PUT");
    });

    it("merges custom headers without dropping content type", () => {
      const req = jsonRequest("http://x/echo", {}, {
        headers: { "x-test": "abc" },
      });
      expect(req.headers.get("Content-Type")).toBe("application/json");
      expect(req.headers.get("x-test")).toBe("abc");
    });
  });

  describe("plainRequest", () => {
    it("returns a vanilla GET when no init is given", () => {
      const req = plainRequest("http://x/get");
      expect(req.method).toBe("GET");
    });
  });

  describe("asNextRequest", () => {
    it("attaches a nextUrl getter that exposes searchParams", () => {
      const req = asNextRequest(new Request("http://x/y?a=1&b=2"));
      expect(req.nextUrl.searchParams.get("a")).toBe("1");
      expect(req.nextUrl.searchParams.get("b")).toBe("2");
    });
  });
});
