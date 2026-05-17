"use client";

import { useEffect, useState, use } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ProblemDescription } from "@/components/problem/problem-description";
import { TestResultsPanel } from "@/components/problem/test-results-panel";
import { Play, Send, Loader2 } from "lucide-react";
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
        body: JSON.stringify({ code, language, problemId: problem.id }),
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
        <div className="lg:w-1/2 border-r overflow-y-auto">
          <ProblemDescription
            title={problem.title}
            difficulty={problem.difficulty}
            description={problem.description}
            constraints={problem.constraints}
            hints={problem.hints}
            testCases={problem.testCases}
            tags={problem.tags}
          />
        </div>

        <div className="lg:w-1/2 flex flex-col">
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

          <TestResultsPanel results={results} submitStatus={submitStatus} />
        </div>
      </div>
    </>
  );
}
