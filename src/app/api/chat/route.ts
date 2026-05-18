import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  problemId: z.string().optional(),
  contestId: z.string().optional(),
});

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
  if (!webhookUrl) {
    console.warn("[chat] N8N_CHATBOT_WEBHOOK_URL is not set");
    return Response.json({ error: "Chatbot temporarily unavailable" }, { status: 503 });
  }

  const redactedMessage = redactLongCodeBlocks(message);

  let reply: string;
  try {
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.userId,
        ...(problemId ? { problemId } : {}),
        ...(contestId ? { contestId } : {}),
        message: redactedMessage,
        history: history.reverse().map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!n8nResponse.ok) {
      console.warn(`[chat] n8n returned non-200: ${n8nResponse.status}`);
      return Response.json({ error: "Chatbot temporarily unavailable" }, { status: 503 });
    }

    const data = (await n8nResponse.json()) as { reply?: string };
    if (typeof data.reply !== "string") {
      console.warn("[chat] n8n response missing reply field", data);
      return Response.json({ error: "Chatbot temporarily unavailable" }, { status: 503 });
    }
    reply = data.reply;
  } catch (err) {
    console.warn("[chat] n8n request failed:", err);
    return Response.json({ error: "Chatbot temporarily unavailable" }, { status: 503 });
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

  return Response.json(
    { messages },
    { headers: { "Cache-Control": "no-store" } }
  );
}
