import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  problemId: z.string().optional(),
  contestId: z.string().optional(),
});

// HMAC the outbound n8n webhook so the workflow can reject forged requests.
// docs/runbooks/n8n.md describes the verification side. In production the
// secret is required; in dev/test we log a warning and skip signing so local
// stacks without n8n configured continue to work.
let n8nHmacWarned = false;
function n8nHmacSecret(): string | null {
  const v = process.env.N8N_HMAC_SECRET;
  if (v && v.length >= 16) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error("N8N_HMAC_SECRET must be set (16+ chars) in production");
  }
  if (!n8nHmacWarned) {
    console.warn("[chat] N8N_HMAC_SECRET unset — skipping HMAC signing (dev only)");
    n8nHmacWarned = true;
  }
  return null;
}

/** Strip code blocks longer than 200 lines to avoid shipping full submissions to the LLM. */
function redactLongCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split("\n");
    if (lines.length > 200) {
      return "```\n<truncated>\n```";
    }
    return match;
  });
}

/**
 * Local fallback reply generator when n8n / external LLM is not configured.
 * Provides simple keyword-based hints so the chatbot UI keeps working in dev
 * and standalone deployments. Production should always have n8n configured.
 */
function generateLocalReply(message: string, problemId?: string): string {
  const lower = message.toLowerCase().trim();
  if (/^(hi|hello|hey|chào|xin chào)/.test(lower)) {
    return "Hi! I'm the LeetRank assistant. Ask me about a problem (paste the prompt or share your approach) and I'll help you reason through it.";
  }
  if (/(hint|gợi ý|help|stuck|không biết)/.test(lower)) {
    return problemId
      ? "Try walking through the problem on a small example first. What's the input shape, and what should the output look like? Share your current approach and I'll suggest where to focus."
      : "Pick a problem and I'll guide you. Common starting points: identify the input pattern, think about brute force first, then optimize with a data structure (hash, heap, two pointers).";
  }
  if (/(time|timeout|tle|too slow|chậm)/.test(lower)) {
    return "TLE usually means your algorithm is one complexity class too high. Look at nested loops — can you replace one with a hashmap lookup? Sort once and binary-search? Sliding window?";
  }
  if (/(wrong|wa|fail|sai)/.test(lower)) {
    return "Wrong answer often comes from edge cases: empty input, single element, duplicates, negatives, integer overflow. Try the smallest possible test case manually and compare your output to the expected.";
  }
  if (/(complexity|big-o|o\(|độ phức tạp)/.test(lower)) {
    return "Count your nested loops and the size of any data structures you build. O(n) is one pass; O(n log n) is sort or balanced tree; O(n²) is double loop. The constraints in the problem usually tell you what's required.";
  }
  if (/(thank|thanks|cảm ơn)/.test(lower)) {
    return "Glad to help! Keep practicing — consistency beats intensity.";
  }
  return "I hear you. Could you share more context — the problem statement, your current approach, or the specific test case that's failing? The more concrete you are, the more useful my hints can be.";
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`chat:${session.userId}`, 10, 60_000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Invalid input";
    return Response.json({ error: firstError }, { status: 400 });
  }

  const { message, problemId, contestId } = parsed.data;

  // Persist the user message.
  const userMessage = await prisma.chatMessage.create({
    data: {
      userId: session.userId,
      problemId: problemId ?? null,
      contestId: contestId ?? null,
      role: "user",
      content: message,
    },
  });

  // Fetch recent history for context (last 10 messages before this one).
  const history = await prisma.chatMessage.findMany({
    where: {
      userId: session.userId,
      ...(problemId ? { problemId } : {}),
      id: { not: userMessage.id },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { role: true, content: true },
  });

  const webhookUrl = process.env.N8N_CHATBOT_WEBHOOK_URL;
  const redactedMessage = redactLongCodeBlocks(message);

  let reply: string;

  if (!webhookUrl) {
    // Local fallback when n8n is not configured (dev/standalone deployments).
    // Returns a canned but useful response so the chatbot UI keeps working.
    reply = generateLocalReply(redactedMessage, problemId);
  } else {
    try {
      const rawBody = JSON.stringify({
        userId: session.userId,
        ...(problemId ? { problemId } : {}),
        ...(contestId ? { contestId } : {}),
        message: redactedMessage,
        history: history
          .reverse()
          .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const secret = n8nHmacSecret();
      if (secret) {
        headers["X-LeetRank-Signature"] = createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");
      }

      const n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(30_000),
      });

      if (!n8nResponse.ok) {
        console.warn(
          `[chat] n8n returned non-200: ${n8nResponse.status} — falling back to local reply`
        );
        reply = generateLocalReply(redactedMessage, problemId);
      } else {
        const data = (await n8nResponse.json()) as { reply?: string };
        if (typeof data.reply !== "string") {
          console.warn("[chat] n8n response missing reply field — falling back to local reply");
          reply = generateLocalReply(redactedMessage, problemId);
        } else {
          reply = data.reply;
        }
      }
    } catch (err) {
      console.warn("[chat] n8n request failed, falling back to local reply:", err);
      reply = generateLocalReply(redactedMessage, problemId);
    }
  }

  // Persist the assistant reply.
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      userId: session.userId,
      problemId: problemId ?? null,
      contestId: contestId ?? null,
      role: "assistant",
      content: reply,
    },
  });

  return Response.json({ reply, messageId: assistantMessage.id });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const problemId = searchParams.get("problemId") ?? undefined;

  const messages = await prisma.chatMessage.findMany({
    where: {
      userId: session.userId,
      ...(problemId ? { problemId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
