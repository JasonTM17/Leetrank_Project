"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChat } from "./use-chat";

interface ChatBotProps {
  /** Pass the authenticated user's id. Render null when not authenticated. */
  userId: string | null;
  /** Optional: scope chat history to a specific problem. */
  problemId?: string;
  /** Optional: scope chat history to a specific contest. */
  contestId?: string;
}

// TODO: replace with SSE streaming once the n8n workflow supports it.
// The current implementation shows the final reply only.

export function ChatBot({ userId, problemId, contestId }: ChatBotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sending, error, send, loadHistory } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history when the panel opens for the first time.
  const historyLoaded = useRef(false);
  useEffect(() => {
    if (open && !historyLoaded.current && userId) {
      historyLoaded.current = true;
      loadHistory(problemId);
    }
  }, [open, userId, problemId, loadHistory]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!userId) return null;

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput("");
    await send(trimmed, problemId, contestId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!open && (
          <Button
            onClick={() => setOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Open AI assistant"
            title="Ask the bot"
          >
            {/* Simple chat bubble icon — no external icon dep */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        )}
      </div>

      {/* Side panel */}
      {open && (
        <div
          className="fixed bottom-0 right-0 z-50 flex h-[600px] w-[380px] flex-col shadow-2xl"
          role="dialog"
          aria-label="AI assistant chat"
          aria-modal="true"
        >
          <Card className="flex h-full flex-col rounded-b-none rounded-tr-none">
            <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
              <CardTitle className="text-base font-semibold">AI Assistant</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="h-8 w-8"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </Button>
            </CardHeader>

            {/* Message list */}
            <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Ask anything about this problem or algorithms in general.
                </p>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <MessageContent content={msg.content} />
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </div>
              )}

              {error && (
                <p className="text-center text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div ref={bottomRef} />
            </CardContent>

            {/* Input row */}
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question…"
                  disabled={sending}
                  aria-label="Chat message input"
                  className="flex-1"
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={sending || !input.trim()}
                  size="sm"
                  aria-label="Send message"
                >
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

/** Renders message content, using <pre> for fenced code blocks. */
function MessageContent({ content }: { content: string }) {
  // Split on fenced code blocks.
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3).replace(/^\w+\n/, ""); // strip language tag
          return (
            <pre
              key={i}
              className="mt-1 overflow-x-auto rounded bg-background/50 p-2 font-mono text-xs"
            >
              <code>{inner}</code>
            </pre>
          );
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </>
  );
}
