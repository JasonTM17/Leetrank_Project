"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { formatRelativeTime } from "@/lib/utils";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; avatar: string | null };
}

interface Discussion {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; username: string; avatar: string | null };
  comments: Comment[];
  problemId: string;
}

export default function DiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/discussions/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : Promise.reject(r);
      })
      .then((data) => { if (data) setDiscussion(data.discussion); })
      .catch(() => setDiscussion(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not post comment", data.error ?? "Try again later.");
        return;
      }
      toast.success("Comment posted");
      setComment("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this discussion? Comments will be removed too.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discussions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Discussion deleted");
        if (discussion?.problemId) {
          window.location.href = `/problems`;
        }
      } else {
        toast.error("Could not delete");
      }
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-3xl w-full px-4 py-8 space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  if (notFound || !discussion) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-2xl w-full px-4 py-16">
          <EmptyState
            icon={MessageSquare}
            title="Discussion not found"
            description="This thread may have been deleted by its author."
            action={<Link href="/problems" className="text-sm text-primary hover:underline">Browse problems</Link>}
          />
        </main>
        <Footer />
      </>
    );
  }

  const canDelete = user && (user.id === discussion.user.id || user.role === "admin");

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: "Home", href: "/" },
              { label: "Problems", href: "/problems" },
              { label: "Discussion" },
            ]}
          />

          {/* Original post */}
          <article className="rounded-lg border bg-card p-6 animate-fade-in-up">
            <h1 className="text-2xl font-bold leading-tight">{discussion.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Link href={`/users/${discussion.user.username}`} className="font-medium hover:text-primary">
                @{discussion.user.username}
              </Link>
              <span>·</span>
              <span>{formatRelativeTime(discussion.createdAt)}</span>
              {canDelete && (
                <>
                  <span>·</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 text-destructive hover:underline"
                  >
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Delete
                  </button>
                </>
              )}
            </div>
            <div className="mt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
              {discussion.body}
            </div>
          </article>

          {/* Comments */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold mb-3">
              {discussion.comments.length} {discussion.comments.length === 1 ? "comment" : "comments"}
            </h2>

            {discussion.comments.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Be the first to reply.</p>
            )}

            <ul className="space-y-3">
              {discussion.comments.map((c) => (
                <li key={c.id}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Link href={`/users/${c.user.username}`} className="font-medium text-foreground hover:text-primary">
                          @{c.user.username}
                        </Link>
                        <span>·</span>
                        <span>{formatRelativeTime(c.createdAt)}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>

            {/* Comment form */}
            {user ? (
              <form onSubmit={handleComment} className="mt-6 space-y-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full bg-background border rounded-md px-3 py-2 text-sm min-h-[80px] resize-y"
                  required
                  maxLength={5000}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Comment
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">Sign in</Link> to comment.
              </p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
