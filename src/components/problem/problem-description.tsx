"use client";

import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { HintsProgressive } from "@/components/problem/hints-progressive";
import { EditorialTab } from "@/components/problem/editorial-tab";

interface TestCase {
  id: string;
  input: string;
  expected: string;
  isHidden?: boolean;
  order: number;
}

interface ProblemDescriptionProps {
  description: string;
  constraints?: string;
  hints?: string;
  editorial?: string;
  testCases: TestCase[];
  tags: { id: string; name: string }[];
  title: string;
  slug: string;
  difficulty: string;
  isAdmin?: boolean;
  isAuthenticated?: boolean;
}

export function ProblemDescription({
  description,
  constraints,
  hints,
  editorial,
  testCases,
  tags,
  title,
  slug,
  difficulty,
  isAdmin = false,
  isAuthenticated = false,
}: ProblemDescriptionProps) {
  const difficultyBg =
    difficulty === "easy"
      ? "bg-green-500/10 text-green-500"
      : difficulty === "medium"
        ? "bg-yellow-500/10 text-yellow-500"
        : "bg-red-500/10 text-red-500";

  const difficultyDotColor =
    difficulty === "easy"
      ? "text-green-500"
      : difficulty === "medium"
        ? "text-yellow-500"
        : "text-red-500";

  const publicTestCases = testCases.filter((tc) => !tc.isHidden);
  const hiddenTestCases = testCases.filter((tc) => tc.isHidden);

  // ── Parsed hints ────────────────────────────────────────────────────────────
  const parsedHints: string[] = (() => {
    if (!hints) return [];
    try {
      const parsed: unknown = JSON.parse(hints);
      if (Array.isArray(parsed)) return parsed.map(String);
      return [hints];
    } catch {
      return [hints];
    }
  })();

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Problems", href: "/problems" },
          { label: title },
        ]}
      />

      {/* Title + difficulty */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        <Badge className={difficultyBg}>
          <span aria-hidden="true" className={`mr-1 ${difficultyDotColor}`}>
            ●
          </span>
          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </Badge>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag.id} variant="secondary">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Accordion sections */}
      <Accordion type="single" defaultOpen="description">
        {/* ── Description ── */}
        <AccordionItem value="description" title="Description">
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-1">
            {description.split("\n").map((line, i) => (
              <p key={i} className="my-1">
                {line || " "}
              </p>
            ))}
          </div>

          {/* Public examples */}
          {publicTestCases.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Examples</h3>
              {publicTestCases.slice(0, 3).map((tc, i) => (
                <div
                  key={tc.id}
                  className="rounded-md border bg-muted/30 p-3"
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    Example {i + 1}
                  </div>
                  <div className="font-mono text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Input: </span>
                      {tc.input}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Output: </span>
                      {tc.expected}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionItem>

        {/* ── Constraints ── */}
        {constraints && (
          <AccordionItem value="constraints" title="Constraints">
            <div className="bg-muted/50 rounded-md p-3 space-y-0.5">
              {constraints.split("\n").map((c, i) => (
                <div key={i} className="font-mono text-xs">
                  {c}
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {/* ── Hints ── */}
        {parsedHints.length > 0 && (
          <AccordionItem value="hints" title="Hints">
            <HintsProgressive
              slug={slug}
              hints={parsedHints}
              isAuthenticated={isAuthenticated}
            />
          </AccordionItem>
        )}

        {/* ── Editorial ── */}
        {editorial && (
          <AccordionItem value="editorial" title="Editorial">
            <div className="prose prose-sm dark:prose-invert max-w-none space-y-1">
              {editorial.split("\n").map((line, i) => (
                <p key={i} className="my-1">
                  {line || " "}
                </p>
              ))}
            </div>
          </AccordionItem>
        )}

        {/* ── Hidden test cases (admin only) ── */}
        {isAdmin && hiddenTestCases.length > 0 && (
          <AccordionItem
            value="hidden-tests"
            title={`Hidden Test Cases (${hiddenTestCases.length})`}
          >
            <div className="space-y-2">
              {hiddenTestCases.map((tc, i) => (
                <div
                  key={tc.id}
                  className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-3"
                >
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium">
                    Hidden #{i + 1}
                  </div>
                  <div className="font-mono text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Input: </span>
                      {tc.input}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected: </span>
                      {tc.expected}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
