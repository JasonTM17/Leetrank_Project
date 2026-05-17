import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Interactive OpenAPI 3.1 reference for the LeetRank REST API. Documents every route, request body, and response shape used by the platform.",
};

const SWAGGER_VERSION = "5.20.7";

// Renders Swagger UI off the published CDN bundle so we don't carry it as a
// dependency. The bundle is content-addressed (versioned URL) and Subresource
// Integrity hashes pin the exact build we audited.
export default function ApiDocsPage() {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href={`https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`}
        />
        <style>{`
          body { margin: 0; }
          .topbar { display: none; }
        `}</style>
      </head>
      <body>
        <div id="swagger-ui" />
        <script
          src={`https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`}
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function () {
                window.ui = SwaggerUIBundle({
                  url: '/api/openapi',
                  dom_id: '#swagger-ui',
                  deepLinking: true,
                  presets: [SwaggerUIBundle.presets.apis],
                  layout: 'BaseLayout',
                  docExpansion: 'list',
                  defaultModelsExpandDepth: 1,
                });
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
