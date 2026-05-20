"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  Zap,
  MemoryStick,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SubmissionResultModalProps {
  open: boolean;
  onClose: () => void;
  status: string;
  runtime?: number | null;
  memory?: number | null;
  output?: string | null;
  error?: string | null;
  expected?: string | null;
  language?: string;
}

function extractLineNumber(error: string): number | null {
  const match = error.match(/line (\d+)/i) || error.match(/File .*, line (\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "accepted":
      return <CheckCircle2 className="h-10 w-10 text-green-500" aria-hidden="true" />;
    case "compile_error":
      return <AlertTriangle className="h-10 w-10 text-purple-500" aria-hidden="true" />;
    case "runtime_error":
      return <XCircle className="h-10 w-10 text-red-500" aria-hidden="true" />;
    case "wrong_answer":
      return <XCircle className="h-10 w-10 text-orange-500" aria-hidden="true" />;
    case "time_limit_exceeded":
      return <Clock className="h-10 w-10 text-orange-500" aria-hidden="true" />;
    case "memory_limit_exceeded":
      return <MemoryStick className="h-10 w-10 text-orange-500" aria-hidden="true" />;
    default:
      return <AlertTriangle className="h-10 w-10 text-muted-foreground" aria-hidden="true" />;
  }
}

function statusHeadline(status: string): string {
  switch (status) {
    case "accepted":
      return "Accepted!";
    case "compile_error":
      return "Compilation Error";
    case "runtime_error":
      return "Runtime Error";
    case "wrong_answer":
      return "Wrong Answer";
    case "time_limit_exceeded":
      return "Time Limit Exceeded";
    case "memory_limit_exceeded":
      return "Memory Limit Exceeded";
    default:
      return "Submission Error";
  }
}

function headlineColor(status: string): string {
  switch (status) {
    case "accepted":
      return "text-green-500";
    case "compile_error":
      return "text-purple-500";
    case "runtime_error":
      return "text-red-500";
    case "wrong_answer":
      return "text-orange-500";
    case "time_limit_exceeded":
    case "memory_limit_exceeded":
      return "text-orange-500";
    default:
      return "text-muted-foreground";
  }
}

export function SubmissionResultModal({
  open,
  onClose,
  status,
  runtime,
  memory,
  output,
  error,
  expected,
}: SubmissionResultModalProps) {
  const lineNum = error ? extractLineNumber(error) : null;

  return (
    <Dialog open={open} onClose={onClose} title={statusHeadline(status)} size="lg">
      <div className="flex flex-col items-center gap-4">
        {/* Icon + headline */}
        <StatusIcon status={status} />
        <h3 className={cn("text-xl font-bold", headlineColor(status))}>{statusHeadline(status)}</h3>

        {/* Accepted: stats */}
        {status === "accepted" && (
          <div className="w-full space-y-4">
            <div className="flex items-center justify-center gap-6">
              {runtime != null && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-green-500" aria-hidden="true" />
                  <span className="font-medium text-foreground">{runtime} ms</span>
                  runtime
                </div>
              )}
              {memory != null && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <HardDrive className="h-4 w-4 text-green-500" aria-hidden="true" />
                  <span className="font-medium text-foreground">{memory} MB</span>
                  memory
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "w-full rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white",
                "transition-all hover:bg-green-600 hover:shadow-glow focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              )}
            >
              Solve another
            </button>
          </div>
        )}

        {/* Compile error: formatted pre block */}
        {status === "compile_error" && error && (
          <div className="w-full space-y-2">
            {lineNum && (
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-500">
                Line {lineNum}
              </Badge>
            )}
            <pre
              className={cn(
                "w-full overflow-x-auto rounded-md border-l-4 border-purple-500",
                "bg-muted/50 p-3 text-xs font-mono text-foreground whitespace-pre-wrap"
              )}
            >
              {error}
            </pre>
          </div>
        )}

        {/* Runtime error: formatted pre block */}
        {status === "runtime_error" && error && (
          <div className="w-full space-y-2">
            {lineNum && (
              <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                Line {lineNum}
              </Badge>
            )}
            <pre
              className={cn(
                "w-full overflow-x-auto rounded-md border-l-4 border-red-500",
                "bg-muted/50 p-3 text-xs font-mono text-foreground whitespace-pre-wrap"
              )}
            >
              {error}
            </pre>
          </div>
        )}

        {/* Wrong answer: side-by-side diff */}
        {status === "wrong_answer" && (
          <div className="grid w-full grid-cols-2 gap-3">
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
              <p className="mb-1.5 text-xs font-semibold text-red-500">Your Output</p>
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                {output || "(empty)"}
              </pre>
            </div>
            <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3">
              <p className="mb-1.5 text-xs font-semibold text-green-500">Expected</p>
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                {expected || "(empty)"}
              </pre>
            </div>
          </div>
        )}

        {/* TLE hint */}
        {status === "time_limit_exceeded" && (
          <p className="text-sm text-muted-foreground text-center">
            Your solution exceeded the time limit. Consider optimizing your algorithm&apos;s time
            complexity or reducing unnecessary iterations.
          </p>
        )}

        {/* MLE hint */}
        {status === "memory_limit_exceeded" && (
          <p className="text-sm text-muted-foreground text-center">
            Your solution exceeded the memory limit. Consider using more space-efficient data
            structures or reducing allocations.
          </p>
        )}
      </div>
    </Dialog>
  );
}
