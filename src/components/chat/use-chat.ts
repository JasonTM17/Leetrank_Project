"use client";

import { useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  send: (message: string, problemId?: string, contestId?: string) => Promise<void>;
  loadHistory: (problemId?: string) => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (message: string, problemId?: string, contestId?: string) => {
      setError(null);
      setSending(true);

      // Optimistic user message (no id yet).
      const optimisticId = `optimistic-${Date.now()}`;
      const userMsg: ChatMessage = {
        id: optimisticId,
        role: "user",
        content: message,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            ...(problemId ? { problemId } : {}),
            ...(contestId ? { contestId } : {}),
          }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `Request failed: ${res.status}`);
        }

        const data = (await res.json()) as { reply: string; messageId: string };

        const assistantMsg: ChatMessage = {
          id: data.messageId,
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        // Remove the optimistic message on failure.
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    []
  );

  const loadHistory = useCallback(async (problemId?: string) => {
    setError(null);
    try {
      const url = problemId ? `/api/chat?problemId=${encodeURIComponent(problemId)}` : "/api/chat";
      const res = await fetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    }
  }, []);

  return { messages, sending, error, send, loadHistory };
}
