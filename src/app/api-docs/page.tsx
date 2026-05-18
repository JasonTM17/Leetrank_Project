"use client";

import { useEffect, useRef } from "react";

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
    <main>
      <style>{`body { margin: 0; } .topbar { display: none; }`}</style>
      <div id="swagger-ui" />
    </main>
  );
}
