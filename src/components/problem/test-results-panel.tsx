"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface TestResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtime?: number;
  error?: string;
}

interface TestResultsPanelProps {
  results: TestResult[];
  submitStatus: string | null;
}

export function TestResultsPanel({ results, submitStatus }: TestResultsPanelProps) {
  const t = useTranslations("problems");
  const statusLabel = (status: string): string => {
    switch (status) {
      case "submitting":
        return "Submitting…";
      case "queued":
        return "Queued — waiting for judge…";
      case "judging":
        return "Judging…";
      case "accepted":
        return t("accepted");
      case "wrong_answer":
        return t("wrongAnswer");
      case "runtime_error":
        return t("runtimeError");
      case "time_limit_exceeded":
        return t("timeLimitExceeded");
      case "compile_error":
        return "Compilation Error";
      case "memory_limit_exceeded":
        return "Memory Limit Exceeded";
      case "security_error":
        return "Security Violation";
      default:
        return t("submissionError");
    }
  };

  const statusColor = (status: string): string => {
    switch (status) {
      case "submitting":
      case "queued":
      case "judging":
        return "bg-blue-500/10 text-blue-500 animate-pulse";
      case "accepted":
        return "bg-green-500/10 text-green-500";
      case "wrong_answer":
        return "bg-red-500/10 text-red-500";
      case "compile_error":
        return "bg-purple-500/10 text-purple-500";
      case "runtime_error":
        return "bg-red-500/10 text-red-500";
      case "time_limit_exceeded":
        return "bg-orange-500/10 text-orange-500";
      case "memory_limit_exceeded":
        return "bg-orange-500/10 text-orange-600";
      case "security_error":
        return "bg-red-700/10 text-red-700";
      default:
        return "bg-muted/30 text-muted-foreground";
    }
  };

  return (
    <div className="border-t max-h-64 overflow-y-auto">
      {submitStatus && (
        <div className={`px-4 py-3 text-sm font-medium ${statusColor(submitStatus)}`}>
          {statusLabel(submitStatus)}
        </div>
      )}
      {/* Dedicated error block for compile/runtime errors */}
      {submitStatus &&
        (submitStatus === "compile_error" || submitStatus === "runtime_error") &&
        results[0]?.error && (
          <div
            className={`mx-4 mt-3 rounded-md border-l-4 p-3 ${
              submitStatus === "compile_error"
                ? "border-l-purple-500 bg-purple-500/5"
                : "border-l-red-500 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle
                className={`h-4 w-4 ${
                  submitStatus === "compile_error" ? "text-purple-500" : "text-red-500"
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  submitStatus === "compile_error" ? "text-purple-600" : "text-red-600"
                }`}
              >
                {submitStatus === "compile_error" ? "Compilation Error" : "Runtime Error"}
              </span>
              {(() => {
                const lineMatch = results[0].error!.match(/[,:]?\s*line\s+(\d+)/i);
                return lineMatch ? (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    Line {lineMatch[1]}
                  </span>
                ) : null;
              })()}
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground leading-relaxed">
              {results[0].error}
            </pre>
          </div>
        )}

      {/* Accepted banner */}
      {submitStatus === "accepted" && results.length > 0 && (
        <div className="mx-4 mt-3 rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-green-600">All tests passed</span>
            {results.some((r) => r.runtime) && (
              <span className="ml-2 text-xs text-muted-foreground">
                Avg runtime:{" "}
                {Math.round(
                  results.reduce((sum, r) => sum + (r.runtime || 0), 0) /
                    results.filter((r) => r.runtime).length
                )}
                ms
              </span>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="p-4 space-y-2">
          <h4 className="text-sm font-medium mb-2">{t("testResults")}</h4>
          {results.map((r, i) => (
            <Card key={i} className={`${r.passed ? "border-green-500/30" : "border-red-500/30"}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {r.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {t("testCase")} {i + 1}
                  </span>
                  {r.runtime && (
                    <span className="text-xs text-muted-foreground ml-auto">{r.runtime}ms</span>
                  )}
                </div>
                <div className="font-mono text-xs space-y-0.5 text-muted-foreground">
                  <div>
                    {t("inputLabel")}: {r.input}
                  </div>
                  {/* Side-by-side diff for wrong_answer */}
                  {!r.passed && r.actual && r.expected && !r.error ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-muted/50 overflow-hidden">
                      <div className="bg-green-50 dark:bg-green-950/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400 mb-1 font-semibold">
                          {t("expectedLabel")}
                        </div>
                        <pre className="whitespace-pre-wrap text-green-700 dark:text-green-300">
                          {r.expected}
                        </pre>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-red-600 dark:text-red-400 mb-1 font-semibold">
                          {t("outputLabel")}
                        </div>
                        <pre className="whitespace-pre-wrap text-red-700 dark:text-red-300">
                          {r.actual}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        {t("expectedLabel")}: {r.expected}
                      </div>
                      <div className={r.passed ? "text-green-500" : "text-red-500"}>
                        {t("outputLabel")}: {r.actual || r.error || t("emptyOutput")}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {results.length === 0 && !submitStatus && (
        <div className="p-4 text-center text-sm text-muted-foreground">{t("runHint")}</div>
      )}
    </div>
  );
}
