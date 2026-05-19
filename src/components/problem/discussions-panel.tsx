"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { MessageSquare, Send, Loader2 } from "lucide-react";

interface Discussion {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; avatar: string | null };
  _count: { comments: number };
}

interface DiscussionsPanelProps {
  problemId: string;
  isAuthenticated: boolean;
}

export function DiscussionsPanel({ problemId, isAuthenticated }: DiscussionsPanelProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/discussions?problemId=${encodeURIComponent(problemId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setDiscussions(data.discussions ?? []))
      .catch(() => setDiscussions([]))
      .finally(() => setLoading(false));
  }, [problemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, title: trimmedTitle, body: trimmedBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not post discussion", data.error ?? "Try again later.");
        return;
      }
      toast.success("Discussion posted");
      setTitle("");
      setBody("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Discussions
          {!loading && <span className="text-xs text-muted-foreground font-normal">({discussions.length})</span>}
        </h3>
        {isAuthenticated && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New post"}
          </Button>
        )}
      </div>

      {showForm && isAuthenticated && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border bg-card p-3">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border rounded-md px-3 py-2 text-sm"
            required
            minLength={3}
            maxLength={200}
          />
          <textarea
            placeholder="Share your approach, ask a question, post a hint..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-background border rounded-md px-3 py-2 text-sm min-h-[100px] resize-y"
            required
            maxLength={10000}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Post
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : discussions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No discussions yet"
          description={isAuthenticated ? "Start the conversation — share your approach or ask a question." : "Sign in to start the conversation."}
          action={
            !isAuthenticated && (
              <Link href="/login" className="text-sm text-primary hover:underline">
                Sign in to post
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-2">
          {discussions.map((d) => (
            <li key={d.id} className="rounded-lg border bg-card p-3 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/discussions/${d.id}`} className="font-medium text-sm hover:text-primary line-clamp-1">
                  {d.title}
                </Link>
                <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(d.createdAt)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.body}</div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <Link href={`/users/${d.user.username}`} className="hover:text-primary">
                  @{d.user.username}
                </Link>
                <span>·</span>
                <span>{d._count.comments} {d._count.comments === 1 ? "comment" : "comments"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
