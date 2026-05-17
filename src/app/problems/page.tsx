"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getDifficultyBg } from "@/lib/utils";
import { Search, Filter, CheckCircle2, Circle, Loader2 } from "lucide-react";

interface ProblemItem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: { id: string; name: string }[];
  _count?: { submissions: number };
  solved?: boolean;
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [tags, setTags] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setTags(data.tags || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchProblems();
  }, [difficulty, selectedTag]);

  async function fetchProblems() {
    setLoading(true);
    const params = new URLSearchParams();
    if (difficulty) params.set("difficulty", difficulty);
    if (selectedTag) params.set("tag", selectedTag);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/problems?${params}`);
      const data = await res.json();
      setProblems(data.problems || []);
    } catch {
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    fetchProblems();
  }

  const difficulties = ["", "Easy", "Medium", "Hard"];

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Problems</h1>
              <p className="text-muted-foreground mt-1">Practice makes perfect. Choose a problem to solve.</p>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search problems..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button type="submit" variant="secondary" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </form>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {difficulties.map((d) => (
              <Button
                key={d || "all"}
                variant={difficulty === d ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficulty(d)}
              >
                {d ? d.charAt(0).toUpperCase() + d.slice(1) : "All"}
              </Button>
            ))}
            <div className="w-px bg-border mx-2" />
            {tags.slice(0, 8).map((tag) => (
              <Button
                key={tag.slug}
                variant={selectedTag === tag.slug ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTag(selectedTag === tag.slug ? "" : tag.slug)}
              >
                {tag.name}
              </Button>
            ))}
          </div>

          {/* Problem List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : problems.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No problems found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-12">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Tags</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-28">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {problems.map((problem) => (
                    <tr key={problem.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {problem.solved ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/30" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/problems/${problem.slug}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {problem.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {problem.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag.id} variant="secondary" className="text-xs">
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getDifficultyBg(problem.difficulty)}>
                          {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
