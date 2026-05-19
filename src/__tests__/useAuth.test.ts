import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";

describe("useAuth (zustand store)", () => {
  beforeEach(() => {
    // Reset to the documented initial state between tests.
    useAuth.setState({ user: null, isLoading: true, isAuthenticated: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with user=null, isLoading=true, isAuthenticated=false", () => {
    const s = useAuth.getState();
    expect(s.user).toBeNull();
    expect(s.isLoading).toBe(true);
    expect(s.isAuthenticated).toBe(false);
  });

  it("setUser(user) flips isAuthenticated to true and clears isLoading", () => {
    const u = {
      id: "u1",
      email: "u1@x.c",
      username: "u1",
      role: "user" as const,
      avatarUrl: null,
      bio: null,
      createdAt: new Date().toISOString(),
    };
    useAuth.getState().setUser(u as never);
    const s = useAuth.getState();
    expect(s.user).toEqual(u);
    expect(s.isAuthenticated).toBe(true);
    expect(s.isLoading).toBe(false);
  });

  it("setUser(null) treats authentication as false", () => {
    useAuth.getState().setUser(null);
    const s = useAuth.getState();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isLoading).toBe(false);
  });

  it("setLoading toggles isLoading without touching user", () => {
    useAuth.setState({ user: { id: "u" } as never, isAuthenticated: true, isLoading: false });
    useAuth.getState().setLoading(true);
    const s = useAuth.getState();
    expect(s.isLoading).toBe(true);
    expect(s.user).toEqual({ id: "u" });
  });

  it("logout clears user + isAuthenticated even when fetch rejects (try/finally)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    useAuth.setState({ user: { id: "u" } as never, isAuthenticated: true, isLoading: false });

    // logout uses try/finally — the rejection propagates, but state is still cleared.
    await expect(useAuth.getState().logout()).rejects.toThrow("offline");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    const s = useAuth.getState();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it("logout posts to /api/auth/logout on the happy path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    useAuth.setState({ user: { id: "u" } as never, isAuthenticated: true, isLoading: false });

    await useAuth.getState().logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().isAuthenticated).toBe(false);
  });
});
