"use client";

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
  return (
    <div className="border-t max-h-64 overflow-y-auto">
      {submitStatus && (
        <div className={`px-4 py-3 text-sm font-medium ${
          submitStatus === "accepted" ? "bg-green-500/10 text-green-500" :
          "bg-red-500/10 text-red-500"
        }`}>
          {submitStatus === "accepted" ? "Accepted! All test cases passed." :
           submitStatus === "wrong_answer" ? "Wrong Answer" :
           submitStatus === "runtime_error" ? "Runtime Error" :
           "Submission Error"}
        </div>
      )}
      {results.length > 0 && (
        <div className="p-4 space-y-2">
          <h4 className="text-sm font-medium mb-2">Test Results</h4>
          {results.map((r, i) => (
            <Card key={i} className={`${r.passed ? "border-green-500/30" : "border-red-500/30"}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {r.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">Test Case {i + 1}</span>
                  {r.runtime && <span className="text-xs text-muted-foreground ml-auto">{r.runtime}ms</span>}
                </div>
                <div className="font-mono text-xs space-y-0.5 text-muted-foreground">
                  <div>Input: {r.input}</div>
                  <div>Expected: {r.expected}</div>
                  <div className={r.passed ? "text-green-500" : "text-red-500"}>
                    Output: {r.actual || r.error || "(empty)"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {results.length === 0 && !submitStatus && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Run your code to see results here
        </div>
      )}
    </div>
  );
}
