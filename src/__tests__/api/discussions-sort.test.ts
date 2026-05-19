import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/discussions/route";

describe("GET /api/discussions sort modes", () => {
  it("?sort=new orders by createdAt desc and skips JS-side hot rank", async () => {
    prismaMock.discussion.findMany.mockResolvedValue([
      { id: "d2", createdAt: new Date(), upvotes: 0, _count: { comments: 0, votes: 0 } },
      { id: "d1", createdAt: new Date(Date.now() - 60_000), upvotes: 5, _count: { comments: 0, votes: 0 } },
    ] as never);
    prismaMock.discussion.count.mockResolvedValue(2);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&sort=new")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sort).toBe("new");
    expect(data.discussions.map((d: { id: string }) => d.id)).toEqual(["d2", "d1"]);
    // Hot path uses groupBy; "new" must not call it.
    expect(prismaMock.discussionVote.groupBy).not.toHaveBeenCalled();
  });

  it("?sort=top orders by upvotes desc with createdAt tiebreak", async () => {
    prismaMock.discussion.findMany.mockResolvedValue([
      { id: "high", upvotes: 99, createdAt: new Date(), _count: { comments: 0, votes: 0 } },
      { id: "low", upvotes: 1, createdAt: new Date(), _count: { comments: 0, votes: 0 } },
    ] as never);
    prismaMock.discussion.count.mockResolvedValue(2);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&sort=top")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sort).toBe("top");
    const orderArg = prismaMock.discussion.findMany.mock.calls[0]?.[0]?.orderBy;
    expect(orderArg).toEqual([{ upvotes: "desc" }, { createdAt: "desc" }]);
  });

  it("?sort=hot ranks recent+upvoted ahead of older zero-vote post", async () => {
    const now = Date.now();
    const olderId = "older";
    const newerId = "newer-popular";

    prismaMock.discussion.findMany.mockResolvedValue([
      { id: olderId, createdAt: new Date(now - 24 * 60 * 60 * 1000), upvotes: 0, _count: { comments: 0, votes: 0 } },
      { id: newerId, createdAt: new Date(now - 30 * 1000), upvotes: 10, _count: { comments: 0, votes: 10 } },
    ] as never);
    prismaMock.discussion.count.mockResolvedValue(2);
    prismaMock.discussionVote.groupBy.mockResolvedValue([
      { discussionId: newerId, _sum: { value: 10 } },
      { discussionId: olderId, _sum: { value: 0 } },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&sort=hot")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sort).toBe("hot");
    expect(data.discussions[0].id).toBe(newerId);
    expect(data.discussions[1].id).toBe(olderId);
  });

  it("default sort is hot", async () => {
    prismaMock.discussion.findMany.mockResolvedValue([] as never);
    prismaMock.discussion.count.mockResolvedValue(0);
    prismaMock.discussionVote.groupBy.mockResolvedValue([] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1")));
    const data = await res.json();
    expect(data.sort).toBe("hot");
  });

  it("unknown sort falls back to hot", async () => {
    prismaMock.discussion.findMany.mockResolvedValue([] as never);
    prismaMock.discussion.count.mockResolvedValue(0);
    prismaMock.discussionVote.groupBy.mockResolvedValue([] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&sort=bogus")));
    const data = await res.json();
    expect(data.sort).toBe("hot");
  });
});

// Integration-style: post a thread, reply, upvote, then verify hot ranking.
// Pure mock-driven so we don't reach an actual DB — exercises the wiring.
describe("integration: post -> reply -> upvote -> hot order", () => {
  it("upvoted thread floats above older zero-vote thread on sort=hot", async () => {
    const oldId = "thr-old";
    const hotId = "thr-hot";
    const now = Date.now();

    // Thread create wiring (POST handler isn't exercised — we just simulate
    // the persisted state via the mocks the GET would see).
    prismaMock.discussion.findMany.mockResolvedValue([
      { id: oldId, createdAt: new Date(now - 6 * 60 * 60 * 1000), upvotes: 0, _count: { comments: 0, votes: 0 } },
      { id: hotId, createdAt: new Date(now - 60 * 1000), upvotes: 5, _count: { comments: 1, votes: 5 } },
    ] as never);
    prismaMock.discussion.count.mockResolvedValue(2);
    prismaMock.discussionVote.groupBy.mockResolvedValue([
      { discussionId: hotId, _sum: { value: 5 } },
      { discussionId: oldId, _sum: { value: 0 } },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&sort=hot")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.discussions[0].id).toBe(hotId);
    expect(data.discussions[1].id).toBe(oldId);
  });
});
