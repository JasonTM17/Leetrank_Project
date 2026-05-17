"use client";

import { useEffect, useState, use } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDifficultyBg } from "@/lib/utils";
import { Play, Send, CheckCircle2, XCircle, Loader2, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  hints?: string;
  constraints?: string;
  starterCode?: string;
  tags: { id: string; name: string }[];
  testCases: { id: string; input: string; expected: string; order: number }[];
}

interface TestResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtime?: number;
  error?: string;
}

export default function ProblemDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [showHints, setShowHints] = useState(false);

  useEffect(() => {
    fetch(`/api/problems/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setProblem(data.problem);
        if (data.problem?.starterCode) {
          try {
            const starters = JSON.parse(data.problem.starterCode);
            setCode(starters[language] || starters.python || "");
          } catch {
            setCode(data.problem.starterCode);
          }
        }
      })
      .catch(() => setProblem(null))
      .finally(() => setLoading(false));
  }, [slug, language]);

  async function handleRun() {
    if (!problem) return;
    setRunning(true);
    setResults([]);
    setSubmitStatus(null);

    try {
      const res = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          testCases: problem.testCases.map((tc) => ({ input: tc.input, expected: tc.expected })),
        }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!problem) return;
    setSubmitting(true);
    setSubmitStatus(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          problemId: problem.id,
        }),
      });
      const data = await res.json();
      setSubmitStatus(data.submission?.status || "error");
      if (data.results) setResults(data.results);
    } catch {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!problem) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Problem not found</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
        {/* Left Panel - Problem Description */}
        <div className="lg:w-1/2 border-r overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-2xl font-bold">{problem.title}</h1>
              <Badge className={getDifficultyBg(problem.difficulty)}>
                {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
              </Badge>
            </div>

            <div className="flex gap-2 mb-6">
              {problem.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
              ))}
            </div>

            <div className="flex gap-4 border-b mb-6">
              <button
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "description" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                }`}
                onClick={() => setActiveTab("description")}
              >
                Description
              </button>
              <button
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "submissions" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                }`}
                onClick={() => setActiveTab("submissions")}
              >
                Submissions
              </button>
            </div>

            {activeTab === "description" && (
              <div className="space-y-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: problem.description.replace(/\n/g, "<br/>") }} />
                </div>

                {problem.constraints && (
                  <div>
                    <h3 className="font-semibold mb-2">Constraints</h3>
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                      {problem.constraints.split("\n").map((c, i) => (
                        <div key={i}>{c}</div>
                      ))}
                    </div>
                  </div>
                )}

                {problem.testCases.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Examples</h3>
                    <div className="space-y-3">
                      {problem.testCases.slice(0, 3).map((tc, i) => (
                        <div key={tc.id} className="rounded-md border bg-muted/30 p-3">
                          <div className="text-xs text-muted-foreground mb-1">Example {i + 1}</div>
                          <div className="font-mono text-sm space-y-1">
                            <div><span className="text-muted-foreground">Input: </span>{tc.input}</div>
                            <div><span className="text-muted-foreground">Output: </span>{tc.expected}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {problem.hints && (
                  <div>
                    <button
                      onClick={() => setShowHints(!showHints)}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${showHints ? "rotate-90" : ""}`} />
                      {showHints ? "Hide Hints" : "Show Hints"}
                    </button>
                    {showHints && (
                      <div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
                        {(() => {
                          try {
                            const hints: string[] = JSON.parse(problem.hints!);
                            return hints.map((h, i) => <div key={i}>{i + 1}. {h}</div>);
                          } catch {
                            return <div>{problem.hints}</div>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="lg:w-1/2 flex flex-col">
          {/* Language selector and actions */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-background border rounded-md px-3 py-1.5 text-sm"
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="go">Go</option>
              <option value="ruby">Ruby</option>
            </select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                Run
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Submit
              </Button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-[300px]">
            <MonacoEditor
              height="100%"
              language={language === "python" ? "python" : language === "go" ? "go" : language === "ruby" ? "ruby" : "javascript"}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
              }}
            />
          </div>

          {/* Results Panel */}
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
        </div>
      </div>
    </>
  );
}
