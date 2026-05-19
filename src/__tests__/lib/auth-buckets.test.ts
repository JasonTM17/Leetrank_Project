import { describe, it, expect, beforeEach } from "vitest";
import {
  loginAccountKey,
  bumpLoginBucketFor,
  _resetAuthBuckets,
} from "@/lib/auth-buckets";

describe("auth-buckets — login generation counter", () => {
  beforeEach(() => {
    _resetAuthBuckets();
  });

  it("starts at generation 0 for a fresh email", () => {
    expect(loginAccountKey("user@example.com")).toBe("login:user:user@example.com:gen0");
  });

  it("normalizes email by lowercasing and trimming", () => {
    const a = loginAccountKey("  USER@Example.COM  ");
    expect(a).toBe("login:user:user@example.com:gen0");
  });

  it("bump increments the generation suffix for the same email", () => {
    expect(loginAccountKey("a@x.c")).toBe("login:user:a@x.c:gen0");
    bumpLoginBucketFor("a@x.c");
    expect(loginAccountKey("a@x.c")).toBe("login:user:a@x.c:gen1");
    bumpLoginBucketFor("a@x.c");
    expect(loginAccountKey("a@x.c")).toBe("login:user:a@x.c:gen2");
  });

  it("isolates generations per email — bumping A does not affect B", () => {
    bumpLoginBucketFor("a@x.c");
    bumpLoginBucketFor("a@x.c");
    expect(loginAccountKey("a@x.c")).toBe("login:user:a@x.c:gen2");
    expect(loginAccountKey("b@x.c")).toBe("login:user:b@x.c:gen0");
  });

  it("treats different cases as the same account when bumping", () => {
    bumpLoginBucketFor("USER@X.C");
    expect(loginAccountKey("user@x.c")).toBe("login:user:user@x.c:gen1");
  });

  it("_resetAuthBuckets returns every email to gen0", () => {
    bumpLoginBucketFor("a@x.c");
    bumpLoginBucketFor("b@x.c");
    _resetAuthBuckets();
    expect(loginAccountKey("a@x.c")).toBe("login:user:a@x.c:gen0");
    expect(loginAccountKey("b@x.c")).toBe("login:user:b@x.c:gen0");
  });
});
