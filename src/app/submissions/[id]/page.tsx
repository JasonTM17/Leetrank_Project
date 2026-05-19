"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PercentileCard } from "@/components/submission/percentile-card";
import { ArrowLeft, FileCode, AlertTriangle } from "lucide-react";
import { formatRelativeTime, formatDate, getDifficultyBg } from "@/lib/utils";
import { languageLabel } from "@/lib/languages";

interface SubmissionDetail {
  id: string;
  status: string;
  language: string;
  code: string;
  runtime: number | null;
  error: string | null;
  createdAt: string;
  problem: { id: string; title: string; slug: string; difficulty: string };
  user: { id: string; username: string; avatar: string | null };
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  accepted: { label: "Accepted", tone: "text-success" },
  wrong_answer: { label: "Wrong Answer", tone: "text-destructive" },
  runtime_error: { label: "Runtime Error", tone: "text-destructive" },
  time_limit_exceeded: { label: "Time Limit Exceeded", tone: "text-warning" },
};

export default function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<"unauthorized" | "forbidden" | "not_found" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/submissions/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 401) { setError("unauthorized"); return null; }
        if (r.status === 403) { setError("forbidden"); return null; }
        if (r.status === 404) { setError("not_found"); return null; }
        return r.ok ? r.json() : null;
      })
      .then((data) => { if (data) setSubmission(data.submission); })
      .catch(() => {})
      .finally(() => setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-4xl w-full px-4 py-8 space-y-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-64 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  if (error === "forbidden" || error === "unauthorized") {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-2xl w-full px-4 py-16">
          <EmptyState
            icon={AlertTriangle}
            title="Submission is private"
            description={error === "unauthorized" ? "Sign in to view your submissions." : "Submission code is only visible to its author and admins."}
            action={<Link href="/dashboard" className="text-sm text-primary hover:underline">Back to dashboard</Link>}
          />
        </main>
        <Footer />
      </>
    );
  }

  if (error === "not_found" || !submission) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-2xl w-full px-4 py-16">
          <EmptyState
            icon={FileCode}
            title="Submission not found"
            description="This submission may have been deleted."
            action={<Link href="/dashboard" className="text-sm text-primary hover:underline">Back to dashboard</Link>}
          />
        </main>
        <Footer />
      </>
    );
  }

  const status = STATUS_LABEL[submission.status] ?? { label: submission.status, tone: "text-muted-foreground" };

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Dashboard", href: "/dashboard" },
              { label: "Submission" },
            ]}
          />

          <div className="space-y-2 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <Link
                href={`/problems/${submission.problem.slug}`}
                className="text-2xl font-bold hover:text-primary"
              >
                {submission.problem.title}
              </Link>
              <Badge className={getDifficultyBg(submission.problem.difficulty) + " text-xs"}>
                {submission.problem.difficulty}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className={status.tone + " font-medium"}>{status.label}</span>
              <span>·</span>
              <span>{languageLabel(submission.language)}</span>
              {submission.runtime !== null && (
                <>
                  <span>·</span>
                  <span>{submission.runtime}ms</span>
                </>
              )}
              <span>·</span>
              <span title={formatDate(submission.createdAt)}>{formatRelativeTime(submission.createdAt)}</span>
            </div>
          </div>

          {submission.error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Runtime error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-destructive">
                  {submission.error}
                </pre>
              </CardContent>
            </Card>
          )}

          {submission.status === "accepted" && submission.runtime !== null && (
            <PercentileCard submissionId={submission.id} />
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-4 w-4" /> Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono whitespace-pre overflow-x-auto rounded-md bg-muted p-4 scrollbar-thin">
                <code>{submission.code}</code>
              </pre>
            </CardContent>
          </Card>

          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
