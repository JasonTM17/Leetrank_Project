import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/auth/sessions/route";

// /api/auth/sessions returns a list of the user's active sessions. We don't
// have a Session model yet — for now the endpoint returns the current session
// only (best-effort, derived from the cookie). When the Session model lands,
// the test will need to be updated; until then this pins the contract.

describe("GET /api/auth/sessions", () => {
  it("401 unauthenticated", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/auth/sessions")));
    expect(res.status).toBe(401);
    void prismaMock;
  });

  it("returns the current session as a single-entry list", async () => {
    await loginAs({ userId: "u1", username: "alice", role: "user" });
    const res = await GET(asNextRequest(new Request("http://x/api/auth/sessions")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].userId).toBe("u1");
    expect(data.sessions[0].current).toBe(true);
  });
});
