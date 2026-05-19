"use client";

import { useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const SWAGGER_VERSION = "5.20.7";

// Renders Swagger UI off the published CDN bundle so we don't carry it as a
// dependency. Loaded client-side via dynamic <script> tags so Next 16's
// no-sync-scripts lint doesn't fire — synchronous <script src> in the
// Server-rendered tree blocks the renderer.
export default function ApiDocsPage() {
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const w = window as unknown as {
        SwaggerUIBundle?: (opts: Record<string, unknown>) => unknown;
        ui?: unknown;
      };
      if (typeof w.SwaggerUIBundle === "function") {
        w.ui = w.SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          layout: "BaseLayout",
          docExpansion: "list",
          defaultModelsExpandDepth: 1,
        });
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb
            className="mb-6"
            items={[{ label: "Home", href: "/" }, { label: "API Docs" }]}
          />
          <div className="mb-6 animate-fade-in-up">
            <h1 className="text-3xl font-bold">
              <span className="gradient-text">API</span> Reference
            </h1>
            <p className="mt-1 text-muted-foreground">
              Interactive OpenAPI documentation for the LeetRank REST API.
            </p>
          </div>
        </div>
        <style>{`.topbar { display: none; } .swagger-ui .info { margin: 0; } .swagger-ui .scheme-container { padding: 0 1rem; }`}</style>
        <div id="swagger-ui" className="px-4 sm:px-6 lg:px-8 pb-16" />
      </main>
      <Footer />
    </>
  );
}
