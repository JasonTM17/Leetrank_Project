"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "@/hooks/useToast";

interface BookmarkButtonProps {
  problemId: string;
  isAuthenticated: boolean;
}

export function BookmarkButton({ problemId, isAuthenticated }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetch(`/api/bookmarks?problemId=${encodeURIComponent(problemId)}`)
      .then((r) => (r.ok ? r.json() : { bookmarked: false }))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      .then((data) => setBookmarked(!!data.bookmarked))
      .catch(() => setBookmarked(false))
      .finally(() => setLoading(false));
  }, [problemId, isAuthenticated]);

  async function handleToggle() {
    if (!isAuthenticated) {
      toast.info("Sign in", "Bookmarks are only saved for logged-in users.");
      return;
    }
    setPending(true);
    const previous = bookmarked;
    setBookmarked(!previous);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId }),
      });
      if (!res.ok) throw new Error("toggle failed");
      const data = await res.json();
      setBookmarked(!!data.bookmarked);
      toast.success(data.bookmarked ? "Bookmarked" : "Bookmark removed");
    } catch {
      setBookmarked(previous);
      toast.error("Could not update bookmark");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <Button size="sm" variant="ghost" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant={bookmarked ? "default" : "ghost"}
      onClick={handleToggle}
      disabled={pending}
      className="gap-2"
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      <span className="hidden sm:inline">{bookmarked ? "Saved" : "Save"}</span>
    </Button>
  );
}
