"use client";

import { Loader2, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmissionProgressProps {
  status: string;
}

const TERMINAL_STATUSES = new Set([
  "accepted",
  "wrong_answer",
  "compile_error",
  "runtime_error",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "security_error",
]);

export function SubmissionProgress({ status }: SubmissionProgressProps) {
  if (TERMINAL_STATUSES.has(status)) return null;

  if (status === "queued") {
    return (
      <div
        role="status"
        aria-label="Submission queued"
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
          "border bg-muted/50 text-sm font-medium text-muted-foreground",
          "animate-fade-in-up"
        )}
      >
        <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Queued</span>
      </div>
    );
  }

  if (status === "judging") {
    return (
      <div
        role="status"
        aria-label="Judging in progress"
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
          "border border-blue-500/30 bg-blue-500/10 text-sm font-medium text-blue-500",
          "animate-fade-in-up"
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span>Judging</span>
      </div>
    );
  }

  // Fallback for unknown non-terminal statuses (e.g. "compiling")
  return (
    <div
      role="status"
      aria-label={`Status: ${status}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
        "border bg-muted/50 text-sm font-medium text-muted-foreground",
        "animate-fade-in-up"
      )}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      <span className="capitalize">{status}</span>
    </div>
  );
}
