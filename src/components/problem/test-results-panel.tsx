"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

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
                  <div>
                    {t("expectedLabel")}: {r.expected}
                  </div>
                  <div className={r.passed ? "text-green-500" : "text-red-500"}>
                    {t("outputLabel")}: {r.actual || r.error || t("emptyOutput")}
                  </div>
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
