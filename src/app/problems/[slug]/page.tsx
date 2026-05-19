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
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Play, Send, Loader2, RotateCcw, LogIn } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LANGUAGES, monacoLanguageFor, languageLabel, type LanguageDef } from "@/lib/languages";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";

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
  const { user, isAuthenticated, isLoading: authLoading, setUser } = useAuth();
  const isAdmin = user?.role === "admin";

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  // Anonymous users get a friendly modal explaining why Submit is gated.
  // Authed users with a stale cookie (401 mid-session) reuse the same
  // modal but with `expired = true` so we can swap copy without a second
  // dialog component.
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptExpired, setAuthPromptExpired] = useState(false);

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
    // Gate 1: anonymous users never hit the network. We surface a clear
    // modal CTA instead of letting the API return 401 + opaque toast.
    if (!authLoading && !isAuthenticated) {
      setAuthPromptExpired(false);
      setAuthPromptOpen(true);
      return;
    }
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, problemId: problem.id }),
      });
      // Distinguish error classes by status so the user gets actionable
      // feedback instead of a single "Submission Error" pill for every
      // failure mode. 401 also clears the auth store so the navbar
      // updates immediately.
      if (!res.ok) {
        let errMsg = "";
        try {
          const data = await res.json();
          errMsg = (data?.error as string) || "";
        } catch {
          // body might be empty / non-JSON; fall through to status-based copy
        }
        if (res.status === 401) {
          setUser(null);
          setAuthPromptExpired(true);
          setAuthPromptOpen(true);
          setSubmitStatus(null);
          return;
        }
        if (res.status === 403) {
          toast.error(
            "Permission denied",
            "You don't have permission to submit. Contact support if this is wrong."
          );
          setSubmitStatus("error");
          return;
        }
        if (res.status === 429) {
          toast.warning(
            "Too many submissions",
            "Wait a moment and try again."
          );
          setSubmitStatus("error");
          return;
        }
        if (res.status >= 500) {
          toast.error(
            "Couldn't reach the judge",
            "The judge service is unavailable. Try again in a moment."
          );
          setSubmitStatus("error");
          return;
        }
        toast.error("Submission failed", errMsg || `Request failed (${res.status})`);
        setSubmitStatus("error");
        return;
      }
      const data = await res.json();
      setSubmitStatus((data.submission?.status as string) || "queued");
      if (data.results) setResults(data.results as TestResult[]);
    } catch {
      // Network-level failure (DNS, offline, CORS) — distinct from any
      // HTTP status the server returned.
      toast.error(
        "Couldn't reach the judge",
        "Network error. Check your connection and try again."
      );
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

        <Tooltip
          content={
            !authLoading && !isAuthenticated
              ? "Sign in to submit"
              : "Submit solution"
          }
          side="top"
        >
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            aria-label={
              !authLoading && !isAuthenticated
                ? "Sign in to submit solution"
                : "Submit solution"
            }
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : !authLoading && !isAuthenticated ? (
              <LogIn className="h-4 w-4 mr-1" />
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

      {/*
        Auth-required modal — surfaced when an anon user hits Submit, or
        when an authed user's session expired (401 on POST). We share one
        Dialog and swap copy via `authPromptExpired` so the modal stays
        compact and the user always sees the same visual hierarchy.
        `from` carries the current slug so login can bounce them back.
      */}
      <Dialog
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        title={
          authPromptExpired
            ? "Your session expired"
            : "Sign in to submit your solution"
        }
        description={
          authPromptExpired
            ? "Sign in again to submit your solution."
            : "Track your progress, climb the leaderboard, and join contests."
        }
        size="sm"
      >
        <div className="flex flex-col gap-2 mt-2">
          <Link
            href={`/login?from=/problems/${slug}`}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors motion-safe:duration-200"
            onClick={() => setAuthPromptOpen(false)}
          >
            Sign in
          </Link>
          {!authPromptExpired && (
            <Link
              href="/register"
              className="inline-flex items-center justify-center h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors motion-safe:duration-200"
              onClick={() => setAuthPromptOpen(false)}
            >
              Create account
            </Link>
          )}
        </div>
      </Dialog>
    </>
  );
}
