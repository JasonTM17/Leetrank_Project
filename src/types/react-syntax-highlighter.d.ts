// react-syntax-highlighter ships JS-only sub-paths under dist/esm.
// @types/react-syntax-highlighter only declares the package root, so the
// dynamic imports we use for code-splitting trigger TS7016 / no-implicit-any
// under typescript >= 6. These shims keep them typed as `any` (the upstream
// types use the same fallback shape).

declare module "react-syntax-highlighter/dist/esm/prism-light" {
  import type { ComponentType, ReactNode } from "react";

  type Highlighter = ComponentType<{
    children?: ReactNode;
    language?: string;
    style?: Record<string, unknown>;
    PreTag?: keyof JSX.IntrinsicElements | ComponentType<unknown>;
    customStyle?: Record<string, unknown>;
    [key: string]: unknown;
  }> & {
    registerLanguage: (name: string, lang: unknown) => void;
  };

  const SyntaxHighlighter: Highlighter;
  export default SyntaxHighlighter;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/*" {
  const lang: unknown;
  export default lang;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism/*" {
  const style: Record<string, unknown>;
  export default style;
}
