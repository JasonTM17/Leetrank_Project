import { readFile } from "node:fs/promises";
import path from "node:path";

// Serve the OpenAPI YAML straight off disk so the spec stays in sync with
// what's committed to the repo. Reads from docs/openapi.yaml at request time
// in dev so editing the file is hot. In production the file is bundled as a
// Node asset and the read still resolves; a runtime cache makes this cheap.

let cachedSpec: string | null = null;

async function loadSpec(): Promise<string> {
  if (cachedSpec && process.env.NODE_ENV === "production") return cachedSpec;
  const filePath = path.join(process.cwd(), "docs", "openapi.yaml");
  const spec = await readFile(filePath, "utf-8");
  cachedSpec = spec;
  return spec;
}

export async function GET() {
  try {
    const spec = await loadSpec();
    return new Response(spec, {
      headers: {
        "Content-Type": "application/yaml; charset=utf-8",
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    });
  } catch {
    return Response.json(
      { error: "OpenAPI spec is not available in this build" },
      { status: 500 }
    );
  }
}
