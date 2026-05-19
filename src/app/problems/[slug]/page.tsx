"use client";

import { useEffect, useState, useRef, use } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ProblemDescription } from "@/components/problem/problem-description";
import { TestResultsPanel } from "@/components/problem/test-results-panel";
import { DiscussionsPanel } from "@/components/problem/discussions-panel";
import { BookmarkButton } from "@/components/problem/bookmark-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Play, Send, Loader2, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { LANGUAGES, monacoLanguageFor, languageLabel, type LanguageDef } from "@/lib/languages";
import { useAuth } from "@/hooks/useAuth";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const ChatBot = dynamic(
  () => import("@/components/chat/chat-bot").then((m) => ({ default: m.ChatBot })),
  { ssr: false }
);

// ── Types ──────────────────────────────────────────────────────────────────────

interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  hints?: string;
  editorial?: string;
  constraints?: string;
  starterCode?: string;
  tags: { id: string; name: string }[];
  testCases: { id: string; input: string; expected: string; isHidden?: boolean; order: number }[];
}

interface TestResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtime?: number;
  error?: string;
}

// ── Language picker helpers ────────────────────────────────────────────────────

const CATEGORY_ORDER: LanguageDef["category"][] = [
  "scripting",
  "compiled",
  "jvm",
  "functional",
  "data",
  "esoteric",
];

const CATEGORY_LABELS: Record<LanguageDef["category"], string> = {
  scripting: "Scripting",
  compiled: "Compiled",
  jvm: "JVM",
  functional: "Functional",
  data: "Data / Numeric",
  esoteric: "Esoteric",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProblemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  // Keep parsed starter codes so reset can restore them without re-fetching.
  const startersRef = useRef<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/problems/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setProblem(data.problem);
        if (data.problem?.starterCode) {
          try {
            const starters: Record<string, string> = JSON.parse(data.problem.starterCode);
            startersRef.current = starters;
            setCode(starters[language] ?? starters.python ?? "");
          } catch {
            setCode(data.problem.starterCode as string);
          }
        }
      })
      .catch(() => setProblem(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // When language changes, swap to that language's starter (if available).
  function handleLanguageChange(lang: string) {
    setLanguage(lang);
    const starter = startersRef.current[lang];
    if (starter !== undefined) setCode(starter);
  }

  function handleReset() {
    const starter = startersRef.current[language];
    if (starter !== undefined) setCode(starter);
  }

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
          testCases: problem.testCases
            .filter((tc) => !tc.isHidden)
            .map((tc) => ({ input: tc.input, expected: tc.expected })),
        }),
      });
      const data = await res.json();
      setResults((data.results as TestResult[]) || []);
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
      setSubmitStatus((data.submission?.status as string) || "error");
      if (data.results) setResults(data.results as TestResult[]);
    } catch {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / not-found states ─────────────────────────────────────────────

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

  // ── Shared sub-panels (avoid JSX duplication between mobile/desktop) ────────

  const problemPanel = (
    <>
      <ProblemDescription
        title={problem.title}
        difficulty={problem.difficulty}
        description={problem.description}
        constraints={problem.constraints}
        hints={problem.hints}
        editorial={problem.editorial}
        testCases={problem.testCases}
        tags={problem.tags}
        isAdmin={isAdmin}
      />
      <div className="px-6 pb-8">
        <DiscussionsPanel problemId={problem.id} isAuthenticated={!!user} />
      </div>
    </>
  );

  const editorToolbar = (
    <div className="flex items-center justify-between border-b px-4 py-2 gap-2">
      {/* Language picker — grouped DropdownMenu */}
      <DropdownMenu
        trigger={
          <span className="bg-background border rounded-md px-3 py-1.5 text-sm font-medium">
            {languageLabel(language)}
          </span>
        }
        widthClass="w-56"
        align="bottom-start"
      >
        {CATEGORY_ORDER.map((cat, catIdx) => {
          const langs = LANGUAGES.filter((l) => l.category === cat);
          if (langs.length === 0) return null;
          return (
            <div key={cat}>
              {catIdx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{CATEGORY_LABELS[cat]}</DropdownMenuLabel>
              {langs.map((lang) => (
                <DropdownMenuItem
                  key={lang.id}
                  onSelect={() => handleLanguageChange(lang.id)}
                >
                  {lang.label}
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
      </DropdownMenu>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <BookmarkButton problemId={problem.id} isAuthenticated={!!user} />

        <Tooltip content="Reset to starter code" side="top">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            aria-label="Reset code to starter"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Run against examples" side="top">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRun}
            disabled={running}
            aria-label="Run code"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Run
          </Button>
        </Tooltip>

        <Tooltip content="Submit solution" side="top">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            aria-label="Submit solution"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Submit
          </Button>
        </Tooltip>
      </div>
    </div>
  );

  const editorPanel = (
    <div className="flex flex-col h-full">
      {editorToolbar}
      <div className="flex-1 min-h-[300px]">
        <MonacoEditor
          height="100%"
          language={monacoLanguageFor(language)}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? "")}
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
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />

      {/* ── Mobile: stacked tabs (< md) ── */}
      <div className="md:hidden flex flex-col min-h-[calc(100vh-4rem)]">
        <Tabs defaultValue="problem" className="flex flex-col flex-1">
          <TabsList className="w-full rounded-none border-b bg-background justify-start px-4 h-10">
            <TabsTrigger value="problem" className="text-sm">
              Problem
            </TabsTrigger>
            <TabsTrigger value="code" className="text-sm">
              Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="problem" className="flex-1 overflow-y-auto mt-0">
            {problemPanel}
          </TabsContent>

          <TabsContent value="code" className="flex-1 flex flex-col mt-0 min-h-[60vh]">
            {editorPanel}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Desktop: split pane (md+) ── */}
      <div className="hidden md:flex flex-1 flex-row min-h-[calc(100vh-4rem)]">
        <div className="w-1/2 border-r overflow-y-auto scrollbar-thin">
          {problemPanel}
        </div>
        <div className="w-1/2 flex flex-col">
          {editorPanel}
        </div>
      </div>

      <ChatBot userId={user?.id ?? null} problemId={problem.id} />
    </>
  );
}
