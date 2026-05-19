"use client";

// Lightweight markdown renderer for discussion bodies and replies.
// Sanitizes via rehype-sanitize (default schema) so user input can't
// inject scripts. Code blocks are lazy-rendered with react-syntax-highlighter
// to keep the initial bundle small — discussions render plenty of plain text
// where the highlighter is dead weight.

import { lazy, Suspense, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

// rsh weighs ~200kb gzipped before language packs land. Hide it behind a
// dynamic import so the discussion list / form don't pay until a comment
// actually contains a fenced block.
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter/dist/esm/prism-light").then(async (mod) => {
    // Register a small set of languages on the client. Anything not in the
    // list falls back to a plain <pre>.
    const [
      typescript,
      javascript,
      python,
      java,
      cpp,
      go,
      rust,
    ] = await Promise.all([
      import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
      import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
      import("react-syntax-highlighter/dist/esm/languages/prism/python"),
      import("react-syntax-highlighter/dist/esm/languages/prism/java"),
      import("react-syntax-highlighter/dist/esm/languages/prism/cpp"),
      import("react-syntax-highlighter/dist/esm/languages/prism/go"),
      import("react-syntax-highlighter/dist/esm/languages/prism/rust"),
    ]);
    mod.default.registerLanguage("typescript", typescript.default);
    mod.default.registerLanguage("ts", typescript.default);
    mod.default.registerLanguage("javascript", javascript.default);
    mod.default.registerLanguage("js", javascript.default);
    mod.default.registerLanguage("python", python.default);
    mod.default.registerLanguage("py", python.default);
    mod.default.registerLanguage("java", java.default);
    mod.default.registerLanguage("cpp", cpp.default);
    mod.default.registerLanguage("c++", cpp.default);
    mod.default.registerLanguage("go", go.default);
    mod.default.registerLanguage("rust", rust.default);
    mod.default.registerLanguage("rs", rust.default);
    return mod;
  })
);

type CodeProps = ComponentProps<"code"> & { inline?: boolean };

function CodeBlock({ inline, className, children, ...rest }: CodeProps) {
  const match = /language-(\w+)/.exec(className ?? "");
  const lang = match?.[1];
  const value = String(children ?? "").replace(/\n$/, "");
  if (inline || !lang) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono"
        {...rest}
      >
        {children}
      </code>
    );
  }
  return (
    <Suspense
      fallback={
        <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
          <code>{value}</code>
        </pre>
      }
    >
      <SyntaxHighlighter
        language={lang}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          padding: "0.75rem",
          fontSize: "0.8125rem",
          background: "hsl(var(--muted) / 0.6)",
        }}
      >
        {value}
      </SyntaxHighlighter>
    </Suspense>
  );
}

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={
        "prose prose-sm dark:prose-invert max-w-none break-words " +
        "prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none " +
        (className ?? "")
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code: CodeBlock as never,
          a: ({ href, children: linkChildren, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline"
              {...rest}
            >
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
