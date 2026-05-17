"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface TestCase {
  id: string;
  input: string;
  expected: string;
  order: number;
}

interface ProblemDescriptionProps {
  description: string;
  constraints?: string;
  hints?: string;
  testCases: TestCase[];
  tags: { id: string; name: string }[];
  title: string;
  difficulty: string;
}

export function ProblemDescription({
  description,
  constraints,
  hints,
  testCases,
  tags,
  title,
  difficulty,
}: ProblemDescriptionProps) {
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [showHints, setShowHints] = useState(false);

  const difficultyBg =
    difficulty === "easy" ? "bg-green-500/10 text-green-500" :
    difficulty === "medium" ? "bg-yellow-500/10 text-yellow-500" :
    "bg-red-500/10 text-red-500";

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Badge className={difficultyBg}>
          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </Badge>
      </div>

      <div className="flex gap-2 mb-6">
        {tags.map((tag) => (
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
            <div dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, "<br/>") }} />
          </div>

          {constraints && (
            <div>
              <h3 className="font-semibold mb-2">Constraints</h3>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                {constraints.split("\n").map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </div>
            </div>
          )}

          {testCases.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Examples</h3>
              <div className="space-y-3">
                {testCases.slice(0, 3).map((tc, i) => (
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

          {hints && (
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
                      const parsed: string[] = JSON.parse(hints);
                      return parsed.map((h, i) => <div key={i}>{i + 1}. {h}</div>);
                    } catch {
                      return <div>{hints}</div>;
                    }
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
